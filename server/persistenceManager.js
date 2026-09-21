/**
 * RESILIENT PERSISTENCE MANAGER
 * Bridges local container JSON files with Supabase PostgreSQL cloud backup
 * to survive ephemeral disk resets on Render redeploys and cold starts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://benbfhpxgjiqmgcruwqv.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_IQJcRKgo5VaTX5QqOQx-Nw_rvlP0YLk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MEMBERS_FILE = path.join(__dirname, 'web_members.json');
const SEED_MEMBERS_FILE = path.join(__dirname, 'seed_members.json');
const VIP_FILE = path.join(__dirname, 'vip_users.json');
const TRIALS_FILE = path.join(__dirname, 'device_trials.json');
const UPGRADES_FILE = path.join(__dirname, 'upgrade_requests.json');

// --- In-Memory Fallback Cache ---
let memoryMembers = null;
let memoryVipUsers = null;

// ==========================================
// 1. MEMBERS PERSISTENCE
// ==========================================

export function loadMembers() {
    if (memoryMembers && memoryMembers.length > 0) {
        return memoryMembers;
    }
    try {
        if (fs.existsSync(MEMBERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
            if (Array.isArray(data) && data.length > 0) {
                memoryMembers = data;
                return data;
            }
        }
    } catch (e) {
        console.error('[PERSISTENCE] Error reading web_members.json:', e.message);
    }

    // Fallback to committed seed file if local file is empty or missing (e.g. fresh Render container deploy)
    try {
        if (fs.existsSync(SEED_MEMBERS_FILE)) {
            const seedData = JSON.parse(fs.readFileSync(SEED_MEMBERS_FILE, 'utf8'));
            if (Array.isArray(seedData) && seedData.length > 0) {
                console.log(`[PERSISTENCE] Seeded ${seedData.length} members from seed_members.json`);
                memoryMembers = seedData;
                saveMembers(seedData, false);
                return seedData;
            }
        }
    } catch (e) {
        console.error('[PERSISTENCE] Error reading seed_members.json:', e.message);
    }

    memoryMembers = [];
    return [];
}

export function saveMembers(members, syncToCloud = true) {
    if (!Array.isArray(members)) return false;
    memoryMembers = members;
    try {
        fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), 'utf8');
    } catch (e) {
        console.error('[PERSISTENCE] Error saving web_members.json:', e.message);
    }

    if (syncToCloud) {
        syncKeyToCloud('persistent_web_members', members);
    }
    return true;
}

// ==========================================
// 2. VIP USERS PERSISTENCE (Telegram Bot)
// ==========================================

export function loadVipUsers() {
    if (memoryVipUsers && Object.keys(memoryVipUsers).length > 0) {
        return memoryVipUsers;
    }
    try {
        if (fs.existsSync(VIP_FILE)) {
            const data = JSON.parse(fs.readFileSync(VIP_FILE, 'utf8'));
            if (data && typeof data === 'object') {
                memoryVipUsers = data;
                return data;
            }
        }
    } catch (e) {
        console.error('[PERSISTENCE] Error reading vip_users.json:', e.message);
    }
    memoryVipUsers = {};
    return {};
}

export function saveVipUsers(users, syncToCloud = true) {
    if (!users || typeof users !== 'object') return false;
    memoryVipUsers = users;
    try {
        fs.writeFileSync(VIP_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error('[PERSISTENCE] Error saving vip_users.json:', e.message);
    }

    if (syncToCloud) {
        syncKeyToCloud('persistent_vip_users', users);
    }
    return true;
}

// ==========================================
// 3. DEVICE TRIALS PERSISTENCE
// ==========================================

export function loadDeviceTrials() {
    try {
        if (fs.existsSync(TRIALS_FILE)) {
            return JSON.parse(fs.readFileSync(TRIALS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[PERSISTENCE] Error reading device_trials.json:', e.message);
    }
    return {};
}

export function saveDeviceTrials(trials, syncToCloud = true) {
    try {
        fs.writeFileSync(TRIALS_FILE, JSON.stringify(trials, null, 2), 'utf8');
    } catch (e) {
        console.error('[PERSISTENCE] Error saving device_trials.json:', e.message);
    }

    if (syncToCloud) {
        syncKeyToCloud('persistent_device_trials', trials);
    }
    return true;
}

// ==========================================
// 4. UPGRADE REQUESTS PERSISTENCE
// ==========================================

export function loadUpgradeRequests() {
    try {
        if (fs.existsSync(UPGRADES_FILE)) {
            return JSON.parse(fs.readFileSync(UPGRADES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[PERSISTENCE] Error reading upgrade_requests.json:', e.message);
    }
    return [];
}

export function saveUpgradeRequests(requests, syncToCloud = true) {
    try {
        fs.writeFileSync(UPGRADES_FILE, JSON.stringify(requests, null, 2), 'utf8');
    } catch (e) {
        console.error('[PERSISTENCE] Error saving upgrade_requests.json:', e.message);
    }

    if (syncToCloud) {
        syncKeyToCloud('persistent_upgrade_requests', requests);
    }
    return true;
}

// ==========================================
// 5. CLOUD BACKUP & RESTORE VIA SUPABASE
// ==========================================

async function syncKeyToCloud(key, data) {
    try {
        const payload = {
            key,
            value: JSON.stringify(data),
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('system_settings').upsert(payload);
        if (error) {
            console.warn(`[PERSISTENCE] Supabase cloud upsert error for ${key}:`, error.message);
        } else {
            console.log(`[PERSISTENCE] Successfully synced ${key} to Supabase cloud!`);
        }
    } catch (err) {
        console.warn(`[PERSISTENCE] Network error syncing ${key} to Supabase:`, err.message);
    }
}

/**
 * Call on application startup to restore any data lost due to Render ephemeral container redeploy.
 */
