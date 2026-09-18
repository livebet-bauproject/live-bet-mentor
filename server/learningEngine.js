/**
 * LEARNING ENGINE v1.0
 * Self-learning & self-correcting quant feedback system.
 * Continuously evaluates prediction outcomes, recalibrates league and market multipliers,
 * diagnoses systemic loss patterns, and auto-quarantines low-performing segments.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEIGHTS_FILE = path.join(__dirname, 'dynamic_weights.json');
const HISTORY_FILE = path.join(__dirname, 'telegram_signal_history.json');

class LearningEngine {
    constructor() {
        this.weightsFile = WEIGHTS_FILE;
        this.weights = this._loadWeights();
        
        // Auto-bootstrap from existing signal history if first run
        if (this._isFresh()) {
            this.bootstrapFromHistory();
        }
    }

    _loadWeights() {
        try {
            if (fs.existsSync(this.weightsFile)) {
                return JSON.parse(fs.readFileSync(this.weightsFile, 'utf8'));
            }
        } catch (e) {
            console.error('[LEARNING ENGINE] Error loading weights file:', e.message);
        }

        return this._getDefaultWeights();
    }

    _saveWeights() {
        try {
            this.weights.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.weightsFile, JSON.stringify(this.weights, null, 2), 'utf8');
        } catch (e) {
            console.error('[LEARNING ENGINE] Error saving weights file:', e.message);
        }
    }

    _isFresh() {
        return !this.weights.leagues || Object.keys(this.weights.leagues).length === 0;
    }

    _getDefaultWeights() {
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            stats: {
                totalLearned: 0,
                totalWon: 0,
                totalLost: 0,
                globalWinRate: 0.0
            },
            leagues: {},
            markets: {},
            minuteWindows: {
                '15-30': { total: 0, won: 0, lost: 0, winRate: 0.0, multiplier: 1.0 },
                '31-45': { total: 0, won: 0, lost: 0, winRate: 0.0, multiplier: 1.0 },
                '46-60': { total: 0, won: 0, lost: 0, winRate: 0.0, multiplier: 1.0 },
                '61-75': { total: 0, won: 0, lost: 0, winRate: 0.0, multiplier: 1.0 },
                '76-90': { total: 0, won: 0, lost: 0, winRate: 0.0, multiplier: 1.0 }
            },
            lossDiagnoses: {},
            activeQuarantines: [],
            circuitBreakers: {
                minMultiplier: 0.35,
                maxMultiplier: 1.30,
                learningRate: 0.08,
                minSampleSizeForQuarantine: 4,
                quarantineThresholdWinRate: 35.0, // Under 35% win rate over 4+ matches -> Quarantine
                quarantineDurationDays: 7
            }
        };
    }

    /**
     * Normalize league name to prevent fragmentation
     */
    _cleanLeague(name) {
        if (!name) return 'UNKNOWN_LEAGUE';
        return name.trim().replace(/\s+/g, ' ');
    }

    /**
     * Map raw market string to standardized learning category
     */
    _normalizeMarket(marketStr) {
        if (!marketStr) return 'GENERAL_GOAL';
        const m = marketStr.toLowerCase();
        if (m.includes('üst') || m.includes('over')) return 'OVER_GOALS';
        if (m.includes('karşılıklı') || m.includes('kg var') || m.includes('btts')) return 'BTTS';
        if (m.includes('comeback') || m.includes('geri dönüş')) return 'COMEBACK';
        if (m.includes('press') || m.includes('baskı')) return 'PRESS';
        if (m.includes('dominasyon')) return 'STAT_DOMINANCE';
        if (m.includes('deplasman') || m.includes('away')) return 'NEXT_GOAL_AWAY';
        if (m.includes('ev') || m.includes('home')) return 'NEXT_GOAL_HOME';
        if (m.includes('kazanmaya yakın') || m.includes('maç sonu') || m.includes('ms 1') || m.includes('ms 2') || m.includes('match winner')) return 'FAV_WIN';
        return 'NEXT_GOAL_HOME';
    }

    /**
     * Determine minute window key
     */
    _getMinuteWindow(minute) {
        const min = parseInt(minute) || 35;
        if (min <= 30) return '15-30';
        if (min <= 45) return '31-45';
        if (min <= 60) return '46-60';
        if (min <= 75) return '61-75';
        return '76-90';
    }

    /**
     * Record a newly resolved signal outcome into the knowledge base
     */
    recordSignalResult(signal, result, finalScore = null, matchStats = null) {
        if (!signal || !result || (result !== 'WON' && result !== 'LOST')) return;

        const isWon = result === 'WON';
        const league = this._cleanLeague(signal.league || signal.leagueName || 'GENEL');
        const marketKey = this._normalizeMarket(signal.market || signal.recommendation?.marketLabel);
        const winKey = this._getMinuteWindow(signal.minute);

        // 1. Update Global Stats
        this.weights.stats.totalLearned++;
        if (isWon) this.weights.stats.totalWon++;
        else this.weights.stats.totalLost++;
        this.weights.stats.globalWinRate = parseFloat(
            ((this.weights.stats.totalWon / this.weights.stats.totalLearned) * 100).toFixed(1)
        );

        // 2. Update League Stats
        if (!this.weights.leagues[league]) {
            this.weights.leagues[league] = {
                total: 0,
                won: 0,
                lost: 0,
                winRate: 0.0,
                multiplier: 1.0,
                quarantined: false,
                quarantinedUntil: null,
                lastEvaluated: new Date().toISOString()
            };
        }
        const lStat = this.weights.leagues[league];
        lStat.total++;
        if (isWon) lStat.won++;
        else lStat.lost++;
        lStat.winRate = parseFloat(((lStat.won / lStat.total) * 100).toFixed(1));
        lStat.lastEvaluated = new Date().toISOString();

        // 3. Update Market Stats
        if (!this.weights.markets[marketKey]) {
            this.weights.markets[marketKey] = {
                total: 0,
                won: 0,
                lost: 0,
                winRate: 0.0,
                multiplier: 1.0
            };
        }
        const mStat = this.weights.markets[marketKey];
        mStat.total++;
        if (isWon) mStat.won++;
        else mStat.lost++;
        mStat.winRate = parseFloat(((mStat.won / mStat.total) * 100).toFixed(1));

        // 4. Update Minute Window Stats
        if (this.weights.minuteWindows[winKey]) {
            const wStat = this.weights.minuteWindows[winKey];
            wStat.total++;
            if (isWon) wStat.won++;
            else wStat.lost++;
            wStat.winRate = parseFloat(((wStat.won / wStat.total) * 100).toFixed(1));
        }

        // 5. If Loss: Auto-Diagnose Root Cause
        if (!isWon) {
            const diagnosis = this._diagnoseLoss(signal, finalScore, matchStats);
            this.weights.lossDiagnoses[diagnosis] = (this.weights.lossDiagnoses[diagnosis] || 0) + 1;
        }

        // 6. Recalibrate Dynamic Multipliers with Circuit Breakers
        this.recalibrateWeights();

        console.log(`[LEARNING ENGINE] 🧠 Learned from ${signal.match} (${result}). Global Win Rate: %${this.weights.stats.globalWinRate}`);
    }

    /**
     * Root Cause Loss Diagnoser
     */
    _diagnoseLoss(signal, finalScore, matchStats) {
        const minute = parseInt(signal.minute) || 0;
        const scoreAtPred = signal.scoreAtPrediction || signal.score || '0-0';
        
        // If score never changed: deadlock game
        if (finalScore && finalScore === scoreAtPred) {
            if (minute < 25) return 'EARLY_GAME_STALEMATE';
            return 'ZERO_CONVERSION_STALEMATE';
        }

        if (minute < 25) {
            return 'EARLY_PHASE_VOLATILITY';
        }

        if (signal.level === 'SICAK' && (!matchStats || matchStats.shotsOnGoal < 3)) {
            return 'LOW_SHOT_CONVERSION';
        }

        return 'GENERAL_TACTICAL_RESISTANCE';
    }

    /**
     * Recalibrates dynamic weights, adjusts multipliers and checks quarantines
     */
    recalibrateWeights() {
        const { minMultiplier, maxMultiplier, learningRate, minSampleSizeForQuarantine, quarantineThresholdWinRate, quarantineDurationDays } = this.weights.circuitBreakers;
        const now = Date.now();

        // 1. Recalibrate Leagues
        const activeQuarantines = [];
        for (const [league, l] of Object.entries(this.weights.leagues)) {
            // Check if quarantine expired
            if (l.quarantined && l.quarantinedUntil) {
                if (now > new Date(l.quarantinedUntil).getTime()) {
                    l.quarantined = false;
                    l.quarantinedUntil = null;
                    l.multiplier = 0.85; // Give fresh recovery opportunity
                    console.log(`[LEARNING ENGINE] 🔓 Quarantine expired for league: ${league}`);
                }
            }

            // Laplace / Bayesian Smoothing: Prior = 55% with 3 pseudocounts
            const smoothedWinRate = ((l.won + 1.65) / (l.total + 3.0)) * 100;
            const diffFromNeutral = (smoothedWinRate - 55.0) / 100.0; // Positive if > 55%, Negative if < 55%

            // Dynamic Multiplier: 1.0 + (diff * learningRate * 5)
            const targetMultiplier = 1.0 + (diffFromNeutral * 0.5);
            l.multiplier = parseFloat(Math.min(maxMultiplier, Math.max(minMultiplier, targetMultiplier)).toFixed(2));

            // Auto-Quarantine Check
            if (l.total >= minSampleSizeForQuarantine && l.winRate < quarantineThresholdWinRate) {
                if (!l.quarantined) {
                    l.quarantined = true;
                    l.quarantinedUntil = new Date(now + (quarantineDurationDays * 24 * 3600 * 1000)).toISOString();
                    l.multiplier = minMultiplier;
                    console.warn(`[LEARNING ENGINE] 🚨 AUTO-QUARANTINED league ${league}: Win Rate %${l.winRate} over ${l.total} games`);
                }
            }

            if (l.quarantined) {
                activeQuarantines.push({ league, winRate: l.winRate, until: l.quarantinedUntil });
            }
        }
        this.weights.activeQuarantines = activeQuarantines;

        // 2. Recalibrate Markets
        for (const [market, m] of Object.entries(this.weights.markets)) {
            const smoothedWinRate = ((m.won + 1.65) / (m.total + 3.0)) * 100;
            const diffFromNeutral = (smoothedWinRate - 55.0) / 100.0;
            const targetMultiplier = 1.0 + (diffFromNeutral * 0.4);
            m.multiplier = parseFloat(Math.min(maxMultiplier, Math.max(minMultiplier, targetMultiplier)).toFixed(2));
        }

        // 3. Recalibrate Minute Windows
        for (const [winKey, w] of Object.entries(this.weights.minuteWindows)) {
            if (w.total >= 3) {
                const smoothedWinRate = ((w.won + 1.65) / (w.total + 3.0)) * 100;
                const diffFromNeutral = (smoothedWinRate - 55.0) / 100.0;
                w.multiplier = parseFloat(Math.min(maxMultiplier, Math.max(minMultiplier, 1.0 + (diffFromNeutral * 0.3))).toFixed(2));
            }
        }

        this._saveWeights();
    }

    /**
     * Get real-time multiplier for match scoring & filtering
     */
    getMultiplier(leagueName, marketStr, minute) {
        const league = this._cleanLeague(leagueName);
        const marketKey = this._normalizeMarket(marketStr);
        const winKey = this._getMinuteWindow(minute);

        // Check if quarantined
        const lStat = this.weights.leagues[league];
        if (lStat && lStat.quarantined) {
            return {
                allowed: false,
                multiplier: this.weights.circuitBreakers.minMultiplier,
                reason: `QUARANTINED_LEAGUE: %${lStat.winRate} win rate`
            };
        }

        const lMult = lStat?.multiplier || 1.0;
        const mMult = this.weights.markets[marketKey]?.multiplier || 1.0;
        const wMult = this.weights.minuteWindows[winKey]?.multiplier || 1.0;

        // Combined blend
        const combined = parseFloat((lMult * 0.5 + mMult * 0.3 + wMult * 0.2).toFixed(2));

        return {
            allowed: true,
            multiplier: Math.min(this.weights.circuitBreakers.maxMultiplier, Math.max(this.weights.circuitBreakers.minMultiplier, combined)),
            details: { leagueMultiplier: lMult, marketMultiplier: mMult, windowMultiplier: wMult }
        };
    }

    /**
     * Bootstrap training from historical signals (run once or upon request)
     */
    bootstrapFromHistory() {
        if (!fs.existsSync(HISTORY_FILE)) return;

        try {
            const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
            const data = JSON.parse(raw);
            const signals = data.dailyStats?.signals || [];

            console.log(`[LEARNING ENGINE] 🎓 Bootstrapping knowledge from ${signals.length} historical signals...`);

            signals.forEach(s => {
                if (s.status === 'WON' || s.status === 'LOST') {
                    this.recordSignalResult(s, s.status, s.resultScore);
                }
            });

            console.log(`[LEARNING ENGINE] ✅ Bootstrap complete: ${this.weights.stats.totalLearned} signals ingested. Global Win Rate: %${this.weights.stats.globalWinRate}`);
        } catch (e) {
            console.error('[LEARNING ENGINE] Error in bootstrap:', e.message);
        }
    }

    /**
     * Generate human-readable AI Learning Report for Telegram / API
     */
    generateReport() {
        const { stats, leagues, markets, minuteWindows, activeQuarantines, lossDiagnoses } = this.weights;

        const sortedLeagues = Object.entries(leagues)
            .sort((a, b) => (b[1].total - a[1].total) || (b[1].winRate - a[1].winRate))
            .slice(0, 5);

        const sortedMarkets = Object.entries(markets)
            .sort((a, b) => b[1].winRate - a[1].winRate);

        let report = `🧠 *YAPAY ZEKA ÖĞRENME RAPORU*\n`;
        report += `━━━━━━━━━━━━━━━━━━\n`;
        report += `📊 *Genel Deneyim:* ${stats.totalLearned} Sinyal\n`;
        report += `✅ Kazanan: ${stats.totalWon} | ❌ Kaybeden: ${stats.totalLost}\n`;
        report += `📈 *Kümülatif Başarı: %${stats.globalWinRate}*\n\n`;

        report += `🏆 *Strateji Performans Karnesi:*\n`;
        sortedMarkets.forEach(([m, s]) => {
            const icon = s.winRate >= 75 ? '🟢' : s.winRate >= 50 ? '🟡' : '🔴';
            report += `• ${icon} ${m}: *%${s.winRate}* (${s.won}/${s.total}) [Çarpan: ${s.multiplier}x]\n`;
        });

        if (activeQuarantines && activeQuarantines.length > 0) {
            report += `\n🚨 *Karantinadaki Ligler:*\n`;
            activeQuarantines.forEach(q => {
                report += `• ⛔ ${q.league} (Başarı: %${q.winRate})\n`;
            });
        } else {
            report += `\n🛡️ *Karantina Durumu:* Aktif ceza alan lig yok (Temiz).\n`;
        }

        report += `\n⏱️ *Zaman Penceresi Performansı:*\n`;
        Object.entries(minuteWindows).forEach(([win, w]) => {
            if (w.total > 0) {
                report += `• ${win}' Dk: %${w.winRate} (${w.won}/${w.total}) [${w.multiplier}x]\n`;
            }
        });

        report += `━━━━━━━━━━━━━━━━━━\n`;
        report += `🤖 *Canlı Otomatik Kalibrasyon Aktif*`;

        return report;
    }

    getReportJSON() {
        return {
            stats: this.weights.stats,
            leagues: this.weights.leagues,
            markets: this.weights.markets,
            minuteWindows: this.weights.minuteWindows,
            activeQuarantines: this.weights.activeQuarantines,
            lossDiagnoses: this.weights.lossDiagnoses,
            circuitBreakers: this.weights.circuitBreakers,
            lastUpdated: this.weights.lastUpdated
        };
    }
}

export const learningEngine = new LearningEngine();
