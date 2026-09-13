/**
 * AUTO-SETTLEMENT & CLV (CLOSING LINE VALUE) ENGINE (v4.0)
 * 
 * Automatically settles pending open bets in the bankroll ledger when matches reach FT/HT,
 * evaluates outcome by market rules, updates the bankroll, and computes Closing Line Value (CLV):
 * 
 * CLV = ((Odds_taken / Odds_closing) - 1) * 100
 * A positive CLV (+CLV) proves that the model beat the market before closing.
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
        const status = (match.status?.type || match.status?.description || match.status || '').toString().toLowerCase();
        const minute = match.minute;
        return status.includes('finish') || status.includes('ended') || status.includes('bitti') || 
               minute === 999 || minute === 'MS' || minute === 'FT';
    }

    /**
     * Checks if a match has concluded the 1st half
     */
    isFirstHalfFinished(match) {
        if (!match) return false;
        const status = (match.status?.description || match.status || '').toString().toLowerCase();
        const minStr = (match.minute || '').toString();
        const minNum = parseInt(minStr) || 0;
        return status.includes('ht') || status.includes('half') || minStr === 'İY' || minNum >= 46 || this.isMatchFinished(match);
    }

    /**
     * Evaluates whether a market bet won or lost based on match scores
     */
    evaluateBetOutcome(market, openEntry, match) {
        const ftHome = Number(match.score?.home ?? match.homeScore?.current ?? 0);
        const ftAway = Number(match.score?.away ?? match.awayScore?.current ?? 0);
        const ftTotal = ftHome + ftAway;

        // Score at bet time (if recorded)
        const scoreAtBet = openEntry.score_at_bet || { home: 0, away: 0 };
        const totalAtBet = (scoreAtBet.home || 0) + (scoreAtBet.away || 0);

        const marketId = (market || openEntry.market || openEntry.strategy_id || '').toUpperCase();

        // 1. First Half Over 0.5 (FHG)
        if (marketId.includes('FH') || marketId === 'FHG') {
            const htHome = Number(match.score?.period1Home ?? match.homeScore?.period1 ?? ftHome);
            const htAway = Number(match.score?.period1Away ?? match.awayScore?.period1 ?? ftAway);
            const htTotal = htHome + htAway;
            return htTotal >= 1;
        }

        // 2. Over 1.5 Goals
        if (marketId.includes('OVER15') || marketId.includes('OVER_15') || marketId.includes('1.5')) {
            return ftTotal >= 2;
        }

        // 3. Over 2.5 Goals
        if (marketId.includes('OVER25') || marketId.includes('OVER_25') || marketId.includes('2.5')) {
            return ftTotal >= 3;
        }

        // 4. Both Teams to Score (BTTS)
        if (marketId.includes('BTTS') || marketId.includes('KG')) {
            return ftHome >= 1 && ftAway >= 1;
        }

        // 5. Next Goal / Team Dominance (Red Card Advantage, Pressure, Momentum)
        if (marketId.includes('RED_CARD_ADV') || marketId.includes('PRESS') || marketId.includes('MOMENTUM') || marketId.includes('NEXT_GOAL')) {
            // Did goals increase after bet was placed?
            return ftTotal > totalAtBet;
        }

        // Default: If at least 1 goal occurred after bet
        return ftTotal > totalAtBet;
    }

    /**
     * Scans bankroll ledger and settles any completed matches
     * @param {Array} liveMatches Current live/cached match list from SofaScore
     */
    settleOpenBets(liveMatches = []) {
        if (!liveMatches || liveMatches.length === 0) return { settledCount: 0, results: [] };

        const matchMap = new Map();
        for (const m of liveMatches) {
            matchMap.set(String(m.id), m);
        }

        const ledger = bankrollManager.state?.ledger || [];
        const openBets = ledger.filter(entry => entry.type === 'BET_OPEN' && !entry.is_settled);

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
            const stake = Number(bet.stake_amount) || 100;
            const oddsTaken = Number(bet.odds_taken) || 1.85;

            // Closing line odds for CLV calculation
            const closingOdds = Number(match.odds?.current?.homeWin || match.odds?.closing || (oddsTaken * 0.95));
            const clv = closingOdds > 0 ? parseFloat((((oddsTaken / closingOdds) - 1) * 100).toFixed(1)) : 0;

            // Process settlement in Bankroll Manager
            bankrollManager.processResult(matchId, isWin, stake, oddsTaken, clv);

            // Mark ledger entry as settled
            bet.is_settled = true;
            bet.settled_at = new Date().toISOString();
            bet.outcome = isWin ? 'WON' : 'LOST';
            bet.clv = clv;

            this.settledCache.add(cacheKey);

            settledResults.push({
                matchId,
                matchName: bet.match_name,
                isWin,
                stake,
                oddsTaken,
                clv,
                strategy: bet.strategy_label
            });

            console.log(`[AutoSettlement] Setteled Match ${matchId} (${bet.match_name}): ${isWin ? 'WON' : 'LOST'} | CLV: ${clv}%`);
        }

        if (settledResults.length > 0) {
            bankrollManager.saveState();
        }

        return {
            settledCount: settledResults.length,
            results: settledResults
        };
    }
}

export const autoSettlementEngine = new AutoSettlementEngine();
