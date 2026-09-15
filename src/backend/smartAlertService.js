import { CONFIG } from '../config.js';
import { aiUsageLimiter } from './aiUsageLimiter.js';

class SmartAlertService {
    constructor() {
        this.activeAlerts = [];
        try {
            const raw = localStorage.getItem('alert_history');
            this.alertHistory = (raw && raw !== 'undefined' && raw !== 'null') ? JSON.parse(raw) : [];
        } catch (e) {
            this.alertHistory = [];
        }

        // Persistent score-state locks (Anti-Spam Deduplication)
        try {
            const rawLocks = localStorage.getItem('smart_alert_score_locks');
            this.alertedScoreStates = (rawLocks && rawLocks !== 'undefined' && rawLocks !== 'null')
                ? new Map(JSON.parse(rawLocks))
                : new Map();
        } catch (e) {
            this.alertedScoreStates = new Map();
        }

        this.subscribers = [];
        this.lastCheckTime = {};
        this.cooldownMinutes = 15; // Increased cooldown to 15 mins
        this.currentUserId = null;
        this.currentTier = 'trial';
    }

    saveLocks() {
        try {
            // Keep only latest 50 match locks
            const entries = Array.from(this.alertedScoreStates.entries()).slice(-50);
            localStorage.setItem('smart_alert_score_locks', JSON.stringify(entries));
        } catch (e) {
            // Safe fallback
        }
    }

    setUserContext(userId, tier) {
        this.currentUserId = userId;
        this.currentTier = tier;
    }

    /**
     * Subscribe to alerts
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all subscribers
     */
    notify(alert) {
        this.subscribers.forEach(cb => cb(alert));
    }

    /**
     * Check if match qualifies for alert
     */
    evaluateMatch(match, signal) {
        const conditions = {
            xgAdvantage: false,
            highPressure: false,
            strongConsensus: false,
            goodTiming: false,
            qualityData: false,
            strongValue: false,
            trapWarning: false
        };

        const minStr = (match.minute || '').toString().trim();
        const statusType = (match.status?.type || '').toLowerCase();
        const statusCode = match.status?.code;

        // Skip finished, halftime, penalty shootout, or postponed matches
        const descLower = (match.status?.description || '').toLowerCase();
        if (statusType === 'finished' || statusCode === 100 || minStr === 'MS' || minStr.includes('FT') || minStr.toLowerCase().includes('ended')) {
            return { shouldAlert: false, blockedReason: 'FINISHED' };
        }
        if (statusCode === 120 || statusCode === 110 || minStr === 'Pen.' || minStr.toLowerCase().includes('pen') || descLower.includes('penalt') || descLower.includes('shootout')) {
            return { shouldAlert: false, blockedReason: 'PENALTIES' };
        }
        if (statusCode === 31 || minStr === 'İY' || minStr.includes('HT') || minStr.toLowerCase().includes('half')) {
            return { shouldAlert: false, blockedReason: 'HALFTIME' };
        }

        const minute = parseInt(minStr) || 0;
        // Strict in-play golden window: 15' to 82'
        if (minute < 15 || minute > 82) {
            return { shouldAlert: false, blockedReason: 'OUT_OF_WINDOW' };
        }

        const dqs = match.dqs || 0;
        // Quality data threshold: minimum 0.60
        if (dqs < 0.60) {
            return { shouldAlert: false, blockedReason: 'LOW_DQS' };
        }

        const xgHome = match.stats?.xg?.home || 0;
        const xgAway = match.stats?.xg?.away || 0;
        const xgDiff = Math.abs(xgHome - xgAway);
        const pressure = match.observations?.pressure?.total || match.pressure?.total || 0;
        const velocity = match.observations?.velocity?.trend || 'STABLE';
        const consensusCount = match.consensusReport?.totalSources || 0;

        // Integration with Scorer results (if available)
        const oppData = match.opportunityData || {};
        const oddsScore = oppData.components?.odds || 50;

        // Block alert if match is in post-goal cooldown (market is resetting)
        if (oppData.suggestedMarket?.marketKey === 'POST_GOAL_COOLDOWN') {
            return { shouldAlert: false, blockedReason: 'POST_GOAL_COOLDOWN' };
        }

        // Block alert if match is stable/neutral with NO actionable betting edge (Pas)
        if (oppData.suggestedMarket?.marketKey === 'STABLE_GAME' || oppData.suggestedMarket?.marketKey === 'PASS') {
            return { shouldAlert: false, blockedReason: 'STABLE_GAME_NO_EDGE' };
        }

        // 1. xG Advantage Check
        if (xgDiff >= 0.4) {
            conditions.xgAdvantage = true;
        }

        // 2. High Pressure Check
        if (pressure >= 55 || velocity === 'HOT') {
            conditions.highPressure = true;
        }

        // 3. Strong Consensus Check
        if (consensusCount >= 3) {
            const agreement = match.consensusReport?.agreement || {};
            const topCount = Math.max(...Object.values(agreement), 0);
            if (topCount >= 3 || (topCount >= 2 && consensusCount <= 4)) {
                conditions.strongConsensus = true;
            }
        }

        // 4. Good Timing Check (sweet spot: 55-80 minutes)
        if (minute >= 50 && minute <= 80) {
            conditions.goodTiming = true;
        }

        // 5. Quality Data Check
        if (dqs >= 0.65) {
            conditions.qualityData = true;
        }

        // 6. Value and Alpha Check (from Scorer)
        if (oddsScore >= 80 || oppData.hasValueEV) {
            conditions.strongValue = true;
        }
        if (oppData.score >= 80 && (oddsScore >= 70 || oppData.hasValueEV)) {
            conditions.alphaValue = true;
        }

        // Count how many conditions are met
        const metConditions = Object.values(conditions).filter(Boolean).length;
        const score = Math.round((metConditions / 7) * 100);

        // INSTITUTIONAL QUALITY GATE:
        // Must have at least ONE genuine edge: Latency, +EV, Strategy match, or massive pitch dominance
        const hasInstitutionalEdge = 
            Boolean(oppData.hasLatencyEdge) || 
            Boolean(oppData.hasValueEV) || 
            (signal?.activeStrategies && signal.activeStrategies.length > 0) ||
            (oppData.score >= 75 && metConditions >= 5);

        if (!hasInstitutionalEdge) {
            return {
                conditions,
                metCount: metConditions,
                score,
                shouldAlert: false,
                alertLevel: 'NORMAL',
                blockedReason: 'NO_EDGE'
            };
        }

        let level = 'NORMAL';
        if (oppData.hasLatencyEdge) level = 'ALEV';
        else if (conditions.alphaValue || (oppData.hasValueEV && oppData.bestEV?.ev >= 10)) level = 'ALPHA';
        else if (metConditions >= 5 || oppData.hasValueEV) level = 'ALEV';
        else if (metConditions >= 4) level = 'SICAK';

        return {
            conditions,
            metCount: metConditions,
            score,
            shouldAlert: metConditions >= 4 || conditions.alphaValue || oppData.hasValueEV || oppData.hasLatencyEdge,
            alertLevel: level
        };
    }

