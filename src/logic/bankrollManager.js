/**
 * BANKROLL MANAGER - Phase 13 & v3.0 Master Portfolio Suite
 * Handles binding discipline, stake calculation, fractional Kelly,
 * multi-profile risk, gamification badges, Bankroll IQ, and append-only ledger.
 */

import { CONFIG } from '../config.js';
import { translations } from '../locales/translations.js';

export const BADGE_DEFINITIONS = [
    {
        id: 'WELCOME_TRADER',
        title: 'Analitik Başlangıç',
        icon: '🌱',
        description: 'Sanal portföy laboratuvarını başlattı ve ilk stratejisini oluşturdu.',
        category: 'STARTER'
    },
    {
        id: 'IRON_WILL',
        title: 'Çelik İrade',
        icon: '🛡️',
        description: 'Stop-loss veya temkinli mod sınırına saygı gösterip sermayesini korudu.',
        category: 'DISCIPLINE'
    },
    {
        id: 'SNIPER',
        title: 'Keskin Nişancı',
        icon: '🎯',
        description: 'Art arda 4 veya daha fazla kazanan simülasyon işlemi gerçekleştirdi.',
        category: 'ACCURACY'
    },
    {
        id: 'COMPOUND_MASTER',
        title: 'Bileşik Büyücü',
        icon: '🧙‍♂️',
        description: 'Portföyünü pozitif getiri eğrisinde istikrarlı şekilde büyüttü.',
        category: 'GROWTH'
    },
    {
        id: 'DISCIPLINE_LOCK',
        title: 'Hedef Kilitleyici',
        icon: '🔒',
        description: 'Günlük kâr hedefine ulaşıp kurala uyarak günü yeşil kapattı.',
        category: 'DISCIPLINE'
    },
    {
        id: 'QUANT_SCHOLAR',
        title: 'Kuant Bilgini',
        icon: '🧬',
        description: '10 veya daha fazla simülasyon işlemini detaylı inceledi.',
        category: 'EXPERIENCE'
    },
    {
        id: 'WHALE',
        title: 'Portföy Mimarı',
        icon: '💎',
        description: 'Sanal sermayesini başlangıç bakiyesinden %25 veya daha fazla büyüttü.',
        category: 'GROWTH'
    }
];

