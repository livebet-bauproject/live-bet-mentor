import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_FILE = path.join(__dirname, 'sharp_picks_vault.json');

const SOURCE_CONFIG = {
    top_today: 'https://superbetpredictions.com/top',
    all_today: 'https://superbetpredictions.com/',
    top_yesterday: 'https://superbetpredictions.com/yesterdaytoptips',
    all_yesterday: 'https://superbetpredictions.com/yesterday'
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr,en-US;q=0.9,en;q=0.8'
};

function calculateConfidence(oddsVal, tip) {
    const odd = parseFloat(oddsVal) || 1.30;
    let base = 80;
    if (odd <= 1.20) base = 92;
    else if (odd <= 1.30) base = 86;
    else if (odd <= 1.40) base = 80;
    else if (odd <= 1.55) base = 74;
    else base = 68;

    const tipUpper = (tip || '').toUpperCase();
    if (tipUpper.includes('X') && tipUpper !== 'X') {
        base = Math.min(96, base + 4);
    }
    return base;
}

function fetchUrl(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: HEADERS }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                return fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Timeout fetching ${url}`));
        });
    });
}

function parseMatches(html, isTop = false) {
    const results = [];
    if (!html) return results;

    const blocks = html.split(/<td[^>]*class=["']league["'][^>]*>/i).slice(1);

    for (const block of blocks) {
        try {
            const leagueEnd = block.indexOf('</td>');
            if (leagueEnd === -1) continue;
            const league = block.substring(0, leagueEnd).replace(/<[^>]+>/g, '').trim();

            const codeMatches = [...block.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/gi)];
            if (codeMatches.length < 3) continue;

            const home = codeMatches[0][1].replace(/<[^>]+>/g, '').trim();
            const rawScore = codeMatches[1][1].replace(/<[^>]+>/g, '').replace(/_-_/g, '-').trim();
            const score = (rawScore === '-' || !rawScore) ? '-' : rawScore;
            const away = codeMatches[2][1].replace(/<[^>]+>/g, '').trim();

            let time = '';
            let tip = '';
            let odds = 1.30;
            let status = 'PENDING';

            const timeMatch = block.match(/Time:\s*([0-9]{1,2}:[0-9]{2})/i);
            if (timeMatch) time = timeMatch[1].trim();

            const tipMatch = block.match(/Tip:\s*([^<\r\n]+)/i);
            if (tipMatch) tip = tipMatch[1].replace(/<[^>]+>/g, '').trim().toUpperCase();

            const oddsMatch = block.match(/Odds:\s*([0-9.]+)/i);
            if (oddsMatch) odds = parseFloat(oddsMatch[1]) || 1.30;

            if (block.includes('greendot')) {
                status = 'WON';
            } else if (block.includes('reddot')) {
                status = 'LOST';
            }

            const conf = calculateConfidence(odds, tip);
            const id = `${home}_${away}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            results.push({
                id,
                league,
                time,
                home,
                away,
                tip,
                odds,
                score,
                status,
                confidence: conf,
                is_top: isTop,
                tier: conf >= 85 ? 'Ultra-Safe' : 'Value-Safe'
            });
        } catch (e) {
            continue;
        }
    }
    return results;
}

function getTimeMinutes(m) {
    const tStr = String(m?.time || '').trim();
    if (!tStr) return 9999;
    const parts = tStr.split(':');
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 9999;
}

class SharpPicksEngine {
    constructor() {
        this.vault = {
            model: "Mentor Alpha-10 Quant",
            last_updated: null,
            today_picks: [],
            yesterday_summary: {
                total: 0,
                won: 0,
                lost: 0,
                pending: 0,
                win_rate: 0.0,
                avg_odds: 0.0,
                picks: []
            }
        };
        this.loadVault();
    }

    loadVault() {
        if (fs.existsSync(VAULT_FILE)) {
            try {
                const raw = fs.readFileSync(VAULT_FILE, 'utf8');
                this.vault = JSON.parse(raw);
                console.log(`[SHARP_ENGINE] Loaded existing vault (${(this.vault.today_picks || []).length} today picks, last updated: ${this.vault.last_updated})`);
            } catch (e) {
                console.error('[SHARP_ENGINE] Error loading vault file:', e.message);
            }
        }
    }

    async saveVault() {
        try {
            this.vault.last_updated = new Date().toISOString();
            fs.writeFileSync(VAULT_FILE, JSON.stringify(this.vault, null, 2), 'utf8');
            console.log(`[SHARP_ENGINE] Saved vault to ${VAULT_FILE}`);
        } catch (e) {
            console.error('[SHARP_ENGINE] Error saving vault file:', e.message);
        }

        // Push to Render cloud if remote
        await this.syncToCloud();
    }

