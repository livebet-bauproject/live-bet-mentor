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

// --- IN-MEMORY DATA STORE (for cloud mode) ---
let memoryLiveData = null;
let memoryConsensusData = null;
let memoryStatsCache = {};
let lastUploadTime = 0;

const RENDER_UPLOAD_SECRET = process.env.UPLOAD_SECRET || 'lbm-sync-2026';

// 0. UPLOAD ENDPOINTS (Local proxy pushes data here)
app.post('/api/sync/live', express.json({ limit: '10mb' }), (req, res) => {
    if (req.headers['x-sync-secret'] !== RENDER_UPLOAD_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    memoryLiveData = req.body;
    lastUploadTime = Date.now();
    // Also write to file if possible
    try { fs.writeFileSync(SOFASCORE_FILE, JSON.stringify(req.body), 'utf8'); } catch(e) {}
    console.log(`[SYNC] Received live data: ${req.body?.events?.length || 0} events`);
    res.json({ ok: true, events: req.body?.events?.length || 0 });
});

app.post('/api/sync/consensus', express.json({ limit: '10mb' }), (req, res) => {
    if (req.headers['x-sync-secret'] !== RENDER_UPLOAD_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    memoryConsensusData = req.body;
    try { fs.writeFileSync(CONSENSUS_FILE, JSON.stringify(req.body), 'utf8'); } catch(e) {}
    console.log(`[SYNC] Received consensus data: ${Object.keys(req.body || {}).length} sources`);
    res.json({ ok: true });
});

app.post('/api/sync/stats/:id', express.json({ limit: '5mb' }), (req, res) => {
    if (req.headers['x-sync-secret'] !== RENDER_UPLOAD_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const id = req.params.id;
    memoryStatsCache[id] = { data: req.body, time: Date.now() };
    // Write detail and stats to files
    try {
        if (req.body.detail) fs.writeFileSync(path.join(STATS_DIR, `${id}_detail.json`), JSON.stringify(req.body.detail), 'utf8');
        if (req.body.stats) fs.writeFileSync(path.join(STATS_DIR, `${id}_stats.json`), JSON.stringify(req.body.stats), 'utf8');
    } catch(e) {}
    res.json({ ok: true });
});

app.get('/api/sync/status', (req, res) => {
    res.json({
        hasLiveData: !!memoryLiveData,
        eventsCount: memoryLiveData?.events?.length || 0,
        lastUpload: lastUploadTime ? new Date(lastUploadTime).toISOString() : null,
        ageSec: lastUploadTime ? Math.floor((Date.now() - lastUploadTime) / 1000) : -1
    });
});

// 1. Live Events List
app.get('/api/sofascore/live', (req, res) => {
    // Try file first (local mode)
    if (fs.existsSync(SOFASCORE_FILE)) {
        try {
            const data = fs.readFileSync(SOFASCORE_FILE, 'utf8');
            return res.json(JSON.parse(data));
        } catch (e) {
            console.error('[PROXY] Error reading sofascore_live.json:', e.message);
        }
    }
    // Fall back to memory (cloud mode - data pushed from local)
    if (memoryLiveData) {
        return res.json(memoryLiveData);
    }
    res.status(404).json({ error: 'Data not found yet. Waiting for local sync.' });
});

// 2. Consensus / Radar Data
app.get('/api/consensus', (req, res) => {
    if (fs.existsSync(CONSENSUS_FILE)) {
        try {
            res.setHeader('Content-Type', 'application/json');
            const data = fs.readFileSync(CONSENSUS_FILE, 'utf8');
            return res.send(data);
        } catch (e) {
            console.error('[PROXY] Error reading consensus_data.json:', e.message);
        }
    }
    // Fall back to memory
    if (memoryConsensusData) {
        return res.json(memoryConsensusData);
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

// --- BUILT-IN NODE.JS DATA FETCHER (No Python/Chrome needed) ---
// Used on cloud (Render, etc.) where Python scrapers are not available.

let cachedLiveData = null;
let cachedStatsData = {};

const SOFASCORE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.sofascore.com/',
    'Origin': 'https://www.sofascore.com'
};

async function fetchSofaScoreLiveNode() {
    try {
        const url = `https://www.sofascore.com/api/v1/sport/football/events/live?_=${Date.now()}`;
        const response = await fetch(url, { headers: SOFASCORE_HEADERS, signal: AbortSignal.timeout(12000) });
        if (response.ok) {
            const data = await response.json();
            if (data && data.events) {
                cachedLiveData = data;
                // Write to file for the /api/sofascore/live endpoint
                try { fs.writeFileSync(SOFASCORE_FILE, JSON.stringify(data), 'utf8'); } catch(e) {}
                console.log(`[NODE_FETCHER] SofaScore OK: ${data.events.length} events`);
                return data;
            }
        } else {
            console.warn(`[NODE_FETCHER] SofaScore returned ${response.status}`);
        }
    } catch (e) {
        console.warn(`[NODE_FETCHER] SofaScore fetch error: ${e.message}`);
    }
    return null;
}

async function fetchMatchStatsNode(eventId) {
    try {
        const [detailRes, statsRes] = await Promise.all([
            fetch(`https://www.sofascore.com/api/v1/event/${eventId}`, { headers: SOFASCORE_HEADERS, signal: AbortSignal.timeout(10000) }).catch(() => null),
            fetch(`https://www.sofascore.com/api/v1/event/${eventId}/statistics`, { headers: SOFASCORE_HEADERS, signal: AbortSignal.timeout(10000) }).catch(() => null)
        ]);

        if (detailRes && detailRes.ok) {
            const detail = await detailRes.json();
            const detailPath = path.join(STATS_DIR, `${eventId}_detail.json`);
            fs.writeFileSync(detailPath, JSON.stringify(detail), 'utf8');
        }
        if (statsRes && statsRes.ok) {
            const stats = await statsRes.json();
            const statsPath = path.join(STATS_DIR, `${eventId}_stats.json`);
            fs.writeFileSync(statsPath, JSON.stringify(stats), 'utf8');
        }
    } catch (e) {
        // Silently ignore individual match stats errors
    }
}

async function nodeDataLoop() {
    console.log('[NODE_FETCHER] Starting built-in data fetcher (no Python needed)...');
    while (true) {
        try {
            const data = await fetchSofaScoreLiveNode();
            
            // Auto-fetch stats for top matches
            if (data && data.events) {
                const liveFootball = data.events.filter(e => 
                    e.status?.type === 'inprogress' && 
                    (e.tournament?.category?.sport?.id === 1 || !e.tournament?.category?.sport?.id)
                );
                // Fetch stats for up to 10 matches per cycle
                const batch = liveFootball.slice(0, 10);
                for (const ev of batch) {
                    await fetchMatchStatsNode(ev.id);
                    await new Promise(r => setTimeout(r, 500)); // Small delay between requests
                }
            }

            // Also process any queued stat requests
            if (fs.existsSync(REQUEST_QUEUE)) {
                try {
                    const queue = JSON.parse(fs.readFileSync(REQUEST_QUEUE, 'utf8'));
                    if (queue.ids && queue.ids.length > 0) {
                        const ids = queue.ids.splice(0, 5); // Process 5 at a time
                        fs.writeFileSync(REQUEST_QUEUE, JSON.stringify({ ids: queue.ids }));
                        for (const id of ids) {
                            await fetchMatchStatsNode(id);
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                } catch(e) {}
            }
        } catch (e) {
            console.error('[NODE_FETCHER] Loop error:', e.message);
        }
        await new Promise(r => setTimeout(r, 15000)); // Every 15 seconds
    }
}

// --- SCRAPER MANAGEMENT (Local Dev with Python) ---
let scraperProcess = null;
const IS_CLOUD = !fs.existsSync(path.join(__dirname, '..', '.env')) || process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL;

function startScraper() {
    if (IS_CLOUD) {
        console.log('[PROXY] Cloud environment detected. Starting lightweight Python cloud_fetcher (curl_cffi)...');
        const pythonCmd = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
        const fetcherPath = path.join(__dirname, 'cloud_fetcher.py');

        try {
            scraperProcess = spawn(pythonCmd, [fetcherPath], {
                stdio: 'inherit'
            });

            scraperProcess.on('error', (err) => {
                console.error(`[PROXY] Cloud fetcher spawn error with "${pythonCmd}": ${err.message}. Trying "python"...`);
                try {
                    scraperProcess = spawn('python', [fetcherPath], { stdio: 'inherit' });
                    scraperProcess.on('error', (e2) => {
                        console.error('[PROXY] Cloud fetcher failed completely, falling back to Node fetcher:', e2.message);
                        nodeDataLoop();
                    });
                } catch (fallbackErr) {
                    nodeDataLoop();
                }
            });

            scraperProcess.on('close', (code) => {
                console.log(`[PROXY] Cloud fetcher exited with code ${code}. Restarting in 15s...`);
                scraperProcess = null;
                setTimeout(startScraper, 15000);
            });
        } catch (err) {
            console.error('[PROXY] Failed to start cloud fetcher, falling back to Node fetcher:', err.message);
            nodeDataLoop();
        }
        return;
    }
    try {
        console.log('[PROXY] Starting SofaScore CDP Scraper (local mode)...');
        scraperProcess = spawn('python', ['server/sofascore_scraper.py'], {
            stdio: 'inherit'
        });

        scraperProcess.on('error', (err) => {
            console.error('[PROXY] Scraper spawn error, falling back to Node.js fetcher:', err.message);
            nodeDataLoop();
        });

        scraperProcess.on('close', (code) => {
            console.log(`[PROXY] Scraper process exited with code ${code}. Restarting in 30s...`);
            scraperProcess = null;
            setTimeout(startScraper, 30000);
        });
    } catch (err) {
        console.error('[PROXY] Failed to start scraper, falling back to Node.js fetcher:', err.message);
        nodeDataLoop();
    }
}

function startConsensusScraper() {
    if (IS_CLOUD) {
        console.log('[PROXY] Cloud: Consensus scraper skipped (requires Chrome).');
        return;
    }
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

    spawnScraper();
    setInterval(spawnScraper, 4 * 60 * 60 * 1000);
}

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[PROXY SERVER] Running on http://0.0.0.0:${PORT} (accessible from network)`);
    console.log(`[PROXY] Environment: ${IS_CLOUD ? 'CLOUD (Render)' : 'LOCAL'}`);

    // Initialize Telegram Bot
    const botStatus = await telegramBot.validateToken();
    if (botStatus.ok) {
        telegramBot.startPolling();
        telegramBot.scheduleDailyReport(23, 0);
        console.log('[PROXY] 🤖 Telegram Bot initialized successfully');
    } else {
        console.warn('[PROXY] ⚠️ Telegram Bot not available:', botStatus.error);
    }

    startScraper();
    setTimeout(() => {
        startConsensusScraper();
    }, 10000);

    // LOCAL MODE: Sync data to Render cloud every 15 seconds
    if (!IS_CLOUD) {
        const RENDER_URL = process.env.RENDER_SYNC_URL || 'https://live-bet-mentor.onrender.com';
        const SYNC_SECRET = process.env.UPLOAD_SECRET || 'lbm-sync-2026';

        async function syncToCloud() {
            // Sync live events
            if (fs.existsSync(SOFASCORE_FILE)) {
                try {
                    const data = fs.readFileSync(SOFASCORE_FILE, 'utf8');
                    const res = await fetch(`${RENDER_URL}/api/sync/live`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
                        body: data,
                        signal: AbortSignal.timeout(10000)
                    });
                    if (res.ok) {
                        const result = await res.json();
                        console.log(`[CLOUD_SYNC] Live data pushed: ${result.events} events`);
                    }
                } catch (e) {
                    console.warn(`[CLOUD_SYNC] Live sync failed: ${e.message}`);
                }
            }

            // Sync consensus data (less frequently - every 5 min)
            if (fs.existsSync(CONSENSUS_FILE)) {
                try {
                    const data = fs.readFileSync(CONSENSUS_FILE, 'utf8');
                    const res = await fetch(`${RENDER_URL}/api/sync/consensus`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
                        body: data,
                        signal: AbortSignal.timeout(10000)
                    });
                    if (res.ok) console.log('[CLOUD_SYNC] Consensus data pushed');
                } catch (e) {
                    // Silently ignore
                }
            }
        }

        // Start sync after scraper has time to collect first data
        setTimeout(() => {
            console.log(`[CLOUD_SYNC] Starting local → Render sync to ${RENDER_URL}`);
            syncToCloud(); // First sync
            setInterval(syncToCloud, 15000); // Then every 15 seconds
        }, 20000);
    }
});