    /**
     * Generate alert recommendation with diverse, quant-grounded markets
     */
    generateRecommendation(match, evaluation, signal) {
        const xgHome = match.stats?.xg?.home || 0;
        const xgAway = match.stats?.xg?.away || 0;
        const scoreHome = match.score?.home ?? match.homeScore?.current ?? 0;
        const scoreAway = match.score?.away ?? match.awayScore?.current ?? 0;
        const totalGoals = scoreHome + scoreAway;
        const xgTotal = xgHome + xgAway;
        const oppData = match.opportunityData || {};
        const minute = parseInt(match.minute) || 0;

        let marketKey = '';
        let marketParams = {};
        let marketLabel = '';
        let team = '';
        let confidence = 70;
        let odds = null; // NEVER default to fake 1.8/1.85! Real live odds or null.
        let edgeType = 'STANDARD';

        // 1. PRIORITY 1: Latency Arbitrage (En keskin ve en acil sinyal)
        if (oppData.hasLatencyEdge && oppData.latencyEdge) {
            marketKey = 'market_latency_arbitrage';
            marketLabel = oppData.latencyEdge.recommendedMarket || 'Gecikme Arbitrajı';
            team = oppData.latencyEdge.team || (oppData.latencyEdge.side === 'HOME' ? match.homeTeam : match.awayTeam);
            confidence = 92;
            odds = oppData.latencyEdge.softOdds ? parseFloat(oppData.latencyEdge.softOdds) : null;
            edgeType = 'LATENCY';
        }
        // 2. PRIORITY 2: Mathematical Value (+EV Engine >= +7%)
        else if (oppData.hasValueEV && oppData.bestEV) {
            marketKey = 'market_plus_ev';
            marketLabel = oppData.bestEV.label || 'Matematiksel Değer (+EV)';
            team = (marketLabel.includes('Ev') || marketLabel.includes('Home')) ? match.homeTeam :
                   (marketLabel.includes('Dep') || marketLabel.includes('Away')) ? match.awayTeam : '';
            confidence = Math.min(94, Math.max(68, Math.round(oppData.bestEV.trueProb || 75)));
            odds = oppData.bestEV.marketOdds ? parseFloat(oppData.bestEV.marketOdds) : null;
            edgeType = 'PLUS_EV';
        }
        // 3. PRIORITY 3: Live Opportunity Scorer Suggested Market (Full multi-factor pitch engine)
        // Must align 100% with the card shown on the screen!
        else if (oppData.suggestedMarket && oppData.suggestedMarket.marketKey) {
            const sm = oppData.suggestedMarket;
            marketKey = sm.marketKey;
            team = sm.team || (marketKey.includes('HOME') ? match.homeTeam : marketKey.includes('AWAY') ? match.awayTeam : '');
            if (marketKey === 'HOME_NEXT_GOAL') {
                marketLabel = `Sıradaki Gol: ${match.homeTeam || 'Ev Sahibi'}`;
            } else if (marketKey === 'AWAY_NEXT_GOAL') {
                marketLabel = `Sıradaki Gol: ${match.awayTeam || 'Deplasman'}`;
            } else if (marketKey === 'HOME_WIN_NEXT') {
                marketLabel = `${match.homeTeam || 'Ev Sahibi'} Kazanmaya Yakın`;
            } else if (marketKey === 'AWAY_WIN_NEXT') {
                marketLabel = `${match.awayTeam || 'Deplasman'} Kazanmaya Yakın`;
            } else if (marketKey === 'OVER_NEXT_DYNAMIC') {
                marketLabel = sm.label || `${sm.target || (totalGoals + 0.5)} Üst Bekleniyor`;
            } else if (marketKey === 'POST_GOAL_COOLDOWN') {
                marketLabel = 'Yeni Gol Oldu (Piyasa Dengeleniyor)';
            } else if (marketKey === 'STABLE_GAME' || marketKey === 'PASS') {
                marketLabel = 'Dengeli Oyun (Pas Geç)';
            } else {
                marketLabel = sm.label || sm.marketKey.replace(/_/g, ' ');
            }
            confidence = sm.confidence || 75;
            edgeType = 'OPPORTUNITY';
        }
        // 4. PRIORITY 4: Active Quant Strategy (Red Card Advantage, Comeback, Momentum, etc.)
        else if (signal?.activeStrategies && signal.activeStrategies.length > 0) {
            const strat = signal.activeStrategies[0];
            marketKey = strat.id;

            // Check if strategy is BTTS and both teams already scored (e.g. 1-2, 2-1)!
            if (strat.id === 'BTTS' && scoreHome >= 1 && scoreAway >= 1) {
                const targetGoals = totalGoals + 0.5;
                marketKey = 'market_over_goals';
                marketParams = { goals: `${targetGoals}` };
                marketLabel = `${targetGoals} Üst`;
                confidence = 74;
            } else if (strat.id === 'STATS' || strat.id === 'PRESS' || strat.id === 'CORNERS') {
                const isHomeDom = strat.team ? (strat.team === match.homeTeam) : 
                    ((xgHome > xgAway + 0.2) || (match.stats?.dangerousAttacks?.home || 0) > (match.stats?.dangerousAttacks?.away || 0) * 1.25);
                team = strat.team || (isHomeDom ? match.homeTeam : match.awayTeam);
                marketKey = isHomeDom ? 'market_next_goal_home' : 'market_next_goal_away';
                marketLabel = `Sıradaki Gol: ${team}`;
                confidence = Math.min(90, Math.max(65, Math.round(signal.confidence || 78)));
            } else {
                marketLabel = strat.label || signal.market || 'Strateji Sinyali';
                team = strat.team || (strat.id === 'COMEBACK' || strat.id === 'ADV_COMEBACK' ? (scoreHome < scoreAway ? match.homeTeam : match.awayTeam) :
                       strat.id === 'RED_CARD_ADV' ? (match.cards?.away?.red ? match.homeTeam : match.awayTeam) : '');
                confidence = Math.min(90, Math.max(65, Math.round(signal.confidence || 75)));
            }
            odds = signal.odds ? parseFloat(signal.odds) : null;
            edgeType = 'STRATEGY';
        }
        // 5. PRIORITY 5: Contextual In-Play Dynamics (Diverse, clear Turkish betting markets)
        else {
            if (minute < 45 && totalGoals === 0) {
                marketKey = 'market_fh_over05';
                marketLabel = 'İlk Yarı 0.5 Üst';
                confidence = 72;
            } else if (scoreHome === 0 || scoreAway === 0) {
                const possHome = match.stats?.possession?.home ?? 50;
                const possAway = match.stats?.possession?.away ?? 50;
                const shotsHome = match.stats?.totalShots?.home ?? 0;
                const shotsAway = match.stats?.totalShots?.away ?? 0;

                // KG Var is ONLY allowed if at least one team has not yet scored!
                if (xgHome >= 0.7 && xgAway >= 0.7 && possHome >= 35 && possAway >= 35) {
                    marketKey = 'market_btts';
                    marketLabel = 'Karşılıklı Gol Var';
                    confidence = 74;
                } else if ((xgHome > xgAway + 0.3 || (match.observations?.pressure?.home || 0) > (match.observations?.pressure?.away || 0) + 15) && possHome >= 40 && (shotsAway === 0 || shotsHome >= shotsAway * 0.65)) {
                    team = match.homeTeam;
                    marketKey = 'market_next_goal_home';
                    marketLabel = `Sıradaki Gol (Ev)`;
                    confidence = 75;
                } else if ((xgAway > xgHome + 0.3 || (match.observations?.pressure?.away || 0) > (match.observations?.pressure?.home || 0) + 15) && possAway >= 40 && (shotsHome === 0 || shotsAway >= shotsHome * 0.65)) {
                    team = match.awayTeam;
                    marketKey = 'market_next_goal_away';
                    marketLabel = `Sıradaki Gol (Deplasman)`;
                    confidence = 75;
                } else {
                    const targetGoals = totalGoals + 0.5;
                    marketKey = 'market_over_goals';
                    marketParams = { goals: `${targetGoals}` };
                    marketLabel = `${targetGoals} Üst`;
                    confidence = 70;
                }
            } else {
                const possHome = match.stats?.possession?.home ?? 50;
                const possAway = match.stats?.possession?.away ?? 50;
                const shotsHome = match.stats?.totalShots?.home ?? 0;
                const shotsAway = match.stats?.totalShots?.away ?? 0;

                // Both teams already scored (e.g. 1-1, 1-2, 2-1) -> KG Var is already settled!
                // Offer dynamic Next Goal or dynamically higher Over line!
                if ((xgHome > xgAway + 0.3 || (match.observations?.pressure?.home || 0) > (match.observations?.pressure?.away || 0) + 15) && possHome >= 40 && (shotsAway === 0 || shotsHome >= shotsAway * 0.65)) {
                    team = match.homeTeam;
                    marketKey = 'market_next_goal_home';
                    marketLabel = `Sıradaki Gol (Ev)`;
                    confidence = 75;
                } else if ((xgAway > xgHome + 0.3 || (match.observations?.pressure?.away || 0) > (match.observations?.pressure?.home || 0) + 15) && possAway >= 40 && (shotsHome === 0 || shotsAway >= shotsHome * 0.65)) {
                    team = match.awayTeam;
                    marketKey = 'market_next_goal_away';
                    marketLabel = `Sıradaki Gol (Deplasman)`;
                    confidence = 75;
                } else {
                    const nextLine = totalGoals + 0.5;
                    marketKey = 'market_over_goals';
                    marketParams = { goals: `${nextLine}` };
                    marketLabel = `${nextLine} Üst`;
                    confidence = 72;
                }
            }
        }

        // Generate explicit, natural Turkish prediction text
        let predictionText = '';
        if (marketKey === 'market_next_goal_home' || marketKey === 'HOME_NEXT_GOAL') {
            predictionText = `Sıradaki Golü ${team || match.homeTeam} Atar`;
        } else if (marketKey === 'market_next_goal_away' || marketKey === 'AWAY_NEXT_GOAL') {
            predictionText = `Sıradaki Golü ${team || match.awayTeam} Atar`;
        } else if (marketKey === 'HOME_WIN_NEXT') {
            predictionText = `${team || match.homeTeam} Kazanmaya Yakın`;
        } else if (marketKey === 'AWAY_WIN_NEXT') {
            predictionText = `${team || match.awayTeam} Kazanmaya Yakın`;
        } else if (marketKey === 'OVER_NEXT_DYNAMIC') {
            const target = oppData.suggestedMarket?.target || (totalGoals + 0.5);
            predictionText = `${target} Üst Olur`;
        } else if (marketKey === 'market_btts' || marketKey === 'BTTS') {
            predictionText = 'Karşılıklı Gol Var (KG Var)';
        } else if (marketKey === 'market_fh_over05' || marketKey === 'FHG') {
            predictionText = 'İlk Yarı 0.5 Üst Olur';
        } else if (marketKey === 'market_over_goals' || marketKey === 'OVER_EXPOSURE') {
            const target = marketParams.goals || (totalGoals + 0.5);
            predictionText = `${target} Üst Olur`;
        } else if (marketKey === 'COMEBACK' || marketKey === 'ADV_COMEBACK') {
            predictionText = `Geri Dönüş: Sıradaki Golü ${team || match.homeTeam} Atar`;
        } else if (marketKey === 'PRESS' || marketKey === 'MOMENTUM_SURGE' || marketKey === 'STATS' || marketKey === 'CORNERS') {
            predictionText = `Sıradaki Golü ${team || match.homeTeam} Atar`;
        } else if (marketKey === 'RED_CARD_ADV') {
            predictionText = `Kırmızı Kart Avantajı: Sıradaki Golü ${team || match.homeTeam} Atar`;
        } else if (marketKey === 'UNDERDOG_RESIST') {
            predictionText = `Sürpriz Direnç: ${team || match.awayTeam} Gol Atar / Çifte Şans`;
        } else if (marketKey === 'COUNTER_ATTACK') {
            predictionText = `Tehlikeli Kontra: Sıradaki Golü ${team || match.awayTeam} Atar`;
        } else if (oppData.hasLatencyEdge) {
            predictionText = `Gecikme Arbitrajı: ${marketLabel || 'Sıradaki Gol'}`;
        } else if (oppData.hasValueEV) {
            predictionText = `Değerli Bahis (+EV): ${marketLabel || `${totalGoals + 0.5} Üst`}`;
        } else {
            predictionText = marketLabel || `Sıradaki Golü ${team || match.homeTeam} Atar`;
        }

        // Genuine Live Odds Extraction:
        // If odds is not yet populated from Latency or +EV, extract the genuine bookmaker odds for this specific market.
        // If no genuine odds exists in the live feed, keep it null. NEVER invent a fake 1.80/1.85!
        if (!odds) {
            const liveOdds = match.matchedOdds || oppData.oddsInfo || match.odds || {};
            const isHomeMarket = marketKey.includes('home') || marketKey.includes('HOME') || team === match.homeTeam;
            const isAwayMarket = marketKey.includes('away') || marketKey.includes('AWAY') || team === match.awayTeam;
            const isOverMarket = marketKey.includes('over') || marketKey.includes('OVER');

            if (isHomeMarket) {
                const hOdds = parseFloat(liveOdds.nextGoalHome || (marketKey.includes('WIN') ? liveOdds.home : (liveOdds.homeWin || liveOdds.home)));
                if (hOdds && hOdds > 1.05) odds = parseFloat(hOdds.toFixed(2));
            } else if (isAwayMarket) {
                const aOdds = parseFloat(liveOdds.nextGoalAway || (marketKey.includes('WIN') ? liveOdds.away : (liveOdds.awayWin || liveOdds.away)));
                if (aOdds && aOdds > 1.05) odds = parseFloat(aOdds.toFixed(2));
            } else if (isOverMarket) {
                const oOdds = parseFloat(liveOdds.over25 || liveOdds.over);
                if (oOdds && oOdds > 1.05) odds = parseFloat(oOdds.toFixed(2));
            } else if (signal?.odds) {
                const sOdds = parseFloat(signal.odds);
                if (sOdds && sOdds > 1.05) odds = parseFloat(sOdds.toFixed(2));
            }
        }

        // Confidence adjustments
        if (oppData.valueDetected) confidence += 5;
        if (evaluation.alertLevel === 'ALPHA') confidence += 5;
        confidence = Math.min(95, Math.max(55, Math.round(confidence)));

        return {
            marketKey,
            marketParams,
            marketLabel,
            market: marketLabel,
            predictionText,
            team,
            confidence,
            odds,
            edgeType,
            isAlpha: evaluation.alertLevel === 'ALPHA',
            valueDetected: oppData.valueDetected,
            reasoning: this.buildReasoning(match, evaluation)
        };
    }

