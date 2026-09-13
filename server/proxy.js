import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { telegramBot } from './telegramBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Global error handlers to prevent proxy crash
process.on('uncaughtException', (err) => {
    console.error('[PROXY] Uncaught Exception (proxy stays alive):', err.message);
});
process.on('unhandledRejection', (err) => {
    console.error('[PROXY] Unhandled Rejection (proxy stays alive):', err);
});

// Request Logger Middleware with Auto-Rotation (Caps log at 5MB)
const PROXY_LOG_FILE = path.join(__dirname, 'proxy.log');
const MAX_PROXY_LOG_SIZE = 5 * 1024 * 1024; // 5 MB cap

app.use((req, res, next) => {
    const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
    try {
        if (fs.existsSync(PROXY_LOG_FILE)) {
            const stats = fs.statSync(PROXY_LOG_FILE);
            if (stats.size > MAX_PROXY_LOG_SIZE) {
                // Keep only the last ~500KB and trim older logs
                const keepBytes = 500 * 1024;
                const fd = fs.openSync(PROXY_LOG_FILE, 'r');
                const buffer = Buffer.alloc(keepBytes);
                fs.readSync(fd, buffer, 0, keepBytes, stats.size - keepBytes);
                fs.closeSync(fd);
                fs.writeFileSync(PROXY_LOG_FILE, buffer);
            }
        }
        fs.appendFileSync(PROXY_LOG_FILE, log);
    } catch (e) { /* ignore log errors */ }
    next();
});

const SOFASCORE_FILE = path.join(__dirname, 'sofascore_live.json');
const CONSENSUS_FILE = path.join(__dirname, 'consensus_data.json');
const STATS_DIR = path.join(__dirname, 'stats');
const REQUEST_QUEUE = path.join(__dirname, 'stats_request.json');
const ODDS_FILE = path.join(__dirname, 'live_odds.json');

if (!fs.existsSync(STATS_DIR)) fs.mkdirSync(STATS_DIR, { recursive: true });

app.use('/data', express.static(__dirname));

// 1. Live Events List
app.get('/api/sofascore/live', (req, res) => {
    if (fs.existsSync(SOFASCORE_FILE)) {
        try {
            const data = fs.readFileSync(SOFASCORE_FILE, 'utf8');
            return res.json(JSON.parse(data));
        } catch (e) {
            console.error('[PROXY] Error reading sofascore_live.json:', e.message);
            return res.status(500).json({ error: 'Parse error' });
        }
    }
    res.status(404).json({ error: 'Data not found yet' });
});

// 2. Consensus / Radar Data (SINGLE route - removed duplicate)
app.get('/api/consensus', (req, res) => {
    if (fs.existsSync(CONSENSUS_FILE)) {
        try {
            res.setHeader('Content-Type', 'application/json');
            const data = fs.readFileSync(CONSENSUS_FILE, 'utf8');
            return res.send(data);
        } catch (e) {
            console.error('[PROXY] Error reading consensus_data.json:', e.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    res.json({});
});

// 3. Match Details (with freshness check)
app.get('/api/sofascore/event/:id', (req, res) => {
    const id = req.params.id;
    const filePath = path.join(STATS_DIR, `${id}_detail.json`);

    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const ageInSeconds = (Date.now() - stats.mtimeMs) / 1000;

        // Still queue if older than 60s, but return the current data
        if (ageInSeconds >= 60) {
            queueRequest(id);
        }

        const data = fs.readFileSync(filePath, 'utf8');
        try {
            const json = JSON.parse(data);
            if (!json.error) {
                if (ageInSeconds >= 60) queueRequest(id);
                return res.json(json);
            }
            
            // If the saved file is a 404 error from SofaScore, return 404 to frontend and DO NOT re-queue
            if (json.error && (json.error.code === 404 || json.error.status === 404)) {
                return res.status(404).json({ error: 'Not Found on SofaScore', message: 'Statistics not available for this match', noStats: true });
            }
        } catch (e) {
            console.error(`Error parsing ${filePath}:`, e);
        }
    }

    queueRequest(id);
    res.status(202).json({ status: 'queued', message: 'Detail missing' });
});

// 4. Match Statistics (with freshness check)
app.get('/api/sofascore/event/:id/statistics', (req, res) => {
    const id = req.params.id;
    const filePath = path.join(STATS_DIR, `${id}_stats.json`);

    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const ageInSeconds = (Date.now() - stats.mtimeMs) / 1000;

        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(data);
            if (!json.error) {
                if (ageInSeconds >= 60) queueRequest(id);
                return res.json(json);
            }

            // If the saved file is a 404 error from SofaScore, return 404 to frontend and DO NOT re-queue
            if (json.error && (json.error.code === 404 || json.error.status === 404)) {
                return res.status(404).json({ error: 'Not Found on SofaScore', message: 'Statistics not available for this match', noStats: true });
            }
        } catch (e) {
            console.error(`Error parsing ${filePath}:`, e);
        }
    }

    queueRequest(id);
    res.status(202).json({ status: 'queued', message: 'Stats missing' });
});

