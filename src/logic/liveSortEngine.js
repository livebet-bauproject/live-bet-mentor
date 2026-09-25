/**
 * LIVE SORT ENGINE
 * Real-time dynamic ranking and sorting for in-play football matches.
 * Mimics high-frequency trading & BetBallers dynamic re-ordering.
 */

import { CONFIG } from '../config.js';
import { consensusAdapter } from '../backend/consensusAdapter.js';
import { sofaScoreAdapter } from '../backend/sofaScoreAdapter.js';

export const SORT_CRITERIA = {
    MOMENTUM: 'MOMENTUM',       // Dynamic: High pressure, hot attacks, active momentum bubble to top
    LAST_20_MIN: 'LAST_20_MIN', // Dynamic: High surge and acceleration in the last 20 minutes
    GOAL_PROB: 'GOAL_PROB',     // Dynamic: Bayesian in-play goal probability (Highest % first)
    DQS: 'DQS',                 // AI Conviction & Data Quality Score
    MINUTE_DESC: 'MINUTE_DESC', // Late game first (90' -> 1')
    MINUTE_ASC: 'MINUTE_ASC',   // Early game first (1' -> 90')
    LEAGUE: 'LEAGUE',           // Grouped by League / Tier
    TOTAL_SHOTS: 'TOTAL_SHOTS', // Matches with highest shot volume
    TREND_VOLUME: 'TREND_VOLUME'// High European betting volume / crowd flow
};

/**
 * Parse minute safely from various string/number formats
 */