    /**
     * Build reasoning text
     */
    buildReasoning(match, evaluation) {
        const reasons = [];
        const { conditions } = evaluation;
        const oppData = match.opportunityData || {};

        if (conditions.xgAdvantage) {
            const xgHome = match.stats?.xg?.home || 0;
            const xgAway = match.stats?.xg?.away || 0;
            reasons.push({ key: 'reason_xg_diff', params: { diff: Math.abs(xgHome - xgAway).toFixed(2) } });
        }
        if (conditions.highPressure) {
            reasons.push({ key: 'reason_pressure', params: { pressure: match.observations?.pressure?.total || 0 } });
        }
        if (conditions.strongValue) {
            reasons.push({ key: 'reason_value_detected' });
        }
        if (evaluation.alertLevel === 'ALPHA') {
            reasons.push({ key: 'reason_alpha_signal' });
        }
        if (conditions.strongConsensus) {
            const agreement = match.consensusReport?.agreement || {};
            const top = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
            if (top) {
                reasons.push({
                    key: 'reason_consensus',
                    params: { count: top[1], prediction: top[0] }
                });
            }
        }
        if (conditions.goodTiming) {
            reasons.push({ key: 'reason_critical_min', params: { minute: match.minute } });
        }

        return reasons;
    }

    /**
     * Check matches and generate alerts
     */
    checkMatches(matches, signals) {
        const now = Date.now();
        const newAlerts = [];

        matches.forEach(match => {
            const matchId = String(match.id);
            const signal = signals[matchId];

            // Plan-based Tier restriction for alerts
            if (this.currentTier === 'trial' && match.tier !== 1) {
                return;
            }

            const curHome = Number(match.score?.home ?? match.homeScore?.current ?? 0);
            const curAway = Number(match.score?.away ?? match.awayScore?.current ?? 0);
            const currentScoreStr = `${curHome}-${curAway}`;

            // 1. STRICT SCORE-STATE ANTI-SPAM LOCK:
            // If this match was already alerted at this EXACT score, NEVER alert again until a goal is scored!
            const prevLock = this.alertedScoreStates.get(matchId);
            if (prevLock) {
                const scoreChanged = prevLock.score !== currentScoreStr;
                if (!scoreChanged) {
                    // Match has the exact same score as when previously alerted.
                    // Absolutely DO NOT trigger another alert!
                    return;
                }
            }

            // Cooldown check (minimum 3 minutes even if score changed to avoid rapid double-alerts)
            if (this.lastCheckTime[matchId] &&
                (now - this.lastCheckTime[matchId]) < 3 * 60 * 1000) {
                return;
            }

            const evaluation = this.evaluateMatch(match, signal);

            if (evaluation.shouldAlert) {
                // Check Usage Limit
                const limitCheck = aiUsageLimiter.canReceiveSmartAlert(this.currentUserId, this.currentTier);
                if (!limitCheck.allowed) {
                    this.lastCheckTime[matchId] = now; // Mark as checked to prevent retry spamming
                    return;
                }

                const recommendation = this.generateRecommendation(match, evaluation, signal);

                const alert = {
                    id: `${matchId}_${now}`,
                    matchId,
                    timestamp: now,
                    match: `${match.homeTeam} vs ${match.awayTeam}`,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    league: match.league || match.leagueName || '',
                    leagueName: match.leagueName || match.league || '',
                    minute: match.minute,
                    score: currentScoreStr,
                    level: evaluation.alertLevel,
                    conditionsMet: evaluation.metCount,
                    conditions: evaluation.conditions,
                    recommendation,
                    status: 'PENDING',
                    // NEW: Pass v2.0 metrics through
                    maxEV: signal?.maxEV || 0,
                    pSituation: signal?.pSituation || 0,
                    xgSurplus: signal?.observations?.xg?.surplus?.total || 0,
                    dqs: match.dqs || 0,
                    bestEV: match.opportunityData?.bestEV || null,
                    latencyEdge: match.opportunityData?.latencyEdge || null,
                    activeStrategies: signal?.activeStrategies || match.opportunityData?.activeStrategies || [],
                    cards: match.cards || {},
                    redCards: match.redCards || {},
                    oddsMovement: match.oddsMovement || null
                };

                newAlerts.push(alert);
                this.activeAlerts.push(alert);
                this.lastCheckTime[matchId] = now;

                // LOCK SCORE STATE (Eliminates repeated predictions for same score):
                this.alertedScoreStates.set(matchId, {
                    score: currentScoreStr,
                    market: recommendation.marketLabel || recommendation.marketKey,
                    timestamp: now
                });
                this.saveLocks();

                // Save to history
                this.alertHistory.unshift(alert);
                if (this.alertHistory.length > 100) this.alertHistory.pop();
                try {
                    localStorage.setItem('alert_history', JSON.stringify(this.alertHistory));
                } catch (e) {}

                // Record usage
                aiUsageLimiter.recordAIUsage(this.currentUserId, 'smartAlert');

                // Notify subscribers
                this.notify(alert);

                // TELEGRAM: Send signal to backend for Telegram delivery
                this.sendToTelegram(alert);

                console.log('[ALERT] 🔔 New alert:', alert.match, alert.level, alert.recommendation.market);
            }
        });

        // Clean old active alerts (older than 20 mins)
        this.activeAlerts = this.activeAlerts.filter(a =>
            (now - a.timestamp) < 20 * 60 * 1000
        );

        return newAlerts;
    }

