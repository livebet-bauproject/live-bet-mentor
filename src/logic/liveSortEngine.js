/**
 * LIVE SORT ENGINE
 * Real-time dynamic ranking and sorting for in-play football matches.
 * Mimics high-frequency trading & BetBallers dynamic re-ordering.
 */

import { CONFIG } from '../config.js';
import { consensusAdapter } from '../backend/consensusAdapter.js';

export const SORT_CRITERIA = {
    MOMENTUM: 'MOMENTUM',       // Dynamic: High pressure, hot attacks, active momentum bubble to top
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

    switch (criteria) {
        case SORT_CRITERIA.MOMENTUM:
            list.sort((a, b) => {
                // Highest heat score first
                if (b.heat !== a.heat) return b.heat - a.heat;
                // Secondary tie breaker: DQS
                return (b.match.dqs || 0) - (a.match.dqs || 0);
            });
            break;

        case SORT_CRITERIA.DQS:
            list.sort((a, b) => (b.match.dqs || 0) - (a.match.dqs || 0));
            break;

        case SORT_CRITERIA.MINUTE_DESC:
            list.sort((a, b) => parseNumericMinute(b.match.minute) - parseNumericMinute(a.match.minute));
            break;

        case SORT_CRITERIA.MINUTE_ASC:
            list.sort((a, b) => parseNumericMinute(a.match.minute) - parseNumericMinute(b.match.minute));
            break;

        case SORT_CRITERIA.LEAGUE:
            list.sort((a, b) => {
                const tierA = a.match.tier || 3;
                const tierB = b.match.tier || 3;
                if (tierA !== tierB) return tierA - tierB;
                const leagueA = (a.match.league || a.match.leagueName || '').toLowerCase();
                const leagueB = (b.match.league || b.match.leagueName || '').toLowerCase();
                return leagueA.localeCompare(leagueB);
            });
            break;

        case SORT_CRITERIA.TOTAL_SHOTS:
            list.sort((a, b) => {
                const shotsA = (a.match.stats?.shotsOnGoal?.home || 0) + (a.match.stats?.shotsOnGoal?.away || 0);
                const shotsB = (b.match.stats?.shotsOnGoal?.home || 0) + (b.match.stats?.shotsOnGoal?.away || 0);
                return shotsB - shotsA;
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
                return b.heat - a.heat;
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

    // 1. Next Goal / Sıradaki Gol
    const isNextGoal = marketShort === 'next-point' || market.includes('next') || market.includes('nächste') || market.includes('sıradaki');
    if (isNextGoal) {
        const isNoGoal = oLower === 'draw' || oLower === 'unentschieden' || oLower === 'kein tor' || oLower === 'kein' || oLower === 'none' || oLower === 'x' || oLower === 'no goal' || oLower.includes('kein tor');
        if (isNoGoal) {
            return lang === 'tr' ? 'Sıradaki Gol: Yok' : 'Next Goal: None';
        }
        return lang === 'tr' ? `Sıradaki Gol: ${outcome}` : `Next Goal: ${outcome}`;
    }

    // 2. Rest of Match Over/Under
    const isRest = market.includes('restzeit') || market.includes('rest of the game') || market.includes('rest of game') || market.includes('kalan süre');

    // 3. Over / Über
    const matchOver = outcome.match(/^(?:über|over)\s*(\d+[,.]?\d*)/i);
    if (matchOver) {
        const num = matchOver[1].replace(',', '.');
        if (isRest) return lang === 'tr' ? `Kalan ${num} Üst` : `Rest ${num} Over`;
        return `${num} ${lang === 'tr' ? 'Üst' : 'Over'}`;
    }

    // 4. Under / Unter
    const matchUnder = outcome.match(/^(?:unter|under)\s*(\d+[,.]?\d*)/i);
    if (matchUnder) {
        const num = matchUnder[1].replace(',', '.');
        if (isRest) return lang === 'tr' ? `Kalan ${num} Alt` : `Rest ${num} Under`;
        return `${num} ${lang === 'tr' ? 'Alt' : 'Under'}`;
    }

    // 5. 1X2 & Match Result terms
    if (oLower === 'unentschieden' || oLower === 'draw' || oLower === 'tie' || oLower === 'x') {
        return lang === 'tr' ? 'Beraberlik (X)' : 'Draw (X)';
    }
    if (oLower === 'heimsieg' || oLower === 'home') {
        return lang === 'tr' ? 'Ev Sahibi (1)' : 'Home (1)';
    }
    if (oLower === 'auswärtssieg' || oLower === 'away') {
        return lang === 'tr' ? 'Deplasman (2)' : 'Away (2)';
    }
    if (oLower === 'ja' || oLower === 'yes') {
        return lang === 'tr' ? 'KG Var' : 'BTTS Yes';
    }
    if (oLower === 'nein' || oLower === 'no') {
        return lang === 'tr' ? 'KG Yok' : 'BTTS No';
    }

    return outcome;
};

// Backwards compatibility alias
export const formatTipicoPrediction = formatMarketPrediction;
