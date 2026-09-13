/**
 * SMART LIVE BET BUILDER ENGINE (v1.0)
 * Institutional Bet Builder: Combines two high-conviction live opportunities into a golden double combo.
 */

export class BetBuilderEngine {
    constructor() {}

    /**
     * Generate Golden Double (Altın İkili) from current live opportunities
     * @param {Array} opportunities - Array of opportunity objects
     * @param {Array} matches - Array of match objects
     * @returns {Object|null} - Combined bet slip object
     */
    generateGoldenCombo(opportunities, matches) {
        if (!opportunities || !matches || opportunities.length < 2) {
            return null;
        }

        // 1. Filter qualified opportunities (SICAK or ALEV, with valid suggestedMarket)
        const candidates = opportunities
            .filter(opp => !opp.excluded && opp.score >= 60 && opp.suggestedMarket?.marketKey && !opp.isTrap)
            .map(opp => {
                const match = matches.find(m => m.id === opp.matchId);
                if (!match) return null;

                // Estimate odds if live odds not yet parsed
                let odds = opp.suggestedMarket.odds || opp.oddsInfo?.over || opp.oddsInfo?.home;
                if (!odds || isNaN(odds) || odds <= 1.05) {
                    const conf = opp.suggestedMarket.confidence || 75;
                    if (conf >= 85) odds = 1.48;
                    else if (conf >= 80) odds = 1.55;
                    else if (conf >= 70) odds = 1.68;
                    else odds = 1.82;
                }

                return {
                    matchId: opp.matchId,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    league: match.league || match.leagueName || 'Lig',
                    minute: match.minute || opp.minute,
                    score: match.score,
                    heatLevel: opp.heatLevel,
                    opportunityScore: opp.score,
                    market: opp.suggestedMarket,
                    odds: Number(parseFloat(odds).toFixed(2))
                };
            })
            .filter(Boolean);

        if (candidates.length < 2) return null;

        // 2. Sort candidates by score descending
        candidates.sort((a, b) => b.opportunityScore - a.opportunityScore);

        // 3. Pick top 2 distinct matches
        const pick1 = candidates[0];
        // Pick pick2 from a different match (and preferably different league if possible)
        let pick2 = candidates.find(c => c.matchId !== pick1.matchId && c.league !== pick1.league);
        if (!pick2) {
            pick2 = candidates.find(c => c.matchId !== pick1.matchId);
        }

        if (!pick1 || !pick2) return null;

        const totalOdds = (pick1.odds * pick2.odds).toFixed(2);
        const avgConfidence = Math.round(((pick1.market.confidence || 75) + (pick2.market.confidence || 75)) / 2);

        const formatMarketLabel = (pick) => {
            const key = pick.market.marketKey;
            const team = pick.market.team || '';
            if (key === 'HOME_NEXT_GOAL') return `Sıradaki Gol: ${pick.homeTeam}`;
            if (key === 'AWAY_NEXT_GOAL') return `Sıradaki Gol: ${pick.awayTeam}`;
            if (key === 'HOME_WIN_NEXT') return `Kazanmaya Yakın: ${pick.homeTeam}`;
            if (key === 'AWAY_WIN_NEXT') return `Kazanmaya Yakın: ${pick.awayTeam}`;
            if (key === 'OVER_GOALS') return `Canlı Üst Gol`;
            return `${team || 'Ev'} Gol / Baskı`;
        };

        return {
            id: `combo_${pick1.matchId}_${pick2.matchId}`,
            title: 'Günün Canlı Altın İkilisi',
            totalOdds,
            averageConfidence: avgConfidence,
            picks: [
                {
                    matchId: pick1.matchId,
                    matchTitle: `${pick1.homeTeam} vs ${pick1.awayTeam}`,
                    league: pick1.league,
                    minute: pick1.minute,
                    score: `${pick1.score?.home ?? 0}-${pick1.score?.away ?? 0}`,
                    market: formatMarketLabel(pick1),
                    confidence: pick1.market.confidence || 80,
                    odds: pick1.odds
                },
                {
                    matchId: pick2.matchId,
                    matchTitle: `${pick2.homeTeam} vs ${pick2.awayTeam}`,
                    league: pick2.league,
                    minute: pick2.minute,
                    score: `${pick2.score?.home ?? 0}-${pick2.score?.away ?? 0}`,
                    market: formatMarketLabel(pick2),
                    confidence: pick2.market.confidence || 80,
                    odds: pick2.odds
                }
            ],
            createdAt: Date.now()
        };
    }
}

export const betBuilderEngine = new BetBuilderEngine();
