/**
 * VIP MEMBERSHIP & SUBSCRIPTION AUTOMATION MANAGER (v1.0)
 * Handles:
 * - 3-day instant free trials (/deneme)
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
        this.adminIds = (process.env.TELEGRAM_ADMIN_IDS || '12345678,admin').split(',').map(s => s.trim());
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
     * Start a 3-day instant free trial
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

        const durationMs = 3 * 24 * 60 * 60 * 1000; // 3 days
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
     * Get remaining time in friendly text
     */
    getRemainingTime(chatId) {
        const user = this.getUser(chatId);
        if (!user) return null;

        const diffMs = user.expiresAt - Date.now();
        if (diffMs <= 0) {
            return { active: false, text: 'Süresi Doldu' };
        }

        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        return {
            active: true,
            days,
            hours,
            text: `${days} Gün ${hours} Saat`
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
}

export const vipManager = new VipManager();
