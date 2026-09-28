/**
 * BAYESIAN PROBABILITY ENGINE (PRODUCTION)
 * Updates the prior probability of a "Goal Event" based on live multi-source evidence.
 */
import { CONFIG } from '../config';

export class BayesianModel {
    /**
     * @param {number} priorProb - The initial probability (e.g. 0.5)
     * @param {Object} evidence - Evidence object containing momentum, quality, and xG
     */
    refine(priorProb, evidence = {}) {
        if (!CONFIG.MODULAR_SYSTEM.OPTIONAL_MODULES.BAYESIAN_PRICING) return null;

        const {
            edgeScore = 0,
            dqs = 0,
            xgRatio = 0,
            dominantXg = 0,
            pressureTotal = 0,
            isDeadMatch = false,
            isBlowout = false,
            goalDiff = 0,
            minute = 0
        } = evidence;

        // Likelihood Calculation: P(Evidence | Goal) vs P(Evidence | No Goal)
        let likelihood = 0.5;

        // 1. Offensive Threat & Momentum Support (Symmetric: Home or Away)
        if (edgeScore > 1.5 || pressureTotal >= 70) likelihood += 0.15;
        if (dqs >= 0.7) likelihood += 0.05;
        if (xgRatio > 1.2 || dominantXg >= 1.0) likelihood += 0.10;

        // 2. Early-Minute Sample Size Shrinkage (Noise Dampener)
        // In the opening 15 minutes, early isolated shots have high statistical noise and must not blow up probabilities.
        if (minute < 15 && !evidence.isHalftime) {
            const sampleMaturity = Math.max(0.25, minute / 15);
            likelihood = 0.5 + ((likelihood - 0.5) * sampleMaturity);
        }

        // 3. Game-State & Blowout Dampener (Tactical Complacency / Dead Match)
        const isGameDead = isDeadMatch || isBlowout || goalDiff >= 4 || (goalDiff >= 3 && minute >= 40);
        if (isGameDead) {
            likelihood = Math.max(0.20, likelihood - 0.25);
        }

        // P(A|B) = [P(B|A) * P(A)] / P(B)
        // posterior = (likelihood * prior) / ( (likelihood * prior) + ( (1-likelihood) * (1-prior) ) )
        let posterior = (likelihood * priorProb) / ((likelihood * priorProb) + ((1 - likelihood) * (1 - priorProb)));

        // If game is dead/blowout, prevent deceptive high posterior probabilities
        if (isGameDead) {
            posterior = Math.min(0.35, Math.max(0.10, posterior * 0.55));
        }

        // Confidence calculation strictly constrained by sample maturity
        let confidence = 'LOW';
        if (isGameDead || (minute < 10 && !evidence.isHalftime)) {
            confidence = 'LOW'; // Under 10 minutes, sample size is insufficient for reliable high conviction
        } else if (minute < 15 && !evidence.isHalftime) {
            confidence = likelihood >= 0.58 ? 'MEDIUM' : 'LOW';
        } else {
            confidence = likelihood >= 0.65 ? 'HIGH' : (likelihood >= 0.48 ? 'MEDIUM' : 'LOW');
        }

        return {
            prior: priorProb,
            posterior: parseFloat(posterior.toFixed(4)),
            confidence,
            impact: (posterior - priorProb).toFixed(4),
            isDeadMatch: isGameDead
        };
    }
}

export const bayesianModel = new BayesianModel();
