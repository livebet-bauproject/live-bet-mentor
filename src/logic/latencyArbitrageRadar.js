/**
 * LATENCY ARBITRAGE & SOFT BOOKMAKER RADAR (v4.0)
 * 
 * Detects fleeting latency windows where sharp market makers (Pinnacle/Asian feeds)
 * have crashed odds due to high pressure, red cards, or dangerous attacks, but soft/local
 * bookmakers have not yet updated their boards.
 * 
 * If (SoftOdds - SharpOdds) / SharpOdds >= 12%, flags a high-priority "⚡ GECİKME ARBİTRAJI"
 * opportunity with an urgency countdown timer.
 */

import { poissonEngine } from './poissonEngine.js';

export class LatencyArbitrageRadar {
    constructor() {
        this.activeAlerts = new Map(); // matchId -> alertDetails
    }

    /**
     * Analyzes match for soft bookmaker delay vs sharp calculated fair odds
     * @param {Object} match Fixture object with stats, odds, observations
     * @returns {Object|null} Latency edge object if detected
     */
    detectLatencyEdge(match) {
        if (!match) return null;

        const odds = match.observations?.odds?.current || match.odds || {};
        const opening = match.observations?.odds?.opening || {};
        const pressure = match.observations?.pressure || match.pressure || {};
        const pressureHome = Number(pressure.home || 0);
        const pressureAway = Number(pressure.away || 0);
        const pressureTotal = Number(pressure.total || (pressureHome + pressureAway));
        const cards = match.cards || match.stats?.cards || match.redCards || {};

        const minute = parseInt(match.minute) || 0;
        if (minute < 10 || minute > 85) return null; // Avoid extreme ends

        const homeRed = Number(cards.home?.red || cards.homeRed || (typeof cards.home === 'number' ? cards.home : 0));
        const awayRed = Number(cards.away?.red || cards.awayRed || (typeof cards.away === 'number' ? cards.away : 0));
        const redAdvantage = (awayRed > homeRed && pressureHome >= 50) ? 'HOME' :
                             (homeRed > awayRed && pressureAway >= 50) ? 'AWAY' : null;

        // Calculate Poisson fair odds based on live pitch dominance
        const probResult = poissonEngine.calculateProbabilities(match);
        const probs = probResult.markets;

        const curScore = match.score || { home: 0, away: 0 };
        const curHome = Number(curScore.home || 0);
        const curAway = Number(curScore.away || 0);
        const goalDiff = curHome - curAway; // > 0: Home leading, < 0: Away leading, 0: Draw

        const homeTeamName = match.homeTeam || match.home?.name || 'Ev Sahibi';
        const awayTeamName = match.awayTeam || match.away?.name || 'Deplasman';

        // Helper: Check Home Edge
        // If odds.nextGoalHome exists, use next goal odds vs next goal fair odds.
        // Otherwise use match win odds vs TRUE match win fair odds!
        const hasHomeNextOdds = Boolean(odds.nextGoalHome);
        const currentHomeOdds = parseFloat(hasHomeNextOdds ? odds.nextGoalHome : (odds.homeWin || odds.home || 0));
        const fairHomeOdds = hasHomeNextOdds 
            ? (probs.nextGoalHome > 0 ? (1 / probs.nextGoalHome) : 99)
            : (probs.homeWin > 0 ? (1 / probs.homeWin) : 99);

        // Helper: Check Away Edge
        const hasAwayNextOdds = Boolean(odds.nextGoalAway);
        const currentAwayOdds = parseFloat(hasAwayNextOdds ? odds.nextGoalAway : (odds.awayWin || odds.away || 0));
        const fairAwayOdds = hasAwayNextOdds
            ? (probs.nextGoalAway > 0 ? (1 / probs.nextGoalAway) : 99)
            : (probs.awayWin > 0 ? (1 / probs.awayWin) : 99);

        // Trigger condition: High pitch intensity + red card or heavy pressure
        const isPitchSurge = pressureTotal >= 70 || redAdvantage !== null || pressureHome >= 65 || pressureAway >= 65;

        if (!isPitchSurge) return null;

        let detected = null;
        const matchTitle = match.name || `${homeTeamName} vs ${awayTeamName}`;

        // Check Home edge (Soft bookie offering higher than sharp fair price)
        if (currentHomeOdds >= 1.40 && fairHomeOdds > 1.05 && currentHomeOdds > fairHomeOdds) {
            const discrepancy = ((currentHomeOdds - fairHomeOdds) / fairHomeOdds) * 100;
            if (discrepancy >= 10.0 && (redAdvantage === 'HOME' || pressureHome >= 65)) {
                // Market label must reflect score reality: trailing team can only have "Sıradaki Gol"
                const marketLabel = (hasHomeNextOdds || goalDiff < 0) 
                    ? `Sıradaki Gol: ${homeTeamName}` 
                    : `${homeTeamName} Kazanır`;

                detected = {
                    match: matchTitle,
                    team: homeTeamName,
                    side: 'HOME',
                    recommendedMarket: marketLabel,
                    market: marketLabel,
                    softOdds: currentHomeOdds,
                    sharpFairOdds: parseFloat(fairHomeOdds.toFixed(2)),
                    discrepancyPct: parseFloat(discrepancy.toFixed(1)),
                    lagEdgePct: parseFloat(discrepancy.toFixed(1)),
                    urgency: discrepancy >= 20 ? 'CRITICAL' : 'HIGH',
                    reason: redAdvantage === 'HOME' 
                        ? `Rakip Kırmızı Kartlı: Büro Oranı Gecikti (Adil: ${fairHomeOdds.toFixed(2)} vs Büro: ${currentHomeOdds})`
                        : `Yoğun Baskı Patlaması (${pressureHome} Puan): Büro Oran Güncellemedi`,
                    timestamp: Date.now(),
                    expiresInSeconds: 30
                };
            }
        }

        // Check Away edge
        if (!detected && currentAwayOdds >= 1.40 && fairAwayOdds > 1.05 && currentAwayOdds > fairAwayOdds) {
            const discrepancy = ((currentAwayOdds - fairAwayOdds) / fairAwayOdds) * 100;
            if (discrepancy >= 10.0 && (redAdvantage === 'AWAY' || pressureAway >= 65)) {
                // Market label must reflect score reality: trailing team can only have "Sıradaki Gol"
                const marketLabel = (hasAwayNextOdds || goalDiff > 0) 
                    ? `Sıradaki Gol: ${awayTeamName}` 
                    : `${awayTeamName} Kazanır`;

                detected = {
                    match: matchTitle,
                    team: awayTeamName,
                    side: 'AWAY',
                    recommendedMarket: marketLabel,
                    market: marketLabel,
                    softOdds: currentAwayOdds,
                    sharpFairOdds: parseFloat(fairAwayOdds.toFixed(2)),
                    discrepancyPct: parseFloat(discrepancy.toFixed(1)),
                    lagEdgePct: parseFloat(discrepancy.toFixed(1)),
                    urgency: discrepancy >= 20 ? 'CRITICAL' : 'HIGH',
                    reason: redAdvantage === 'AWAY'
                        ? `Rakip Kırmızı Kartlı: Büro Oranı Gecikti (Adil: ${fairAwayOdds.toFixed(2)} vs Büro: ${currentAwayOdds})`
                        : `Yoğun Baskı Patlaması (${pressureAway} Puan): Büro Oran Güncellemedi`,
                    timestamp: Date.now(),
                    expiresInSeconds: 30
                };
            }
        }

        if (detected) {
            this.activeAlerts.set(match.id, detected);
            return detected;
        }

        return null;
    }
}

export const latencyArbitrageRadar = new LatencyArbitrageRadar();
