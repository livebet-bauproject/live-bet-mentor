/**
 * CASH-OUT & STOP-LOSS RADAR ENGINE (v1.0)
 * Responsibilities:
 * - Continuously monitors active pending signals
 * - Detects late-game momentum collapse, red cards, or counter-surges
 * - Recommends cash-out or stop-loss to protect bettor bankroll
 */

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
        this.monitoredSignals.set(signal.id, {
            ...signal,
            registeredAt: Date.now(),
            registeredMinute: signal.minute || 0,
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

            const minute = this._parseMinute(match.minute || match.status?.description);
            const stats = match.stats || {};
            const cards = match.cards || stats.cards || {};

            // We look for cash-out opportunities between 68' and 88'
            // Before 68', there is usually plenty of time to recover
            if (minute >= 68 && minute <= 88) {
                let cashOutReason = null;
                let severity = 'MEDIUM';

                const targetSide = (sig.market || '').toLowerCase().includes('away') ? 'away' : 'home';
                const oppSide = targetSide === 'home' ? 'away' : 'home';

                const targetTeamName = targetSide === 'home' ? match.homeTeam?.name : match.awayTeam?.name;
                const oppTeamName = oppSide === 'home' ? match.homeTeam?.name : match.awayTeam?.name;

                // 1. Critical Danger: Red Card to target team
                const targetReds = Number(cards[targetSide]?.red ?? 0);
                if (targetReds > 0) {
                    cashOutReason = `${targetTeamName} kırmızı kart gördü (10 kişi kaldı).`;
                    severity = 'HIGH';
                }

                // 2. Severe Momentum Collapse
                // If in late game the target team has 0 dangerous attacks or shots in recent phase
                const daTarget = Number(stats.dangerousAttacks?.[targetSide] ?? 0);
                const daOpp = Number(stats.dangerousAttacks?.[oppSide] ?? 0);
                const sogTarget = Number(stats.shotsOnGoal?.[targetSide] ?? 0);

                if (!cashOutReason && daOpp > (daTarget * 1.8 + 10) && daOpp >= 30) {
                    cashOutReason = `${oppTeamName} oyunu tamamen yıktı (${daOpp} atak vs ${daTarget} atak). Tempo aleyhe döndü.`;
                    severity = 'HIGH';
                }

                // 3. Stagnation / Dead Game: Total shots stagnant in late game
                if (!cashOutReason && minute >= 75 && sogTarget <= 2 && daTarget <= 20) {
                    cashOutReason = `Son 15 dakikada gol aksiyonu üretilemedi. Maç kilitlendi.`;
                    severity = 'MEDIUM';
                }

                // 4. Opponent Took Lead (Trailing)
                const targetGoals = curScore[targetSide];
                const oppGoals = curScore[oppSide];
                if (!cashOutReason && oppGoals > targetGoals && minute >= 72) {
                    cashOutReason = `${oppTeamName} öne geçti (${curScore.home}-${curScore.away}). Baskı dağıldı.`;
                    severity = 'HIGH';
                }

                if (cashOutReason) {
                    this.alertedCashOuts.add(signalId);
                    recommendations.push({
                        signalId,
                        matchId: match.id,
                        matchTitle: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
                        minute,
                        score: `${curScore.home} - ${curScore.away}`,
                        market: sig.market,
                        targetTeam: targetTeamName,
                        reason: cashOutReason,
                        severity,
                        timestamp: Date.now()
                    });
                }
            }
        }

        return recommendations;
    }

    _parseMinute(min) {
        if (!min) return 0;
        if (typeof min === 'number') return min;
        const s = String(min).replace(/[^0-9]/g, '');
        return parseInt(s) || 0;
    }
}

export const cashOutEngine = new CashOutEngine();
