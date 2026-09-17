/**
 * VIP MEMBERSHIP & SUBSCRIPTION AUTOMATION MANAGER (v1.0)
 * Handles:
 * - 24-hour instant free trials (/deneme, /trial, /test)
 * - Subscription duration tracking & expiration
 * - Admin grants (/vipver, /vipsil)
 * - Automated expiration alerts and stats
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VipManager {
    constructor() {
        this.filePath = path.join(__dirname, 'vip_users.json');
        this.adminIds = (process.env.TELEGRAM_ADMIN_IDS || '8965087988,12345678').split(',').map(s => s.trim());
        this.users = {};
        this.loadUsers();
    }

    loadUsers() {
        try {
            if (fs.existsSync(this.filePath)) {
                this.users = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            } else {
                this.users = {};
                this.saveUsers();
            }
        } catch (e) {
            console.error('[VIP_MANAGER] Error loading vip_users.json:', e.message);
            this.users = {};
        }
    }

    saveUsers() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.users, null, 2), 'utf8');
        } catch (e) {
            console.error('[VIP_MANAGER] Error saving vip_users.json:', e.message);
        }
    }

    isAdmin(chatId) {
        return this.adminIds.includes(String(chatId));
    }

    getUser(chatId) {
        return this.users[String(chatId)] || null;
    }

    /**
     * Start a 24-hour instant free trial
     */
    startTrial(chatId, username = 'User') {
        const id = String(chatId);
        const existing = this.users[id];

        if (existing && (existing.hadTrial || existing.plan === 'TRIAL')) {
            const now = Date.now();
            if (existing.expiresAt > now) {
                return {
                    success: false,
                    reason: 'ACTIVE_TRIAL',
                    expiresAt: existing.expiresAt
                };
            }
            return {
                success: false,
                reason: 'TRIAL_EXPIRED',
                expiresAt: existing.expiresAt
            };
        }

        const durationMs = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)
        const now = Date.now();
        const expiresAt = now + durationMs;

        this.users[id] = {
            chatId: id,
            username: username || 'User',
            plan: 'TRIAL',
            status: 'ACTIVE',
            hadTrial: true,
            startedAt: now,
            expiresAt,
            reminderSent: false
        };

        this.saveUsers();
        return { success: true, expiresAt };
    }

    /**
     * Add or extend VIP days (Admin action)
     */
    addVip(chatId, days = 30, username = 'User', plan = 'MONTHLY') {
        const id = String(chatId);
        const existing = this.users[id];
        const now = Date.now();
        const addMs = parseInt(days) * 24 * 60 * 60 * 1000;

        let baseTime = now;
        if (existing && existing.expiresAt > now) {
            baseTime = existing.expiresAt; // extend from current expiration
        }

        const expiresAt = baseTime + addMs;

        this.users[id] = {
            chatId: id,
            username: username || existing?.username || 'User',
            plan,
            status: 'ACTIVE',
            hadTrial: existing?.hadTrial || false,
            startedAt: existing?.startedAt || now,
            expiresAt,
            reminderSent: false,
            lastRenewedAt: now
        };

        this.saveUsers();
        return { success: true, expiresAt };
    }

    /**
     * Revoke or expire VIP
     */
    removeVip(chatId) {
        const id = String(chatId);
        if (this.users[id]) {
            this.users[id].status = 'EXPIRED';
            this.users[id].expiresAt = Date.now();
            this.saveUsers();
            return true;
        }
        return false;
    }

    /**
     * Check if user is currently an active VIP or Trial
     */
    isVipActive(chatId) {
        const user = this.getUser(chatId);
        if (!user) return false;
        return user.status === 'ACTIVE' && user.expiresAt > Date.now();
    }

    /**
     * Get user's preferred language ('tr', 'en', or 'de')
     */
    getUserLang(chatId) {
        const user = this.getUser(chatId);
        return user?.lang || process.env.TELEGRAM_LANG || 'tr';
    }

    /**
     * Set user's preferred language ('tr', 'en', or 'de')
     */
    setUserLang(chatId, lang) {
        const id = String(chatId);
        const validLang = ['tr', 'en', 'de'].includes(lang) ? lang : 'tr';
        if (!this.users[id]) {
            this.users[id] = {
                chatId: id,
                username: 'User',
                plan: 'NONE',
                status: 'INACTIVE',
                lang: validLang
            };
        } else {
            this.users[id].lang = validLang;
        }
        this.saveUsers();
        return validLang;
    }

    /**
     * Get remaining time in friendly text
     */
    getRemainingTime(chatId, lang = 'tr') {
        const user = this.getUser(chatId);
        if (!user) return null;

        const isTr = lang === 'tr';
        const isDe = lang === 'de';
        const diffMs = user.expiresAt - Date.now();
        if (diffMs <= 0) {
            return { active: false, text: isTr ? 'Süresi Doldu' : isDe ? 'Abgelaufen' : 'Expired' };
        }

        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        let text = `${days} Days ${hours} Hours`;
        if (isTr) text = `${days} Gün ${hours} Saat`;
        if (isDe) text = `${days} Tage ${hours} Std.`;

        return {
            active: true,
            days,
            hours,
            text
        };
    }

    /**
     * Get membership overview stats
     */
    getStats() {
        const now = Date.now();
        const all = Object.values(this.users);
        const activeVip = all.filter(u => u.status === 'ACTIVE' && u.plan !== 'TRIAL' && u.expiresAt > now).length;
        const activeTrials = all.filter(u => u.status === 'ACTIVE' && u.plan === 'TRIAL' && u.expiresAt > now).length;
        const expired = all.filter(u => u.expiresAt <= now || u.status === 'EXPIRED').length;

        return {
            total: all.length,
            activeVip,
            activeTrials,
            expired
        };
    }

    /**
     * Link and approve a web trial using activation code sent via Telegram deep-link
     */
    approveWebTrial(trialCode, chatId, username = 'User') {
        const id = String(chatId);
        const existingTgUser = this.users[id];

        // Anti-Abuse: If this Telegram account already had a trial, reject!
        if (existingTgUser && (existingTgUser.hadTrial || existingTgUser.plan === 'TRIAL')) {
            return {
                success: false,
                reason: 'TELEGRAM_ALREADY_USED',
                message: 'Bu Telegram hesabı ile daha önce 3 günlük ücretsiz deneme hakkı kullanılmıştır.'
            };
        }

        const membersFile = path.join(__dirname, 'web_members.json');
        let members = [];
        try {
            if (fs.existsSync(membersFile)) {
                members = JSON.parse(fs.readFileSync(membersFile, 'utf8'));
            }
        } catch (e) {
            console.error('[VIP_MANAGER] Error reading web_members.json:', e.message);
        }

        const cleanCode = (trialCode || '').trim();
        const member = members.find(m => m.trial_code && m.trial_code.toLowerCase() === cleanCode.toLowerCase());

        if (!member) {
            return {
                success: false,
                reason: 'INVALID_CODE',
                message: 'Geçersiz veya süresi dolmuş aktivasyon kodu.'
            };
        }

        // Start Telegram trial (3 days / 72 hours)
        this.startTrial(chatId, username);

        // Update Web member
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 Days (72h)

        member.status = 'approved';
        member.plan = 'trial';
        member.telegram_chat_id = id;
        member.telegram_username = username;
        member.subscription_start = now.toISOString();
        member.subscription_end = trialEnd.toISOString();
        member.trial_verified_at = now.toISOString();

        try {
            fs.writeFileSync(membersFile, JSON.stringify(members, null, 2), 'utf8');
        } catch (e) {
            console.error('[VIP_MANAGER] Error saving web_members.json:', e.message);
        }

        return {
            success: true,
            member,
            expiresAt: trialEnd.toISOString()
        };
    }
}

export const vipManager = new VipManager();