export const RISK_PROFILES = {
    CONSERVATIVE: {
        id: 'CONSERVATIVE',
        label: 'Muhafazakar Fon',
        maxStakePct: 0.01, // %1
        kellyMultiplier: 0.15,
        targetDailyPct: 0.03, // %3
        stopLossPct: 0.02, // %2
        color: '#10b981',
        icon: '🛡️',
        description: 'Sermaye koruma odaklı, düşük dalgalanmalı kurumsal fon disiplini.'
    },
    BALANCED: {
        id: 'BALANCED',
        label: 'Dengeli Radar',
        maxStakePct: 0.025, // %2.5
        kellyMultiplier: 0.25,
        targetDailyPct: 0.05, // %5
        stopLossPct: 0.03, // %3
        color: '#38bdf8',
        icon: '⚖️',
        description: 'Değerli oran ve standart fraksiyonel Kelly dengesi.'
    },
    DYNAMIC: {
        id: 'DYNAMIC',
        label: 'Dinamik Fırsat',
        maxStakePct: 0.035, // %3.5
        kellyMultiplier: 0.35,
        targetDailyPct: 0.08, // %8
        stopLossPct: 0.04, // %4
        color: '#f59e0b',
        icon: '⚡',
        description: 'Yüksek xG ve momentum fırsatlarına odaklı dinamik simülasyon.'
    }
};

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
            },
            risk_profile: 'BALANCED',
            nickname: 'Analist_' + Math.floor(1000 + Math.random() * 9000),
            bankroll_iq: 85,
            badges: ['WELCOME_TRADER'],
            target_daily_profit_pct: 0.05,
            stop_loss_pct: 0.03
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
                    processedToday: parsed.processedToday || {},
                    badges: parsed.badges && parsed.badges.length > 0 ? parsed.badges : defaultState.badges,
                    risk_profile: parsed.risk_profile || defaultState.risk_profile,
                    nickname: parsed.nickname || defaultState.nickname,
                    bankroll_iq: parsed.bankroll_iq || defaultState.bankroll_iq
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
        if (fullKelly <= 0) return 0;

        // Use profile-based Kelly multiplier (Conservative: 0.15, Balanced: 0.25, Dynamic: 0.35)
        const profileKey = this.state.risk_profile || 'BALANCED';
        const profile = RISK_PROFILES[profileKey] || RISK_PROFILES.BALANCED;
        let percentage = fullKelly * (profile.kellyMultiplier || 0.25);

        // Safety Caps based on risk profile
        const maxAllowed = profile.maxStakePct || (fixture.tier === 1 ? h.STAKE_PERCENTAGE.TIER_1 : h.STAKE_PERCENTAGE.TIER_2);
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

        const rawOdds = signal?.odds || signal?.marketOdds || signal?.bestEV?.marketOdds || fixture.odds?.home;
        const oddsTaken = (rawOdds && Number(rawOdds) > 1.0) ? Number(rawOdds) : null;
        const marketName = signal?.suggestedMarket || signal?.market || primaryStrat.id || 'NEXT_GOAL';
        const scoreAtBet = { home: fixture.score?.home ?? 0, away: fixture.score?.away ?? 0 };

        this.addToLedger('BET_OPEN', {
            match_id: fixture.id,
            match_name: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            league: fixture.leagueName,
            tier: fixture.tier,
            stake_amount: stake,
            stake: stake,
            status: 'OPEN',
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

    processResult(matchIdOrBetId, isWin, stake, odds = 2.0, clv = 0) {
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

        // Find the open entry by either id or match_id
        const openEntry = (this.state.ledger || []).slice().reverse().find(l => 
            (String(l.id) === String(matchIdOrBetId) || String(l.match_id) === String(matchIdOrBetId)) && 
            (l.type === 'BET_OPEN' || l.status === 'OPEN') && 
            !l.is_settled
        );
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

        if (openEntry) {
            // Update the existing entry in-place so no duplicate rows appear
            openEntry.is_settled = true;
            openEntry.status = isWin ? 'WIN' : 'LOSS';
            openEntry.outcome = isWin ? 'WON' : 'LOST';
            openEntry.profit = netProfit;
            openEntry.settled_at = new Date().toISOString();
            openEntry.clv = clv || openEntry.clv || 0;
            openEntry.balance_after = this.state.current_balance;
        } else {
            this.addToLedger(isWin ? 'BET_WIN' : 'BET_LOSS', {
                match_id: matchIdOrBetId,
                match_name: 'Match',
                match: 'Match',
                status: isWin ? 'WIN' : 'LOSS',
                type: 'SETTLEMENT',
                strategy_id: stratId,
                strategy_label: 'Strateji',
                stake,
                profit: netProfit,
                balance_before: balanceBefore,
                loss_streak: this.state.loss_streak,
                clv: clv || 0
            });
        }

        this.checkModeTransitions();
        this.saveState();
    }

    voidBet(betIdOrMatchId, reason = 'İade / İptal') {
        const openEntry = (this.state.ledger || []).slice().reverse().find(l => 
            (String(l.id) === String(betIdOrMatchId) || String(l.match_id) === String(betIdOrMatchId)) && 
            (l.type === 'BET_OPEN' || l.status === 'OPEN') && 
            !l.is_settled
        );
        if (!openEntry) return false;

        const stake = Number(openEntry.stake || openEntry.stake_amount || 0);
        this.state.current_balance += stake; // Refund stake back to cash
        openEntry.is_settled = true;
        openEntry.status = 'VOID';
        openEntry.outcome = 'VOID';
        openEntry.profit = 0;
        openEntry.reason = reason;
        openEntry.settled_at = new Date().toISOString();
        openEntry.balance_after = this.state.current_balance;

        this.saveState();
        return true;
    }

    manualSettle(betIdOrMatchId, outcome, customOdds = null) {
        if (outcome === 'VOID') {
            return this.voidBet(betIdOrMatchId);
        }
        const openEntry = (this.state.ledger || []).slice().reverse().find(l => 
            (String(l.id) === String(betIdOrMatchId) || String(l.match_id) === String(betIdOrMatchId)) && 
            (l.type === 'BET_OPEN' || l.status === 'OPEN') && 
            !l.is_settled
        );
        const stake = Number(openEntry?.stake || openEntry?.stake_amount || 100);
        const odds = customOdds ? Number(customOdds) : (Number(openEntry?.odds_taken) > 1.0 ? Number(openEntry?.odds_taken) : 1.85);
        this.processResult(openEntry?.id || betIdOrMatchId, outcome === 'WIN', stake, odds);
        return true;
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

        const profileKey = this.state.risk_profile || 'BALANCED';
        const profile = RISK_PROFILES[profileKey] || RISK_PROFILES.BALANCED;
        const targetDailyPct = profile.targetDailyPct || 0.05;
        const stopLossPct = profile.stopLossPct || 0.03;

        // EXPERT DISCIPLINE: Stop-Loss & Target Profit
        const dailyProfitPercent = (this.state.daily_pl / (this.state.starting_balance || 2000));
        const targetReached = dailyProfitPercent >= targetDailyPct;
        const stopLossReached = dailyProfitPercent <= -stopLossPct;

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
            if (targetReached) reasonKey = `Hedef Kilitlendi: Günlük %${(targetDailyPct * 100).toFixed(0)} kâr hedefine ulaşıldı. Kasa koruma kalkanı aktif.`;
            else if (stopLossReached) reasonKey = `Disiplin Molası: Günlük %${(stopLossPct * 100).toFixed(0)} zarar sınırına ulaşıldı. Risk durduruldu.`;

            this.addToLedger('MODE_CHANGE', {
                from: prevMode,
                to: newMode,
                reason: reasonKey
            });
        }

        this.checkBadges();
    }

    /**
     * Calculates 0-100 Bankroll IQ (Discipline Score)
     */
    calculateBankrollIQ() {
        let score = 75;
        const settled = (this.state.ledger || []).filter(l => l.is_settled);
        const total = settled.length;
        const wins = settled.filter(l => l.status === 'WIN' || l.outcome === 'WON').length;
        const winRate = total > 0 ? (wins / total) * 100 : 50;

        // Win rate impact
        score += Math.round((winRate - 50) * 0.35);

        // Badges bonus (+2.5 each)
        const badgeCount = (this.state.badges || []).length;
        score += Math.min(12, Math.round(badgeCount * 2.5));

        // Daily discipline bonus: If target reached or positive growth
        if (this.state.daily_pl > 0) score += 6;
        if (this.state.win_streak >= 3) score += 5;

        // Drawdown / Tilt penalties
        if (this.state.loss_streak >= 3) score -= 15;
        else if (this.state.loss_streak >= 2) score -= 7;

        if (this.state.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.CAUTION) score -= 4;

        score = Math.min(100, Math.max(25, score));

        let grade = 'B';
        let label = 'Dengeli Analist';
        let color = '#38bdf8';

        if (score >= 90) {
            grade = 'A+';
            label = 'Elit Fon Mimarı';
            color = '#10b981';
        } else if (score >= 80) {
            grade = 'A';
            label = 'Disiplinli Kuant Analist';
            color = '#34d399';
        } else if (score >= 70) {
            grade = 'B';
            label = 'Gelişen Stratejist';
            color = '#38bdf8';
        } else {
            grade = 'C';
            label = 'Risk Eğitimi Önerilir';
            color = '#f59e0b';
        }

        return { score, grade, label, color, winRate: parseFloat(winRate.toFixed(1)) };
    }

    /**
     * Checks criteria for all badges and unlocks newly earned ones
     */
    checkBadges() {
        if (!this.state.badges) this.state.badges = ['WELCOME_TRADER'];
        const current = new Set(this.state.badges);
        const newlyUnlocked = [];

        const settled = (this.state.ledger || []).filter(l => l.is_settled);
        const totalSettled = settled.length;
        const startBal = this.state.starting_balance || 2000;
        const dailyProfitPercent = (this.state.daily_pl / startBal);
        const totalGrowthPercent = ((this.state.current_balance - startBal) / startBal);

        if (!current.has('WELCOME_TRADER')) {
            current.add('WELCOME_TRADER');
            newlyUnlocked.push('WELCOME_TRADER');
        }
        if (this.state.win_streak >= 4 && !current.has('SNIPER')) {
            current.add('SNIPER');
            newlyUnlocked.push('SNIPER');
        }
        if ((this.state.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.CAUTION || this.state.daily_loss_count >= 1) && !current.has('IRON_WILL')) {
            current.add('IRON_WILL');
            newlyUnlocked.push('IRON_WILL');
        }
        if (dailyProfitPercent >= 0.049 && !current.has('DISCIPLINE_LOCK')) {
            current.add('DISCIPLINE_LOCK');
            newlyUnlocked.push('DISCIPLINE_LOCK');
        }
        if (totalSettled >= 10 && !current.has('QUANT_SCHOLAR')) {
            current.add('QUANT_SCHOLAR');
            newlyUnlocked.push('QUANT_SCHOLAR');
        }
        if (totalGrowthPercent >= 0.10 && !current.has('COMPOUND_MASTER')) {
            current.add('COMPOUND_MASTER');
            newlyUnlocked.push('COMPOUND_MASTER');
        }
        if (totalGrowthPercent >= 0.25 && !current.has('WHALE')) {
            current.add('WHALE');
            newlyUnlocked.push('WHALE');
        }

        this.state.badges = Array.from(current);
        this.state.bankroll_iq = this.calculateBankrollIQ().score;
        return newlyUnlocked;
    }

    /**
     * Returns daily progress towards %5 target and %3 stop loss
     */
    getDailyProgress() {
        const starting = this.state.starting_balance || 2000;
        const dailyPL = this.state.daily_pl || 0;
        const dailyPLPct = (dailyPL / starting) * 100;
        const profileKey = this.state.risk_profile || 'BALANCED';
        const profile = RISK_PROFILES[profileKey] || RISK_PROFILES.BALANCED;
        const targetPct = (profile.targetDailyPct || 0.05) * 100;
        const stopLossPct = (profile.stopLossPct || 0.03) * 100;

        let progressPct = 0;
        if (dailyPLPct > 0) {
            progressPct = Math.min(100, (dailyPLPct / targetPct) * 100);
        }

        const isTargetReached = dailyPLPct >= targetPct;
        const isStopLossReached = dailyPLPct <= -stopLossPct;

        return {
            dailyPL,
            dailyPLPct: parseFloat(dailyPLPct.toFixed(2)),
            targetPct,
            stopLossPct,
            progressPct: parseFloat(progressPct.toFixed(1)),
            isTargetReached,
            isStopLossReached,
            profile
        };
    }

    /**
     * Compound Growth Simulator Engine
     */
    getProjectedGrowth(days = 30, dailyTargetPct = 2, customStartingBalance = null) {
        const initial = Number(customStartingBalance) || Number(this.state.starting_balance) || 2000;
        const rate = (Number(dailyTargetPct) || 2) / 100;
        const points = [];
        let current = initial;

        for (let day = 0; day <= days; day++) {
            points.push({
                day,
                balance: Math.round(current * 100) / 100,
                growthPct: Math.round(((current - initial) / initial) * 1000) / 10
            });
            current = current * (1 + rate);
        }

        const finalBalance = points[points.length - 1].balance;
        const totalGrowthPct = points[points.length - 1].growthPct;
        const netGain = Math.round((finalBalance - initial) * 100) / 100;

        return {
            initial,
            days,
            dailyTargetPct,
            finalBalance,
            totalGrowthPct,
            netGain,
            points
        };
    }

    /**
     * Weekly Analyst League Leaderboard
     */
    getLeaderboard() {
        const userIQ = this.calculateBankrollIQ();
        const settled = (this.state.ledger || []).filter(l => l.is_settled);
        const wins = settled.filter(l => l.status === 'WIN' || l.outcome === 'WON').length;
        const total = settled.length;
        const userWinRate = total > 0 ? (wins / total) * 100 : 64.0;
        const userROI = this.state.starting_balance > 0 
            ? ((this.state.current_balance - this.state.starting_balance) / this.state.starting_balance) * 100 
            : 0;

        const baseAnalysts = [
            { id: '1', nickname: 'KuantAlpha', roi: 24.8, winRate: 78.4, bankrollIQ: 98, badge: '👑 Elit Analist', tier: 'PRO', avatar: '🦅' },
            { id: '2', nickname: 'MomentumSniper', roi: 19.5, winRate: 74.0, bankrollIQ: 95, badge: '🎯 Keskin', tier: 'VIP', avatar: '⚡' },
            { id: '3', nickname: 'DemirDisiplin', roi: 16.2, winRate: 71.5, bankrollIQ: 96, badge: '🛡️ Koruyucu', tier: 'PRO', avatar: '🛡️' },
            { id: '4', nickname: 'BarlasKuant', roi: 14.1, winRate: 69.2, bankrollIQ: 91, badge: '🧙‍♂️ Büyücü', tier: 'VIP', avatar: '🔮' },
            { id: '5', nickname: 'VeriUzmani_34', roi: 11.8, winRate: 66.7, bankrollIQ: 89, badge: '📊 İstatistikçi', tier: 'PRO', avatar: '📈' },
            { id: '6', nickname: 'Sarp_Kelly', roi: 9.4, winRate: 64.1, bankrollIQ: 88, badge: '⚖️ Kelly Fan', tier: 'COMMUNITY', avatar: '🎯' },
            { id: '7', nickname: 'Eren_Algo', roi: 7.2, winRate: 61.5, bankrollIQ: 86, badge: '🧬 Kuant', tier: 'COMMUNITY', avatar: '🧠' },
            { id: '8', nickname: 'RiskYoneticisi', roi: 5.5, winRate: 60.0, bankrollIQ: 85, badge: '💼 Fon Koçu', tier: 'COMMUNITY', avatar: '💼' }
        ];

        const userEntry = {
            id: 'user_current',
            isCurrentUser: true,
            nickname: this.state.nickname || 'Sen (Portföyün)',
            roi: parseFloat(userROI.toFixed(1)),
            winRate: parseFloat(userWinRate.toFixed(1)),
            bankrollIQ: userIQ.score,
            badge: userIQ.label,
            tier: 'YOU',
            avatar: '🚀'
        };

        const all = [...baseAnalysts, userEntry].sort((a, b) => {
            const scoreA = a.roi * 1.5 + a.bankrollIQ * 0.5;
            const scoreB = b.roi * 1.5 + b.bankrollIQ * 0.5;
            return scoreB - scoreA;
        });

        return all.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }

    /**
     * Custom Starting Capital and Risk Profile configuration
     */
    setInitialCapital(amount, profile = 'BALANCED') {
        const numAmount = Math.max(100, Number(amount) || 2000);
        this.state.starting_balance = numAmount;
        this.state.current_balance = numAmount;
        this.state.max_balance_seen = numAmount;
        this.state.daily_pl = 0;
        this.state.win_streak = 0;
        this.state.loss_streak = 0;
        this.state.current_mode = CONFIG.BANKROLL.HIERARCHY.MODES.NORMAL;
        this.state.risk_profile = profile;
        this.saveState();
        this.addToLedger('CAPITAL_CONFIGURED', {
            starting_balance: numAmount,
            profile,
            reason: 'Kullanıcı sanal sermaye ve risk profili ataması'
        });
        return this.getState();
    }

    setRiskProfile(profile) {
        if (RISK_PROFILES[profile]) {
            this.state.risk_profile = profile;
            this.saveState();
        }
        return this.state.risk_profile;
    }

    setNickname(name) {
        if (name && typeof name === 'string' && name.trim().length > 0) {
            this.state.nickname = name.trim().substring(0, 20);
            this.saveState();
        }
        return this.state.nickname;
    }

    getState() {
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

    reset(startingBalance = null) {
        const profile = this.state?.risk_profile || 'BALANCED';
        const nickname = this.state?.nickname || ('Analist_' + Math.floor(1000 + Math.random() * 9000));
        const balance = startingBalance || this.state?.starting_balance || CONFIG.BANKROLL.HIERARCHY.INITIAL_BALANCE || 2000;

        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('lbm_bankroll_state');
        }
        const defaultState = {
            starting_balance: balance,
            current_balance: balance,
            max_balance_seen: balance,
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
            },
            risk_profile: profile,
            nickname: nickname,
            bankroll_iq: 85,
            badges: ['WELCOME_TRADER'],
            target_daily_profit_pct: 0.05,
            stop_loss_pct: 0.03
        };
        this.state = defaultState;
        this.saveState();
        this.addToLedger('SYSTEM_INIT', {
            balance: defaultState.starting_balance,
            reason: 'system_init_reason'
        });
    }
}

export const bankrollManager = new BankrollManager();
