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
    formatWelcome,
    formatVIPInfo,
    formatCashOutAlert,
    formatGoldenCombo,
    formatLatencyArbitrageAlert
} from './telegramTemplates.js';
import { learningEngine } from './learningEngine.js';
import { cashOutEngine } from './cashOutEngine.js';
import { vipManager } from './vipManager.js';

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
        this.enabled = process.env.TELEGRAM_ENABLED !== 'false';
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
    async sendDailyReport(reset = false) {
        const report = formatDailyReport(this.dailyStats);

        const results = {};
        if (this.vipGroupId) {
            results.vip = await this.sendMessage(this.vipGroupId, report);
        }
        if (this.publicChannelId) {
            results.public = await this.sendMessage(this.publicChannelId, report);
        }

        console.log('[TELEGRAM] 📊 Daily report sent');

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
        if (!this.enabled || !this.vipGroupId || !combo) return null;
        const message = formatGoldenCombo(combo);
        if (!message) return null;
        const result = await this.sendMessage(this.vipGroupId, message);
        console.log(`[TELEGRAM] 🎟️ Golden Double Combo sent to VIP`);
        return result;
    }

    /**
     * Send Latency Arbitrage Alert to VIP
     */
    async sendLatencyArbitrage(arb) {
        if (!this.enabled || !this.vipGroupId || !arb) return null;
        const message = formatLatencyArbitrageAlert(arb);
        if (!message) return null;
        const result = await this.sendMessage(this.vipGroupId, message);
        console.log(`[TELEGRAM] ⚡ Latency Arbitrage alert sent to VIP: ${arb.homeTeam} vs ${arb.awayTeam}`);
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
                const message = formatSignalResult(signal, result, score, this.dailyStats);
                if (result === 'WON') {
                    if (this.vipGroupId) {
                        await this.sendMessage(this.vipGroupId, message);
                    }
                    if (this.publicChannelId) {
                        await this.sendMessage(this.publicChannelId, message);
                    }
                } else if (result === 'LOST' && this.vipGroupId) {
                    await this.sendMessage(this.vipGroupId, message);
                }
            } catch (e) {
                console.error('[TELEGRAM] Error sending resolution notification:', e.message);
            }
        }

        return signal;
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

            // 1. OVER GOALS (Üst)
            if (marketText.includes('üst') || marketText.includes('over')) {
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
            // 2. BTTS / KG VAR
            else if (marketText.includes('karşılıklı') || marketText.includes('kg var') || marketText.includes('btts')) {
                if (curHome >= 1 && curAway >= 1) {
                    const res = await this.resolveSignal(signal, 'WON', currentScoreStr, true);
                    if (res) resolved.push(res);
                } else if (isFinished) {
                    const res = await this.resolveSignal(signal, 'LOST', currentScoreStr, true);
                    if (res) resolved.push(res);
                }
            }
            // 3. NEXT GOAL (Sıradaki Gol / Comeback / Press)
            else if (marketText.includes('sıradaki') || marketText.includes('next_goal') || marketText.includes('comeback') || marketText.includes('press') || marketText.includes('dominasyon')) {
                const homeName = (signal.homeTeam || signal.match?.split(' vs ')[0] || '').toLowerCase();
                const awayName = (signal.awayTeam || signal.match?.split(' vs ')[1] || '').toLowerCase();

                const isHomeTarget = marketText.includes('home') || marketText.includes('ev') || (homeName && marketText.includes(homeName.slice(0, 5)));
                const isAwayTarget = marketText.includes('away') || marketText.includes('deplasman') || (awayName && marketText.includes(awayName.slice(0, 5)));

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
            for (const co of cashOuts) {
                if (this.vipGroupId) {
                    const coMsg = formatCashOutAlert(co);
                    await this.sendMessage(this.vipGroupId, coMsg);
                    console.log(`[TELEGRAM] ⚠️ Cash-out alert dispatched for ${co.matchTitle}: ${co.reason}`);
                }
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

        const parts = text.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg1 = parts[1];
        const arg2 = parts[2];

        switch (cmd) {
            case '/start':
            case '/help':
                await this.sendMessage(chatId, formatWelcome());
                break;

            case '/vip':
                await this.sendMessage(chatId, formatVIPInfo());
                break;

            case '/trial':
            case '/deneme': {
                const trialRes = vipManager.startTrial(chatId, username);
                if (trialRes.success) {
                    const inviteLink = await this.createInviteLink(username, 72);
                    const msg = `🎉 *3-DAY VIP TRIAL PASS ACTIVATED!* 🎉\n━━━━━━━━━━━━━━━━━━\nWelcome @${username},\nYou have been granted full institutional access to our quantitative live signal feed for 72 hours.\n\n⏰ *Duration:* 3 Days (72 Hours)\n💎 *Tier:* Complimentary VIP Trial Pass\n\n🎟️ *Your One-Time VIP Access Link:* \n👉 ${inviteLink || 'Direct VIP access in progress...'}\n\n_To extend your pass or subscribe, type /vip anytime._\n━━━━━━━━━━━━━━━━━━\n⚡ *LIVE BET MENTOR VIP SYNDICATE*`;
                    await this.sendMessage(chatId, msg);
                } else if (trialRes.reason === 'ACTIVE_TRIAL') {
                    const rem = vipManager.getRemainingTime(chatId);
                    await this.sendMessage(chatId, `⏳ *Active Trial in Progress!*\n\n• Remaining Time: *${rem?.text || 'Active'}*\n\nYou can continue accessing all signals and real-time alerts in our VIP channel.`);
                } else {
                    await this.sendMessage(chatId, `ℹ️ *Trial Pass Already Used.*\n\nYou have already claimed your 3-day trial. To unlock permanent access to our VIP Quant Syndicate, type /vip.`);
                }
                break;
            }

            case '/profile':
            case '/profil':
            case '/kalan': {
                const rem = vipManager.getRemainingTime(chatId);
                const userObj = vipManager.getUser(chatId);
                if (rem && rem.active) {
                    const planName = userObj?.plan === 'TRIAL' ? '3-Day Free Trial' : 'VIP Quant Subscription';
                    await this.sendMessage(chatId, `👑 *VIP Subscription & Profile Status:*\n━━━━━━━━━━━━━━━━━━\n• User: @${username}\n• Chat ID: \`${chatId}\`\n• Tier: *${planName}*\n• Status: *ACTIVE*\n• Time Remaining: *${rem.text}*\n• Privileges: Real-time Signals + Stop-Loss + Latency Radar\n━━━━━━━━━━━━━━━━━━\n_To renew or upgrade, type /vip._`);
                } else if (userObj && !rem.active) {
                    await this.sendMessage(chatId, `⚠️ *VIP Subscription Expired.*\n━━━━━━━━━━━━━━━━━━\nDear @${username}, your VIP pass has ended. Type /vip to renew.`);
                } else {
                    await this.sendMessage(chatId, `ℹ️ *No Active VIP Subscription Found.*\n━━━━━━━━━━━━━━━━━━\n• Start 3-day *FREE* trial: /trial\n• Explore VIP Syndicate tiers: /vip`);
                }
                break;
            }

            case '/combo':
            case '/kupon':
            case '/kombine':
                await this.sendMessage(chatId, `🎟️ *In-Play Golden Double (Combo Wizard):*\n\nOur quant algorithms automatically scan ongoing matches and pair the 2 highest-probability correlated opportunities into a high-EV double.\n\n_Curated golden double alerts are dispatched directly into our private VIP Syndicate._\n\n👉 Access VIP: /trial`);
                break;

            case '/grantvip':
            case '/vipver': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Unauthorized:* Only system administrators can execute this command.`);
                    break;
                }
                const targetId = arg1;
                const days = parseInt(arg2) || 30;
                if (!targetId) {
                    await this.sendMessage(chatId, `ℹ️ *Usage:* \`/grantvip <TelegramID> <Days>\`\nExample: \`/grantvip 12345678 30\``);
                    break;
                }
                const grantRes = vipManager.addVip(targetId, days, 'VIP Member', 'VIP');
                const userInvite = await this.createInviteLink(`VIP_${targetId}`, days * 24);
                await this.sendMessage(chatId, `✅ *VIP Access Granted!*\n\n• Target Chat ID: \`${targetId}\`\n• Granted Duration: *${days} Days*\n• Expiration Date: ${new Date(grantRes.expiresAt).toLocaleDateString('en-GB')}\n• Invite Link: ${userInvite || 'Failed to create'}`);
                if (userInvite) {
                    try {
                        await this.sendMessage(targetId, `🎉 *Congratulations! You have been granted ${days} days of VIP Syndicate Access!*\n\nClick below to join the private VIP channel:\n👉 ${userInvite}`);
                    } catch (e) {}
                }
                break;
            }

            case '/reply': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Unauthorized:* Only system administrators can execute this command.`);
                    break;
                }
                const targetId = arg1;
                const replyMsg = parts.slice(2).join(' ');
                if (!targetId || !replyMsg) {
                    await this.sendMessage(chatId, `ℹ️ *Usage:* \`/reply <ChatID> <Message>\`\nExample: \`/reply 12345678 Payment received, thank you!\``);
                    break;
                }
                await this.sendMessage(targetId, `📩 *Message from VIP Support Desk:*\n\n${replyMsg}\n\n━━━━━━━━━━━━━━━━━━\n💎 *Live Bet Mentor VIP Syndicate*`);
                await this.sendMessage(chatId, `✅ *Reply delivered successfully to:* \`${targetId}\``);
                break;
            }

            case '/revokevip':
            case '/vipsil': {
                if (!vipManager.isAdmin(chatId)) {
                    await this.sendMessage(chatId, `⛔ *Unauthorized:* Only system administrators can execute this command.`);
                    break;
                }
                const targetId = arg1;
                if (!targetId) {
                    await this.sendMessage(chatId, `ℹ️ *Usage:* \`/revokevip <TelegramID>\`\nExample: \`/revokevip 12345678\``);
                    break;
                }
                vipManager.removeVip(targetId);
                await this.kickMember(targetId);
                await this.sendMessage(chatId, `🗑️ *User VIP privileges revoked:* \`${targetId}\``);
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
            case '/ozet':
                const statsMsg = formatDailyReport(this.dailyStats);
                await this.sendMessage(chatId, statsMsg);
                break;

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
                    await this.sendMessage(chatId, '📊 Bugün henüz sinyal gönderilmedi.');
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
                    const header = `📋 *Günün Sinyalleri (${this.dailyStats.total})*\n✅ Kazanan: ${this.dailyStats.won} | ❌ Kaybeden: ${this.dailyStats.lost} | ⏳ Bekleyen: ${this.dailyStats.pending}\n📈 Başarı Oranı: *%${winRate}*\n━━━━━━━━━━━━━━━━━━\n\n`;
                    await this.sendMessage(chatId, header + signalList);
                }
                break;

            case '/id':
                await this.sendMessage(chatId, `🆔 *Telegram Bilgileriniz:*\n\n• Chat ID: \`${chatId}\`\n• Kullanıcı: @${username}\n\n_Bu ID numarasını yöneticiye ileterek VIP üyeliğinizi hemen tanımlatabilirsiniz._`);
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
