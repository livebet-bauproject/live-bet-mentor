/**
 * AUTO-SETTLEMENT & CLV (CLOSING LINE VALUE) ENGINE (v5.0)
 * 
 * Automatically settles pending open bets in the bankroll ledger when matches reach FT/HT,
 * evaluates outcome by market rules, updates the bankroll, and computes Closing Line Value (CLV):
 * 
 * CLV = ((Odds_taken / Odds_closing) - 1) * 100
 * A positive CLV (+CLV) proves that the model beat the market before closing.
 * 
 * v5.0 Upgrade:
 * - Robust remote API fetch for matches that concluded after leaving the live feed
 * - Multi-market resolution (Next Goal, FHG, Over/Under, BTTS, 1X2)
 * - Safe deduplication and in-place status tracking
 */

import { bankrollManager } from './bankrollManager.js';

export class AutoSettlementEngine {
    constructor() {
        this.settledCache = new Set(); // matchId_market
    }

    /**
     * Checks if a match is officially concluded
     */
    isMatchFinished(match) {
        if (!match) return false;
        const statusType = (match.status?.type || '').toLowerCase();
        const statusDesc = (match.status?.description || match.status || '').toString().toLowerCase();
        const minute = String(match.minute || '').toUpperCase().trim();
        return statusType === 'finished' || statusType === 'ended' ||
               statusDesc.includes('finish') || statusDesc.includes('ended') || statusDesc.includes('bitti') || 
               minute === '999' || minute === 'MS' || minute === 'FT';
    }

    /**
     * Checks if a match has concluded the 1st half
     */
    isFirstHalfFinished(match) {
        if (!match) return false;
        const statusType = (match.status?.type || '').toLowerCase();
        const statusDesc = (match.status?.description || match.status || '').toString().toLowerCase();
        const minStr = (match.minute || '').toString().toUpperCase().trim();
        const minNum = parseInt(minStr, 10) || 0;
        return statusDesc.includes('ht') || statusDesc.includes('half') || 
               minStr === 'İY' || minStr === 'HT' || minNum >= 46 || this.isMatchFinished(match);
    }

    /**
     * Evaluates whether a market bet won or lost based on match scores
     */
    evaluateBetOutcome(market, openEntry, match) {
        const ftHome = Number(match.score?.home ?? match.homeScore?.current ?? match.homeScore?.display ?? match.homeScore ?? 0);
        const ftAway = Number(match.score?.away ?? match.awayScore?.current ?? match.awayScore?.display ?? match.awayScore ?? 0);
        const ftTotal = ftHome + ftAway;

        // Score at bet time (if recorded)
        const scoreAtBet = openEntry.score_at_bet || { home: 0, away: 0 };
        const totalAtBet = (Number(scoreAtBet.home) || 0) + (Number(scoreAtBet.away) || 0);

        const marketId = (market || openEntry.market || openEntry.strategy_id || '').toUpperCase();
        const recText = (openEntry.prediction || openEntry.reason || openEntry.selection || openEntry.strategy_label || '').toLowerCase();

        // 1. First Half Over 0.5 (FHG)
        if (marketId.includes('FH') || marketId === 'FHG') {
            const htHome = Number(match.score?.period1Home ?? match.homeScore?.period1 ?? ftHome);
            const htAway = Number(match.score?.period1Away ?? match.awayScore?.period1 ?? ftAway);
            const htTotal = htHome + htAway;
            return htTotal >= 1;
        }

        // 2. Over 1.5 Goals
        if (marketId.includes('OVER15') || marketId.includes('OVER_15') || marketId.includes('1.5') || recText.includes('1.5 üst') || recText.includes('over 1.5')) {
            return ftTotal >= 2;
        }

        // 3. Over 2.5 Goals
        if (marketId.includes('OVER25') || marketId.includes('OVER_25') || marketId.includes('2.5') || recText.includes('2.5 üst') || recText.includes('over 2.5')) {
            return ftTotal >= 3;
        }

        // 4. Both Teams to Score (BTTS / KG Var)
        if (marketId.includes('BTTS') || marketId.includes('KG') || recText.includes('kg var')) {
            return ftHome >= 1 && ftAway >= 1;
        }

        // 5. Next Goal / Team Dominance (Red Card Advantage, Pressure, Momentum, Sıradaki Gol)
        if (marketId.includes('RED_CARD_ADV') || marketId.includes('PRESS') || marketId.includes('MOMENTUM') || marketId.includes('NEXT_GOAL') || recText.includes('sıradaki gol') || recText.includes('next goal')) {
            const homeName = (match.homeTeam || match.homeTeam?.name || '').toLowerCase();
            const awayName = (match.awayTeam || match.awayTeam?.name || '').toLowerCase();
            const rawLabel = (openEntry.market_label || openEntry.label || openEntry.market || recText).toLowerCase();

            let isHomeTarget = false;
            let isAwayTarget = false;

            if (marketId.includes('HOME') || rawLabel.includes('ev') || rawLabel.includes('home')) {
                isHomeTarget = true;
            } else if (marketId.includes('AWAY') || rawLabel.includes('dep') || rawLabel.includes('away')) {
                isAwayTarget = true;
            } else {
                if (homeName && homeName.length >= 3 && rawLabel.includes(homeName)) isHomeTarget = true;
                if (awayName && awayName.length >= 3 && rawLabel.includes(awayName)) isAwayTarget = true;
            }

            const homeScored = ftHome > (Number(scoreAtBet.home) || 0);
            const awayScored = ftAway > (Number(scoreAtBet.away) || 0);

            if (isHomeTarget && !isAwayTarget) return homeScored;
            if (isAwayTarget && !isHomeTarget) return awayScored;

            // Fallback: Did total goals increase after bet was placed?
            return ftTotal > totalAtBet;
        }

        // 6. Match Winner (MS 1 / MS 2 / HOME_WIN / AWAY_WIN)
        if (marketId.includes('WIN') || marketId.includes('MS 1') || marketId.includes('MS 2') || marketId.includes('FAV_WIN')) {
            const isHome = marketId.includes('HOME') || marketId.includes('MS 1') || recText.includes('ms 1');
            const isAway = marketId.includes('AWAY') || marketId.includes('MS 2') || recText.includes('ms 2');
            if (isHome) return ftHome > ftAway;
            if (isAway) return ftAway > ftHome;
            return ftHome > ftAway;
        }

        // Default: If at least 1 goal occurred after bet was placed
        return ftTotal > totalAtBet;
    }