export const parseNumericMinute = (minute) => {
    if (minute === undefined || minute === null || minute === '') return 0;
    const minStr = String(minute).trim().toLowerCase();
    if (minStr.includes('ht') || minStr.includes('iy')) return 45;
    if (minStr.includes('ft') || minStr.includes('ms')) return 90;
    if (minStr.includes('+')) {
        const parts = minStr.split('+');
        return (parseInt(parts[0], 10) || 0) + (parseInt(parts[1], 10) || 0);
    }
    const num = parseInt(minStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
};

/**
 * Compute real-time Heat / Momentum Rank (0 - 100) for a match.
 * Used for dynamic auto-reordering.
 */
export const calculateMatchHeatScore = (match, signal = null, oppData = null) => {
    if (!match) return 0;

    // Direct opportunity score from liveOpportunityScorer if available
    const rawDirectOpp = oppData?.score ?? match.opportunityData?.score;
    const directOppScore = (typeof rawDirectOpp === 'number' && !isNaN(rawDirectOpp)) ? rawDirectOpp : 0;

    // 1. Direct Pressure / Momentum Score (Max 40 pts)
    let rawPressure = 0;
    if (typeof match.observations?.pressure?.total === 'number' && !isNaN(match.observations.pressure.total)) {
        rawPressure = match.observations.pressure.total;
    } else if (typeof match.observations?.pressure === 'number' && !isNaN(match.observations.pressure)) {
        rawPressure = match.observations.pressure;
    } else if (typeof oppData?.pressure === 'number' && !isNaN(oppData.pressure)) {
        rawPressure = oppData.pressure;
    } else if (typeof match.opportunityData?.pressure === 'number' && !isNaN(match.opportunityData.pressure)) {
        rawPressure = match.opportunityData.pressure;
    } else if (typeof match.pressureIndex === 'number' && !isNaN(match.pressureIndex)) {
        rawPressure = match.pressureIndex;
    } else if (typeof match.stats?.pressure?.current === 'number' && !isNaN(match.stats.pressure.current)) {
        rawPressure = match.stats.pressure.current;
    } else if (match.momentum && typeof match.momentum.current === 'number' && !isNaN(match.momentum.current)) {
        rawPressure = match.momentum.current;
    }
    const safePressure = Math.max(0, Math.min(100, rawPressure));
    let pressureContribution = Math.min(40, (safePressure / 100) * 40);

    // 2. Dangerous Attacks & Shots Dominance (Max 25 pts)
    const sogHome = Number(match.stats?.shotsOnGoal?.home || 0);
    const sogAway = Number(match.stats?.shotsOnGoal?.away || 0);
    const totalSog = sogHome + sogAway;

    const daHome = Number(match.stats?.dangerousAttacks?.home || 0);
    const daAway = Number(match.stats?.dangerousAttacks?.away || 0);
    const totalDa = daHome + daAway;

    // Activity volume
    let attackContribution = Math.min(18, totalSog * 2.0 + Math.min(10, totalDa * 0.25));

    // One-team dominance (Tek kale maç bonusu)
    const daDiff = Math.abs(daHome - daAway);
    if (daDiff >= 18) attackContribution += 7;
    else if (daDiff >= 10) attackContribution += 4;

    // 3. Critical Minute Window (Max 15 pts)
    const minute = parseNumericMinute(match.minute);
    let minuteBonus = 0;
    if (minute >= 68 && minute <= 85) {
        minuteBonus = 15; // Golden live goal window
    } else if (minute >= 48 && minute < 68) {
        minuteBonus = 10; // Second-half push
    } else if (minute >= 35 && minute <= 45) {
        minuteBonus = 8;  // First-half climax
    } else if (minute > 85 && minute <= 95) {
        minuteBonus = 12; // High-tension stoppage time
    }

    // 4. AI Signal & DQS Edge (Max 20 pts)
    const activeSignal = signal || match.signal;
    let aiContribution = 0;
    if (activeSignal && activeSignal.verdict === 'BET') {
        aiContribution = 18;
    } else if (activeSignal && activeSignal.verdict === 'VALUE') {
        aiContribution = 12;
    }

    const dqs = Number(match.dqs || 0);
    if (dqs >= 0.70) aiContribution += 5;
    else if (dqs >= (CONFIG?.DECISION?.DQS_THRESHOLD || 0.60)) aiContribution += 3;

    // 5. Red Card / Numerical Imbalance (Max 5 pts)
    const redHome = Number(match.cards?.home?.red || match.stats?.cards?.home?.red || 0);
    const redAway = Number(match.cards?.away?.red || match.stats?.cards?.away?.red || 0);
    let redBonus = 0;
    if (redHome > 0 || redAway > 0) {
        redBonus = 5;
    }

    const sum = (isNaN(pressureContribution) ? 0 : pressureContribution) +
        (isNaN(attackContribution) ? 0 : attackContribution) +
        (isNaN(minuteBonus) ? 0 : minuteBonus) +
        (isNaN(aiContribution) ? 0 : aiContribution) +
        (isNaN(redBonus) ? 0 : redBonus);

    const calculated = Math.min(100, Math.max(0, Math.round(sum)));
    if (isNaN(calculated) || !isFinite(calculated)) return 0;

    // If liveOpportunityScorer produced a valid score, blend or take the maximum
    if (directOppScore > 0 && !isNaN(directOppScore)) {
        return Math.min(100, Math.max(0, Math.round(Math.max(directOppScore, calculated))));
    }

    return calculated;
};

/**
 * Determines if a match is considered "Hot" (Sıcak Fırsat)
 */
export const isMatchHot = (match, signal = null) => {
    if (!match) return false;
    const sig = signal || match.signal;
    const opp = match.opportunityData;
    const heat = calculateMatchHeatScore(match, sig, opp);

    // 1. If AI has a confirmed BET verdict, it's immediately hot!
    if (sig && sig.verdict === 'BET') return true;

    // 2. If heat score is high
    if (heat >= 40) return true;

    // 3. If opportunity level is ALEV, SICAK, or ALPHA
    if (opp && (opp.heatLevel === 'ALEV' || opp.heatLevel === 'SICAK' || opp.heatLevel === 'ALPHA')) return true;

    // 4. If dangerous attack difference is big
    const daHome = Number(match.stats?.dangerousAttacks?.home || 0);
    const daAway = Number(match.stats?.dangerousAttacks?.away || 0);
    if (Math.abs(daHome - daAway) >= 15 && (daHome + daAway) >= 25) return true;

    return false;
};

/**
 * Calculate metrics and momentum specifically for the last 20 minutes of play.
 * Uses match.minuteHistory (rolling snapshots) and match.graphPoints (SofaScore minute-by-minute momentum),
 * with rate-based fallbacks for newly tracked matches.
 */
export const calculateLast20MinMetrics = (match, signal = null) => {
    if (!match) return {
        surgeScore: 0,
        deltaDA: 0,
        deltaShots: 0,
        deltaCorners: 0,
        isSurging: false,
        source: 'NONE'
    };

    const currentMinute = parseNumericMinute(match.minute);
    const stats = match.stats || {};
    const curSog = (Number(stats.shotsOnGoal?.home) || 0) + (Number(stats.shotsOnGoal?.away) || 0);
    const curTotalShots = (Number(stats.totalShots?.home) || 0) + (Number(stats.totalShots?.away) || 0);
    const curDA = (Number(stats.dangerousAttacks?.home) || 0) + (Number(stats.dangerousAttacks?.away) || 0);
    const curCorners = (Number(stats.corners?.home) || 0) + (Number(stats.corners?.away) || 0);

    let deltaDA = 0;
    let deltaShots = 0;
    let deltaSog = 0;
    let deltaCorners = 0;
    let source = 'ESTIMATE';

    // 1. Try Minute-Sampled History (from dataWorker)
    const history = (Array.isArray(match.minuteHistory) && match.minuteHistory.length > 0)
        ? match.minuteHistory
        : (Array.isArray(match.history) ? match.history : []);

    let historySnapDeltas = null;

    if (history.length > 1) {
        const now = Date.now();
        const targetMs = 20 * 60 * 1000;
        
        // Find snapshot closest to 20 minutes ago
        let bestSnap = null;
        let minDiff = Infinity;
        for (const snap of history) {
            const age = now - snap.timestamp;
            const diff = Math.abs(age - targetMs);
            if (diff < minDiff) {
                minDiff = diff;
                bestSnap = snap;
            }
        }

        if (bestSnap && bestSnap.stats) {
            const snapAgeMin = Math.round((now - bestSnap.timestamp) / 60000);
            // Only use HISTORY snapshot if we have at least 8 minutes of tracked history
            if (snapAgeMin >= 8) {
                const curDAHome = Number(stats.dangerousAttacks?.home) || 0;
                const curDAAway = Number(stats.dangerousAttacks?.away) || 0;
                const curSogHome = Number(stats.shotsOnGoal?.home) || 0;
                const curSogAway = Number(stats.shotsOnGoal?.away) || 0;

                const oldSogHome = Number(bestSnap.stats.shotsOnGoal?.home) || 0;
                const oldSogAway = Number(bestSnap.stats.shotsOnGoal?.away) || 0;
                const oldDAHome = Number(bestSnap.stats.dangerousAttacks?.home) || 0;
                const oldDAAway = Number(bestSnap.stats.dangerousAttacks?.away) || 0;

                const oldSog = oldSogHome + oldSogAway;
                const oldTotalShots = (Number(bestSnap.stats.totalShots?.home) || 0) + (Number(bestSnap.stats.totalShots?.away) || 0);
                const oldDA = oldDAHome + oldDAAway;
                const oldCorners = (Number(bestSnap.stats.corners?.home) || 0) + (Number(bestSnap.stats.corners?.away) || 0);

                const rawDeltaDA = Math.max(0, curDA - oldDA);
                const rawDeltaSog = Math.max(0, curSog - oldSog);
                const rawDeltaShots = Math.max(0, (curTotalShots || curSog) - (oldTotalShots || oldSog));
                const rawDeltaCorners = Math.max(0, curCorners - oldCorners);

                const scale = snapAgeMin < 20 ? (20 / snapAgeMin) : 1.0;
                deltaDA = Math.round(rawDeltaDA * scale);
                deltaShots = Math.round(rawDeltaShots * scale);
                deltaSog = Math.round(rawDeltaSog * scale);
                deltaCorners = Math.round(rawDeltaCorners * scale);
                source = 'HISTORY';

                historySnapDeltas = {
                    deltaDAHome: Math.max(0, curDAHome - oldDAHome),
                    deltaDAAway: Math.max(0, curDAAway - oldDAAway),
                    deltaSogHome: Math.max(0, curSogHome - oldSogHome),
                    deltaSogAway: Math.max(0, curSogAway - oldSogAway)
                };
            }
        }
    }

    // 2. Try SofaScore minute-by-minute momentum graphPoints
    let graphMomentumActivity = 0;
    const graphPts = (Array.isArray(match.graphPoints) && match.graphPoints.length > 0)
        ? match.graphPoints
        : (sofaScoreAdapter?.getCachedGraph ? sofaScoreAdapter.getCachedGraph(match.id) : null);

    let graphHomeScore = 0;
    let graphAwayScore = 0;
    let hasGraphData = false;

    if (Array.isArray(graphPts) && graphPts.length > 3) {
        const minStart = Math.max(1, currentMinute - 20);
        const last20Points = graphPts.filter(p => p.minute >= minStart && p.minute <= currentMinute);
        const activePts = last20Points.length >= 3 ? last20Points : graphPts.slice(-12);

        if (activePts.length > 0) {
            const totalAbsMomentum = activePts.reduce((acc, p) => acc + Math.abs(p.value || 0), 0);
            graphMomentumActivity = Math.min(100, Math.round(totalAbsMomentum / (activePts.length || 1) * 2));

            graphHomeScore = activePts.reduce((acc, p) => acc + (p.value > 0 ? p.value : 0), 0);
            graphAwayScore = activePts.reduce((acc, p) => acc + (p.value < 0 ? Math.abs(p.value) : 0), 0);
            if (graphHomeScore + graphAwayScore >= 10) {
                hasGraphData = true;
            }
        }
    }

    // 3. Rate-based calculation if history window is not yet deep enough
    if (source === 'ESTIMATE') {
        const minDivisor = Math.max(10, currentMinute);
        const windowRatio = Math.min(1.0, 20 / minDivisor);

        // Extract live pressure robustly
        let pressure = 50;
        if (typeof match.observations?.pressure?.total === 'number' && !isNaN(match.observations.pressure.total)) {
            pressure = match.observations.pressure.total;
        } else if (typeof match.observations?.pressure === 'number' && !isNaN(match.observations.pressure)) {
            pressure = match.observations.pressure;
        } else if (typeof match.opportunityData?.pressure === 'number' && !isNaN(match.opportunityData.pressure)) {
            pressure = match.opportunityData.pressure;
        } else if (typeof match.pressureIndex === 'number' && !isNaN(match.pressureIndex)) {
            pressure = match.pressureIndex;
        } else if (typeof match.stats?.pressure?.current === 'number' && !isNaN(match.stats.pressure.current)) {
            pressure = match.stats.pressure.current;
        } else {
            const calculatedHeat = calculateMatchHeatScore(match, signal);
            if (calculatedHeat > 0) pressure = calculatedHeat;
        }

        const pressureRatio = Math.min(1.4, Math.max(0.7, pressure / 50));
        deltaDA = Math.round(curDA * windowRatio * pressureRatio);
        deltaShots = Math.round((curTotalShots || curSog) * windowRatio * pressureRatio);
        deltaSog = Math.round(curSog * windowRatio * pressureRatio);
        deltaCorners = Math.round(curCorners * windowRatio * pressureRatio);
    }

    // CRITICAL HARD CAP: A 20-minute delta can NEVER exceed total stats of the match
    deltaDA = Math.max(0, Math.min(curDA, deltaDA));
    deltaShots = Math.max(0, Math.min(curTotalShots || curSog, deltaShots));
    deltaSog = Math.max(0, Math.min(curSog, deltaSog));
    deltaCorners = Math.max(0, Math.min(curCorners, deltaCorners));

    // Calculate 0 - 100 Surge Score
    let score = 0;
    score += Math.min(40, (deltaDA / 8) * 40);
    score += Math.min(25, (deltaShots / 2) * 25);
    score += Math.min(10, (deltaCorners / 2) * 10);

    let livePressure = 50;
    if (typeof match.observations?.pressure?.total === 'number' && !isNaN(match.observations.pressure.total)) {
        livePressure = match.observations.pressure.total;
    } else if (typeof match.observations?.pressure === 'number' && !isNaN(match.observations.pressure)) {
        livePressure = match.observations.pressure;
    } else if (typeof match.opportunityData?.pressure === 'number' && !isNaN(match.opportunityData.pressure)) {
        livePressure = match.opportunityData.pressure;
    } else if (typeof match.pressureIndex === 'number' && !isNaN(match.pressureIndex)) {
        livePressure = match.pressureIndex;
    } else if (typeof match.stats?.pressure?.current === 'number' && !isNaN(match.stats.pressure.current)) {
        livePressure = match.stats.pressure.current;
    } else {
        const calculatedHeat = calculateMatchHeatScore(match, signal);
        if (calculatedHeat > 0) livePressure = calculatedHeat;
    }
    score += Math.min(25, (livePressure / 100) * 25);

    if (graphMomentumActivity > 60) {
        score += 8;
    }

    const surgeScore = Math.max(0, Math.min(100, Math.round(score)));

    // Balanced Condition to be considered "Surging":
    // Match in-play (between 15' and 87'), not finished.
    const isLateOrFinished = currentMinute >= 88 || String(match.minute || '').includes('MS') || String(match.minute || '').includes('FT');
    const isSurging = !isLateOrFinished && currentMinute >= 15 && (
        surgeScore >= 45 ||
        (deltaDA >= 5 && deltaShots >= 1) ||
        (livePressure >= 58 && deltaDA >= 4)
    );

    const curDAHome = Number(stats.dangerousAttacks?.home) || 0;
    const curDAAway = Number(stats.dangerousAttacks?.away) || 0;
    const curSogHome = Number(stats.shotsOnGoal?.home) || 0;
    const curSogAway = Number(stats.shotsOnGoal?.away) || 0;

    const homeTeamName = (typeof match.homeTeam === 'object' ? match.homeTeam?.name : match.homeTeam) || 'Ev Sahibi';
    const awayTeamName = (typeof match.awayTeam === 'object' ? match.awayTeam?.name : match.awayTeam) || 'Deplasman';

    let dominantSide = 'BALANCED';

    // 1. PRIORITY 1: SofaScore Attack Momentum Graph wave in the last 20 minutes (Visual ground truth)
    if (hasGraphData) {
        if (graphHomeScore >= graphAwayScore * 1.3 || (graphHomeScore - graphAwayScore >= 15)) {
            dominantSide = 'HOME';
        } else if (graphAwayScore >= graphHomeScore * 1.3 || (graphAwayScore - graphHomeScore >= 15)) {
            dominantSide = 'AWAY';
        }
    }

    // 2. PRIORITY 2: History delta within the last 15-20 min window (What actually happened recently)
    if (dominantSide === 'BALANCED' && historySnapDeltas) {
        const { deltaDAHome, deltaDAAway, deltaSogHome, deltaSogAway } = historySnapDeltas;
        if (deltaDAHome >= deltaDAAway + 2 || (deltaDAHome > deltaDAAway && deltaSogHome >= deltaSogAway)) {
            dominantSide = 'HOME';
        } else if (deltaDAAway >= deltaDAHome + 2 || (deltaDAAway > deltaDAHome && deltaSogAway >= deltaSogHome)) {
            dominantSide = 'AWAY';
        }
    }

    // 3. PRIORITY 3: Recent goal scored within last 12 minutes
    if (dominantSide === 'BALANCED') {
        const incidents = (Array.isArray(match.incidents) && match.incidents.length > 0)
            ? match.incidents
            : (sofaScoreAdapter?.getCachedIncidents ? sofaScoreAdapter.getCachedIncidents(match.id) : null);
        if (Array.isArray(incidents)) {
            const recentGoal = incidents.find(inc => 
                inc.incidentType === 'goal' && 
                (currentMinute - inc.time) <= 12 && 
                (currentMinute - inc.time) >= 0
            );
            if (recentGoal) {
                dominantSide = recentGoal.isHome ? 'HOME' : 'AWAY';
            }
        }
    }

    // 4. PRIORITY 4: Active AI Analyst Signal Target / Prediction
    if (dominantSide === 'BALANCED' && signal) {
        const sigText = `${signal.prediction || ''} ${signal.label || ''} ${signal.reasoning || ''}`.toLowerCase();
        if (homeTeamName && sigText.includes(homeTeamName.toLowerCase())) {
            dominantSide = 'HOME';
        } else if (awayTeamName && sigText.includes(awayTeamName.toLowerCase())) {
            dominantSide = 'AWAY';
        }
    }

    // 5. PRIORITY 5: Observations dominantTeam
    if (dominantSide === 'BALANCED') {
        const obsPressure = match.observations?.pressure;
        if (obsPressure?.dominantTeam === 'HOME' || obsPressure?.dominantTeam === 'AWAY') {
            dominantSide = obsPressure.dominantTeam;
        }
    }

    // CRITICAL: We NEVER fall back to full match cumulative stats (e.g. 1st half stats)
    // to determine who is dominating the last 20 minutes!
    const dominantTeam = dominantSide === 'HOME' ? homeTeamName : (dominantSide === 'AWAY' ? awayTeamName : null);

    // Calculate team-specific deltaDA if known
    let teamDeltaDA = deltaDA;
    if (dominantSide === 'HOME' && historySnapDeltas && historySnapDeltas.deltaDAHome > 0) {
        teamDeltaDA = historySnapDeltas.deltaDAHome;
    } else if (dominantSide === 'AWAY' && historySnapDeltas && historySnapDeltas.deltaDAAway > 0) {
        teamDeltaDA = historySnapDeltas.deltaDAAway;
    }

    return {
        surgeScore,
        deltaDA,
        teamDeltaDA,
        deltaShots,
        deltaSog,
        deltaCorners,
        isSurging,
        dominantSide,
        dominantTeam,
        source
    };
};

/**
 * Determines if a match is surging in the last 20 minutes
 */
export const isMatchSurgingLast20 = (match, signal = null) => {
    if (!match) return false;
    const metrics = calculateLast20MinMetrics(match, signal);
    return metrics.isSurging;
};

/**
 * Determines if a match is a blowout / dead match (Kopmuş / Ölü Maç)
 * Mirrors dataWorker.js deadMatch filter:
 * 65'ten sonra 3+ fark, 75'ten sonra 2+ fark, veya 4+ fark
 */
export const isMatchBlowout = (match) => {
    if (!match) return false;
    const min = parseNumericMinute(match.minute);
    let goalsHome = 0;
    let goalsAway = 0;
    if (typeof match.score === 'object') {
        goalsHome = Number(match.score.home ?? 0);
        goalsAway = Number(match.score.away ?? 0);
    } else {
        const parts = String(match.score || '0-0').split('-');
        goalsHome = parseInt(parts[0], 10) || 0;
        goalsAway = parseInt(parts[1], 10) || 0;
    }
    const goalDiff = Math.abs(goalsHome - goalsAway);
    const totalGoals = goalsHome + goalsAway;
    return (min >= 65 && goalDiff >= 3) || (min >= 75 && goalDiff >= 2) || (totalGoals >= 6 && goalDiff >= 2) || goalDiff >= 4;
};

/**
 * Calculates in-play goal probability using Bayesian posterior or live metrics fallback.
 * Returns decimal probability between 0 and 1 (e.g. 0.605 for 60.5%).
 */
export const calculateGoalProbability = (match, signal = null) => {
    if (!match) return 0;
    const isBlowout = isMatchBlowout(match);

    const bayesian = match.observations?.bayesian;
    if (typeof bayesian?.posterior === 'number' && !isNaN(bayesian.posterior)) {
        if (isBlowout) {
            return Math.min(0.38, bayesian.posterior * 0.55);
        }
        return bayesian.posterior;
    }
    const sig = signal || match.signal;
    const heat = calculateMatchHeatScore(match, sig);
    const heatNorm = Math.min(1, Math.max(0, heat / 100));
    const sogHome = Number(match.stats?.shotsOnGoal?.home || 0);
    const sogAway = Number(match.stats?.shotsOnGoal?.away || 0);
    const daHome = Number(match.stats?.dangerousAttacks?.home || 0);
    const daAway = Number(match.stats?.dangerousAttacks?.away || 0);
    const daDiff = Math.abs(daHome - daAway);
    const xgHome = Number(match.stats?.xg?.home || 0);
    const xgAway = Number(match.stats?.xg?.away || 0);

    let rawPosterior = Math.min(0.92, Math.max(0.12, (
        heatNorm * 0.45 +
        ((xgHome + xgAway) > 0 ? (xgHome + xgAway) * 0.15 : (sogHome + sogAway) * 0.04) +
        (daDiff >= 15 ? 0.12 : 0)
    )));

    if (isBlowout) {
        rawPosterior = Math.min(0.38, rawPosterior * 0.55);
    }

    return rawPosterior;
};

/**
 * Determines if a match has high live goal probability (>= threshold, default 55%)
 */
export const isMatchHighGoalProb = (match, signal = null, threshold = 0.55) => {
    if (!match) return false;
    const minStr = String(match.minute || '').toLowerCase();
    const min = parseNumericMinute(match.minute);
    const isLateOrFinished = min >= 88 || minStr.includes('ms') || minStr.includes('ft');
    if (isLateOrFinished) return false;

    const prob = calculateGoalProbability(match, signal);
    return prob >= threshold;
};

/**
 * Determines if a match has an xG surplus (Geciken Gol)
 * Strong xG or shot dominance not yet rewarded on scoreboard (Prime Value Bet)
 */
export const isMatchXgSurplus = (match, signal = null) => {
    if (!match) return false;
    const min = parseNumericMinute(match.minute);
    const minStr = String(match.minute || '').toLowerCase();
    const isLateOrFinished = min >= 88 || minStr.includes('ms') || minStr.includes('ft');
    if (isLateOrFinished || min < 20) return false;

    let goalsHome = 0;
    let goalsAway = 0;
    if (typeof match.score === 'object') {
        goalsHome = Number(match.score.home ?? 0);
        goalsAway = Number(match.score.away ?? 0);
    } else {
        const parts = String(match.score || '0-0').split('-');
        goalsHome = parseInt(parts[0], 10) || 0;
        goalsAway = parseInt(parts[1], 10) || 0;
    }
    const totalGoals = goalsHome + goalsAway;

    const xgHome = Number(match.stats?.xg?.home || 0);
    const xgAway = Number(match.stats?.xg?.away || 0);
    const totalXg = xgHome + xgAway;

    const sogHome = Number(match.stats?.shotsOnGoal?.home || 0);
    const sogAway = Number(match.stats?.shotsOnGoal?.away || 0);
    const totalSog = sogHome + sogAway;

    const daHome = Number(match.stats?.dangerousAttacks?.home || 0);
    const daAway = Number(match.stats?.dangerousAttacks?.away || 0);

    // 1. High xG with low goals (Classic unrewarded xG)
    if (totalXg > 0) {
        if (totalXg >= 1.05 && totalGoals <= 1) return true;
        if (totalXg >= totalGoals + 0.80 && min >= 30) return true;
        if (xgHome >= 0.85 && goalsHome === 0) return true;
        if (xgAway >= 0.85 && goalsAway === 0) return true;
    }

    // 2. Heavy shot pressure with 0 goals (Fallback when xG not fully available)
    if (totalGoals === 0 && min >= 25 && (totalSog >= 4 || (daHome + daAway >= 32 && totalSog >= 2))) {
        return true;
    }
    if (totalGoals <= 1 && min >= 48 && totalSog >= 6) {
        return true;
    }

    return false;
};

/**
 * Determines if a match is in the prime late-game scoring window (Altın Dakikalar: 68' - 85')
 * Close scoreline, active momentum, maximized in-play goal odds
 */
export const isMatchGoldenMinutes = (match, signal = null) => {
    if (!match) return false;
    const min = parseNumericMinute(match.minute);
    const minStr = String(match.minute || '').toLowerCase();
    const isLateOrFinished = min > 86 || minStr.includes('ms') || minStr.includes('ft');
    if (isLateOrFinished) return false;

    // Must be in 68'-85' window
    if (min < 68 || min > 85) return false;

    let goalsHome = 0;
    let goalsAway = 0;
    if (typeof match.score === 'object') {
        goalsHome = Number(match.score.home ?? 0);
        goalsAway = Number(match.score.away ?? 0);
    } else {
        const parts = String(match.score || '0-0').split('-');
        goalsHome = parseInt(parts[0], 10) || 0;
        goalsAway = parseInt(parts[1], 10) || 0;
    }
    const goalDiff = Math.abs(goalsHome - goalsAway);
    if (goalDiff > 2) return false; // Exclude blowouts

    const heat = calculateMatchHeatScore(match, signal);
    const metrics = calculateLast20MinMetrics(match, signal);
    const prob = calculateGoalProbability(match, signal);

    return heat >= 40 || metrics.isSurging || metrics.deltaDA >= 4 || prob >= 0.45;
};

/**
 * Determines if a trailing team is actively sieging the opponent (Geri Dönüş Radarı)
 */
export const isMatchComeback = (match, signal = null) => {
    if (!match) return false;
    const min = parseNumericMinute(match.minute);
    const minStr = String(match.minute || '').toLowerCase();
    const isLateOrFinished = min >= 88 || minStr.includes('ms') || minStr.includes('ft');
    if (isLateOrFinished || min < 20) return false;

    // VETO 1: Blowout / Dead Match (Kopmuş / Ölü Maç)
    // 75'ten sonra 2+ fark, 65'ten sonra 3+ fark, veya 4+ fark olan maçlarda geri dönüş imkansızdır, takımlar rehavettedir.
    if (isMatchBlowout(match)) return false;

    let goalsHome = 0;
    let goalsAway = 0;
    if (typeof match.score === 'object') {
        goalsHome = Number(match.score.home ?? 0);
        goalsAway = Number(match.score.away ?? 0);
    } else {
        const parts = String(match.score || '0-0').split('-');
        goalsHome = parseInt(parts[0], 10) || 0;
        goalsAway = parseInt(parts[1], 10) || 0;
    }

    const homeTrailing = goalsAway > goalsHome && (goalsAway - goalsHome) <= 2;
    const awayTrailing = goalsHome > goalsAway && (goalsHome - goalsAway) <= 2;
    if (!homeTrailing && !awayTrailing) return false;

    const daHome = Number(match.stats?.dangerousAttacks?.home || 0);
    const daAway = Number(match.stats?.dangerousAttacks?.away || 0);
    const sogHome = Number(match.stats?.shotsOnGoal?.home || 0);
    const sogAway = Number(match.stats?.shotsOnGoal?.away || 0);
    const xgHome = Number(match.stats?.xg?.home || 0);
    const xgAway = Number(match.stats?.xg?.away || 0);

    const metrics = calculateLast20MinMetrics(match, signal);

    // VETO 2: Kuru Momentum Koruması (Dry Momentum Protection)
    // Geride olan takımın maç boyu veya son 20 dakikada gerçek bir hücum tehdidi olmalıdır.
    // Kaleyi bulamayan (isabetli şut <= 1) veya xG yaratamayan takım rakibi abluka altına almış sayılamaz.
    if (homeTrailing) {
        const hasMinThreat = sogHome >= 2 || xgHome >= 0.35 || metrics.deltaShots >= 2;
        if (!hasMinThreat) return false;

        if (metrics.dominantSide === 'HOME' && metrics.isSurging) return true;
        if (daHome >= daAway + 6 && (sogHome >= sogAway || xgHome >= xgAway)) return true;
        if (xgHome >= xgAway + 0.30) return true;
        if (sogHome >= sogAway + 2 && daHome >= daAway) return true;
    } else if (awayTrailing) {
        const hasMinThreat = sogAway >= 2 || xgAway >= 0.35 || metrics.deltaShots >= 2;
        if (!hasMinThreat) return false;

        if (metrics.dominantSide === 'AWAY' && metrics.isSurging) return true;
        if (daAway >= daHome + 6 && (sogAway >= sogHome || xgAway >= xgHome)) return true;
        if (xgAway >= xgHome + 0.30) return true;
        if (sogAway >= sogHome + 2 && daAway >= daHome) return true;
    }

    return false;
};

/**
 * Sorts matches dynamically based on criteria and lock state
 */
export const sortMatches = (matches = [], criteria = SORT_CRITERIA.MOMENTUM, signals = {}, isLocked = false, lockedOrderMap = null, trendingBets = []) => {
    if (!Array.isArray(matches) || matches.length === 0) return [];

    // If user locked sorting, preserve previous position of existing matches
    if (isLocked && lockedOrderMap instanceof Map && lockedOrderMap.size > 0) {
        return [...matches].sort((a, b) => {
            const posA = lockedOrderMap.has(a.id) ? lockedOrderMap.get(a.id) : 99999;
            const posB = lockedOrderMap.has(b.id) ? lockedOrderMap.get(b.id) : 99999;
            return posA - posB;
        });
    }

    const list = matches.map(m => {
        const sig = signals[m.id];
        const heat = calculateMatchHeatScore(m, sig);
        return { match: m, heat };
    });

    const stableFallback = (a, b) => {
        const minA = parseNumericMinute(a.match.minute);
        const minB = parseNumericMinute(b.match.minute);
        if (minB !== minA) return minB - minA;
        return String(b.match.id || '').localeCompare(String(a.match.id || ''));
    };

    switch (criteria) {
        case SORT_CRITERIA.MOMENTUM:
            list.sort((a, b) => {
                // Highest heat score first
                if (b.heat !== a.heat) return b.heat - a.heat;
                // Secondary tie breaker: DQS
                const dqsDiff = (b.match.dqs || 0) - (a.match.dqs || 0);
                if (Math.abs(dqsDiff) >= 0.05) return dqsDiff;
                return stableFallback(a, b);
            });
            break;

        case SORT_CRITERIA.LAST_20_MIN:
            list.sort((a, b) => {
                const metricsA = calculateLast20MinMetrics(a.match, signals[a.match.id]);
                const metricsB = calculateLast20MinMetrics(b.match, signals[b.match.id]);
                if (metricsB.surgeScore !== metricsA.surgeScore) {
                    return metricsB.surgeScore - metricsA.surgeScore;
                }
                if (b.heat !== a.heat) return b.heat - a.heat;
                return stableFallback(a, b);
            });
            break;

        case SORT_CRITERIA.GOAL_PROB:
            list.sort((a, b) => {
                const probA = calculateGoalProbability(a.match, signals[a.match.id]);
                const probB = calculateGoalProbability(b.match, signals[b.match.id]);
                if (probB !== probA) return probB - probA;
                if (b.heat !== a.heat) return b.heat - a.heat;
                return stableFallback(a, b);
            });
            break;

        case SORT_CRITERIA.DQS:
            list.sort((a, b) => {
                const dqsDiff = (b.match.dqs || 0) - (a.match.dqs || 0);
                if (Math.abs(dqsDiff) >= 0.05) return dqsDiff;
                if (b.heat !== a.heat) return b.heat - a.heat;
                return stableFallback(a, b);
            });
            break;

        case SORT_CRITERIA.MINUTE_DESC:
            list.sort((a, b) => {
                const minDiff = parseNumericMinute(b.match.minute) - parseNumericMinute(a.match.minute);
                if (minDiff !== 0) return minDiff;
                return String(b.match.id || '').localeCompare(String(a.match.id || ''));
            });
            break;

        case SORT_CRITERIA.MINUTE_ASC:
            list.sort((a, b) => {
                const minDiff = parseNumericMinute(a.match.minute) - parseNumericMinute(b.match.minute);
                if (minDiff !== 0) return minDiff;
                return String(a.match.id || '').localeCompare(String(b.match.id || ''));
            });
            break;

        case SORT_CRITERIA.LEAGUE:
            list.sort((a, b) => {
                const tierA = a.match.tier || 3;
                const tierB = b.match.tier || 3;
                if (tierA !== tierB) return tierA - tierB;
                const leagueA = (a.match.league || a.match.leagueName || '').toLowerCase();
                const leagueB = (b.match.league || b.match.leagueName || '').toLowerCase();
                const lComp = leagueA.localeCompare(leagueB);
                if (lComp !== 0) return lComp;
                return stableFallback(a, b);
            });
            break;

        case SORT_CRITERIA.TOTAL_SHOTS:
            list.sort((a, b) => {
                const shotsA = (a.match.stats?.shotsOnGoal?.home || 0) + (a.match.stats?.shotsOnGoal?.away || 0);
                const shotsB = (b.match.stats?.shotsOnGoal?.home || 0) + (b.match.stats?.shotsOnGoal?.away || 0);
                if (shotsB !== shotsA) return shotsB - shotsA;
                return stableFallback(a, b);
            });
            break;

        case SORT_CRITERIA.TREND_VOLUME:
            list.sort((a, b) => {
                const countA = (trendingBets || [])
                    .filter(tb => consensusAdapter._isFuzzyMatch(tb.home, tb.away, a.match.homeTeam, a.match.awayTeam) || consensusAdapter._isFuzzyMatch(tb.away, tb.home, a.match.homeTeam, a.match.awayTeam))
                    .reduce((sum, tb) => sum + (tb.count || 0), 0);
                const countB = (trendingBets || [])
                    .filter(tb => consensusAdapter._isFuzzyMatch(tb.home, tb.away, b.match.homeTeam, b.match.awayTeam) || consensusAdapter._isFuzzyMatch(tb.away, tb.home, b.match.homeTeam, b.match.awayTeam))
                    .reduce((sum, tb) => sum + (tb.count || 0), 0);
                if (countB !== countA) return countB - countA;
                if (b.heat !== a.heat) return b.heat - a.heat;
                return stableFallback(a, b);
            });
            break;

        default:
            break;
    }

    return list.map(item => item.match);
};

/**
 * Formats a trending market bet into a clean, human-readable prediction string
 * e.g., "Benfica", "2.5 Üst", "Sıradaki Gol: Milan", "Sıradaki Gol: Yok", "KG Var"
 */
export const formatMarketPrediction = (bet, lang = 'tr') => {
    if (!bet) return '';
    const outcome = (bet.outcome || '').trim();
    const market = (bet.market || '').trim().toLowerCase();
    const marketShort = (bet.marketShort || '').trim().toLowerCase();
    const oLower = outcome.toLowerCase();

    // 1. Next Goal / Sıradaki Gol / Nächstes Tor
    const isNextGoal = marketShort === 'next-point' || market.includes('next') || market.includes('nächste') || market.includes('sıradaki');
    if (isNextGoal) {
        const isNoGoal = oLower === 'draw' || oLower === 'unentschieden' || oLower === 'kein tor' || oLower === 'kein' || oLower === 'none' || oLower === 'x' || oLower === 'no goal' || oLower.includes('kein tor');
        if (isNoGoal) {
            return lang === 'tr' ? 'Sıradaki Gol: Yok' : (lang === 'de' ? 'Nächstes Tor: Keines' : 'Next Goal: None');
        }
        return lang === 'tr' ? `Sıradaki Gol: ${outcome}` : (lang === 'de' ? `Nächstes Tor: ${outcome}` : `Next Goal: ${outcome}`);
    }

    // 2. Rest of Match Over/Under
    const isRest = market.includes('restzeit') || market.includes('rest of the game') || market.includes('rest of game') || market.includes('kalan süre');

    // 3. Over / Über
    const matchOver = outcome.match(/^(?:über|over)\s*(\d+[,.]?\d*)/i);
    if (matchOver) {
        const num = matchOver[1].replace(',', '.');
        if (isRest) return lang === 'tr' ? `Kalan ${num} Üst` : (lang === 'de' ? `Rest ${num} Über` : `Rest ${num} Over`);
        return `${num} ${lang === 'tr' ? 'Üst' : (lang === 'de' ? 'Über' : 'Over')}`;
    }

    // 4. Under / Unter
    const matchUnder = outcome.match(/^(?:unter|under)\s*(\d+[,.]?\d*)/i);
    if (matchUnder) {
        const num = matchUnder[1].replace(',', '.');
        if (isRest) return lang === 'tr' ? `Kalan ${num} Alt` : (lang === 'de' ? `Rest ${num} Unter` : `Rest ${num} Under`);
        return `${num} ${lang === 'tr' ? 'Alt' : (lang === 'de' ? 'Unter' : 'Under')}`;
    }

    // 5. 1X2 & Match Result terms
    if (oLower === 'unentschieden' || oLower === 'draw' || oLower === 'tie' || oLower === 'x') {
        return lang === 'tr' ? 'Beraberlik (X)' : (lang === 'de' ? 'Unentschieden (X)' : 'Draw (X)');
    }
    if (oLower === 'heimsieg' || oLower === 'home') {
        return lang === 'tr' ? 'Ev Sahibi (1)' : (lang === 'de' ? 'Heimsieg (1)' : 'Home (1)');
    }
    if (oLower === 'auswärtssieg' || oLower === 'away') {
        return lang === 'tr' ? 'Deplasman (2)' : (lang === 'de' ? 'Auswärtssieg (2)' : 'Away (2)');
    }
    if (oLower === 'ja' || oLower === 'yes') {
        return lang === 'tr' ? 'KG Var' : (lang === 'de' ? 'Beide treffen: Ja' : 'BTTS Yes');
    }
    if (oLower === 'nein' || oLower === 'no') {
        return lang === 'tr' ? 'KG Yok' : (lang === 'de' ? 'Beide treffen: Nein' : 'BTTS No');
    }

    return outcome;
};

// Backwards compatibility alias
export const formatTipicoPrediction = formatMarketPrediction;

/**
 * Resolves entry score, entry minute, duration text and goals since entry for a trending market bet.
 * @param {object} bet - The trending bet object (from API)
 * @param {object} match - The live match object
 * @param {string} lang - 'tr' | 'en' | 'de'
 */
export const getTrendTimelineInfo = (bet, match, lang = 'tr') => {
    if (!bet) return null;

    // 1. Current Match Score string
    let curHome = 0;
    let curAway = 0;
    if (match?.score && typeof match.score === 'object') {
        curHome = Number(match.score.home ?? 0) || 0;
        curAway = Number(match.score.away ?? 0) || 0;
    } else if (typeof match?.score === 'string') {
        const parts = match.score.split(/[-:]/);
        curHome = Number(parts[0]?.trim()) || 0;
        curAway = Number(parts[1]?.trim()) || 0;
    }
    const currentScoreStr = `${curHome} - ${curAway}`;

    // 2. Parse goals helper
    const parseGoals = (s) => {
        if (!s) return 0;
        if (typeof s === 'object') return (Number(s.home) || 0) + (Number(s.away) || 0);
        const parts = String(s).replace(/\s+/g, '').split(/[-:]/);
        return (parseInt(parts[0], 10) || 0) + (parseInt(parts[1], 10) || 0);
    };

    // 3. Entry / Trigger Score
    const entryScore = bet.firstSeenScore || bet.score || currentScoreStr;
    const initialGoals = parseGoals(entryScore);
    const currentGoals = parseGoals(currentScoreStr);
    const goalsSince = Math.max(0, currentGoals - initialGoals);

    // 4. Duration calculation
    let durMinutes = 0;
    if (typeof bet.durationMinutes === 'number') {
        durMinutes = Math.max(0, bet.durationMinutes);
    } else if (bet.firstSeenAt) {
        durMinutes = Math.max(0, Math.floor((Date.now() - bet.firstSeenAt) / 60000));
    }

    let durationLabel = '';
    if (durMinutes <= 1) {
        durationLabel = lang === 'tr' ? 'Az önce girdi (< 1 dk)' : (lang === 'de' ? 'Gerade (< 1 Min)' : 'Just entered (< 1m)');
    } else {
        durationLabel = lang === 'tr' ? `${durMinutes} dk'dır aktif` : (lang === 'de' ? `seit ${durMinutes} Min aktiv` : `${durMinutes}m active`);
    }

    // 5. Entry minute estimation based on match's current minute
    let entryMinStr = null;
    const rawMin = match?.minute;
    if (rawMin) {
        const rawStr = String(rawMin).trim();
        if (rawStr.includes('İY') || rawStr.includes('HT') || rawStr.toLowerCase().includes('half')) {
            entryMinStr = "İY'";
        } else {
            const stoppage = rawStr.match(/(\d+)\s*\+\s*(\d+)/);
            let curMinNum = null;
            if (stoppage) {
                curMinNum = (parseInt(stoppage[1], 10) || 0) + (parseInt(stoppage[2], 10) || 0);
            } else {
                const numMatch = rawStr.match(/\b([1-9]\d{0,2})\b/);
                if (numMatch) {
                    const parsed = parseInt(numMatch[1], 10);
                    if (parsed > 0 && parsed <= 130) curMinNum = parsed;
                }
            }
            if (curMinNum !== null) {
                const calcMin = Math.max(1, curMinNum - durMinutes);
                entryMinStr = `${calcMin}'`;
            }
        }
    }

    // 6. Check if it's a "Rest of Match" / Kalan Süre bet
    const mStr = `${bet.market || ''} ${bet.marketShort || ''} ${bet.outcome || ''}`.toLowerCase();
    const isRest = mStr.includes('restzeit') || mStr.includes('rest of the game') || mStr.includes('rest of game') || mStr.includes('kalan süre') || mStr.includes('kalan ');

    return {
        entryScore,
        currentScoreStr,
        goalsSince,
        durMinutes,
        durationLabel,
        entryMinStr,
        isRest,
        initialGoals,
        currentGoals,
        isNew: durMinutes <= 3,
        isStale: durMinutes >= 15
    };
};
