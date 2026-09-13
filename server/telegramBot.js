/**
 * TELEGRAM BOT SERVICE
 * Handles signal delivery to VIP group and public channel
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    formatVIPSignal,
    resolveMarketText,
    formatPublicTeaser,
    formatDailyReport,
    formatRadarPick,
    formatWelcome,
    formatVIPInfo
} from './telegramTemplates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '';
        this.vipGroupId = process.env.TELEGRAM_VIP_GROUP_ID || '';
        this.publicChannelId = process.env.TELEGRAM_PUBLIC_CHANNEL_ID || '';
        this.enabled = process.env.TELEGRAM_ENABLED === 'true';
        this.minLevel = process.env.TELEGRAM_MIN_LEVEL || 'SICAK';
        this.publicDelay = parseInt(process.env.TELEGRAM_PUBLIC_DELAY_MIN || '15') * 60 * 1000;

        // State
        this.sentSignals = new Map(); // matchId -> timestamp (duplicate guard)
        this.messageQueue = [];
        this.isProcessing = false;
        this.dailyStats = { won: 0, lost: 0, pending: 0, total: 0, signals: [] };
        this.pollingOffset = 0;
        this.isPolling = false;

        // Signal history file
        this.historyFile = path.join(__dirname, 'telegram_signal_history.json');
        this.loadHistory();

        // Level hierarchy for filtering
        this.levelHierarchy = { 'SICAK': 1, 'ALEV': 2, 'ALPHA': 3 };
    }

    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
                this.dailyStats = data.dailyStats || this.dailyStats;

                // Check if it's a new day — reset stats
                const lastDate = data.lastDate || '';
                const today = new Date().toISOString().split('T')[0];
                if (lastDate !== today) {
                    this.dailyStats = { won: 0, lost: 0, pending: 0, total: 0, signals: [] };
                }
            }
        } catch (e) {
            console.error('[TELEGRAM] Error loading history:', e.message);
        }
    }

    saveHistory() {
        try {
            const data = {
                dailyStats: this.dailyStats,
                lastDate: new Date().toISOString().split('T')[0]
            };
            fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[TELEGRAM] Error saving history:', e.message);
        }
    }

    /**
     * Validate bot token by calling getMe
     */
    async validateToken() {
        if (!this.token) {
            console.warn('[TELEGRAM] No bot token configured');
            return { ok: false, error: 'No token' };
        }

        try {
            const res = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
            const data = await res.json();
            if (data.ok) {
                console.log(`[TELEGRAM] ✅ Bot verified: @${data.result.username} (${data.result.first_name})`);
                return { ok: true, bot: data.result };
            } else {
                console.error('[TELEGRAM] ❌ Token invalid:', data.description);
                return { ok: false, error: data.description };
            }
        } catch (e) {
            console.error('[TELEGRAM] ❌ Connection error:', e.message);
            return { ok: false, error: e.message };
        }
    }

    /**
     * Send a message via Telegram Bot API
     */
    async sendMessage(chatId, text, options = {}) {
        if (!this.token || !chatId) return null;

        try {
            const body = {
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                ...options
            };

            const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!data.ok) {
                console.error(`[TELEGRAM] Send failed to ${chatId}:`, data.description);
                return null;
            }

            console.log(`[TELEGRAM] ✅ Message sent to ${chatId}`);
            return data.result;
        } catch (e) {
            console.error(`[TELEGRAM] Send error:`, e.message);
            return null;
        }
    }

    /**
     * Check if signal level meets minimum threshold
     */
    meetsMinLevel(level) {
        const levelVal = this.levelHierarchy[level] || 0;
        const minVal = this.levelHierarchy[this.minLevel] || 1;
        return levelVal >= minVal;
    }

    /**
     * Check duplicate guard (same match within 10 minutes)
     */
    isDuplicate(matchId) {
        const lastSent = this.sentSignals.get(matchId);
        if (!lastSent) return false;
        return (Date.now() - lastSent) < 10 * 60 * 1000; // 10 minute cooldown
    }

    /**
     * MAIN: Process an alert from SmartAlertService
     */
    async processAlert(alert) {
        if (!this.enabled) {
            console.log('[TELEGRAM] Disabled, skipping alert');
            return { sent: false, reason: 'disabled' };
        }

        if (!alert || !alert.level) {
            return { sent: false, reason: 'invalid_alert' };
        }

        // Check minimum level
        if (!this.meetsMinLevel(alert.level)) {
            console.log(`[TELEGRAM] Signal level ${alert.level} below minimum ${this.minLevel}, skipping`);
            return { sent: false, reason: 'below_min_level' };
        }

        // Check duplicate
        const matchKey = alert.matchId || `${alert.homeTeam}_${alert.awayTeam}`;
        if (this.isDuplicate(matchKey)) {
            console.log(`[TELEGRAM] Duplicate signal for ${matchKey}, skipping`);
            return { sent: false, reason: 'duplicate' };
        }

        // Mark as sent
        this.sentSignals.set(matchKey, Date.now());

        // Track stats
        this.dailyStats.total++;
        this.dailyStats.pending++;
        this.dailyStats.signals.push({
            match: `${alert.homeTeam} vs ${alert.awayTeam}`,
            level: alert.level,
            time: new Date().toISOString(),
            market: resolveMarketText(alert) || alert.recommendation?.predictionText || alert.recommendation?.marketLabel || 'N/A'
        });
        this.saveHistory();

        const results = { vip: null, public: null };

        // 1. Send to VIP group (immediate)
        if (this.vipGroupId) {
            const vipMessage = formatVIPSignal(alert);
            results.vip = await this.sendMessage(this.vipGroupId, vipMessage);
            console.log(`[TELEGRAM] 💎 VIP signal sent: ${alert.homeTeam} vs ${alert.awayTeam} [${alert.level}]`);
        }

        // 2. Send to public channel (delayed teaser)
        if (this.publicChannelId) {
            setTimeout(async () => {
                const publicMessage = formatPublicTeaser(alert);
                results.public = await this.sendMessage(this.publicChannelId, publicMessage);
                console.log(`[TELEGRAM] 📢 Public teaser sent (delayed): ${alert.homeTeam} vs ${alert.awayTeam}`);
            }, this.publicDelay);
        }

        return { sent: true, results };
    }

    /**
     * Send a pre-match RADAR pick to VIP
     */
    async sendRadarPick(match) {
        if (!this.enabled || !this.vipGroupId) return null;

        const message = formatRadarPick(match);
        const result = await this.sendMessage(this.vipGroupId, message);
        console.log(`[TELEGRAM] 🎯 Radar pick sent: ${match.home} vs ${match.away}`);
        return result;
    }

    /**
     * Send daily performance report
     */
    async sendDailyReport() {
        const report = formatDailyReport(this.dailyStats);

        const results = {};
        if (this.vipGroupId) {
            results.vip = await this.sendMessage(this.vipGroupId, report);
        }
        if (this.publicChannelId) {
            results.public = await this.sendMessage(this.publicChannelId, report);
        }

        console.log('[TELEGRAM] 📊 Daily report sent');

        // Reset daily stats at report time
        this.dailyStats = { won: 0, lost: 0, pending: 0, total: 0, signals: [] };
        this.saveHistory();

        return results;
    }

    /**
     * Start polling for bot commands (/start, /vip, /stats)
     */
    startPolling() {
        if (!this.token || this.isPolling) return;
        this.isPolling = true;
        console.log('[TELEGRAM] 🤖 Bot polling started for commands...');
        this._poll();
    }

    async _poll() {
        while (this.isPolling) {
            try {
                const res = await fetch(
                    `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.pollingOffset}&timeout=30&allowed_updates=["message"]`,
                    { timeout: 35000 }
                );
                const data = await res.json();

                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        this.pollingOffset = update.update_id + 1;
                        await this.handleUpdate(update);
                    }
                }
            } catch (e) {
                // Network timeout is normal for long polling
                if (!e.message.includes('timeout')) {
                    console.error('[TELEGRAM] Polling error:', e.message);
                }
            }

            // Small delay between polls
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async handleUpdate(update) {
        const msg = update.message;
        if (!msg || !msg.text) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const username = msg.from?.username || msg.from?.first_name || 'User';

        console.log(`[TELEGRAM] Command from ${username}: ${text}`);

        switch (text) {
            case '/start':
                await this.sendMessage(chatId, formatWelcome());
                break;

            case '/vip':
                await this.sendMessage(chatId, formatVIPInfo());
                break;

            case '/stats':
                const statsMsg = formatDailyReport(this.dailyStats);
                await this.sendMessage(chatId, statsMsg);
                break;

            case '/today':
                if (this.dailyStats.signals.length === 0) {
                    await this.sendMessage(chatId, '📊 Bugün henüz sinyal gönderilmedi.');
                } else {
                    const signalList = this.dailyStats.signals
                        .map((s, i) => `${i + 1}. ${s.level === 'ALPHA' ? '💎' : s.level === 'ALEV' ? '🔥' : '⚡'} ${s.match}`)
                        .join('\n');
                    await this.sendMessage(chatId, `📋 *Bugünkü Sinyaller (${this.dailyStats.total}):*\n\n${signalList}`);
                }
                break;

            case '/id':
                await this.sendMessage(chatId, `🆔 *Telegram Bilgileriniz:*\n\n• Chat ID: \`${chatId}\`\n• Kullanıcı: @${username}\n\n_Bu ID numarasını yöneticiye ileterek VIP üyeliğinizi hemen tanımlatabilirsiniz._`);
                break;

            case '/kalan':
            case '/profil':
                await this.sendMessage(chatId, `👑 *VIP Üyelik & Profil Durumu:*\n\n• Kullanıcı: @${username}\n• Telegram ID: \`${chatId}\`\n• Durum: *AKTİF (VIP)*\n• Günlük Sinyal Akışı: Açık (Anlık)\n• Poisson +EV & Gecikme Uyarıları: Aktif\n\n_Destek ve yenileme için yöneticinizle görüşebilirsiniz._`);
                break;

            case '/katil':
            case '/link':
                const inviteLink = await this.createInviteLink(username);
                if (inviteLink) {
                    await this.sendMessage(chatId, `🎟️ *VIP Kanala Katılım Bağlantınız:*\n\nBu bağlantı tek kullanımlıktır ve 24 saat geçerlidir:\n👉 ${inviteLink}\n\n_Giriş yaptıktan sonra bağlantı otomatik olarak kapanır._`);
                } else {
                    await this.sendMessage(chatId, `ℹ️ *VIP Bağlantı Bilgisi:*\nVIP Grubumuz: *${this.vipGroupId || 'Canlı Kanal'}*\n\nDoğrudan ekleme veya yetki tanımlaması için lütfen sistem yöneticisiyle iletişime geçin.`);
                }
                break;

            default:
                // Ignore non-command messages
                break;
        }
    }

    /**
     * Creates a single-use expiring invite link to the VIP group
     */
    async createInviteLink(name = 'VIP Member', expireHours = 24) {
        if (!this.token || !this.vipGroupId) return null;
        try {
            const expireDate = Math.floor(Date.now() / 1000) + (expireHours * 3600);
            const res = await fetch(`https://api.telegram.org/bot${this.token}/createChatInviteLink`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.vipGroupId,
                    name: `VIP_${name}_${Date.now().toString().slice(-4)}`,
                    member_limit: 1,
                    expire_date: expireDate
                })
            });
            const data = await res.json();
            if (data.ok && data.result) {
                return data.result.invite_link;
            }
            console.warn('[TELEGRAM] Note on invite link:', data.description || data);
            return null;
        } catch (e) {
            console.error('[TELEGRAM] Error in createInviteLink:', e.message);
            return null;
        }
    }

    /**
     * Kicks an expired member from the VIP group
     */
    async kickMember(userId) {
        if (!this.token || !this.vipGroupId) return false;
        try {
            await fetch(`https://api.telegram.org/bot${this.token}/banChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: this.vipGroupId, user_id: userId })
            });
            await fetch(`https://api.telegram.org/bot${this.token}/unbanChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: this.vipGroupId, user_id: userId, only_if_banned: true })
            });
            console.log(`[TELEGRAM] Kicked expired member ${userId} from VIP group.`);
            return true;
        } catch (e) {
            console.error(`[TELEGRAM] Error kicking user ${userId}:`, e.message);
            return false;
        }
    }

    /**
     * Schedule daily report (call this once at startup)
     */
    scheduleDailyReport(hour = 23, minute = 0) {
        const scheduleNext = () => {
            const now = new Date();
            const target = new Date();
            target.setHours(hour, minute, 0, 0);

            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }

            const delay = target.getTime() - now.getTime();
            console.log(`[TELEGRAM] 📅 Next daily report scheduled in ${Math.round(delay / 60000)} minutes`);

            setTimeout(async () => {
                await this.sendDailyReport();
                scheduleNext(); // Schedule next day
            }, delay);
        };

        scheduleNext();
    }

    /**
     * Get bot status info
     */
    getStatus() {
        return {
            enabled: this.enabled,
            token: this.token ? '***' + this.token.slice(-8) : 'NOT SET',
            vipGroup: this.vipGroupId || 'NOT SET',
            publicChannel: this.publicChannelId || 'NOT SET',
            minLevel: this.minLevel,
            todaySignals: this.dailyStats.total,
            todayStats: this.dailyStats,
            sentSignalsCache: this.sentSignals.size,
            isPolling: this.isPolling
        };
    }

    /**
     * Clean up old entries from duplicate guard
     */
    cleanupSentSignals() {
        const now = Date.now();
        for (const [key, timestamp] of this.sentSignals) {
            if (now - timestamp > 30 * 60 * 1000) { // 30 minutes
                this.sentSignals.delete(key);
            }
        }
    }

    stop() {
        this.isPolling = false;
    }
}

export const telegramBot = new TelegramBot();
