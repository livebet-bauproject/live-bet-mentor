/**
 * 🏢 AUTONOMOUS OFFICE ENGINE (v1.0)
 * 7/24 Server-Side Autonomous Background Agents:
 * 1. 🛡️ Sentinel Guardian (Nöbetçi) - Scraper health, lock management & risk quarantine
 * 2. 💰 Cashier Manager (Tahsildar) - Trial tracking, automated 2h expiry offers & conversion
 * 3. 📢 FOMO Marketing Engine (Pazarlamacı) - Social proof winning cards & daily public recaps
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { telegramBot } from './telegramBot.js';
import { vipManager } from './vipManager.js';
import { learningEngine } from './learningEngine.js';
import { cryptoPay } from './cryptoPay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_FILE = path.join(__dirname, 'office_action_logs.json');
const SOFASCORE_FILE = path.join(__dirname, 'sofascore_live.json');
const ODDS_FILE = path.join(__dirname, 'live_odds.json');
const CONSENSUS_FILE = path.join(__dirname, 'consensus_data.json');
const LOCKS_FILE = path.join(__dirname, 'engine_signal_locks.json');

export class AutonomousOffice {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.autoModeEnabled = true;
        this.actionLogs = [];
        this.loadLogs();

        this.stats = {
            sentinelScans: 0,
            cashierOffersSent: 0,
            fomoCardsDispatched: 0,
            lastTickAt: null
        };
    }

    loadLogs() {
        try {
            if (fs.existsSync(LOGS_FILE)) {
                this.actionLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
            } else {
                this.actionLogs = [];
            }
        } catch (e) {
            this.actionLogs = [];
        }
    }

    saveLogs() {
        try {
            // Retain last 100 entries
            if (this.actionLogs.length > 100) {
                this.actionLogs = this.actionLogs.slice(-100);
            }
            fs.writeFileSync(LOGS_FILE, JSON.stringify(this.actionLogs, null, 2), 'utf8');
        } catch (e) {
            console.error('[OFFICE] Error saving logs:', e.message);
        }
    }

    logAction(agent, level, message, details = null) {
        const entry = {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            agent, // 'SENTINEL' | 'CASHIER' | 'MARKETING' | 'OFFICE'
            level, // 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT'
            message,
            details
        };

        this.actionLogs.unshift(entry);
        if (this.actionLogs.length > 100) {
            this.actionLogs.pop();
        }
        this.saveLogs();

        const icons = {
            SENTINEL: '🛡️ [NÖBETÇİ]',
            CASHIER: '💰 [TAHSİLDAR]',
            MARKETING: '📢 [PAZARLAMACI]',
            OFFICE: '🏢 [OFİS]'
        };
        console.log(`[OFFICE] ${icons[agent] || agent} ${level}: ${message}`);
        return entry;
    }

    // ==========================================
    // 1. 🛡️ NÖBETÇİ (Sentinel Guardian)
    // ==========================================
    checkSentinelHealth() {
        this.stats.sentinelScans++;
        const now = Date.now();
        const result = {
            status: 'HEALTHY',
            sofascoreAgeSec: null,
            oddsAgeSec: null,
            consensusAgeSec: null,
            liveMatchCount: 0,
            quarantinedLeagues: [],
            warnings: []
        };

        // 1. Check SofaScore file age & match count
        try {
            if (fs.existsSync(SOFASCORE_FILE)) {
                const stat = fs.statSync(SOFASCORE_FILE);
                result.sofascoreAgeSec = Math.round((now - stat.mtimeMs) / 1000);
                const raw = JSON.parse(fs.readFileSync(SOFASCORE_FILE, 'utf8'));
                if (Array.isArray(raw)) {
                    result.liveMatchCount = raw.length;
                } else if (raw && Array.isArray(raw.events)) {
                    result.liveMatchCount = raw.events.length;
                }
            } else {
                result.warnings.push('SofaScore veri dosyası henüz oluşmadı');
            }
        } catch (e) {
            result.warnings.push(`SofaScore okuma hatası: ${e.message}`);
        }

        // 2. Check Odds file age
        try {
            if (fs.existsSync(ODDS_FILE)) {
                const stat = fs.statSync(ODDS_FILE);
                result.oddsAgeSec = Math.round((now - stat.mtimeMs) / 1000);
            }
        } catch (e) {}

        // 3. Check Consensus file age
        try {
            if (fs.existsSync(CONSENSUS_FILE)) {
                const stat = fs.statSync(CONSENSUS_FILE);
                result.consensusAgeSec = Math.round((now - stat.mtimeMs) / 1000);
            }
        } catch (e) {}

        // 4. Check Quarantined Leagues from LearningEngine
        try {
            if (learningEngine && learningEngine.weights && Array.isArray(learningEngine.weights.activeQuarantines)) {
                result.quarantinedLeagues = learningEngine.weights.activeQuarantines;
            }
        } catch (e) {}

        // 5. Evaluate overall health
        if (result.sofascoreAgeSec !== null && result.sofascoreAgeSec > 240) {
            result.status = 'STALLED';
            result.warnings.push(`SofaScore verisi ${Math.round(result.sofascoreAgeSec / 60)} dakikadır güncellenmedi.`);
            
            // Self-healing: Clean locks if stalled
            if (this.autoModeEnabled && result.sofascoreAgeSec > 360) {
                this.selfHealLocks();
            }
        } else if (result.sofascoreAgeSec !== null && result.sofascoreAgeSec > 120) {
            result.status = 'WARNING';
        }

        return result;
    }

    selfHealLocks() {
        try {
            if (fs.existsSync(LOCKS_FILE)) {
                fs.writeFileSync(LOCKS_FILE, JSON.stringify({}, null, 2), 'utf8');
                this.logAction('SENTINEL', 'WARNING', 'Sistem kilit dosyası otomatik sıfırlandı (Self-Healing devreye girdi).');
            }
        } catch (e) {
            console.error('[OFFICE] Error in selfHealLocks:', e.message);
        }
    }

    // ==========================================
    // 2. 💰 TAHSİLDAR (Cashier Manager)
    // ==========================================
    async checkCashierLifecycle() {
        const now = Date.now();
        const users = vipManager.users || {};
        const entries = Object.values(users);

        let activeVipCount = 0;
        let activeTrialCount = 0;
        let expiringSoonCount = 0;
        let expiredCount = 0;
        let estimatedMrr = 0;

        for (const user of entries) {
            const isTrial = user.plan === 'TRIAL';
            const isActive = user.status === 'ACTIVE';
            const expiresAt = user.expiresAt || 0;
            const diffMs = expiresAt - now;

            if (isActive && !isTrial) {
                activeVipCount++;
                const planUpper = String(user.plan || '').toUpperCase();
                if (planUpper.includes('PREMIUM')) {
                    estimatedMrr += 79;
                } else {
                    estimatedMrr += 29; // Pro tier default
                }
            }

            if (isTrial && isActive) {
                if (diffMs > 0) {
                    activeTrialCount++;

                    // 4 Hours Expiry Offer Trigger (Within 4 hours and not sent yet)
                    const fourHoursMs = 4 * 60 * 60 * 1000;
                    if (diffMs <= fourHoursMs && !user.expiryOfferSent) {
                        expiringSoonCount++;
                        if (this.autoModeEnabled) {
                            try {
                                await telegramBot.sendTrialExpiringAlert(user, 4);
                                user.expiryOfferSent = true;
                                user.expiryOfferSentAt = new Date().toISOString();
                                vipManager.saveUsers();
                                this.stats.cashierOffersSent++;
                                this.logAction('CASHIER', 'SUCCESS', `@${user.username || user.chatId} kullanıcısına 3 günlük deneme bitiş uyarısı ve indirim teklifi yollandı.`);
                            } catch (err) {
                                console.error('[OFFICE] Cashier offer error:', err.message);
                            }
                        }
                    }
                } else {
                    // Trial Expired
                    expiredCount++;
                    if (this.autoModeEnabled) {
                        user.status = 'EXPIRED';
                        vipManager.saveUsers();
                        this.logAction('CASHIER', 'INFO', `@${user.username || user.chatId} kullanıcısının 3 günlük deneme süresi sona erdi, arşive alındı.`);
                    }
                }
            } else if (user.status === 'EXPIRED') {
                expiredCount++;
            }
        }

        const totalHandled = activeTrialCount + expiredCount;
        const conversionRate = totalHandled > 0 ? ((activeVipCount / totalHandled) * 100).toFixed(1) : '0.0';

        return {
            status: 'ACTIVE',
            activeVipCount,
            activeTrialCount,
            expiringSoonCount,
            expiredCount,
            conversionRate: `${conversionRate}%`,
            estimatedMrr: `€${estimatedMrr.toFixed(2)}`
        };
    }

    // ==========================================
    // 3. 📢 PAZARLAMACI (FOMO Marketing Engine)
    // ==========================================
    getMarketingStatus() {
        const stats = telegramBot.dailyStats || { won: 0, lost: 0, total: 0 };
        const total = stats.won + stats.lost;
        const winRate = total > 0 ? ((stats.won / total) * 100).toFixed(1) : '0.0';

        return {
            status: 'ACTIVE',
            todayWon: stats.won,
            todayLost: stats.lost,
            todayTotal: stats.total,
            winRate: `${winRate}%`,
            fomoCardsDispatched: this.stats.fomoCardsDispatched,
            lastSignal: stats.signals && stats.signals.length > 0 ? stats.signals[stats.signals.length - 1].match : 'Beklemede'
        };
    }

    async dispatchDailyPublicRecap(force = false) {
        try {
            const stats = telegramBot.dailyStats || { won: 0, lost: 0, total: 0 };
            if (!force && stats.total === 0) {
                return { success: false, reason: 'Bugün henüz sonuçlanan sinyal bulunmuyor' };
            }

            await telegramBot.sendDailyReport(false);
            this.logAction('MARKETING', 'SUCCESS', `Günün performans ve ROI raporu halka açık Telegram kanalına fırlatıldı.`);
            return { success: true };
        } catch (e) {
            console.error('[OFFICE] Marketing dispatch recap error:', e.message);
            return { success: false, error: e.message };
        }
    }

    // ==========================================
    // ⚙️ ORCHESTRATION & API FEED
    // ==========================================
    async tick() {
        this.stats.lastTickAt = new Date().toISOString();
        try {
            // 1. Sentinel Scan
            const sentinelRes = this.checkSentinelHealth();
            if (sentinelRes.status === 'STALLED') {
                this.logAction('SENTINEL', 'ALERT', `Veri akışında aksama tespit edildi (${sentinelRes.sofascoreAgeSec}s gecikme).`);
            }

            // 2. Cashier Scan
            await this.checkCashierLifecycle();

            // 3. Cashier Crypto Pay Auto-Sync
            try {
                await cryptoPay.syncRecentPayments(async (pay) => {
                    await telegramBot.settlePaidInvoice(pay);
                    this.logAction('CASHIER', 'SUCCESS', `Yeni VIP ödeme alındı: @${pay.username} (${pay.amount} ${pay.asset})`);
                });
            } catch (cpErr) {
                console.error('[OFFICE] Error in crypto payment sync:', cpErr.message);
            }

        } catch (e) {
            console.error('[OFFICE] Error in office tick cycle:', e.message);
        }
    }

    start(intervalMs = 60000) {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[OFFICE] 🏢 7/24 Otonom Komuta Ofisi başlatıldı (Döngü: 60sn)');
        this.logAction('OFFICE', 'INFO', 'Otonom Ofis 7/24 nöbet döngüsünü başlattı.');

        // Initial tick after 5 seconds
        setTimeout(() => this.tick(), 5000);

        this.intervalId = setInterval(() => {
            this.tick();
        }, intervalMs);
    }

    stop() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        console.log('[OFFICE] 🏢 Otonom Komuta Ofisi durduruldu');
        this.logAction('OFFICE', 'WARNING', 'Otonom Ofis döngüsü durduruldu.');
    }

    getStatus() {
        const sentinel = this.checkSentinelHealth();
        const marketing = this.getMarketingStatus();
        const users = vipManager.users || {};
        const entries = Object.values(users);
        const now = Date.now();

        let activeVipCount = 0;
        let activeTrialCount = 0;
        let expiringSoonCount = 0;
        let expiredCount = 0;
        let estimatedMrr = 0;

        for (const user of entries) {
            const isTrial = user.plan === 'TRIAL';
            const isActive = user.status === 'ACTIVE';
            const diffMs = (user.expiresAt || 0) - now;
            if (isActive && !isTrial) {
                activeVipCount++;
                const planUpper = String(user.plan || '').toUpperCase();
                if (planUpper.includes('PREMIUM')) {
                    estimatedMrr += 79;
                } else {
                    estimatedMrr += 29;
                }
            }
            if (isTrial && isActive && diffMs > 0) {
                activeTrialCount++;
                if (diffMs <= 2 * 3600 * 1000) expiringSoonCount++;
            }
            if (user.status === 'EXPIRED' || (isTrial && diffMs <= 0)) expiredCount++;
        }

        const totalHandled = activeTrialCount + expiredCount;
        const conversionRate = totalHandled > 0 ? ((activeVipCount / totalHandled) * 100).toFixed(1) : '0.0';

        return {
            success: true,
            autoModeEnabled: this.autoModeEnabled,
            isRunning: this.isRunning,
            lastTickAt: this.stats.lastTickAt,
            sentinel: {
                ...sentinel,
                lastScan: this.stats.lastTickAt
            },
            cashier: {
                status: 'ACTIVE',
                activeVipCount,
                activeTrialCount,
                expiringSoonCount,
                expiredCount,
                conversionRate: `${conversionRate}%`,
                estimatedMrr: `€${estimatedMrr.toFixed(2)}`
            },
            marketing,
            recentLogs: this.actionLogs.slice(0, 30)
        };
    }

    async executeAction(action, payload = {}) {
        switch (action) {
            case 'sentinel_scan_now': {
                const res = this.checkSentinelHealth();
                this.logAction('SENTINEL', 'SUCCESS', `Manuel sistem sağlık taraması tamamlandı: ${res.status} (${res.liveMatchCount} canlı maç).`);
                return { success: true, result: res };
            }
            case 'sentinel_heal_locks': {
                this.selfHealLocks();
                return { success: true, message: 'Kilit dosyaları temizlendi.' };
            }
            case 'cashier_send_campaign': {
                // Send special win/FOMO offer to expired trials
                const expiredUsers = Object.values(vipManager.users || {}).filter(u => u.status === 'EXPIRED');
                let count = 0;
                for (const u of expiredUsers.slice(0, 10)) { // limit to 10 at a time
                    if (u.chatId) {
                        try {
                            await telegramBot.sendTrialExpiringAlert(u, 0);
                            count++;
                        } catch (e) {}
                    }
                }
                this.logAction('CASHIER', 'SUCCESS', `${count} adet süresi biten üyeye özel VIP indirim daveti gönderildi.`);
                return { success: true, sentCount: count };
            }
            case 'marketing_daily_recap': {
                return await this.dispatchDailyPublicRecap(true);
            }
            case 'toggle_auto_mode': {
                this.autoModeEnabled = !this.autoModeEnabled;
                this.logAction('OFFICE', 'INFO', `Otonom Eylem Modu ${this.autoModeEnabled ? 'AKTİF' : 'PASİF'} yapıldı.`);
                return { success: true, autoModeEnabled: this.autoModeEnabled };
            }
            default:
                return { success: false, error: `Bilinmeyen işlem: ${action}` };
        }
    }
}

export const autonomousOffice = new AutonomousOffice();
