/**
 * PRESSURE INDEX MODULE v2.0
 * Calculates a 0-100 intensity score based on offensive stats.
 * 
 * UPGRADE: Per-minute normalization + score-state awareness
 * - Stats are divided by minutes played to get RATES
 * - Early game inflated scores are eliminated
 * - Score differential affects interpretation
 */
export const pressureIndex = {
    calculate(stats, minute, score, cards) {
        // Fallback for missing/null stats
        const s = stats || {
            shotsOnGoal: { home: 0, away: 0 },
            dangerousAttacks: { home: 0, away: 0 },
            corners: { home: 0, away: 0 },
            totalShots: { home: 0, away: 0 },
            possession: { home: 0, away: 0 }
        };

        // Red cards extraction (supports both direct cards object and stats.cards)
        const homeRed = Number(cards?.home?.red ?? s.cards?.home?.red ?? 0);
        const awayRed = Number(cards?.away?.red ?? s.cards?.away?.red ?? 0);

        // Parse minute safely with sample-size smoothing (avoids early game rate spikes)
        const min = Math.max(5, parseInt(minute) || 15);
        const minDivisor = Math.max(20, min);

        // Weights for raw stats (these multiply the per-minute RATE)
        const W_SOG = 200;       // Shots on goal per minute rate × this
        const W_ATTACKS = 20;    // Dangerous attacks per minute rate × this
        const W_CORNERS = 80;    // Corners per minute rate × this
        const W_TOTAL_SHOTS = 40; // Fallback if SOG is missing
        const W_POSSESSION = 0.3; // Possession bonus (if available)

        const getScore = (side) => {
            let score = 0;

            // Per-minute rates (normalized by time elapsed with sample smoothing)
            const sogRate = (s.shotsOnGoal?.[side] || 0) / minDivisor;
            const daRate = (s.dangerousAttacks?.[side] || 0) / minDivisor;
            const cornerRate = (s.corners?.[side] || 0) / minDivisor;

            // Primary metrics (rate-based)
            score += sogRate * W_SOG;
            score += daRate * W_ATTACKS;
            score += cornerRate * W_CORNERS;

            // Secondary fallback (Total shots rate)
            if ((s.shotsOnGoal?.[side] || 0) === 0) {
                const tsRate = (s.totalShots?.[side] || 0) / minDivisor;
                score += tsRate * W_TOTAL_SHOTS;
            }

            // Possession bonus (flat, not rate-based)
            const poss = s.possession?.[side] || 0;
            if (poss > 55) score += (poss - 50) * W_POSSESSION;

            return score;
        };

        const homeScore = getScore('home');
        const awayScore = getScore('away');

        // Score-state modifier: A team that's trailing pushes harder
        let homeModifier = 1.0;
        let awayModifier = 1.0;
        
        if (score) {
            const scoreDiff = (score.home || 0) - (score.away || 0);
            // Trailing team gets slight pressure boost (desperation factor)
            if (scoreDiff < 0) homeModifier = 1.15;  // Home is behind
            if (scoreDiff > 0) awayModifier = 1.15;   // Away is behind
            // Leading by 3+ → pressure stats are misleading (garbage time)
            if (Math.abs(scoreDiff) >= 3) {
                homeModifier *= 0.7;
                awayModifier *= 0.7;
            }
        }

        // RED CARD TACTICAL MODIFIER: Numerical advantage engine
        let redCardAdvantage = 'NONE';
        let homeRedModifier = 1.0;
        let awayRedModifier = 1.0;

        if (awayRed > homeRed) {
            const diff = awayRed - homeRed;
            homeRedModifier = diff === 1 ? 1.35 : 1.65;
            awayRedModifier = diff === 1 ? 0.75 : 0.55;
            redCardAdvantage = 'HOME';
        } else if (homeRed > awayRed) {
            const diff = homeRed - awayRed;
            awayRedModifier = diff === 1 ? 1.35 : 1.65;
            homeRedModifier = diff === 1 ? 0.75 : 0.55;
            redCardAdvantage = 'AWAY';
        } else if (homeRed > 0 && homeRed === awayRed) {
            homeRedModifier = 1.08;
            awayRedModifier = 1.08;
            redCardAdvantage = 'BALANCED_REDS';
        }

        const adjustedHome = homeScore * homeModifier * homeRedModifier;
        const adjustedAway = awayScore * awayModifier * awayRedModifier;

        const dominantTeam = adjustedHome > adjustedAway ? 'HOME' : 
                            (adjustedAway > adjustedHome ? 'AWAY' : 'NONE');

        const normalize = (val) => Math.min(100, Math.round(val));

        // Total Match Pressure: 75% dominant team pressure + 25% overall game tempo
        // Prevents mediocre games from falsely summing up to 100%!
        const dominantVal = Math.max(adjustedHome, adjustedAway);
        const tempoVal = (adjustedHome + adjustedAway) / 2;
        const blendedPressure = Math.round((dominantVal * 0.75) + (tempoVal * 0.25));

        return {
            home: normalize(adjustedHome),
            away: normalize(adjustedAway),
            total: normalize(blendedPressure),
            dominantTeam,
            redCards: {
                home: homeRed,
                away: awayRed,
                advantage: redCardAdvantage,
                homeMultiplier: homeRedModifier,
                awayMultiplier: awayRedModifier
            },
            // Expose rates for downstream modules
            rates: {
                homeSogRate: ((s.shotsOnGoal?.home || 0) / min).toFixed(3),
                awaySogRate: ((s.shotsOnGoal?.away || 0) / min).toFixed(3),
                homeDaRate: ((s.dangerousAttacks?.home || 0) / min).toFixed(3),
                awayDaRate: ((s.dangerousAttacks?.away || 0) / min).toFixed(3)
            }
        };
    }
};
