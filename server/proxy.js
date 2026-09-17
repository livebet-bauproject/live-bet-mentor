import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { telegramBot } from './telegramBot.js';
import { learningEngine } from './learningEngine.js';
import { autonomousSignalEngine } from './autonomousSignalEngine.js';
import { 
    hashPassword, 
    verifyPassword, 
    generateSecureToken, 
    verifySecureToken, 
    isValidNumericId, 
    createRateLimiter 
} from './securityUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || 'lbm_sec_vault_2026_981aed67_prod_shield';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Hamza2026!';

// 1. Enterprise Security Headers (OWASP Hardening)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// 2. Strict CORS Configuration
const ALLOWED_ORIGINS = new Set([
    'https://live-bet-mentor-brown.vercel.app',
    'https://livebetmentor.com',
    'https://www.livebetmentor.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:3001'
]);

app.use(cors({
    origin: (origin, callback) => {
        // Allow mobile apps, curl, server-to-server or requests without origin
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.has(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        callback(new Error('CORS policy: Not allowed by CORS'));
    },
    credentials: true
}));

// 3. Brute-Force & DoS Protection Rate Limiters
const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
    message: 'Güvenlik Kalkanı: Çok fazla giriş veya kayıt denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
});

const generalApiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 300,
    message: 'Sistem Koruması: İstek kotası aşıldı, lütfen biraz bekleyiniz.'
});

