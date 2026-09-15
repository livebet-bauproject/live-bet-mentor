/**
 * LIVE OPPORTUNITY SCORER v2.0
 * Enhanced scoring system with live odds integration and dynamic weighting.
 * 
 * Heat Levels:
 * - ALEV (🔥): Score >= 80, strong upward trend + value detected
 * - SICAK (⚡): Score 55-79, positive indicators
 * - SOGUK (❄️): Score < 55, declining or weak
 * 
 * NEW FEATURES:
 * - Live odds value detection (implied probability vs actual)
 * - Time-based dynamic weights (late game = more momentum weight)
 * - Recent momentum (last 5 minutes activity boost)
 * - xG velocity tracking (xG per minute trend)
 * - Enhanced market suggestions with odds context
 */

import { CONFIG } from '../config.js';
import { pressureIndex } from './pressureIndex.js';
import { velocityModule } from './velocityModule.js';
import { xGModule } from './xGModule.js';
import { poissonEngine } from './poissonEngine.js';
import { latencyArbitrageRadar } from './latencyArbitrageRadar.js';

// Dynamic weights based on match minute
const getWeightsForMinute = (minute) => {
    if (minute >= 75) {
        // Late game: Momentum and odds matter most
        return { DQS: 0.10, MOMENTUM: 0.35, PRESSURE: 0.20, XG: 0.10, RISK: 0.05, ODDS: 0.20 };
    }
    if (minute >= 60) {
        // Second half push: Balanced with odds emphasis
        return { DQS: 0.15, MOMENTUM: 0.30, PRESSURE: 0.20, XG: 0.10, RISK: 0.05, ODDS: 0.20 };
    }
    if (minute >= 45) {
        // Early second half: Pressure important
        return { DQS: 0.20, MOMENTUM: 0.25, PRESSURE: 0.25, XG: 0.10, RISK: 0.05, ODDS: 0.15 };
    }
    // First half: DQS and XG more important
    return { DQS: 0.25, MOMENTUM: 0.20, PRESSURE: 0.20, XG: 0.15, RISK: 0.05, ODDS: 0.15 };
};

// Default thresholds
// Default thresholds
const DEFAULT_THRESHOLDS = {
    ALEV_THRESHOLD: 75,
    SICAK_THRESHOLD: 50,
    MIN_MINUTE: 15, // Golden in-play window starts at 15'
    MAX_MINUTE: 80, // Matches at 80+ are in closing/dead zone
    MIN_DQS: 0.35,
    VALUE_THRESHOLD: 0.15, // Required edge for Value
    ALPHA_THRESHOLD: 0.25, // Required edge for Alpha (Extreme Value)
    TRAP_DRIFT_THRESHOLD: 0.10 // If odds rise despite stats
};

class LiveOpportunityScorer {
    constructor() {
        this.previousScores = {};
        this.snapshotHistory = {};
        this.xgHistory = {};        // NEW: Track xG over time for velocity
        this.recentEvents = {};     // NEW: Track recent events for momentum
        this.liveOdds = null;       // NEW: Store live odds
        this.previousOdds = {};     // NEW: Track odds movement
        this.dynamicWeights = null; // AI Self-Learning weights & quarantines
    }

    /**
     * Set dynamic weights & quarantines from the Self-Learning AI Engine
     * @param {Object} weights - Output from /api/learning/weights
     */
    setDynamicWeights(weights) {
        if (weights) {
            this.dynamicWeights = weights;
        }
    }

    /**
     * Set live odds data from OddsPortal
     * @param {Object} oddsData - { matches: [{ homeTeam, awayTeam, odds: { home, draw, away } }] }
     */
    setLiveOdds(oddsData) {
        if (oddsData?.matches) {
            // Store previous odds for movement detection
            if (this.liveOdds?.matches) {
                this.liveOdds.matches.forEach(m => {
                    const key = `${m.homeTeam.toLowerCase()}_${m.awayTeam.toLowerCase()}`;
                    this.previousOdds[key] = { ...m.odds };
                });
            }
            this.liveOdds = oddsData;
        }
    }

    /**
     * Get config values with fallbacks
     */
    getConfig() {
        const liveOppsConfig = CONFIG.MODULAR_SYSTEM?.ADVANCED_ANALYSIS?.LIVE_OPPORTUNITIES || {};
        return {
            thresholds: {
                ALEV_THRESHOLD: liveOppsConfig.ALEV_THRESHOLD || DEFAULT_THRESHOLDS.ALEV_THRESHOLD,
                SICAK_THRESHOLD: liveOppsConfig.SICAK_THRESHOLD || DEFAULT_THRESHOLDS.SICAK_THRESHOLD,
                MIN_MINUTE: liveOppsConfig.MIN_MINUTE || DEFAULT_THRESHOLDS.MIN_MINUTE,
                MAX_MINUTE: liveOppsConfig.MAX_MINUTE || DEFAULT_THRESHOLDS.MAX_MINUTE,
                MIN_DQS: liveOppsConfig.MIN_DQS || DEFAULT_THRESHOLDS.MIN_DQS,
                VALUE_THRESHOLD: liveOppsConfig.VALUE_THRESHOLD || DEFAULT_THRESHOLDS.VALUE_THRESHOLD
            }
        };
    }

