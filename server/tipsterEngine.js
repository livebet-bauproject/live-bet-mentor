import https from 'https';
import querystring from 'querystring';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_FILE = path.join(__dirname, 'tipster_vault.json');

// Pool of prestigious and professional analyst personas
const PERSONA_POOL = [
    { name: 'Alpha Stratejist', badge: '🔥 6/6 Formda', avatarIndex: 1, specialty: 'Canlı Baskı & Gol Hacmi' },
    { name: 'Kıdemli Oran Avcısı', badge: '🎯 %84 İsabet', avatarIndex: 2, specialty: 'Değerli Piyasa Oranları' },
    { name: 'Momentum Ustası', badge: '⚡ Hızlı Reaksiyon', avatarIndex: 3, specialty: '2. Yarı Dinamikleri' },
    { name: 'Kuantum Analisti', badge: '🧠 xG & İstatistik', avatarIndex: 4, specialty: 'Matematiksel Modeller' },
    { name: 'Piyasa Taktisyeni', badge: '🛡️ Defansif Açıklar', avatarIndex: 5, specialty: 'Handikap & Çifte Şans' },
    { name: 'Radar Gözlemcisi', badge: '🔭 Erken Sinyal', avatarIndex: 6, specialty: 'Canlı Konsensüs' },
    { name: 'Elit Portföy Lideri', badge: '👑 +%28 Aylık ROI', avatarIndex: 7, specialty: 'Kasa Disiplini & Kelly' },
    { name: 'Alt/Üst Uzmanı', badge: '⚽ Gol Patlaması', avatarIndex: 8, specialty: 'Toplam Gol Çizgisi' }
];

class TipsterEngine {
    constructor() {
        this.cache = {
            picks: [],
            leaderboard: [],
            lastFetched: 0
        };
        this.settings = {
            minStake: 8, // Strictly publish only high confidence picks (>= 8/10)
            vipThresholdStake: 9, // 9/10 and 10/10 picks get VIP exclusive badge
            onlyVerified: false
        };
        this.vault = {
            tipsters: {}, // realUsername -> { maskedName, badge, specialty, avatarIndex, isActive, realYield, realPicksCount, winRate, simulatedRoi }
            settings: this.settings
        };
        this.isFetching = false;
        this.initVault();
    }

    initVault() {
        try {
            if (fs.existsSync(VAULT_FILE)) {
                const data = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
                if (data && data.tipsters) {
                    this.vault = data;
                    if (data.settings) {
                        this.settings = { ...this.settings, ...data.settings };
                    }
                }
            } else {
                this.saveVault();
            }
        } catch (e) {
            console.warn('[TIPSTER_ENGINE] Error loading vault:', e.message);
        }
    }

    saveVault() {
        try {
            fs.writeFileSync(VAULT_FILE, JSON.stringify(this.vault, null, 2), 'utf8');
        } catch (e) {
            console.error('[TIPSTER_ENGINE] Error saving vault:', e.message);
        }
    }

    getOrCreatePersona(realUsername, stats = {}) {
        if (!realUsername) return null;
        const key = realUsername.toLowerCase().trim();

        if (this.vault.tipsters[key]) {
            if (stats.yield) this.vault.tipsters[key].realYield = stats.yield;
            if (stats.picksCount) this.vault.tipsters[key].realPicksCount = stats.picksCount;
            return this.vault.tipsters[key];
        }

        const count = Object.keys(this.vault.tipsters).length;
        const poolIndex = count % PERSONA_POOL.length;
        const basePersona = PERSONA_POOL[poolIndex];
        const cycleNum = Math.floor(count / PERSONA_POOL.length) + 1;
        const suffix = cycleNum > 1 ? ` #${cycleNum}` : '';

        const newPersona = {
            realUsername: realUsername,
            profileUrl: `https://${realUsername}.blogabet.com`,
            maskedName: `${basePersona.name}${suffix}`,
            badge: basePersona.badge,
            specialty: basePersona.specialty,
            avatarIndex: (poolIndex % 8) + 1,
            isActive: true,
            realYield: stats.yield || '+16%',
            realPicksCount: stats.picksCount || 140,
            simulatedRoi: stats.yield ? parseFloat(stats.yield.replace('%', '')) : (16.5 + (poolIndex % 8)),
            winRate: 74 + (poolIndex % 14),
            createdAt: new Date().toISOString()
        };

        this.vault.tipsters[key] = newPersona;
        this.saveVault();
        return newPersona;
    }