    /**
     * Update alert result after match ends
     */
    updateAlertResult(alertId, result) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.status = result; // 'WON', 'LOST', 'VOID'
            alert.resolvedAt = Date.now();
            try {
                localStorage.setItem('alert_history', JSON.stringify(this.alertHistory));
            } catch (e) {}
            this.sendResolutionToTelegram(alert, result);
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        const resolved = this.alertHistory.filter(a => a.status !== 'PENDING');
        const won = resolved.filter(a => a.status === 'WON').length;
        const lost = resolved.filter(a => a.status === 'LOST').length;
        const total = won + lost;

        const byLevel = {
            ALEV: { won: 0, total: 0 },
            SICAK: { won: 0, total: 0 }
        };

        resolved.forEach(a => {
            if (a.level === 'ALEV' || a.level === 'SICAK') {
                byLevel[a.level].total++;
                if (a.status === 'WON') byLevel[a.level].won++;
            }
        });

        return {
            totalAlerts: this.alertHistory.length,
            resolved: total,
            pending: this.alertHistory.filter(a => a.status === 'PENDING').length,
            won,
            lost,
            accuracy: total > 0 ? ((won / total) * 100).toFixed(1) : 0,
            byLevel,
            last7Days: this.alertHistory.filter(a =>
                (Date.now() - a.timestamp) < 7 * 24 * 60 * 60 * 1000
            ).length
        };
    }

    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return this.activeAlerts;
    }

    /**
     * Get recent history (Plan-aware)
     */
    getHistory(limit = 50) {
        return this.alertHistory.slice(0, limit);
    }

    /**
     * Clear alert history
     */
    clearHistory() {
        this.alertHistory = [];
        try {
            localStorage.removeItem('alert_history');
        } catch (e) {}
    }

    /**
     * Core evaluation logic for a single alert against match scores and status
     */
    evaluateAlertStatus(alert, curHome, curAway, isFinished = false, currentMinute = null) {
        const totalGoals = curHome + curAway;
        let initHome = 0, initAway = 0;
        if (typeof alert.score === 'string' && alert.score.includes('-')) {
            const parts = alert.score.split('-');
            initHome = parseInt(parts[0]) || 0;
            initAway = parseInt(parts[1]) || 0;
        } else if (alert.score && typeof alert.score === 'object') {
            initHome = Number(alert.score.home ?? 0);
            initAway = Number(alert.score.away ?? 0);
        }

        const rec = alert.recommendation || {};
        const marketLabel = (rec.predictionText || rec.marketLabel || rec.marketKey || rec.market || '').toLowerCase();
        const homeName = (alert.homeTeam || alert.match?.split(' vs ')?.[0] || '').toLowerCase();
        const awayName = (alert.awayTeam || alert.match?.split(' vs ')?.[1] || '').toLowerCase();

        // 1. OVER GOALS (Üst Gol)
        if (marketLabel.includes('üst') || marketLabel.includes('over')) {
            const matchLine = marketLabel.match(/(\d+\.?\d*)/);
            const line = matchLine ? parseFloat(matchLine[1]) : (initHome + initAway + 0.5);
            if (totalGoals > line) return 'WON';
            if (isFinished && totalGoals <= line) return 'LOST';
            return 'PENDING';
        }

        // 2. UNDER GOALS (Alt Gol)
        if (marketLabel.includes('alt') || marketLabel.includes('under')) {
            const matchLine = marketLabel.match(/(\d+\.?\d*)/);
            const line = matchLine ? parseFloat(matchLine[1]) : (initHome + initAway + 0.5);
            if (totalGoals > line) return 'LOST';
            if (isFinished && totalGoals < line) return 'WON';
            return 'PENDING';
        }

        // 3. BTTS / KG VAR
        if (marketLabel.includes('karşılıklı') || marketLabel.includes('kg var') || marketLabel.includes('btts')) {
            if (curHome >= 1 && curAway >= 1) return 'WON';
            if (isFinished) return 'LOST';
            return 'PENDING';
        }

        // 4. BTTS YOK / KG YOK
        if (marketLabel.includes('kg yok') || marketLabel.includes('btts no')) {
            if (curHome >= 1 && curAway >= 1) return 'LOST';
            if (isFinished && (curHome === 0 || curAway === 0)) return 'WON';
            return 'PENDING';
        }

        // 5. NEXT GOAL (Sıradaki Gol)
        if (marketLabel.includes('sıradaki') || marketLabel.includes('next goal') || marketLabel.includes('next_goal')) {
            const team = (rec.team || '').toLowerCase();
            const isHomeTarget = marketLabel.includes('ev') || marketLabel.includes('home') || (team && homeName.includes(team)) || (homeName && marketLabel.includes(homeName.slice(0, 5)));
            const isAwayTarget = marketLabel.includes('deplasman') || marketLabel.includes('away') || (team && awayName.includes(team)) || (awayName && marketLabel.includes(awayName.slice(0, 5)));

            if (curHome > initHome && curAway === initAway) {
                return isHomeTarget ? 'WON' : 'LOST';
            } else if (curAway > initAway && curHome === initHome) {
                return isAwayTarget ? 'WON' : 'LOST';
            } else if (curHome > initHome || curAway > initAway) {
                // Both scored or multiple goals: check which team hit their target
                if (isHomeTarget && curHome > initHome) return 'WON';
                if (isAwayTarget && curAway > initAway) return 'WON';
                return 'LOST';
            } else if (isFinished && totalGoals === (initHome + initAway)) {
                return 'LOST';
            }
            return 'PENDING';
        }

        // 6. MATCH WINNER / KAZANMAYA YAKIN / MS 1 / MS 2 / 1X2
        if (marketLabel.includes('kazan') || marketLabel.includes('win') || marketLabel.includes('ms 1') || marketLabel.includes('ms 2') || marketLabel.includes('1x2') || rec.marketKey === 'HOME_WIN_NEXT' || rec.marketKey === 'AWAY_WIN_NEXT') {
            const team = (rec.team || '').toLowerCase();
            const isHomeTarget = marketLabel.includes('ms 1') || marketLabel.includes('ev') || (team && homeName.includes(team)) || (homeName && marketLabel.includes(homeName.slice(0, 5)));
            const isAwayTarget = marketLabel.includes('ms 2') || marketLabel.includes('deplasman') || (team && awayName.includes(team)) || (awayName && marketLabel.includes(awayName.slice(0, 5)));

            if (isFinished) {
                if (isHomeTarget && curHome > curAway) return 'WON';
                if (isAwayTarget && curAway > curHome) return 'WON';
                return 'LOST';
            }

            // In-play early win: If a team leads by 3+ goals past 80' (e.g. 4-0 at 80')
            const minuteNum = typeof currentMinute === 'number' ? currentMinute : parseInt(currentMinute || 0);
            if (minuteNum >= 80) {
                if (isHomeTarget && (curHome - curAway) >= 3) return 'WON';
                if (isAwayTarget && (curAway - curHome) >= 3) return 'WON';
            }
            return 'PENDING';
        }

        // 7. MATCH FINISHED GENERIC FALLBACK
        if (isFinished) {
            // If team was mentioned and they won:
            if (homeName && marketLabel.includes(homeName.slice(0, 5)) && curHome > curAway) return 'WON';
            if (awayName && marketLabel.includes(awayName.slice(0, 5)) && curAway > curHome) return 'WON';
            if (totalGoals > (initHome + initAway)) return 'WON';
            return 'LOST';
        }

        return 'PENDING';
    }

    /**
     * Automatically evaluate results of pending alerts based on live match scores
     */
    autoResolveAlerts(matches) {
        if (!Array.isArray(matches) || matches.length === 0) return;
        let updated = false;
        const now = Date.now();

        this.alertHistory.forEach(alert => {
            if (alert.status !== 'PENDING') return;

            const match = matches.find(m => String(m.id) === String(alert.matchId));
            if (!match) return;

            const curHome = Number(match.score?.home ?? match.homeScore?.current ?? 0);
            const curAway = Number(match.score?.away ?? match.awayScore?.current ?? 0);
            const isFinished = match.status?.type === 'finished' || match.status?.code === 100 || match.minute === 'MS';

            const outcome = this.evaluateAlertStatus(alert, curHome, curAway, isFinished, match.minute);

            if (outcome === 'WON' || outcome === 'LOST') {
                alert.status = outcome;
                alert.resolvedAt = now;
                alert.finalScore = `${curHome}-${curAway}`;
                updated = true;
                this.sendResolutionToTelegram(alert, outcome, `${curHome}-${curAway}`);
            }
        });

        if (updated) {
            try {
                localStorage.setItem('alert_history', JSON.stringify(this.alertHistory));
            } catch (e) {}
        }
        return updated;
    }

    /**
     * Asynchronously query backend for finished matches to resolve pending alerts
     * that are no longer present in the live match feed.
     */
    async resolveFinishedAlerts() {
        const pending = this.alertHistory.filter(a => a.status === 'PENDING');
        if (pending.length === 0) return 0;

        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        let resolvedCount = 0;
        const now = Date.now();

        // Check each pending alert whose match may have finished
        for (const alert of pending) {
            if (!alert.matchId) continue;

            try {
                const res = await fetch(`${proxyBase}/api/sofascore/event/${alert.matchId}`, {
                    signal: AbortSignal.timeout(6000)
                });
                if (!res.ok) continue;
                const data = await res.json();
                const ev = data.event || data;

                if (!ev || !ev.status) continue;

                const statusType = (ev.status.type || '').toLowerCase();
                const statusCode = ev.status.code;
                const isFinished = statusType === 'finished' || statusCode === 100 || ev.status.description === 'Ended';

                const curHome = Number(ev.homeScore?.current ?? ev.score?.home ?? 0);
                const curAway = Number(ev.awayScore?.current ?? ev.score?.away ?? 0);

                const outcome = this.evaluateAlertStatus(alert, curHome, curAway, isFinished, ev.minute);

                if (outcome === 'WON' || outcome === 'LOST') {
                    alert.status = outcome;
                    alert.resolvedAt = now;
                    alert.finalScore = `${curHome}-${curAway}`;
                    resolvedCount++;
                    this.sendResolutionToTelegram(alert, outcome, `${curHome}-${curAway}`);
                }
            } catch (err) {
                // Ignore network timeouts for individual event fetch
            }
        }

        if (resolvedCount > 0) {
            try {
                localStorage.setItem('alert_history', JSON.stringify(this.alertHistory));
            } catch (e) {}
        }

        return resolvedCount;
    }

    /**
     * Send alert to Telegram via backend proxy
     */
    sendToTelegram(alert) {
        try {
            const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

            fetch(`${proxyBase}/api/telegram/send-signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: alert.id,
                    matchId: alert.matchId,
                    homeTeam: alert.homeTeam,
                    awayTeam: alert.awayTeam,
                    league: alert.league || alert.leagueName || '',
                    leagueName: alert.leagueName || alert.league || '',
                    minute: alert.minute,
                    score: alert.score,
                    level: alert.level,
                    conditionsMet: alert.conditionsMet,
                    conditions: alert.conditions,
                    recommendation: alert.recommendation,
                    dqs: alert.dqs || 0,
                    // NEW: v2.0 & v4.0 Metrics
                    maxEV: alert.maxEV,
                    pSituation: alert.pSituation,
                    xgSurplus: alert.xgSurplus,
                    bestEV: alert.bestEV,
                    latencyEdge: alert.latencyEdge,
                    activeStrategies: alert.activeStrategies || [],
                    cards: alert.cards,
                    redCards: alert.redCards,
                    oddsMovement: alert.oddsMovement
                })
            }).then(res => {
                if (res.ok) {
                    console.log('[TELEGRAM] ✅ Signal forwarded to Telegram');
                } else {
                    console.warn('[TELEGRAM] ⚠️ Backend returned:', res.status);
                }
            }).catch(err => {
                console.warn('[TELEGRAM] ⚠️ Failed to forward signal:', err.message);
            });
        } catch (e) {
            console.warn('[TELEGRAM] Error in sendToTelegram:', e.message);
        }
    }

    /**
     * Send signal resolution to Telegram via backend proxy
     */
    sendResolutionToTelegram(alert, result, score = null) {
        try {
            const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

            fetch(`${proxyBase}/api/telegram/resolve-signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: alert.id,
                    matchId: alert.matchId,
                    result: result,
                    score: score || alert.score
                })
            }).then(res => {
                if (res.ok) {
                    console.log(`[TELEGRAM] ✅ Resolution (${result}) forwarded to Telegram for ${alert.homeTeam} vs ${alert.awayTeam}`);
                }
            }).catch(err => {
                console.warn('[TELEGRAM] ⚠️ Failed to forward resolution:', err.message);
            });
        } catch (e) {
            console.warn('[TELEGRAM] Error in sendResolutionToTelegram:', e.message);
        }
    }

    /**
     * Clear all data (for testing)
     */
    clearAll() {
        this.activeAlerts = [];
        this.alertHistory = [];
        this.lastCheckTime = {};
        this.alertedScoreStates = new Map();
        try {
            localStorage.removeItem('alert_history');
            localStorage.removeItem('smart_alert_score_locks');
        } catch (e) {}
    }
}

export const smartAlertService = new SmartAlertService();
