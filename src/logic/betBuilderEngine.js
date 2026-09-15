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
            .filter(opp => {
                if (!opp || opp.excluded || opp.isTrap) return false;
                // STRICT DATA DENSITY GATE: Never allow low-data/bare-stats matches into Golden Double!
                if (opp.isLowData || opp.dataDensity === 'LOW') return false;
                // RISK & CASHOUT GATE: If radar issued a Cashout / Bahis Bozdur warning, NEVER suggest it as a new bet!
                if (opp.cashOutWarning) return false;
                // TIME WINDOW: Do not add late matches (>= 75') where remaining time is too short for a fresh combo pick
                const minVal = parseInt(String(opp.minute || '').replace(/[^0-9]/g, '')) || 0;
                if (minVal >= 75) return false;
                if (opp.score < 60) return false;
                if (!opp.suggestedMarket?.marketKey) return false;
                return true;
            })
            .map(opp => {
                const match = matches.find(m => m.id === opp.matchId);
                if (!match) return null;

                // Also double-check match minute
                const mMin = parseInt(String(match.minute || opp.minute || '').replace(/[^0-9]/g, '')) || 0;
                if (mMin >= 75) return null;

                // Also check league level: reject youth/reserve matches if they don't have verified xG
                const leagueLower = (match.league || match.leagueName || '').toLowerCase();
                const isYouthLeague = leagueLower.includes('u21') || leagueLower.includes('u23') || 
                                     leagueLower.includes('u19') || leagueLower.includes('development') || 
                                     leagueLower.includes('next gen') || leagueLower.includes('reserve');
                if (isYouthLeague && (!match.stats?.xg || (match.stats.xg.home === 0 && match.stats.xg.away === 0))) {
                    return null;
                }

                // Sanitize and determine realistic in-play odds
                let odds = opp.suggestedMarket.odds;
                
                // If suggested market is OVER, we can consider over odds (if realistic <= 3.20)
                if ((!odds || odds > 3.20 || odds < 1.10) && opp.suggestedMarket.marketKey?.includes('OVER')) {
                    const oVal = parseFloat(opp.oddsInfo?.over);
                    if (oVal >= 1.10 && oVal <= 3.20) odds = oVal;
                }

                // If odds is still invalid, outside sanity range (1.10 - 3.20), or missing:
                // Use statistical fair value based on engine conviction
                if (!odds || isNaN(odds) || odds < 1.10 || odds > 3.20) {
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