// 5. Match Odds API (Supports both SofaScore market structure and direct 1X2 odds)
app.get(['/api/sofascore/event/:id/odds/1/all', '/api/sofascore/event/:id/odds/:marketId?/:sub?'], (req, res) => {
    const id = req.params.id;
    const oddsFilePath = path.join(STATS_DIR, `${id}_odds.json`);

    // 1. Check if dedicated match odds file exists
    if (fs.existsSync(oddsFilePath)) {
        try {
            const oddsData = JSON.parse(fs.readFileSync(oddsFilePath, 'utf8'));
            if (oddsData && (oddsData.markets || oddsData.odds || oddsData.home)) {
                return res.json(oddsData);
            }
        } catch (e) { }
    }

    // 2. Check central live_odds.json
    if (fs.existsSync(ODDS_FILE)) {
        try {
            const central = JSON.parse(fs.readFileSync(ODDS_FILE, 'utf8'));
            const matchOdds = central[id] || (central.matches && central.matches.find(m => m.id === id || m.eventId === id)?.odds);
            if (matchOdds && (matchOdds.home || matchOdds.draw || matchOdds.away)) {
                // Convert to standard SofaScore market structure expected by frontend
                return res.json({
                    markets: [
                        {
                            id: 1,
                            marketName: 'Full time',
                            choices: [
                                { name: '1', value: matchOdds.home, idx: 1 },
                                { name: 'X', value: matchOdds.draw, idx: 2 },
                                { name: '2', value: matchOdds.away, idx: 3 }
                            ]
                        }
                    ],
                    home: matchOdds.home,
                    draw: matchOdds.draw,
                    away: matchOdds.away,
                    source: 'LOCAL_ODDS'
                });
            }
        } catch (e) { }
    }

    // Odds not available for this event yet
    res.status(404).json({ error: 'Odds not available', eventId: id });
});

// 6. Live Odds API (All matches)
app.get('/api/odds/live', (req, res) => {
    if (fs.existsSync(ODDS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(ODDS_FILE, 'utf8'));
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: "Odds parse error" });
        }
    } else {
        res.json({ matches: [], timestamp: 0, message: 'Odds scraper not running yet' });
    }
});

// --- TELEGRAM API ENDPOINTS ---

