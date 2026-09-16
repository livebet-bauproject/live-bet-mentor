/**
 * POISSON & MONTE CARLO GOAL SIMULATION ENGINE (v4.0)
 * 
 * Computes instantaneous dynamic goal expectations (lambda) for the remaining match duration,
 * produces true probabilities for live markets, and calculates mathematical Expected Value (+EV):
 * 
 * EV = (P_true * MarketOdds) - 1
 * If EV >= +7%, an institutional-grade value edge is detected.
 */

export class PoissonEngine {
    constructor() {
        // Base average goals per 90 minutes across global football leagues
        this.BASE_GOAL_EXPECTANCY = 2.70; // 1.45 Home, 1.25 Away typical home advantage
        this.BASE_HOME_LAMBDA = 1.45;
        this.BASE_AWAY_LAMBDA = 1.25;
    }

    /**
     * Factorial helper with memoization
     */
    factorial(n) {
        if (n <= 1) return 1;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }

    /**
     * Standard Poisson probability: P(X = k; lambda)
     */
    poissonProb(k, lambda) {
        if (lambda <= 0) return k === 0 ? 1 : 0;
        return (Math.exp(-lambda) * Math.pow(lambda, k)) / this.factorial(k);
    }

    /**
     * Calculates dynamic remaining-game lambda for home and away
     */
    calculateLiveLambda(match) {
        const minute = Math.min(90, Math.max(1, parseInt(match.minute) || 1));
        const remainingFraction = Math.max(0.02, (90 - minute) / 90);
        
        const stats = match.stats || {};
        const obs = match.observations || {};
        const pressure = obs.pressure || match.pressure || {};
        const xg = stats.xg || obs.xg || {
            home: stats.home?.xG ?? stats.home?.xg ?? 0,
            away: stats.away?.xG ?? stats.away?.xg ?? 0
        };
        const cards = match.cards || stats.cards || match.redCards || {};

        const homeRed = Number(cards.home?.red || cards.homeRed || (typeof cards.home === 'number' ? cards.home : 0));
        const awayRed = Number(cards.away?.red || cards.awayRed || (typeof cards.away === 'number' ? cards.away : 0));

        // 1. Base time-decayed expectation
        let homeLambda = this.BASE_HOME_LAMBDA * remainingFraction;
        let awayLambda = this.BASE_AWAY_LAMBDA * remainingFraction;

        // 2. Tactical Red Card Modifiers
        if (awayRed > homeRed) {
            const diff = awayRed - homeRed;
            homeLambda *= (diff === 1 ? 1.35 : 1.65);
            awayLambda *= (diff === 1 ? 0.70 : 0.45);
        } else if (homeRed > awayRed) {
            const diff = homeRed - awayRed;
            awayLambda *= (diff === 1 ? 1.35 : 1.65);
            homeLambda *= (diff === 1 ? 0.70 : 0.45);
        }

        // 3. Pressure Index Modulation (0-100 scale)
        const homePress = Number(pressure.home || 50);
        const awayPress = Number(pressure.away || 50);

        // Adjust lambda based on pitch territorial dominance
        const homePressModifier = 1 + ((homePress - 50) / 100) * 0.8; // e.g. 80 press -> 1.24x
        const awayPressModifier = 1 + ((awayPress - 50) / 100) * 0.8;

        homeLambda *= Math.max(0.2, homePressModifier);
        awayLambda *= Math.max(0.2, awayPressModifier);

        // 3b. Possession Modulation
        const possHome = Number(stats.possession?.home ?? obs.possession?.home ?? match.possession?.home ?? 50);
        const possAway = Number(stats.possession?.away ?? obs.possession?.away ?? match.possession?.away ?? 50);
        if (possHome > 0 && possAway > 0) {
            const homePossMod = 1 + ((possHome - 50) / 100) * 0.7; // e.g. 77% poss -> 1.189x, 23% poss -> 0.811x
            const awayPossMod = 1 + ((possAway - 50) / 100) * 0.7;
            homeLambda *= Math.max(0.25, homePossMod);
            awayLambda *= Math.max(0.25, awayPossMod);
        }

        // 4. xG Rate Modulation (if xG available)
        const totalXgHome = parseFloat(xg.home) || 0;
        const totalXgAway = parseFloat(xg.away) || 0;

        if (totalXgHome > 0 || totalXgAway > 0) {
            const homeXgRate = totalXgHome / minute; // xG per min
            const awayXgRate = totalXgAway / minute;

            // Average team generates ~0.015 xG per min. Guard: only boost if team has reasonable possession (>= 38%)
            if (homeXgRate > 0.02 && possHome >= 38) homeLambda *= 1.20;
            if (awayXgRate > 0.02 && possAway >= 38) awayLambda *= 1.20;
        }

        // 5. Late game desperation boost (75+ min if goal difference is <= 1)
        const curScore = match.score || { home: 0, away: 0 };
        const scoreDiff = Math.abs((curScore.home || 0) - (curScore.away || 0));
        if (minute >= 75 && scoreDiff <= 1) {
            homeLambda *= 1.15;
            awayLambda *= 1.15;
        }

        return {
            home: parseFloat(homeLambda.toFixed(3)),
            away: parseFloat(awayLambda.toFixed(3)),
            total: parseFloat((homeLambda + awayLambda).toFixed(3)),
            remainingFraction
        };
    }

