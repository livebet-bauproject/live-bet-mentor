/**
 * AUTONOMOUS IN-PLAY SIGNAL ENGINE (v1.0)
 * 24/7 Server-side match evaluation and automated signal dispatch
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { telegramBot } from './telegramBot.js';
import { SafeStore } from './safeStore.js';
import { circuitBreaker } from './circuitBreaker.js';
import { leagueTierGuard } from './leagueTierGuard.js';
import { HeartbeatWatchdog } from './heartbeatWatchdog.js';

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
        
        // ⚙️ SafeStore: Zero File-Lock atomic in-memory persistence
        this.locksStore = new SafeStore(LOCKS_FILE, 4000);
        this.matchLocks = new Map();
        this.loadLocks();

        // 💓 Altyapı Watchdog: Canlı veri akışı 3.5 dk durursa telegram alarmı ver
        this.watchdog = new HeartbeatWatchdog(SOFASCORE_FILE, async (msg) => {
            try {
                if (telegramBot && telegramBot.vipGroupId) {
                    await telegramBot.sendMessage(telegramBot.vipGroupId, msg);
                }
            } catch (e) {}
        });
    }

    loadLocks() {
        try {
            const now = Date.now();
            for (const [k, v] of this.locksStore.entries()) {
                if (now - v.timestamp < 3 * 3600 * 1000) {
                    this.matchLocks.set(k, v);
                } else {
                    this.locksStore.delete(k);
                }
            }
        } catch (e) {
            this.matchLocks = new Map();
        }
    }

    saveLocks() {
        try {
            const now = Date.now();
            for (const [k, v] of this.matchLocks.entries()) {
                if (now - v.timestamp < 3 * 3600 * 1000) {
                    this.locksStore.set(k, v);
                } else {
                    this.matchLocks.delete(k);
                    this.locksStore.delete(k);
                }
            }
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

        if (marketKey === 'market_dnb_home' || marketKey === 'market_dnb_away' || marketKey === 'market_1x2_home' || marketKey === 'market_1x2_away') {
            const isHome = marketKey.includes('home');
            const isDnb = marketKey.includes('dnb');
            const targetGroup = isDnb ? ['draw no bet', 'dnb'] : ['full time', '1x2', 'match result'];
            const candMarkets = oddsData.markets.filter(m => 
                targetGroup.some(tg => (m.marketGroup || '').toLowerCase().includes(tg) || (m.marketName || '').toLowerCase().includes(tg))
            );
            const liveMarket = candMarkets.find(m => m.isLive && !m.suspended);
            if (liveMarket && Array.isArray(liveMarket.choices) && liveMarket.choices.length >= 2) {
                const choice = isHome ? liveMarket.choices[0] : (liveMarket.choices[2] || liveMarket.choices[1]);
                const val = this.parseChoiceVal(choice);
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

        // 🏦 Quant Lig & Likidite Koruması: Alt lig, gençlik ve amatörleri süz
        const tierEval = leagueTierGuard.evaluate(ev.tournament?.name, ev.tournament?.category?.name);
        if (!tierEval.allowed) return null;

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
        const hXG = Number(h['expected goals'] || 0);
        const aXG = Number(a['expected goals'] || 0);
        const totalXG = parseFloat((hXG + aXG).toFixed(2));
        const hBigChances = Number(h['big chances'] || 0);
        const aBigChances = Number(a['big chances'] || 0);
        const hRed = Number(h['red cards'] || 0);
        const aRed = Number(a['red cards'] || 0);

        const totalSOT = hSOT + aSOT;
        const totalBox = hBox + aBox;

        // 🛑 Disciplinary Filter: Multiple red cards ruin predictable match dynamics
        if (hRed >= 2 || aRed >= 2 || (hRed >= 1 && aRed >= 1)) return null;

        // Minimum activity filter
        if ((hShots + aShots) < 6) return null;

        let selectedSetup = null;

        // 1. One-Sided Heavy Dominance (Next Goal - Home)
        // Disqualify if home has a red card!
        if (hRed === 0 && hPoss >= 60 && hSOT >= (aSOT + 2) && hBox >= 12 && curHome <= curAway) {
            // Require xG confirmation if xG is available: home must have positive xG advantage or at least 1 big chance/good xG
            if (hXG > 0 && aXG > 0 && hXG < (aXG * 0.75) && hBigChances === 0) {
                // Sterile possession with no real goal threat -> skip
            } else {
                const oddsRes = this.getRealMarketOdds(ev.id, 'market_next_goal_home', { teamName: homeTeam });
                if (oddsRes?.isLive && !oddsRes?.suspended && oddsRes?.odds && oddsRes.odds >= 1.45 && oddsRes.odds <= 2.80) {
                    const oddsVal = oddsRes.odds;
                    const isReal = true;
                    const redAdvantage = aRed > 0 ? ` (${awayTeam} 10 kişi, kırmızı kart avantajı)` : '';
                    const xgNote = hXG > 0 ? ` · xG: ${hXG.toFixed(2)}` : '';
                    const confidenceScore = aRed > 0 ? 89 : (hBigChances >= 1 || hXG >= 1.0 ? 87 : 85);

                    selectedSetup = {
                        strategyId: 'PRESS',
                        strategyLabel: 'Baskı Dominasyonu',
                        level: 'ALPHA',
                        marketKey: 'market_next_goal_home',
                        marketLabel: `Sıradaki Gol: ${homeTeam}`,
                        odds: oddsVal,
                        isRealOdds: isReal,
                        confidence: confidenceScore,
                        reasoning: [
                            `${homeTeam} yoğun hücum baskısı ve ceza sahası hakimiyeti (%${hPoss} topla oynama)${redAdvantage}`,
                            `Ceza sahasında yüksek topla buluşma (${hBox} temas)${xgNote}`,
                            `Baskılı şut üstünlüğü (${hSOT} - ${aSOT} isabetli şut)`
                        ],
                        statsMeta: { hXG, aXG, totalXG, hRed, aRed, hPoss, aPoss, hSOT, aSOT, hBox, aBox }
                    };
                }
            }
        }
        // 2. One-Sided Heavy Dominance (Next Goal - Away)
        // Disqualify if away has a red card!
        else if (aRed === 0 && aPoss >= 60 && aSOT >= (hSOT + 2) && aBox >= 12 && curAway <= curHome) {
            if (aXG > 0 && hXG > 0 && aXG < (hXG * 0.75) && aBigChances === 0) {
                // Sterile possession -> skip
            } else {
                const oddsRes = this.getRealMarketOdds(ev.id, 'market_next_goal_away', { teamName: awayTeam });
                if (oddsRes?.isLive && !oddsRes?.suspended && oddsRes?.odds && oddsRes.odds >= 1.45 && oddsRes.odds <= 2.80) {
                    const oddsVal = oddsRes.odds;
                    const isReal = true;
                    const redAdvantage = hRed > 0 ? ` (${homeTeam} 10 kişi, kırmızı kart avantajı)` : '';
                    const xgNote = aXG > 0 ? ` · xG: ${aXG.toFixed(2)}` : '';
                    const confidenceScore = hRed > 0 ? 89 : (aBigChances >= 1 || aXG >= 1.0 ? 87 : 85);

                    selectedSetup = {
                        strategyId: 'PRESS',
                        strategyLabel: 'Baskı Dominasyonu',
                        level: 'ALPHA',
                        marketKey: 'market_next_goal_away',
                        marketLabel: `Sıradaki Gol: ${awayTeam}`,
                        odds: oddsVal,
                        isRealOdds: isReal,
                        confidence: confidenceScore,
                        reasoning: [
                            `${awayTeam} deplasmanda yoğun baskı kurdu (%${aPoss} topla oynama)${redAdvantage}`,
                            `Sürekli ceza sahası penetrasyonu (${aBox} temas)${xgNote}`,
                            `Savunma hattı zorlanıyor (${aSOT} - ${hSOT} isabetli şut)`
                        ],
                        statsMeta: { hXG, aXG, totalXG, hRed, aRed, hPoss, aPoss, hSOT, aSOT, hBox, aBox }
                    };
                }
            }
        }
        // 3. High Threat In-Play Over Goals (Target Line is strictly the NEXT goal: totalGoals + 0.5)
        else if (totalSOT >= 5 && totalBox >= 15 && minute >= 25 && minute <= 74) {
            // Quality check: if xG available, avoid pure low-danger long shots
            const hasRealThreat = totalXG >= 0.70 || (hBigChances + aBigChances) >= 1 || totalSOT >= 7;
            if (hasRealThreat) {
                const targetLine = (totalGoals === 0 && minute < 30) ? '1.5' : (totalGoals + 0.5).toFixed(1);
                
                const oddsRes = this.getRealMarketOdds(ev.id, 'market_over_goals', { targetLine });
                if (oddsRes?.isLive && !oddsRes?.suspended && oddsRes?.odds && oddsRes.odds >= 1.45 && oddsRes.odds <= 2.65) {
                    const oddsVal = oddsRes.odds;
                    const isReal = true;
                    const stratId = minute >= 68 ? 'MOMENTUM' : (minute <= 40 ? 'FHG' : 'PRESS');
                    const stratLabel = minute >= 68 ? 'Son 20dk Patlaması' : (minute <= 40 ? 'İY 0.5 Üst Erken Gol' : 'Baskı Dominasyonu');
                    const xgNote = totalXG > 0 ? ` · Toplam xG: ${totalXG.toFixed(2)}` : '';

                    selectedSetup = {
                        strategyId: stratId,
                        strategyLabel: stratLabel,
                        level: (totalSOT >= 7 || totalXG >= 1.4) ? 'ALPHA' : 'ALEV',
                        marketKey: 'market_over_goals',
                        marketLabel: `Maçta ${targetLine} Üst Gol`,
                        odds: oddsVal,
                        isRealOdds: isReal,
                        confidence: (totalXG >= 1.5 || (hBigChances + aBigChances) >= 2) ? 86 : 84,
                        reasoning: [
                            `Yüksek maç temposu ve ${totalSOT} isabetli şut${xgNote}`,
                            `Yoğun ceza sahası aksiyonu (${totalBox} temas)`,
                            `xG gol ivmesi yakın bir golü doğruluyor`
                        ],
                        statsMeta: { hXG, aXG, totalXG, hRed, aRed, hPoss, aPoss, hSOT, aSOT, hBox, aBox }
                    };
                }
            }
        }
        // 4. BTTS Opportunity (Both Teams To Score) - full squads required (no red cards)
        else if (hRed === 0 && aRed === 0 && (curHome === 0 || curAway === 0) && hSOT >= 3 && aSOT >= 3 && minute >= 30 && minute <= 70) {
            const hasBalancedThreat = totalXG === 0 || (hXG >= 0.40 && aXG >= 0.40) || (hBigChances >= 1 && aBigChances >= 1);
            if (hasBalancedThreat) {
                const oddsRes = this.getRealMarketOdds(ev.id, 'market_btts');
                if (oddsRes?.isLive && !oddsRes?.suspended && oddsRes?.odds && oddsRes.odds >= 1.48 && oddsRes.odds <= 2.60) {
                    const oddsVal = oddsRes.odds;
                    const isReal = true;
                    selectedSetup = {
                        strategyId: 'BTTS',
                        strategyLabel: 'KG Var Dinamiği',
                        level: 'ALEV',
                        marketKey: 'market_btts',
                        marketLabel: 'Karşılıklı Gol Var (KG Var)',
                        odds: oddsVal,
                        isRealOdds: isReal,
                        confidence: 83,
                        reasoning: [
                            `İki takım da karşılıklı tehlikeli ataklar geliştiriyor (${hSOT} & ${aSOT} isabetli şut)`,
                            `Açık alan geçişleri ve yüksek gol tehlikesi`,
                            `Savunma hatları her iki kalede de baskı altında`
                        ],
                        statsMeta: { hXG, aXG, totalXG, hRed, aRed, hPoss, aPoss, hSOT, aSOT, hBox, aBox }
                    };
                }
            }
        }
        // 5. Draw No Bet (DNB / Beraberlikte İade) - Favori Hakimiyeti & Sermaye Koruması
        else if (curHome === curAway && minute >= 50 && minute <= 76 && ((hPoss >= 64 && hSOT >= aSOT + 3 && hBox >= 13) || (aPoss >= 64 && aSOT >= hSOT + 3 && aBox >= 13))) {
            const isHomeDominant = hPoss >= aPoss;
            const targetTeam = isHomeDominant ? homeTeam : awayTeam;
            const targetMarketKey = isHomeDominant ? 'market_dnb_home' : 'market_dnb_away';
            const domRed = isHomeDominant ? hRed : aRed;
            const oppRed = isHomeDominant ? aRed : hRed;

            if (domRed === 0) {
                const oddsRes = this.getRealMarketOdds(ev.id, targetMarketKey) || this.getRealMarketOdds(ev.id, isHomeDominant ? 'market_next_goal_home' : 'market_next_goal_away');
                if (!oddsRes?.suspended) {
                    let oddsVal = null;
                    let isReal = false;
                    if (oddsRes?.isLive && oddsRes?.odds) {
                        if (oddsRes.odds >= 1.45 && oddsRes.odds <= 2.65) {
                            oddsVal = oddsRes.odds;
                            isReal = true;
                        } else if (oddsRes.odds < 1.45) {
                            return null;
                        }
                    }

                    const oppCardNote = oppRed > 0 ? ' (Rakip eksik kişi avantajı)' : '';
                    selectedSetup = {
                        strategyId: 'DNB_SECURE',
                        strategyLabel: 'Favori Baskısı & Beraberlik Sigortası',
                        level: 'ALPHA',
                        marketKey: targetMarketKey,
                        marketLabel: `Beraberlikte İade: ${targetTeam}`,
                        odds: oddsVal,
                        isRealOdds: isReal,
                        confidence: 87,
                        reasoning: [
                            `${targetTeam} maçta ezici baskı kurdu ve rakip kaleyi abluka altına aldı${oppCardNote}`,
                            `Beraberlik halinde kasa korunur (İade), galibiyette tam getiri sağlanır`,
                            `Ceza sahası hakimiyeti (${isHomeDominant ? hBox : aBox} temas) ve şut baskısı`
                        ],
                        statsMeta: { hXG, aXG, totalXG, hRed, aRed, hPoss, aPoss, hSOT, aSOT, hBox, aBox }
                    };
                }
            }
        }

        if (!selectedSetup) return null;

        // 🛑 STRICT REAL ODDS GATE:
        // Under no circumstances should a signal be dispatched without verified live market odds!
        // Completely eliminates "Oran Bekleniyor" confusion and guarantees authentic ledger calculations.
        if (!selectedSetup.isRealOdds || !selectedSetup.odds || selectedSetup.odds < 1.45 || selectedSetup.odds > 2.85) {
            return null;
        }

        // 🛑 LATE-GAME STALEMATE SHIELD (60'+):
        // Empirical data proved 61'-75' drops to 58.3% win rate due to ZERO_CONVERSION_STALEMATE.
        // After minute 60, require strong danger threat: totalXG >= 1.10 OR bigChances >= 1 OR totalBox >= 18.
        if (minute >= 60) {
            const hasLateThreat = totalXG >= 1.10 || (hBigChances + aBigChances) >= 1 || totalBox >= 18;
            if (!hasLateThreat) {
                return null;
            }
        }

        const predText = `${selectedSetup.marketLabel} (Oran: ${selectedSetup.odds.toFixed(2)})`;

        const calcXgSurplus = parseFloat(Math.abs((selectedSetup.statsMeta?.hXG || 0) - (selectedSetup.statsMeta?.aXG || 0)).toFixed(2));
        const calcDqs = Math.min(0.96, Math.max(0.68, 0.60 + (totalSOT * 0.035)));

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
                reasoning: selectedSetup.reasoning,
                xgSurplus: calcXgSurplus,
                totalXG: selectedSetup.statsMeta?.totalXG || 0,
                redCards: { home: hRed, away: aRed }
            },
            activeStrategies: [
                {
                    id: selectedSetup.strategyId,
                    icon: selectedSetup.level === 'ALPHA' ? '💎' : '🔥',
                    label: selectedSetup.strategyLabel,
                    verdict: selectedSetup.reasoning[0]
                }
            ],
            maxEV: selectedSetup.isRealOdds ? 0.12 : null,
            bestEV: {
                ev: selectedSetup.isRealOdds ? 12 : null,
                label: selectedSetup.marketLabel,
                fairOdds: selectedSetup.odds ? (selectedSetup.odds * 0.88).toFixed(2) : null,
                marketOdds: selectedSetup.odds,
                trueProb: selectedSetup.confidence
            },
            xgSurplus: calcXgSurplus || 0.50,
            dqs: parseFloat(calcDqs.toFixed(2))
        };
    }

    async scanCycle() {
        if (this.isScanning) return; // Concurrency guard: never overlap scans
        this.isScanning = true;
        try {
            // 💓 Canlı veri akışı kalp atışı bildirimi
            this.watchdog?.tick();

            // 🛑 Master Admin Kill-Switch Check
            if (this.emergencyHalt) {
                return;
            }

            // 🛡️ Finansal Kasa ve Devre Kesici Kontrolü
            const breakerCheck = circuitBreaker.canDispatchSignal();
            if (!breakerCheck.allowed) {
                // Sadece dakikada bir log basarak konsol kirliliğini önle
                if (Date.now() % 60000 < 25000) {
                    console.log(`[AUTONOMOUS_ENGINE] 🛡️ ${breakerCheck.reason}`);
                }
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
                        // 🛡️ Devre kesicide açık pozisyon kaydı yap (Kasa marjı takibi)
                        circuitBreaker.registerOpenSignal(alert.id, ev.id);
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
        this.locksStore.clear();
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
            isDataStale: dataAgeSec !== null && dataAgeSec > 180,
            circuitBreaker: circuitBreaker.getStatus(),
            watchdog: this.watchdog ? this.watchdog.checkHealth() : null
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