// Send signal to Telegram VIP group
app.post('/api/telegram/send-signal', async (req, res) => {
    try {
        const alert = req.body;
        if (!alert || !alert.level) {
            return res.status(400).json({ error: 'Invalid alert data' });
        }
        const result = await telegramBot.processAlert(alert);
        res.json(result);
    } catch (e) {
        console.error('[PROXY] Telegram signal error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Send radar pick to Telegram VIP group
app.post('/api/telegram/send-radar', async (req, res) => {
    try {
        const match = req.body;
        if (!match || !match.home) {
            return res.status(400).json({ error: 'Invalid match data' });
        }
        const result = await telegramBot.sendRadarPick(match);
        res.json({ sent: !!result });
    } catch (e) {
        console.error('[PROXY] Telegram radar error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Send daily report manually
app.post('/api/telegram/send-report', async (req, res) => {
    try {
        const result = await telegramBot.sendDailyReport();
        res.json({ sent: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Telegram bot status
app.get('/api/telegram/status', (req, res) => {
    res.json(telegramBot.getStatus());
});

const QUEUE_COOLDOWN = {}; // Memory-based cooldown

function queueRequest(id) {
    const now = Date.now();
    if (QUEUE_COOLDOWN[id] && (now - QUEUE_COOLDOWN[id]) < 60000) {
        return; // Skip if requested in the last 60 seconds
    }
    QUEUE_COOLDOWN[id] = now;

    let queue = { ids: [] };
    if (fs.existsSync(REQUEST_QUEUE)) {
        try {
            queue = JSON.parse(fs.readFileSync(REQUEST_QUEUE, 'utf8'));
        } catch (e) { }
    }
    if (!queue.ids.includes(id)) {
        queue.ids.push(id);
        fs.writeFileSync(REQUEST_QUEUE, JSON.stringify(queue));
    }
}

// --- SCRAPER MANAGEMENT ---
let scraperProcess = null;

function startScraper() {
    try {
        console.log('[PROXY] Starting SofaScore CDP Scraper...');
        scraperProcess = spawn('python', ['server/sofascore_scraper.py'], {
            stdio: 'inherit'
        });

        scraperProcess.on('error', (err) => {
            console.error('[PROXY] Scraper spawn error (proxy stays alive):', err.message);
        });

        scraperProcess.on('close', (code) => {
            console.log(`[PROXY] Scraper process exited with code ${code}. Restarting in 30s...`);
            scraperProcess = null;
            setTimeout(startScraper, 30000);
        });
    } catch (err) {
        console.error('[PROXY] Failed to start scraper:', err.message);
        setTimeout(startScraper, 15000);
    }
}

function startConsensusScraper() {
    console.log('[PROXY] Initializing Consensus Scraper...');
    const spawnScraper = () => {
        try {
            const pythonProcess = spawn('python', [path.join(__dirname, 'consensus_scraper.py')]);
            pythonProcess.stdout.on('data', (data) => console.log(`[CONSENSUS_STDOUT] ${data}`));
            pythonProcess.stderr.on('data', (data) => console.error(`[CONSENSUS_STDERR] ${data}`));
            pythonProcess.on('error', (err) => {
                console.error('[PROXY] Consensus scraper spawn error:', err.message);
            });
        } catch (err) {
            console.error('[PROXY] Failed to start consensus scraper:', err.message);
        }
    };

    spawnScraper(); // Run once at start
    setInterval(spawnScraper, 4 * 60 * 60 * 1000); // Re-run every 4 hours
}

function startOddsScraper() {
    try {
        console.log('[PROXY] Initializing Odds Scraper...');
        const pythonProcess = spawn('python', [path.join(__dirname, 'odds_scraper.py')], {
            stdio: 'inherit'
        });

        pythonProcess.on('error', (err) => {
            console.error('[PROXY] Odds scraper spawn error:', err.message);
        });

        pythonProcess.on('close', (code) => {
            console.log(`[PROXY] Odds scraper exited with code ${code}. Restarting in 30s...`);
            setTimeout(startOddsScraper, 30000);
        });
    } catch (err) {
        console.error('[PROXY] Failed to start odds scraper:', err.message);
        setTimeout(startOddsScraper, 30000);
    }
}

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[PROXY SERVER] Running on http://0.0.0.0:${PORT} (accessible from network)`);

    // Initialize Telegram Bot
    const botStatus = await telegramBot.validateToken();
    if (botStatus.ok) {
        telegramBot.startPolling();
        telegramBot.scheduleDailyReport(23, 0); // Daily report at 23:00
        console.log('[PROXY] 🤖 Telegram Bot initialized successfully');
    } else {
        console.warn('[PROXY] ⚠️ Telegram Bot not available:', botStatus.error);
    }

    startScraper();
    setTimeout(() => {
        console.log('[PROXY] Starting delayed Consensus Scraper...');
        startConsensusScraper();
    }, 10000);
    // [REMOVED] OddsPortal scraper bypassed for performance (v2.1)
    /*
    setTimeout(() => {
        console.log('[PROXY] Starting delayed Odds Scraper...');
        startOddsScraper();
    }, 30000);
    */
});