    /**
     * Calculate opportunity score for a single match
     */
    calculateOpportunityScore(match, signal = null, windowMinutes = 10) {
        const { thresholds } = this.getConfig();

        if (!match) {
            return this._createEmptyResult();
        }

        // Active signal with robust fallback (never drop match solely for missing external signal)
        const activeSignal = signal || match.signal || {
            verdict: 'OBSERVE',
            observations: match.observations || {}
        };

        // Strict Exclusion 1: Finished or Cancelled matches
        const statusType = (match.status?.type || '').toLowerCase();
        const statusCode = match.status?.code;
        const minStr = (match.minute || '').toString().trim();
        
        if (statusType === 'finished' || statusCode === 100 || minStr === 'MS' || minStr.includes('FT') || minStr.toLowerCase().includes('ended')) {
            return this._createEmptyResult('EXCLUDED_FINISHED');
        }

        // Strict Exclusion 1b: Penalty Shootouts (Match in penalties is NOT active in-play football!)
        const descLower = (match.status?.description || '').toLowerCase();
        const isPenalties = statusCode === 120 || statusCode === 110 ||
            minStr === 'Pen.' || minStr.toLowerCase().includes('pen') || 
            descLower.includes('penalt') || descLower.includes('shootout') || descLower.includes('aet');

        if (isPenalties) {
            return this._createEmptyResult('EXCLUDED_PENALTIES');
        }

        // Halftime Detection: MUST NOT match '1st half' or '2nd half' (active in-play periods)
        const isHalftime = statusCode === 31 || minStr === 'İY' || minStr === 'HT' || 
            minStr.toLowerCase() === 'halftime' || minStr.toLowerCase() === 'half-time' || 
            minStr.toLowerCase().includes('devre') || (minStr.toLowerCase().includes('half') && minStr.toLowerCase().includes('time'));

        // Halftime Activity Evaluation:
        // A match in Halftime is NOT over; it is the prime 15-minute decision window for second-half opportunities.
        let qualifiesForHalftimeAnalysis = true;
        if (isHalftime) {
            const hStats = match.stats || {};
            const totalXg = (Number(hStats.xg?.home) || 0) + (Number(hStats.xg?.away) || 0);
            const totalSog = (Number(hStats.shotsOnGoal?.home) || 0) + (Number(hStats.shotsOnGoal?.away) || 0);
            const totalAttacks = (Number(hStats.dangerousAttacks?.home) || 0) + (Number(hStats.dangerousAttacks?.away) || 0);
            const hasStats = totalXg > 0 || totalSog > 0 || totalAttacks > 0;
            qualifiesForHalftimeAnalysis = !hasStats || (totalXg >= 0.45 || totalSog >= 3 || totalAttacks >= 25 || (match.tier === 1 && (totalSog >= 2 || totalXg >= 0.30)));
        }

        const matchId = match.id;
        const minute = isHalftime ? 45 : this._parseMinute(match.minute, match);

        // Strict Exclusion 2: Outside active in-play window (late game closing/dead zone 80'+ or 90+)
        const maxMin = thresholds.MAX_MINUTE || 80;
        if (minute >= maxMin || minStr.includes('90+')) {
            return this._createEmptyResult('EXCLUDED_MINUTE');
        }

        // Strict Exclusion 3: Self-Learning AI League Quarantine Check
        const leagueName = match.league || match.tournament?.name || match.tournamentName || '';
        if (this.dynamicWeights?.activeQuarantines && leagueName) {
            const isQuarantined = this.dynamicWeights.activeQuarantines.some(q => 
                leagueName.toLowerCase().includes(q.league?.toLowerCase?.() || '') || 
                (q.league && leagueName.toLowerCase().includes(q.league.toLowerCase()))
            );
            if (isQuarantined) {
                return this._createEmptyResult('EXCLUDED_AI_QUARANTINE');
            }
        }

        // Determine if enough stats are available for full analysis (Ready) or pending queue (Radar Active)
        const minMin = thresholds.MIN_MINUTE || 15;
        const isEarlyMinute = !isHalftime && minute < minMin;
        const dqs = match.dqs || 0;
        const totalSog = (match.stats?.shotsOnGoal?.home || 0) + (match.stats?.shotsOnGoal?.away || 0);
        const totalAttacks = (match.stats?.dangerousAttacks?.home || 0) + (match.stats?.dangerousAttacks?.away || 0);

        // Get dynamic weights based on minute
        const weights = getWeightsForMinute(minute);

        // 1. Calculate Component Scores (0-100 scale each)
        const dqsScore = this._calculateDQSScore(dqs);
        
        // 2. Use the Signal's Observation Data
        const obs = activeSignal?.observations || {};
        const pressureData = obs.pressure || pressureIndex.calculate(match.stats, minute, match.score);
        const xgData = obs.xg || xGModule.calculate(match);

        // DATA DENSITY GATEKEEPER (Seçenek A)
        // Detect matches with low statistical coverage (e.g. U21, U23, regional leagues with only bare shots/corners)
        const hasDangerousAttacks = (match.stats?.dangerousAttacks?.home > 0 || match.stats?.dangerousAttacks?.away > 0);
        const hasRealXG = (xgData?.source === 'PRIMARY_DATA') || (match.stats?.xg?.home > 0 || match.stats?.xg?.away > 0);
        const hasMomentumGraph = Array.isArray(match.graphPoints) && match.graphPoints.length > 5;
        const isLowData = !hasDangerousAttacks && !hasRealXG && !hasMomentumGraph;
        
        // A match is ready for full analysis if:
        // - It has passed the initial minute window (>= 15') OR already has significant early output (>= 2 SOG or >= 20 attacks)
        // - If in halftime, meets halftime analysis criteria
        // - Has sufficient DQS and genuine data density
        const hasEarlyMomentum = totalSog >= 2 || totalAttacks >= 20;
        const isStatsReady = (!isEarlyMinute || hasEarlyMomentum) && 
                             qualifiesForHalftimeAnalysis && 
                             !isLowData &&
                             ((dqs >= 0.50) || (totalSog >= 3 && totalAttacks >= 15));
        
        // 3. Dynamic Momentum (Window-based)
        const momentumScore = this._calculateMomentumScore(match, windowMinutes);
        const pressureScore = pressureData.total || 0;
        const xgScore = xgData.surplus?.total > 0.5 ? 95 : (xgData.rate?.perMinute > 0.02 ? 75 : 45);
        
        const riskScore = this._calculateRiskScore(activeSignal);
        const oddsScore = this._calculateOddsScore(match, activeSignal);

        // 4. Synergy Bonus (xG + Pressure Alignment)
        // STRICT: Only award synergy bonus if we have GENUINE xG data, NOT simulated fallback on bare stats!
        let synergyBonus = 0;
        if (hasRealXG && xgData.surplus?.total > 0.3 && pressureScore > 65) {
            synergyBonus = 15; // Stats backed by genuine xG quality
        }

        // 5. Weighted Total
        let totalScore = Math.round(
            dqsScore * weights.DQS +
            momentumScore * weights.MOMENTUM +
            pressureScore * weights.PRESSURE +
            xgScore * weights.XG +
            riskScore * weights.RISK +
            oddsScore * weights.ODDS
        ) + synergyBonus;

        // CRITICAL: Cap score if stats are not ready or if data density is low (Maximum 48 - SOGUK / BEKLEMEDE)
        if (!isStatsReady || isLowData) {
            totalScore = Math.min(48, totalScore);
        }

        // RED CARD PENALTY Implementation (using accurate cards mapping)
        const redCards = match.cards || match.stats?.cards || { home: { red: 0 }, away: { red: 0 } };
        const homeReds = Number(redCards.home?.red ?? redCards.home ?? 0);
        const awayReds = Number(redCards.away?.red ?? redCards.away ?? 0);
        const homePress = pressureData?.home || match.stats?.pressure?.home || 0;
        const awayPress = pressureData?.away || match.stats?.pressure?.away || 0;
        
        // If the dominant team has a red card, apply penalty to total score
        if (homePress > awayPress && homeReds > 0) {
            totalScore -= (20 * homeReds);
        } else if (awayPress > homePress && awayReds > 0) {
            totalScore -= (20 * awayReds);
        }

        // SMART MONEY & ODDS MOVEMENT BONUS / PENALTY
        const oddsMovement = this._detectOddsMovement(match);
        let externalBonus = 0;
        if (oddsMovement.smartMoney?.active) {
            externalBonus += 8; // Smart Money Confirmation Bonus!
        } else if (oddsMovement.isTrap) {
            totalScore -= 15; // Trap penalty
        }

        // MATHEMATICAL +EV & POISSON SIMULATION (v4.0)
        let evAnalysis = null;
        try {
            evAnalysis = poissonEngine.analyzeMatch(match);
            if (evAnalysis?.hasValue && evAnalysis?.bestEV) {
                externalBonus += 6; // Institutional +EV confirmation bonus!
            }
        } catch (e) {
            console.warn('[OpportunityScorer] Error in poissonEngine:', e.message);
        }

        // LATENCY ARBITRAGE RADAR (v4.0)
        let latencyEdge = null;
        try {
            latencyEdge = latencyArbitrageRadar.detectLatencyEdge(match);
            if (latencyEdge) {
                externalBonus += 8; // Critical edge: Slow bookmaker has not adjusted!
            }
        } catch (e) {
            console.warn('[OpportunityScorer] Error in latencyArbitrageRadar:', e.message);
        }

        // Apply external bonuses with capped ceiling (max +15)
        totalScore += Math.min(15, externalBonus);

        // EARLY GAME SANITY CEILING:
        // In early minutes (< 25'), matches without substantial xG (< 0.6) or heavy shots (<= 4 SOG)
        // are still in early exploration and must be capped at 78 (SICAK) rather than shooting to 95-100 ALEV!
        if (minute < 25) {
            const totalSog = (match.stats?.shotsOnGoal?.home || 0) + (match.stats?.shotsOnGoal?.away || 0);
            const totalXg = (match.stats?.xg?.home || 0) + (match.stats?.xg?.away || 0);
            if (totalSog <= 4 && totalXg < 0.6) {
                totalScore = Math.min(78, totalScore);
            }
        }

        // 6. DYNAMIC SELF-LEARNING AI MULTIPLIER (Empirical Bayesian Calibration)
        let aiMultiplier = 1.0;
        if (this.dynamicWeights) {
            // Check league multiplier
            if (leagueName && this.dynamicWeights.leagues) {
                const foundLeagueKey = Object.keys(this.dynamicWeights.leagues).find(l => 
                    leagueName.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(leagueName.toLowerCase())
                );
                if (foundLeagueKey && this.dynamicWeights.leagues[foundLeagueKey]?.multiplier) {
                    aiMultiplier *= this.dynamicWeights.leagues[foundLeagueKey].multiplier;
                }
            }

            // Check market/strategy multiplier
            const stratKey = signal?.type || signal?.strategy;
            if (stratKey && this.dynamicWeights.markets?.[stratKey]?.multiplier) {
                aiMultiplier *= this.dynamicWeights.markets[stratKey].multiplier;
            }

            // Check minute window multiplier
            if (minute && this.dynamicWeights.minuteWindows) {
                let winKey = null;
                if (minute <= 30) winKey = '15-30';
                else if (minute <= 45) winKey = '31-45';
                else if (minute <= 60) winKey = '46-60';
                else if (minute <= 75) winKey = '61-75';
                else winKey = '76-90';

                if (winKey && this.dynamicWeights.minuteWindows[winKey]?.multiplier) {
                    aiMultiplier *= this.dynamicWeights.minuteWindows[winKey].multiplier;
                }
            }

            // Clamp total aiMultiplier between minMultiplier and maxMultiplier circuit breakers
            const minM = this.dynamicWeights.circuitBreakers?.minMultiplier || 0.35;
            const maxM = this.dynamicWeights.circuitBreakers?.maxMultiplier || 1.30;
            aiMultiplier = Math.max(minM, Math.min(maxM, aiMultiplier));
            
            // Apply multiplier
            totalScore = Math.round(totalScore * aiMultiplier);
        }
        
        totalScore = Math.max(0, Math.min(100, totalScore));

        // Calculate baseline score if available for window-based trend
        const baseline = this._getStatsAtWindow(match, windowMinutes);
        let baselineScore = totalScore;
        if (baseline) {
            // Re-calculate what the score WAS at the baseline snapshot
            // This is better than storing the score because logic/weights might have changed
            const baselineMinute = this._parseMinute(baseline.minute);
            const baselineWeights = getWeightsForMinute(baselineMinute > 0 ? baselineMinute : 45);
            const baselineDqsScore = this._calculateDQSScore(baseline.dqs || 0);
            
            // Baseline stats
            const bStats = baseline.stats || {};
            const bPressure = pressureIndex.calculate(bStats, baselineMinute > 0 ? baselineMinute : 45, baseline.score)?.total || 0;
            const bXgData = xGModule.calculate({ stats: bStats, score: baseline.score });
            const bXgScore = bXgData.surplus?.total > 0.5 ? 95 : (bXgData.rate?.perMinute > 0.02 ? 75 : 45);
            
            // Baseline momentum is always 50 (neutral point of origin)
            const bMomentum = 50; 
            
            // Baseline risk/odds are harder to retroactively calculate perfectly, 
            // so we use a safe mid-point or the current ones if we assume they stayed similar
            const bRisk = 70; // Standard OK risk
            const bOdds = 50; // Neutral odds
            
            baselineScore = Math.round(
                baselineDqsScore * baselineWeights.DQS +
                bMomentum * baselineWeights.MOMENTUM +
                bPressure * baselineWeights.PRESSURE +
                bXgScore * baselineWeights.XG +
                bRisk * baselineWeights.RISK +
                bOdds * baselineWeights.ODDS
            );

            // Apply same capping logic to baseline for fair comparison
            const bIsReady = (baseline.dqs || 0) >= 0.6 || (bStats.shotsOnGoal?.home > 0 || bStats.shotsOnGoal?.away > 0);
            if (!bIsReady) baselineScore = Math.min(50, baselineScore);
        }

        // Calculate trend (current vs baseline)
        const trend = this._calculateTrend(matchId, totalScore, baseline ? baselineScore : undefined);

        // Track xG velocity
        this._updateXGHistory(matchId, match.stats?.xg);

        // Determine heat level (includes odds value factor)
        const heatLevel = this._getHeatLevel(totalScore, trend, thresholds, oddsScore);

        // Get odds info for this match
        const oddsInfo = this._getMatchOdds(match);

        // Enhanced market suggestion with odds
        const suggestedMarket = this._suggestMarket(match, activeSignal, totalScore, oddsInfo);

        // Generate enhanced reason
        const reason = this._generateReason(match, activeSignal, heatLevel, momentumScore, pressureScore, oddsScore, oddsInfo);

        // STOP-LOSS & CASH-OUT RADAR DETECTION (v4.0)
        let cashOutWarning = null;
        if (minute >= 68 && minute <= 88) {
            const stats = match.stats || {};
            const cards = match.cards || stats.cards || {};
            const curHome = Number(match.homeScore?.current ?? match.score?.home ?? 0);
            const curAway = Number(match.awayScore?.current ?? match.score?.away ?? 0);

            const daHome = Number(stats.dangerousAttacks?.home ?? 0);
            const daAway = Number(stats.dangerousAttacks?.away ?? 0);
            const dominantSide = daHome >= daAway ? 'home' : 'away';
            const domReds = Number(cards[dominantSide]?.red ?? 0);

            if (domReds > 0) {
                cashOutWarning = {
                    reason: `${dominantSide === 'home' ? match.homeTeam : match.awayTeam} kırmızı kart gördü.`,
                    urgency: 'HIGH'
                };
            } else if (dominantSide === 'home' && curAway > curHome && minute >= 74) {
                cashOutWarning = {
                    reason: `Deplasman öne geçti (${curHome}-${curAway}), baskı dağılıyor.`,
                    urgency: 'HIGH'
                };
            } else if (dominantSide === 'away' && curHome > curAway && minute >= 74) {
                cashOutWarning = {
                    reason: `Ev sahibi öne geçti (${curHome}-${curAway}), deplasman baskısı dağılıyor.`,
                    urgency: 'HIGH'
                };
            } else if (minute >= 78 && (daHome + daAway) < 35 && pressureScore < 45) {
                cashOutWarning = {
                    reason: `Son 15 dakikada maç temposu kilitlendi.`,
                    urgency: 'MEDIUM'
                };
            }
        }

        // Store for next cycle
        this._updateHistory(matchId, totalScore);

        return {
            matchId,
            score: totalScore,
            trend: trend.direction,
            trendDelta: trend.delta,
            heatLevel,
            suggestedMarket,
            reason,
            oddsInfo,
            valueDetected: (oddsScore >= 70) && !isLowData,
            smartMoney: isLowData ? null : (oddsMovement?.smartMoney || null),
            oddsMovement: oddsMovement || null,
            isTrap: oddsMovement?.isTrap || false,
            evAnalysis: isLowData ? null : (evAnalysis || null),
            hasValueEV: isLowData ? false : (evAnalysis?.hasValue || false),
            bestEV: isLowData ? null : (evAnalysis?.bestEV || null),
            latencyEdge: isLowData ? null : (latencyEdge || null),
            hasLatencyEdge: !isLowData && latencyEdge !== null,
            cashOutWarning: cashOutWarning || null,
            aiMultiplier: aiMultiplier !== 1.0 ? Number(aiMultiplier.toFixed(2)) : null,
            isStatsReady: isStatsReady && !isLowData,      // NEW: Flag for UI
            isLowData,
            dataDensity: isLowData ? 'LOW' : 'NORMAL',
            isHalftime: !!isHalftime,
            components: {
                dqs: dqsScore,
                momentum: momentumScore,
                pressure: pressureScore,
                xg: xgScore,
                risk: riskScore,
                odds: oddsScore
            },
            excluded: false,
            minute
        };
    }