    /**
     * Computes full probability distribution for remaining and total goals
     */
    calculateProbabilities(match) {
        const lambda = this.calculateLiveLambda(match);
        const minute = parseInt(match.minute) || 1;
        const curScore = match.score || { home: 0, away: 0 };
        const curTotalGoals = (curScore.home || 0) + (curScore.away || 0);

        // Probability of at least one more goal in the match
        const pNoMoreGoals = Math.exp(-lambda.total);
        const pAtLeastOneGoal = 1 - pNoMoreGoals;

        // Next Goal Probabilities (conditional on a goal occurring)
        const pNextGoalHome = lambda.total > 0 ? (lambda.home / lambda.total) * pAtLeastOneGoal : 0;
        const pNextGoalAway = lambda.total > 0 ? (lambda.away / lambda.total) * pAtLeastOneGoal : 0;

        // Over / Under Total Goals and Match Outcome matrix using bivariate Poisson simulation
        let matrix = [];
        for (let h = 0; h <= 5; h++) {
            for (let a = 0; a <= 5; a++) {
                const prob = this.poissonProb(h, lambda.home) * this.poissonProb(a, lambda.away);
                const finalHome = (curScore.home || 0) + h;
                const finalAway = (curScore.away || 0) + a;
                matrix.push({ 
                    remHome: h, 
                    remAway: a, 
                    remTotal: h + a, 
                    finalHome,
                    finalAway,
                    finalTotal: finalHome + finalAway, 
                    prob 
                });
            }
        }

        // True Match Winner Probabilities from live score state
        const pHomeWin = matrix.filter(m => m.finalHome > m.finalAway).reduce((sum, m) => sum + m.prob, 0);
        const pAwayWin = matrix.filter(m => m.finalAway > m.finalHome).reduce((sum, m) => sum + m.prob, 0);
        const pDraw = matrix.filter(m => m.finalHome === m.finalAway).reduce((sum, m) => sum + m.prob, 0);

        // Sum probabilities for standard markets
        const pOver15Total = matrix.filter(m => m.finalTotal >= 2).reduce((sum, m) => sum + m.prob, 0);
        const pOver25Total = matrix.filter(m => m.finalTotal >= 3).reduce((sum, m) => sum + m.prob, 0);
        const pOver35Total = matrix.filter(m => m.finalTotal >= 4).reduce((sum, m) => sum + m.prob, 0);
        const pBTTS = matrix.filter(m => ((curScore.home || 0) + m.remHome >= 1) && ((curScore.away || 0) + m.remAway >= 1)).reduce((sum, m) => sum + m.prob, 0);

        // First Half Over 0.5 (if minute < 45)
        let pOver05FH = null;
        if (minute < 45) {
            const fhRemFraction = Math.max(0.05, (45 - minute) / 45);
            const fhLambda = (lambda.total / Math.max(0.1, lambda.remainingFraction)) * (fhRemFraction * 0.45);
            pOver05FH = 1 - Math.exp(-fhLambda);
        }

        return {
            lambda,
            markets: {
                homeWin: parseFloat(pHomeWin.toFixed(3)),
                awayWin: parseFloat(pAwayWin.toFixed(3)),
                draw: parseFloat(pDraw.toFixed(3)),
                nextGoalHome: parseFloat(pNextGoalHome.toFixed(3)),
                nextGoalAway: parseFloat(pNextGoalAway.toFixed(3)),
                noMoreGoals: parseFloat(pNoMoreGoals.toFixed(3)),
                atLeastOneGoal: parseFloat(pAtLeastOneGoal.toFixed(3)),
                over15: parseFloat(pOver15Total.toFixed(3)),
                over25: parseFloat(pOver25Total.toFixed(3)),
                over35: parseFloat(pOver35Total.toFixed(3)),
                btts: parseFloat(pBTTS.toFixed(3)),
                over05FH: pOver05FH !== null ? parseFloat(pOver05FH.toFixed(3)) : null
            }
        };
    }

