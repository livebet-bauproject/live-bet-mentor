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
    formatSignalResult,
    formatRadarPick,
    formatRadarTeaser,
    formatWelcome,
    formatVIPInfo,
    formatCashOutAlert,
    formatGoldenCombo,
    formatLatencyArbitrageAlert,
    formatFomoWinningCard,
    formatTrialExpiringOffer
} from './telegramTemplates.js';
import { learningEngine } from './learningEngine.js';
import { cashOutEngine } from './cashOutEngine.js';
import { vipManager } from './vipManager.js';
import { consensusReader } from './consensusReader.js';
import { cryptoPay } from './cryptoPay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '8958625592:AAFvGVVFF-GKHklYfzR_lexD39t7TurlI5U';
        let vId = process.env.TELEGRAM_VIP_GROUP_ID || '-1004361386816';
        if (vId === '8965087988' || !vId.startsWith('-100')) {
            vId = '-1004361386816';
        }
        this.vipGroupId = vId;

        let pId = process.env.TELEGRAM_PUBLIC_CHANNEL_ID || '-1003660350476';
        if (!pId.startsWith('-100')) {
            pId = '-1003660350476';
        }
        this.publicChannelId = pId;

        // Multi-language VIP channel destinations (TR, EN, DE)
        this.vipChannels = {
            tr: process.env.TELEGRAM_VIP_TR || this.vipGroupId,
            en: process.env.TELEGRAM_VIP_EN || null,
            de: process.env.TELEGRAM_VIP_DE || null
        };

        // Multi-language Public channel destinations (TR, EN, DE)
        this.publicChannels = {
            tr: process.env.TELEGRAM_PUBLIC_TR || this.publicChannelId,
            en: process.env.TELEGRAM_PUBLIC_EN || null,
            de: process.env.TELEGRAM_PUBLIC_DE || null
        };

        this.enabled = process.env.TELEGRAM_ENABLED !== 'false';
        this.minLevel = process.env.TELEGRAM_MIN_LEVEL || 'SICAK';
        this.publicDelay = parseInt(process.env.TELEGRAM_PUBLIC_DELAY_MIN || '15') * 60 * 1000;
        this.lang = process.env.TELEGRAM_LANG || 'tr';

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

        // Compatibility self-reference
        this.bot = this;
    }

    /**
     * Get active VIP destinations with their respective language.
     * Deduplicates so the same channel ID is never messaged twice per event.
     */
    getActiveVipChannels() {
        const list = [];
        const seen = new Set();
        for (const lang of ['tr', 'en', 'de']) {
            const chId = this.vipChannels ? this.vipChannels[lang] : null;
            if (chId && !seen.has(chId)) {
                seen.add(chId);
                list.push({ lang, channelId: chId });
            }
        }
        // Fallback: If no language-specific channels registered, fall back to vipGroupId
        if (list.length === 0 && this.vipGroupId && !seen.has(this.vipGroupId)) {
            list.push({ lang: this.lang || 'tr', channelId: this.vipGroupId });
        }
        return list;
    }

    /**
     * Get active Public destinations with their respective language.
     */
    getActivePublicChannels() {
        const list = [];
        const seen = new Set();
        for (const lang of ['tr', 'en', 'de']) {
            const chId = this.publicChannels ? this.publicChannels[lang] : null;
            if (chId && !seen.has(chId)) {
                seen.add(chId);
                list.push({ lang, channelId: chId });
            }
        }
        // Fallback: If no language-specific channels registered, fall back to publicChannelId
        if (list.length === 0 && this.publicChannelId && !seen.has(this.publicChannelId)) {
            list.push({ lang: this.lang || 'tr', channelId: this.publicChannelId });
        }
        return list;
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
                } else if (this.dailyStats && Array.isArray(this.dailyStats.signals)) {
                    // Re-register active pending signals for cash-out evaluation
                    this.dailyStats.signals.forEach(s => {
                        if (s.status === 'PENDING') {
                            cashOutEngine.registerSignal(s);
                        }
                    });
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
                // Fallback: If Telegram failed due to markdown formatting entities, retry without parse_mode
                if (data.description && (data.description.includes("can't parse entities") || data.description.includes("entity"))) {
                    console.log(`[TELEGRAM] 🔄 Retrying message to ${chatId} as plain text...`);
                    const fallbackBody = { ...body };
                    delete fallbackBody.parse_mode;
                    try {
                        const fbRes = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(fallbackBody)
                        });
                        const fbData = await fbRes.json();
                        if (fbData.ok) {
                            console.log(`[TELEGRAM] ✅ Plaintext fallback message sent to ${chatId}`);
                            return fbData.result;
                        }
                    } catch (fbErr) {
                        console.error('[TELEGRAM] Fallback retry error:', fbErr.message);
                    }
                }
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
     * Send photo to chat
     */
    async sendPhoto(chatId, photo, caption = '', options = {}) {
        if (!this.token || !chatId || !photo) return null;
        try {
            const body = {
                chat_id: chatId,
                photo: photo,
                caption: caption,
                parse_mode: 'Markdown',
                ...options
            };

            const res = await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!data.ok) {
                console.error(`[TELEGRAM] Send photo failed to ${chatId}:`, data.description);
                return null;
            }
            return data.result;
        } catch (e) {
            console.error(`[TELEGRAM] Send photo error:`, e.message);
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

        // Check AI Quarantine (protect against low-winrate leagues)
        const lCheck = learningEngine.getMultiplier(alert.league || alert.leagueName, resolveMarketText(alert), alert.minute);
        if (!lCheck.allowed) {
            console.warn(`[TELEGRAM] ⛔ Skipping alert for ${alert.homeTeam} vs ${alert.awayTeam} due to AI quarantine: ${lCheck.reason}`);
            return { sent: false, reason: 'ai_quarantine' };
        }

        // Check duplicate
        const matchKey = alert.matchId || `${alert.homeTeam}_${alert.awayTeam}`;
        if (this.isDuplicate(matchKey)) {
            console.log(`[TELEGRAM] Duplicate signal for ${matchKey}, skipping`);
            return { sent: false, reason: 'duplicate' };
        }

        // Mark as sent
        this.sentSignals.set(matchKey, Date.now());

        // Track stats with full settlement metadata
        const signalId = alert.id || `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const marketLabel = resolveMarketText(alert) || alert.recommendation?.predictionText || alert.recommendation?.marketLabel || 'N/A';

        this.dailyStats.total++;
        this.dailyStats.pending++;
        const signalData = {
            id: signalId,
            matchId: alert.matchId ? String(alert.matchId) : null,
            homeTeam: alert.homeTeam || '',
            awayTeam: alert.awayTeam || '',
            match: `${alert.homeTeam} vs ${alert.awayTeam}`,
            level: alert.level,
            time: new Date().toISOString(),
            scoreAtPrediction: alert.score || '0-0',
            minute: alert.minute || 0,
            market: marketLabel,
            recommendation: alert.recommendation || {},
            status: 'PENDING',
            resultScore: null,
            resolvedAt: null
        };
        this.dailyStats.signals.push(signalData);
        cashOutEngine.registerSignal(signalData);
        this.saveHistory();

        const results = { vip: null, public: null, vipDeliveries: [], publicDeliveries: [] };

        // 1. Send to all configured VIP channels in their matching language (0s latency)
        const activeVips = this.getActiveVipChannels();
        for (const dest of activeVips) {
            const vipMessage = formatVIPSignal(alert, dest.lang);
            const res = await this.sendMessage(dest.channelId, vipMessage);
            results.vipDeliveries.push({ lang: dest.lang, channelId: dest.channelId, ok: !!res });
            if (!results.vip) results.vip = res;
            console.log(`[TELEGRAM] 💎 VIP signal sent [${dest.lang.toUpperCase()}]: ${alert.homeTeam} vs ${alert.awayTeam} [${alert.level}] -> ${dest.channelId}`);
        }

        // 2. Send to all configured public channels (delayed teaser)
        const activePubs = this.getActivePublicChannels();
        if (activePubs.length > 0) {
            setTimeout(async () => {
                for (const dest of activePubs) {
                    const publicMessage = formatPublicTeaser(alert, dest.lang);
                    const res = await this.sendMessage(dest.channelId, publicMessage);
                    results.publicDeliveries.push({ lang: dest.lang, channelId: dest.channelId, ok: !!res });
                    if (!results.public) results.public = res;
                    console.log(`[TELEGRAM] 📢 Public teaser sent (delayed) [${dest.lang.toUpperCase()}]: ${alert.homeTeam} vs ${alert.awayTeam} -> ${dest.channelId}`);
                }
            }, this.publicDelay);
        }

        return { sent: true, results };
    }

    /**
     * Send a pre-match RADAR pick to VIP (and optional teaser to public)
     */
    async sendRadarPick(match, options = {}) {
        if (!this.enabled) return null;

        const results = { vip: null, public: null };
        const activeVips = this.getActiveVipChannels();
        for (const dest of activeVips) {
            const message = formatRadarPick(match, dest.lang);
            const res = await this.sendMessage(dest.channelId, message);
            if (!results.vip) results.vip = res;
            console.log(`[TELEGRAM] 🎯 Radar pick sent [${dest.lang.toUpperCase()}] to VIP (${dest.channelId}): ${match.home} vs ${match.away}`);
        }

        // If public teaser requested (or by default for top consensus)
        if (options.sendTeaser) {
            const activePubs = this.getActivePublicChannels();
            for (const dest of activePubs) {
                try {
                    const teaser = formatRadarTeaser(match, dest.lang);
                    const res = await this.sendMessage(dest.channelId, teaser);
                    if (!results.public) results.public = res;
                    console.log(`[TELEGRAM] 📡 Radar teaser sent [${dest.lang.toUpperCase()}] to Public Channel (${dest.channelId}): ${match.home} vs ${match.away}`);
                } catch (te) {
                    console.error('[TELEGRAM] Error sending public radar teaser:', te.message);
                }
            }
        }

        return results;
    }

    /**
     * Broadcast top consensus / "Günün Bankosu" picks to VIP & Public teaser
     */
    async broadcastConsensusPicks(options = {}) {
        if (!this.enabled) return { ok: false, error: 'Telegram bot disabled' };

        const {
            minSources = 4,
            minAgreement = 75,
            limit = 2,
            force = false
        } = options;

        try {
            const picks = consensusReader.getTopConsensusPicks({
                minSources,
                minAgreement,
                limit
            });

            if (!picks || picks.length === 0) {
                console.log('[TELEGRAM] ℹ️ No high-consensus picks found meeting criteria');
                return { ok: true, sent: 0, message: 'No matches found meeting criteria' };
            }

            console.log(`[TELEGRAM] 🎯 Broadcasting ${picks.length} top consensus pick(s)...`);
            const results = [];

            for (let i = 0; i < picks.length; i++) {
                const match = picks[i];
                const todayStr = new Date().toISOString().split('T')[0];
                const matchKey = `radar_${match.home}_${match.away}_${todayStr}`;

                if (!force && this.sentSignals.has(matchKey)) {
                    console.log(`[TELEGRAM] ⏩ Skipping already sent consensus pick: ${match.home} vs ${match.away}`);
                    continue;
                }

                // 1. Send full institutional analysis to all VIP channels in their matching language
                let vipRes = null;
                const activeVips = this.getActiveVipChannels();
                for (const dest of activeVips) {
                    const vipMsg = formatRadarPick(match, dest.lang);
                    const res = await this.sendMessage(dest.channelId, vipMsg);
                    if (!vipRes) vipRes = res;
                }

                // 2. Send public teaser for the #1 pick to all Public channels in their matching language
                let pubRes = null;
                if (i === 0) {
                    const activePubs = this.getActivePublicChannels();
                    for (const dest of activePubs) {
                        const publicMsg = formatRadarTeaser(match, dest.lang);
                        const res = await this.sendMessage(dest.channelId, publicMsg);
                        if (!pubRes) pubRes = res;
                    }
                }

                results.push({ match: match.match, vip: vipRes, public: pubRes });
                this.sentSignals.set(matchKey, Date.now());

                // Small pacing delay between messages
                await new Promise(r => setTimeout(r, 1500));
            }

            return { ok: true, count: results.length, results };
        } catch (e) {
            console.error('[TELEGRAM] ❌ Broadcast consensus picks error:', e.message);
            return { ok: false, error: e.message };
        }
    }

    /**
     * Schedule daily consensus broadcast (default 12:00 TSİ Turkey Time)
     */
    scheduleDailyConsensusBroadcast(targetHourTRT = 12, targetMinuteTRT = 0) {
        const scheduleNext = () => {
            const now = new Date();
            const targetUtcHour = (targetHourTRT - 3 + 24) % 24;
            const targetUtc = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                targetUtcHour,
                targetMinuteTRT,
                0,
                0
            ));
            if (targetUtc.getTime() <= now.getTime()) {
                targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
            }

            const delay = targetUtc.getTime() - now.getTime();
            console.log(`[TELEGRAM] 🎯 Next daily consensus broadcast (12:00 TSİ) scheduled in ${Math.round(delay / 60000)} minutes (${targetUtc.toISOString()})`);

            setTimeout(async () => {
                console.log('[TELEGRAM] ⏰ Triggering scheduled daily consensus broadcast...');
                await this.broadcastConsensusPicks();
                scheduleNext();
            }, delay);
        };

        scheduleNext();
    }

    /**
     * Send daily performance report
     */
    async sendDailyReport(reset = false) {
        const results = { vip: null, public: null };
        const activeVips = this.getActiveVipChannels();
        for (const dest of activeVips) {
            const report = formatDailyReport(this.dailyStats, dest.lang);
            const res = await this.sendMessage(dest.channelId, report);
            if (!results.vip) results.vip = res;
        }

        const activePubs = this.getActivePublicChannels();
        for (const dest of activePubs) {
            const report = formatDailyReport(this.dailyStats, dest.lang);
            const res = await this.sendMessage(dest.channelId, report);
            if (!results.public) results.public = res;
        }

        console.log('[TELEGRAM] 📊 Daily report sent across all active language channels');

        if (reset) {
            this.dailyStats = { won: 0, lost: 0, pending: 0, total: 0, signals: [] };
            this.saveHistory();
        }

        return results;
    }

    /**
     * Send Golden Double Combo to VIP
     */
    async sendGoldenCombo(combo) {
        if (!this.enabled || !combo) {
            console.warn(`[TELEGRAM] ⚠️ sendGoldenCombo skipped: enabled=${this.enabled}, hasCombo=${!!combo}`);
            return null;
        }

        const activeVips = this.getActiveVipChannels();
        let result = null;
        for (const dest of activeVips) {
            const message = formatGoldenCombo(combo, dest.lang);
            if (!message) continue;
            const res = await this.sendMessage(dest.channelId, message);
            if (!result) result = res;
            if (res) {
                console.log(`[TELEGRAM] 🎟️ Golden Double Combo sent [${dest.lang.toUpperCase()}] to VIP (${dest.channelId})`);
            }
        }
        return result;
    }

    /**
     * Send Latency Arbitrage Alert to VIP
     */
    async sendLatencyArbitrage(arb) {
        if (!this.enabled || !arb) return null;

        const activeVips = this.getActiveVipChannels();
        let result = null;
        for (const dest of activeVips) {
            const message = formatLatencyArbitrageAlert(arb, dest.lang);
            if (!message) continue;
            const res = await this.sendMessage(dest.channelId, message);
            if (!result) result = res;
            console.log(`[TELEGRAM] ⚡ Latency Arbitrage alert sent [${dest.lang.toUpperCase()}] to VIP (${dest.channelId}): ${arb.homeTeam} vs ${arb.awayTeam}`);
        }
        return result;
    }

    /**
     * Settle / Resolve a prediction signal
     */
    async resolveSignal(criteria, result, score = null, sendNotification = true) {
        if (!criteria || !result) return null;

        const targetId = typeof criteria === 'object' ? (criteria.id || criteria.alertId) : criteria;
        const targetMatchId = typeof criteria === 'object' ? criteria.matchId : null;
        const targetMatch = typeof criteria === 'object' ? criteria.match : null;

        const signal = this.dailyStats.signals.find(s => {
            if (s.status !== 'PENDING') return false;
            if (targetId && String(s.id) === String(targetId)) return true;
            if (targetMatchId && String(s.matchId) === String(targetMatchId)) return true;
            if (targetMatch && s.match && s.match.toLowerCase() === targetMatch.toLowerCase()) return true;
            return false;
        });

        if (!signal) return null;

        signal.status = result;
        signal.resultScore = score;
        signal.resolvedAt = new Date().toISOString();
        cashOutEngine.unregisterSignal(signal.id);

        if (this.dailyStats.pending > 0) {
            this.dailyStats.pending--;
        }
        if (result === 'WON') {
            this.dailyStats.won++;
        } else if (result === 'LOST') {
            this.dailyStats.lost++;
        }
        this.saveHistory();

        console.log(`[TELEGRAM] 🎯 Signal resolved: ${signal.match} -> ${result} (${score || ''}) [Won: ${this.dailyStats.won}, Lost: ${this.dailyStats.lost}, Pending: ${this.dailyStats.pending}]`);

        // Feed into Self-Learning AI Engine
        try {
            learningEngine.recordSignalResult(signal, result, score);
        } catch (e) {
            console.error('[TELEGRAM] Error updating learning engine:', e.message);
        }

        // Send Telegram notification
        if (sendNotification) {
            try {
                const activeVips = this.getActiveVipChannels();
                const activePubs = this.getActivePublicChannels();

                if (result === 'WON') {
                    // 1. Send institutional confirmation to VIP channels
                    for (const dest of activeVips) {
                        const message = formatSignalResult(signal, result, score, this.dailyStats, dest.lang);
                        await this.sendMessage(dest.channelId, message);
                    }
                    // 2. Send high-converting FOMO social proof card to Public channels
                    for (const dest of activePubs) {
                        const message = formatFomoWinningCard(signal, result, score, dest.lang);
                        await this.sendMessage(dest.channelId, message);
                    }
                    console.log(`[TELEGRAM] 📢 Pazarlamacı: Winning FOMO card dispatched to Public Channel for ${signal.match}`);
                } else if (result === 'LOST') {
                    for (const dest of activeVips) {
                        const message = formatSignalResult(signal, result, score, this.dailyStats, dest.lang);
                        await this.sendMessage(dest.channelId, message);
                    }
                }
            } catch (e) {
                console.error('[TELEGRAM] Error sending resolution notification:', e.message);
            }
        }

        return signal;
    }

    /**
     * Dispatch automated trial expiry offer to user (Tahsildar Assistant)
     */
    async sendTrialExpiringAlert(user, hoursRemaining = 2) {
        if (!user || !user.chatId) return null;
        try {
            const userLang = vipManager.getUserLang(user.chatId);
            const msg = formatTrialExpiringOffer(user, hoursRemaining, userLang);
            const res = await this.sendMessage(user.chatId, msg);
            if (res) {
                console.log(`[TELEGRAM] 💰 Tahsildar: Sent ${hoursRemaining}h expiry offer to @${user.username || user.chatId}`);
            }
            return res;
        } catch (e) {
            console.error(`[TELEGRAM] 💰 Tahsildar: Failed to send expiry alert to ${user.chatId}:`, e.message);
            return null;
        }
    }

    /**
     * Automatically evaluate results of pending signals using live match events
     */
    async autoResolveSignals(liveEvents) {
        if (!Array.isArray(liveEvents) || liveEvents.length === 0) return [];

        const pendingSignals = this.dailyStats.signals.filter(s => s.status === 'PENDING');
        if (pendingSignals.length === 0) return [];

        const resolved = [];

        for (const signal of pendingSignals) {
            // Find event by matchId or team names
            const ev = liveEvents.find(e => {
                if (signal.matchId && String(e.id) === String(signal.matchId)) return true;
                const home = (signal.homeTeam || signal.match?.split(' vs ')[0] || '').toLowerCase().trim();
                const away = (signal.awayTeam || signal.match?.split(' vs ')[1] || '').toLowerCase().trim();
                if (!home || !away) return false;
                const evHome = (e.homeTeam?.name || '').toLowerCase().trim();
                const evAway = (e.awayTeam?.name || '').toLowerCase().trim();
                return (evHome.includes(home.slice(0, 5)) || home.includes(evHome.slice(0, 5))) &&
                       (evAway.includes(away.slice(0, 5)) || away.includes(evAway.slice(0, 5)));
            });

            if (!ev) continue;

            const curHome = Number(ev.homeScore?.current ?? ev.score?.home ?? 0);
            const curAway = Number(ev.awayScore?.current ?? ev.score?.away ?? 0);
            const totalGoals = curHome + curAway;
            const currentScoreStr = `${curHome}-${curAway}`;
            const isFinished = ev.status?.type === 'finished' || ev.status?.code === 100 || ev.minute === 'MS';

            let initHome = 0, initAway = 0;
            if (typeof signal.scoreAtPrediction === 'string' && signal.scoreAtPrediction.includes('-')) {
                const parts = signal.scoreAtPrediction.split('-');
                initHome = parseInt(parts[0]) || 0;
                initAway = parseInt(parts[1]) || 0;
            }

            const marketText = (signal.market || '').toLowerCase();

            // 1. NEXT GOAL (Sıradaki Gol / Comeback / Press) - Evaluate FIRST to prevent team names matching under/over/ev
            if (marketText.includes('sıradaki') || marketText.includes('next_goal') || marketText.includes('comeback') || marketText.includes('press') || marketText.includes('dominasyon')) {
                const homeName = (signal.homeTeam || signal.match?.split(' vs ')[0] || '').toLowerCase().trim();
                const awayName = (signal.awayTeam || signal.match?.split(' vs ')[1] || '').toLowerCase().trim();

                const mentionsHome = homeName && homeName.length >= 3 && marketText.includes(homeName);
                const mentionsAway = awayName && awayName.length >= 3 && marketText.includes(awayName);

                const isHomeTarget = mentionsHome || (/\b(home|ev)\b/i.test(marketText) && !mentionsAway);
                const isAwayTarget = mentionsAway || (/\b(away|deplasman)\b/i.test(marketText) && !mentionsHome);

                if (isHomeTarget && !isAwayTarget) {
                    if (curHome > initHome) {
                        const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                        if (res) resolved.push(res);
                    } else if (curAway > initAway && isFinished) {
                        const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                        if (res) resolved.push(res);
                    } else if (isFinished && totalGoals === (initHome + initAway)) {
                        const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                        if (res) resolved.push(res);
                    }
                } else if (isAwayTarget && !isHomeTarget) {
                    if (curAway > initAway) {
                        const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                        if (res) resolved.push(res);
                    } else if (curHome > initHome && isFinished) {
                        const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                        if (res) resolved.push(res);
                    } else if (isFinished && totalGoals === (initHome + initAway)) {
                        const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                        if (res) resolved.push(res);
                    }
                } else {
                    // Default expectation: any goal scored in this match
                    if (totalGoals > (initHome + initAway)) {
                        const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                        if (res) resolved.push(res);
                    } else if (isFinished) {
                        const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                        if (res) resolved.push(res);
                    }
                }
            }
            // 2. OVER GOALS (Üst) with word boundary
            else if (/\b(üst|over)\b/i.test(marketText)) {
                const matchLine = marketText.match(/(\d+\.?\d*)/);
                const line = matchLine ? parseFloat(matchLine[1]) : (initHome + initAway + 0.5);
                if (totalGoals > line) {
                    const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                    if (res) resolved.push(res);
                } else if (isFinished) {
                    const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                    if (res) resolved.push(res);
                }
            }
            // 3. BTTS / KG VAR
            else if (marketText.includes('karşılıklı') || marketText.includes('kg var') || marketText.includes('btts')) {
                if (curHome >= 1 && curAway >= 1) {
                    const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                    if (res) resolved.push(res);
                } else if (isFinished) {
                    const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                    if (res) resolved.push(res);
                }
            }
            // 4. MATCH FINISHED FALLBACK
            else if (isFinished) {
                if (totalGoals > (initHome + initAway)) {
                    const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                    if (res) resolved.push(res);
                } else {
                    const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                    if (res) resolved.push(res);
                }
            }
        }

        // 5. Evaluate Cash-Out & Stop-Loss Radar for active signals
        try {
            const cashOuts = cashOutEngine.evaluateCashOuts(liveEvents);
            const activeVips = this.getActiveVipChannels();
            for (const co of cashOuts) {
                for (const dest of activeVips) {
                    const coMsg = formatCashOutAlert(co, dest.lang);
                    await this.sendMessage(dest.channelId, coMsg);
                }
                console.log(`[TELEGRAM] ⚠️ Cash-out alert dispatched for ${co.matchTitle}: ${co.reason}`);
            }
        } catch (err) {
            console.error('[TELEGRAM] Error evaluating cash-outs:', err.message);
        }

        return resolved;
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
                    `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.pollingOffset}&timeout=30&allowed_updates=["message","callback_query"]`,
                    { timeout: 35000 }
                );
                const data = await res.json();

                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        this.pollingOffset = update.update_id + 1;
                        if (update.callback_query) {
                            await this.handleCallbackQuery(update.callback_query);
                        } else if (update.message) {
                            await this.handleUpdate(update);
                        }
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

    async answerCallbackQuery(callbackQueryId, text = '') {
        if (!this.token || !callbackQueryId) return;
        try {
            await fetch(`https://api.telegram.org/bot${this.token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: callbackQueryId,
                    text
                })
            });
        } catch (e) {
            console.error('[TELEGRAM] Error in answerCallbackQuery:', e.message);
        }
    }

    async handleCallbackQuery(cq) {
        const chatId = cq.message?.chat?.id;
        const data = cq.data;
        if (!chatId || !data) return;

        if (data === 'set_lang_tr') {
            vipManager.setUserLang(chatId, 'tr');
            await this.answerCallbackQuery(cq.id, 'Dil Türkçe olarak güncellendi! 🇹🇷');
            await this.sendMessage(chatId, `🇹🇷 *Dil Tercihiniz Kaydedildi: Türkçe*\n━━━━━━━━━━━━━━━━━━\nArtık bot bildirimleri, algoritmik analizler ve komut yanıtları Türkçe olarak görüntülenecektir.\n\nDilediğiniz zaman \`/dil\` veya \`/lang\` komutu ile değiştirebilirsiniz.`);
        } else if (data === 'set_lang_en') {
            vipManager.setUserLang(chatId, 'en');
            await this.answerCallbackQuery(cq.id, 'Language set to English! 🇬🇧');
            await this.sendMessage(chatId, `🇬🇧 *Language Preference Saved: English*\n━━━━━━━━━━━━━━━━━━\nAll quant alerts, analytical breakdowns, and bot commands will now be displayed in English.\n\nYou can change it anytime with \`/lang\` or \`/dil\`.`);
        } else if (data === 'set_lang_de') {
            vipManager.setUserLang(chatId, 'de');
            await this.answerCallbackQuery(cq.id, 'Sprache auf Deutsch eingestellt! 🇩🇪');
            await this.sendMessage(chatId, `🇩🇪 *Spracheinstellung gespeichert: Deutsch*\n━━━━━━━━━━━━━━━━━━\nAlle Quant-Alarme, Analysen und Bot-Befehle werden nun auf Deutsch angezeigt.\n\nSie können dies jederzeit mit \`/sprache\` oder \`/lang\` ändern.`);
        } else if (data === 'cmd_start_trial') {
            const username = cq.from?.username || cq.from?.first_name || 'User';
            const userLang = vipManager.getUserLang(chatId);
            const trialRes = vipManager.startTrial(chatId, username);
            const isTr = userLang === 'tr';
            const isDe = userLang === 'de';

            if (trialRes.success) {
                await this.answerCallbackQuery(cq.id, isTr ? '🎉 3 Günlük Deneme Başlatıldı!' : '🎉 3-Day Trial Activated!');
                const inviteLink = await this.createInviteLink(username, 72);
                let msg = `🎉 *3-DAY VIP TRIAL PASS ACTIVATED!* 🎉\n━━━━━━━━━━━━━━━━━━\nWelcome @${username},\nYou have been granted full institutional access to our quantitative live signal feed for 3 days (72 hours).\n\n⏰ *Duration:* 3 Days (72 Hours - Full Weekend Bülteni)\n💎 *Tier:* Complimentary VIP Trial Pass\n\n🎟️ *Your One-Time VIP Access Link:* \n👉 ${inviteLink || 'Direct VIP access in progress...'}\n\n_To extend your pass or subscribe, type /vip anytime._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                if (isTr) {
                    msg = `🎉 *3 GÜNLÜK ÜCRETSİZ VIP DENEME BAŞLATILDI!* 🎉\n━━━━━━━━━━━━━━━━━━\nHoş geldiniz @${username},\n3 gün (72 saat) boyunca tüm canlı quant sinyallerimize, alevli maçlara ve kasa koruma bildirimlerimize ücretsiz tam erişim tanımlandı.\n\n⏰ *Süre:* 3 Gün (72 Saat - Hafta Sonu Dahil)\n💎 *Paket:* Ücretsiz VIP Deneme Paketi\n\n🎟️ *Tek Kullanımlık VIP Giriş Bağlantınız:* \n👉 ${inviteLink || 'VIP erişimi hazırlanıyor...'}\n\n_Sürenizi uzatmak veya paketleri incelemek için /vip yazabilirsiniz._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                } else if (isDe) {
                    msg = `🎉 *3-TAGE KOSTENLOSER VIP-PASS AKTIVIERT!* 🎉\n━━━━━━━━━━━━━━━━━━\nWillkommen @${username},\nSie haben 3 Tage (72 Stunden) lang vollen Zugriff auf unseren quantitativen Live-Signal-Feed und Kapitalschutz.\n\n⏰ *Dauer:* 3 Tage (72 Stunden)\n💎 *Paket:* Kostenloser VIP-Testpass\n\n🎟️ *Ihr persönlicher VIP-Zugangslink:* \n👉 ${inviteLink || 'VIP-Zugang wird vorbereitet...'}\n\n_Um den Pass zu verlängern, schreiben Sie /vip._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                }
                await this.sendMessage(chatId, msg);
            } else if (trialRes.reason === 'ACTIVE_TRIAL') {
                const rem = vipManager.getRemainingTime(chatId, userLang);
                await this.answerCallbackQuery(cq.id, isTr ? '⏳ Aktif denemeniz var!' : '⏳ Trial already active!');
                const msg = isTr
                    ? `⏳ *Aktif Deneme Süreniz Devam Ediyor!*\n\n• Kalan Süre: *${rem?.text || 'Aktif'}*\n\nVIP kanalımızdaki tüm canlı sinyal ve analizlerden yararlanmaya devam edebilirsiniz.`
                    : isDe
                    ? `⏳ *Aktive Testphase läuft bereits!*\n\n• Verbleibende Zeit: *${rem?.text || 'Aktiv'}*\n\nSie können weiterhin alle Signale und Alarme im VIP-Kanal nutzen.`
                    : `⏳ *Active Trial in Progress!*\n\n• Remaining Time: *${rem?.text || 'Active'}*\n\nYou can continue accessing all signals and real-time alerts in our VIP channel.`;
                await this.sendMessage(chatId, msg);
            } else {
                await this.answerCallbackQuery(cq.id, isTr ? 'ℹ️ Deneme hakkı daha önce kullanılmış.' : 'ℹ️ Trial already used.');
                const msg = isTr
                    ? `ℹ️ *Ücretsiz Deneme Hakkı Daha Önce Kullanılmış.*\n\nDaha önce 3 günlük deneme hakkınızı kullandınız. VIP grubumuza sınırsız erişmek için paketleri /vip yazarak inceleyebilirsiniz.`
                    : isDe
                    ? `ℹ️ *Testpass bereits eingelöst.*\n\nSie haben Ihre 3-tägige kostenlose Testphase bereits genutzt. Um dauerhaften Zugriff zu erhalten, tippen Sie /vip.`
                    : `ℹ️ *Trial Pass Already Used.*\n\nYou have already claimed your 3-day trial. To unlock permanent access to our VIP Quant Syndicate, type /vip.`;
                await this.sendMessage(chatId, msg);
            }
        } else if (data.startsWith('chk_pay_')) {
            const invoiceId = data.replace('chk_pay_', '');
            await this.answerCallbackQuery(cq.id, 'Ödeme kontrol ediliyor...');
            
            let isSettled = false;
            if (invoiceId && invoiceId !== '') {
                const invStatus = await cryptoPay.checkInvoiceStatus(invoiceId);
                if (invStatus.isPaid) {
                    await this.settlePaidInvoice({
                        invoiceId,
                        userId: chatId,
                        username: cq.from?.username || 'User',
                        amount: invStatus.amount,
                        asset: invStatus.asset,
                        plan: invStatus.payload?.plan || 'PROFESYONEL',
                        days: invStatus.payload?.days || 30
                    });
                    isSettled = true;
                }
            }

            if (!isSettled) {
                // Also trigger syncRecentPayments as fallback
                const syncRes = await cryptoPay.syncRecentPayments(async (pay) => {
                    await this.settlePaidInvoice(pay);
                });
                
                const userObj = vipManager.getUser(chatId);
                if (userObj?.status === 'ACTIVE' && userObj?.plan !== 'TRIAL') {
                    // Successfully found via sync
                    return;
                }

                await this.sendMessage(chatId, `⏳ *Ödeme Henüz Onaylanmadı*\n\nÖdemenizi tamamladıktan sonra lütfen 15-30 saniye bekleyip tekrar 'Ödememi Kontrol Et' butonuna basınız veya işlem dekontunu / hash numarasını bu sohbete iletiniz.`);
            }
        }
    }

    /**
     * Settle a successfully paid Crypto Pay invoice
     */
    async settlePaidInvoice(payInfo) {
        const { invoiceId, userId, username, amount, asset, plan = 'VIP', days = 30 } = payInfo;
        const grantRes = vipManager.addVip(userId, days, username, plan);
        const userInvite = await this.createInviteLink(`VIP_${username || userId}`, days * 24);

        const successMsg = `🎉 *ÖDEMENİZ BAŞARIYLA ALINDI!* 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━
Tebrikler @${username}, *${amount} ${asset}* tutarındaki VIP ödemeniz sistem tarafından otomatik onaylandı!

💎 *Paket:* ${plan} (${days} Gün Tam Erişim)
⏰ *Bitiş Tarihi:* ${new Date(grantRes.expiresAt).toLocaleDateString('tr-TR')}

🎟️ *Tek Kullanımlık Özel VIP Giriş Linkiniz:*
👉 ${userInvite || 'Kanal yöneticisi tarafından ekleneceksiniz'}

_Bol kazançlar dileriz! Live Bet Mentor VIP Syndicate_
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        await this.sendMessage(userId, successMsg);

        // Notify Admin
        for (const adminId of vipManager.adminIds) {
            if (adminId && adminId !== 'admin' && adminId !== '12345678') {
                await this.sendMessage(adminId, `💰 *YENİ VIP ÖDEME ALINDI! (Crypto Pay)* 💰\n━━━━━━━━━━━━━━━━━━\n👤 *Kullanıcı:* @${username} (\`${userId}\`)\n💵 *Tutar:* ${amount} ${asset}\n📅 *Süre:* ${days} Gün\n🧾 *Fatura ID:* #${invoiceId}`);
            }
        }
        return grantRes;
    }

    async handleUpdate(update) {
        const msg = update.message;
        if (!msg) return;

        const chatId = msg.chat.id;
        const username = msg.from?.username || msg.from?.first_name || 'User';
        const isAdmin = vipManager.isAdmin(chatId);

        // 0. Auto-detect forwarded channel or group ID
        if (msg.forward_from_chat) {
            const fChat = msg.forward_from_chat;
            await this.sendMessage(chatId, `📢 *Channel / Group Detected:*\n\n• Title: *${fChat.title || 'Channel'}*\n• Chat ID: \`${fChat.id}\`\n• Type: ${fChat.type}`);
            return;
        }

        const text = (msg.text || msg.caption || '').trim();
        const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
        const photoFileId = hasPhoto ? msg.photo[msg.photo.length - 1].file_id : null;

        // If not a command (doesn't start with /)
        if (!text.startsWith('/')) {
            // If sender is NOT an admin, relay payment proof / question to Admin
            if (!isAdmin && (text || hasPhoto)) {
                console.log(`[TELEGRAM] 📩 Customer submission from @${username} (${chatId}): ${text || '[Photo]'}`);

                // A. Professional receipt acknowledgement to customer
                const customerAck = `📩 *Submission Received!*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear @${username},
Our quantitative verification desk has received your submission.

⏱️ *Status:* Under Verification
Once verified, your private single-use VIP Syndicate access link will be delivered directly here in this chat.

_Average activation time: 2–5 minutes._
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
                await this.sendMessage(chatId, customerAck);

                // B. Relay alert directly to Admin
                const adminAlert = `🔔 *NEW PAYMENT / RECEIPT SUBMITTED!* 🔔
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *User:* @${username}
🆔 *Chat ID:* \`${chatId}\`
💬 *Note:* ${text || '(Receipt screenshot attached)'}

⚡ *One-Tap VIP Approval:*
• 30 Days: \`/grantvip ${chatId} 30\`
• 7 Days: \`/grantvip ${chatId} 7\`
• 90 Days: \`/grantvip ${chatId} 90\`

💬 *To reply to user:*
\`/reply ${chatId} Your message here...\`
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                for (const adminId of vipManager.adminIds) {
                    if (adminId && adminId !== 'admin' && adminId !== '12345678') {
                        if (hasPhoto) {
                            await this.sendPhoto(adminId, photoFileId, adminAlert);
                        } else {
                            await this.sendMessage(adminId, adminAlert);
                        }
                    }
                }
                return;
            }
            return;
        }

        console.log(`[TELEGRAM] Command from ${username}: ${text}`);

        let userLang = vipManager.getUserLang(chatId);

        const parts = text.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg1 = parts[1];
        const arg2 = parts[2];

        switch (cmd) {
            case '/start':
            case '/help':
            case '/hilfe': {
                // Check if user came from web with a trial activation deep link: /start trial_XXXXX
                if (arg1 && arg1.toLowerCase().startsWith('trial_')) {
                    const trialCode = arg1.trim();
                    const approveRes = vipManager.approveWebTrial(trialCode, chatId, username);
                    const isTr = userLang === 'tr';
                    const isDe = userLang === 'de';

                    if (approveRes.success) {
                        const inviteLink = await this.createInviteLink(username, 72);
                        let successMsg = `🎉 *3 GÜNLÜK VIP DENEMENİZ AKTİFLEŞTİRİLDİ!* 🎉\n━━━━━━━━━━━━━━━━━━\nHoş geldiniz @${username},\n\n✅ *Web Paneliniz Açıldı:* Web sitesindeki oturumunuz onaylandı, hemen giriş yapabilirsiniz.\n⏰ *Süre:* 3 Gün (72 Saat Tam Erişim - Hafta Sonu Bülteni Dahil)\n💎 *Paket:* VIP PRO Deneme\n\n🎟️ *VIP Telegram Kanal Linkiniz:*\n👉 ${inviteLink || 'Kanal yöneticisi tarafından ekleneceksiniz'}\n\n_3 gün sonunda VIP üyelik paketleri için /vip yazabilirsiniz._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;

                        if (isDe) {
                            successMsg = `🎉 *3-TAGE VIP-TESTPASS AKTIVIERT!* 🎉\n━━━━━━━━━━━━━━━━━━\nWillkommen @${username},\n\n✅ *Web-Panel freigeschaltet!*\n⏰ *Dauer:* 3 Tage (72 Stunden)\n💎 *Paket:* Kostenloser VIP PRO-Pass\n\n🎟️ *Ihr persönlicher VIP-Kanal Link:*\n👉 ${inviteLink || 'Link wird generiert...'}\n\n_Tippen Sie /vip für Verlängerungen._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                        } else if (!isTr) {
                            successMsg = `🎉 *3-DAY VIP TRIAL ACTIVATED!* 🎉\n━━━━━━━━━━━━━━━━━━\nWelcome @${username},\n\n✅ *Web Dashboard Unlocked!*\n⏰ *Duration:* 3 Days (72 Hours - Full Weekend Matchday)\n💎 *Tier:* VIP PRO Complimentary Pass\n\n🎟️ *Your One-Time VIP Telegram Channel Pass:*\n👉 ${inviteLink || 'Generating access...'}\n\n_To upgrade or extend, type /vip anytime._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                        }

                        await this.sendMessage(chatId, successMsg);
                        return;
                    } else if (approveRes.reason === 'TELEGRAM_ALREADY_USED') {
                        const errMsg = isTr
                            ? `⚠️ *ÜCRETSİZ DENEME HAKKINIZ DAHA ÖNCE KULLANILMIŞTIR!*\n━━━━━━━━━━━━━━━━━━\nBu Telegram hesabıyla daha önce 3 günlük deneme hakkı kullanılmıştır. Sistem kötüye kullanımını önlemek amacıyla her Telegram hesabına yalnızca 1 kez deneme hakkı tanınır.\n\n💎 *VIP Üyelik Satın Almak İçin:*\n👉 /vip yazarak avantajlı üyelik paketlerimizi inceleyebilirsiniz.`
                            : `⚠️ *TRIAL ALREADY CLAIMED!*\n━━━━━━━━━━━━━━━━━━\nThis Telegram account has already redeemed a 3-day trial pass. To prevent multi-account abuse, only 1 trial is permitted per Telegram user.\n\n💎 *To upgrade to VIP:*\n👉 Type /vip to view packages.`;
                        await this.sendMessage(chatId, errMsg);
                        return;
                    } else {
                        const notFoundMsg = isTr
                            ? `⚠️ *Geçersiz veya Süresi Dolmuş Aktivasyon Kodu.*\nLütfen web sitesinden tekrar kayıt olmayı deneyin veya yardım için /destek yazın.`
                            : `⚠️ *Invalid or Expired Activation Code.*\nPlease try registering again on the website or type /help.`;
                        await this.sendMessage(chatId, notFoundMsg);
                        return;
                    }
                }

                // Check deep link parameter (e.g. /start lang_de, /start lang_en, /start lang_tr)
                if (arg1) {
                    const deepLang = arg1.replace('lang_', '').toLowerCase();
                    if (['tr', 'en', 'de'].includes(deepLang)) {
                        vipManager.setUserLang(chatId, deepLang);
                        userLang = deepLang;
                    }
                } else if (!vipManager.getUser(chatId)?.lang && msg.from?.language_code) {
                    // Auto-detect Telegram app language if user has not explicitly set a language
                    const code = msg.from.language_code.toLowerCase();
                    if (code.startsWith('de')) {
                        vipManager.setUserLang(chatId, 'de');
                        userLang = 'de';
                    } else if (code.startsWith('tr')) {
                        vipManager.setUserLang(chatId, 'tr');
                        userLang = 'tr';
                    } else if (code.startsWith('en')) {
                        vipManager.setUserLang(chatId, 'en');
                        userLang = 'en';
                    }
                }
                await this.sendMessage(chatId, formatWelcome(userLang));
                break;
            }

            case '/vip':
            case '/satinal':
            case '/fiyat':
            case '/paket':
            case '/paketler':
            case '/odeme':
            case '/ucret': {
                const isTr = userLang === 'tr';
                const isDe = userLang === 'de';

                let invPro = null;
                let invPrem = null;
                let invProYearly = null;
                let invPremYearly = null;
                try {
                    [invPro, invPrem, invProYearly, invPremYearly] = await Promise.all([
                        cryptoPay.createInvoice({
                            userId: chatId,
                            username: username || 'User',
                            amount: '29',
                            currencyType: 'fiat',
                            fiat: 'EUR',
                            description: 'Live Bet Mentor - Profesyonel Aylık (30 Gün)',
                            plan: 'PROFESYONEL',
                            days: 30
                        }),
                        cryptoPay.createInvoice({
                            userId: chatId,
                            username: username || 'User',
                            amount: '79',
                            currencyType: 'fiat',
                            fiat: 'EUR',
                            description: 'Live Bet Mentor - Premium Aylık (30 Gün)',
                            plan: 'PREMIUM',
                            days: 30
                        }),
                        cryptoPay.createInvoice({
                            userId: chatId,
                            username: username || 'User',
                            amount: '228',
                            currencyType: 'fiat',
                            fiat: 'EUR',
                            description: 'Live Bet Mentor - Profesyonel Yıllık (365 Gün)',
                            plan: 'PROFESYONEL',
                            days: 365
                        }),
                        cryptoPay.createInvoice({
                            userId: chatId,
                            username: username || 'User',
                            amount: '660',
                            currencyType: 'fiat',
                            fiat: 'EUR',
                            description: 'Live Bet Mentor - Premium Yıllık (365 Gün)',
                            plan: 'PREMIUM',
                            days: 365
                        })
                    ]);
                } catch (e) {
                    console.error('[TELEGRAM] Crypto invoice creation error:', e.message);
                }

                const text = formatVIPInfo({}, userLang);
                const inline_keyboard = [];

                if (invPrem?.payUrl) {
                    inline_keyboard.push([
                        {
                            text: isTr ? '👑 PREMIUM (79 € / Ay)' : isDe ? '👑 PREMIUM (79 € / M)' : '👑 PREMIUM (79 € / Mo)',
                            url: invPrem.payUrl
                        },
                        {
                            text: isTr ? '💎 PRO (29 € / Ay)' : isDe ? '💎 PRO (29 € / M)' : '💎 PRO (29 € / Mo)',
                            url: invPro?.payUrl || 'https://t.me/CryptoBot'
                        }
                    ]);
                }

                if (invPremYearly?.payUrl) {
                    inline_keyboard.push([
                        {
                            text: isTr ? '👑 YILLIK PREMIUM (660 € — 2 Ay Hediye)' : isDe ? '👑 JÄHRLICH PREMIUM (660 €)' : '👑 ANNUAL PREMIUM (660 €)',
                            url: invPremYearly.payUrl
                        }
                    ]);
                }

                if (invProYearly?.payUrl) {
                    inline_keyboard.push([
                        {
                            text: isTr ? '💎 YILLIK PRO (228 € — 2 Ay Hediye)' : isDe ? '💎 JÄHRLICH PRO (228 €)' : '💎 ANNUAL PRO (228 €)',
                            url: invProYearly.payUrl
                        }
                    ]);
                }

                inline_keyboard.push([
                    {
                        text: isTr ? '🎁 3 Gün Ücretsiz Deneme' : isDe ? '🎁 3 Tage Gratis Testphase' : '🎁 3-Day Free Trial',
                        callback_data: 'cmd_start_trial'
                    },
                    {
                        text: isTr ? '🔄 Ödememi Kontrol Et' : isDe ? '🔄 Zahlung überprüfen' : '🔄 Check Payment',
                        callback_data: `chk_pay_${invPrem?.invoiceId || invPro?.invoiceId || ''}`
                    }
                ]);

                await this.sendMessage(chatId, text, {
                    reply_markup: { inline_keyboard }
                });
                break;
            }

            case '/trial':
            case '/deneme':
            case '/test': {
                const trialRes = vipManager.startTrial(chatId, username);
                const isTr = userLang === 'tr';
                const isDe = userLang === 'de';
                if (trialRes.success) {
                    const inviteLink = await this.createInviteLink(username, 72);
                    let msg = `🎉 *3-DAY VIP TRIAL PASS ACTIVATED!* 🎉\n━━━━━━━━━━━━━━━━━━\nWelcome @${username},\nYou have been granted full institutional access to our quantitative live signal feed for 3 days (72 hours).\n\n⏰ *Duration:* 3 Days (72 Hours - Full Weekend Matchday)\n💎 *Tier:* Complimentary VIP Trial Pass\n\n🎟️ *Your One-Time VIP Access Link:* \n👉 ${inviteLink || 'Direct VIP access in progress...'}\n\n_To extend your pass or subscribe, type /vip anytime._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                    if (isTr) {
                        msg = `🎉 *3 GÜNLÜK ÜCRETSİZ VIP DENEME BAŞLATILDI!* 🎉\n━━━━━━━━━━━━━━━━━━\nHoş geldiniz @${username},\n3 gün (72 saat) boyunca tüm canlı quant sinyallerimize ve kasa koruma bildirimlerimize ücretsiz erişim tanımlandı.\n\n⏰ *Süre:* 3 Gün (72 Saat - Hafta Sonu Bülteni Dahil)\n💎 *Paket:* Ücretsiz VIP Deneme Paketi\n\n🎟️ *Tek Kullanımlık VIP Giriş Bağlantınız:* \n👉 ${inviteLink || 'VIP erişimi hazırlanıyor...'}\n\n_Sürenizi uzatmak veya paketleri incelemek için /vip yazabilirsiniz._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                    } else if (isDe) {
                        msg = `🎉 *3-TAGE KOSTENLOSER VIP-PASS AKTIVIERT!* 🎉\n━━━━━━━━━━━━━━━━━━\nWillkommen @${username},\nSie haben 3 Tage (72 Stunden) lang vollen Zugriff auf unseren quantitativen Live-Signal-Feed und Kapitalschutz.\n\n⏰ *Dauer:* 3 Tage (72 Stunden)\n💎 *Paket:* Kostenloser VIP-Testpass\n\n🎟️ *Ihr persönlicher VIP-Zugangslink:* \n👉 ${inviteLink || 'VIP-Zugang wird vorbereitet...'}\n\n_Um den Pass zu verlängern, schreiben Sie /vip._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                    }
                    await this.sendMessage(chatId, msg);
                } else if (trialRes.reason === 'ACTIVE_TRIAL') {
                    const rem = vipManager.getRemainingTime(chatId, userLang);
                    const msg = isTr
                        ? `⏳ *Aktif Deneme Süreniz Devam Ediyor!*\n\n• Kalan Süre: *${rem?.text || 'Aktif'}*\n\nVIP kanalımızdaki tüm canlı sinyal ve analizlerden yararlanmaya devam edebilirsiniz.`
                        : isDe
                        ? `⏳ *Aktive Testphase läuft bereits!*\n\n• Verbleibende Zeit: *${rem?.text || 'Aktiv'}*\n\nSie können weiterhin alle Signale und Alarme im VIP-Kanal nutzen.`
                        : `⏳ *Active Trial in Progress!*\n\n• Remaining Time: *${rem?.text || 'Active'}*\n\nYou can continue accessing all signals and real-time alerts in our VIP channel.`;
                    await this.sendMessage(chatId, msg);
                } else {
                    const msg = isTr
                        ? `ℹ️ *Ücretsiz Deneme Hakkı Daha Önce Kullanılmış.*\n\nDaha önce 3 günlük deneme hakkınızı kullandınız. VIP grubumuza sınırsız erişmek için paketleri /vip yazarak inceleyebilirsiniz.`
                        : isDe
                        ? `ℹ️ *Testpass bereits eingelöst.*\n\nSie haben Ihre 3-tägige kostenlose Testphase bereits genutzt. Um dauerhaften Zugriff zu erhalten, tippen Sie /vip.`
                        : `ℹ️ *Trial Pass Already Used.*\n\nYou have already claimed your 3-day trial. To unlock permanent access to our VIP Quant Syndicate, type /vip.`;
                    await this.sendMessage(chatId, msg);
                }
                break;
            }

            case '/profile':
            case '/profil':
            case '/kalan': {
                const rem = vipManager.getRemainingTime(chatId, userLang);
                const userObj = vipManager.getUser(chatId);
                const isTr = userLang === 'tr';
                const isDe = userLang === 'de';

                if (rem && rem.active) {
                    const planName = isTr
                        ? (userObj?.plan === 'TRIAL' ? '3 Günlük Ücretsiz Deneme (72 Saat)' : 'VIP Quant Aboneliği')
                        : isDe
                        ? (userObj?.plan === 'TRIAL' ? '3-Tage Kostenlose Testphase (72h)' : 'VIP Quant-Abonnement')
                        : (userObj?.plan === 'TRIAL' ? '3-Day Free Trial (72 Hours)' : 'VIP Quant Subscription');

                    const msg = isTr
                        ? `👑 *VIP Abonelik & Profil Durumu:*\n━━━━━━━━━━━━━━━━━━\n• Kullanıcı: @${username}\n• Chat ID: \`${chatId}\`\n• Paket: *${planName}*\n• Durum: *AKTİF*\n• Kalan Süre: *${rem.text}*\n• Tercih Edilen Dil: *${userLang.toUpperCase()}*\n• Ayrıcalıklar: Canlı Sinyaller + Stop-Loss + Arbitraj Radarı\n━━━━━━━━━━━━━━━━━━\n_Yenilemek veya yükseltmek için /vip yazabilirsiniz._`
                        : isDe
                        ? `👑 *VIP-Abonnement & Profilstatus:*\n━━━━━━━━━━━━━━━━━━\n• Benutzer: @${username}\n• Chat ID: \`${chatId}\`\n• Paket: *${planName}*\n• Status: *AKTIV*\n• Verbleibende Zeit: *${rem.text}*\n• Bevorzugte Sprache: *${userLang.toUpperCase()}*\n• Privilegien: Live-Signale + Stop-Loss + Latenz-Radar\n━━━━━━━━━━━━━━━━━━\n_Zur Verlängerung schreiben Sie /vip._`
                        : `👑 *VIP Subscription & Profile Status:*\n━━━━━━━━━━━━━━━━━━\n• User: @${username}\n• Chat ID: \`${chatId}\`\n• Tier: *${planName}*\n• Status: *ACTIVE*\n• Time Remaining: *${rem.text}*\n• Preferred Language: *${userLang.toUpperCase()}*\n• Privileges: Real-time Signals + Stop-Loss + Latency Radar\n━━━━━━━━━━━━━━━━━━\n_To renew or upgrade, type /vip._`;
                    await this.sendMessage(chatId, msg);
                } else if (userObj && !rem.active) {
                    const msg = isTr
                        ? `⚠️ *VIP Abonelik Süreniz Sona Erdi.*\n━━━━━━━━━━━━━━━━━━\nSayın @${username}, VIP süreniz tamamlandı. Yenilemek için /vip yazabilirsiniz.`
                        : isDe
                        ? `⚠️ *VIP-Abonnement abgelaufen.*\n━━━━━━━━━━━━━━━━━━\nLiebe(r) @${username}, Ihr VIP-Pass ist beendet. Schreiben Sie /vip zur Verlängerung.`
                        : `⚠️ *VIP Subscription Expired.*\n━━━━━━━━━━━━━━━━━━\nDear @${username}, your VIP pass has ended. Type /vip to renew.`;
                    await this.sendMessage(chatId, msg);
                } else {
                    const msg = isTr
                        ? `ℹ️ *Aktif Bir VIP Aboneliği Bulunamadı.*\n━━━━━━━━━━━━━━━━━━\n• 3 Günlük *Ücretsiz* deneme başlat: /deneme\n• VIP Paketlerini incele: /vip\n• Dil tercihi: /dil`
                        : isDe
                        ? `ℹ️ *Kein aktives VIP-Abonnement gefunden.*\n━━━━━━━━━━━━━━━━━━\n• 3-Tage *KOSTENLOSE* Testphase: /test\n• VIP-Pakete ansehen: /vip\n• Sprache ändern: /sprache`
                        : `ℹ️ *No Active VIP Subscription Found.*\n━━━━━━━━━━━━━━━━━━\n• Start 3-day *FREE* trial: /trial\n• Explore VIP Syndicate tiers: /vip\n• Change language: /lang`;
                    await this.sendMessage(chatId, msg);
                }
                break;
            }

            case '/combo':
            case '/kupon':
            case '/kombine':
            case '/kombi': {
                const isTr = userLang === 'tr';
                const isDe = userLang === 'de';
                const msg = isTr
                    ? `🎟️ *Canlı Altın Çifte (Kombine Sihirbazı):*\n\nQuant algoritmalarımız devam eden canlı maçları analiz eder ve en yüksek olasılıklı iki değeri tek bir yüksek +EV kuponunda birleştirir.\n\n_Özel canlı kombine alarmları doğrudan VIP kanalımızda paylaşılmaktadır._\n\n👉 VIP Deneme Başlat: /deneme`
                    : isDe
                    ? `🎟️ *Live Gold-Kombi (Kombi-Assistent):*\n\nUnsere Algorithmen scannen laufende Spiele und kombinieren die beiden stärksten Value-Picks zu einer mathematisch optimierten Doppelwette (+EV).\n\n_Exklusive Gold-Kombi-Alarme werden direkt im VIP-Kanal geteilt._\n\n👉 VIP-Test starten: /test`
                    : `🎟️ *In-Play Golden Double (Combo Wizard):*\n\nOur quant algorithms automatically scan ongoing matches and pair the 2 highest-probability correlated opportunities into a high-EV double.\n\n_Curated golden double alerts are dispatched directly into our private VIP Syndicate._\n\n👉 Access VIP: /trial`;
                await this.sendMessage(chatId, msg);
                break;
            }

            case '/grantvip':
            case '/vipver': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Yetkisiz Erişim:* Bu komutu yalnızca sistem yöneticisi kullanabilir.`);
                    break;
                }
                const targetId = arg1;
                const days = parseInt(arg2) || 30;
                if (!targetId) {
                    await this.sendMessage(chatId, `ℹ️ *Kullanım:* \`/grantvip <TelegramID> <Gün>\`\nÖrnek: \`/grantvip 12345678 30\``);
                    break;
                }
                const grantRes = vipManager.addVip(targetId, days, 'VIP Member', 'VIP');
                const userInvite = await this.createInviteLink(`VIP_${targetId}`, days * 24);
                await this.sendMessage(chatId, `✅ *VIP Erişimi Tanımlandı!*\n\n• Hedef Chat ID: \`${targetId}\`\n• Süre: *${days} Gün*\n• Bitiş Tarihi: ${new Date(grantRes.expiresAt).toLocaleDateString('tr-TR')}\n• Davet Bağlantısı: ${userInvite || 'Oluşturulamadı'}`);
                if (userInvite) {
                    try {
                        await this.sendMessage(targetId, `🎉 *Tebrikler! ${days} günlük VIP erişiminiz tanımlandı!*\n\nVIP kanalımıza katılmak için dokunun:\n👉 ${userInvite}`);
                    } catch (e) {}
                }
                break;
            }

            case '/reply': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Yetkisiz Erişim:* Bu komutu yalnızca sistem yöneticisi kullanabilir.`);
                    break;
                }
                const targetId = arg1;
                const replyMsg = parts.slice(2).join(' ');
                if (!targetId || !replyMsg) {
                    await this.sendMessage(chatId, `ℹ️ *Kullanım:* \`/reply <ChatID> <Mesaj>\`\nÖrnek: \`/reply 12345678 Ödemeniz onaylandı, teşekkürler!\``);
                    break;
                }
                await this.sendMessage(targetId, `📩 *VIP Destek Ekibinden Mesaj:*\n\n${replyMsg}\n\n━━━━━━━━━━━━━━━━━━\n💎 *Live Bet Mentor VIP*`);
                await this.sendMessage(chatId, `✅ *Mesaj başarıyla iletildi:* \`${targetId}\``);
                break;
            }

            case '/revokevip':
            case '/vipsil': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Yetkisiz Erişim:* Bu komutu yalnızca sistem yöneticisi kullanabilir.`);
                    break;
                }
                const targetId = arg1;
                if (!targetId) {
                    await this.sendMessage(chatId, `ℹ️ *Kullanım:* \`/revokevip <TelegramID>\`\nÖrnek: \`/revokevip 12345678\``);
                    break;
                }
                vipManager.removeVip(targetId);
                await this.kickMember(targetId);
                await this.sendMessage(chatId, `🗑️ *Kullanıcının VIP yetkisi kaldırıldı:* \`${targetId}\``);
                break;
            }

            case '/vipreport':
            case '/viprapor': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Yetkisiz Erişim:* Bu komutu yalnızca sistem yöneticisi kullanabilir.`);
                    break;
                }
                const stats = vipManager.getStats();
                await this.sendMessage(chatId, `📊 *VIP Üyelik & Abone Raporu:*\n━━━━━━━━━━━━━━━━━━\n👥 Toplam Kayıtlı Üye: *${stats.total}*\n👑 Aktif VIP Üyeler: *${stats.activeVip}*\n⏳ Aktif Deneme Paketleri: *${stats.activeTrials}*\n🔴 Süresi Dolanlar: *${stats.expired}*\n━━━━━━━━━━━━━━━━━━\n⚡ Live Bet Mentor Monetization Engine`);
                break;
            }

            case '/stats':
            case '/rapor':
            case '/ozet': {
                const statsMsg = formatDailyReport(this.dailyStats, userLang);
                await this.sendMessage(chatId, statsMsg);
                break;
            }

            case '/ai':
            case '/ogrenme':
            case '/katsayi':
            case '/zeka':
                const aiReport = learningEngine.generateReport();
                await this.sendMessage(chatId, aiReport);
                break;

            case '/today':
            case '/sonuclar':
            case '/sinyaller':
                if (this.dailyStats.signals.length === 0) {
                    await this.sendMessage(chatId, isTr ? '📊 Bugün henüz sinyal gönderilmedi.' : '📊 No signals dispatched yet today.');
                } else {
                    const signalList = this.dailyStats.signals
                        .map((s, i) => {
                            const statusIcon = s.status === 'WON' ? '✅' : s.status === 'LOST' ? '❌' : '⏳';
                            const scoreText = s.resultScore ? ` (${s.resultScore})` : (s.scoreAtPrediction ? ` (${s.scoreAtPrediction})` : '');
                            const marketText = s.market ? ` · _${s.market.slice(0, 25)}_` : '';
                            return `${i + 1}. ${statusIcon} *${s.match}*${scoreText}${marketText}`;
                        })
                        .join('\n');
                    
                    const totalResolved = (this.dailyStats.won || 0) + (this.dailyStats.lost || 0);
                    const winRate = totalResolved > 0 ? (((this.dailyStats.won || 0) / totalResolved) * 100).toFixed(1) : '0.0';
                    const header = isTr
                        ? `📋 *Günün Sinyalleri (${this.dailyStats.total})*\n✅ Kazanan: ${this.dailyStats.won} | ❌ Kaybeden: ${this.dailyStats.lost} | ⏳ Bekleyen: ${this.dailyStats.pending}\n📈 Başarı Oranı: *%${winRate}*\n━━━━━━━━━━━━━━━━━━\n\n`
                        : `📋 *Today's Signals (${this.dailyStats.total})*\n✅ Won: ${this.dailyStats.won} | ❌ Lost: ${this.dailyStats.lost} | ⏳ Pending: ${this.dailyStats.pending}\n📈 Win Rate: *${winRate}%*\n━━━━━━━━━━━━━━━━━━\n\n`;
                    await this.sendMessage(chatId, header + signalList);
                }
                break;

            case '/id': {
                const isTr = userLang === 'tr';
                const isDe = userLang === 'de';
                let idMsg = `🆔 *Your Telegram Information:*\n\n• Chat ID: \`${chatId}\`\n• Username: @${username}\n• Preferred Language: *English* 🇬🇧\n\n_Provide this Chat ID to admin to activate your VIP membership._`;
                if (isTr) {
                    idMsg = `🆔 *Telegram Bilgileriniz:*\n\n• Chat ID: \`${chatId}\`\n• Kullanıcı: @${username}\n• Tercih Edilen Dil: *Türkçe* 🇹🇷\n\n_Bu ID numarasını yöneticiye ileterek VIP üyeliğinizi hemen tanımlatabilirsiniz._`;
                } else if (isDe) {
                    idMsg = `🆔 *Ihre Telegram-Informationen:*\n\n• Chat ID: \`${chatId}\`\n• Benutzer: @${username}\n• Bevorzugte Sprache: *Deutsch* 🇩🇪\n\n_Senden Sie diese Chat ID an den Administrator, um Ihre VIP-Mitgliedschaft zu aktivieren._`;
                }
                await this.sendMessage(chatId, idMsg);
                break;
            }

            case '/lang':
            case '/dil':
            case '/sprache': {
                const newLang = (arg1 || '').toLowerCase();
                if (newLang === 'tr' || newLang === 'turkce' || newLang === 'türkçe') {
                    vipManager.setUserLang(chatId, 'tr');
                    await this.sendMessage(chatId, `🇹🇷 *Dil tercihi Türkçe olarak güncellendi.*\n\nArtık bot bildirimleri, analizler ve komut yanıtları Türkçe gelecektir.`);
                } else if (newLang === 'en' || newLang === 'english' || newLang === 'ingilizce') {
                    vipManager.setUserLang(chatId, 'en');
                    await this.sendMessage(chatId, `🇬🇧 *Language preference set to English.*\n\nBot notifications, quantitative analysis, and command responses will now be in English.`);
                } else if (newLang === 'de' || newLang === 'deutsch' || newLang === 'german' || newLang === 'almanca') {
                    vipManager.setUserLang(chatId, 'de');
                    await this.sendMessage(chatId, `🇩🇪 *Spracheinstellung auf Deutsch aktualisiert.*\n\nBot-Benachrichtigungen, Analysen und Befehlsantworten erfolgen jetzt auf Deutsch.`);
                } else {
                    const isTr = userLang === 'tr';
                    const isDe = userLang === 'de';
                    const curLangName = isTr ? 'Türkçe 🇹🇷' : isDe ? 'Deutsch 🇩🇪' : 'English 🇬🇧';
                    const promptText = isTr
                        ? `🌐 *Dil Tercihi / Language Selection / Sprachauswahl*\n\nMevcut diliniz: *${curLangName}*\n\nAşağıdaki butonlardan seçebilir veya doğrudan komut yazabilirsiniz:\n• \`/dil tr\` (Türkçe)\n• \`/lang en\` (English)\n• \`/sprache de\` (Deutsch)`
                        : isDe
                        ? `🌐 *Sprachauswahl / Language Selection / Dil Tercihi*\n\nAktuelle Sprache: *${curLangName}*\n\nWählen Sie eine Option unten oder verwenden Sie die Befehle:\n• \`/sprache de\` (Deutsch)\n• \`/lang en\` (English)\n• \`/dil tr\` (Türkçe)`
                        : `🌐 *Language Selection / Dil Tercihi / Sprachauswahl*\n\nCurrent language: *${curLangName}*\n\nSelect an option below or use commands:\n• \`/lang en\` (English)\n• \`/dil tr\` (Türkçe)\n• \`/sprache de\` (Deutsch)`;

                    await this.sendMessage(chatId, promptText, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🇹🇷 Türkçe', callback_data: 'set_lang_tr' },
                                    { text: '🇬🇧 English', callback_data: 'set_lang_en' },
                                    { text: '🇩🇪 Deutsch', callback_data: 'set_lang_de' }
                                ]
                            ]
                        }
                    });
                }
                break;
            }

            case '/katil':
            case '/link':
                const inviteLink = await this.createInviteLink(username, 72);
                if (inviteLink) {
                    await this.sendMessage(chatId, isTr
                        ? `🎟️ *VIP Kanala Katılım Bağlantınız:*\n\nBu bağlantı tek kullanımlıktır ve 72 saat (3 gün) geçerlidir:\n👉 ${inviteLink}\n\n_Giriş yaptıktan sonra bağlantı otomatik olarak kapanır._`
                        : `🎟️ *Your VIP Syndicate Join Link:*\n\nThis link is single-use and valid for 72 hours (3 days):\n👉 ${inviteLink}\n\n_Link expires automatically upon entry._`);
                } else {
                    await this.sendMessage(chatId, isTr
                        ? `ℹ️ *VIP Bağlantı Bilgisi:*\nVIP Grubumuz: *${this.vipGroupId || 'Canlı Kanal'}*\n\nDoğrudan ekleme veya yetki tanımlaması için lütfen sistem yöneticisiyle iletişime geçin.`
                        : `ℹ️ *VIP Syndicate Access Info:*\nVIP Group: *${this.vipGroupId || 'Live Channel'}*\n\nPlease contact the administrator for manual authorization.`);
                }
                break;

            case '/radar':
            case '/banko':
            case '/consensus':
            case '/konsensus': {
                const picks = consensusReader.getTopConsensusPicks({ minSources: 4, minAgreement: 75, limit: 3 });
                if (!picks || picks.length === 0) {
                    const noMsg = isTr
                        ? `📡 *Maç Öncesi Konsensüs Radarı:*\n\nŞu anda 4+ platformda %75 ve üzeri ortak uzlaşıya varan maç bulunmuyor. Canlı bülten taranıyor...`
                        : `📡 *Pre-Match Consensus Radar:*\n\nNo fixtures currently meet the 75%+ consensus threshold across 4+ ingestion sources. Scraping live bulletin...`;
                    await this.sendMessage(chatId, noMsg);
                    break;
                }
                const header = isTr
                    ? `🎯 *MAÇ ÖNCESİ KONSENSÜS RADARI (En İyi Algoritmik Tercihler)*\n━━━━━━━━━━━━━━━━━━\n`
                    : `🎯 *PRE-MATCH CONSENSUS RADAR (Top Quantitative Picks)*\n━━━━━━━━━━━━━━━━━━\n`;
                const list = picks.map((p, idx) => {
                    const agreeIcon = p.agreementPercent === 100 ? '🔥' : '⭐';
                    const score = Object.values(p.scorePredictions || {})[0] || '-';
                    return isTr
                        ? `${idx + 1}. ${agreeIcon} *${p.home} vs ${p.away}*\n   • Tercih: *${p.topPred}* (%${p.agreementPercent} — ${p.topCount}/${p.totalSources} Model)\n   • Lig: _${p.league}_ | Başlama: ${p.time || '-'}\n   • Tahmini Skor: \`${score}\``
                        : `${idx + 1}. ${agreeIcon} *${p.home} vs ${p.away}*\n   • Selection: *${p.topPred}* (${p.agreementPercent}% — ${p.topCount}/${p.totalSources} Models)\n   • League: _${p.league}_ | Kickoff: ${p.time || '-'}\n   • Algorithmic Score: \`${score}\``;
                }).join('\n\n');

                const footer = isTr
                    ? `\n\n━━━━━━━━━━━━━━━━━━\n💡 _Detaylı model dağılımları, skor tahminleri ve Kelly kasa önerileri VIP Syndicate grubumuzda._`
                    : `\n\n━━━━━━━━━━━━━━━━━━\n💡 _Full algorithmic breakdown, score forecasts and bankroll advice available in VIP Syndicate._`;
                await this.sendMessage(chatId, header + list + footer);
                break;
            }

            case '/broadcastradar':
            case '/yayinla': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Unauthorized:* Only system administrators can execute this command.`);
                    break;
                }
                await this.sendMessage(chatId, `⏳ Scanning highest-consensus fixtures and broadcasting to Telegram channels...`);
                const bRes = await this.broadcastConsensusPicks({ force: true, limit: 2 });
                if (bRes.ok) {
                    await this.sendMessage(chatId, `✅ *Broadcast Successful!*\n\n• Dispatched Fixtures: *${bRes.count}*\n• VIP Group & Public Channel updated.`);
                } else {
                    await this.sendMessage(chatId, `❌ Broadcast Error: ${bRes.error || bRes.message}`);
                }
                break;
            }

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
     * Schedule daily report (call this once at startup, default 23:00 TSİ)
     */
    scheduleDailyReport(targetHourTRT = 23, targetMinuteTRT = 0) {
        const scheduleNext = () => {
            const now = new Date();
            const targetUtcHour = (targetHourTRT - 3 + 24) % 24;
            const targetUtc = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                targetUtcHour,
                targetMinuteTRT,
                0,
                0
            ));
            if (targetUtc.getTime() <= now.getTime()) {
                targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
            }

            const delay = targetUtc.getTime() - now.getTime();
            console.log(`[TELEGRAM] 📅 Next daily report (23:00 TSİ) scheduled in ${Math.round(delay / 60000)} minutes (${targetUtc.toISOString()})`);

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
            vipChannels: this.vipChannels || { tr: this.vipGroupId, en: null, de: null },
            publicChannels: this.publicChannels || { tr: this.publicChannelId, en: null, de: null },
            minLevel: this.minLevel,
            lang: this.lang,
            supportedLanguages: ['tr', 'en', 'de'],
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