    /**
     * Get all live opportunities sorted by score
     */
    getOpportunities(matches, signalsMap, windowMinutes = 10) {
        if (!matches || !Array.isArray(matches)) return [];

        const opportunities = matches
            .map(match => {
                const signal = signalsMap?.[match.id] || match.signal;
                return this.calculateOpportunityScore(match, signal, windowMinutes);
            })
            .filter(opp => !opp.excluded)
            .sort((a, b) => {
                // Primary: Value-detected matches first
                if (a.valueDetected !== b.valueDetected) {
                    return b.valueDetected ? 1 : -1;
                }
                // Secondary: Score descending
                if (b.score !== a.score) return b.score - a.score;
                // Tertiary: Trend (UP > STABLE > DOWN)
                const trendOrder = { UP: 3, STABLE: 2, DOWN: 1 };
                return (trendOrder[b.trend] || 0) - (trendOrder[a.trend] || 0);
            });

        return opportunities;
    }

    // ========== ENHANCED PRIVATE METHODS ==========

    /**
     * Helper to retrieve statistics snapshot from windowMinutes ago
     */
    _getStatsAtWindow(match, windowMinutes) {
        if (!match) return null;

        // 1. Direct from match if minuteHistory exists
        const history = match.minuteHistory || match.history;
        if (history && Array.isArray(history) && history.length > 0) {
            const targetMs = Date.now() - (windowMinutes * 60 * 1000);
            let closest = history[0];
            let minDiff = Math.abs(closest.timestamp - targetMs);

            for (const snap of history) {
                const diff = Math.abs(snap.timestamp - targetMs);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = snap;
                }
            }

            // Accept if within reasonable window (within 3 minutes of target)
            if (minDiff <= 3 * 60 * 1000) {
                return closest;
            }

            // Fallback: return oldest available if at least 1 minute old
            const oldest = history[history.length - 1];
            if (oldest && (Date.now() - oldest.timestamp) >= 60000) {
                return oldest;
            }
        }