    syncToCloud() {
        return new Promise((resolve) => {
            try {
                const isCloud = !!process.env.RENDER || !!process.env.IS_RENDER;
                if (isCloud) return resolve(); // Already on Render

                const renderUrl = process.env.RENDER_SYNC_URL || 'https://live-bet-mentor.onrender.com';
                const syncUrl = `${renderUrl}/api/sync/sharp-picks`;
                const payload = JSON.stringify(this.vault);

                const urlObj = new URL(syncUrl);
                const req = https.request({
                    hostname: urlObj.hostname,
                    port: 443,
                    path: urlObj.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                        'x-sync-secret': 'lbm-sync-2026'
                    }
                }, (res) => {
                    let respBody = '';
                    res.on('data', chunk => respBody += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            console.log('[SHARP_ENGINE] 🚀 Successfully pushed sharp picks to Render cloud!');
                        } else {
                            console.log(`[SHARP_ENGINE] Render cloud sync status: ${res.statusCode} (${respBody})`);
                        }
                        resolve();
                    });
                });

                req.on('error', (err) => {
                    console.warn('[SHARP_ENGINE] Cloud sync notice:', err.message);
                    resolve();
                });
                req.setTimeout(15000, () => {
                    req.destroy();
                    resolve();
                });
                req.write(payload);
                req.end();
            } catch (e) {
                console.warn('[SHARP_ENGINE] Cloud sync exception:', e.message);
                resolve();
            }
        });
    }

    async fetchTodayPicks() {
        console.log("[SHARP_ENGINE] Fetching today's selections from source...");
        const picks = [];

        // 1. Fetch Top Picks first
        try {
            const resTop = await fetchUrl(SOURCE_CONFIG.top_today);
            if (resTop.status === 200) {
                const topMatches = parseMatches(resTop.body, true);
                picks.push(...topMatches);
                console.log(`[SHARP_ENGINE] Found ${topMatches.length} Top Tier picks`);
            }
        } catch (err) {
            console.error('[SHARP_ENGINE] Error fetching top picks:', err.message);
        }

        // 2. Fetch General Today's Picks to supplement
        try {
            const resAll = await fetchUrl(SOURCE_CONFIG.all_today);
            if (resAll.status === 200) {
                const allMatches = parseMatches(resAll.body, false);
                const existingIds = new Set(picks.map(m => m.id));
                let added = 0;
                for (const m of allMatches) {
                    if (!existingIds.has(m.id)) {
                        picks.push(m);
                        existingIds.add(m.id);
                        added++;
                    }
                }
                console.log(`[SHARP_ENGINE] Supplemented with ${added} additional today picks`);
            }
        } catch (err) {
            console.error('[SHARP_ENGINE] Error fetching general today picks:', err.message);
        }

        if (picks.length > 0) {
            // Sort chronologically by kick-off time
            picks.sort((a, b) => getTimeMinutes(a) - getTimeMinutes(b));
            this.vault.today_picks = picks;
        }
    }

    async fetchYesterdayRecord() {
        console.log("[SHARP_ENGINE] Fetching yesterday's verification record...");
        try {
            let res = await fetchUrl(SOURCE_CONFIG.top_yesterday);
            let yMatches = [];
            if (res.status === 200) {
                yMatches = parseMatches(res.body, true);
            }

            if (yMatches.length < 5) {
                const resAll = await fetchUrl(SOURCE_CONFIG.all_yesterday);
                if (resAll.status === 200) {
                    const allY = parseMatches(resAll.body, false);
                    const existingIds = new Set(yMatches.map(m => m.id));
                    for (const m of allY) {
                        if (!existingIds.has(m.id)) {
                            yMatches.push(m);
                            existingIds.add(m.id);
                        }
                    }
                }
            }

            if (yMatches.length > 0) {
                yMatches.sort((a, b) => getTimeMinutes(a) - getTimeMinutes(b));
                const won = yMatches.filter(m => m.status === 'WON').length;
                const lost = yMatches.filter(m => m.status === 'LOST').length;
                const pending = yMatches.filter(m => m.status === 'PENDING').length;
                const decided = won + lost;
                const winRate = decided > 0 ? parseFloat(((won / decided) * 100).toFixed(1)) : 0.0;
                const oddsVals = yMatches.map(m => m.odds).filter(o => o > 0);
                const avgOdds = oddsVals.length > 0 ? parseFloat((oddsVals.reduce((a, b) => a + b, 0) / oddsVals.length).toFixed(2)) : 0.0;

                this.vault.yesterday_summary = {
                    total: yMatches.length,
                    won,
                    lost,
                    pending,
                    win_rate: winRate,
                    avg_odds: avgOdds,
                    picks: yMatches
                };
                console.log(`[SHARP_ENGINE] Yesterday record: ${won} Won / ${lost} Lost (${winRate}% Win Rate)`);
            }
        } catch (err) {
            console.error('[SHARP_ENGINE] Error fetching yesterday record:', err.message);
        }
    }

    async updateCycle() {
        console.log(`\n[SHARP_ENGINE] === Starting update cycle at ${new Date().toLocaleString()} ===`);
        await this.fetchTodayPicks();
        await this.fetchYesterdayRecord();
        await this.saveVault();
        return this.vault;
    }

    startEngine(intervalMs = 20 * 60 * 1000) {
        console.log('[SHARP_ENGINE] Starting 24/7 Pure Node.js Sharp Picks Engine...');
        // Initial run
        this.updateCycle().catch(err => console.error('[SHARP_ENGINE] Initial update error:', err));
        // Periodic runner
        setInterval(() => {
            this.updateCycle().catch(err => console.error('[SHARP_ENGINE] Cycle error:', err));
        }, intervalMs);
    }

    getVault() {
        return this.vault;
    }
}

export const sharpPicksEngine = new SharpPicksEngine();

// Allow standalone execution: node server/sharpPicksEngine.js
if (process.argv[1] && process.argv[1].endsWith('sharpPicksEngine.js')) {
    sharpPicksEngine.updateCycle().then(() => {
        console.log('[SHARP_ENGINE] Standalone execution complete.');
        process.exit(0);
    }).catch(err => {
        console.error('[SHARP_ENGINE] Standalone failed:', err);
        process.exit(1);
    });
}