    fetchBlogabetFeed() {
        return new Promise((resolve) => {
            const postData = querystring.stringify({
                activetab: 'alltipsters',
                time_posted: 0,
                firstLoad: 1,
                'filter[sport]': '',
                'filter[competition]': ''
            });

            const options = {
                hostname: 'blogabet.com',
                path: '/feed/reload_feed',
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://blogabet.com/feed',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 12000
            };

            const req = https.request(options, (res) => {
                if (res.statusCode !== 200) {
                    console.warn(`[TIPSTER_ENGINE] Non-200 status: ${res.statusCode}`);
                    return resolve('');
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });

            req.on('error', (err) => {
                console.warn('[TIPSTER_ENGINE] Request error:', err.message);
                resolve('');
            });
            req.on('timeout', () => {
                req.destroy();
                resolve('');
            });

            req.write(postData);
            req.end();
        });
    }

    parseFeedHtml(html) {
        if (!html) return [];
        const items = [];
        const parts = html.split(/<li[^>]*id="media-([0-9]+)"[^>]*>/i);

        // parts[1] = id1, parts[2] = content1, parts[3] = id2, parts[4] = content2...
        for (let i = 1; i < parts.length; i += 2) {
            const pickId = parts[i];
            const content = parts[i + 1] || '';

            try {
                // Real author extraction
                const authorMatch = content.match(/data-author-name="([^"]+)"/i) || 
                                    content.match(/href="https:\/\/([a-zA-Z0-9_\-]+)\.blogabet\.com"/i) ||
                                    content.match(/title="([a-zA-Z0-9_\-]+)"\s+href="https:\/\/[a-zA-Z0-9_\-]+\.blogabet\.com"/i);
                const realUsername = authorMatch ? authorMatch[1].trim() : null;
                if (!realUsername) continue;

                // Match name
                const matchNameMatch = content.match(/<a[^>]*href="[^"]*\/pick\/[0-9]+\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
                let matchName = matchNameMatch ? matchNameMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                if (!matchName) continue;

                // Selection & Odds
                const pickLineMatch = content.match(/<div class="pick-line">([\s\S]*?)@\s*<span class="feed-odd">([0-9\.]+)<\/span>/i);
                let selection = pickLineMatch ? pickLineMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                const odds = pickLineMatch ? parseFloat(pickLineMatch[2]) : 1.80;

                // Clean selection format
                selection = selection
                    .replace(/Full Event/gi, '')
                    .replace(/\(O\/U\)/gi, '')
                    .replace(/\(To Win Match\)/gi, '(Maç Sonu)')
                    .trim();

                // Stake
                const stakeMatch = content.match(/<span class="label label-default">([0-9]+(?:\.[0-9]+)?)\s*\/\s*10<\/span>/i);
                const stake = stakeMatch ? parseFloat(stakeMatch[1]) : 5;

                // Stats (yield, picks count)
                const statsMatch = content.match(/class="u-dp data-info"[^>]*>[\s\S]*?([+\-]?[0-9]+%)\s*\(([0-9]+)\)/i);
                const realYield = statsMatch ? statsMatch[1] : '+14%';
                const picksCount = statsMatch ? parseInt(statsMatch[2], 10) : 100;

                // Sport and League
                const sportLineMatch = content.match(/<div class="sport-line">[\s\S]*?<small class="text-muted">([\s\S]*?)<\/small>/i);
                let sportDetails = sportLineMatch ? sportLineMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : 'Futbol';

                let sport = 'Futbol';
                const lowerDetails = sportDetails.toLowerCase();
                if (lowerDetails.includes('basketball')) sport = 'Basketbol';
                else if (lowerDetails.includes('tennis')) sport = 'Tenis';
                else if (lowerDetails.includes('ice hockey')) sport = 'Buz Hokeyi';

                // Is Live?
                const isLive = content.toLowerCase().includes('live-pick') || 
                               content.toLowerCase().includes('class="label label-live') ||
                               content.toLowerCase().includes('fa-bolt');

                // Age / Time
                const ageMatch = content.match(/<small class="bet-age text-muted">([^<]+)<\/small>/i);
                let ageText = ageMatch ? ageMatch[1].trim() : 'Yeni';
                ageText = ageText
                    .replace('secs ago', 'sn önce')
                    .replace('mins ago', 'dk önce')
                    .replace('hours ago', 'sa önce')
                    .replace('hour ago', 'sa önce');

                // Analysis text (if provided by tipster)
                const analysisMatch = content.match(/id="feed_pick_analysis_[0-9]+"[^>]*>([\s\S]*?)<\/div>/i);
                let analysis = analysisMatch ? analysisMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                if (analysis.length > 280) analysis = analysis.substring(0, 277) + '...';

                // Masked Persona
                const persona = this.getOrCreatePersona(realUsername, { yield: realYield, picksCount });
                if (!persona || !persona.isActive) continue;

                // Stake filtering rule
                if (stake < this.settings.minStake) continue;

                const isVipOnly = stake >= this.settings.vipThresholdStake;
                // Dual Consensus: High confidence (>=8/10) with solid odds (1.50 - 2.40)
                const isDualConsensus = stake >= 8 && odds >= 1.50 && odds <= 2.40;

                items.push({
                    id: `tp-${pickId}`,
                    matchName,
                    selection,
                    odds,
                    stake,
                    confidenceScore: Math.round(stake * 10), // e.g. 10/10 -> 100%
                    isLive,
                    sport,
                    sportDetails,
                    ageText,
                    analysis: analysis || null,
                    isVipOnly,
                    isDualConsensus,
                    analyst: {
                        name: persona.maskedName,
                        badge: persona.badge,
                        specialty: persona.specialty,
                        avatarIndex: persona.avatarIndex,
                        winRate: persona.winRate,
                        simulatedRoi: persona.simulatedRoi
                    },
                    status: 'PENDING',
                    createdAt: new Date().toISOString()
                });
            } catch (err) {
                console.warn('[TIPSTER_ENGINE] Item parse error:', err.message);
            }
        }

        return items;
    }

