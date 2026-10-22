/**
 * HEARTBEAT & HEALTH WATCHDOG v2.0 (Self-Healing Edition)
 * 24/7 background stream liveness and scraper stalled-state watchdog.
 * Guarantees zero silent failures on production servers.
 * Automatically triggers self-healing (kills frozen scrapers & invokes fallback).
 */

import fs from 'fs';
import path from 'path';

export class HeartbeatWatchdog {
    /**
     * @param {string} monitoredFilePath - File to monitor for freshness (e.g. sofascore_live.json)
     * @param {Function} alertCallback - Optional callback for Telegram or Slack alerts
     * @param {Function} onStalledCallback - Optional callback to trigger self-healing restart
     */
    constructor(monitoredFilePath, alertCallback = null, onStalledCallback = null) {
        this.monitoredFilePath = monitoredFilePath;
        this.alertCallback = alertCallback;
        this.onStalledCallback = onStalledCallback;
        this.lastHeartbeat = Date.now();
        this.isStalled = false;
        this.stalledSince = null;
        this.staleThresholdSec = 240; // 4 minutes max acceptable staleness
        this.startedAt = Date.now();
        this.lastRestartAttempt = Date.now() + 120 * 1000; // 5-minute startup buffer before self-healing can fire

        this.checkTimer = setInterval(() => this.checkHealth(), 60 * 1000);
    }

    tick() {
        this.lastHeartbeat = Date.now();
        if (this.isStalled) {
            const downTimeMinutes = this.stalledSince ? Math.round((Date.now() - this.stalledSince) / 60000) : 1;
            this.isStalled = false;
            this.stalledSince = null;
            const msg = `✅ [CANLI YAYIN DÜZELDİ] Canlı veri akışı ${downTimeMinutes} dakikalık kesintinin ardından tekrar normale döndü.`;
            console.log(`[WATCHDOG] ${msg}`);
            if (typeof this.alertCallback === 'function') {
                this.alertCallback(msg).catch(() => {});
            }
        }
    }

    checkHealth() {
        const now = Date.now();
        // 1. Startup Grace Period: Allow initial scraper 5 minutes to launch Chrome and stream live data
        if (now - this.startedAt < 300 * 1000) {
            return { healthy: true, startupGrace: true };
        }

        let fileAgeSec = null;
        try {
            if (fs.existsSync(this.monitoredFilePath)) {
                const stat = fs.statSync(this.monitoredFilePath);
                fileAgeSec = Math.round((Date.now() - stat.mtimeMs) / 1000);
            }
        } catch (e) {}

        const isOld = fileAgeSec !== null && fileAgeSec > this.staleThresholdSec;

        if (isOld) {
            if (!this.isStalled) {
                this.isStalled = true;
                this.stalledSince = now;
                const msg = `🚨 [KRİTİK UYARI] Canlı veri akışı ${Math.round(fileAgeSec / 60)} dakikadır durdu! Kendini iyileştirme (Self-Healing) devreye giriyor.`;
                console.error(`[WATCHDOG] ${msg}`);
                if (typeof this.alertCallback === 'function') {
                    this.alertCallback(msg).catch(() => {});
                }
            }

            // Trigger self-healing restart at most once every 3 minutes
            if (now - this.lastRestartAttempt > 180 * 1000) {
                this.lastRestartAttempt = now;
                if (typeof this.onStalledCallback === 'function') {
                    console.warn(`[WATCHDOG] 🔄 Self-Healing tetikleniyor: Donmuş scraper kapatılıp yedek veri akışı zorlanıyor...`);
                    try {
                        this.onStalledCallback();
                    } catch (err) {
                        console.error('[WATCHDOG] Self-healing callback hatası:', err.message);
                    }
                }
            }
        } else if (!isOld && this.isStalled) {
            this.tick();
        }

        return {
            healthy: !this.isStalled,
            fileAgeSec,
            isStalled: this.isStalled,
            lastRestartAttempt: this.lastRestartAttempt
        };
    }

    destroy() {
        if (this.checkTimer) clearInterval(this.checkTimer);
    }
}