    /**
     * Fetches detailed match info from proxy or cloud API when match is no longer in live feed
     */
    async fetchFinishedMatchDetails(matchId) {
        if (!matchId) return null;
        const isLocalDev = typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        const proxyBase = isLocalDev 
            ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001')
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            const res = await fetch(`${proxyBase}/api/sofascore/event/${matchId}`, { 
                signal: AbortSignal.timeout(6500) 
            });
            if (res.ok) {
                const data = await res.json();
                const ev = data?.event || data;
                if (!ev || !ev.id) return null;

                return {
                    id: ev.id,
                    homeTeam: ev.homeTeam?.name || ev.homeTeam?.shortName || ev.homeTeam || 'Ev Sahibi',
                    awayTeam: ev.awayTeam?.name || ev.awayTeam?.shortName || ev.awayTeam || 'Deplasman',
                    status: ev.status,
                    minute: ev.status?.description || 'FT',
                    homeScore: ev.homeScore,
                    awayScore: ev.awayScore,
                    score: {
                        home: ev.homeScore?.current ?? ev.homeScore?.display ?? 0,
                        away: ev.awayScore?.current ?? ev.awayScore?.display ?? 0,
                        period1Home: ev.homeScore?.period1 ?? 0,
                        period1Away: ev.awayScore?.period1 ?? 0
                    },
                    odds: ev.odds
                };
            }
        } catch (e) {
            console.warn(`[AutoSettlement] Failed to fetch remote details for match ${matchId}:`, e.message);
        }
        return null;
    }

    /**
     * Synchronous fast check for bets whose matches are currently in the live fixtures feed
     * @param {Array} liveMatches Current live/cached match list from dataWorker
     */
    settleOpenBets(liveMatches = []) {
        if (!liveMatches || liveMatches.length === 0) return { settledCount: 0, results: [] };

        const matchMap = new Map();
        for (const m of liveMatches) {
            if (m && m.id) matchMap.set(String(m.id), m);
        }

        const ledger = bankrollManager.state?.ledger || [];
        const openBets = ledger.filter(entry => 
            (entry.type === 'BET_OPEN' || entry.status === 'OPEN') && !entry.is_settled
        );

        if (openBets.length === 0) return { settledCount: 0, results: [] };

        const settledResults = [];

        for (const bet of openBets) {
            const matchId = String(bet.match_id);
            const match = matchMap.get(matchId);

            if (!match) continue;

            const isFH = (bet.market || bet.strategy_id || '').toUpperCase().includes('FH');
            const canSettle = isFH ? this.isFirstHalfFinished(match) : this.isMatchFinished(match);

            if (!canSettle) continue;

            const cacheKey = `${matchId}_${bet.id}`;
            if (this.settledCache.has(cacheKey)) continue;

            // Determine Outcome
            const isWin = this.evaluateBetOutcome(bet.market, bet, match);
            const stake = Number(bet.stake || bet.stake_amount) || 100;
            const liveMatchOdds = Number(match.odds?.current?.homeWin || match.odds?.closing);
            const oddsTaken = (Number(bet.odds_taken) > 1.0) ? Number(bet.odds_taken) : (liveMatchOdds > 1.0 ? liveMatchOdds : 1.85);

            // Closing line odds for CLV calculation
            const closingOdds = liveMatchOdds > 1.0 ? liveMatchOdds : (oddsTaken * 0.95);
            const clv = closingOdds > 0 ? parseFloat((((oddsTaken / closingOdds) - 1) * 100).toFixed(1)) : 0;

            // Process settlement in Bankroll Manager
            bankrollManager.processResult(bet.id || matchId, isWin, stake, oddsTaken, clv);

            this.settledCache.add(cacheKey);

            settledResults.push({
                betId: bet.id,
                matchId,
                matchName: bet.match_name,
                isWin,
                stake,
                oddsTaken,
                clv,
                strategy: bet.strategy_label
            });

            console.log(`[AutoSettlement] Settled Match ${matchId} (${bet.match_name}): ${isWin ? 'WON' : 'LOST'} | CLV: ${clv}%`);
        }

        return {
            settledCount: settledResults.length,
            results: settledResults
        };
    }

    /**
     * Comprehensive asynchronous check:
     * 1. Checks current live matches.
     * 2. For any open bets not in live feed, queries remote SofaScore API for final score and settles concluded matches.
     */
    async settleAllOpenBetsWithRemote(liveMatches = []) {
        // Step 1: Fast local pass
        const localRes = this.settleOpenBets(liveMatches);

        const ledger = bankrollManager.state?.ledger || [];
        const remainingOpenBets = ledger.filter(entry => 
            (entry.type === 'BET_OPEN' || entry.status === 'OPEN') && !entry.is_settled
        );

        if (remainingOpenBets.length === 0) {
            return localRes;
        }

        const remoteSettledResults = [...localRes.results];

        // Step 2: Query remote API for pending bets whose live match concluded
        for (const bet of remainingOpenBets) {
            const matchId = String(bet.match_id);
            if (!matchId) continue;

            const cacheKey = `${matchId}_${bet.id}`;
            if (this.settledCache.has(cacheKey)) continue;

            const match = await this.fetchFinishedMatchDetails(matchId);
            if (!match) continue;

            const isFH = (bet.market || bet.strategy_id || '').toUpperCase().includes('FH');
            const canSettle = isFH ? this.isFirstHalfFinished(match) : this.isMatchFinished(match);

            if (!canSettle) continue;

            const isWin = this.evaluateBetOutcome(bet.market, bet, match);
            const stake = Number(bet.stake || bet.stake_amount) || 100;
            const liveMatchOdds = Number(match.odds?.current?.homeWin || match.odds?.closing);
            const oddsTaken = (Number(bet.odds_taken) > 1.0) ? Number(bet.odds_taken) : (liveMatchOdds > 1.0 ? liveMatchOdds : 1.85);
            const closingOdds = liveMatchOdds > 1.0 ? liveMatchOdds : (oddsTaken * 0.95);
            const clv = closingOdds > 0 ? parseFloat((((oddsTaken / closingOdds) - 1) * 100).toFixed(1)) : 0;

            bankrollManager.processResult(bet.id || matchId, isWin, stake, oddsTaken, clv);
            this.settledCache.add(cacheKey);

            remoteSettledResults.push({
                betId: bet.id,
                matchId,
                matchName: bet.match_name,
                isWin,
                stake,
                oddsTaken,
                clv,
                strategy: bet.strategy_label
            });

            console.log(`[AutoSettlement-Remote] Settled concluded Match ${matchId} (${bet.match_name}): ${isWin ? 'WON' : 'LOST'}`);
        }

        return {
            settledCount: remoteSettledResults.length,
            results: remoteSettledResults
        };
    }
}

export const autoSettlementEngine = new AutoSettlementEngine();
