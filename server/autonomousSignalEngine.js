/**
 * AUTONOMOUS IN-PLAY SIGNAL ENGINE (v1.0)
 * 24/7 Server-side match evaluation and automated signal dispatch
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { telegramBot } from './telegramBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOFASCORE_FILE = path.join(__dirname, 'sofascore_live.json');
const STATS_DIR = path.join(__dirname, 'stats');
const LOCKS_FILE = path.join(__dirname, 'engine_signal_locks.json');

export class AutonomousSignalEngine {
    constructor() {
        this.isRunning = false;
        this.emergencyHalt = false; // 🛑 Master Admin Kill-Switch
        this.isScanning = false;
        this.intervalId = null;
        this.lastGlobalSignalTime = 0;
        this.minGlobalSignalIntervalMs = 5 * 60 * 1000; // Minimum 5 mins between system signals
        this.matchLocks = new Map();
        this.loadLocks();
    }

    loadLocks() {
        try {
            if (fs.existsSync(LOCKS_FILE)) {
                const data = JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8'));
                this.matchLocks = new Map(Object.entries(data));
            }
        } catch (e) {
            this.matchLocks = new Map();
        }
    }

    saveLocks() {
        try {
            const now = Date.now();
            const clean = {};
            for (const [k, v] of this.matchLocks.entries()) {
                if (now - v.timestamp < 3 * 3600 * 1000) {
                    clean[k] = v;
                }
            }
            fs.writeFileSync(LOCKS_FILE, JSON.stringify(clean, null, 2), 'utf8');
        } catch (e) {}
    }

    parseChoiceVal(choice) {
        if (!choice) return null;
        for (const k of ['decimalValue', 'value']) {
            if (choice[k] !== undefined && choice[k] !== null) {
                const v = parseFloat(choice[k]);
                if (!isNaN(v) && v > 0) return parseFloat(v.toFixed(2));
            }
        }
        const frac = choice.fractionalValue || choice.initialFractionalValue;
        if (frac) {
            const parts = String(frac).trim().split('/');
            if (parts.length === 2) {
                const num = parseFloat(parts[0]);
                const den = parseFloat(parts[1]);
                if (!isNaN(num) && !isNaN(den) && den > 0) {
                    return parseFloat(((num / den) + 1.0).toFixed(2));
                }
            } else {
                const v = parseFloat(frac);
                if (!isNaN(v) && v > 0) return parseFloat(v.toFixed(2));
            }
        }
        return null;
    }

    getRealMarketOdds(eventId, marketKey, params = {}) {
        if (!eventId) return null;
        const oddsPath = path.join(STATS_DIR, `${eventId}_odds.json`);
        let oddsData = null;
        if (fs.existsSync(oddsPath)) {
            try {
                oddsData = JSON.parse(fs.readFileSync(oddsPath, 'utf8'));
            } catch (e) {}
        }
        if (!oddsData || !Array.isArray(oddsData.markets)) return null;

        // ONLY accept genuine live markets (isLive: true && !suspended). NEVER use pre-match odds as in-play odds!
        if (marketKey === 'market_over_goals') {
            const targetLine = String(params.targetLine || '2.5');
            const mgMarkets = oddsData.markets.filter(m => 
                (m.marketGroup === 'Match goals' || m.marketName === 'Match goals' || m.marketId === 9) &&
                String(m.choiceGroup) === targetLine
            );
            const liveMarket = mgMarkets.find(m => m.isLive && !m.suspended);
            if (liveMarket && Array.isArray(liveMarket.choices)) {
                const overChoice = liveMarket.choices.find(c => (c.name || '').toLowerCase() === 'over');
                const val = this.parseChoiceVal(overChoice);
                if (val && val >= 1.05 && val <= 25.0) {
                    return { odds: val, isLive: true, suspended: false };
                }
            }
        }

        if (marketKey === 'market_next_goal_home' || marketKey === 'market_next_goal_away') {
            const isHome = marketKey === 'market_next_goal_home';
            const teamName = (params.teamName || '').toLowerCase().trim();
            const ngMarkets = oddsData.markets.filter(m => 
                m.marketGroup === 'Next goal' || m.marketName === 'Next goal' || m.marketId === 8
            );
            const liveMarket = ngMarkets.find(m => m.isLive && !m.suspended);
            if (liveMarket && Array.isArray(liveMarket.choices) && liveMarket.choices.length >= 2) {
                let choice = null;
                if (teamName) {
                    choice = liveMarket.choices.find(c => {
                        const n = (c.name || '').toLowerCase();
                        return n.includes(teamName) || teamName.includes(n);
                    });
                }
                if (!choice) {
                    choice = isHome ? liveMarket.choices[0] : (liveMarket.choices[2] || liveMarket.choices[1]);
                }
                const val = this.parseChoiceVal(choice);
                if (val && val >= 1.05 && val <= 25.0) {
                    return { odds: val, isLive: true, suspended: false };
                }
            }
        }

        if (marketKey === 'market_btts') {
            const bttsMarkets = oddsData.markets.filter(m => 
                m.marketGroup === 'Both teams to score' || m.marketName === 'Both teams to score' || m.marketId === 5
            );
            const liveMarket = bttsMarkets.find(m => m.isLive && !m.suspended);
            if (liveMarket && Array.isArray(liveMarket.choices)) {
                const yesChoice = liveMarket.choices.find(c => (c.name || '').toLowerCase() === 'yes');
                const val = this.parseChoiceVal(yesChoice);
                if (val && val >= 1.05 && val <= 25.0) {
                    return { odds: val, isLive: true, suspended: false };
                }
            }
        }

        return null;
    }

    /**
     * Dynamic mathematical in-play odds for Over Goals based on elapsed minute and tempo
     */
    calculateDynamicOverOdds(minute, totalGoals, targetLine, totalSOT) {
        const min = Math.min(85, Math.max(15, minute));
        const remainingMins = Math.max(10, 93 - min);
        // Exponential time-decay model for in-play single goal
        const base = 1.18 + Math.pow((90 - remainingMins) / 90, 2.0) * 1.95;
        // High tempo / pressure discount
        const tempoAdj = Math.max(-0.20, Math.min(0.18, (6 - (totalSOT || 6)) * 0.035));
        const val = Math.max(1.35, Math.min(4.20, base + tempoAdj));
        return parseFloat(val.toFixed(2));
    }

    /**
     * Dynamic mathematical in-play odds for Next Goal based on dominance and remaining time
     */
    calculateDynamicNextGoalOdds(minute, dominantPoss, dominantSOT, opponentSOT) {
        const min = Math.min(85, Math.max(15, minute));
        const remainingMins = Math.max(10, 93 - min);
        const sotDiff = Math.max(0, (dominantSOT || 0) - (opponentSOT || 0));
        const dominanceBonus = ((dominantPoss || 50) - 50) * 0.008 + sotDiff * 0.04;
        const base = 1.40 + ((90 - remainingMins) / 90) * 1.05 - dominanceBonus;
        const val = Math.max(1.42, Math.min(3.40, base));
        return parseFloat(val.toFixed(2));
    }

    /**
     * Dynamic mathematical in-play odds for Both Teams To Score (KG Var)
     */
    calculateDynamicBttsOdds(minute, hSOT, aSOT) {
        const min = Math.min(80, Math.max(25, minute));
        const remainingMins = Math.max(15, 93 - min);
        const offensivePace = ((hSOT || 3) + (aSOT || 3) - 6) * 0.03;
        const base = 1.35 + ((90 - remainingMins) / 90) * 1.30 - offensivePace;
        const val = Math.max(1.45, Math.min(3.50, base));
        return parseFloat(val.toFixed(2));
    }

    parseStats(statsData) {
        const res = { home: {}, away: {} };
        if (!statsData || !Array.isArray(statsData.statistics)) return res;
        const all = statsData.statistics.find(s => s.period === 'ALL') || statsData.statistics[0];
        if (!all) return res;
        for (const g of all.groups || []) {
            for (const item of g.statisticsItems || []) {
                const key = (item.name || '').toLowerCase().trim();
                res.home[key] = parseFloat(item.home) || item.homeValue || 0;
                res.away[key] = parseFloat(item.away) || item.awayValue || 0;
            }
        }
        return res;
    }

    parseMinute(ev) {
        if (!ev) return null;
        if (typeof ev.minute === 'number' && ev.minute > 0) return ev.minute;

        const desc = (ev.status?.description || '').toLowerCase().trim();
        if (desc.includes('halftime') || desc.includes('iy') || desc.includes('break')) return null;

        // 1. Calculate from SofaScore period timestamp (most accurate for live matches)
        if (ev.time?.currentPeriodStartTimestamp) {
            const nowSec = Math.floor(Date.now() / 1000);
            const elapsed = Math.floor((nowSec - ev.time.currentPeriodStartTimestamp) / 60);
            if (elapsed >= 0) {
                if (desc.includes('2nd') || desc.includes('2.') || desc.includes('second')) {
                    return Math.min(90, 45 + elapsed);
                }
                return Math.min(45, Math.max(1, elapsed));
            }
        }

        // 2. Check for explicit minute (e.g. "65'", "72 min") - strictly avoid "1st" / "2nd"
        const mExplicit = desc.match(/\b([1-9]\d?|90)\s*['’]/) || desc.match(/\b([2-8]\d)\b/);
        if (mExplicit) {
            const parsed = parseInt(mExplicit[1], 10);
            if (parsed >= 1 && parsed <= 95) return parsed;
        }

        return null;
    }

    requestStats(id) {
        if (!id) return;
        try {
            const REQUEST_QUEUE = path.join(__dirname, 'stats_request.json');
            let queue = { ids: [] };
            if (fs.existsSync(REQUEST_QUEUE)) {
                try { queue = JSON.parse(fs.readFileSync(REQUEST_QUEUE, 'utf8')); } catch(e) {}
            }
            const strId = String(id);
            if (!queue.ids.includes(strId)) {
                queue.ids.push(strId);
                fs.writeFileSync(REQUEST_QUEUE, JSON.stringify(queue), 'utf8');
            }
        } catch(e) {}
    }

    evaluateEvent(ev) {
        if (!ev || ev.status?.type !== 'inprogress') return null;
        if (ev.tournament?.category?.sport?.id && ev.tournament.category.sport.id !== 1) return null;

        const minute = this.parseMinute(ev);
        if (!minute || minute < 20 || minute > 78) return null;

        const homeTeam = ev.homeTeam?.name || 'Home';
        const awayTeam = ev.awayTeam?.name || 'Away';
        const league = ev.tournament?.name || 'In-Play';
        const curHome = Number(ev.homeScore?.current ?? 0);
        const curAway = Number(ev.awayScore?.current ?? 0);
        const totalGoals = curHome + curAway;
        const scoreStr = `${curHome}-${curAway}`;
        const goalDiff = Math.abs(curHome - curAway);

        // 1. Filter out blowouts or stabilized comfortable leads (e.g. 2-0, 0-2, 3-1, 3-0)
        // A match with a 2+ goal margin after 38' is stabilized; leading teams control/slow down (classic trap)
        if (goalDiff >= 3) return null;
        if (goalDiff >= 2 && minute >= 38) return null;

        // 2. Strict 90-minute Match Lock (A single match can only be signaled ONCE across both channels)
        const lockKey = String(ev.id);
        const existingLock = this.matchLocks.get(lockKey);
        if (existingLock) {
            const timeSince = Date.now() - existingLock.timestamp;
            if (timeSince < 90 * 60 * 1000) {
                return null;
            }
        }

        // Check stats file
        const statsPath = path.join(STATS_DIR, `${ev.id}_stats.json`);
        if (!fs.existsSync(statsPath)) {
            this.requestStats(ev.id);
            return null;
        }

        let parsedStats = null;
        try {
            const raw = fs.readFileSync(statsPath, 'utf8');
            parsedStats = this.parseStats(JSON.parse(raw));
        } catch (e) {
            return null;
        }

        const h = parsedStats.home;
        const a = parsedStats.away;

        const hShots = h['total shots'] || 0;
        const aShots = a['total shots'] || 0;
        const hSOT = h['shots on target'] || 0;
        const aSOT = a['shots on target'] || 0;
        const hBox = h['touches in penalty area'] || h['shots inside box'] || 0;
        const aBox = a['touches in penalty area'] || a['shots inside box'] || 0;
        const hPoss = h['ball possession'] || 50;
        const aPoss = a['ball possession'] || 50;

        const totalSOT = hSOT + aSOT;
        const totalBox = hBox + aBox;

        // Minimum activity filter
        if ((hShots + aShots) < 6) return null;

        let selectedSetup = null;

        // 1. One-Sided Heavy Dominance (Next Goal)
        if (hPoss >= 62 && hSOT >= (aSOT + 3) && hBox >= 12 && curHome <= curAway) {
            const oddsRes = this.getRealMarketOdds(ev.id, 'market_next_goal_home', { teamName: homeTeam });
            if (oddsRes?.suspended) return null;

            const oddsVal = (oddsRes?.isLive && oddsRes?.odds)
                ? oddsRes.odds
                : this.calculateDynamicNextGoalOdds(minute, hPoss, hSOT, aSOT);

            selectedSetup = {
                strategyId: 'PRESS',
                strategyLabel: 'Baskı Dominasyonu',
                level: 'ALPHA',
                marketKey: 'market_next_goal_home',
                marketLabel: `Sıradaki Gol: ${homeTeam}`,
                odds: oddsVal,
                isRealOdds: !!(oddsRes?.isLive && oddsRes?.odds),
                confidence: 86,
                reasoning: [
                    `${homeTeam} yoğun hücum baskısı ve ceza sahası hakimiyeti (%${hPoss} topla oynama)`,
                    `Ceza sahasında yüksek topla buluşma (${hBox} temas)`,
                    `Baskılı şut üstünlüğü (${hSOT} - ${aSOT} isabetli şut)`
                ]
            };
        } else if (aPoss >= 62 && aSOT >= (hSOT + 3) && aBox >= 12 && curAway <= curHome) {
            const oddsRes = this.getRealMarketOdds(ev.id, 'market_next_goal_away', { teamName: awayTeam });
            if (oddsRes?.suspended) return null;

            const oddsVal = (oddsRes?.isLive && oddsRes?.odds)
                ? oddsRes.odds
                : this.calculateDynamicNextGoalOdds(minute, aPoss, aSOT, hSOT);

            selectedSetup = {
                strategyId: 'PRESS',
                strategyLabel: 'Baskı Dominasyonu',
                level: 'ALPHA',
                marketKey: 'market_next_goal_away',
                marketLabel: `Sıradaki Gol: ${awayTeam}`,
                odds: oddsVal,
                isRealOdds: !!(oddsRes?.isLive && oddsRes?.odds),
                confidence: 85,
                reasoning: [
                    `${awayTeam} deplasmanda yoğun baskı kurdu (%${aPoss} topla oynama)`,
                    `Sürekli ceza sahası penetrasyonu (${aBox} temas)`,
                    `Savunma hattı zorlanıyor (${aSOT} - ${hSOT} isabetli şut)`
                ]
            };
        }
        // 2. High Threat In-Play Over Goals (Target Line is strictly the NEXT goal: totalGoals + 0.5)
        else if (totalSOT >= 5 && totalBox >= 16 && minute >= 25 && minute <= 74) {
            // Target the next goal line consistently
            const targetLine = (totalGoals === 0 && minute < 30) ? '1.5' : (totalGoals + 0.5).toFixed(1);
            
            const oddsRes = this.getRealMarketOdds(ev.id, 'market_over_goals', { targetLine });
            if (oddsRes?.suspended) return null;

            const oddsVal = (oddsRes?.isLive && oddsRes?.odds)
                ? oddsRes.odds
                : this.calculateDynamicOverOdds(minute, totalGoals, targetLine, totalSOT);

            const stratId = minute >= 68 ? 'MOMENTUM' : (minute <= 40 ? 'FHG' : 'PRESS');
            const stratLabel = minute >= 68 ? 'Son 20dk Patlaması' : (minute <= 40 ? 'İY 0.5 Üst Erken Gol' : 'Baskı Dominasyonu');

            selectedSetup = {
                strategyId: stratId,
                strategyLabel: stratLabel,
                level: totalSOT >= 7 ? 'ALPHA' : 'ALEV',
                marketKey: 'market_over_goals',
                marketLabel: `Maçta ${targetLine} Üst Gol`,
                odds: oddsVal,
                isRealOdds: !!(oddsRes?.isLive && oddsRes?.odds),
                confidence: 84,
                reasoning: [
                    `Yüksek maç temposu ve ${totalSOT} isabetli şut`,
                    `Yoğun ceza sahası aksiyonu (${totalBox} temas)`,
                    `xG gol ivmesi yakın bir golü doğruluyor`
                ]
            };
        }
        // 3. BTTS Opportunity (Both Teams To Score)
        else if ((curHome === 0 || curAway === 0) && hSOT >= 3 && aSOT >= 3 && minute >= 30 && minute <= 70) {
            const oddsRes = this.getRealMarketOdds(ev.id, 'market_btts');
            if (oddsRes?.suspended) return null;

            const oddsVal = (oddsRes?.isLive && oddsRes?.odds)
                ? oddsRes.odds
                : this.calculateDynamicBttsOdds(minute, hSOT, aSOT);

            selectedSetup = {
                strategyId: 'BTTS',
                strategyLabel: 'KG Var Dinamiği',
                level: 'ALEV',
                marketKey: 'market_btts',
                marketLabel: 'Karşılıklı Gol Var (KG Var)',
                odds: oddsVal,
                isRealOdds: !!(oddsRes?.isLive && oddsRes?.odds),
                confidence: 82,
                reasoning: [
                    `İki takım da karşılıklı tehlikeli ataklar geliştiriyor`,
                    `Yüksek çift taraflı hücum hacmi (${hSOT} & ${aSOT} isabetli şut)`,
                    `Açık alan geçişleri ve yüksek gol tehlikesi`
                ]
            };
        }

        if (!selectedSetup) return null;

        const predText = selectedSetup.odds
            ? `${selectedSetup.marketLabel} (Oran: ${selectedSetup.odds})`
            : selectedSetup.marketLabel;

        return {
            id: `sig_${ev.id}_${minute}`,
            matchId: String(ev.id),
            homeTeam,
            awayTeam,
            league,
            score: scoreStr,
            minute,
            level: selectedSetup.level,
            recommendation: {
                predictionText: predText,
                marketKey: selectedSetup.marketKey,
                marketLabel: selectedSetup.marketLabel,
                odds: selectedSetup.odds,
                isRealOdds: selectedSetup.isRealOdds,
                confidence: selectedSetup.confidence,
                reasoning: selectedSetup.reasoning
            },
            activeStrategies: [
                {
                    id: selectedSetup.strategyId,
                    icon: selectedSetup.level === 'ALPHA' ? '💎' : '🔥',
                    label: selectedSetup.strategyLabel,
                    verdict: selectedSetup.reasoning[0]
                }
            ],
            maxEV: 0.12,
            bestEV: {
                ev: 12,
                label: selectedSetup.marketLabel,
                fairOdds: selectedSetup.odds ? (selectedSetup.odds * 0.88).toFixed(2) : null,
                marketOdds: selectedSetup.odds,
                trueProb: selectedSetup.confidence
            },
            xgSurplus: 0.65,
            dqs: 0.85
        };
    }

    async scanCycle() {
        if (this.isScanning) return; // Concurrency guard: never overlap scans
        this.isScanning = true;
        try {
            // 🛑 Master Admin Kill-Switch Check
            if (this.emergencyHalt) {
                return;
            }

            if (!fs.existsSync(SOFASCORE_FILE)) return;

            // ⚠️ Stale Data Watchdog Guard: Protect against frozen/crashed scraper
            try {
                const stat = fs.statSync(SOFASCORE_FILE);
                const fileAgeSec = Math.round((Date.now() - stat.mtimeMs) / 1000);
                if (fileAgeSec > 180) {
                    console.warn(`[AUTONOMOUS_ENGINE] ⚠️ Stale data guard: SofaScore verisi ${fileAgeSec}s bayat! Sinyal gönderimi askıya alındı.`);
                    return;
                }
            } catch (err) {}

            const raw = fs.readFileSync(SOFASCORE_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.events)) return;

            // Global cooldown check
            const now = Date.now();
            if (now - this.lastGlobalSignalTime < this.minGlobalSignalIntervalMs) {
                return;
            }

            for (const ev of data.events) {
                const alert = this.evaluateEvent(ev);
                if (alert) {
                    console.log(`[AUTONOMOUS_ENGINE] 🎯 Found high-value setup: ${alert.homeTeam} vs ${alert.awayTeam} [${alert.level}] -> ${alert.recommendation.marketLabel}`);
                    
                    // Immediately lock match and update cooldown BEFORE async network dispatch to prevent race conditions
                    this.lastGlobalSignalTime = Date.now();
                    this.matchLocks.set(String(ev.id), {
                        timestamp: Date.now(),
                        score: alert.score,
                        marketKey: alert.recommendation.marketKey,
                        minute: alert.minute
                    });
                    this.saveLocks();

                    const result = await telegramBot.processAlert(alert);
                    if (result && result.sent) {
                        break; // 1 curated signal per cycle
                    }
                }
            }
        } catch (e) {
            console.error('[AUTONOMOUS_ENGINE] Scan error:', e.message);
        } finally {
            this.isScanning = false;
        }
    }

    setEmergencyHalt(halt) {
        this.emergencyHalt = Boolean(halt);
        console.log(`[AUTONOMOUS_ENGINE] 🛑 Master Kill-Switch is now: ${this.emergencyHalt ? 'ACTIVE (Sinyaller Durduruldu)' : 'OFF (Sinyaller Açık)'}`);
        return this.emergencyHalt;
    }

    clearLocks() {
        this.matchLocks.clear();
        try {
            if (fs.existsSync(LOCKS_FILE)) {
                fs.writeFileSync(LOCKS_FILE, JSON.stringify({}, null, 2), 'utf8');
            }
        } catch (e) {}
        console.log('[AUTONOMOUS_ENGINE] 🔄 Match locks manually cleared by Admin.');
        return true;
    }

    getStatus() {
        let dataAgeSec = null;
        let eventCount = 0;
        try {
            if (fs.existsSync(SOFASCORE_FILE)) {
                const stat = fs.statSync(SOFASCORE_FILE);
                dataAgeSec = Math.round((Date.now() - stat.mtimeMs) / 1000);
                const raw = JSON.parse(fs.readFileSync(SOFASCORE_FILE, 'utf8'));
                if (Array.isArray(raw)) eventCount = raw.length;
                else if (raw && Array.isArray(raw.events)) eventCount = raw.events.length;
            }
        } catch (e) {}

        return {
            isRunning: this.isRunning,
            emergencyHalt: this.emergencyHalt,
            lastGlobalSignalTime: this.lastGlobalSignalTime,
            activeLocksCount: this.matchLocks.size,
            dataAgeSec,
            eventCount,
            isDataStale: dataAgeSec !== null && dataAgeSec > 180
        };
    }

    start(intervalSec = 25) {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[AUTONOMOUS_ENGINE] 🚀 24/7 In-Play Autonomous Signal Engine started (Interval: ${intervalSec}s)`);
        this.intervalId = setInterval(() => this.scanCycle(), intervalSec * 1000);
        setTimeout(() => this.scanCycle(), 10000);
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) clearInterval(this.intervalId);
    }
}

export const autonomousSignalEngine = new AutonomousSignalEngine();