export async function initPersistence() {
    console.log('[PERSISTENCE] Initializing cloud backup restoration...');
    try {
        // 1. Restore Web Members
        const { data: memberRow, error: memberErr } = await supabase
            .from('system_settings')
            .select('*')
            .eq('key', 'persistent_web_members')
            .maybeSingle();

        if (!memberErr && memberRow && memberRow.value) {
            try {
                const cloudMembers = JSON.parse(memberRow.value);
                if (Array.isArray(cloudMembers) && cloudMembers.length > 0) {
                    const localMembers = loadMembers();
                    const mergedMap = new Map();

                    // Seed / local first
                    localMembers.forEach(m => {
                        if (m && m.email) mergedMap.set(m.email.toLowerCase().trim(), m);
                    });

                    // Cloud overlay (takes precedence)
                    cloudMembers.forEach(m => {
                        if (m && m.email) {
                            const clean = m.email.toLowerCase().trim();
                            const existing = mergedMap.get(clean);
                            mergedMap.set(clean, { ...(existing || {}), ...m });
                        }
                    });

                    const mergedList = Array.from(mergedMap.values());
                    memoryMembers = mergedList;
                    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(mergedList, null, 2), 'utf8');
                    console.log(`[PERSISTENCE] Restored ${mergedList.length} members from Supabase Cloud!`);
                }
            } catch (pErr) {
                console.error('[PERSISTENCE] Failed to parse cloud members:', pErr.message);
            }
        } else {
            // If cloud has nothing yet, seed cloud from current local members
            const currentMembers = loadMembers();
            if (currentMembers.length > 0) {
                syncKeyToCloud('persistent_web_members', currentMembers);
            }
        }

        // 2. Restore Telegram VIP Users
        const { data: vipRow, error: vipErr } = await supabase
            .from('system_settings')
            .select('*')
            .eq('key', 'persistent_vip_users')
            .maybeSingle();

        if (!vipErr && vipRow && vipRow.value) {
            try {
                const cloudVip = JSON.parse(vipRow.value);
                if (cloudVip && typeof cloudVip === 'object') {
                    const localVip = loadVipUsers();
                    const mergedVip = { ...localVip, ...cloudVip };
                    memoryVipUsers = mergedVip;
                    fs.writeFileSync(VIP_FILE, JSON.stringify(mergedVip, null, 2), 'utf8');
                    console.log(`[PERSISTENCE] Restored ${Object.keys(mergedVip).length} VIP users from Supabase Cloud!`);
                }
            } catch (vErr) {
                console.error('[PERSISTENCE] Failed to parse cloud VIP users:', vErr.message);
            }
        } else {
            const currentVip = loadVipUsers();
            if (Object.keys(currentVip).length > 0) {
                syncKeyToCloud('persistent_vip_users', currentVip);
            }
        }

        // 3. Restore Device Trials
        const { data: trialRow } = await supabase
            .from('system_settings')
            .select('*')
            .eq('key', 'persistent_device_trials')
            .maybeSingle();

        if (trialRow && trialRow.value) {
            try {
                const cloudTrials = JSON.parse(trialRow.value);
                if (cloudTrials && typeof cloudTrials === 'object') {
                    const localTrials = loadDeviceTrials();
                    const merged = { ...localTrials, ...cloudTrials };
                    fs.writeFileSync(TRIALS_FILE, JSON.stringify(merged, null, 2), 'utf8');
                }
            } catch (tErr) {}
        }

    } catch (e) {
        console.warn('[PERSISTENCE] Cloud restoration error (proceeding with local files):', e.message);
    }
}
