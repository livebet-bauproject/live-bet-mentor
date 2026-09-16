/**
 * PREDICTION TRACKER SERVICE
 * Tracks all predictions/bets and calculates accuracy statistics.
 * Uses Supabase for persistent storage.
 */

import { supabase } from './supabaseClient';
import { CONFIG } from '../config';

class PredictionTracker {
    constructor() {
        this.predictions = [];
        this.userId = null;
    }

    saveToLocalStorage() {
        try {
            const key = `lbm_predictions_${this.userId || 'guest'}`;
            localStorage.setItem(key, JSON.stringify(this.predictions));
        } catch (e) { }
    }

    loadFromLocalStorage() {
        try {
            const key = `lbm_predictions_${this.userId || 'guest'}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.predictions = parsed;
                    console.log('[TRACKER] Loaded', parsed.length, 'predictions from localStorage');
                    return true;
                }
            }
        } catch (e) { }
        return false;
    }

    /**
     * Initialize tracker for specific user
     */
    async init(userId) {
        // Prevent clearing if same user re-initializes (avoids UI flicker)
        if (this.userId === userId && this.predictions.length > 0) return;

        this.userId = userId;
        this.predictions = [];
        this.pendingStatusUpdates = {}; // Track updates for temp IDs

        if (!userId) {
            this.loadFromLocalStorage();
            return;
        }

        try {
            const { data, error } = await supabase
                .from('predictions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                console.warn('[TRACKER] Supabase fetch error, using localStorage fallback');
                this.loadFromLocalStorage();
                return;
            }

            if (data && data.length > 0) {
                this.predictions = data.map(item => this.mapDbToModel(item));
                this.saveToLocalStorage();
                console.log('[TRACKER] Loaded', this.predictions.length, 'predictions from DB');
            } else {
                // If DB is empty, check if we have local predictions to preserve
                this.loadFromLocalStorage();
            }
        } catch (e) {
            console.warn('[TRACKER] Remote init error, using localStorage fallback:', e.message);
            this.loadFromLocalStorage();
        }
    }

    /**
     * Map DB row to Model object
     */
    mapDbToModel(dbItem) {
        if (!dbItem) return null;

        // Parse final score
        let finalScoreObj = null;
        if (dbItem.final_score && dbItem.final_score.includes('-')) {
            const parts = dbItem.final_score.split('-');
            finalScoreObj = { home: parseInt(parts[0]), away: parseInt(parts[1]) };
        }

        // Parse score at prediction
        let scoreAtPredictionObj = { home: 0, away: 0 };
        if (dbItem.score_at_prediction && dbItem.score_at_prediction.includes('-')) {
            const parts = dbItem.score_at_prediction.split('-');
            scoreAtPredictionObj = { home: parseInt(parts[0]), away: parseInt(parts[1]) };
        }

        return {
            id: dbItem.id,
            timestamp: new Date(dbItem.created_at).getTime(),
            matchId: dbItem.match_id,
            match: dbItem.match_name,
            homeTeam: dbItem.home_team,
            awayTeam: dbItem.away_team,
            minute: dbItem.minute,
            scoreAtPrediction: scoreAtPredictionObj,
            market: dbItem.market,
            prediction: dbItem.prediction,
            confidence: dbItem.confidence,
            source: dbItem.source,
            dqs: dbItem.dqs ? parseFloat(dbItem.dqs) : 0,
            xgHome: dbItem.xg_home ? parseFloat(dbItem.xg_home) : 0,
            xgAway: dbItem.xg_away ? parseFloat(dbItem.xg_away) : 0,
            consensusCount: dbItem.consensus_count,
            status: dbItem.status,
            finalScore: finalScoreObj,
            resolvedAt: dbItem.resolved_at ? new Date(dbItem.resolved_at).getTime() : null,
            profit: dbItem.profit
        };
    }

    /**
     * Record a new prediction
     */
    async recordPrediction(data) {
        if (!this.userId) {
            console.warn('[TRACKER] No user ID, cannot save prediction');
            return null;
        }

        let scoreStr = '0-0';
        if (data.score && typeof data.score === 'object') {
            scoreStr = `${data.score.home ?? 0}-${data.score.away ?? 0}`;
        } else if (typeof data.score === 'string') {
            scoreStr = data.score;
        }

        const dbItem = {
            user_id: this.userId,
            match_id: data.matchId ? data.matchId.toString() : null,
            match_name: data.match,
            home_team: data.homeTeam,
            away_team: data.awayTeam,
            minute: data.minute,
            score_at_prediction: scoreStr,
            market: data.market,
            prediction: data.prediction,
            confidence: data.confidence,
            source: data.source,
            dqs: data.dqs,
            xg_home: data.xgHome,
            xg_away: data.xgAway,
            consensus_count: data.consensusCount,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        // Optimistic update
        const tempModel = {
            ...this.mapDbToModel(dbItem),
            id: `temp_${Date.now()}`, // Temporary ID until DB returns real one
            timestamp: Date.now(),
            scoreAtPrediction: data.score
        };
        this.predictions.unshift(tempModel);

        if (this.predictions.length > 200) {
            this.predictions = this.predictions.slice(0, 200);
        }
        this.saveToLocalStorage();

        // Check if there's a pending status update from UI (user clicked win/loss immediately)
        const pendingUpdate = this.pendingStatusUpdates[tempModel.id];
        if (pendingUpdate) {
            dbItem.status = pendingUpdate.result;
            dbItem.final_score = pendingUpdate.finalScoreStr;
            dbItem.resolved_at = new Date().toISOString();

            // Sync temp model too
            tempModel.status = pendingUpdate.result;
            tempModel.finalScore = pendingUpdate.finalScore;
            tempModel.resolvedAt = Date.now();

            delete this.pendingStatusUpdates[tempModel.id];
            this.saveToLocalStorage();
        }

        try {
            const { data: inserted, error } = await supabase
                .from('predictions')
                .insert([dbItem])
                .select()
                .single();

            if (error) throw error;

            if (inserted) {
                // Replace temp model with real one
                const realModel = this.mapDbToModel(inserted);
                const index = this.predictions.findIndex(p => p.id === tempModel.id);
                if (index !== -1) {
                    this.predictions[index] = realModel;
                }
                this.saveToLocalStorage();
                console.log('[TRACKER] Saved prediction:', inserted.id);
                return realModel;
            }
        } catch (e) {
            console.warn('[TRACKER] Remote save error, stored locally:', e.message);
            this.saveToLocalStorage();
        }

        return tempModel;
    }

    /**
     * Update prediction result
     */
    async updateResult(predictionId, result, finalScore) {
        const pred = this.predictions.find(p => p.id === predictionId);
        if (!pred) return;

        const finalScoreStr = finalScore ? `${finalScore.home}-${finalScore.away}` : null;

        // Optimistic update
        pred.status = result;
        pred.finalScore = finalScore;
        pred.resolvedAt = Date.now();
        this.saveToLocalStorage();

        // If it's a temp ID, store it to be picked up when DB record is created
        if (typeof predictionId === 'string' && predictionId.startsWith('temp_')) {
            this.pendingStatusUpdates[predictionId] = { result, finalScore, finalScoreStr };
            console.log('[TRACKER] Queued result for temp ID:', result);
            return;
        }

        try {
            const { error } = await supabase
                .from('predictions')
                .update({
                    status: result,
                    final_score: finalScoreStr,
                    resolved_at: new Date().toISOString()
                })
                .eq('id', predictionId);

            if (error) throw error;
            console.log('[TRACKER] Updated result:', result);
        } catch (e) {
            console.error('[TRACKER] Update error:', e);
        }
    }

    /**
     * Bulk update by match ID (when match ends)
     */
    async updateByMatchId(matchId, finalScore) {
        const pending = this.predictions.filter(p =>
            p.matchId === matchId.toString() && p.status === 'PENDING'
        );

        if (pending.length === 0) return;

        const finalScoreStr = finalScore ? `${finalScore.home}-${finalScore.away}` : null;
        const now = new Date().toISOString();

        // Prepare updates
        const updates = pending.map(pred => {
            const result = this.evaluateResult(pred, finalScore);

            // Optimistic update
            pred.status = result;
            pred.finalScore = finalScore;
            pred.resolvedAt = Date.now();

            return {
                id: pred.id,
                status: result,
                final_score: finalScoreStr,
                resolved_at: now
            };
        });

        // Supabase doesn't support bulk update with different values easily in one query depending on ID
        // So we loop (or use upsert if we had all fields, but we only want to update status)
        // For simplicity with small numbers, we loop.
        for (const update of updates) {
            try {
                await supabase
                    .from('predictions')
                    .update({
                        status: update.status,
                        final_score: update.final_score,
                        resolved_at: update.resolved_at
                    })
                    .eq('id', update.id);
            } catch (e) {
                console.error('[TRACKER] Bulk update error for', update.id, e);
            }
        }

        this.saveToLocalStorage();
        console.log('[TRACKER] Auto-updated', pending.length, 'predictions for match', matchId);
    }

    /**
     * Evaluate if prediction was correct
     */
    evaluateResult(prediction, finalScore) {
        const { market = '', prediction: pred = '' } = prediction;
        const marketStr = `${market} ${pred}`;
        const homeGoals = Number(finalScore?.home ?? 0);
        const awayGoals = Number(finalScore?.away ?? 0);
        const totalGoals = homeGoals + awayGoals;

        // 1. Next Goal market (check FIRST to avoid team names like Sunderland matching "under" or Hannover matching "over")
        if (marketStr.includes('Sıradaki') || marketStr.includes('Next Goal') || marketStr.includes('Golü')) {
            const home = (prediction.homeTeam || '').toLowerCase();
            const away = (prediction.awayTeam || '').toLowerCase();
            const targetHome = (home && home.length >= 3 && marketStr.toLowerCase().includes(home)) || /\b(Ev|Home)\b/i.test(marketStr);
            const targetAway = (away && away.length >= 3 && marketStr.toLowerCase().includes(away)) || /\b(Deplasman|Away)\b/i.test(marketStr);

            if (targetHome && !targetAway) {
                return homeGoals > 0 ? 'WON' : (totalGoals > 0 ? 'LOST' : 'PENDING');
            }
            if (targetAway && !targetHome) {
                return awayGoals > 0 ? 'WON' : (totalGoals > 0 ? 'LOST' : 'PENDING');
            }
            return totalGoals > 0 ? 'WON' : 'PENDING';
        }

        // 2. Over/Under markets with strict word boundaries
        if (/\b(Üst|Over)\b/i.test(marketStr)) {
            const line = parseFloat(marketStr.match(/(\d+\.?\d*)/)?.[1] || 0);
            return totalGoals > line ? 'WON' : 'LOST';
        }

        if (/\b(Alt|Under)\b/i.test(marketStr)) {
            const line = parseFloat(marketStr.match(/(\d+\.?\d*)/)?.[1] || 0);
            return totalGoals < line ? 'WON' : 'LOST';
        }

        // 3. Both Teams To Score (BTTS)
        if (marketStr.includes('KG Var') || marketStr.includes('BTTS Yes') || marketStr.includes('Karşılıklı')) {
            return homeGoals > 0 && awayGoals > 0 ? 'WON' : 'LOST';
        }

        if (marketStr.includes('KG Yok') || marketStr.includes('BTTS No')) {
            return homeGoals === 0 || awayGoals === 0 ? 'WON' : 'LOST';
        }

        // 4. Home/Away Win with strict word boundaries
        if (/\b(Ev|Home)\b/i.test(market) || market === '1') {
            return homeGoals > awayGoals ? 'WON' : 'LOST';
        }

        if (/\b(Deplasman|Away)\b/i.test(market) || market === '2') {
            return awayGoals > homeGoals ? 'WON' : 'LOST';
        }

        // 5. Draw
        if (/\b(Berabere|Draw)\b/i.test(market) || market === 'X') {
            return homeGoals === awayGoals ? 'WON' : 'LOST';
        }

        return 'PENDING';
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        // Use local predictions array which is kept in sync
        const resolved = this.predictions.filter(p =>
            p.status === 'WON' || p.status === 'LOST'
        );
        const won = resolved.filter(p => p.status === 'WON').length;
        const lost = resolved.filter(p => p.status === 'LOST').length;
        const total = won + lost;

        // By confidence level
        const byConfidence = {
            high: { won: 0, total: 0 }, // 75+
            medium: { won: 0, total: 0 }, // 60-74
            low: { won: 0, total: 0 } // <60
        };

        resolved.forEach(p => {
            const conf = p.confidence || 50;
            const bucket = conf >= 75 ? 'high' : conf >= 60 ? 'medium' : 'low';
            byConfidence[bucket].total++;
            if (p.status === 'WON') byConfidence[bucket].won++;
        });

        // By source
        const bySource = {};
        resolved.forEach(p => {
            const src = p.source || 'UNKNOWN';
            if (!bySource[src]) bySource[src] = { won: 0, total: 0 };
            bySource[src].total++;
            if (p.status === 'WON') bySource[src].won++;
        });

        // By market type
        const byMarket = {};
        resolved.forEach(p => {
            let marketType = 'OTHER';
            const m = p.market || '';
            if (m.includes('Gol') || m.includes('Sıradaki') || m.includes('Next Goal')) marketType = 'NEXT_GOAL';
            else if (/\b(Üst|Over)\b/i.test(m)) marketType = 'OVER';
            else if (/\b(Alt|Under)\b/i.test(m)) marketType = 'UNDER';
            else if (/\b(Ev|Home)\b/i.test(m) || m === '1') marketType = 'HOME';
            else if (/\b(Deplasman|Away)\b/i.test(m) || m === '2') marketType = 'AWAY';

            if (!byMarket[marketType]) byMarket[marketType] = { won: 0, total: 0 };
            byMarket[marketType].total++;
            if (p.status === 'WON') byMarket[marketType].won++;
        });

        // Last 7 days
        const last7Days = this.predictions.filter(p =>
            (Date.now() - p.timestamp) < 7 * 24 * 60 * 60 * 1000
        );
        const last7Resolved = last7Days.filter(p => p.status === 'WON' || p.status === 'LOST');
        const last7Won = last7Resolved.filter(p => p.status === 'WON').length;

        // Streak calculation
        let currentStreak = 0;
        let streakType = null;
        for (const p of resolved) {
            if (streakType === null) {
                streakType = p.status;
                currentStreak = 1;
            } else if (p.status === streakType) {
                currentStreak++;
            } else {
                break;
            }
        }

        return {
            total: this.predictions.length,
            resolved: total,
            pending: this.predictions.filter(p => p.status === 'PENDING').length,
            won,
            lost,
            accuracy: total > 0 ? ((won / total) * 100).toFixed(1) : 0,
            byConfidence,
            bySource,
            byMarket,
            last7Days: {
                total: last7Days.length,
                resolved: last7Resolved.length,
                won: last7Won,
                accuracy: last7Resolved.length > 0
                    ? ((last7Won / last7Resolved.length) * 100).toFixed(1)
                    : 0
            },
            streak: {
                count: currentStreak,
                type: streakType
            }
        };
    }

    /**
     * Get recent predictions
     */
    getRecent(limit = 20) {
        return this.predictions.slice(0, limit);
    }

    /**
     * Get pending predictions
     */
    getPending() {
        return this.predictions.filter(p => p.status === 'PENDING');
    }

    /**
     * Check pending predictions against live/finished data via Proxy
     */
    async checkPendingPredictions() {
        const pending = this.getPending();
        if (pending.length === 0) return;

        console.log('[TRACKER] Checking', pending.length, 'pending predictions...');
        const uniqueMatchIds = [...new Set(pending.map(p => p.matchId))];

        // Use the proxy URL from config
        // "http://localhost:3001/api/sofascore/live" -> "http://localhost:3001/api/sofascore/event"
        const baseUrl = CONFIG.DATA.SOFASCORE_LOCAL_PROXY_URL.replace('/live', '/event');

        for (const matchId of uniqueMatchIds) {
            if (!matchId) continue;

            try {
                const res = await fetch(`${baseUrl}/${matchId}`);

                if (res.status === 200) {
                    const data = await res.json();
                    // Check if we have valid event data
                    if (data && data.event) {
                        const status = data.event.status?.type; // 'finished', 'inprogress', 'notstarted'

                        // Consider 'finished' or 'ended' 
                        if (status === 'finished') {
                            const finalScore = {
                                home: data.event.homeScore?.current ?? 0,
                                away: data.event.awayScore?.current ?? 0
                            };

                            console.log(`[TRACKER] Match ${matchId} finished. Score: ${finalScore.home}-${finalScore.away}`);
                            await this.updateByMatchId(matchId, finalScore);
                        }
                    }
                } else if (res.status === 202) {
                    // Queued for fetching, wait for next cycle
                    // console.log(`[TRACKER] Match ${matchId} queued for details...`);
                }
            } catch (e) {
                console.error('[TRACKER] Error checking match', matchId, e);
            }
        }
    }

    /**
     * Clear all data (For logout/debug)
     */
    clearAll() {
        this.predictions = [];
        this.userId = null;
    }
}

export const predictionTracker = new PredictionTracker();
