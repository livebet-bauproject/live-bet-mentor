/**
 * BACKEND DATA WORKER
 * Responsibilities: API Polling, Latency Monitoring, Normalization.
 * This runs independently of the UI components.
 */

import { CONFIG } from '../config';
import { sofaScoreAdapter } from './sofaScoreAdapter';
import { mockDataService } from './mockDataService';
// import { secondaryValidator } from '../logic/secondaryValidator';
import { analyzeMatch } from '../logic/matchAnalyzer';
import { HealthMonitor } from './healthMonitor';
import { leagueProfileModule } from '../logic/leagueProfileModule';
import { bankrollManager } from '../logic/bankrollManager';
import { consensusAdapter } from './consensusAdapter';
import { aiAnalystService } from './aiAnalystService';
import { database, ref, get } from '../firebase/config';

class DataWorker {
    constructor() {
        this.fixtures = [];
        this.matches = []; // Added for RedScores support
        this.odds = {};
        this.lastUpdated = null;
        this.isRunning = false;
        this.apiKey = import.meta.env.VITE_APIFOOTBALL_KEY || 'a790d8fed5077cd8afe4cbc667ecef3ee5791b3ec0db4c56c5818865e24cc7e';
        this.healthStats = {
            lastFetch: null,
            totalDiscovered: 0,
            errorCount: 0,
            noBetCount: 0,
            dqsAbove: 0,
            dqsBelow: 0,
            frozen: false
        };
        this.decisionMode = CONFIG.DECISION.MODES.CORE_DQS;
        this.decisionLogs = [];
        this.healthMonitor = new HealthMonitor(); // Phase 11 Scenario 3
        this.lastFetchDuration = 0;
        try {
            const raw = localStorage.getItem('tier3_performance');
            this.tier3Performance = (raw && raw !== 'undefined' && raw !== 'null') ? JSON.parse(raw) : {};
        } catch {
            this.tier3Performance = {};
        }
        this.selectedMatchId = null;
        this.dataSource = CONFIG.DATA.DATA_SOURCE;
        this.consensusData = {};
        this.consensusTimer = 0;
        this.listeners = new Set();
    }

    subscribe(cb) {
        if (typeof cb === 'function') {
            this.listeners.add(cb);
            return () => this.listeners.delete(cb);
        }
        return () => {};
    }

    notify() {
        this.listeners.forEach(cb => {
            try {
                cb();
            } catch (e) {
                console.error('[DATA_WORKER] Listener error:', e);
            }
        });
    }

    async setSelectedMatch(matchId) {
        if (!matchId) {
            this.selectedMatchId = null;
            return;
        }

        this.selectedMatchId = matchId.toString();
        // Automatic AI trigger removed to save tokens, now handled by manual button in UI
        console.log('[DATA_WORKER] Match selected:', matchId);
    }

    async triggerDeepAnalysis(matchId) {
        const match = this.fixtures.find(f => f.id.toString() === matchId.toString());
        if (!match) return;

        console.log('[DATA_WORKER] Manual Deep Analysis triggered for:', matchId);
        match.aiSummary = "AI Analiz yapıyor...";

        const summary = await aiAnalystService.getExpertSummary(match, match.consensusReport);
        match.aiSummary = summary;

        return summary;
    }

