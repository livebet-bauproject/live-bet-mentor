import { CONFIG } from '../config';
import { xGModule } from './xGModule';
import { leagueProfileModule } from './leagueProfileModule';
import { bayesianModel } from './bayesianModel';
import { pressureIndex } from './pressureIndex';
import { velocityModule } from './velocityModule';
import { strategyEngine } from './strategyEngine';

/**
 * MATCH ANALYZER (STRATEGY ENGINE UPGRADE)
 * Focus: Modular signal generation based on specific market criteria.
 */
export const analyzeMatch = (fixture, odds, consensusReport, enabledStrategies = {}) => {
    const { stats, minute, score, history } = fixture;

    // 1. Expert Metrics Calculation (v2.0 - Normalized)
    const pressure = pressureIndex.calculate(stats, minute, score, fixture.cards);
    const velocity = velocityModule.calculate(history || []);
    const xgAnalysis = xGModule.calculate(fixture);
    const leagueProfile = leagueProfileModule.getProfile(fixture.league || fixture.leagueName);

    const observations = {
        xg: xgAnalysis,
        leagueProfile,
        pressure,
        velocity,
        bayesian: null,
        reverseSignal: false
    };

    // 2. Probability & EV Estimation (Core Logic)
    let pSituation = (pressure.total / 100) * 0.4;
    const xgRate = xgAnalysis?.rate?.perMinute || 0;
    pSituation += Math.min(0.3, xgRate * 10);
    pSituation *= (velocity.score || 1.0);
    pSituation = Math.min(0.95, Math.max(0.05, pSituation));

    const bayesianResult = bayesianModel.refine(pSituation, {
        dqs: fixture.dqs || 0,
        xgRatio: (xgAnalysis.home + 0.1) / (xgAnalysis.away + 0.1)
    });
    observations.bayesian = bayesianResult;
    const finalP = bayesianResult?.posterior || pSituation;

    let maxEV = -1;
    if (odds && (odds.home || odds.away)) {
        const evHome = (finalP * (parseFloat(odds.home) || 0)) - 1;
        const evAway = (finalP * (parseFloat(odds.away) || 0)) - 1;
        maxEV = Math.max(evHome, evAway);
    }

    // 3. RUN MODULAR STRATEGY ENGINE
    // We pass the enriched fixture (with observations) to the strategy engine
    const enrichedFixture = { ...fixture, observations, history };
    const activeStrategies = strategyEngine.runAll(enrichedFixture, enabledStrategies);

    // 4. Final Verdict Logic (Strategy-Driven)
    let verdict = 'PASS';
    let reason = 'Strateji Bekleniyor';
    
    const minStr = String(minute || '').trim();
    const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
    const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;

    if (isLateOrFinished) {
        verdict = 'PASS';
        reason = minStr === 'MS' || minStr.includes('FT') ? 'Maç Sona Erdi (MS)' : 'Maç Sonu / Kilitli (88+)';
    } else if (activeStrategies.length > 0) {
        verdict = 'BET';
        // Primary strategy for the main label
        reason = activeStrategies[0].label + (activeStrategies.length > 1 ? ` (+${activeStrategies.length - 1})` : '');
    } else {
        reason = 'Kriterlere Uygun Strateji Bulunamadı';
    }

    return {
        verdict,
        reason,
        activeStrategies,
        maxEV,
        pSituation: finalP,
        observations
    };
};