    async updateFeed() {
        if (this.fetchPromise) return this.fetchPromise;

        this.fetchPromise = (async () => {
            try {
                const html = await this.fetchBlogabetFeed();
                if (html && html.length > 500) {
                    const parsed = this.parseFeedHtml(html);
                    if (parsed.length > 0) {
                        this.cache.picks = parsed;
                        this.cache.lastFetched = Date.now();
                        this.rebuildLeaderboard();
                        console.log(`[TIPSTER_ENGINE] Updated feed with ${parsed.length} active picks.`);
                    }
                }
            } catch (e) {
                console.error('[TIPSTER_ENGINE] Update feed error:', e.message);
            } finally {
                this.fetchPromise = null;
            }
        })();

        return this.fetchPromise;
    }

    rebuildLeaderboard() {
        const list = Object.values(this.vault.tipsters)
            .filter(t => t.isActive)
            .map((t, idx) => ({
                id: `analyst-${idx + 1}`,
                realUsername: t.realUsername, // for admin reference if needed
                name: t.maskedName,
                badge: t.badge,
                specialty: t.specialty,
                avatarIndex: t.avatarIndex,
                roi: `+${(Math.abs(t.simulatedRoi || 18.5)).toFixed(1)}%`,
                winRate: `${t.winRate || 76}%`,
                recentForm: ['W', 'W', 'W', (idx % 2 === 0 ? 'W' : 'L'), 'W'],
                totalPicks: t.realPicksCount || (120 + idx * 8),
                rank: idx + 1
            }))
            .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
            .map((item, idx) => ({ ...item, rank: idx + 1 }));

        this.cache.leaderboard = list;
    }

    // Public API for site users (Strictly no real identities)
    getPublicFeed(options = {}) {
        let list = [...this.cache.picks];

        // Enforce minimum stake threshold (strictly only >= minStake, default 8)
        const requiredStake = Math.max(8, this.settings.minStake || 8);
        list = list.filter(p => p.stake >= requiredStake);

        if (options.onlyLive) {
            list = list.filter(p => p.isLive);
        }
        if (options.onlyHighConfidence) {
            list = list.filter(p => p.stake >= 9);
        }
        if (options.sport && options.sport !== 'ALL') {
            list = list.filter(p => p.sport.toLowerCase() === options.sport.toLowerCase());
        }

        // Leaderboard without realUsername
        const cleanLeaderboard = this.cache.leaderboard.map(item => {
            const { realUsername, ...publicFields } = item;
            return publicFields;
        });

        return {
            picks: list,
            total: list.length,
            lastUpdated: this.cache.lastFetched,
            leaderboard: cleanLeaderboard.slice(0, 8),
            activeTipsterCount: Object.values(this.vault.tipsters).filter(t => t.isActive).length
        };
    }

    // Admin API
    getAdminTipsters() {
        return {
            tipsters: Object.values(this.vault.tipsters),
            settings: this.settings,
            activeCount: Object.values(this.vault.tipsters).filter(t => t.isActive).length,
            totalPicksInCache: this.cache.picks.length
        };
    }

    updateTipster(realUsername, updates = {}) {
        if (!realUsername) return false;
        const key = realUsername.toLowerCase().trim();
        if (!this.vault.tipsters[key]) return false;

        const current = this.vault.tipsters[key];
        if (typeof updates.maskedName === 'string' && updates.maskedName.trim()) {
            current.maskedName = updates.maskedName.trim();
        }
        if (typeof updates.badge === 'string') {
            current.badge = updates.badge.trim();
        }
        if (typeof updates.isActive === 'boolean') {
            current.isActive = updates.isActive;
        }
        if (typeof updates.specialty === 'string') {
            current.specialty = updates.specialty.trim();
        }
        if (typeof updates.winRate === 'number') {
            current.winRate = updates.winRate;
        }

        this.saveVault();
        this.rebuildLeaderboard();
        return true;
    }

    updateSettings(newSettings = {}) {
        if (typeof newSettings.minStake === 'number') {
            this.settings.minStake = Math.max(1, Math.min(10, newSettings.minStake));
        }
        if (typeof newSettings.vipThresholdStake === 'number') {
            this.settings.vipThresholdStake = Math.max(1, Math.min(10, newSettings.vipThresholdStake));
        }
        this.vault.settings = this.settings;
        this.saveVault();
        return this.settings;
    }
}

export const tipsterEngine = new TipsterEngine();

// Auto-run loop every 45 seconds
setInterval(() => {
    tipsterEngine.updateFeed().catch(() => {});
}, 45000);

// Initial run
tipsterEngine.updateFeed().catch(() => {});