    async generateGlobalIntelligence(type = 'LIVE') {
        let candidates = [];
        if (type === 'LIVE') {
            // Live: DQS > 0.50, Signal = BET, and Minute < 80 (Professional Action Window)
            candidates = this.fixtures.filter(f => {
                const signal = this.getSignalForMatch(f.id);
                return f.dqs > 0.50 && signal?.verdict === 'BET' && f.minute < 80;
            });

            // Handle low volume: If fewer than 3 candidates, pull in next best potentials (also under 80m)
            if (candidates.length < 3) {
                const extra = this.fixtures
                    .filter(f => !candidates.find(c => c.id === f.id) && f.dqs > 0.35 && f.minute < 80)
                    .sort((a, b) => b.dqs - a.dqs)
                    .slice(0, 5 - candidates.length);
                candidates = [...candidates, ...extra];
            }
        } else {
            // Radar: High consensus or Value
            // radarMatches are calculated in Dashboard, but we can access consensusData here
            // For simplicity, let's let the Dashboard pass the matches for PRE-MATCH
            // But we can implement a basic filter here as well if needed.
        }

        if (candidates.length === 0 && type === 'LIVE') return "Şu an kriterlere uygun canlı 'Altın Seçim' bulunamadı.";

        // Enhance candidates with signals for the AI to see our internal verdict
        const enhancedCandidates = candidates.map(c => ({
            ...c,
            signal: this.getSignalForMatch(c.id)
        }));

        return await aiAnalystService.getGlobalIntelligenceReport(enhancedCandidates, type);
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    /**
     * Main loops for fetching data.
     */
    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.poll();
        this.pollConsensus();
        this.startHealthMonitoring(); // Phase 11 Scenario 3
    }


