import { supabase } from './supabaseClient.js';

/**
 * AI USAGE LIMITER SERVICE
 * Tier-based rate limiting for AI features to control costs
 */

class AIUsageLimiter {
    constructor() {
        this.TIERS = {
            trial: {
                name: 'Trial',
                dailyAIReports: 3,
                dailySmartAlerts: 5,
                cacheMinutes: 15, // Longer cache = less API calls
                features: {
                    aiAnalysis: true,
                    smartAlerts: true, // Enabled for taste
                    consensusRadar: true,
                    liveOpportunities: true,
                    predictionTracking: true
                }
            },
            pro: {
                name: 'Pro',
                dailyAIReports: 15,
                dailySmartAlerts: 150, // Significantly increased (No cost)
                cacheMinutes: 5,
                features: {
                    aiAnalysis: true,
                    smartAlerts: true,
                    consensusRadar: true,
                    liveOpportunities: true,
                    predictionTracking: true
                }
            },
            premium: {
                name: 'Premium',
                dailyAIReports: 50,
                dailySmartAlerts: Infinity, // Unlimited
                cacheMinutes: 2,
                features: {
                    aiAnalysis: true,
                    smartAlerts: true,
                    consensusRadar: true,
                    liveOpportunities: true,
                    predictionTracking: true
                }
            },
            admin: {
                name: 'Admin',
                dailyAIReports: Infinity,
                dailySmartAlerts: Infinity,
                cacheMinutes: 0,
                features: {
                    aiAnalysis: true,
                    smartAlerts: true,
                    consensusRadar: true,
                    liveOpportunities: true,
                    predictionTracking: true
                }
            }
        };

        // In-memory usage tracking (per session)
        // Fetched from Supabase on init
        this.usage = {};

        // AI response cache to reduce duplicate API calls
        this.cache = new Map();
    }

    /**
     * Get tier configuration for user
     */
    getTierConfig(tierName = 'trial') {
        return this.TIERS[tierName] || this.TIERS.trial;
    }

    /**
     * Load usage from Supabase
     */
    async loadUserUsage(userId) {
        if (!userId) return;
        const today = this.getTodayKey();

        try {
            const { data, error } = await supabase
                .from('ai_usage_logs')
                .select('*')
                .eq('user_id', userId)
                .eq('date', today)
                .single();

            if (data) {
                if (!this.usage[userId]) this.usage[userId] = {};
                this.usage[userId][today] = {
                    aiReports: data.ai_reports_count,
                    smart_alerts_count: data.smart_alerts_count, // map db col to memory
                    aiReports: data.ai_reports_count,
                    smartAlerts: data.smart_alerts_count,
                    lastActivity: new Date(data.updated_at).getTime()
                };
            }
        } catch (err) {
            // Ignore error if row not found (first usage of day)
            // console.error('[LIMITER] Load usage error:', err);
        }
    }

    /**
     * Check if user can make AI request
     */
    canMakeAIRequest(userId, tierName = 'trial') {
        const tier = this.getTierConfig(tierName);
        const userUsage = this.getUserUsage(userId);

        // Check daily limit
        if (userUsage.aiReports >= tier.dailyAIReports) {
            return {
                allowed: false,
                reason: 'daily_limit_reached',
                current: userUsage.aiReports,
                limit: tier.dailyAIReports,
                resetTime: this.getResetTime()
            };
        }

        return {
            allowed: true,
            remaining: tier.dailyAIReports - userUsage.aiReports,
            limit: tier.dailyAIReports
        };
    }

    /**
     * Check if user can receive smart alert
     */
    canReceiveSmartAlert(userId, tierName = 'trial') {
        const tier = this.getTierConfig(tierName);

        // Trial users don't get smart alerts
        if (!tier.features.smartAlerts) {
            return { allowed: false, reason: 'feature_not_available' };
        }

        const userUsage = this.getUserUsage(userId);

        if (userUsage.smartAlerts >= tier.dailySmartAlerts) {
            return {
                allowed: false,
                reason: 'daily_limit_reached',
                current: userUsage.smartAlerts,
                limit: tier.dailySmartAlerts
            };
        }

        return {
            allowed: true,
            remaining: tier.dailySmartAlerts - userUsage.smartAlerts,
            limit: tier.dailySmartAlerts
        };
    }