// Ultra-fast gzip compression middleware (Shrinks /api/sofascore/live from 540KB to ~45KB)
app.use((req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) return next();

    const originalJson = res.json;
    res.json = function(data) {
        try {
            const body = JSON.stringify(data);
            if (body.length > 1500) {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Encoding', 'gzip');
                const compressed = zlib.gzipSync(Buffer.from(body, 'utf8'), { level: 6 });
                return res.send(compressed);
            }
            return originalJson.call(this, data);
        } catch (err) {
            return originalJson.call(this, data);
        }
    };
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
const MEMBERS_FILE = path.join(__dirname, 'web_members.json');
const UPGRADE_REQUESTS_FILE = path.join(__dirname, 'upgrade_requests.json');
const DEVICE_TRIALS_FILE = path.join(__dirname, 'device_trials.json');
const ANALYTICS_FILE = path.join(__dirname, 'analytics_events.json');

const BLOCKED_DISPOSABLE_DOMAINS = new Set([
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'dispostable.com', 'sharklasers.com', 'throwawaymail.com',
    'getairmail.com', 'fakeinbox.com', 'trashmail.com', 'temp-mail.org',
    'mohmal.com', 'crazymailing.com', 'generator.email', 'dropmail.me',
    'temp-mail.io', 'mytemp.email', 'nada.ltd', 'burnermail.io'
]);

function loadDeviceTrials() {
    try {
        if (fs.existsSync(DEVICE_TRIALS_FILE)) {
            return JSON.parse(fs.readFileSync(DEVICE_TRIALS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[DEVICE_TRIALS] Error reading device_trials.json:', e.message);
    }
    return {};
}

function saveDeviceTrials(trials) {
    try {
        fs.writeFileSync(DEVICE_TRIALS_FILE, JSON.stringify(trials, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[DEVICE_TRIALS] Error saving device_trials.json:', e.message);
        return false;
    }
}

function loadUpgradeRequests() {
    try {
        if (fs.existsSync(UPGRADE_REQUESTS_FILE)) {
            return JSON.parse(fs.readFileSync(UPGRADE_REQUESTS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[UPGRADE] Error reading upgrade_requests.json:', e.message);
    }
    return [];
}

function saveUpgradeRequests(reqs) {
    try {
        fs.writeFileSync(UPGRADE_REQUESTS_FILE, JSON.stringify(reqs, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[UPGRADE] Error saving upgrade_requests.json:', e.message);
        return false;
    }
}

function loadMembers() {
    try {
        if (fs.existsSync(MEMBERS_FILE)) {
            return JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[MEMBERS] Error reading web_members.json:', e.message);
    }
    return [];
}

function saveMembers(members) {
    try {
        fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[MEMBERS] Error saving web_members.json:', e.message);
        return false;
    }
}

function sanitizeMember(m) {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    delete copy.password;
    delete copy.salt;
    return copy;
}

function sanitizeMemberList(members) {
    if (!Array.isArray(members)) return [];
    return members.map(sanitizeMember);
}

if (!fs.existsSync(STATS_DIR)) fs.mkdirSync(STATS_DIR, { recursive: true });

// Root Status Page
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Bet Mentor - API Backend</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
        .card { background: #1e293b; border-radius: 12px; padding: 32px; max-width: 600px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h1 { color: #38bdf8; margin-top: 0; font-size: 22px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; background: #065f46; color: #34d399; margin-bottom: 12px; }
        p { color: #94a3b8; line-height: 1.6; }
        .link-box { margin: 20px 0; display: flex; flex-direction: column; gap: 10px; }
        .link-box a { display: block; padding: 12px 16px; background: #334155; color: #f1f5f9; text-decoration: none; border-radius: 8px; font-weight: 500; }
        .link-box a:hover { background: #0284c7; color: #fff; }
        .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; font-size: 13px; color: #64748b; }
    </style>
</head>
<body>
    <div class="card">
        <h1>⚡ Live Bet Mentor API Backend</h1>
        <div><span class="status-badge">● Backend Aktif</span></div>
        <p>Render üzerinde 7/24 API sunucusu çalışıyor.</p>
        
        <div class="link-box">
            <a href="/api/sofascore/live" target="_blank">📊 /api/sofascore/live (Canlı Maç Verisi)</a>
            <a href="/api/debug" target="_blank">🔍 /api/debug (Sistem Durumu & Teşhis)</a>
            <a href="/api/sync/status" target="_blank">⏱ /api/sync/status (Senkronizasyon)</a>
        </div>

        <div class="footer">
            Canlı kullanıcı arayüzü Vercel üzerinde barındırılmaktadır.
        </div>
    </div>
</body>
</html>`);
});

// Diagnostic Endpoint
app.get('/api/debug', async (req, res) => {
    let pythonVersion = 'none';
    let curlCffiStatus = 'unknown';
    let sofascoreDirectTest = 'not run';
    try {
        const { execSync } = await import('child_process');
        const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
        try {
            pythonVersion = execSync(`${pyCmd} --version`, { timeout: 3000 }).toString().trim();
        } catch (e) {
            pythonVersion = `Error: ${e.message}`;
        }
        try {
            curlCffiStatus = execSync(`${pyCmd} -c "import site, sys; sys.path.insert(0, site.getusersitepackages()); import curl_cffi; print('OK v' + curl_cffi.__version__)"`, { timeout: 3000 }).toString().trim();
        } catch (e) {
            curlCffiStatus = `Error: ${e.message}`;
        }
        try {
            sofascoreDirectTest = execSync(`${pyCmd} -c "import site, sys; sys.path.insert(0, site.getusersitepackages()); from curl_cffi import requests; s=requests.Session(impersonate='chrome120'); r=s.get('https://api.sofascore.com/api/v1/sport/football/events/live', headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36','Accept':'application/json'}, timeout=8); print(f'HTTP {r.status_code} ({len(r.text)} bytes)')"`, { timeout: 10000 }).toString().trim();
        } catch (e) {
            sofascoreDirectTest = `Error: ${e.message}`;
        }
    } catch (e) {}

    let statsFilesCount = 0;
    if (fs.existsSync(STATS_DIR)) {
        try { statsFilesCount = fs.readdirSync(STATS_DIR).length; } catch(e) {}
    }

    let scraperLogTail = [];
    const logPath = path.join(__dirname, 'scraper.log');
    if (fs.existsSync(logPath)) {
        try {
            const logs = fs.readFileSync(logPath, 'utf8').trim().split('\n');
            scraperLogTail = logs.slice(-10);
        } catch(e) {}
    }

    let liveFileExists = fs.existsSync(SOFASCORE_FILE);
    let liveFileCount = 0;
    let liveFileAge = -1;
    if (liveFileExists) {
        try {
            const stats = fs.statSync(SOFASCORE_FILE);
            liveFileAge = Math.floor((Date.now() - stats.mtimeMs) / 1000);
            const content = JSON.parse(fs.readFileSync(SOFASCORE_FILE, 'utf8'));
            liveFileCount = content.events?.length || 0;
        } catch(e) {}
    }

    let cloudFetcherStatus = null;
    const statusFile = path.join(__dirname, 'cloud_fetcher_status.json');
    if (fs.existsSync(statusFile)) {
        try {
            cloudFetcherStatus = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        } catch(e) {}
    }

    res.json({
        status: 'online',
        environment: IS_CLOUD ? 'CLOUD (Render)' : 'LOCAL',
        nodeVersion: process.version,
        pythonVersion,
        curlCffiStatus,
        sofascoreDirectTest,
        cloudFetcherStatus,
        statsFilesCount,
        scraperLogTail,
        sofascoreLive: {
            fileExists: liveFileExists,
            eventsCount: liveFileCount,
            ageSeconds: liveFileAge
        },
        memoryLiveDataEvents: memoryLiveData?.events?.length || 0,
        memoryStatsCount: Object.keys(memoryStatsCache || {}).length,
        uptimeSeconds: Math.floor(process.uptime())
    });
});

// --- INSTITUTIONAL MARKET MONEY FLOW ENDPOINT (EU LIVESTREAM) ---
let marketTrendingCache = { data: null, time: 0 };

app.get(['/api/market/trending', '/api/tipico/trending'], async (req, res) => {
    // Return cache if fresh (< 45 seconds)
    if (marketTrendingCache.data && (Date.now() - marketTrendingCache.time < 45000)) {
        return res.json(marketTrendingCache.data);
    }

    try {
        const tipicoUrl = 'https://sports.tipico.de/v1/ser/bgs/api/trendingbets?sport=soccer&language=EN&timeWindow=5&eventType=live';
        const response = await fetch(tipicoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://sports.tipico.de/en'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Live market provider responded with status ${response.status}`,
                cached: marketTrendingCache.data || null
            });
        }

        const raw = await response.json();
        const bets = (raw.bets || []).map(b => ({
            eventId: b.eventId,
            marketId: b.marketId,
            outcomeId: b.outcomeId,
            match: `${b.participants?.home || ''} vs ${b.participants?.away || ''}`,
            home: b.participants?.home || '',
            away: b.participants?.away || '',
            competition: b.competitionName || '',
            market: b.marketName || '',
            marketShort: b.marketShortName || '',
            outcome: b.outcomeName || '',
            odds: b.odds,
            score: b.score ? `${b.score[0]} - ${b.score[1]}` : null,
            count: b.count,
            timeWindow: '5m'
        }));

        const result = {
            success: true,
            count: bets.length,
            updatedAt: new Date().toISOString(),
            bets
        };

        marketTrendingCache = { data: result, time: Date.now() };
        return res.json(result);
    } catch (err) {
        console.error('[MARKET_TRENDS] Error fetching live volume data:', err.message);
        if (marketTrendingCache.data) {
            return res.json(marketTrendingCache.data);
        }
        return res.status(500).json({ error: err.message });
    }
});


// --- IN-MEMORY DATA STORE (for cloud mode) ---
let memoryLiveData = null;
let memoryConsensusData = null;
let memoryStatsCache = {};
let lastUploadTime = 0;
const pendingRenderRequests = new Set();

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

// Unified Bundle Sync Endpoint (Syncs live list, consensus and active matches stats in 1 fast call)
app.post('/api/sync/bundle', express.json({ limit: '50mb' }), (req, res) => {
    if (req.headers['x-sync-secret'] !== RENDER_UPLOAD_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const { live, consensus, stats } = req.body || {};
    let statsSaved = 0;

    if (live) {
        memoryLiveData = live;
        lastUploadTime = Date.now();
        try { fs.writeFileSync(SOFASCORE_FILE, JSON.stringify(live), 'utf8'); } catch(e) {}
        if (Array.isArray(live.events)) {
            telegramBot.autoResolveSignals(live.events).catch(err => console.warn('[TELEGRAM] Auto-resolve error:', err.message));
        }
    }

    if (consensus) {
        memoryConsensusData = consensus;
        try { fs.writeFileSync(CONSENSUS_FILE, JSON.stringify(consensus), 'utf8'); } catch(e) {}
    }

    if (stats && typeof stats === 'object') {
        if (!fs.existsSync(STATS_DIR)) {
            try { fs.mkdirSync(STATS_DIR, { recursive: true }); } catch(e) {}
        }
        for (const [id, item] of Object.entries(stats)) {
            try {
                if (item.detail) {
                    if (live && Array.isArray(live.events)) {
                        const ev = live.events.find(e => e.id == id);
                        if (ev && item.detail.event) {
                            if (ev.homeScore) item.detail.event.homeScore = ev.homeScore;
                            if (ev.awayScore) item.detail.event.awayScore = ev.awayScore;
                            if (ev.status) item.detail.event.status = ev.status;
                        }
                    }
                    fs.writeFileSync(path.join(STATS_DIR, `${id}_detail.json`), JSON.stringify(item.detail), 'utf8');
                }
                if (item.stats) {
                    fs.writeFileSync(path.join(STATS_DIR, `${id}_stats.json`), JSON.stringify(item.stats), 'utf8');
                }
                if (item.odds) {
                    fs.writeFileSync(path.join(STATS_DIR, `${id}_odds.json`), JSON.stringify(item.odds), 'utf8');
                }
                memoryStatsCache[id] = { data: item, time: Date.now() };
                statsSaved++;
            } catch (err) {}
        }
    }

    const pendingIds = Array.from(pendingRenderRequests);
    pendingRenderRequests.clear();
    console.log(`[SYNC_BUNDLE] Synced: live=${live?.events?.length || 0} events, statsSaved=${statsSaved} matches, pendingReqs=${pendingIds.length}`);
    res.json({ ok: true, liveEvents: live?.events?.length || 0, statsSaved, pendingRequests: pendingIds });
});

// Queue endpoint for local scraper to fetch user-demanded match IDs
app.get('/api/sync/queue', (req, res) => {
    let ids = [];
    if (fs.existsSync(REQUEST_QUEUE)) {
        try {
            const data = JSON.parse(fs.readFileSync(REQUEST_QUEUE, 'utf8'));
            ids = data.ids || [];
        } catch(e) {}
    }
    for (const pid of pendingRenderRequests) {
        if (!ids.includes(pid)) ids.push(pid);
    }
    pendingRenderRequests.clear();
    res.json({ ids });
});

app.get('/api/sync/status', (req, res) => {
    let statsCount = 0;
    if (fs.existsSync(STATS_DIR)) {
        try { statsCount = fs.readdirSync(STATS_DIR).length; } catch(e) {}
    }
    res.json({
        hasLiveData: !!memoryLiveData,
        eventsCount: memoryLiveData?.events?.length || 0,
        statsFilesCount: statsCount,
        memoryStatsCount: Object.keys(memoryStatsCache || {}).length,
        lastUpload: lastUploadTime ? new Date(lastUploadTime).toISOString() : null,
        ageSec: lastUploadTime ? Math.floor((Date.now() - lastUploadTime) / 1000) : -1
    });
});

// 1. Live Events List
app.get('/api/sofascore/live', (req, res) => {
    // Try file first (local mode or cloud_fetcher written file)
    if (fs.existsSync(SOFASCORE_FILE)) {
        try {
            const data = fs.readFileSync(SOFASCORE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed && Array.isArray(parsed.events) && parsed.events.length > 0) {
                memoryLiveData = parsed;
                return res.json(parsed);
            }
        } catch (e) {
            console.error('[PROXY] Error reading sofascore_live.json:', e.message);
        }
    }
    // Fall back to memory (cloud mode or last known data)
    if (memoryLiveData && Array.isArray(memoryLiveData.events) && memoryLiveData.events.length > 0) {
        return res.json(memoryLiveData);
    }
    res.status(404).json({ error: 'Data not found yet. Initializing autonomous fetch...' });
});

// 2. Consensus / Radar Data
app.get('/api/consensus', (req, res) => {
    // Check memory store first (freshly synced / uploaded)
    if (memoryConsensusData) {
        return res.json(memoryConsensusData);
    }
    if (fs.existsSync(CONSENSUS_FILE)) {
        try {
            res.setHeader('Content-Type', 'application/json');
            const data = fs.readFileSync(CONSENSUS_FILE, 'utf8');
            return res.send(data);
        } catch (e) {
            console.error('[PROXY] Error reading consensus_data.json:', e.message);
        }
    }
    res.json({});
});

// 3. Match Details (with freshness check)
app.get('/api/sofascore/event/:id', generalApiLimiter, (req, res) => {
    const id = req.params.id;
    if (!isValidNumericId(id)) {
        return res.status(400).json({ error: 'Geçersiz maç ID formatı.' });
    }
    let detailJson = null;

    if (memoryStatsCache[id]?.data?.detail) {
        const cacheAge = (Date.now() - (memoryStatsCache[id].time || 0)) / 1000;
        if (cacheAge >= 30) queueRequest(id);
        detailJson = memoryStatsCache[id].data.detail;
    } else {
        const filePath = path.join(STATS_DIR, `${id}_detail.json`);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const ageInSeconds = (Date.now() - stats.mtimeMs) / 1000;
            if (ageInSeconds >= 30) queueRequest(id);

            const data = fs.readFileSync(filePath, 'utf8');
            try {
                const json = JSON.parse(data);
                if (!json.error) {
                    detailJson = json;
                } else if (json.error && (json.error.code === 404 || json.error.status === 404)) {
                    return res.status(404).json({ error: 'Not Found on SofaScore', message: 'Statistics not available for this match', noStats: true });
                }
            } catch (e) {
                console.error(`Error parsing ${filePath}:`, e);
            }
        }
    }

    if (detailJson) {
        // ALWAYS attach fresh live score and status from memoryLiveData or sofascore_live.json
        let liveEvents = memoryLiveData?.events;
        if (!liveEvents && fs.existsSync(SOFASCORE_FILE)) {
            try { liveEvents = JSON.parse(fs.readFileSync(SOFASCORE_FILE, 'utf8'))?.events; } catch(e) {}
        }
        if (liveEvents && Array.isArray(liveEvents)) {
            const ev = liveEvents.find(e => e.id == id);
            if (ev && detailJson.event) {
                if (ev.homeScore) detailJson.event.homeScore = ev.homeScore;
                if (ev.awayScore) detailJson.event.awayScore = ev.awayScore;
                if (ev.status) detailJson.event.status = ev.status;
            }
        }
        return res.json(detailJson);
    }

    queueRequest(id);
    res.status(202).json({ status: 'queued', message: 'Detail missing' });
});

// 4. Match Statistics (with freshness check)
app.get('/api/sofascore/event/:id/statistics', generalApiLimiter, (req, res) => {
    const id = req.params.id;
    if (!isValidNumericId(id)) {
        return res.status(400).json({ error: 'Geçersiz maç ID formatı.' });
    }
    if (memoryStatsCache[id]?.data?.stats) {
        const cacheAge = (Date.now() - (memoryStatsCache[id].time || 0)) / 1000;
        if (cacheAge >= 30) queueRequest(id);
        const statsObj = memoryStatsCache[id].data.stats;
        if (statsObj.error && (statsObj.error.code === 404 || statsObj.error.status === 404)) {
            return res.status(404).json({ error: 'Not Found on SofaScore', message: 'Statistics not available for this match', noStats: true });
        }
        return res.json(statsObj);
    }
    const filePath = path.join(STATS_DIR, `${id}_stats.json`);

    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const ageInSeconds = (Date.now() - stats.mtimeMs) / 1000;

        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(data);
            if (!json.error) {
                if (ageInSeconds >= 30) queueRequest(id);
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

const SOFASCORE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.sofascore.com/',
    'Origin': 'https://www.sofascore.com'
};

// 4b. Match Attack Momentum Graph (Minute-by-minute pressure wave)
const memoryGraphCache = {};

function getActiveProxy() {
    try {
        const statusFile = path.join(__dirname, 'cloud_fetcher_status.json');
        if (fs.existsSync(statusFile)) {
            const content = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
            if (content && content.active_proxy) return content.active_proxy;
        }
    } catch (e) {}
    return null;
}

function fetchGraphViaCurlCffi(eventId) {
    if (!isValidNumericId(eventId)) return Promise.resolve({ error: true });
    const cleanEventId = String(parseInt(eventId, 10));
    const pyCmd = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
    const proxy = getActiveProxy();
    return new Promise((resolve) => {
        const pyScript = `import site, sys, json
sys.path.insert(0, site.getusersitepackages())
try:
    from curl_cffi import requests
    proxy = ${proxy ? JSON.stringify(proxy) : 'None'}
    proxies = {"http": f"http://{proxy}", "https": f"http://{proxy}"} if proxy else None
    r = requests.get('https://api.sofascore.com/api/v1/event/${cleanEventId}/graph', impersonate='chrome120', proxies=proxies, timeout=3.0)
    if r.status_code == 200:
        print(r.text)
    elif r.status_code == 404:
        print('{"graphPoints":[],"noGraph":true}')
    else:
        print(json.dumps({"error": f"HTTP {r.status_code}"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        const child = spawn(pyCmd, ['-c', pyScript]);
        let out = '';
        child.stdout.on('data', d => { out += d.toString(); });
        child.on('close', () => {
            try {
                const parsed = JSON.parse(out.trim());
                resolve(parsed);
            } catch (e) {
                resolve({ error: true });
            }
        });
        child.on('error', () => resolve({ error: true }));
        setTimeout(() => {
            try { child.kill(); } catch (e) {}
            resolve({ error: true });
        }, 3500);
    });
}

app.get('/api/sofascore/event/:id/graph', generalApiLimiter, async (req, res) => {
    const id = req.params.id;
    if (!isValidNumericId(id)) {
        return res.status(400).json({ error: 'Geçersiz maç ID formatı.' });
    }
    const now = Date.now();
    if (memoryGraphCache[id] && (now - memoryGraphCache[id].time) < 45000) {
        return res.json(memoryGraphCache[id].data);
    }
    
    // 1. Return from disk cache if exists (never discard valid historical points)
    const graphFilePath = path.join(STATS_DIR, `${id}_graph.json`);
    if (fs.existsSync(graphFilePath)) {
        try {
            const stats = fs.statSync(graphFilePath);
            const ageInSeconds = (now - stats.mtimeMs) / 1000;
            const data = JSON.parse(fs.readFileSync(graphFilePath, 'utf8'));
            if (data && !data.error && ((data.graphPoints && data.graphPoints.length > 0) || (data.graphPointsV2 && data.graphPointsV2.length > 0) || data.noGraph)) {
                memoryGraphCache[id] = { time: now, data };
                if (ageInSeconds >= 45) queueRequest(id);
                return res.json(data);
            }
        } catch(e) {}
    }

    queueRequest(id);

    // Fast on-demand fetch using curl_cffi with active proxy
    try {
        const cffiData = await fetchGraphViaCurlCffi(id);
        if (cffiData && !cffiData.error && ((cffiData.graphPoints && cffiData.graphPoints.length > 0) || (cffiData.graphPointsV2 && cffiData.graphPointsV2.length > 0) || cffiData.noGraph)) {
            memoryGraphCache[id] = { time: now, data: cffiData };
            try { fs.writeFileSync(graphFilePath, JSON.stringify(cffiData), 'utf8'); } catch(e) {}
            return res.json(cffiData);
        }
    } catch (err) {
        console.warn(`[PROXY] curl_cffi graph fetch error for ${id}:`, err.message);
    }

    // Direct node fetch fallback only if local dev (Render is blocked)
    if (process.platform === 'win32' || !process.env.RENDER) {
        try {
            const fetchRes = await fetch(`https://api.sofascore.com/api/v1/event/${id}/graph`, {
                headers: SOFASCORE_HEADERS,
                signal: AbortSignal.timeout(2500)
            });
            if (fetchRes.ok) {
                const data = await fetchRes.json();
                memoryGraphCache[id] = { time: now, data };
                try { fs.writeFileSync(graphFilePath, JSON.stringify(data), 'utf8'); } catch(e) {}
                return res.json(data);
            } else if (fetchRes.status === 404) {
                const notFoundData = { graphPoints: [], noGraph: true };
                memoryGraphCache[id] = { time: now, data: notFoundData };
                try { fs.writeFileSync(graphFilePath, JSON.stringify(notFoundData), 'utf8'); } catch(e) {}
                return res.json(notFoundData);
            }
        } catch (err) {}
    }

    if (memoryGraphCache[id]) return res.json(memoryGraphCache[id].data);
    res.status(202).json({ graphPoints: [], status: 'queued', message: 'Graph queued' });
});

// 4c. Match Incidents & Events Timeline
const memoryIncidentsCache = {};

function fetchIncidentsViaCurlCffi(eventId) {
    if (!isValidNumericId(eventId)) return Promise.resolve({ error: true });
    const cleanEventId = String(parseInt(eventId, 10));
    const pyCmd = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
    const proxy = getActiveProxy();
    return new Promise((resolve) => {
        const pyScript = `import site, sys, json
sys.path.insert(0, site.getusersitepackages())
try:
    from curl_cffi import requests
    proxy = ${proxy ? JSON.stringify(proxy) : 'None'}
    proxies = {"http": f"http://{proxy}", "https": f"http://{proxy}"} if proxy else None
    r = requests.get('https://api.sofascore.com/api/v1/event/${cleanEventId}/incidents', impersonate='chrome120', proxies=proxies, timeout=3.0)
    if r.status_code == 200:
        print(r.text)
    elif r.status_code == 404:
        print('{"incidents":[],"noIncidents":true}')
    else:
        print(json.dumps({"error": f"HTTP {r.status_code}"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        const child = spawn(pyCmd, ['-c', pyScript]);
        let out = '';
        child.stdout.on('data', d => { out += d.toString(); });
        child.on('close', () => {
            try {
                const parsed = JSON.parse(out.trim());
                resolve(parsed);
            } catch (e) {
                resolve({ error: true });
            }
        });
        child.on('error', () => resolve({ error: true }));
        setTimeout(() => {
            try { child.kill(); } catch (e) {}
            resolve({ error: true });
        }, 3500);
    });
}

app.get('/api/sofascore/event/:id/incidents', generalApiLimiter, async (req, res) => {
    const id = req.params.id;
    if (!isValidNumericId(id)) {
        return res.status(400).json({ error: 'Geçersiz maç ID formatı.' });
    }
    const now = Date.now();
    if (memoryIncidentsCache[id] && (now - memoryIncidentsCache[id].time) < 30000) {
        return res.json(memoryIncidentsCache[id].data);
    }

    const incidentsFilePath = path.join(STATS_DIR, `${id}_incidents.json`);
    if (fs.existsSync(incidentsFilePath)) {
        try {
            const stats = fs.statSync(incidentsFilePath);
            const ageInSeconds = (now - stats.mtimeMs) / 1000;
            const data = JSON.parse(fs.readFileSync(incidentsFilePath, 'utf8'));
            // Only accept valid data: non-empty incidents array, OR explicit noIncidents flag
            if (data && !data.error && ((Array.isArray(data.incidents) && data.incidents.length > 0) || data.noIncidents)) {
                memoryIncidentsCache[id] = { time: now, data };
                if (ageInSeconds >= 30) queueRequest(id);
                return res.json(data);
            }
        } catch(e) {}
    }

    queueRequest(id);

    try {
        const cffiData = await fetchIncidentsViaCurlCffi(id);
        // Only accept if not error AND has incidents or explicit noIncidents
        if (cffiData && !cffiData.error && ((Array.isArray(cffiData.incidents) && cffiData.incidents.length > 0) || cffiData.noIncidents)) {
            memoryIncidentsCache[id] = { time: now, data: cffiData };
            try { fs.writeFileSync(incidentsFilePath, JSON.stringify(cffiData), 'utf8'); } catch(e) {}
            return res.json(cffiData);
        }
    } catch (err) {
        console.warn(`[PROXY] curl_cffi incidents fetch error for ${id}:`, err.message);
    }

    // Direct node fetch fallback only if local dev (Render is blocked)
    if (process.platform === 'win32' || !process.env.RENDER) {
        try {
            const fetchRes = await fetch(`https://api.sofascore.com/api/v1/event/${id}/incidents`, {
                headers: SOFASCORE_HEADERS,
                signal: AbortSignal.timeout(2500)
            });
            if (fetchRes.ok) {
                const data = await fetchRes.json();
                memoryIncidentsCache[id] = { time: now, data };
                try { fs.writeFileSync(incidentsFilePath, JSON.stringify(data), 'utf8'); } catch(e) {}
                return res.json(data);
            } else if (fetchRes.status === 404) {
                const notFoundData = { incidents: [], noIncidents: true };
                memoryIncidentsCache[id] = { time: now, data: notFoundData };
                try { fs.writeFileSync(incidentsFilePath, JSON.stringify(notFoundData), 'utf8'); } catch(e) {}
                return res.json(notFoundData);
            }
        } catch (err) {}
    }

    if (memoryIncidentsCache[id]) return res.json(memoryIncidentsCache[id].data);
    res.status(202).json({ incidents: [], status: 'queued', message: 'Incidents queued' });
});

// 4d. Team Crest / Logo Proxy with 24-hour cache
app.get(['/api/team/:id/image', '/api/sofascore/team/:id/image'], generalApiLimiter, async (req, res) => {
    const id = req.params.id;
    if (!isValidNumericId(id)) {
        return res.status(400).send('Invalid team ID');
    }
    try {
        const upstreamUrl = `https://img.sofascore.com/api/v1/team/${id}/image`;
        const resp = await fetch(upstreamUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://www.sofascore.com/'
            },
            signal: AbortSignal.timeout(5000)
        });
        if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'image/webp';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            const arrayBuffer = await resp.arrayBuffer();
            return res.send(Buffer.from(arrayBuffer));
        }
    } catch (e) {}
    return res.status(404).send('Not found');
});

// 5. Match Odds API (Supports both SofaScore market structure and direct 1X2 odds)
app.get(['/api/sofascore/event/:id/odds/1/all', '/api/sofascore/event/:id/odds/:marketId?/:sub?'], generalApiLimiter, (req, res) => {
    const id = req.params.id;
    if (!isValidNumericId(id)) {
        return res.status(400).json({ error: 'Geçersiz maç ID formatı.' });
    }
    if (memoryStatsCache[id]?.data?.odds) {
        return res.json(memoryStatsCache[id].data.odds);
    }
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

// --- SECURE ADMIN AUTHORIZATION HELPER ---
const isAdminRequest = (req) => {
    const rawToken = req.headers['x-admin-token'] || req.headers['authorization'];
    if (rawToken) {
        const payload = verifySecureToken(rawToken, JWT_SECRET);
        if (payload && payload.role === 'admin') {
            return true;
        }
        if (process.env.ADMIN_API_KEY && rawToken === process.env.ADMIN_API_KEY) {
            return true;
        }
    }

    // Machine-to-machine sync secret
    const syncSecret = req.headers['x-sync-secret'] || req.headers['x-api-key'];
    if (syncSecret && (syncSecret === (process.env.ADMIN_API_KEY || RENDER_UPLOAD_SECRET))) {
        return true;
    }

    // In local development mode ONLY, allow trusted local admin email
    const ip = req.ip || req.connection?.remoteAddress || '';
    const isLocalhost = ip.includes('127.0.0.1') || ip === '::1' || ip.includes('localhost');
    if (isLocalhost && process.env.NODE_ENV !== 'production') {
        const adminSender = req.headers['x-admin-sender'] || req.headers['x-admin-email'];
        const allowedAdmins = ['admin@livebetmentor.com', 'admin', 'karabulut.hamza@gmail.com', 'admin@local.dev'];
        if (adminSender && allowedAdmins.includes(String(adminSender).trim().toLowerCase())) {
            return true;
        }
    }

    return false;
};

// --- TELEGRAM API ENDPOINTS ---

// Send signal to Telegram VIP group
app.post('/api/telegram/send-signal', async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler sinyal gönderebilir.' });
        }
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
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler radar tahmini gönderebilir.' });
        }
        const match = req.body;
        if (!match || !match.home) {
            return res.status(400).json({ error: 'Invalid match data' });
        }
        const result = await telegramBot.sendRadarPick(match, { sendTeaser: req.body.sendTeaser !== false });
        res.json({ sent: !!result, result });
    } catch (e) {
        console.error('[PROXY] Telegram radar error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Broadcast top consensus radar picks manually
app.post('/api/telegram/broadcast-radar', async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler toplu radar yayını yapabilir.' });
        }
        const limit = parseInt(req.body?.limit) || 2;
        const result = await telegramBot.broadcastConsensusPicks({ force: true, limit });
        res.json(result);
    } catch (e) {
        console.error('[PROXY] Telegram broadcast radar error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Send daily report manually
app.post('/api/telegram/send-report', async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler günlük rapor gönderebilir.' });
        }
        const result = await telegramBot.sendDailyReport();
        res.json({ sent: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Send golden double combo to VIP
app.post('/api/telegram/send-combo', async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler altın ikili gönderebilir.' });
        }
        const { combo } = req.body || {};
        if (!combo || !combo.picks || combo.picks.length === 0) {
            return res.status(400).json({ error: 'Geçerli bir altın ikili kombinasyonu bulunamadı.' });
        }
        const result = await telegramBot.sendGoldenCombo(combo);
        if (!result) {
            return res.status(500).json({ sent: false, error: 'Telegram mesajı iletilemedi. Bot veya grup izinlerini kontrol edin.' });
        }
        res.json({ sent: true, result });
    } catch (e) {
        console.error('[PROXY] Error sending golden combo:', e.message);
        res.status(500).json({ sent: false, error: e.message });
    }
});

// Resolve a Telegram signal
app.post('/api/telegram/resolve-signal', async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler sinyal sonuçlandırabilir.' });
        }
        const { id, alertId, matchId, result, score } = req.body || {};
        if (!result) {
            return res.status(400).json({ error: 'Result (WON/LOST/VOID) is required' });
        }
        const resolved = await telegramBot.resolveSignal({ id, alertId, matchId }, result, score, true);
        res.json({ success: !!resolved, signal: resolved });
    } catch (e) {
        console.error('[PROXY] Error resolving telegram signal:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Notify Admin of a new member registration or upgrade request
app.post('/api/telegram/notify-admin', async (req, res) => {
    try {
        const { email, fullName, phone, plan, type } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const dateStr = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const title = type === 'UPGRADE' ? '💎 VIP ÜYELİK YÜKSELTME TALEBİ!' : '🔔 YENİ ÜYELİK BAŞVURUSU!';
        const msg = `*${title}*\n\n` +
                    `📧 *E-posta:* \`${email}\`\n` +
                    (fullName ? `👤 *İsim:* ${fullName}\n` : '') +
                    (phone ? `📞 *Telefon:* ${phone}\n` : '') +
                    `⭐ *Paket / Plan:* ${plan || 'Trial (Deneme)'}\n` +
                    `📅 *Tarih:* ${dateStr}\n\n` +
                    `👉 _LiveBet Mentor Admin Panelinden onaylayabilir veya süre tanımlayabilirsiniz._`;

        let sent = false;
        if (telegramBot && telegramBot.bot) {
            const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '8965087988').split(',').map(s => s.trim()).filter(Boolean);
            for (const adminId of adminIds) {
                try {
                    await telegramBot.bot.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
                    sent = true;
                } catch (err) {
                    console.error(`[PROXY] Failed to notify admin ${adminId}:`, err.message);
                }
            }
        }
        res.json({ success: true, sent });
    } catch (e) {
        console.error('[PROXY] Error in notify-admin:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ==================== WEB MEMBER MANAGEMENT API ====================

// 1. Get all members (Protected: Admin Only, Passwords Stripped)
app.get('/api/members', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yetkili yöneticiler üye listesine erişebilir.' });
        }
        const members = loadMembers();
        const sanitizedMembers = members.map(m => {
            const copy = { ...m };
            delete copy.password;
            delete copy.salt;
            return copy;
        });
        res.json({ success: true, members: sanitizedMembers });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Register new member (Rate Limited, PBKDF2 Salted Hashing)
app.post('/api/members/register', authRateLimiter, async (req, res) => {
    try {
        const { email, password, fullName, phone, plan, deviceId } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'E-posta zorunludur.' });
        }
        const cleanEmail = email.trim().toLowerCase();

        // 1. Anti-Abuse: Block Disposable / Temp-Mail Providers
        const domain = cleanEmail.split('@')[1];
        if (domain && BLOCKED_DISPOSABLE_DOMAINS.has(domain)) {
            return res.status(400).json({
                error: 'Geçici veya sahte e-posta adresleri kabul edilmemektedir. Lütfen geçerli bir e-posta (Gmail, Hotmail, Outlook vb.) kullanınız.'
            });
        }

        // 2. Anti-Abuse: Prevent Multi-Account Device Trial Farming
        const deviceTrials = loadDeviceTrials();
        if (deviceId && deviceTrials[deviceId]) {
            const existingTrial = deviceTrials[deviceId];
            if (existingTrial.email !== cleanEmail) {
                return res.status(403).json({
                    error: '⚠️ Bu cihazdan daha önce 24 saatlik ücretsiz deneme hakkı kullanılmıştır. Lütfen mevcut hesabınıza giriş yapın veya VIP üyeliğe geçin.',
                    deviceUsed: true
                });
            }
        }

        const members = loadMembers();
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour Instant PRO Trial

        let hashedPassword = '';
        let userSalt = '';
        if (password) {
            const hashed = hashPassword(password);
            hashedPassword = hashed.hash;
            userSalt = hashed.salt;
        }

        let member = members.find(m => m.email === cleanEmail);
        if (member) {
            if (password) {
                member.password = hashedPassword;
                member.salt = userSalt;
            }
            if (fullName) member.full_name = fullName;
            if (phone) member.phone = phone;
            if (plan) member.plan = plan;
            if (!member.subscription_end) {
                member.status = 'approved';
                member.subscription_start = now.toISOString();
                member.subscription_end = trialEnd.toISOString();
            }
        } else {
            member = {
                id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                email: cleanEmail,
                password: hashedPassword,
                salt: userSalt,
                full_name: fullName || '',
                phone: phone || '',
                status: 'approved',
                plan: plan || 'trial',
                deviceId: deviceId || null,
                created_at: now.toISOString(),
                subscription_start: now.toISOString(),
                subscription_end: trialEnd.toISOString()
            };
            members.unshift(member);

            if (deviceId) {
                deviceTrials[deviceId] = {
                    email: cleanEmail,
                    registeredAt: now.toISOString(),
                    trialEnd: trialEnd.toISOString()
                };
                saveDeviceTrials(deviceTrials);
            }
        }
        saveMembers(members);

        // Telegram Notification to Admin
        const dateStr = now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const msg = `🎉 *YENİ ÜYE KAYDOLDU (24 Saatlik Deneme Başladı!)*\n\n` +
                    `📧 *E-posta:* \`${cleanEmail}\`\n` +
                    (fullName ? `👤 *İsim:* ${fullName}\n` : '') +
                    (phone ? `📞 *Telefon:* ${phone}\n` : '') +
                    `⭐ *Paket:* ${plan || '24h PRO Trial'}\n` +
                    `📅 *Tarih:* ${dateStr}\n\n` +
                    `⚡ _Kullanıcıya 24 saatlik deneme süresi tanımlandı ve doğrudan dashboard'a yönlendirildi._`;

        if (telegramBot) {
            const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '8965087988').split(',').map(s => s.trim()).filter(Boolean);
            for (const adminId of adminIds) {
                try {
                    const sendFn = typeof telegramBot.sendMessage === 'function'
                        ? telegramBot.sendMessage.bind(telegramBot)
                        : (telegramBot.bot && typeof telegramBot.bot.sendMessage === 'function' ? telegramBot.bot.sendMessage.bind(telegramBot.bot) : null);
                    if (sendFn) {
                        await sendFn(adminId, msg, { parse_mode: 'Markdown' });
                        console.log(`[MEMBERS] Telegram alert sent to admin ${adminId} for ${cleanEmail}`);
                    }
                } catch (tErr) {
                    console.error('[MEMBERS] Telegram alert error:', tErr.message);
                }
            }
        }

        const safeUser = { ...member };
        delete safeUser.password;
        delete safeUser.salt;
        const sessionToken = generateSecureToken({ id: member.id, email: member.email, role: 'member', plan: member.plan || 'trial' }, JWT_SECRET);

        res.json({ success: true, user: safeUser, member: safeUser, token: sessionToken, access_token: sessionToken });
    } catch (e) {
        console.error('[MEMBERS] Register error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// 3. Login member (Rate Limited, Backdoor-Free, Signed Token)
app.post('/api/members/login', authRateLimiter, (req, res) => {
    try {
        const { email, password } = req.body || {};
        const cleanEmail = (email || '').trim().toLowerCase();
        
        // Super Admin Authentication
        const adminPass = process.env.ADMIN_PASSWORD || 'Hamza2026!';
        const allowedAdmins = ['admin@livebetmentor.com', 'admin', 'karabulut.hamza@gmail.com'];
        if (allowedAdmins.includes(cleanEmail) && password === adminPass) {
            const adminToken = generateSecureToken({
                id: 'admin-super',
                email: 'admin@livebetmentor.com',
                role: 'admin',
                plan: 'admin'
            }, JWT_SECRET);
            return res.json({
                success: true,
                token: adminToken,
                access_token: adminToken,
                user: {
                    id: 'admin-super',
                    email: 'admin@livebetmentor.com',
                    plan: 'admin',
                    status: 'approved',
                    display_name: 'LiveBet Admin',
                    subscription_end: '2099-12-31T23:59:59.000Z'
                }
            });
        }

        const members = loadMembers();
        const member = members.find(m => m.email === cleanEmail);
        if (!member) {
            return res.status(401).json({ error: 'Kayıtlı üyelik bulunamadı. Lütfen önce kayıt olun.' });
        }

        let isPasswordValid = false;
        if (member.salt && member.password) {
            // Cryptographic PBKDF2 hash verification
            isPasswordValid = verifyPassword(password, member.password, member.salt);
        } else if (member.password && member.password === password) {
            // Safe upgrade: migrate legacy plain-text password to PBKDF2 on successful login
            isPasswordValid = true;
            const { hash, salt } = hashPassword(password);
            member.password = hash;
            member.salt = salt;
            saveMembers(members);
        } else if (!member.password && password) {
            // Set password for first time
            isPasswordValid = true;
            const { hash, salt } = hashPassword(password);
            member.password = hash;
            member.salt = salt;
            saveMembers(members);
        }

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Hatalı e-posta veya şifre girdiniz.' });
        }

        if (member.status === 'banned') {
            return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.' });
        }
        if (member.status === 'rejected') {
            return res.status(403).json({ error: 'Üyelik başvurunuz onaylanmadı.' });
        }

        const safeUser = { ...member };
        delete safeUser.password;
        delete safeUser.salt;

        const sessionToken = generateSecureToken({
            id: member.id,
            email: member.email,
            role: 'member',
            plan: member.plan || 'trial'
        }, JWT_SECRET);

        if (member.status === 'pending') {
            return res.json({ success: true, status: 'pending', user: safeUser, token: sessionToken, access_token: sessionToken });
        }

        // Approved - check expiration
        if (member.subscription_end) {
            const end = new Date(member.subscription_end);
            if (end < new Date()) {
                return res.json({ success: true, status: 'expired', user: safeUser, token: sessionToken, access_token: sessionToken });
            }
        }

        return res.json({ success: true, status: 'approved', user: safeUser, token: sessionToken, access_token: sessionToken });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3.1 Automated Payment Webhook (Shopier, CryptoBot, PayTR)
app.post('/api/payment/webhook', async (req, res) => {
    try {
        const payload = req.body || {};
        console.log('[PAYMENT_WEBHOOK] Received payment notification:', JSON.stringify(payload));

        const userEmail = (payload.user_email || payload.email || '').trim().toLowerCase();
        const chatId = payload.chat_id || payload.chatId || payload.telegram_id;
        const plan = (payload.plan || 'pro').toLowerCase();
        const days = parseInt(payload.days || 30, 10);
        const amount = payload.amount || payload.total || 'N/A';
        const provider = payload.payment_provider || payload.provider || 'Shopier/Crypto';

        let activated = false;
        let inviteLink = null;

        // 1. Activate Telegram VIP if chatId exists
        if (chatId) {
            try {
                const { vipManager } = await import('./vipManager.js');
                vipManager.addVip(chatId, days, payload.username || 'Subscriber', plan.toUpperCase());
                
                if (telegramBot && typeof telegramBot.createInviteLink === 'function') {
                    inviteLink = await telegramBot.createInviteLink(payload.username || 'VIP', days * 24);
                }

                if (telegramBot && inviteLink) {
                    const notifyUser = `🎉 *ÖDEMENİZ ONAYLANDI! VIP ERİŞİMİNİZ HAZIR!*\n━━━━━━━━━━━━━━━━━━\n` +
                        `Paket: *${plan.toUpperCase()} (${days} Gün)*\n` +
                        `Ödeme: *${amount}*\n\n` +
                        `💎 *Tek Kullanımlık VIP Grubuna Katılım Linkiniz:*\n👉 ${inviteLink}\n\n` +
                        `_Bol kazançlar dileriz!_`;
                    await telegramBot.sendMessage(chatId, notifyUser, { parse_mode: 'Markdown' });
                }
                activated = true;
            } catch (tgErr) {
                console.error('[PAYMENT_WEBHOOK] Telegram activation error:', tgErr.message);
            }
        }

        // 2. Activate Web Member if email exists
        if (userEmail) {
            try {
                const members = loadMembers();
                let member = members.find(m => m.email === userEmail);
                const now = new Date();
                const newEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

                if (member) {
                    member.status = 'approved';
                    member.plan = plan;
                    member.subscription_end = newEnd.toISOString();
                } else {
                    member = {
                        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        email: userEmail,
                        password: '',
                        full_name: payload.full_name || userEmail.split('@')[0],
                        status: 'approved',
                        plan: plan,
                        created_at: now.toISOString(),
                        subscription_start: now.toISOString(),
                        subscription_end: newEnd.toISOString()
                    };
                    members.unshift(member);
                }
                saveMembers(members);
                activated = true;
            } catch (mErr) {
                console.error('[PAYMENT_WEBHOOK] Web member activation error:', mErr.message);
            }
        }

        // 3. Notify Admin (Hamza) of New Revenue!
        if (telegramBot) {
            const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '8965087988').split(',').map(s => s.trim()).filter(Boolean);
            const alertMsg = `💰 *YENİ ÖDEME TAHSİL EDİLDİ!*\n━━━━━━━━━━━━━━━━━━\n` +
                `Sağlayıcı: *${provider}*\n` +
                `Tutar: *${amount}*\n` +
                `Paket: *${plan.toUpperCase()} (${days} Gün)*\n` +
                (userEmail ? `E-posta: \`${userEmail}\`\n` : '') +
                (chatId ? `Telegram ID: \`${chatId}\`\n` : '') +
                `Durum: *Otomatik VIP Tanımlandı ✅*`;

            for (const adminId of adminIds) {
                try {
                    await telegramBot.sendMessage(adminId, alertMsg, { parse_mode: 'Markdown' });
                } catch (e) {}
            }
        }

        return res.json({ success: true, activated, inviteLink });
    } catch (err) {
        console.error('[PAYMENT_WEBHOOK] Error handling payment:', err);
        return res.status(500).json({ error: err.message });
    }
});

// 4. Approve member
app.post('/api/members/approve', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler üye onaylayabilir.' });
        }
        const { id, email, days, plan } = req.body || {};
        const members = loadMembers();
        const member = members.find(m => (id && m.id === id) || (email && m.email === email.trim().toLowerCase()));
        if (!member) {
            return res.status(404).json({ error: 'Üye bulunamadı.' });
        }

        const subDays = Number(days) || 7;
        const now = new Date();
        const end = new Date(now.getTime() + subDays * 24 * 60 * 60 * 1000);

        member.status = 'approved';
        if (plan) member.plan = plan;
        member.subscription_start = now.toISOString();
        member.subscription_end = end.toISOString();
        member.approved_at = now.toISOString();

        saveMembers(members);
        res.json({ success: true, member: sanitizeMember(member), members: sanitizeMemberList(members) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Reject member
app.post('/api/members/reject', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler üye reddedebilir.' });
        }
        const { id, email } = req.body || {};
        const members = loadMembers();
        const member = members.find(m => (id && m.id === id) || (email && m.email === email.trim().toLowerCase()));
        if (!member) {
            return res.status(404).json({ error: 'Üye bulunamadı.' });
        }
        member.status = 'rejected';
        saveMembers(members);
        res.json({ success: true, members: sanitizeMemberList(members) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Extend member subscription
app.post('/api/members/extend', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler süre uzatabilir.' });
        }
        const { id, email, days } = req.body || {};
        const members = loadMembers();
        const member = members.find(m => (id && m.id === id) || (email && m.email === email.trim().toLowerCase()));
        if (!member) {
            return res.status(404).json({ error: 'Üye bulunamadı.' });
        }

        const addDays = Number(days) || 30;
        let baseDate = member.subscription_end ? new Date(member.subscription_end) : new Date();
        if (baseDate < new Date()) baseDate = new Date();
        const newEnd = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000);

        member.status = 'approved';
        member.subscription_end = newEnd.toISOString();
        saveMembers(members);
        res.json({ success: true, member: sanitizeMember(member), members: sanitizeMemberList(members) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. Delete member
app.post('/api/members/delete', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler üye silebilir.' });
        }
        const { id, email } = req.body || {};
        let members = loadMembers();
        members = members.filter(m => !((id && m.id === id) || (email && m.email === email.trim().toLowerCase())));
        saveMembers(members);
        res.json({ success: true, members: sanitizeMemberList(members) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. Create member (Admin manually adds, Salted PBKDF2 Password)
app.post('/api/members/create', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler üye oluşturabilir.' });
        }
        const { email, password, plan, days, fullName, phone } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'E-posta zorunludur.' });
        }
        const cleanEmail = email.trim().toLowerCase();
        let members = loadMembers();
        
        const subDays = Number(days) || 7;
        const now = new Date();
        const end = new Date(now.getTime() + subDays * 24 * 60 * 60 * 1000);

        const rawPassword = password || crypto.randomBytes(4).toString('hex');
        const { hash, salt } = hashPassword(rawPassword);

        const newMember = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            email: cleanEmail,
            password: hash,
            salt: salt,
            full_name: fullName || '',
            phone: phone || '',
            status: 'approved',
            plan: plan || 'trial',
            created_at: now.toISOString(),
            subscription_start: now.toISOString(),
            subscription_end: end.toISOString()
        };

        members = members.filter(m => m.email !== cleanEmail);
        members.unshift(newMember);
        saveMembers(members);

        res.json({ 
            success: true, 
            member: sanitizeMember(newMember), 
            members: sanitizeMemberList(members),
            tempPassword: password ? undefined : rawPassword
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 9. Member Upgrade Request (from Dashboard Modal)
app.post('/api/members/upgrade-request', async (req, res) => {
    try {
        const { userId, email, currentPlan, requestedPlan, fullName, phone } = req.body || {};
        if (!email && !userId) {
            return res.status(400).json({ error: 'E-posta veya kullanıcı ID zorunludur.' });
        }
        const cleanEmail = (email || '').trim().toLowerCase();
        const requests = loadUpgradeRequests();

        const newReq = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            user_id: userId || cleanEmail,
            email: cleanEmail,
            full_name: fullName || '',
            phone: phone || '',
            current_plan: currentPlan || 'trial',
            requested_plan: requestedPlan || 'pro',
            status: 'pending',
            created_at: new Date().toISOString()
        };

        // Keep only latest pending request per email
        const filtered = requests.filter(r => !(r.email === cleanEmail && r.status === 'pending'));
        filtered.unshift(newReq);
        saveUpgradeRequests(filtered);

        // Also update member profile in web_members.json if present
        try {
            const members = loadMembers();
            const member = members.find(m => m.email === cleanEmail || m.id === userId);
            if (member) {
                member.requested_plan = requestedPlan;
                saveMembers(members);
            }
        } catch (mErr) {
            console.warn('[UPGRADE] Could not update member requested_plan:', mErr);
        }

        // Instant Telegram alert to Admin (Hamza)
        const dateStr = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const planBadge = (requestedPlan || '').toUpperCase();
        const msg = `💎 *YENİ VIP ÜYELİK YÜKSELTME TALEBİ!*\n\n` +
                    `📧 *E-posta:* \`${cleanEmail}\`\n` +
                    (fullName ? `👤 *Kullanıcı:* ${fullName}\n` : '') +
                    (phone ? `📞 *Telefon:* ${phone}\n` : '') +
                    `⭐ *Mevcut Paket:* ${(currentPlan || 'trial').toUpperCase()}\n` +
                    `🚀 *İstenen Paket:* *${planBadge}*\n` +
                    `📅 *Tarih:* ${dateStr}\n\n` +
                    `👉 _LiveBet Mentor Admin Panelinden onaylayabilir veya kullanıcıyla Telegram üzerinden iletişime geçebilirsiniz._`;

        if (telegramBot && telegramBot.bot) {
            const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '8965087988').split(',').map(s => s.trim()).filter(Boolean);
            for (const adminId of adminIds) {
                try {
                    await telegramBot.bot.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
                } catch (err) {
                    console.error(`[PROXY] Failed to notify admin ${adminId}:`, err.message);
                }
            }
        }

        res.json({ success: true, request: newReq });
    } catch (e) {
        console.error('[UPGRADE] Error in upgrade-request:', e);
        res.status(500).json({ error: e.message });
    }
});

// 10. Get all upgrade requests (Admin gets all, regular members get only their own)
app.get('/api/members/upgrade-requests', (req, res) => {
    try {
        const requests = loadUpgradeRequests();
        if (isAdminRequest(req)) {
            return res.json({ success: true, requests });
        }
        // Non-admin users: restrict to own records only to prevent PII exposure
        const filterEmail = (req.query.email || '').trim().toLowerCase();
        const filterUserId = (req.query.userId || '').trim();
        if (!filterEmail && !filterUserId) {
            return res.status(403).json({ error: 'Unauthorized: E-posta veya yönetici yetkisi gereklidir.' });
        }
        const userRequests = requests.filter(r => 
            (filterEmail && r.email === filterEmail) || 
            (filterUserId && r.user_id === filterUserId)
        );
        res.json({ success: true, requests: userRequests });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 11. Approve or Reject Upgrade (Admin Panel)
app.post('/api/members/resolve-upgrade', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler onaylayabilir.' });
        }
        const { id, action } = req.body || {}; // action: 'approved' | 'rejected'
        const requests = loadUpgradeRequests();
        const reqItem = requests.find(r => r.id === id);
        if (!reqItem) {
            return res.status(404).json({ error: 'Talep bulunamadı.' });
        }
        reqItem.status = action === 'approved' ? 'approved' : 'rejected';
        reqItem.resolved_at = new Date().toISOString();
        saveUpgradeRequests(requests);

        // If approved, update member plan and grant 30 days
        if (action === 'approved') {
            const members = loadMembers();
            const mem = members.find(m => m.email === reqItem.email || m.id === reqItem.user_id);
            if (mem) {
                mem.plan = reqItem.requested_plan;
                mem.status = 'approved';
                const now = new Date();
                const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                mem.subscription_start = now.toISOString();
                mem.subscription_end = end.toISOString();
                delete mem.requested_plan;
                saveMembers(members);
            }
        }

        res.json({ success: true, request: reqItem });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Telegram bot status
app.get('/api/telegram/status', (req, res) => {
    res.json(telegramBot.getStatus());
});

// Update Telegram bot configuration (language, etc.)
app.post('/api/telegram/config', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler Telegram bot ayarlarını değiştirebilir.' });
        }
        const { lang, enabled, minLevel } = req.body;
        if (lang && (lang === 'tr' || lang === 'en')) {
            telegramBot.lang = lang;
            process.env.TELEGRAM_LANG = lang;
        }
        if (typeof enabled === 'boolean') {
            telegramBot.enabled = enabled;
        }
        if (minLevel) {
            telegramBot.minLevel = minLevel;
        }
        res.json({ success: true, status: telegramBot.getStatus() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- AI LEARNING ENGINE ENDPOINTS ---
app.get('/api/learning/weights', (req, res) => {
    res.json(learningEngine.getReportJSON());
});

app.get('/api/learning/report', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(learningEngine.generateReport());
});

app.post('/api/learning/recalibrate', (req, res) => {
    try {
        learningEngine.recalibrateWeights();
        res.json({ success: true, stats: learningEngine.weights.stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const QUEUE_COOLDOWN = {}; // Memory-based cooldown

function queueRequest(id) {
    if (!id) return;
    const now = Date.now();
    if (QUEUE_COOLDOWN[id] && (now - QUEUE_COOLDOWN[id]) < 20000) {
        return; // Skip if requested in the last 20 seconds
    }
    QUEUE_COOLDOWN[id] = now;
    pendingRenderRequests.add(String(id));

    let queue = { ids: [] };
    if (fs.existsSync(REQUEST_QUEUE)) {
        try {
            queue = JSON.parse(fs.readFileSync(REQUEST_QUEUE, 'utf8'));
        } catch (e) { }
    }
    const strId = String(id);
    if (!queue.ids.includes(strId) && !queue.ids.includes(Number(id))) {
        queue.ids.push(strId);
        fs.writeFileSync(REQUEST_QUEUE, JSON.stringify(queue));
    }
}

// ==================== IN-HOUSE 1ST-PARTY WEB & PRODUCT ANALYTICS ENGINE ====================
// Privacy-first, cookieless, high-speed telemetry engine (100% Google Analytics alternative)

const MAX_ANALYTICS_EVENTS = 30000;
const DAILY_SALTS = new Map();

function getDailySalt() {
    const today = new Date().toISOString().slice(0, 10);
    if (!DAILY_SALTS.has(today)) {
        DAILY_SALTS.set(today, crypto.randomBytes(16).toString('hex'));
        if (DAILY_SALTS.size > 5) {
            const keys = Array.from(DAILY_SALTS.keys());
            for (let i = 0; i < keys.length - 3; i++) {
                DAILY_SALTS.delete(keys[i]);
            }
        }
    }
    return DAILY_SALTS.get(today);
}

function generateVisitorId(ip, userAgent) {
    const cleanIp = (ip || '127.0.0.1').split(',')[0].trim();
    const cleanUa = (userAgent || 'unknown').slice(0, 100);
    const salt = getDailySalt();
    return crypto.createHash('sha256').update(`${cleanIp}_${cleanUa}_${salt}`).digest('hex').slice(0, 16);
}

let analyticsEvents = [];
let analyticsSaveTimeout = null;

function loadAnalyticsEvents() {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            const raw = fs.readFileSync(ANALYTICS_FILE, 'utf8');
            analyticsEvents = JSON.parse(raw);
            if (!Array.isArray(analyticsEvents)) analyticsEvents = [];
            console.log(`[ANALYTICS] Loaded ${analyticsEvents.length} analytics events from storage.`);
        }
    } catch (e) {
        console.error('[ANALYTICS] Error loading analytics_events.json:', e.message);
        analyticsEvents = [];
    }
}
loadAnalyticsEvents();

function scheduleSaveAnalyticsEvents() {
    if (analyticsSaveTimeout) return;
    analyticsSaveTimeout = setTimeout(() => {
        analyticsSaveTimeout = null;
        try {
            const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
            if (analyticsEvents.length > MAX_ANALYTICS_EVENTS) {
                analyticsEvents = analyticsEvents.slice(-MAX_ANALYTICS_EVENTS);
            }
            analyticsEvents = analyticsEvents.filter(ev => {
                const evTime = ev.time || new Date(ev.timestamp || 0).getTime();
                return evTime > ninetyDaysAgo;
            });
            fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsEvents), 'utf8');
        } catch (e) {
            console.error('[ANALYTICS] Error writing analytics_events.json:', e.message);
        }
    }, 2500);
}

function extractCountry(req, lang) {
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && cfCountry.length === 2) return cfCountry.toUpperCase();
    const proxyCountry = req.headers['x-country-code'] || req.headers['geoip-country-code'];
    if (proxyCountry && proxyCountry.length === 2) return proxyCountry.toUpperCase();

    if (lang) {
        const l = lang.toLowerCase();
        if (l.startsWith('tr')) return 'TR';
        if (l.startsWith('de')) return 'DE';
        if (l.startsWith('en')) return 'GB';
        if (l.startsWith('fr')) return 'FR';
        if (l.startsWith('es')) return 'ES';
        if (l.startsWith('it')) return 'IT';
        if (l.startsWith('ru')) return 'RU';
        if (l.startsWith('nl')) return 'NL';
        if (l.startsWith('az')) return 'AZ';
    }
    return 'TR';
}

const COUNTRY_NAMES = {
    'TR': { name: 'Türkiye', flag: '🇹🇷' },
    'DE': { name: 'Almanya', flag: '🇩🇪' },
    'GB': { name: 'Birleşik Krallık', flag: '🇬🇧' },
    'US': { name: 'Amerika Birleşik Devletleri', flag: '🇺🇸' },
    'FR': { name: 'Fransa', flag: '🇫🇷' },
    'NL': { name: 'Hollanda', flag: '🇳🇱' },
    'AZ': { name: 'Azerbaycan', flag: '🇦🇿' },
    'AT': { name: 'Avusturya', flag: '🇦🇹' },
    'CH': { name: 'İsviçre', flag: '🇨🇭' },
    'CY': { name: 'Kıbrıs', flag: '🇨🇾' },
    'IT': { name: 'İtalya', flag: '🇮🇹' },
    'ES': { name: 'İspanya', flag: '🇪🇸' },
    'RU': { name: 'Rusya', flag: '🇷🇺' },
    'BE': { name: 'Belçika', flag: '🇧🇪' },
    'SE': { name: 'İsveç', flag: '🇸🇪' },
    'NO': { name: 'Norveç', flag: '🇳🇴' }
};

// 1. Ingestion Endpoint (Fast, cookieless, non-blocking)
app.post('/api/analytics/track', (req, res) => {
    try {
        const body = req.body || {};
        const clientIp = req.headers['cf-connecting-ip'] || 
                         (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                         req.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || '';
        const visitorId = generateVisitorId(clientIp, userAgent);
        const country = extractCountry(req, body.language);

        let sanitizedPath = (body.path || '/').replace(/[?&](token|access_token|password|secret|key)=[^&]*/gi, '');
        if (sanitizedPath.length > 255) sanitizedPath = sanitizedPath.substring(0, 255);

        const now = Date.now();
        const eventRecord = {
            id: 'ev_' + now.toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            type: body.type || 'pageview', // 'pageview', 'heartbeat', 'event'
            name: body.name || undefined,
            visitorId,
            sessionId: body.sessionId || ('ses_' + visitorId.slice(0, 8)),
            path: sanitizedPath,
            title: (body.title || 'LiveBet Mentor').slice(0, 100),
            timestamp: body.timestamp || new Date().toISOString(),
            time: now,
            deviceType: body.deviceType || 'desktop',
            browser: body.browser || 'Other',
            os: body.os || 'Other',
            country,
            language: (body.language || 'tr').slice(0, 5),
            referrer: body.referrer ? body.referrer.slice(0, 200) : undefined,
            referrerChannel: body.referrerChannel || 'direct',
            utmSource: body.utmSource ? body.utmSource.slice(0, 50) : undefined,
            utmMedium: body.utmMedium ? body.utmMedium.slice(0, 50) : undefined,
            utmCampaign: body.utmCampaign ? body.utmCampaign.slice(0, 50) : undefined,
            userPlan: body.userPlan || 'guest',
            userStatus: body.userStatus || 'anonymous',
            durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : 0,
            data: body.data && typeof body.data === 'object' ? body.data : undefined
        };

        analyticsEvents.push(eventRecord);
        scheduleSaveAnalyticsEvents();

        res.status(200).json({ success: true });
    } catch (e) {
        res.status(200).json({ success: false });
    }
});

// 2. Real-time Live Users Endpoint (Active in last 5 minutes)
app.get('/api/analytics/live', (req, res) => {
    try {
        const fiveMinAgo = Date.now() - (5 * 60 * 1000);
        const recent = analyticsEvents.filter(ev => (ev.time || new Date(ev.timestamp).getTime()) >= fiveMinAgo);

        const activeVisitorsMap = new Map();
        for (const ev of recent) {
            const vId = ev.visitorId;
            const prev = activeVisitorsMap.get(vId);
            const evTime = ev.time || new Date(ev.timestamp).getTime();
            if (!prev || evTime > prev.lastSeen) {
                activeVisitorsMap.set(vId, {
                    visitorId: vId,
                    lastSeen: evTime,
                    currentPath: ev.path,
                    currentTitle: ev.title,
                    deviceType: ev.deviceType,
                    country: ev.country,
                    userPlan: ev.userPlan,
                    browser: ev.browser,
                    os: ev.os
                });
            }
        }

        const activeUsers = Array.from(activeVisitorsMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
        
        const pageCounts = {};
        for (const u of activeUsers) {
            pageCounts[u.currentPath] = (pageCounts[u.currentPath] || 0) + 1;
        }
        const activePages = Object.entries(pageCounts)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count);

        res.json({
            success: true,
            activeCount: activeUsers.length,
            activeUsers: activeUsers.slice(0, 50),
            activePages
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Analytics Dashboard Summary Endpoint
app.get('/api/analytics/summary', (req, res) => {
    try {
        const period = (req.query.period || '24h').toLowerCase();
        const now = Date.now();
        let cutoff = 0;

        if (period === '24h') cutoff = now - (24 * 60 * 60 * 1000);
        else if (period === '7d') cutoff = now - (7 * 24 * 60 * 60 * 1000);
        else if (period === '30d') cutoff = now - (30 * 24 * 60 * 60 * 1000);
        else cutoff = 0; // 'all'

        const filtered = analyticsEvents.filter(ev => {
            const t = ev.time || new Date(ev.timestamp).getTime();
            return t >= cutoff;
        });

        // 1. Overall KPIs
        const uniqueVisitorsSet = new Set();
        const sessionsMap = new Map(); // sessionId -> { pageviews, minTime, maxTime, duration }
        let totalPageviews = 0;
        let totalEvents = 0;

        for (const ev of filtered) {
            const evTime = ev.time || new Date(ev.timestamp).getTime();
            uniqueVisitorsSet.add(ev.visitorId);

            if (!sessionsMap.has(ev.sessionId)) {
                sessionsMap.set(ev.sessionId, {
                    pageviews: 0,
                    minTime: evTime,
                    maxTime: evTime,
                    duration: ev.durationSeconds || 0,
                    visitorId: ev.visitorId,
                    plan: ev.userPlan
                });
            }
            const s = sessionsMap.get(ev.sessionId);
            s.minTime = Math.min(s.minTime, evTime);
            s.maxTime = Math.max(s.maxTime, evTime);
            s.duration = Math.max(s.duration, ev.durationSeconds || 0, Math.round((s.maxTime - s.minTime) / 1000));

            if (ev.type === 'pageview') {
                totalPageviews++;
                s.pageviews++;
            } else if (ev.type === 'event') {
                totalEvents++;
            }
        }

        const totalSessions = sessionsMap.size;
        let bounceSessions = 0;
        let totalSessionDuration = 0;

        for (const s of sessionsMap.values()) {
            totalSessionDuration += s.duration;
            if (s.pageviews <= 1 && s.duration <= 12) {
                bounceSessions++;
            }
        }

        const bounceRate = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 100) : 0;
        const avgDuration = totalSessions > 0 ? Math.round(totalSessionDuration / totalSessions) : 0;

        // Active Online Now (last 5 min)
        const fiveMinAgo = now - (5 * 60 * 1000);
        const liveSet = new Set(
            analyticsEvents
                .filter(ev => (ev.time || new Date(ev.timestamp).getTime()) >= fiveMinAgo)
                .map(ev => ev.visitorId)
        );
        const liveNow = liveSet.size;

        // 2. Timeline series for interactive chart
        let timeline = [];
        if (period === '24h') {
            // 24 hourly buckets
            for (let i = 23; i >= 0; i--) {
                const bucketStart = now - (i * 60 * 60 * 1000);
                const d = new Date(bucketStart);
                const hourStr = d.getHours().toString().padStart(2, '0') + ':00';
                timeline.push({
                    key: hourStr,
                    label: hourStr,
                    timestamp: bucketStart,
                    pageviews: 0,
                    _visitors: new Set()
                });
            }
            for (const ev of filtered) {
                const evTime = ev.time || new Date(ev.timestamp).getTime();
                const hoursAgo = Math.floor((now - evTime) / (60 * 60 * 1000));
                if (hoursAgo >= 0 && hoursAgo < 24) {
                    const idx = 23 - hoursAgo;
                    if (timeline[idx]) {
                        if (ev.type === 'pageview') timeline[idx].pageviews++;
                        timeline[idx]._visitors.add(ev.visitorId);
                    }
                }
            }
        } else {
            // Daily buckets (7d, 30d, all)
            const daysCount = period === '7d' ? 7 : (period === '30d' ? 30 : 30);
            for (let i = daysCount - 1; i >= 0; i--) {
                const bucketStart = now - (i * 24 * 60 * 60 * 1000);
                const d = new Date(bucketStart);
                const dayLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                timeline.push({
                    key: dayLabel,
                    label: dayLabel,
                    timestamp: bucketStart,
                    pageviews: 0,
                    _visitors: new Set()
                });
            }
            for (const ev of filtered) {
                const evTime = ev.time || new Date(ev.timestamp).getTime();
                const daysAgo = Math.floor((now - evTime) / (24 * 60 * 60 * 1000));
                if (daysAgo >= 0 && daysAgo < daysCount) {
                    const idx = (daysCount - 1) - daysAgo;
                    if (timeline[idx]) {
                        if (ev.type === 'pageview') timeline[idx].pageviews++;
                        timeline[idx]._visitors.add(ev.visitorId);
                    }
                }
            }
        }

        timeline = timeline.map(item => ({
            key: item.key,
            label: item.label,
            timestamp: item.timestamp,
            pageviews: item.pageviews,
            visitors: item._visitors.size
        }));

        // 3. Top Pages
        const pagesMap = {};
        for (const ev of filtered) {
            if (ev.type === 'pageview') {
                const p = ev.path || '/';
                if (!pagesMap[p]) pagesMap[p] = { path: p, title: ev.title || p, views: 0, visitors: new Set() };
                pagesMap[p].views++;
                pagesMap[p].visitors.add(ev.visitorId);
            }
        }
        const topPages = Object.values(pagesMap)
            .map(p => ({
                path: p.path,
                title: p.title,
                views: p.views,
                visitors: p.visitors.size,
                pct: totalPageviews > 0 ? Math.round((p.views / totalPageviews) * 100) : 0
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

        // 4. Referrers & Channels
        const channelsMap = { direct: 0, telegram: 0, google: 0, social: 0, external: 0, internal: 0 };
        const referrersMap = {};

        for (const ev of filtered) {
            if (ev.type === 'pageview') {
                const ch = ev.referrerChannel || 'direct';
                channelsMap[ch] = (channelsMap[ch] || 0) + 1;

                if (ev.referrer) {
                    try {
                        const host = new URL(ev.referrer).hostname.replace(/^www\./, '');
                        referrersMap[host] = (referrersMap[host] || 0) + 1;
                    } catch {}
                }
            }
        }

        const topChannels = Object.entries(channelsMap)
            .map(([channel, count]) => ({
                channel,
                count,
                pct: totalPageviews > 0 ? Math.round((count / totalPageviews) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);

        const topReferrers = Object.entries(referrersMap)
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        // 5. Hardware / Device Breakdown
        const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
        const browserCounts = {};
        const osCounts = {};
        const countryCounts = {};
        const planCounts = { guest: 0, trial: 0, pro: 0, premium: 0, admin: 0 };

        for (const ev of filtered) {
            if (ev.type === 'pageview') {
                const dev = ev.deviceType || 'desktop';
                deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;

                const br = ev.browser || 'Other';
                browserCounts[br] = (browserCounts[br] || 0) + 1;

                const o = ev.os || 'Other';
                osCounts[o] = (osCounts[o] || 0) + 1;

                const c = ev.country || 'TR';
                countryCounts[c] = (countryCounts[c] || 0) + 1;

                const pl = ev.userPlan || 'guest';
                planCounts[pl] = (planCounts[pl] || 0) + 1;
            }
        }

        const topCountries = Object.entries(countryCounts)
            .map(([code, count]) => {
                const meta = COUNTRY_NAMES[code] || { name: code, flag: '🌐' };
                return {
                    code,
                    name: meta.name,
                    flag: meta.flag,
                    count,
                    pct: totalPageviews > 0 ? Math.round((count / totalPageviews) * 100) : 0
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // 6. Conversion Funnel
        const funnelVisitors = uniqueVisitorsSet.size;
        const funnelRegisters = new Set(
            filtered
                .filter(ev => ev.name === 'register_success' || ev.name === 'trial_registered' || ev.userPlan !== 'guest')
                .map(ev => ev.visitorId)
        ).size;
        const funnelEngaged = new Set(
            filtered
                .filter(ev => ev.path?.includes('dashboard') || ev.path?.includes('terminal') || ev.name?.includes('click'))
                .map(ev => ev.visitorId)
        ).size;
        const funnelUpgrades = new Set(
            filtered
                .filter(ev => ev.name === 'upgrade_request_submitted' || ev.name === 'upgrade_click')
                .map(ev => ev.visitorId)
        ).size;
        const funnelPaid = new Set(
            filtered
                .filter(ev => ev.userPlan === 'pro' || ev.userPlan === 'premium' || ev.userPlan === 'admin')
                .map(ev => ev.visitorId)
        ).size;

        // 7. Recent Activity Stream (last 25 events, sanitized)
        const recentActivity = filtered
            .slice(-30)
            .reverse()
            .map(ev => ({
                id: ev.id,
                type: ev.type,
                name: ev.name,
                path: ev.path,
                title: ev.title,
                time: ev.time || new Date(ev.timestamp).getTime(),
                deviceType: ev.deviceType,
                browser: ev.browser,
                country: ev.country,
                userPlan: ev.userPlan
            }));

        res.json({
            success: true,
            period,
            summary: {
                uniqueVisitors: uniqueVisitorsSet.size,
                totalPageviews,
                totalSessions,
                bounceRate,
                avgDuration,
                liveNow
            },
            timeline,
            topPages,
            topChannels,
            topReferrers,
            devices: deviceCounts,
            browsers: browserCounts,
            operatingSystems: osCounts,
            countries: topCountries,
            userPlans: planCounts,
            funnel: {
                visitors: funnelVisitors,
                registered: funnelRegisters,
                engaged: funnelEngaged,
                upgradeRequests: funnelUpgrades,
                paidUsers: funnelPaid
            },
            recentActivity
        });
    } catch (e) {
        console.error('[ANALYTICS] Summary error:', e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Reset Analytics Data Endpoint (Protected: Admin Only)
app.post('/api/analytics/reset', (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Unauthorized: Sadece yöneticiler analitik verilerini sıfırlayabilir.' });
        }
        analyticsEvents = [];
        try {
            fs.writeFileSync(ANALYTICS_FILE, JSON.stringify([]), 'utf8');
        } catch (e) {}
        console.log('[ANALYTICS] 🗑️ Analytics database wiped clean by admin.');
        res.json({ success: true, message: 'Analitik verileri başarıyla sıfırlandı.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- BUILT-IN NODE.JS DATA FETCHER (No Python/Chrome needed) ---
// Used on cloud (Render, etc.) where Python scrapers are not available.

let cachedLiveData = null;
let cachedStatsData = {};

async function fetchSofaScoreLiveNode() {
    try {
        const url = `https://api.sofascore.com/api/v1/sport/football/events/live?_=${Date.now()}`;
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
            fetch(`https://api.sofascore.com/api/v1/event/${eventId}`, { headers: SOFASCORE_HEADERS, signal: AbortSignal.timeout(10000) }).catch(() => null),
            fetch(`https://api.sofascore.com/api/v1/event/${eventId}/statistics`, { headers: SOFASCORE_HEADERS, signal: AbortSignal.timeout(10000) }).catch(() => null)
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
        console.log('[PROXY] Cloud environment detected. Checking Python dependencies...');
        try {
            spawnSync('node', [path.join(__dirname, 'ensure_python_deps.js')], { stdio: 'inherit', timeout: 90000 });
        } catch (e) {
            console.warn('[PROXY] Warning during ensure_python_deps:', e.message);
        }

        console.log('[PROXY] Starting lightweight Python cloud_fetcher (curl_cffi)...');
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
        telegramBot.scheduleDailyConsensusBroadcast(12, 0);
        console.log('[PROXY] 🤖 Telegram Bot initialized successfully');
    } else {
        console.warn('[PROXY] ⚠️ Telegram Bot not available:', botStatus.error);
    }

    // 24/7 Autonomous In-Play Quant Signal Engine
    autonomousSignalEngine.start(25);

    startScraper();
    setTimeout(() => {
        startConsensusScraper();
    }, 10000);

    // 24/7 CLOUD MODE: Keep-alive self-ping to prevent Render free-tier spin-down
    if (IS_CLOUD) {
        const pingUrl = process.env.RENDER_EXTERNAL_URL || 'https://live-bet-mentor.onrender.com';
        console.log(`[KEEP-ALIVE] Initiating 24/7 self-ping loop for: ${pingUrl}`);
        setInterval(async () => {
            try {
                const res = await fetch(`${pingUrl}/api/debug`, { signal: AbortSignal.timeout(12000) });
                console.log(`[KEEP-ALIVE] Heartbeat ping success: HTTP ${res.status}`);
            } catch (err) {
                console.warn(`[KEEP-ALIVE] Heartbeat ping notice: ${err.message}`);
            }
        }, 8 * 60 * 1000); // Ping every 8 minutes (Render sleeps after 15 min)
    }

    // LOCAL MODE: Sync data to Render cloud every 15 seconds
    if (!IS_CLOUD) {
        const RENDER_URL = process.env.RENDER_SYNC_URL || 'https://live-bet-mentor.onrender.com';
        const SYNC_SECRET = process.env.UPLOAD_SECRET || 'lbm-sync-2026';

        async function syncToCloud() {
            try {
                let liveData = null;
                let consensusData = null;
                const statsBundle = {};

                // 1. Read live events
                if (fs.existsSync(SOFASCORE_FILE)) {
                    try {
                        const raw = fs.readFileSync(SOFASCORE_FILE, 'utf8');
                        liveData = JSON.parse(raw);
                    } catch (e) {
                        console.warn('[CLOUD_SYNC] Error reading sofascore_live.json:', e.message);
                    }
                }

                // 2. Read consensus data if present
                if (fs.existsSync(CONSENSUS_FILE)) {
                    try {
                        const raw = fs.readFileSync(CONSENSUS_FILE, 'utf8');
                        consensusData = JSON.parse(raw);
                    } catch (e) {}
                }

                // 3. Gather stats for active in-progress football matches & auto-resolve Telegram signals
                if (liveData && Array.isArray(liveData.events)) {
                    telegramBot.autoResolveSignals(liveData.events).catch(err => console.warn('[TELEGRAM] Auto-resolve error:', err.message));

                    const activeEvents = liveData.events.filter(e => 
                        e.status?.type === 'inprogress' &&
                        (e.tournament?.category?.sport?.id === 1 || !e.tournament?.category?.sport?.id)
                    );

                    for (const ev of activeEvents) {
                        const id = ev.id;
                        const detailFile = path.join(STATS_DIR, `${id}_detail.json`);
                        const statsFile = path.join(STATS_DIR, `${id}_stats.json`);
                        const oddsFile = path.join(STATS_DIR, `${id}_odds.json`);

                        const hasDetail = fs.existsSync(detailFile);
                        const hasStats = fs.existsSync(statsFile);
                        const hasOdds = fs.existsSync(oddsFile);

                        if (hasDetail || hasStats || hasOdds) {
                            statsBundle[id] = {};
                            try {
                                if (hasDetail) {
                                    const d = JSON.parse(fs.readFileSync(detailFile, 'utf8'));
                                    if (d && d.event) {
                                        if (ev.homeScore) d.event.homeScore = ev.homeScore;
                                        if (ev.awayScore) d.event.awayScore = ev.awayScore;
                                        if (ev.status) d.event.status = ev.status;
                                    }
                                    statsBundle[id].detail = d;
                                }
                            } catch(e) {}
                            try { if (hasStats) statsBundle[id].stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch(e) {}
                            try { if (hasOdds) statsBundle[id].odds = JSON.parse(fs.readFileSync(oddsFile, 'utf8')); } catch(e) {}
                        }
                    }
                }

                // 4. Send Bundle to Render
                if (liveData || Object.keys(statsBundle).length > 0) {
                    const payload = {
                        live: liveData,
                        consensus: consensusData,
                        stats: statsBundle
                    };

                    const res = await fetch(`${RENDER_URL}/api/sync/bundle`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-sync-secret': SYNC_SECRET
                        },
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(25000)
                    });

                    if (res.ok) {
                        const result = await res.json();
                        console.log(`[CLOUD_SYNC] 🚀 Bundle pushed: ${result.liveEvents} events, ${result.statsSaved} stats saved on Render`);
                        if (result.pendingRequests && result.pendingRequests.length > 0) {
                            for (const qid of result.pendingRequests) {
                                queueRequest(qid);
                            }
                        }
                    } else if (res.status === 404) {
                        // Older Render version fallback: send live separately
                        console.warn('[CLOUD_SYNC] /api/sync/bundle returned 404. Falling back to /api/sync/live...');
                        if (liveData) {
                            await fetch(`${RENDER_URL}/api/sync/live`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
                                body: JSON.stringify(liveData),
                                signal: AbortSignal.timeout(10000)
                            });
                        }
                    } else {
                        console.warn(`[CLOUD_SYNC] Bundle sync returned HTTP ${res.status}`);
                    }
                }

                // 5. Fetch queued match requests from Render so local scraper prioritizes them
                try {
                    const qRes = await fetch(`${RENDER_URL}/api/sync/queue`, { signal: AbortSignal.timeout(5000) });
                    if (qRes.ok) {
                        const qData = await qRes.json();
                        if (qData.ids && qData.ids.length > 0) {
                            for (const qid of qData.ids) {
                                queueRequest(qid);
                            }
                        }
                    }
                } catch(e) {}

            } catch (e) {
                console.warn(`[CLOUD_SYNC] Sync failed: ${e.message}`);
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