    async pollConsensus() {
        while (this.isRunning) {
            console.log('[DATA_WORKER] Fetching global consensus data...');
            const data = await consensusAdapter.fetchConsensus();
            if (data) this.consensusData = data;
            await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000)); // Every 2 mins
        }
    }

    async poll() {
        while (this.isRunning) {
            try {
                const startTime = Date.now();

                let rawMatches = [];
                // Mock Data Mode (for testing when external APIs are unavailable)
                if (CONFIG.DATA.USE_MOCK_DATA) {
                    rawMatches = await mockDataService.fetchLiveMatches();
                    console.log('[DATA_WORKER] Mock data mode active, fetched:', rawMatches?.length || 0, 'matches');
                } else {
                    // Sole source: SofaScore (via local scraper)
                    rawMatches = await sofaScoreAdapter.fetchScheduledEvents();
                }

                if (rawMatches && Array.isArray(rawMatches)) {
                    // SELECTION PRIORITY & LOAD BALANCING (v2.3)
                    // We only fetch full details for matches that are:
                    // 1. High priority (DQS > threshold or Tier 1/2)
                    // 2. Currently selected in the UI
                    // 3. Staggered updates for others (limit 10 per cycle)
                    
                    const priorityIds = new Set();
                    const candidates = this.fixtures.filter(f => f.dqs >= CONFIG.DECISION.DQS_THRESHOLD || f.tier <= 2 || f.id.toString() === this.selectedMatchId);
                    candidates.forEach(c => priorityIds.add(c.id));

                    // Prioritize all Tier 1 & Tier 2 leagues directly from rawMatches (so major leagues get full stats from poll #1)
                    for (const rm of rawMatches) {
                        const leagueName = rm.leagueName || rm.tournament?.name || '';
                        if (leagueProfileModule.getTier(leagueName) <= 2) {
                            priorityIds.add(rm.id);
                        }
                    }

                    // Always ensure selected match has top priority
                    if (this.selectedMatchId) {
                        priorityIds.add(this.selectedMatchId);
                        priorityIds.add(Number(this.selectedMatchId));
                    }

                    // Sort others by DQS to get the best of the rest
                    const others = rawMatches
                        .filter(m => !priorityIds.has(m.id))
                        .sort((a, b) => {
                            const dqsA = this.fixtures.find(f => f.id === a.id)?.dqs || 0;
                            const dqsB = this.fixtures.find(f => f.id === b.id)?.dqs || 0;
                            return dqsB - dqsA;
                        });
                    
                    // Add a staggered slice of 'others' (e.g. 5 matches)
                    const staggeredUpdateSize = 5;
                    const staggeredOthers = others.slice(0, staggeredUpdateSize);
                    staggeredOthers.forEach(o => priorityIds.add(o.id));

                    console.log(`[DATA_WORKER] Priority Polling: ${candidates.length} candidates, ${staggeredUpdateSize} staggered. Total priority: ${priorityIds.size}/${rawMatches.length}`);

                    const detailedMatches = await Promise.all(
                        rawMatches.map(async (match) => {
                            const eventId = match.id;
                            if (!eventId) return match;

                            // Skip details for low-priority matches to save bandwidth/proxy load
                            if (!priorityIds.has(eventId)) {
                                const existing = this.fixtures.find(f => f.id === eventId);
                                if (existing) return { ...match, stats: existing.stats, isPartial: true };
                                return match;
                            }

                            // Parallel fetch for stats and odds (Speed!)
                            const [fullDetail, liveOdds] = await Promise.all([
                                sofaScoreAdapter.fetchEventDetails(eventId),
                                sofaScoreAdapter.fetchEventOdds(eventId)
                            ]);

                            // Update global odds cache with fresh data
                            if (liveOdds) {
                                this.odds[eventId] = liveOdds;
                            }

                            if (fullDetail) {
                                return {
                                    ...fullDetail,
                                    // Always prioritize fresh real-time score, minute, and status from rawMatches (sofascore_live.json)
                                    score: (match.score && (match.score.home !== undefined || match.score.away !== undefined)) ? match.score : fullDetail.score,
                                    minute: match.minute || fullDetail.minute,
                                    status: match.status || fullDetail.status
                                };
                            }

                            // FALLBACK: If detail fetch returns null (queued), 
                            // check if we already have this match in this.fixtures with stats.
                            const existing = this.fixtures.find(f => f.id === eventId);
                            if (existing && !existing.isPartial) {
                                // Update basic info (score, minute) but keep existing detailed stats
                                return {
                                    ...existing,
                                    score: match.score,
                                    minute: match.minute
                                };
                            }

                            return match; // Final fallback to basic 0-0 match
                        })
                    );

                    this.fixtures = this.normalizeFixtures(detailedMatches.filter(r => r !== null));
                    console.log('[DATA_WORKER] Normalized fixtures with full details:', this.fixtures?.length || 0);
                } else {
                    console.warn('[DATA_WORKER] Fetched matches is not an array:', rawMatches);
                    this.fixtures = [];
                }


                this.lastFetchDuration = Date.now() - startTime;
                this.healthStats.lastFetch = Date.now();
                this.lastUpdated = Date.now();
                this.notify();
            } catch (error) {
                console.error('DataWorker Poll Error:', error);
                this.healthStats.errorCount++;
            }
            await new Promise(resolve => setTimeout(resolve, CONFIG.DATA.POLLING_INTERVAL_MS));
        }
    }

    startHealthMonitoring() {
        setInterval(() => {
            const snapshot = this.healthMonitor.captureSnapshot(this);
            console.log('[HEALTH_MONITOR]', snapshot);
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    getHealthReport() {
        return this.healthMonitor.getReport();
    }


    normalizeFixtures(rawFixtures) {
        let dqsAbove = 0;
        let dqsBelow = 0;

        const normalized = rawFixtures.map(f => {
            // Manage High-Res History Buffer (Last 60 snapshots ~8 minutes)
            const existing = this.fixtures.find(old => old.id === f.id);
            const history = existing ? [...(existing.history || [])] : [];
            const minuteHistory = existing ? [...(existing.minuteHistory || [])] : [];

            const dqs = this.calculateDQS(f);
            if (dqs >= CONFIG.DECISION.DQS_THRESHOLD) dqsAbove++;
            else dqsBelow++;

            // Global Consensus Report
            const consensusReport = consensusAdapter.getConsensusSummary(this.consensusData, f);

            // Create Snapshot
            const now = Date.now();
            const snapshot = {
                timestamp: now,
                dqs,
                minute: f.minute,
                score: f.score,
                stats: f.stats,
                consensusReport,
                latency: f.latency
            };
            
            // 1. High-Res Buffer (Last 120 snapshots ~16 minutes)
            history.unshift(snapshot);
            if (history.length > 120) history.pop();

            // 2. Minute-Sampled History (Last 45 minutes)
            const lastMinuteSnapshot = minuteHistory[0];
            // NEW: Initialize immediately if empty, then sample every 60s
            if (!lastMinuteSnapshot || (now - lastMinuteSnapshot.timestamp) >= 60000) {
                minuteHistory.unshift(snapshot);
                if (minuteHistory.length > 45) minuteHistory.pop();
            }

            const leagueProfile = leagueProfileModule.getProfile(f.league || f.leagueName);
            const matchedOdds = this.odds[f.id] || null;
            let strategySettings = {};
            try {
                const raw = localStorage.getItem('lbm_strategy_settings');
                if (raw && raw !== 'undefined' && raw !== 'null') strategySettings = JSON.parse(raw);
            } catch {
                strategySettings = {};
            }
            const analysis = analyzeMatch(f, matchedOdds || {}, consensusReport, strategySettings);

            // NEW: Multi-Layered Signal Generation (Unified Engine)
            const finalSignal = this.calculateFinalSignal(f, analysis, dqs);

            return {
                ...f,
                dqs,
                tier: leagueProfile.tier,
                history,
                minuteHistory,
                dataQuality: dqs >= 0.8 ? 'TAM' : dqs >= 0.5 ? 'KISITLI' : 'BEKLENİYOR',
                observations: analysis.observations,
                signal: finalSignal, // Uses the unified engine result
                expertAnalysis: analysis, // Keep raw expert analysis for reference
                activeStrategies: analysis.activeStrategies || [],
                consensusReport,
                matchedOdds, 
                aiSummary: existing?.aiSummary || f.aiSummary 
            };
        });

        this.healthStats.totalDiscovered = rawFixtures.length;
        this.healthStats.dqsAbove = dqsAbove;
        this.healthStats.dqsBelow = dqsBelow;

        return normalized;
    }

    calculateDQS(fixture) {
        let score = 0;
        const weights = CONFIG.DECISION.DQS_WEIGHTS;

        // 1. Latency (Gecikme)
        if (fixture.latency < 5000) score += weights.LATENCY;
        else if (fixture.latency < CONFIG.DATA.LATENCY_THRESHOLD_MS) score += weights.LATENCY * 0.5;

        // 2. Statistics Availability (İstatistik Mevcudiyeti)
        const hasSOG = fixture.stats?.shotsOnGoal?.home > 0 || fixture.stats?.shotsOnGoal?.away > 0;
        const hasAttacks = fixture.stats?.dangerousAttacks?.home > 0 || fixture.stats?.dangerousAttacks?.away > 0;
        const hasCorners = fixture.stats?.corners?.home > 0 || fixture.stats?.corners?.away > 0;
        const hasXG = (fixture.stats?.xg?.home > 0 || fixture.stats?.xg?.away > 0);

        if (hasSOG && hasAttacks) score += weights.STATS_AVAILABILITY;
        else if (hasSOG || hasAttacks) score += weights.STATS_AVAILABILITY * 0.7;

        // 3. Freshness (Güncellik)
        const minuteNum = parseInt(String(fixture.minute || '').replace(/[^0-9]/g, '')) || 0;
        if (minuteNum > 0 || fixture.minute === 'İY' || fixture.minute === 'HT') score += weights.FRESHNESS;

        // 4. Detailed Data Rewards (Detaylı Veri Ödülleri)
        if (hasXG) score += 0.1;
        if (hasCorners) score += 0.05;

        // 5. Partial Data Penalty (Kısmi Veri Cezası)
        if (fixture.isPartial) score -= 0.1;

        return Math.max(0.1, Math.min(1.0, Math.round(score * 100) / 100));
    }

    /**
     * LAYER 3: RISK & DISCIPLINE FILTERS
     */
    checkRiskFilters(fixture) {
        const risk = CONFIG.DECISION.RISK;
        const filters = {
            deadMatch: { status: 'OK', reason: '', reasonKey: '' },
            momentum: { status: 'OK', reason: '', reasonKey: '' },
            lateGame: { status: 'OK', reason: '', reasonKey: '' }
        };

        let homeScore = 0;
        let awayScore = 0;
        if (fixture.score && typeof fixture.score === 'object') {
            homeScore = Number(fixture.score.home) || 0;
            awayScore = Number(fixture.score.away) || 0;
        } else if (typeof fixture.score === 'string' && fixture.score.includes('-')) {
            const parts = fixture.score.split('-');
            homeScore = parseInt(parts[0]) || 0;
            awayScore = parseInt(parts[1]) || 0;
        }

        const goalDiff = Math.abs(homeScore - awayScore);
        const minStr = typeof fixture.minute === 'string' ? fixture.minute.replace("'", "") : fixture.minute;
        const minute = parseInt(minStr) || 0;

        // A. Dead Match Filter
        if (minute >= risk.DEAD_MATCH_MIN && goalDiff >= risk.DEAD_MATCH_DIFF) {
            filters.deadMatch = {
                status: 'FAIL',
                reason: `Dk:${minute} Skor:${homeScore}-${awayScore} (Ölü Maç)`,
                reasonKey: 'dead_match_reason'
            };
        }
        // B. Momentum Guard
        const history = fixture.history || [];
        const momentumWindow = fixture.tier === 2 ?
            CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.SETTINGS.TIER_2_MOMENTUM_WINDOW :
            CONFIG.DECISION.RISK.MOMENTUM_WINDOW_MIN;

        if (history.length >= 3) {
            const latest = history[0];
            const older = history.find(h => (Date.now() - h.timestamp) > (momentumWindow * 60 * 1000)) || history[history.length - 1];

            const sogDiff = (latest.stats?.shotsOnGoal?.home || 0) + (latest.stats?.shotsOnGoal?.away || 0) -
                ((older.stats?.shotsOnGoal?.home || 0) + (older.stats?.shotsOnGoal?.away || 0));

            if (sogDiff <= 0 && minute > 60) {
                filters.momentum = {
                    status: 'FAIL',
                    reason: `Son ${momentumWindow}dk İsabetli Şut Yok`,
                    reasonKey: 'no_momentum_reason'
                };
            }
        }

        // C. Late Game Ban
        if (minute >= risk.LATE_GAME_BAN_MIN) {
            filters.lateGame = {
                status: 'FAIL',
                reason: 'Geç Dakika Yasaklı (85+)',
                reasonKey: 'late_game_reason'
            };
        }

        // D. Tier 2 Aggressive Dead Match
        if (fixture.tier === 2 && minute >= CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.SETTINGS.TIER_2_DEAD_MATCH_MIN && goalDiff >= 1) {
            if (filters.deadMatch.status === 'OK') {
                filters.deadMatch = {
                    status: 'FAIL',
                    reason: `Tier 2 Erken Ölü Maç Filtresi (${minute}')`,
                    reasonKey: 'dead_match_reason'
                };
            }
        }

        return filters;
    }

    getSignalForMatch(matchId) {
        const fixture = this.fixtures.find(f => f.id === matchId);
        return fixture?.signal || null;
    }

    /**
     * Get statistics from exactly N minutes ago (or closest available point)
     */
    getStatsAtWindow(matchId, windowMinutes) {
        const fixture = this.fixtures.find(f => f.id === matchId || String(f.id) === String(matchId));
        if (!fixture || !fixture.minuteHistory || fixture.minuteHistory.length === 0) return null;

        const targetMs = Date.now() - (windowMinutes * 60 * 1000);
        
        // Find the snapshot closest to the target time
        let closest = fixture.minuteHistory[0];
        let minDiff = Math.abs(closest.timestamp - targetMs);

        for (const snap of fixture.minuteHistory) {
            const diff = Math.abs(snap.timestamp - targetMs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = snap;
            }
        }

        // Fallback: If target window specifically isn't found, 
        // try to return the oldest available point (minimum 1 minute old)
        // to provide at least some trend data during startup.
        if (minDiff > 3 * 60 * 1000) {
            const oldest = fixture.minuteHistory[fixture.minuteHistory.length - 1];
            const ageMs = Date.now() - oldest.timestamp;
            if (ageMs >= 60000) return oldest;
            return null;
        }

        return closest;
    }

    /**
     * UNIFIED DECISION ENGINE (v2.2)
     * Combines Quality, Risk, and Expert Analysis based on Decision Mode.
     */
    calculateFinalSignal(fixture, matchAnalysis, dqs) {
        const riskFilters = this.checkRiskFilters(fixture);
        const hasRiskFail = Object.values(riskFilters).some(f => f.status === 'FAIL');

        let verdict = 'PASS';
        let mainReason = '';
        let reasonKey = '';

        const bankrollState = bankrollManager.getState();
        if (bankrollState.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.NO_BET) {
            verdict = 'PASS';
            mainReason = 'BANKROLL STOP (NO-BET MODE)';
            reasonKey = 'bankroll_stop';
        } else if (dqs < CONFIG.DECISION.DQS_THRESHOLD) {
            verdict = 'PASS';
            mainReason = `DQS Düşük (${dqs.toFixed(2)})`;
            reasonKey = 'low_dqs';
        } else if (fixture.tier === 3) {
            verdict = 'PASS';
            mainReason = 'Tier 3: Discovery Only (No Bets)';
            reasonKey = 'tier_3_desc';
        } else {
            // VIP Fast-Track Logic: If Tier 1 and high momentum, lower DQS threshold slightly
            const isVipFastTrack = fixture.tier === 1 && dqs >= 0.65 && !hasRiskFail;

            if (this.decisionMode === CONFIG.DECISION.MODES.CORE_DQS || isVipFastTrack) {
                verdict = 'BET';
                mainReason = isVipFastTrack ? 'VIP Fast-Track (DQS Esnetildi)' : 'DQS Onaylandı';
                reasonKey = isVipFastTrack ? 'vip_fasttrack' : 'dqs_approved';
            } else if (this.decisionMode === CONFIG.DECISION.MODES.FULL_STACK) {
                // FULL STACK: Both Basic Risk Filters AND Advanced Expert Analysis must be OK
                if (hasRiskFail) {
                    verdict = 'PASS';
                    const failed = Object.values(riskFilters).find(f => f.status === 'FAIL');
                    mainReason = failed.reason;
                    reasonKey = failed.reasonKey;
                } else if (matchAnalysis.verdict === 'PASS') {
                    verdict = 'PASS';
                    mainReason = matchAnalysis.reason;
                    reasonKey = 'analysis_rejected';
                } else {
                    verdict = 'BET';
                    mainReason = matchAnalysis.reason;
                    reasonKey = 'full_stack_ok';
                }
            } else {
                // DQS_RISK (STANDART): Basic Risk Filters only
                if (hasRiskFail) {
                    verdict = 'PASS';
                    const failed = Object.values(riskFilters).find(f => f.status === 'FAIL');
                    mainReason = failed.reason;
                    reasonKey = failed.reasonKey;
                } else {
                    verdict = 'BET';
                    mainReason = 'DQS + Risk Filtreleri OK';
                    reasonKey = 'full_stack_ok';
                }
            }
        }

        return {
            verdict,
            reason: mainReason,
            reasonKey,
            dqs,
            riskFilters,
            observations: matchAnalysis.observations || {},
            edgeScore: matchAnalysis.edgeScore,
            counterArgs: matchAnalysis.counterArgs,
            activeStrategies: matchAnalysis.activeStrategies || [],
            timestamp: Date.now()
        };
    }

    trackTier3Performance(fixture) {
        const league = fixture.league || fixture.leagueName;
        if (!this.tier3Performance[league]) {
            this.tier3Performance[league] = { totalObserved: 0, potentialWins: 0, lastSignal: null };
        }

        // This is a simplified "Silent Win" tracker
        // In a real scenario, this would check if a goal happened after the signal
        const stats = fixture.stats;
        if (stats.shotsOnGoal.home + stats.shotsOnGoal.away > 2) {
            this.tier3Performance[league].totalObserved++;
            // Logic simulation for potential win
            if (Math.random() > 0.7) this.tier3Performance[league].potentialWins++;
        }

        localStorage.setItem('tier3_performance', JSON.stringify(this.tier3Performance));
    }

    stop() {
        this.isRunning = false;
    }
}

export const dataWorker = new DataWorker();
