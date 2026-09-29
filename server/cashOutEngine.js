/**
 * CASH-OUT & STOP-LOSS RADAR ENGINE (v1.0)
 * Responsibilities:
 * - Continuously monitors active pending signals
 * - Detects late-game momentum collapse, red cards, or counter-surges
 * - Recommends cash-out or stop-loss to protect bettor bankroll
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATS_DIR = path.join(__dirname, 'stats');

export class CashOutEngine {
    constructor() {
        this.monitoredSignals = new Map(); // signalId -> signalData
        this.alertedCashOuts = new Set();  // signalId -> alerted flag
    }

    /**
     * Register a newly placed/sent signal for cash-out monitoring
     */
    registerSignal(signal) {
        if (!signal || !signal.id) return;
        const initialStats = signal.matchId ? this._loadStats(signal.matchId) : { home: {}, away: {} };
        const initialHomeReds = Number(signal.recommendation?.redCards?.home ?? initialStats.home?.['red cards'] ?? 0);
        const initialAwayReds = Number(signal.recommendation?.redCards?.away ?? initialStats.away?.['red cards'] ?? 0);

        this.monitoredSignals.set(signal.id, {
            ...signal,
            registeredAt: Date.now(),
            registeredMinute: signal.minute || 0,
            initialHomeReds,
            initialAwayReds,
            cashOutEvaluated: false
        });
    }

    /**
     * Remove a signal when won, lost or ended
     */
    unregisterSignal(signalId) {
        if (signalId) {
            this.monitoredSignals.delete(signalId);
            this.alertedCashOuts.delete(signalId);
        }
    }

    /**
     * Parse stats file from disk
     */
    _loadStats(eventId) {
        const statsPath = path.join(STATS_DIR, `${eventId}_stats.json`);
        const res = { home: {}, away: {} };
        if (!fs.existsSync(statsPath)) return res;
        try {
            const raw = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
            const all = raw.statistics?.find(s => s.period === 'ALL') || raw.statistics?.[0];
            if (all) {
                for (const g of all.groups || []) {
                    for (const item of g.statisticsItems || []) {
                        const key = (item.name || '').toLowerCase().trim();
                        res.home[key] = parseFloat(item.home) || item.homeValue || 0;
                        res.away[key] = parseFloat(item.away) || item.awayValue || 0;
                    }
                }
            }
        } catch (e) {}
        return res;
    }

    /**
     * Evaluate live match events against active monitored signals
     * @param {Array} liveEvents - SofaScore live matches
     * @returns {Array} - Array of cash-out recommendations
     */
    evaluateCashOuts(liveEvents) {
        if (!liveEvents || !Array.isArray(liveEvents) || this.monitoredSignals.size === 0) {
            return [];
        }

        const recommendations = [];

        for (const [signalId, sig] of this.monitoredSignals.entries()) {
            if (this.alertedCashOuts.has(signalId)) continue;

            const match = liveEvents.find(e => 
                (sig.matchId && (e.id === sig.matchId || String(e.id) === String(sig.matchId))) ||
                (sig.homeTeam && e.homeTeam?.name?.toLowerCase().includes(sig.homeTeam.toLowerCase()))
            );

            if (!match) continue;

            const curScore = {
                home: match.homeScore?.current ?? 0,
                away: match.awayScore?.current ?? 0
            };

            const minute = this._parseMinute(match.minute ?? match.time?.currentPeriodStartTimestamp ?? match.status?.description, match);
            const stats = this._loadStats(match.id);

            const marketText = (sig.market || '').toLowerCase();
            const isTotalGoalsMarket = marketText.includes('üst') || marketText.includes('over') || marketText.includes('alt') || marketText.includes('under') || marketText.includes('gol');
            const targetSide = marketText.includes('away') || marketText.includes('deplasman') ? 'away' : 'home';
            const oppSide = targetSide === 'home' ? 'away' : 'home';

            const targetTeamName = targetSide === 'home' ? (match.homeTeam?.name || sig.homeTeam) : (match.awayTeam?.name || sig.awayTeam);
            const oppTeamName = oppSide === 'home' ? (match.homeTeam?.name || sig.homeTeam) : (match.awayTeam?.name || sig.awayTeam);

            let cashOutReason = null;
            let severity = 'MEDIUM';

            // 1. CRITICAL: Red Card to target team (ONLY if a NEW red card occurred AFTER signal registration)
            // For Total Over Goals, a red card doesn't automatically ruin the bet as defenses open up!
            const currentTargetReds = Number(stats[targetSide]?.['red cards'] ?? (targetSide === 'home' ? match.homeRedCards : match.awayRedCards) ?? 0);
            const initialTargetReds = targetSide === 'home' ? (sig.initialHomeReds || 0) : (sig.initialAwayReds || 0);

            if (!isTotalGoalsMarket && currentTargetReds > initialTargetReds) {
                cashOutReason = `🚨 ${targetTeamName} yeni bir kırmızı kart gördü (10 kişi kaldı). Acil kâr al veya riski sınırla!`;
                severity = 'HIGH';
            }

            // 2. LATE GAME RADAR (Between 68' and 88')
            if (!cashOutReason && minute >= 68 && minute <= 88) {
                const targetSOT = Number(stats[targetSide]?.['shots on target'] ?? 0);
                const oppSOT = Number(stats[oppSide]?.['shots on target'] ?? 0);
                const targetBox = Number(stats[targetSide]?.['touches in penalty area'] ?? 0);
                const oppBox = Number(stats[oppSide]?.['touches in penalty area'] ?? 0);

                // A. Opponent completely reversed momentum
                if (oppBox >= (targetBox * 1.6 + 6) && oppSOT > targetSOT) {
                    cashOutReason = `⚠️ ${oppTeamName} son bölümde oyunu yıktı (${oppBox} vs ${targetBox} ceza sahası aksiyonu). Baskı aleyhe döndü.`;
                    severity = 'HIGH';
                }

                // B. Stagnation / Dead Game: No target shot activity in late game
                else if (minute >= 76 && targetSOT <= 2 && targetBox <= 10) {
                    cashOutReason = `⏳ Son 15 dakikada gol aksiyonu üretilemedi. Maç kilitlendi, kâr al değerlendirilmeli.`;
                    severity = 'MEDIUM';
                }

                // C. Opponent Took Lead (Trailing)
                const targetGoals = curScore[targetSide];
                const oppGoals = curScore[oppSide];
                if (oppGoals > targetGoals && minute >= 72) {
                    cashOutReason = `⚡ ${oppTeamName} öne geçti (${curScore.home}-${curScore.away}). Baskı ritmi dağıldı.`;
                    severity = 'HIGH';
                }
            }

            if (cashOutReason) {
                this.alertedCashOuts.add(signalId);
                recommendations.push({
                    signalId,
                    matchId: match.id,
                    matchTitle: `${match.homeTeam?.name || sig.homeTeam} vs ${match.awayTeam?.name || sig.awayTeam}`,
                    minute: minute > 0 ? minute : (sig.minute || 65),
                    score: `${curScore.home} - ${curScore.away}`,
                    market: sig.market,
                    targetTeam: targetTeamName,
                    reason: cashOutReason,
                    severity,
                    timestamp: Date.now()
                });
            }
        }

        return recommendations;
    }

    _parseMinute(min, match = null) {
        if (typeof min === 'number') {
            if (min > 1000000000 && match?.time?.currentPeriodStartTimestamp) {
                // It's a timestamp! Calculate elapsed minutes
                const elapsedSec = (Date.now() / 1000) - match.time.currentPeriodStartTimestamp;
                const baseMin = (match.status?.description?.includes('2nd') || match.status?.code === 7) ? 45 : 0;
                return Math.min(90, Math.max(1, baseMin + Math.floor(elapsedSec / 60)));
            }
            return min;
        }
        if (!min) return 0;
        const s = String(min).trim();
        if (s.toLowerCase().includes('2nd') || s === '7') {
            if (match?.time?.currentPeriodStartTimestamp) {
                const elapsedSec = (Date.now() / 1000) - match.time.currentPeriodStartTimestamp;
                return Math.min(90, Math.max(46, 45 + Math.floor(elapsedSec / 60)));
            }
            return 65; // Safe default for 2nd half
        }
        if (s.toLowerCase().includes('half') || s.toLowerCase().includes('ht')) return 45;
        const digits = s.replace(/[^0-9]/g, '');
        return parseInt(digits) || 0;
    }
}

export const cashOutEngine = new CashOutEngine();
