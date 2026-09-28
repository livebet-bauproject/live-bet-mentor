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
    generateGoldenCombo(opportunities, matches, lang = 'tr') {
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
                // STRICT: Exclude penalty shootouts or finished matches
                const minRaw = String(opp.minute || '').toLowerCase();
                if (minRaw.includes('pen') || minRaw === 'ms' || minRaw.includes('ft')) return false;
                // TIME WINDOW: Strictly require between 18' and 72' (or Halftime 45') for mature, high-yield betting
                const minVal = parseInt(String(opp.minute || '').replace(/[^0-9]/g, '')) || 0;
                if (!opp.isHalftime && (minVal < 18 || minVal > 72)) return false;
                
                // STRICT EXPLOSION CRITERIA:
                // Only truly explosive opportunities (High SICAK or ALEV, Score >= 72) can enter Golden Double!
                if (opp.score < 72) return false;
                
                // HIGH CONVICTION GATE:
                // Market must have at least 75% algorithmic confidence
                if (!opp.suggestedMarket?.marketKey) return false;
                const marketConf = opp.suggestedMarket.confidence || 0;
                if (marketConf < 75) return false;

                return true;
            })
            .map(opp => {
                const match = matches.find(m => m.id === opp.matchId);
                if (!match) return null;

                // Also double-check match minute and penalty status
                const mMinRaw = String(match.minute || opp.minute || '').toLowerCase();
                const mStatusCode = match.status?.code;
                const mDesc = (match.status?.description || '').toLowerCase();
                const isHalftimeMatch = mStatusCode === 31 || mMinRaw.includes('iy') || mMinRaw.includes('ht') || mDesc.includes('devre') || mDesc.includes('halftime');
                if (mMinRaw.includes('pen') || mStatusCode === 120 || mStatusCode === 110 || mDesc.includes('penalt') || mMinRaw === 'ms' || mMinRaw.includes('ft')) {
                    return null;
                }
                const totalGoals = (Number(match.score?.home) || 0) + (Number(match.score?.away) || 0);
                if (totalGoals >= 7) return null;

                const mMin = parseInt(String(match.minute || opp.minute || '').replace(/[^0-9]/g, '')) || 0;
                if (!isHalftimeMatch && (mMin < 18 || mMin > 72)) return null;

                // STRICT REAL PITCH EXPLOSION VALIDATION:
                // Ensure the match actually exploded on the pitch (not just idle ball possession)
                const stats = match.stats || {};
                const daHome = Number(stats.dangerousAttacks?.home || 0);
                const daAway = Number(stats.dangerousAttacks?.away || 0);
                const daTotal = daHome + daAway;
                const daDiff = Math.abs(daHome - daAway);
                const sogTotal = Number(stats.shotsOnGoal?.home || 0) + Number(stats.shotsOnGoal?.away || 0);
                const shotsTotal = Number(stats.totalShots?.home || 0) + Number(stats.totalShots?.away || 0);
                const xgTotal = (Number(stats.xg?.home || 0)) + (Number(stats.xg?.away || 0));
                const activeSignal = match.signal;

                // 1) Active AI Strategy BET Verdict
                const hasAiSignal = activeSignal && (activeSignal.verdict === 'BET' || (activeSignal.activeStrategies && activeSignal.activeStrategies.length > 0));
                // 2) Heavy pressure dominance (one team heavily dominating)
                const hasHeavyDominance = (daDiff >= 12 && daTotal >= 18) || (opp.components?.pressure >= 65);
                // 3) High goal mouth activity (shots + xG verified)
                const hasGoalThreat = (sogTotal >= 4 && shotsTotal >= 7) || xgTotal >= 0.70;
                // 4) Halftime sustained pressure
                const hasHalftimeExplosion = isHalftimeMatch && (daTotal >= 25 || sogTotal >= 3 || xgTotal >= 0.65);

                const isPitchExploded = hasAiSignal || hasHeavyDominance || hasGoalThreat || hasHalftimeExplosion;
                if (!isPitchExploded) {
                    return null; // Reject lukewarm matches that lack concrete explosive indicators!
                }

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

                // Mathematical Dynamic In-Play Fair Odds Model:
                // Time-decay & Poisson based on elapsed game time and model conviction
                if (!odds || isNaN(odds) || odds < 1.15 || odds > 3.20) {
                    const conf = opp.suggestedMarket.confidence || 78;
                    const elapsed = isHalftimeMatch ? 45 : Math.min(78, Math.max(18, mMin));
                    const remaining = Math.max(15, 93 - elapsed);
                    
                    // Base fair odds that rise as remaining minutes decrease (time decay)
                    const timeFactor = 1.32 + Math.pow((90 - remaining) / 90, 1.8) * 0.90;
                    // Conviction adjustment: higher model confidence brings odds slightly down (higher true probability)
                    const confDiscount = ((conf - 70) / 100) * 0.35;
                    const dynamicOdds = Math.max(1.35, Math.min(2.75, timeFactor - confDiscount));
                    odds = Number(dynamicOdds.toFixed(2));
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
            const key = pick.market?.marketKey;
            const team = pick.market?.team || '';
            const target = pick.market?.target || '';
            if (lang === 'de') {
                if (key === 'HOME_NEXT_GOAL') return `Nächstes Tor: ${pick.homeTeam}`;
                if (key === 'AWAY_NEXT_GOAL') return `Nächstes Tor: ${pick.awayTeam}`;
                if (key === 'HOME_WIN_NEXT') return `Heimsieg (1): ${pick.homeTeam}`;
                if (key === 'AWAY_WIN_NEXT') return `Auswärtssieg (2): ${pick.awayTeam}`;
                if (key === 'OVER_GOALS' || key === 'OVER_NEXT_DYNAMIC') return target ? `Über ${target} Tore` : `Live Über-Tore`;
                if (key === 'market_fh_over05') return `1. HZ Über 0.5 Tore`;
                return team ? `${team} Tor / Druck` : 'Live Tor-Baskisi';
            }
            if (lang === 'en') {
                if (key === 'HOME_NEXT_GOAL') return `Next Goal: ${pick.homeTeam}`;
                if (key === 'AWAY_NEXT_GOAL') return `Next Goal: ${pick.awayTeam}`;
                if (key === 'HOME_WIN_NEXT') return `Full-Time Win (1): ${pick.homeTeam}`;
                if (key === 'AWAY_WIN_NEXT') return `Full-Time Win (2): ${pick.awayTeam}`;
                if (key === 'OVER_GOALS' || key === 'OVER_NEXT_DYNAMIC') return target ? `Over ${target} Goals` : `Live Over Goals`;
                if (key === 'market_fh_over05') return `1st Half Over 0.5`;
                return team ? `${team} Goal / Pressure` : 'Live Goal Pressure';
            }
            if (key === 'HOME_NEXT_GOAL') return `Sıradaki Gol: ${pick.homeTeam}`;
            if (key === 'AWAY_NEXT_GOAL') return `Sıradaki Gol: ${pick.awayTeam}`;
            if (key === 'HOME_WIN_NEXT') return `Maç Sonu (MS 1): ${pick.homeTeam}`;
            if (key === 'AWAY_WIN_NEXT') return `Maç Sonu (MS 2): ${pick.awayTeam}`;
            if (key === 'OVER_GOALS' || key === 'OVER_NEXT_DYNAMIC') return target ? `${target} Üst Gol Bekleniyor` : `Canlı Üst Gol`;
            if (key === 'market_fh_over05') return `İlk Yarı 0.5 Üst`;
            return team ? `${team} Gol / Baskı` : 'Canlı Gol Baskısı';
        };

        const title = lang === 'tr' 
            ? 'Günün Canlı Altın İkilisi' 
            : (lang === 'de' ? 'Live-Gold-Doppel des Tages' : 'Live Golden Double of the Day');

        return {
            id: `combo_${pick1.matchId}_${pick2.matchId}`,
            title,
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
