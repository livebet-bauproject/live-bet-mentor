/**
 * xG MODULE v2.0 (Expected Goals + Surplus Analysis)
 * 
 * UPGRADE: xG Surplus = xG_total - actual_goals
 * This is the #1 predictor for "next goal probability" in professional models.
 * 
 * - Surplus > 0.8  → "Goals are coming, just haven't gone in yet" → STRONG signal
 * - Surplus 0.3-0.8 → "Moderate pressure building" → MEDIUM signal  
 * - Surplus < -0.5  → "More goals than expected" → Goal saturation warning
 */
import { CONFIG } from '../config.js';

export class XGModule {
    calculate(fixture) {
        if (!CONFIG.MODULAR_SYSTEM.OPTIONAL_MODULES.XG_ANALYSIS) return null;

        const { stats, score } = fixture;
        let xgHome = 0;
        let xgAway = 0;
        let source = 'FALLBACK_CALC';

        // If data source already provides xG (like SofaScore), use it
        if (stats?.xg && (stats.xg.home > 0 || stats.xg.away > 0)) {
            xgHome = stats.xg.home || 0;
            xgAway = stats.xg.away || 0;
            source = 'PRIMARY_DATA';
        } else {
            // Grounded fallback xG calculation:
            // Shots and goals are the primary driver of xG (Opta / StatsBomb standard)
            const sogH = Number(stats?.shotsOnGoal?.home || 0);
            const sogA = Number(stats?.shotsOnGoal?.away || 0);
            const tsH = Number(stats?.totalShots?.home || 0);
            const tsA = Number(stats?.totalShots?.away || 0);
            const bcH = Number(stats?.bigChances?.home || 0);
            const bcA = Number(stats?.bigChances?.away || 0);
            const daH = Number(stats?.dangerousAttacks?.home || 0);
            const daA = Number(stats?.dangerousAttacks?.away || 0);

            // If 0 total shots, xG cannot exceed 0.05 unless goal scored
            if (tsH === 0 && sogH === 0) {
                xgHome = (score?.home || 0) > 0 ? Number((score.home * 0.75).toFixed(2)) : 0.02;
            } else {
                xgHome = (sogH * 0.22) + (Math.max(0, tsH - sogH) * 0.04) + (bcH * 0.35) + (daH * 0.001);
                if ((score?.home || 0) > 0) xgHome = Math.max(xgHome, score.home * 0.35);
            }

            if (tsA === 0 && sogA === 0) {
                xgAway = (score?.away || 0) > 0 ? Number((score.away * 0.75).toFixed(2)) : 0.02;
            } else {
                xgAway = (sogA * 0.22) + (Math.max(0, tsA - sogA) * 0.04) + (bcA * 0.35) + (daA * 0.001);
                if ((score?.away || 0) > 0) xgAway = Math.max(xgAway, score.away * 0.35);
            }
        }

        // Tactical Red Card xG Modifier
        const homeRed = Number(fixture.cards?.home?.red ?? stats?.cards?.home?.red ?? 0);
        const awayRed = Number(fixture.cards?.away?.red ?? stats?.cards?.away?.red ?? 0);

        if (awayRed > homeRed) {
            const mult = awayRed - homeRed === 1 ? 1.25 : 1.45;
            xgHome *= mult;
            xgAway *= (awayRed - homeRed === 1 ? 0.80 : 0.65);
        } else if (homeRed > awayRed) {
            const mult = homeRed - awayRed === 1 ? 1.25 : 1.45;
            xgAway *= mult;
            xgHome *= (homeRed - awayRed === 1 ? 0.80 : 0.65);
        }

        const xgTotal = xgHome + xgAway;

        // Actual goals
        const goalsHome = score?.home || 0;
        const goalsAway = score?.away || 0;
        const goalsTotal = goalsHome + goalsAway;

        // === xG SURPLUS: The key metric ===
        // Positive surplus = "goals are due" (team creating but not finishing)
        // Negative surplus = "overperforming" (lucky goals, may not sustain)
        const surplusHome = xgHome - goalsHome;
        const surplusAway = xgAway - goalsAway;
        const surplusTotal = xgTotal - goalsTotal;

        // Surplus classification
        let surplusSignal = 'NEUTRAL';
        if (surplusTotal > 0.8) surplusSignal = 'STRONG_OVERDUE';     // Goals are coming
        else if (surplusTotal > 0.3) surplusSignal = 'MODERATE_OVERDUE'; // Building pressure
        else if (surplusTotal < -0.5) surplusSignal = 'SATURATED';      // Enough goals already
        else if (surplusTotal < -1.0) surplusSignal = 'OVERSATURATED';   // Way too many goals vs xG

        // xG per minute rate (velocity)
        const minute = Math.max(5, parseInt(fixture.minute) || 15);
        const xgRate = xgTotal / minute; // xG generated per minute
        
        // Rate classification
        let xgRateSignal = 'LOW';
        if (xgRate > 0.04) xgRateSignal = 'VERY_HIGH';    // >3.6 xG/90min pace
        else if (xgRate > 0.03) xgRateSignal = 'HIGH';     // >2.7 xG/90min pace
        else if (xgRate > 0.02) xgRateSignal = 'MODERATE';  // >1.8 xG/90min pace

        return {
            home: parseFloat(xgHome.toFixed(2)),
            away: parseFloat(xgAway.toFixed(2)),
            source,
            // NEW: Surplus metrics
            surplus: {
                home: parseFloat(surplusHome.toFixed(2)),
                away: parseFloat(surplusAway.toFixed(2)),
                total: parseFloat(surplusTotal.toFixed(2)),
                signal: surplusSignal
            },
            // NEW: Rate metrics
            rate: {
                perMinute: parseFloat(xgRate.toFixed(4)),
                per90Pace: parseFloat((xgRate * 90).toFixed(2)),
                signal: xgRateSignal
            }
        };
    }
}

export const xGModule = new XGModule();
