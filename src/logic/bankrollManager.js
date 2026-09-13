/**
 * BANKROLL MANAGER - Phase 13
 * Handles binding discipline, stake calculation, and append-only ledger.
 */

import { CONFIG } from '../config.js';
import { translations } from '../locales/translations.js';

class BankrollManager {
    constructor() {
        this.loadState();
    }

    loadState() {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lbm_bankroll_state') : null;
        const defaultState = {
            starting_balance: CONFIG.BANKROLL.HIERARCHY.INITIAL_BALANCE,
            current_balance: CONFIG.BANKROLL.HIERARCHY.INITIAL_BALANCE,
            max_balance_seen: CONFIG.BANKROLL.HIERARCHY.INITIAL_BALANCE,
            daily_pl: 0,
            win_streak: 0,
            loss_streak: 0,
            current_mode: CONFIG.BANKROLL.HIERARCHY.MODES.NORMAL,
            daily_bet_count: 0,
            daily_loss_count: 0,
            last_reset_date: new Date().toDateString(),
            ledger: [],
            processedToday: {},
            strategyStats: {},
            clvStats: { totalBets: 0, positiveCount: 0, sumCLV: 0 },
            stats: {
                passCount: 0,
                noBetCount: 0,
                betCount: 0
            }
        };

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Deep merge logic to ensure nested objects exist
                this.state = {
                    ...defaultState,
                    ...parsed,
                    stats: { ...defaultState.stats, ...(parsed.stats || {}) },
                    strategyStats: { ...defaultState.strategyStats, ...(parsed.strategyStats || {}) },
                    clvStats: { ...defaultState.clvStats, ...(parsed.clvStats || {}) },
                    processedToday: parsed.processedToday || {}
                };

                // Dynamic daily reset
                const today = new Date().toDateString();
                if (this.state.last_reset_date !== today) {
                    console.log('[BankrollManager] New day detected. Resetting daily counters.');
                    this.state.daily_pl = 0;
                    this.state.daily_bet_count = 0;
                    this.state.daily_loss_count = 0;
                    this.state.last_reset_date = today;
                    this.state.processedToday = {};
                    this.saveState();
                    this.addToLedger('SYSTEM_RESET', { reason: 'new_day_reason' });
                }
                console.log('[BankrollManager] Loaded state. Balance:', this.state.current_balance);
            } catch (e) {
                console.error('[BankrollManager] Error parsing saved state, resetting to default', e);
                this.state = defaultState;
            }
        } else {
            console.log('[BankrollManager] No saved state found, initializing system.');
            this.state = defaultState;
            this.saveState();
            this.addToLedger('SYSTEM_INIT', {
                balance: defaultState.starting_balance,
                reason: 'system_init_reason'
            });
        }
    }

    saveState() {
        console.log('[BankrollManager] Saving state. Balance:', this.state.current_balance);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lbm_bankroll_state', JSON.stringify(this.state));
        }
    }

    addToLedger(type, data) {
        if (!this.state.ledger) this.state.ledger = [];
        const entry = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type,
            ...data,
            balance_after: this.state.current_balance,
            current_mode: this.state.current_mode
        };
        this.state.ledger.push(entry);
        if (this.state.ledger.length > 500) {
            this.state.ledger = this.state.ledger.slice(-500);
        }
        this.saveState();
    }

    logVerdict(matchId, verdict) {
        if (!this.state.processedToday) this.state.processedToday = {};

        const key = `${matchId}_${verdict}`;
        if (this.state.processedToday[key]) return; // Already counted this verdict for this match

        console.log(`[BankrollManager] Logging new verdict: ${verdict} for match: ${matchId}`);
        if (verdict === 'PASS') this.state.stats.passCount++;
        if (verdict === 'NO-BET') this.state.stats.noBetCount++;
        if (verdict === 'BET') this.state.stats.betCount++;

        this.state.processedToday[key] = true;
        this.saveState();
    }

    getAnalytics() {
        const stats = this.state.stats || { passCount: 0, noBetCount: 0, betCount: 0 };
        const total = (stats.passCount || 0) + (stats.noBetCount || 0) + (stats.betCount || 0);
        return {
            passRate: total > 0 ? (stats.passCount / total) * 100 : 0,
            noBetRate: total > 0 ? (stats.noBetCount / total) * 100 : 0,
            totalAnalysed: total
        };
    }

    /**
     * UPGRADE: Fractional Kelly Criterion Stake Sizing
     * Uses calculated probability (pSituation) and Expected Value (EV)
     * to determine the mathematically optimal stake.
     */
    calculateRecommendedStake(fixture, signal) {
        if (this.state.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.NO_BET) {
            return 0;
        }

        const h = CONFIG.BANKROLL.HIERARCHY;
        const p = signal.pSituation || 0;
        const ev = signal.maxEV || 0;
        
        // If no EV or low probability, return 0
        if (ev <= 0 || p <= 0) return 0;

        // Decimal odds (b = decimal_odds - 1)
        // Since EV = p*odds - 1, then odds = (EV + 1) / p
        const b = ((ev + 1) / p) - 1;
        if (b <= 0) return 0;

        // Kelly Formula: f = (p*b - q) / b
        const q = 1 - p;
        const fullKelly = (p * b - q) / b;

        // We use "Quarter Kelly" (0.25 multiplier) as a safe standard in betting
        let percentage = fullKelly * 0.25;

        // Safety Caps
        const maxAllowed = fixture.tier === 1 ? h.STAKE_PERCENTAGE.TIER_1 : h.STAKE_PERCENTAGE.TIER_2;
        percentage = Math.min(maxAllowed, Math.max(0.001, percentage));

        // Caution mode: halve the stake
        if (this.state.current_mode === h.MODES.CAUTION) {
            percentage *= CONFIG.BANKROLL.LOSS_STREAK_STAKE_MODIFIER;
        }

        const stake = this.state.current_balance * percentage;
        return Math.round(stake * 100) / 100;
    }

    approveBet(fixture, signal, approvedStake) {
        if (this.state.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.NO_BET) {
            return false;
        }

        const balanceBefore = Number(this.state.current_balance);
        const stake = Number(approvedStake);

        this.state.current_balance = balanceBefore - stake;
        console.log(`[BankrollManager] Bet Approved. Balance: ${balanceBefore} -> ${this.state.current_balance}`);

        // Extract primary strategy info
        const primaryStrat = signal?.activeStrategies?.[0] || {};
        const stratId = primaryStrat.id || 'GENERIC';
        const stratLabel = primaryStrat.label || signal?.reason || signal?.mainReason || 'Genel Strateji';

        const oddsTaken = Number(signal?.odds || signal?.marketOdds || signal?.bestEV?.marketOdds || fixture.odds?.home || 1.85);
        const marketName = signal?.suggestedMarket || signal?.market || primaryStrat.id || 'NEXT_GOAL';
        const scoreAtBet = { home: fixture.score?.home ?? 0, away: fixture.score?.away ?? 0 };

        this.addToLedger('BET_OPEN', {
            match_id: fixture.id,
            match_name: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            league: fixture.leagueName,
            tier: fixture.tier,
            stake_amount: stake,
            balance_before: balanceBefore,
            reason: signal?.reason || signal?.mainReason,
            strategy_id: stratId,
            strategy_label: stratLabel,
            market: marketName,
            odds_taken: oddsTaken,
            score_at_bet: scoreAtBet,
            is_settled: false
        });

        // Initialize strategy stats bucket
        if (!this.state.strategyStats) this.state.strategyStats = {};
        if (!this.state.strategyStats[stratId]) {
            this.state.strategyStats[stratId] = {
                id: stratId,
                label: stratLabel,
                icon: primaryStrat.icon || '🎯',
                totalBets: 0,
                wins: 0,
                losses: 0,
                staked: 0,
                returned: 0,
                profit: 0
            };
        }
        this.state.strategyStats[stratId].totalBets++;
        this.state.strategyStats[stratId].staked += stake;

        this.saveState(); // Explict save after ledger
        return true;
    }

    processResult(matchId, isWin, stake, odds = 2.0, clv = 0) {
        const profit = isWin ? stake * odds : 0; // Stake was already deducted
        const netProfit = isWin ? (stake * (odds - 1)) : -stake;
        const balanceBefore = this.state.current_balance;

        this.state.current_balance += profit;
        if (this.state.current_balance > this.state.max_balance_seen) {
            this.state.max_balance_seen = this.state.current_balance;
        }

        this.state.daily_pl += netProfit;
        this.state.daily_bet_count++;

        if (isWin) {
            this.state.win_streak++;
            this.state.loss_streak = 0;
        } else {
            this.state.loss_streak++;
            this.state.win_streak = 0;
            this.state.daily_loss_count++;
        }

        const openEntry = (this.state.ledger || []).slice().reverse().find(l => l.match_id === matchId && l.type === 'BET_OPEN');
        const stratId = openEntry?.strategy_id || 'GENERIC';

        if (!this.state.strategyStats) this.state.strategyStats = {};
        if (this.state.strategyStats[stratId]) {
            if (isWin) {
                this.state.strategyStats[stratId].wins++;
                this.state.strategyStats[stratId].returned += profit;
                this.state.strategyStats[stratId].profit += netProfit;
            } else {
                this.state.strategyStats[stratId].losses++;
                this.state.strategyStats[stratId].profit -= stake;
            }
        }

        // Track CLV (Closing Line Value)
        if (!this.state.clvStats) this.state.clvStats = { totalBets: 0, positiveCount: 0, sumCLV: 0 };
        if (clv !== 0 && clv !== undefined) {
            this.state.clvStats.totalBets++;
            this.state.clvStats.sumCLV += Number(clv);
            if (Number(clv) > 0) this.state.clvStats.positiveCount++;
        }

        this.addToLedger(isWin ? 'BET_WIN' : 'BET_LOSS', {
            match_id: matchId,
            match_name: openEntry?.match_name || 'Match',
            strategy_id: stratId,
            strategy_label: openEntry?.strategy_label || 'Strateji',
            stake,
            profit: netProfit,
            balance_before: balanceBefore,
            loss_streak: this.state.loss_streak,
            clv: clv || 0
        });

        this.checkModeTransitions();
        this.saveState();
    }

    getStrategyAnalytics() {
        const stats = this.state.strategyStats || {};
        const knownStrategies = [
            { id: 'PRESS', label: 'Baskı Dominasyonu', icon: '🔥' },
            { id: 'MOMENTUM', label: 'Son 15dk Patlaması', icon: '⚡' },
            { id: 'FHG', label: 'İY 0.5 Üst Erken Gol', icon: '🎯' },
            { id: 'COMEBACK', label: 'Erken Favori Geri Dönüş', icon: '🦁' },
            { id: 'ADV_COMEBACK', label: 'Geç Geri Dönüş Kuşatması', icon: '🏰' },
            { id: 'OVER_EXPOSURE', label: 'Aşırı Yüklenme (80+)', icon: '💣' },
            { id: 'STATS', label: 'Stat Dominasyonu', icon: '📊' },
            { id: 'CORNERS', label: 'Korner Baskısı', icon: '🚩' },
            { id: 'BTTS', label: 'KG Var Dinamiği', icon: '⚔️' },
            { id: 'RED_CARD_ADV', label: 'Sayısal Üstünlük', icon: '🟥' }
        ];

        const allIds = Array.from(new Set([...knownStrategies.map(k => k.id), ...Object.keys(stats)]));

        return allIds.map(id => {
            const known = knownStrategies.find(k => k.id === id);
            const s = stats[id] || {
                id,
                label: known?.label || id,
                icon: known?.icon || '🎯',
                totalBets: 0,
                wins: 0,
                losses: 0,
                staked: 0,
                returned: 0,
                profit: 0
            };

            const winRate = s.totalBets > 0 ? (s.wins / s.totalBets) * 100 : 0;
            const roi = s.staked > 0 ? (s.profit / s.staked) * 100 : 0;
            let badge = 'N/A';
            if (s.totalBets >= 3) {
                if (winRate >= 70) badge = 'A+';
                else if (winRate >= 50) badge = 'A';
                else badge = 'B';
            } else if (s.totalBets > 0) {
                badge = winRate >= 50 ? 'A' : 'B';
            }

            return {
                ...s,
                staked: parseFloat((s.staked || 0).toFixed(2)),
                profit: parseFloat((s.profit || 0).toFixed(2)),
                label: s.label || known?.label || id,
                icon: s.icon || known?.icon || '🎯',
                winRate: parseFloat(winRate.toFixed(1)),
                roi: parseFloat(roi.toFixed(1)),
                badge
            };
        });
    }

    getCLVAnalytics() {
        const stats = this.state.clvStats || { totalBets: 0, positiveCount: 0, sumCLV: 0 };
        const total = stats.totalBets || 0;
        const avgCLV = total > 0 ? (stats.sumCLV / total).toFixed(1) : '0.0';
        const beatMarketPct = total > 0 ? ((stats.positiveCount / total) * 100).toFixed(0) : '0';

        return {
            totalTracked: total,
            avgCLV: parseFloat(avgCLV),
            beatMarketPct: parseInt(beatMarketPct, 10),
            positiveCount: stats.positiveCount
        };
    }

    checkModeTransitions() {
        const h = CONFIG.BANKROLL.HIERARCHY;
        const prevMode = this.state.current_mode;
        let newMode = h.MODES.NORMAL;

        // EXPERT DISCIPLINE: Stop-Loss & Target Profit
        const dailyProfitPercent = (this.state.daily_pl / this.state.starting_balance);
        const targetReached = dailyProfitPercent >= 0.05; // %5 Kar Hedefi
        const stopLossReached = dailyProfitPercent <= -0.03; // %3 Zarar Durdur

        if (this.state.loss_streak >= h.THRESHOLDS.STOP_LOSS_STREAK ||
            this.state.daily_loss_count >= h.THRESHOLDS.DAILY_LOSS_LIMIT ||
            this.state.daily_bet_count >= h.THRESHOLDS.DAILY_BET_LIMIT ||
            targetReached || stopLossReached) {
            newMode = h.MODES.NO_BET;
        }
        else if (this.state.loss_streak >= h.THRESHOLDS.CAUTION_LOSS_STREAK) {
            newMode = h.MODES.CAUTION;
        }

        if (newMode !== prevMode) {
            this.state.current_mode = newMode;
            let reasonKey = 'stop_rules_reason';
            if (targetReached) reasonKey = 'SSS: Günlük %5 kar hedefine ulaşıldı. Kasa koruma modu aktif.';
            else if (stopLossReached) reasonKey = 'SSS: Günlük %3 zarar limitine ulaşıldı. Disiplin molası.';

            this.addToLedger('MODE_CHANGE', {
                from: prevMode,
                to: newMode,
                reason: reasonKey
            });
        }
    }

    getState() {
        // Return a copy to ensure React re-renders on state change
        return JSON.parse(JSON.stringify(this.state));
    }

    getModeLabel(lang) {
        const mode = this.state.current_mode;
        const t = translations[lang] || translations['tr'];
        if (mode === CONFIG.BANKROLL.HIERARCHY.MODES.NORMAL) return t.mode_normal;
        if (mode === CONFIG.BANKROLL.HIERARCHY.MODES.CAUTION) return t.mode_caution;
        if (mode === CONFIG.BANKROLL.HIERARCHY.MODES.NO_BET) return t.mode_no_bet;
        return mode;
    }

    reset() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('lbm_bankroll_state');
        }
        this.loadState();
    }
}

export const bankrollManager = new BankrollManager();
