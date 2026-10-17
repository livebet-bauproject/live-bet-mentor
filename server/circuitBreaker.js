/**
 * CIRCUIT BREAKER & RISK GUARD v1.0
 * Financial-grade volatility and drawdown protection engine.
 * Protects user bankrolls against bad variance cascades and chaotic market conditions.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { SafeStore } from './safeStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, 'circuit_breaker_state.json');

export class CircuitBreaker {
    constructor() {
        this.store = new SafeStore(STATE_FILE, 3000);
        this.consecutiveLosses = this.store.get('consecutiveLosses') || 0;
        this.dailyLossCount = this.store.get('dailyLossCount') || 0;
        this.lastDailyReset = this.store.get('lastDailyReset') || Date.now();
        this.isHalted = Boolean(this.store.get('isHalted'));
        this.haltUntil = this.store.get('haltUntil') || 0;
        this.haltReason = this.store.get('haltReason') || '';

        // Risk Configuration
        this.CONSECUTIVE_LOSS_LIMIT = 3;       // 3 losses in a row -> 90 min cool-off
        this.DAILY_LOSS_LIMIT = 5;             // Max 5 losses in 24h -> day stop
        this.MAX_OPEN_EXPOSURE = 3;            // Max 3 concurrent open live signals
        this.COOLOFF_DURATION_MS = 90 * 60 * 1000; // 90 minutes

        this.openSignals = new Map();
        this.checkDailyReset();
    }

    checkDailyReset() {
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (now - this.lastDailyReset > oneDayMs) {
            this.dailyLossCount = 0;
            this.lastDailyReset = now;
            this.syncState();
        }
    }

    syncState() {
        this.store.set('consecutiveLosses', this.consecutiveLosses);
        this.store.set('dailyLossCount', this.dailyLossCount);
        this.store.set('lastDailyReset', this.lastDailyReset);
        this.store.set('isHalted', this.isHalted);
        this.store.set('haltUntil', this.haltUntil);
        this.store.set('haltReason', this.haltReason);
    }

    canDispatchSignal() {
        this.checkDailyReset();
        const now = Date.now();

        // 1. Is circuit breaker currently active?
        if (this.isHalted) {
            if (now < this.haltUntil) {
                const remainingMins = Math.ceil((this.haltUntil - now) / 60000);
                return {
                    allowed: false,
                    reason: `🛑 Devre Kesici devrede! ${this.haltReason} (${remainingMins} dk soğuma kaldı)`
                };
            }
            // Cooldown expired, lift halt
            this.isHalted = false;
            this.haltUntil = 0;
            this.haltReason = '';
            this.consecutiveLosses = 0;
            this.syncState();
            console.log('[CIRCUIT_BREAKER] 🟢 Devre kesici soğuma süresi bitti. Sistem tekrar normal sinyal akışında.');
        }

        // 2. Daily Loss Ceiling
        if (this.dailyLossCount >= this.DAILY_LOSS_LIMIT) {
            return {
                allowed: false,
                reason: `🛑 Günlük maksimum kayıp sınırına (${this.DAILY_LOSS_LIMIT}) ulaşıldı. Bugünlük sinyal üretimi kilitli.`
            };
        }

        // 3. Max Concurrent In-Play Exposure
        this.cleanupStaleOpenSignals();
        if (this.openSignals.size >= this.MAX_OPEN_EXPOSURE) {
            return {
                allowed: false,
                reason: `⚠️ Eşzamanlı maksimum risk tavanı (${this.MAX_OPEN_EXPOSURE} açık maç) dolu. Pozisyonların netleşmesi bekleniyor.`
            };
        }

        return { allowed: true };
    }

    registerOpenSignal(signalId, matchId) {
        this.openSignals.set(String(matchId), {
            signalId,
            matchId: String(matchId),
            timestamp: Date.now()
        });
    }

    recordResult(matchId, isWin) {
        this.openSignals.delete(String(matchId));
        this.checkDailyReset();

        if (isWin) {
            this.consecutiveLosses = 0;
            console.log(`[CIRCUIT_BREAKER] ✅ Kazanç kaydedildi. Seri sıfırlandı.`);
        } else {
            this.consecutiveLosses++;
            this.dailyLossCount++;
            console.warn(`[CIRCUIT_BREAKER] ⚠️ Kayıp kaydedildi. (Ardışık: ${this.consecutiveLosses}/${this.CONSECUTIVE_LOSS_LIMIT}, Günlük: ${this.dailyLossCount}/${this.DAILY_LOSS_LIMIT})`);

            if (this.consecutiveLosses >= this.CONSECUTIVE_LOSS_LIMIT) {
                this.isHalted = true;
                this.haltUntil = Date.now() + this.COOLOFF_DURATION_MS;
                this.haltReason = `Ardışık ${this.consecutiveLosses} kayıp sonrası sermaye koruma devreye girdi.`;
                console.error(`[CIRCUIT_BREAKER] 🚨 DEVRE KESİCİ TRİPLENDİ! Sistem 90 dakika sinyal göndermeyecek.`);
            }
        }
        this.syncState();
    }

    cleanupStaleOpenSignals() {
        const now = Date.now();
        const maxMatchAgeMs = 120 * 60 * 1000; // 2 hours
        for (const [id, data] of this.openSignals.entries()) {
            if (now - data.timestamp > maxMatchAgeMs) {
                this.openSignals.delete(id);
            }
        }
    }

    getStatus() {
        this.checkDailyReset();
        const now = Date.now();
        const isCurrentlyHalted = this.isHalted && now < this.haltUntil;
        const remainingMinutes = isCurrentlyHalted ? Math.ceil((this.haltUntil - now) / 60000) : 0;

        return {
            isHalted: isCurrentlyHalted,
            remainingMinutes,
            haltReason: this.haltReason,
            consecutiveLosses: this.consecutiveLosses,
            consecutiveLimit: this.CONSECUTIVE_LOSS_LIMIT,
            dailyLossCount: this.dailyLossCount,
            dailyLimit: this.DAILY_LOSS_LIMIT,
            openExposureCount: this.openSignals.size,
            maxExposureLimit: this.MAX_OPEN_EXPOSURE
        };
    }
}

export const circuitBreaker = new CircuitBreaker();