    /**
     * Record AI usage
     */
    async recordAIUsage(userId, type = 'aiReport') {
        const userUsage = this.getUserUsage(userId);

        if (type === 'aiReport') {
            userUsage.aiReports++;
        } else if (type === 'smartAlert') {
            userUsage.smartAlerts++;
        }

        userUsage.lastActivity = Date.now();

        // Save to Supabase
        const today = this.getTodayKey();
        try {
            await supabase
                .from('ai_usage_logs')
                .upsert({
                    user_id: userId,
                    date: today,
                    ai_reports_count: userUsage.aiReports,
                    smart_alerts_count: userUsage.smartAlerts,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, date' });
        } catch (e) {
            console.error('[LIMITER] Remote save error', e);
        }

        console.log(`[LIMITER] User ${userId} - AI Reports: ${userUsage.aiReports}, Alerts: ${userUsage.smartAlerts}`);
    }

    /**
     * Get cached AI response if available
     */
    getCachedResponse(cacheKey, tierName = 'trial') {
        const tier = this.getTierConfig(tierName);
        const cached = this.cache.get(cacheKey);

        if (!cached) return null;

        const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);

        if (ageMinutes > tier.cacheMinutes) {
            this.cache.delete(cacheKey);
            return null;
        }

        console.log(`[LIMITER] Cache hit for ${cacheKey}, age: ${ageMinutes.toFixed(1)}min`);
        return cached.response;
    }

    /**
     * Cache AI response
     */
    cacheResponse(cacheKey, response) {
        this.cache.set(cacheKey, {
            response,
            timestamp: Date.now()
        });

        // Clean old cache entries (max 100)
        if (this.cache.size > 100) {
            const oldest = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, 20);
            oldest.forEach(([key]) => this.cache.delete(key));
        }
    }

    /**
     * Get user's usage stats
     */
    getUserUsage(userId) {
        const today = this.getTodayKey();

        if (!this.usage[userId]) {
            this.usage[userId] = {};
        }

        if (!this.usage[userId][today]) {
            this.usage[userId][today] = {
                aiReports: 0,
                smartAlerts: 0,
                lastActivity: Date.now()
            };
        }

        return this.usage[userId][today];
    }

    /**
     * Get usage statistics for display
     */
    getUsageStats(userId, tierName = 'trial') {
        const tier = this.getTierConfig(tierName);
        const userUsage = this.getUserUsage(userId);

        return {
            tier: tier.name,
            aiReports: {
                used: userUsage.aiReports,
                limit: tier.dailyAIReports === Infinity ? '∞' : tier.dailyAIReports,
                remaining: tier.dailyAIReports === Infinity ? '∞' : Math.max(0, tier.dailyAIReports - userUsage.aiReports),
                percentage: tier.dailyAIReports === Infinity ? 0 : (userUsage.aiReports / tier.dailyAIReports) * 100
            },
            smartAlerts: {
                used: userUsage.smartAlerts,
                limit: tier.dailySmartAlerts === Infinity ? '∞' : tier.dailySmartAlerts,
                remaining: tier.dailySmartAlerts === Infinity ? '∞' : Math.max(0, tier.dailySmartAlerts - userUsage.smartAlerts),
                available: tier.features.smartAlerts
            },
            features: tier.features,
            resetTime: this.getResetTime()
        };
    }

    /**
     * Get today's date key for tracking
     */
    getTodayKey() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get reset time (next midnight UTC)
     */
    getResetTime() {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        return tomorrow.toISOString();
    }
}

export const aiUsageLimiter = new AIUsageLimiter();