        // 2. Query dataWorker singleton
        try {
            if (typeof dataWorker !== 'undefined' && dataWorker?.getStatsAtWindow) {
                return dataWorker.getStatsAtWindow(match.id, windowMinutes);
            }
        } catch (e) {}

        return null;
    }

    _parseMinute(minute, match = null) {
        if (typeof minute === 'number') return minute;
        const minStr = (minute || '').toString().trim();
        
        // Match Finished / Penalties / Sona Erdi -> 999
        if (minStr === 'MS' || minStr.includes('FT') || minStr === 'Pen.' || minStr.toLowerCase().includes('pen') || minStr.toLowerCase().includes('ended') || minStr.toLowerCase().includes('finish')) {
            return 999;
        }
        
        // Halftime / Devre Arası -> -2 (Must NOT match '1st half' or '2nd half')
        if (minStr === 'İY' || minStr === 'HT' || minStr.toLowerCase() === 'halftime' || minStr.toLowerCase() === 'half-time' || minStr.toLowerCase().includes('devre') || (minStr.toLowerCase().includes('half') && minStr.toLowerCase().includes('time'))) {
            return -2;
        }

        // Stoppage time 90+ -> 95
        if (minStr.includes('90+') || minStr === '90+') {
            return 95;
        }

        // Stoppage time 45+ -> 46
        if (minStr.includes('45+') || minStr === '45+') {
            return 46;
        }

        const str = minStr.replace(/[^0-9]/g, '');
        const parsed = parseInt(str);
        if (!isNaN(parsed) && parsed > 0) return parsed;

        // Dynamic fallback: compute from match timestamps
        if (match) {
            const timeObj = match.time || {};
            const statusTime = match.statusTime || {};
            const code = match.status?.code;
            const periodTimestamp = statusTime.timestamp || timeObj.currentPeriodStartTimestamp || match.startTimestamp;
            if (periodTimestamp) {
                const now = Math.floor(Date.now() / 1000);
                const elapsedSec = Math.max(0, now - periodTimestamp);
                const initialSec = statusTime.initial ?? timeObj.initial ?? (code === 7 ? 2700 : 0);
                return Math.floor((initialSec + elapsedSec) / 60);
            }
        }

        return 0;
    }

    _calculateDQSScore(dqs) {
        if (dqs >= 0.95) return 100;
        if (dqs >= 0.85) return 90;
        if (dqs >= 0.75) return 80;
        if (dqs >= 0.65) return 70;
        if (dqs >= 0.55) return 60;
        if (dqs >= 0.45) return 50;
        return Math.round(dqs * 100);
    }

    /**
     * Dynamic Momentum Tracking: Compares current stats vs windowMinutes ago.
     */
    _calculateMomentumScore(match, windowMinutes = 10) {
        // Fetch baseline from N minutes ago
        const baseline = this._getStatsAtWindow(match, windowMinutes);
        
        let stats = match.stats || {};
        let sogNow = (stats.shotsOnGoal?.home || 0) + (stats.shotsOnGoal?.away || 0);
        let daNow = (stats.dangerousAttacks?.home || 0) + (stats.dangerousAttacks?.away || 0);

        if (!baseline) {
            // Fallback: Use per-minute averages if no history
            const minute = Math.max(1, this._parseMinute(match.minute));
            const sogRate = sogNow / minute * 10; // SOG per 10 mins
            return Math.min(100, Math.round(40 + (sogRate * 10)));
        }

        const oldStats = baseline.stats || {};
        const oldTotalGoals = (baseline.score?.home || 0) + (baseline.score?.away || 0);
        const curTotalGoals = (match.score?.home || 0) + (match.score?.away || 0);
        const goalJustScored = curTotalGoals > oldTotalGoals;

        const sogOld = (oldStats.shotsOnGoal?.home || 0) + (oldStats.shotsOnGoal?.away || 0);
        const daOld = (oldStats.dangerousAttacks?.home || 0) + (oldStats.dangerousAttacks?.away || 0);

        let sogDelta = Math.max(0, sogNow - sogOld);
        let daDelta = Math.max(0, daNow - daOld);

        // If a goal just occurred, subtract the goal attempt from delta
        // so the momentum reflects ongoing sustained play, NOT the past goal event
        if (goalJustScored && sogDelta > 0) {
            sogDelta = Math.max(0, sogDelta - (curTotalGoals - oldTotalGoals));
        }

        // Expectation: 1.5 DA per minute is high momentum
        const expectedDA = windowMinutes * 1.5;
        const momentumRatio = daDelta / Math.max(1, expectedDA);
        
        // Base score 50 (neutral) + weighted deltas
        let score = 50 + (momentumRatio * 35) + (sogDelta * 6);

        // If a goal just occurred, apply a post-goal cooling factor (-15 points)
        // because the game is temporarily paused and teams consolidate
        if (goalJustScored) {
            score = Math.max(30, score - 15);
        }
        
        return Math.min(100, Math.round(score));
    }

    /**
     * NEW: Calculate boost based on recent activity (simulated)
     */
    _getRecentActivityBoost(matchId, stats) {
        // Track current stats
        const current = {
            sog: (stats.shotsOnGoal?.home || 0) + (stats.shotsOnGoal?.away || 0),
            da: (stats.dangerousAttacks?.home || 0) + (stats.dangerousAttacks?.away || 0),
            timestamp: Date.now()
        };

        const prev = this.recentEvents[matchId];
        this.recentEvents[matchId] = current;

        if (!prev) return 0;

        // If data updated in last 60 seconds, calculate delta
        const timeDiff = (current.timestamp - prev.timestamp) / 1000;
        if (timeDiff < 5 || timeDiff > 120) return 0;

        const sogDelta = current.sog - prev.sog;
        const daDelta = current.da - prev.da;

        // Recent activity boost (max 20 points)
        return Math.min(20, sogDelta * 10 + daDelta * 2);
    }

    _calculatePressureScore(match, side = 'total') {
        try {
            const pressure = pressureIndex.calculate(match);
            if (pressure) {
                if (side === 'home') return pressure.home || 0;
                if (side === 'away') return pressure.away || 0;
                return pressure.total || 0;
            }
        } catch (e) { }

        const stats = match.stats || {};
        if (side === 'home') return Math.min(100, (stats.dangerousAttacks?.home || 0) * 1.5);
        if (side === 'away') return Math.min(100, (stats.dangerousAttacks?.away || 0) * 1.5);

        const total = (stats.dangerousAttacks?.home || 0) + (stats.dangerousAttacks?.away || 0);
        return Math.min(100, total * 0.8);
    }

    /**
     * ENHANCED: xG with velocity tracking and side support
     */
    _calculateXGScore(match, side = 'total') {
        const stats = match.stats || {};
        const xgHome = stats.xg?.home || 0;
        const xgAway = stats.xg?.away || 0;

        const val = side === 'home' ? xgHome : (side === 'away' ? xgAway : xgHome + xgAway);

        let baseScore;
        if (val === 0) baseScore = 40;
        else if (val < 0.3) baseScore = 35; // Adjusted for side vs total
        else if (val < 0.8) baseScore = 60;
        else if (val < 1.5) baseScore = 80;
        else baseScore = 100;

        // Velocity bonus
        const xgVelocity = this._getXGVelocity(match.id);
        if (xgVelocity > 0.05) baseScore = Math.min(100, baseScore + 10);

        return Math.round(baseScore);
    }

    /**
     * NEW: Track xG changes over time
     */
    _updateXGHistory(matchId, xg) {
        if (!xg) return;

        const totalXG = (xg.home || 0) + (xg.away || 0);

        if (!this.xgHistory[matchId]) {
            this.xgHistory[matchId] = [];
        }

        this.xgHistory[matchId].push({
            xg: totalXG,
            timestamp: Date.now()
        });

        // Keep only last 5 entries
        if (this.xgHistory[matchId].length > 5) {
            this.xgHistory[matchId].shift();
        }
    }

    /**
     * NEW: Calculate xG velocity (xG per minute change)
     */
    _getXGVelocity(matchId) {
        const history = this.xgHistory[matchId];
        if (!history || history.length < 2) return 0;

        const oldest = history[0];
        const newest = history[history.length - 1];

        const xgDiff = newest.xg - oldest.xg;
        const timeDiffMin = (newest.timestamp - oldest.timestamp) / 60000;

        if (timeDiffMin < 1) return 0;

        return xgDiff / timeDiffMin;
    }

    _calculateRiskScore(signal) {
        if (!signal) return 50;

        if (signal.verdict === 'BET') return 85;

        const riskFilters = signal.riskFilters || {};
        const failCount = Object.values(riskFilters).filter(f => f.status === 'FAIL').length;

        if (failCount === 0) return 70;
        if (failCount === 1) return 45;
        return 25;
    }

    /**
     * ALPHA MODEL: Calculate EV-based value score
     * Compares Situation Probability (P_sit) vs Market Implied Probability (P_mkt)
     */
    _calculateOddsScore(match, signal) {
        const oddsInfo = this._getMatchOdds(match);
        if (!oddsInfo) return 50;

        const { thresholds } = this.getConfig();
        const stats = match.stats || {};

        // 1. Get Market Probability (P_mkt)
        const homeOdds = parseFloat(oddsInfo.home) || 0;
        const drawOdds = parseFloat(oddsInfo.draw) || 0;
        const awayOdds = parseFloat(oddsInfo.away) || 0;
        if (homeOdds <= 1 || awayOdds <= 1) return 50;

        const pMktHome = 1 / homeOdds;
        const pMktAway = 1 / awayOdds;

        // 2. Derive Situational Probability (P_sit) from stats (0.0 - 1.0)
        // High weights on Pressure and Momentum
        const pSitHome = (this._calculatePressureScore(match, 'home') * 0.4 +
            this._calculateMomentumScore(match, 'home') * 0.4 +
            this._calculateXGScore(match, 'home') * 0.2) / 100;

        const pSitAway = (this._calculatePressureScore(match, 'away') * 0.4 +
            this._calculateMomentumScore(match, 'away') * 0.4 +
            this._calculateXGScore(match, 'away') * 0.2) / 100;

        // 3. Calculate Expected Value (EV)
        const evHome = (pSitHome * homeOdds) - 1;
        const evAway = (pSitAway * awayOdds) - 1;

        // 4. Trap Detection: Drifting Odds
        const movement = this._detectOddsMovement(match);
        let trapPenalty = 0;
        // If stats are great for home but home odds are rising (drifting)
        if (pSitHome > 0.6 && movement.homeWeight > 0.05) {
            trapPenalty = 30; // High risk of trap
        }

        // 5. Final Score Mapping
        const maxEV = Math.max(evHome, evAway);
        let valueScore = 50;

        if (maxEV > thresholds.ALPHA_THRESHOLD) valueScore = 95;
        else if (maxEV > thresholds.VALUE_THRESHOLD) valueScore = 80;
        else if (maxEV > 0) valueScore = 65;
        else if (maxEV < -0.2) valueScore = 30;

        return Math.max(0, valueScore - trapPenalty);
    }

    /**
     * ENHANCED: Get odds for a specific match using robust fuzzy matching.
     * Handles different naming conventions between OddsPortal and SofaScore.
     */
    _getMatchOdds(match) {
        // 1. Direct event odds from SofaScore (100% exact match, highest accuracy)
        if (match.matchedOdds && match.matchedOdds.home) {
            return match.matchedOdds;
        }
        if (match.odds && match.odds.home) {
            return match.odds;
        }

        if (!this.liveOdds?.matches) return null;

        const normalize = (name) => (name || '')
            .toLowerCase()
            .replace(/\s*(fc|sc|sk|fk|cf|ac|as|us|cd|ad|if|bk|1\.|sv|ts|afc|women|w\.f\.c\.|wfc|ladies|u20|u21|u23|u19|reserves)\s*/gi, ' ')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const getWords = (name) => normalize(name).split(' ').filter(w => w.length >= 2);

        const similarity = (a, b) => {
            const na = normalize(a);
            const nb = normalize(b);
            if (!na || !nb) return 0;
            if (na === nb) return 1.0;

            const wordsA = getWords(a);
            const wordsB = getWords(b);
            if (wordsA.length === 0 || wordsB.length === 0) return 0;

            if (wordsA.length === wordsB.length && wordsA.every(w => wordsB.includes(w))) return 1.0;

            const overlap = wordsA.filter(w => wordsB.some(wb => wb === w || (wb.length >= 4 && w.length >= 4 && (wb.includes(w) || w.includes(wb))))).length;
            return overlap / Math.max(wordsA.length, wordsB.length);
        };

        let bestMatch = null;
        let bestScore = 0;

        for (const o of this.liveOdds.matches) {
            if (!o.odds || !o.homeTeam || !o.awayTeam) continue;
            const homeSim = similarity(match.homeTeam, o.homeTeam);
            const awaySim = similarity(match.awayTeam, o.awayTeam);

            // STRICT: BOTH home and away must independently match!
            // If one team has low similarity (< 0.65), it is NOT the same match!
            if (homeSim < 0.65 || awaySim < 0.65) continue;

            const combined = (homeSim + awaySim) / 2;
            if (combined > bestScore && combined >= 0.70) {
                bestScore = combined;
                bestMatch = o;
            }
        }

        return bestMatch?.odds || null;
    }

    /**
     * NEW: Detect if odds are shortening (sharp) or drifting (trap)
     */
    _detectOddsMovement(match) {
        const currentOdds = this._getMatchOdds(match) || match.odds;
        if (!currentOdds) return { shortening: false, homeWeight: 0, awayWeight: 0, smartMoney: null, isTrap: false };

        const key = `${(match.homeTeam || '').toLowerCase()}_${(match.awayTeam || '').toLowerCase()}`;
        const prevOdds = this.previousOdds[key];

        if (!prevOdds && currentOdds.home && currentOdds.away) {
            this.previousOdds[key] = { ...currentOdds };
            return { shortening: false, homeWeight: 0, awayWeight: 0, smartMoney: null, isTrap: false };
        }

        if (!prevOdds) return { shortening: false, homeWeight: 0, awayWeight: 0, smartMoney: null, isTrap: false };

        const curH = parseFloat(currentOdds.home) || 0;
        const curA = parseFloat(currentOdds.away) || 0;
        const prevH = parseFloat(prevOdds.home) || 0;
        const prevA = parseFloat(prevOdds.away) || 0;

        const homeWeight = curH - prevH;
        const awayWeight = curA - prevA;

        const homeDropPct = prevH > 0 && curH > 0 ? ((prevH - curH) / prevH) * 100 : 0;
        const awayDropPct = prevA > 0 && curA > 0 ? ((prevA - curA) / prevA) * 100 : 0;

        // Check Smart Money vs Trap against on-pitch pressure
        const obs = match.observations || {};
        const pressure = obs.pressure || {};
        const homePressure = pressure.home || 0;
        const awayPressure = pressure.away || 0;

        let smartMoney = null;
        let isTrap = false;
        let isDropping = false;
        let dropPct = 0;
        let initialOdds = 0;
        let currentOddsVal = 0;

        if (homeDropPct >= 8) {
            isDropping = true;
            dropPct = homeDropPct;
            initialOdds = prevH;
            currentOddsVal = curH;
            if (homePressure >= 55) {
                smartMoney = { active: true, team: match.homeTeam, side: 'HOME', dropPct: homeDropPct, initialOdds: prevH, currentOdds: curH };
            } else if (homePressure < 40) {
                isTrap = true;
            }
        } else if (awayDropPct >= 8) {
            isDropping = true;
            dropPct = awayDropPct;
            initialOdds = prevA;
            currentOddsVal = curA;
            if (awayPressure >= 55) {
                smartMoney = { active: true, team: match.awayTeam, side: 'AWAY', dropPct: awayDropPct, initialOdds: prevA, currentOdds: curA };
            } else if (awayPressure < 40) {
                isTrap = true;
            }
        }

        return {
            shortening: homeWeight < 0 || awayWeight < 0,
            drifting: homeWeight > 0.05 || awayWeight > 0.05,
            homeWeight,
            awayWeight,
            homeDropPct,
            awayDropPct,
            isDropping,
            dropPct,
            initialOdds,
            currentOdds: currentOddsVal,
            smartMoney,
            isTrap
        };
    }

    _calculateTrend(matchId, currentScore, baselineScore) {
        // If baselineScore is provided (window-based), use it. 
        // Otherwise, fallback to previous cycle score for direction only.
        const prevCycleScore = this.previousScores[matchId];
        const referenceScore = baselineScore !== undefined ? baselineScore : prevCycleScore;

        if (referenceScore === undefined) {
            return { direction: 'STABLE', delta: 0 };
        }

        const delta = currentScore - referenceScore;
        
        // Direction is based on window delta (or micro-movement between cycles)
        let direction = 'STABLE';
        if (delta >= 2) direction = 'UP';
        else if (delta <= -2) direction = 'DOWN';
        else if (currentScore > (prevCycleScore || currentScore)) direction = 'UP';
        else if (currentScore < (prevCycleScore || currentScore)) direction = 'DOWN';

        return { direction, delta };
    }

    /**
     * ENHANCED: Heat level now considers odds value
     */
    _getHeatLevel(score, trend, thresholds, oddsScore) {
        // ALPHA: Extreme Score + High Value + Positive Trend
        if (score >= 90 && oddsScore >= 80 && trend.direction !== 'DOWN') {
            return 'ALPHA';
        }

        // ALEV: High score + not declining
        if (score >= thresholds.ALEV_THRESHOLD && trend.direction !== 'DOWN') {
            return 'ALEV';
        }

        // Strong value can also push to ALEV
        if (score >= 75 && oddsScore >= 75 && trend.direction === 'UP') {
            return 'ALEV';
        }

        if (score >= thresholds.SICAK_THRESHOLD) {
            return 'SICAK';
        }

        return 'SOGUK';
    }

    /**
     * PREDICTION ENGINE v3.0: Suggests targets based on composite synergy.
     */
    _suggestMarket(match, signal, score, oddsInfo) {
        if (score < 40) return null;

        const stats = match.stats || {};
        const obs = match.observations || {};
        const isHalftime = match.status?.code === 31 || (match.minute || '').toString().includes('İY') || (match.minute || '').toString().toLowerCase().includes('ht');
        const minute = isHalftime ? 45 : this._parseMinute(match.minute);
        const pressure = obs.pressure || match.pressure || stats.pressure || { home: 0, away: 0 };
        const xg = stats.xg || { home: 0, away: 0 };
        const curScore = match.score || { home: 0, away: 0 };
        const curTotalGoals = (curScore.home || 0) + (curScore.away || 0);

        // Check if a goal was scored recently (last 8 minutes)
        const baseline = this._getStatsAtWindow(match, 8);
        const oldTotalGoals = baseline?.score ? ((baseline.score.home || 0) + (baseline.score.away || 0)) : curTotalGoals;
        const goalJustScored = curTotalGoals > oldTotalGoals;

        // If a goal was JUST scored: game is in cooldown/reset mode
        if (goalJustScored) {
            return { marketKey: 'POST_GOAL_COOLDOWN', label: 'Yeni Gol Geldi (Piyasa Dengeleniyor)', confidence: 60 };
        }

        // 1. Multi-factor Dominance Analysis (Possession, Shots, xG, Pressure, Attacks, Corners, Red Cards)
        const redCards = match.cards || match.stats?.cards || {};
        const homeReds = Number(redCards.home?.red ?? redCards.home ?? 0);
        const awayReds = Number(redCards.away?.red ?? redCards.away ?? 0);

        const daHome = Number(stats.dangerousAttacks?.home ?? 0);
        const daAway = Number(stats.dangerousAttacks?.away ?? 0);
        const sogHome = Number(stats.shotsOnGoal?.home ?? 0);
        const sogAway = Number(stats.shotsOnGoal?.away ?? 0);
        const shotsHome = Number(stats.totalShots?.home ?? 0);
        const shotsAway = Number(stats.totalShots?.away ?? 0);
        const cornersHome = Number(stats.corners?.home ?? 0);
        const cornersAway = Number(stats.corners?.away ?? 0);
        const possHome = Number(stats.possession?.home ?? 50);
        const possAway = Number(stats.possession?.away ?? 50);
        const xgHome = Number(xg.home ?? 0);
        const xgAway = Number(xg.away ?? 0);
        const pressHome = Number(pressure.home ?? 0);
        const pressAway = Number(pressure.away ?? 0);

        // Balanced attack points combining all in-play pitch control metrics
        const homeAttackPoints = (daHome * 0.8) + (sogHome * 3.5) + (shotsHome * 1.2) + (cornersHome * 2) + 
                                 (xgHome * 10) + (pressHome * 0.6) + ((possHome - 50) * 1.5) + (awayReds * 25);
        const awayAttackPoints = (daAway * 0.8) + (sogAway * 3.5) + (shotsAway * 1.2) + (cornersAway * 2) + 
                                 (xgAway * 10) + (pressAway * 0.6) + ((possAway - 50) * 1.5) + (homeReds * 25);

        // Sanity guard: A team in severe possession deficit (< 38%) or heavily outshot CANNOT be dominant!
        const isHomeDominant = (possHome >= 38 && (shotsAway === 0 || shotsHome >= shotsAway * 0.65)) && (
            (homeAttackPoints > awayAttackPoints * 1.30 + 10) || 
            (pressHome > pressAway * 1.35 && pressHome >= 30) ||
            (awayReds > homeReds && homeAttackPoints >= awayAttackPoints)
        );

        const isAwayDominant = (possAway >= 38 && (shotsHome === 0 || shotsAway >= shotsHome * 0.65)) && (
            (awayAttackPoints > homeAttackPoints * 1.30 + 10) || 
            (pressAway > pressHome * 1.35 && pressAway >= 30) ||
            (homeReds > awayReds && awayAttackPoints >= homeAttackPoints)
        );

        const curHome = Number(curScore.home ?? 0);
        const curAway = Number(curScore.away ?? 0);
        const goalDiff = curHome - curAway; // > 0: Home leading, < 0: Away leading, 0: Draw
        const targetLine = (curTotalGoals + 0.5).toFixed(1);

        // =========================================================================
        // STRICT FOOTBALL BETTING LOGIC:
        // A trailing team (e.g. Monza losing 1-3) CAN NEVER be "Kazanmaya Yakın"!
        // If a trailing team is dominant, they are fighting for the NEXT GOAL!
        // "Kazanmaya Yakın" is ONLY valid when the team is ALREADY leading,
        // OR in late game (minute >= 75) when the match is tied.
        // =========================================================================

        const parseSanitizedOdds = (val) => {
            if (!val) return null;
            const n = parseFloat(val);
            return (!isNaN(n) && n >= 1.10 && n <= 3.50) ? n : null;
        };

        const liveHomeOdds = parseSanitizedOdds(oddsInfo?.nextGoalHome) || (goalDiff >= 1 ? parseSanitizedOdds(oddsInfo?.home) : null);
        const liveAwayOdds = parseSanitizedOdds(oddsInfo?.nextGoalAway) || (goalDiff <= -1 ? parseSanitizedOdds(oddsInfo?.away) : null);
        const liveOverOdds = parseSanitizedOdds(oddsInfo?.over25 || oddsInfo?.over);

        // SCENARIO 1: LATE GAME (minute >= 75)
        if (minute >= 75) {
            if (isHomeDominant) {
                // Home can ONLY be "Kazanmaya Yakın" if they are leading or drawing!
                if (goalDiff >= 0) {
                    return { marketKey: 'HOME_WIN_NEXT', confidence: 70, team: match.homeTeam, odds: liveHomeOdds };
                } else {
                    // Home is trailing: they are pushing for NEXT GOAL!
                    return { marketKey: 'HOME_NEXT_GOAL', confidence: 65, team: match.homeTeam, odds: liveHomeOdds };
                }
            }
            if (isAwayDominant) {
                // Away can ONLY be "Kazanmaya Yakın" if they are leading or drawing!
                if (goalDiff <= 0) {
                    return { marketKey: 'AWAY_WIN_NEXT', confidence: 70, team: match.awayTeam, odds: liveAwayOdds };
                } else {
                    // Away is trailing: they are pushing for NEXT GOAL!
                    return { marketKey: 'AWAY_NEXT_GOAL', confidence: 65, team: match.awayTeam, odds: liveAwayOdds };
                }
            }
            return { marketKey: 'STABLE_GAME', confidence: 60 };
        }

        // SCENARIO 2: ACTIVE MATCH (< 75') WITH OPPORTUNITY SCORE (score >= 50)
        if (score >= 50) {
            const totalAttackPts = homeAttackPoints + awayAttackPoints;
            const homeDominanceRatio = totalAttackPts > 0 ? (homeAttackPoints / totalAttackPts) : 0.5;
            const awayDominanceRatio = totalAttackPts > 0 ? (awayAttackPoints / totalAttackPts) : 0.5;

            // Realistic confidence: bounded reasonably (60% - 85%), proportional to real dominance
            const homeConfidence = Math.min(85, Math.max(60, Math.round(50 + (homeDominanceRatio * 30) + (score * 0.1))));
            const awayConfidence = Math.min(85, Math.max(60, Math.round(50 + (awayDominanceRatio * 30) + (score * 0.1))));

            // SUB-CASE A: Home is Dominant
            if (isHomeDominant) {
                // If Home is already leading by 1 or more goals:
                if (goalDiff >= 1) {
                    // Late in the match (>= 65'), Home likely to protect/close out win:
                    if (minute >= 65) {
                        return { marketKey: 'HOME_WIN_NEXT', confidence: homeConfidence, team: match.homeTeam, odds: liveHomeOdds };
                    }
                    // Earlier, Next Goal is the sharper in-play prediction:
                    return { marketKey: 'HOME_NEXT_GOAL', confidence: homeConfidence, team: match.homeTeam, odds: liveHomeOdds };
                }
                // Home is DRAWING (0) or TRAILING (<0):
                // Trailing team is pushing for NEXT GOAL! (Never "Kazanmaya Yakın" when trailing!)
                return { marketKey: 'HOME_NEXT_GOAL', confidence: homeConfidence, team: match.homeTeam, odds: liveHomeOdds };
            }

            // SUB-CASE B: Away is Dominant
            if (isAwayDominant) {
                // If Away is already leading by 1 or more goals:
                if (goalDiff <= -1) {
                    if (minute >= 65) {
                        return { marketKey: 'AWAY_WIN_NEXT', confidence: awayConfidence, team: match.awayTeam, odds: liveAwayOdds };
                    }
                    return { marketKey: 'AWAY_NEXT_GOAL', confidence: awayConfidence, team: match.awayTeam, odds: liveAwayOdds };
                }
                // Away is DRAWING (0) or TRAILING (>0, like Monza 1 - 3 Lecce):
                // Trailing team is pushing for NEXT GOAL! (Never "Monza Kazanmaya Yakın" when trailing 1-3!)
                return { marketKey: 'AWAY_NEXT_GOAL', confidence: awayConfidence, team: match.awayTeam, odds: liveAwayOdds };
            }

            // Sanity check: Real open-play matches rarely exceed 6-7 goals. If current goals >= 6, cap or avoid excessive over predictions
            if (curTotalGoals >= 6) {
                return { marketKey: 'STABLE_GAME', confidence: 50 };
            }

            // SUB-CASE C: Neither team dominates, but match has high pace/pressure:
            const totalPressure = pressHome + pressAway;
            if (totalPressure > 90 || (daHome + daAway) > 22) {
                if (curTotalGoals === 0 && minute < 40) {
                    return { marketKey: 'market_fh_over05', confidence: 75, label: 'İlk Yarı 0.5 Üst', odds: liveOverOdds };
                }
                return { 
                    marketKey: 'OVER_NEXT_DYNAMIC', 
                    confidence: 75, 
                    target: targetLine,
                    label: `${targetLine} Üst Bekleniyor`,
                    odds: liveOverOdds
                };
            }

            // Standard fallback when score >= 50
            return { 
                marketKey: 'OVER_NEXT_DYNAMIC', 
                confidence: 65, 
                target: targetLine,
                label: `${targetLine} Üst Bekleniyor`,
                odds: liveOverOdds
            };
        }

        // SCENARIO 3: Low Opportunity Score (< 50)
        return { marketKey: 'STABLE_GAME', confidence: 50 };
    }

    /**
     * ENHANCED: More detailed reason with odds context
     */
    _generateReason(match, signal, heatLevel, momentumScore, pressureScore, oddsScore, oddsInfo) {
        const minute = this._parseMinute(match.minute);
        const parts = [];

        if (heatLevel === 'ALPHA') {
            parts.push({ key: 'reason_alpha_signal' });
        } else if (heatLevel === 'ALEV') {
            parts.push({ key: 'reason_high_activity' });
        }

        if (momentumScore >= 75) {
            parts.push({ key: 'reason_strong_momentum', params: { minute } });
        } else if (momentumScore >= 60) {
            parts.push({ key: 'reason_good_momentum' });
        }

        if (pressureScore >= 75) {
            parts.push({ key: 'reason_high_pressure' });
        }

        if (oddsScore >= 70) {
            parts.push({ key: 'reason_value_detected' });
        }

        if (signal?.verdict === 'BET') {
            parts.push({ key: 'reason_dqs_plus' });
        }

        // xG velocity note
        const xgVelocity = this._getXGVelocity(match.id);
        if (xgVelocity > 0.1) {
            parts.push({ key: 'reason_xg_rising' });
        }

        if (parts.length === 0) {
            parts.push({ key: 'reason_avg_activity' });
        }

        return parts;
    }

    _updateHistory(matchId, score) {
        this.previousScores[matchId] = score;

        if (!this.snapshotHistory[matchId]) {
            this.snapshotHistory[matchId] = [];
        }
        this.snapshotHistory[matchId].push({
            score,
            timestamp: Date.now()
        });

        if (this.snapshotHistory[matchId].length > 10) {
            this.snapshotHistory[matchId].shift();
        }
    }

    _createEmptyResult(reason = 'NO_DATA') {
        return {
            matchId: null,
            score: 0,
            trend: 'STABLE',
            trendDelta: 0,
            heatLevel: 'SOGUK',
            suggestedMarket: null,
            reason: reason,
            oddsInfo: null,
            valueDetected: false,
            components: {},
            excluded: true
        };
    }

    /**
     * Clear history for matches no longer live
     */
    cleanup(activeMatchIds) {
        const activeSet = new Set(activeMatchIds.map(id => id.toString()));

        Object.keys(this.previousScores).forEach(id => {
            if (!activeSet.has(id.toString())) {
                delete this.previousScores[id];
                delete this.snapshotHistory[id];
                delete this.xgHistory[id];
                delete this.recentEvents[id];
            }
        });
    }
}

export const liveOpportunityScorer = new LiveOpportunityScorer();