    /**
     * Analyzes match and checks for +EV opportunities against live market odds
     */
    analyzeMatch(match) {
        const probResult = this.calculateProbabilities(match);
        const probs = probResult.markets;
        const odds = match.observations?.odds?.current || match.odds || {};
        const curScore = match.score || { home: 0, away: 0 };
        const curHome = Number(curScore.home || 0);
        const curAway = Number(curScore.away || 0);
        const curTotalGoals = curHome + curAway;
        const minute = parseInt(match.minute) || 0;
        const stats = match.stats || {};
        const obs = match.observations || {};

        const evCandidates = [];

        // Helper to check and evaluate market
        const evaluateMarket = (marketId, label, trueProb, marketOdds) => {
            if (!trueProb || !marketOdds || marketOdds <= 1.05) return;
            const fairOdds = parseFloat((1 / trueProb).toFixed(2));
            const ev = parseFloat((((trueProb * marketOdds) - 1) * 100).toFixed(1));

            if (ev >= 5.0) { // Positive EV >= +5%
                evCandidates.push({
                    marketId,
                    label,
                    trueProb: parseFloat((trueProb * 100).toFixed(1)),
                    fairOdds,
                    marketOdds: parseFloat(marketOdds),
                    ev,
                    edge: parseFloat((marketOdds - fairOdds).toFixed(2))
                });
            }
        };

        const shotsHome = Number(stats.totalShots?.home ?? stats.shots?.home ?? obs.shots?.home ?? 0);
        const shotsAway = Number(stats.totalShots?.away ?? stats.shots?.away ?? obs.shots?.away ?? 0);
        const possHome = Number(stats.possession?.home ?? obs.possession?.home ?? 50);
        const possAway = Number(stats.possession?.away ?? obs.possession?.away ?? 50);

        // 1. Full-time Match Winner Odds (1X2) - evaluated strictly against TRUE match win probabilities!
        // (Never compare match odds against next goal probabilities!)
        // Guard: Trailing underdogs with < 38% possession or heavy shot deficit cannot be recommended to win!
        if (odds.homeWin || odds.home) {
            const isHomeDominated = curHome < curAway && (possHome < 38 || (shotsAway > 0 && shotsHome < shotsAway * 0.6));
            if (!isHomeDominated) {
                evaluateMarket('MATCH_HOME', 'Ev Sahibi Kazanır', probs.homeWin, odds.homeWin || odds.home);
            }
        }
        if (odds.awayWin || odds.away) {
            const isAwayDominated = curAway < curHome && (possAway < 38 || (shotsHome > 0 && shotsAway < shotsHome * 0.6));
            if (!isAwayDominated) {
                evaluateMarket('MATCH_AWAY', 'Deplasman Kazanır', probs.awayWin, odds.awayWin || odds.away);
            }
        }

        // 2. Next Goal Specific Markets (ONLY if specific next goal odds are provided and minute < 85)
        // Guard: Heavily dominated teams or late game (85+) cannot be recommended for next goal
        if (minute < 85) {
            if (odds.nextGoalHome) {
                const isHomeDominated = possHome < 38 || (shotsAway > 0 && shotsHome < shotsAway * 0.65);
                if (!isHomeDominated) {
                    evaluateMarket('NEXT_GOAL_HOME', 'Sıradaki Gol Ev', probs.nextGoalHome, odds.nextGoalHome);
                }
            }
            if (odds.nextGoalAway) {
                const isAwayDominated = possAway < 38 || (shotsHome > 0 && shotsAway < shotsHome * 0.65);
                if (!isAwayDominated) {
                    evaluateMarket('NEXT_GOAL_AWAY', 'Sıradaki Gol Dep', probs.nextGoalAway, odds.nextGoalAway);
                }
            }
        }

        // 3. Over / Under Lines - ONLY evaluate if not already settled!
        if ((odds.over25 || odds.over) && curTotalGoals < 3) {
            evaluateMarket('OVER_25', '2.5 Üst', probs.over25, odds.over25 || odds.over);
        }
        if (odds.over15 && curTotalGoals < 2) {
            evaluateMarket('OVER_15', '1.5 Üst', probs.over15, odds.over15);
        }
        if (odds.over35 && curTotalGoals < 4) {
            evaluateMarket('OVER_35', '3.5 Üst', probs.over35, odds.over35);
        }

        // 4. BTTS (KG Var) - ONLY evaluate if both teams have not yet scored!
        if (odds.btts && !(curHome >= 1 && curAway >= 1)) {
            evaluateMarket('BTTS', 'KG Var', probs.btts, odds.btts);
        }

        // 5. First Half Over 0.5 - ONLY before half time and when 0-0!
        if (probs.over05FH && odds.over05FH && minute < 45 && curTotalGoals === 0) {
            evaluateMarket('OVER_05_FH', 'İY 0.5 Üst', probs.over05FH, odds.over05FH);
        }

        // Sort by highest EV descending
        evCandidates.sort((a, b) => b.ev - a.ev);
        const bestEV = evCandidates[0] || null;

        return {
            lambda: probResult.lambda,
            probabilities: probs,
            hasValue: bestEV !== null && bestEV.ev >= 7.0, // +7% institutional value threshold
            bestEV,
            candidates: evCandidates
        };
    }
}

export const poissonEngine = new PoissonEngine();
