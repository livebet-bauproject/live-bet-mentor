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
        this.matchLastStatsFetch = new Map();
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

    async triggerDeepAnalysis(matchId, lang = 'tr') {
        const match = this.fixtures.find(f => f.id.toString() === matchId.toString());
        if (!match) return;

        console.log('[DATA_WORKER] Manual Deep Analysis triggered for:', matchId, 'lang:', lang);
        match.aiSummary = lang === 'tr' ? "AI Kuant Analizi hazırlanıyor..." : lang === 'de' ? "KI-Quantenanalyse wird erstellt..." : "Generating AI Quant Analysis...";

        const summary = await aiAnalystService.getExpertSummary(match, match.consensusReport, lang);
        match.aiSummary = summary;

        return summary;
    }

    parseMatchMinute(min) {
        if (typeof min === 'number') return min;
        if (!min) return 0;
        const str = String(min).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (str.includes('iy') || str.includes('ht') || str.includes('devre') || str.includes('half')) return 45;
        if (str.includes('ft') || str.includes('bitti') || str.includes('end')) return 90;
        if (str.includes('+')) {
            const parts = str.split('+');
            const base = parseInt((parts[0] || '').replace(/[^0-9]/g, ''), 10) || 0;
            const extra = parseInt((parts[1] || '').replace(/[^0-9]/g, ''), 10) || 0;
            return base + extra;
        }
        const digits = str.replace(/[^0-9]/g, '');
        const num = parseInt(digits, 10);
        return isNaN(num) ? 0 : num;
    }

    async generateGlobalIntelligence(type = 'LIVE') {
        let candidates = [];
        if (type === 'LIVE') {
            const allLive = (this.fixtures || []).map(f => ({
                ...f,
                parsedMinute: this.parseMatchMinute(f.minute),
                signal: this.getSignalForMatch(f.id)
            }));

            // Tier 1: Matches in active action window (minute <= 85), solid DQS, and official BET signal
            candidates = allLive.filter(f => f.dqs >= 0.40 && f.signal?.verdict === 'BET' && f.parsedMinute <= 85);

            // Tier 2: High pressure & active telemetry matches (minute <= 88, DQS >= 0.35)
            if (candidates.length < 4) {
                const extra = allLive
                    .filter(f => !candidates.find(c => c.id === f.id) && f.dqs >= 0.35 && f.parsedMinute <= 88)
                    .sort((a, b) => {
                        const pressureA = Number(a.observations?.pressure?.total ?? 0);
                        const pressureB = Number(b.observations?.pressure?.total ?? 0);
                        const dqsA = Number(a.dqs ?? 0);
                        const dqsB = Number(b.dqs ?? 0);
                        return (pressureB * 0.6 + dqsB * 40) - (pressureA * 0.6 + dqsA * 40);
                    })
                    .slice(0, 6 - candidates.length);
                candidates = [...candidates, ...extra];
            }

            // Tier 3 Resilience: If still empty but fixtures exist, feed top live fixtures
            if (candidates.length === 0 && allLive.length > 0) {
                candidates = allLive.slice(0, 6);
            }
        }

        if (candidates.length === 0 && type === 'LIVE') {
            return JSON.stringify({
                report_summary: "Nexus Quant Core™ küresel canlı fikstürü taradı. Şu an sahada incelenebilecek aktif canlı veri akışı bulunmamaktadır.",
                golden_picks: [],
                strategic_combo: null,
                avoid_list: ["Şu an taranan karşılaşma yok veya lig devreleri kapalı."],
                value_picks: [],
                discipline_note: "Canlı piyasada aktif veri olmadığında sermayenizi koruyun; körleme bahis almayın."
            });
        }

        // Enhance candidates with signals and consensus for Nexus Quant Core
        const enhancedCandidates = candidates.map(c => ({
            ...c,
            signal: c.signal || this.getSignalForMatch(c.id),
            consensusReport: c.consensusReport || consensusAdapter.getConsensusSummary(this.consensusData, c)
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
                    // 1. Fetch central live odds in 1 single HTTP request (prevents 40 separate HTTP calls!)
                    try {
                        const centralOdds = await sofaScoreAdapter.fetchCentralOdds();
                        if (centralOdds && typeof centralOdds === 'object' && Object.keys(centralOdds).length > 0) {
                            Object.assign(this.odds, centralOdds);
                        }
                    } catch (e) {}

                    // 2. SELECTION PRIORITY & LOAD BALANCING (v2.4)
                    // Fetch full details only for:
                    // - Currently selected match in the UI (always top priority)
                    // - Matches missing stats (staggered, up to 2 per cycle)
                    // - Stale high-priority matches not refreshed in > 60s (staggered, up to 2 per cycle)
                    const priorityIds = new Set();
                    const now = Date.now();

                    // Top Priority: Selected Match in UI
                    if (this.selectedMatchId) {
                        priorityIds.add(this.selectedMatchId);
                        priorityIds.add(Number(this.selectedMatchId));
                        priorityIds.add(String(this.selectedMatchId));
                    }

                    // Matches missing stats: initialize up to 2 per cycle
                    const missingStats = rawMatches.filter(rm => {
                        const ex = this.fixtures.find(f => f.id === rm.id);
                        return !ex || !ex.stats || ex.isPartial;
                    });
                    for (const rm of missingStats.slice(0, 2)) {
                        priorityIds.add(rm.id);
                    }

                    // Major Tier 1 & 2 matches that haven't refreshed in > 60s: up to 2 per cycle
                    const staleHighPriority = rawMatches.filter(rm => {
                        if (priorityIds.has(rm.id)) return false;
                        const leagueName = rm.leagueName || rm.tournament?.name || '';
                        const isMajor = leagueProfileModule.getTier(leagueName) <= 2;
                        const lastFetch = this.matchLastStatsFetch.get(rm.id) || 0;
                        return isMajor && (now - lastFetch > 60000);
                    });
                    for (const rm of staleHighPriority.slice(0, 2)) {
                        priorityIds.add(rm.id);
                    }

                    console.log(`[DATA_WORKER] Optimized Load-Balanced Polling: ${priorityIds.size} priority detailed match(es) out of ${rawMatches.length} live matches.`);

                    const detailedMatches = await Promise.all(
                        rawMatches.map(async (match) => {
                            const eventId = match.id;
                            if (!eventId) return match;

                            // Skip details for low-priority matches to keep network/Render completely unchoked
                            if (!priorityIds.has(eventId)) {
                                const existing = this.fixtures.find(f => f.id === eventId);
                                if (existing) {
                                    return {
                                        ...existing,
                                        score: (match.score && (match.score.home !== undefined || match.score.away !== undefined)) ? match.score : existing.score,
                                        minute: match.minute || existing.minute,
                                        status: match.status || existing.status
                                    };
                                }
                                return match;
                            }

                            // Fetch details + odds only if not already in central cache
                            const needOddsFetch = !this.odds[eventId] || String(eventId) === String(this.selectedMatchId);
                            const [fullDetail, liveOdds] = await Promise.all([
                                sofaScoreAdapter.fetchEventDetails(eventId),
                                needOddsFetch ? sofaScoreAdapter.fetchEventOdds(eventId) : Promise.resolve(this.odds[eventId])
                            ]);

                            // Update global odds cache with fresh data
                            if (liveOdds) {
                                this.odds[eventId] = liveOdds;
                            }

                            if (fullDetail) {
                                this.matchLastStatsFetch.set(eventId, Date.now());
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

                    const validMatches = detailedMatches.filter(r => r !== null);
                    const prevCount = this.fixtures?.length || 0;
                    const incomingCount = validMatches.length;

                    // Anti-Flap Shield: If incoming match count suddenly collapses by > 60% (e.g., 84 down to 9),
                    // retain the existing fixture list for a grace period of up to 3 cycles,
                    // merging incoming updates rather than wiping active matches off the user's screen.
                    if (prevCount >= 20 && incomingCount < prevCount * 0.4) {
                        this._consecutiveDropPolls = (this._consecutiveDropPolls || 0) + 1;
                        if (this._consecutiveDropPolls < 3) {
                            console.warn(`[DATA_WORKER] 🛡️ Anti-Flap Shield active: match count dropped suddenly from ${prevCount} to ${incomingCount}. Retaining existing fixtures (grace ${this._consecutiveDropPolls}/3).`);
                            // Merge fresh info for matches that ARE in validMatches into existing fixtures
                            const validMap = new Map(validMatches.map(m => [m.id, m]));
                            this.fixtures = this.fixtures.map(f => validMap.get(f.id) || f);
                            this.notify();
                            await new Promise(resolve => setTimeout(resolve, CONFIG.DATA.POLLING_INTERVAL_MS));
                            continue;
                        }
                    }
                    this._consecutiveDropPolls = 0;

                    if (validMatches.length > 0) {
                        this.fixtures = this.normalizeFixtures(validMatches);
                        this._consecutiveEmptyPolls = 0;
                        console.log('[DATA_WORKER] Normalized fixtures with full details:', this.fixtures?.length || 0);
                    } else if (rawMatches.length === 0) {
                        this._consecutiveEmptyPolls = (this._consecutiveEmptyPolls || 0) + 1;
                        if (this._consecutiveEmptyPolls >= 6) {
                            this.fixtures = [];
                        } else {
                            console.warn(`[DATA_WORKER] Empty match list received, retaining previous fixtures (grace period ${this._consecutiveEmptyPolls}/6)`);
                        }
                    }
                } else {
                    console.warn('[DATA_WORKER] Fetched matches is not an array:', rawMatches);
                    this._consecutiveEmptyPolls = (this._consecutiveEmptyPolls || 0) + 1;
                    if (this._consecutiveEmptyPolls >= 6) {
                        this.fixtures = [];
                    }
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
        const totalGoals = homeScore + awayScore;
        const rawMin = fixture.minute ?? '';
        const minStr = typeof rawMin === 'string' ? rawMin.replace("'", "").trim() : String(rawMin);

        let minute = 0;
        let isStoppageOrFinished = false;
        if (minStr === 'MS' || minStr.includes('FT') || minStr === 'Pen.' || minStr.toLowerCase().includes('ended')) {
            minute = 999;
            isStoppageOrFinished = true;
        } else if (minStr.includes('90+') || minStr === '90+') {
            minute = 95;
            isStoppageOrFinished = true;
        } else {
            minute = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
        }

        // 0. Match Finished
        if (minute === 999) {
            filters.lateGame = {
                status: 'FAIL',
                reason: 'Maç Sona Erdi (MS/FT)',
                reasonKey: 'match_finished'
            };
        }

        // A. Dead Match / Blowout Filter (Kopmuş / Ölü Maç)
        // 65'ten sonra 3+ fark (örn: 7-2, 4-1), 75'ten sonra 2+ fark veya toplam 6+ golde 2+ fark
        const isBlowout = (minute >= 65 && goalDiff >= 3) || (minute >= 75 && goalDiff >= 2) || (totalGoals >= 6 && goalDiff >= 2) || goalDiff >= 4;
        if (isBlowout && filters.deadMatch.status === 'OK') {
            filters.deadMatch = {
                status: 'FAIL',
                reason: `Dk:${minute >= 90 ? '90+' : minute}' Skor:${homeScore}-${awayScore} (Kopmuş Maç)`,
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

        // C. Late Game Ban (85+ or 90+)
        if (minute >= risk.LATE_GAME_BAN_MIN || isStoppageOrFinished) {
            if (filters.lateGame.status === 'OK') {
                filters.lateGame = {
                    status: 'FAIL',
                    reason: minute >= 90 ? 'Maç Sonu / Uzatmalar (90+ Kilitli)' : 'Geç Dakika Yasaklı (85+)',
                    reasonKey: 'late_game_reason'
                };
            }
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
        } else if (hasRiskFail) {
            // STRICT RISK OVERRIDE:
            // Regardless of decisionMode (CORE_DQS, FULL_STACK, or VIP Fast-Track),
            // a failed risk filter (dead match, 85+ / 90+ late game, no momentum, or finished)
            // MUST ALWAYS return PASS!
            verdict = 'PASS';
            const failed = Object.values(riskFilters).find(f => f.status === 'FAIL');
            mainReason = failed?.reason || 'Risk Filtresi Engeli';
            reasonKey = failed?.reasonKey || 'risk_rejected';
        } else if (dqs < CONFIG.DECISION.DQS_THRESHOLD) {
            verdict = 'PASS';
            mainReason = `DQS Düşük (${dqs.toFixed(2)})`;
            reasonKey = 'low_dqs';
        } else if (fixture.tier === 3) {
            verdict = 'PASS';
            mainReason = 'Tier 3: Discovery Only (No Bets)';
            reasonKey = 'tier_3_desc';
        } else {
            // Only evaluated if hasRiskFail is FALSE and DQS >= threshold:
            const isVipFastTrack = fixture.tier === 1 && dqs >= 0.65;

            if (this.decisionMode === CONFIG.DECISION.MODES.CORE_DQS || isVipFastTrack) {
                if (matchAnalysis.activeStrategies && matchAnalysis.activeStrategies.length > 0) {
                    verdict = 'BET';
                    mainReason = matchAnalysis.activeStrategies[0].label;
                    reasonKey = 'strategy_bet';
                } else if (matchAnalysis.verdict === 'BET') {
                    verdict = 'BET';
                    mainReason = matchAnalysis.reason || (isVipFastTrack ? 'VIP Fast-Track' : 'DQS Onaylandı');
                    reasonKey = isVipFastTrack ? 'vip_fasttrack' : 'dqs_approved';
                } else {
                    verdict = 'PASS';
                    mainReason = 'Kriterlere Uygun Strateji Bulunamadı';
                    reasonKey = 'waiting_strategy';
                }
            } else if (this.decisionMode === CONFIG.DECISION.MODES.FULL_STACK) {
                if (matchAnalysis.verdict === 'PASS') {
                    verdict = 'PASS';
                    mainReason = matchAnalysis.reason;
                    reasonKey = 'analysis_rejected';
                } else {
                    verdict = 'BET';
                    mainReason = matchAnalysis.reason;
                    reasonKey = 'full_stack_ok';
                }
            } else {
                // DQS_RISK (STANDART)
                if (matchAnalysis.verdict === 'BET') {
                    verdict = 'BET';
                    mainReason = matchAnalysis.reason;
                    reasonKey = 'full_stack_ok';
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
