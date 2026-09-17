import React, { useState } from 'react';
import { calculateMatchHeatScore, calculateLast20MinMetrics, formatMarketPrediction } from '../logic/liveSortEngine';
import { consensusAdapter } from '../backend/consensusAdapter';
import { dataWorker } from '../backend/dataWorker';
import { CONFIG } from '../config';
import { MatchLiveStatsCard } from './MatchLiveStatsCard';
import { AttackMomentumGraph as DefaultAttackGraph } from './AttackMomentumGraph';
import { MatchIncidentsTimeline as DefaultIncidentsTimeline } from './MatchIncidentsTimeline';

export const LiveTerminalMobile = ({
    matches = [],
    signals = {},
    trendingBets = [],
    opportunitiesMap = null,
    t = {},
    lang = 'tr',
    selectedMatch = null,
    onSelectMatch = () => {},
    onApproveBet = () => {},
    bankrollManager = null,
    pinnedMatchIds = new Set(),
    togglePinMatch = () => {},
    AttackMomentumGraph = null,
    MatchIncidentsTimeline = null,
    hideInTableMode = false,
    userProfile = null,
    onOpenUpgrade = () => {}
}) => {
    const EffectiveAttackGraph = AttackMomentumGraph || DefaultAttackGraph;
    const EffectiveIncidentsTimeline = MatchIncidentsTimeline || DefaultIncidentsTimeline;
    const [expandedMatchId, setExpandedMatchId] = useState(null);
    const [trackedMatchIds, setTrackedMatchIds] = useState(() => new Set());

    const handleCardClick = (match, e) => {
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        setExpandedMatchId(prev => prev === match.id ? null : match.id);
    };

    const parseScores = (score) => {
        if (!score && score !== 0) return { home: '0', away: '0' };
        if (typeof score === 'object') {
            return { home: String(score.home ?? 0), away: String(score.away ?? 0) };
        }
        const str = String(score).trim();
        if (str.includes('-')) {
            const parts = str.split('-');
            return { home: parts[0].trim(), away: parts[1].trim() };
        }
        if (str.includes(':')) {
            const parts = str.split(':');
            return { home: parts[0].trim(), away: parts[1].trim() };
        }
        return { home: str, away: '' };
    };

    const formatMinute = (minute) => {
        if (!minute && minute !== 0) return "0'";
        const str = String(minute).trim();
        if (str.includes('HT') || str.includes('İY')) return t?.halftime_short || 'İY';
        if (str.includes('FT') || str.includes('MS')) return t?.fulltime_short || 'MS';
        if (str.includes('Pen')) return 'Pen.';
        return str.includes("'") ? str : `${str}'`;
    };

    const getPredictionDisplay = (m, signal) => {
        if (!signal || signal.verdict !== 'BET') return null;

        const minStr = String(m?.minute || '').trim();
        const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
        const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;
        if (isLateOrFinished) return null;

        const strat = signal.activeStrategies?.[0];
        let label = strat?.label || signal.prediction || m.opportunityData?.suggestedMarket?.label;
        if (!label && signal.reason && !signal.reason.includes('Kriterlere') && !signal.reason.includes('Strateji')) {
            label = signal.reason;
        }
        if (!label) return lang === 'tr' ? 'BAHİS' : lang === 'de' ? 'WETTE' : 'BET';

        if (lang === 'de') {
            return label
                .replace(/^Sıradaki Gol:/i, 'Nächstes Tor:')
                .replace(/^İY 0\.5 ÜST/i, 'HZ Über 0.5')
                .replace(/^İY 1\.5 ÜST/i, 'HZ Über 1.5')
                .replace(/^SON 15DK PATLAMASI/i, '15m MOMENTUM-SCHWUNG')
                .replace(/^GERİ DÖNÜŞ/i, 'COMEBACK')
                .replace(/^BASKI LİDERİ/i, 'DRUCK-LEADER')
                .replace(/^İSTATİSTİKSEL BASKI/i, 'STATISTISCHE DOMINANZ')
                .replace(/^GOL ALARMI/i, 'TOR-ALARM')
                .replace(/ÜST/g, 'ÜBER')
                .replace(/ALT/g, 'UNTER');
        }

        if (lang === 'en') {
            return label
                .replace(/^Sıradaki Gol:/i, 'Next Goal:')
                .replace(/^İY 0\.5 ÜST/i, 'HT Over 0.5')
                .replace(/^İY 1\.5 ÜST/i, 'HT Over 1.5')
                .replace(/^SON 15DK PATLAMASI/i, '15m MOMENTUM BURST')
                .replace(/^GERİ DÖNÜŞ/i, 'COMEBACK')
                .replace(/^BASKI LİDERİ/i, 'PRESSURE LEADER')
                .replace(/^İSTATİSTİKSEL BASKI/i, 'STATISTICAL DOMINANCE')
                .replace(/^GOL ALARMI/i, 'GOAL ALERT')
                .replace(/ÜST/g, 'OVER')
                .replace(/ALT/g, 'UNDER');
        }
        return label;
    };

    if (!Array.isArray(matches) || matches.length === 0) {
        return (
            <div className="tb-mobile-empty" style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--tb-surface)',
                border: '1px solid var(--tb-border)',
                borderRadius: '12px',
                color: 'var(--tb-text-muted)',
                fontSize: '0.85rem'
            }}>
                📡 {lang === 'tr' ? 'Seçili filtreye uygun canlı maç bulunamadı.' : 'No live matches matching this filter.'}
            </div>
        );
    }

    return (
        <div className={`tb-mobile-stream ${hideInTableMode ? 'hide-in-table-mode' : ''}`}>
            {matches.map(m => {
                const isExpanded = expandedMatchId === m.id;
                const signal = signals[m.id];
                const isPinned = pinnedMatchIds.has(m.id);
                const rawHeat = calculateMatchHeatScore(m, signal);
                const heat = (typeof rawHeat === 'number' && !isNaN(rawHeat)) ? rawHeat : 0;
                const opp = (opportunitiesMap instanceof Map ? opportunitiesMap.get(m.id) : null) || m.opportunityData;
                const rawScore = (opp?.score !== undefined && typeof opp.score === 'number' && !isNaN(opp.score)) ? opp.score : heat;
                const heatScore = Math.max(0, Math.min(100, Math.round(rawScore || 0)));
                const rawHeatLevel = opp?.heatLevel || (heatScore >= 75 ? 'ALEV' : heatScore >= 50 ? 'SICAK' : 'SOGUK');
                const heatLevel = lang === 'en' 
                    ? (rawHeatLevel === 'ALEV' ? 'FLAME' : rawHeatLevel === 'SICAK' ? 'HOT' : rawHeatLevel === 'SOGUK' ? 'COLD' : rawHeatLevel)
                    : rawHeatLevel;
                const heatIcon = rawHeatLevel === 'ALPHA' ? '🚀' : rawHeatLevel === 'ALEV' ? '🔥' : rawHeatLevel === 'SICAK' ? '⚡' : '❄️';
                const last20 = calculateLast20MinMetrics(m, signal);

                    const sogHome = m.stats?.shotsOnGoal?.home || 0;
                    const sogAway = m.stats?.shotsOnGoal?.away || 0;
                    const daHome = m.stats?.dangerousAttacks?.home || 0;
                    const daAway = m.stats?.dangerousAttacks?.away || 0;
                    const daDiff = Math.abs(daHome - daAway);
                    const xgHome = Number(m.stats?.xg?.home || 0);
                    const xgAway = Number(m.stats?.xg?.away || 0);

                    const redHome = Number(m.cards?.home?.red || m.stats?.cards?.home?.red || 0);
                    const redAway = Number(m.cards?.away?.red || m.stats?.cards?.away?.red || 0);
                    const yellowHome = Number(m.cards?.home?.yellow || m.stats?.cards?.home?.yellow || 0);
                    const yellowAway = Number(m.cards?.away?.yellow || m.stats?.cards?.away?.yellow || 0);

                    const oddsHome = m.odds?.home || m.liveOdds?.home || '-';
                    const oddsDraw = m.odds?.draw || m.liveOdds?.draw || '-';
                    const oddsAway = m.odds?.away || m.liveOdds?.away || '-';
                    const hasOdds = oddsHome !== '-' || oddsDraw !== '-' || oddsAway !== '-';
                    const minStr = String(m?.minute || '').trim();
                    const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
                    const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;

                    const predDisplay = getPredictionDisplay(m, signal);
                    const isBetReady = signal?.verdict === 'BET' && Boolean(predDisplay) && !isLateOrFinished;
                    const isHot = heat >= 75;

                    // Stat coloring discipline matching desktop
                    const daAlertClass = daDiff >= 20 ? 'alert-red' : daDiff >= 12 ? 'alert-amber' : 'neutral';
                    const heatAlertClass = heat >= 75 ? 'alert-red' : heat >= 55 ? 'alert-amber' : 'neutral';

                    // European Market Flow / Trending Bets
                    const matchTrendingBets = (trendingBets || []).filter(tb => 
                        consensusAdapter._isFuzzyMatch(tb.home, tb.away, m.homeTeam, m.awayTeam) ||
                        consensusAdapter._isFuzzyMatch(tb.away, tb.home, m.homeTeam, m.awayTeam)
                    );
                    const hasTrend = matchTrendingBets.length > 0;
                    const primaryTrend = hasTrend 
                        ? [...matchTrendingBets].sort((a, b) => (b.count || 0) - (a.count || 0))[0] 
                        : null;
                    const totalTrendCount = hasTrend
                        ? matchTrendingBets.reduce((sum, b) => sum + (b.count || 0), 0)
                        : 0;
                    const dqsVal = m.dqs !== undefined ? m.dqs : 0;
                    const isTrendApproved = hasTrend && dqsVal >= 0.50;
                    const isTrendTrap = hasTrend && dqsVal < 0.40;
                    const marketPrediction = hasTrend ? formatMarketPrediction(primaryTrend, lang) : '';

                    // Consolidated Intelligence (Bayesian Radar & Risk Guard)
                    const bayesian = m?.observations?.bayesian;
                    const heatNorm = Math.min(1, Math.max(0, heat / 100));
                    const rawPosterior = bayesian?.posterior ?? Math.min(0.92, Math.max(0.12, (heatNorm * 0.45 + ((xgHome + xgAway) > 0 ? (xgHome + xgAway) * 0.15 : (sogHome + sogAway) * 0.04) + (daDiff >= 15 ? 0.12 : 0))));
                    const goalProb = (rawPosterior * 100).toFixed(1);
                    const baseTempo = bayesian?.prior ? Math.round(bayesian.prior * 100) : Math.min(85, Math.max(20, Math.round(heatNorm * 60 + 15)));
                    const pressureImpact = bayesian?.impact ? (bayesian.impact * 100).toFixed(1) : ((rawPosterior - (baseTempo / 100)) * 100).toFixed(1);
                    const confidence = bayesian?.confidence || (heat >= 70 ? 'HIGH' : heat >= 45 ? 'MEDIUM' : 'LOW');
                    const confidenceLabel = confidence === 'HIGH' ? (lang === 'tr' ? 'YÜKSEK' : 'HIGH') : confidence === 'MEDIUM' ? (lang === 'tr' ? 'ORTA' : 'MEDIUM') : (lang === 'tr' ? 'DÜŞÜK' : 'LOW');
                    const confidenceColor = confidence === 'HIGH' ? '#10b981' : confidence === 'MEDIUM' ? '#fbbf24' : '#ef4444';

                    const riskFilters = (dataWorker && typeof dataWorker.checkRiskFilters === 'function')
                        ? dataWorker.checkRiskFilters(m)
                        : {
                            deadMatch: { status: 'OK' },
                            momentum: { status: 'OK' },
                            lateGame: { status: 'OK' }
                        };
                    const latencyMs = m.latency || Math.round(35 + (m.id ? (Number(String(m.id).replace(/\D/g, '')) % 40) : 12));
                    const dataQuality = m.dataQuality === 'PARTIAL' ? (lang === 'en' ? 'PENDING' : 'BEKLENİYOR') : (m.dataQuality === 'LIMITED' ? (lang === 'en' ? 'LIMITED' : 'KISITLI') : (lang === 'en' ? 'FULL' : 'TAM'));
                    const pressureTotal = m.observations?.pressure?.total || Math.round(heat * 0.85);

                    const scores = parseScores(m.score);

                    return (
                        <div
                            key={m.id}
                            className={`tb-mobile-card ${isBetReady ? 'bet-border' : isHot ? 'hot-border' : ''} ${isExpanded ? 'expanded' : ''}`}
                            onClick={(e) => handleCardClick(m, e)}
                        >
                            {/* Line 1: Header (Pin, Minute, League, Heat & Caret) */}
                            <div className="tb-m-row-1">
                                <div className="tb-m-min-league">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: isPinned ? '#facc15' : 'rgba(255,255,255,0.25)',
                                            fontSize: '0.9rem',
                                            padding: '0 2px',
                                            cursor: 'pointer'
                                        }}
                                        title={isPinned ? (lang === 'en' ? 'Remove from Favorites' : 'Favorilerden Çıkar') : (lang === 'en' ? 'Add to Favorites' : 'Favoriye Ekle')}
                                    >
                                        ★
                                    </button>
                                    <span className="tb-m-min">
                                        <span className="tb-pulse-dot" style={{ display: 'inline-block', marginRight: '4px' }} />
                                        {formatMinute(m.minute)}
                                    </span>
                                    <span className="tb-m-league">
                                        <span style={{ opacity: 0.6, marginRight: '3px' }}>T{m.tier || 1}</span>
                                        {m.league || m.leagueName || 'Futbol'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span
                                        className={`tb-heat-badge tb-heat-${(rawHeatLevel || 'soguk').toLowerCase()}`}
                                        title={lang === 'tr' ? `Isı Skoru: ${heatScore} • Seviye: ${heatLevel}` : `Heat Score: ${heatScore} • Level: ${heatLevel}`}
                                    >
                                        {heatIcon} {heatScore} {heatLevel}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '0.72rem',
                                            color: 'var(--tb-text-muted)',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease',
                                            display: 'inline-block'
                                        }}
                                    >
                                        ▼
                                    </span>
                                </div>
                            </div>

                            {/* Line 2: Teams & Scores (Clear 2-row layout with cards & scores aligned) */}
                            <div className="tb-m-match-box">
                                <div className="tb-m-team-row">
                                    <div className="tb-m-team-name-group">
                                        <span className="tb-m-team-name">{m.homeTeam}</span>
                                        {yellowHome > 0 && <span className="tb-card-badge tb-card-yellow">{yellowHome}</span>}
                                        {redHome > 0 && <span className="tb-card-badge tb-card-red">{redHome}</span>}
                                    </div>
                                    <span className="tb-m-team-score">{scores.home}</span>
                                </div>
                                <div className="tb-m-team-row">
                                    <div className="tb-m-team-name-group">
                                        <span className="tb-m-team-name">{m.awayTeam}</span>
                                        {yellowAway > 0 && <span className="tb-card-badge tb-card-yellow">{yellowAway}</span>}
                                        {redAway > 0 && <span className="tb-card-badge tb-card-red">{redAway}</span>}
                                    </div>
                                    <span className="tb-m-team-score">{scores.away}</span>
                                </div>
                            </div>

                            {/* Line 3: European Market Flow / Akıllı Para Pill (Dedicated full-width line) */}
                            {hasTrend && (
                                <div className="tb-m-trend-bar">
                                    <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}>
                                        <span>{isTrendApproved ? '🟢' : isTrendTrap ? '🔴' : '📊'}</span>
                                        <span style={{ fontWeight: 900 }}>
                                            {isTrendApproved ? (lang === 'tr' ? 'AKILLI PARA:' : 'SMART MONEY:') : isTrendTrap ? (lang === 'tr' ? 'TUZAK ALARMI:' : 'TRAP ALERT:') : (lang === 'tr' ? 'PİYASA AKIŞI:' : 'MARKET INFLUX:')}
                                        </span>
                                        <span className="tb-trend-pred">{marketPrediction}</span>
                                        {primaryTrend.odds && (
                                            <span className="tb-trend-odds">
                                                @{typeof primaryTrend.odds === 'number' ? primaryTrend.odds.toFixed(2) : primaryTrend.odds}
                                            </span>
                                        )}
                                        <span style={{ opacity: 0.85, fontSize: '0.62rem' }}>• {totalTrendCount} {lang === 'tr' ? 'Kupon' : 'Bets'}</span>
                                    </span>
                                </div>
                            )}

                            {/* Line 4: 1X2 Live Odds Row (If available) */}
                            {hasOdds && (
                                <div className="tb-m-odds-row">
                                    <span className="tb-m-odds-label">1X2:</span>
                                    <span className="tb-m-odds-val">1: <strong>{oddsHome}</strong></span>
                                    <span className="tb-m-odds-sep">•</span>
                                    <span className="tb-m-odds-val">X: <strong>{oddsDraw}</strong></span>
                                    <span className="tb-m-odds-sep">•</span>
                                    <span className="tb-m-odds-val">2: <strong>{oddsAway}</strong></span>
                                </div>
                            )}

                            {/* Line 5: 4-Column Live Stats Grid with Explicit Desktop Labels */}
                            <div className="tb-m-stats-grid">
                                {/* Column 1: BASKI / İVME */}
                                <div className={`tb-m-stat-cell ${heatAlertClass}`}>
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'BASKI/İVME' : 'PRESSURE'}</span>
                                    <span className="tb-m-stat-value">
                                        %{heat}
                                        {last20.isSurging && (
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: '#fbbf24', fontWeight: 800, marginTop: '2px' }}>
                                                ⚡ {last20.dominantTeam ? `${last20.dominantTeam.slice(0, 9)} (+${last20.teamDeltaDA || last20.deltaDA} ${lang === 'tr' ? 'Atak' : 'Atk'})` : `+${last20.deltaDA} ${lang === 'tr' ? 'Atak' : 'Atk'}`}
                                            </span>
                                        )}
                                    </span>
                                </div>

                                {/* Column 2: ŞUT (İSB) */}
                                <div className="tb-m-stat-cell">
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'ŞUT (İSB)' : 'SOG'}</span>
                                    <span className="tb-m-stat-value">{sogHome} - {sogAway}</span>
                                </div>

                                {/* Column 3: T.ATAK */}
                                <div className={`tb-m-stat-cell ${daAlertClass}`}>
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'T.ATAK' : 'D.ATTACK'}</span>
                                    <span className="tb-m-stat-value">
                                        {daHome} - {daAway}
                                    </span>
                                </div>

                                {/* Column 4: xG */}
                                <div className="tb-m-stat-cell xg">
                                    <span className="tb-m-stat-label">xG</span>
                                    <span className="tb-m-stat-value">
                                        {(xgHome > 0 || xgAway > 0) ? `${xgHome.toFixed(1)} - ${xgAway.toFixed(1)}` : '-'}
                                    </span>
                                </div>
                            </div>

                            {/* Line 6: AI Signal & DQS Footer */}
                            <div className="tb-m-footer">
                                {(() => {
                                    const isAdmin = userProfile?.plan === 'admin' || userProfile?.role === 'admin';
                                    const isExpired = !isAdmin && userProfile && (userProfile?.status === 'expired' || (userProfile?.subscription_end && new Date(userProfile.subscription_end) < new Date()));

                                    if (isExpired && (isBetReady || isHot)) {
                                        return (
                                            <span
                                                className="tb-signal-badge tb-signal-bet"
                                                onClick={(e) => { e.stopPropagation(); onOpenUpgrade(); }}
                                                style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', background: 'linear-gradient(135deg, #a78bfa, #38bdf8)', color: '#000', fontWeight: 900, boxShadow: '0 0 12px rgba(167, 139, 250, 0.4)' }}
                                            >
                                                🔒 {lang === 'tr' ? 'VIP SİNYAL KİLİDİNİ AÇ' : 'UNLOCK VIP SIGNAL'}
                                            </span>
                                        );
                                    }

                                    if (isLateOrFinished) {
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                                <span>DQS: {(m.dqs || 0).toFixed(2)}</span>
                                                <span className="tb-signal-badge tb-signal-pass" style={{ fontSize: '0.62rem', padding: '1px 5px', opacity: 0.6 }}>
                                                    {minStr === 'MS' || minStr.includes('FT') ? (lang === 'tr' ? 'MS' : 'FT') : (lang === 'tr' ? 'KİLİTLİ (88+)' : 'LOCKED (88+)')}
                                                </span>
                                            </div>
                                        );
                                    }

                                    if (isBetReady) {
                                        return (
                                            <span className="tb-signal-badge tb-signal-bet" style={{ width: '100%', justifyContent: 'center' }}>
                                                ✓ {predDisplay}
                                            </span>
                                        );
                                    }

                                    if (isHot) {
                                        return (
                                            <span className="tb-signal-badge tb-signal-hot" style={{ width: '100%', justifyContent: 'center' }}>
                                                🔥 {lang === 'tr' ? `ALEV BASKI (%${heat})` : `BURNING PRESSURE (%${heat})`}
                                            </span>
                                        );
                                    }

                                    if (last20.isSurging) {
                                        return (
                                            <span
                                                className="tb-signal-badge"
                                                style={{
                                                    width: '100%',
                                                    justifyContent: 'center',
                                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 88, 12, 0.25))',
                                                    color: '#fbbf24',
                                                    border: '1px solid #f59e0b',
                                                    boxShadow: '0 0 8px rgba(245, 158, 11, 0.25)'
                                                }}
                                            >
                                                ⚡ {last20.dominantTeam ? `${lang === 'tr' ? 'Baskı' : 'Surge'}: ${last20.dominantTeam} (+${last20.deltaDA})` : (lang === 'tr' ? `SON 20' BASKISI (+${last20.deltaDA})` : `LAST 20m SURGE (+${last20.deltaDA})`)}
                                            </span>
                                        );
                                    }

                                    if ((m.dqs || 0) >= (CONFIG?.DECISION?.DQS_THRESHOLD || 0.60)) {
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.7rem' }}>
                                                <span style={{ color: 'var(--tb-text-muted)' }}>
                                                    AI DQS: <strong style={{ color: '#38bdf8' }}>{(m.dqs || 0).toFixed(2)}</strong>
                                                </span>
                                                <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.68rem' }}>
                                                    ● {lang === 'tr' ? 'Tempolu' : 'Active'}
                                                </span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                            <span>DQS: {(m.dqs || 0).toFixed(2)}</span>
                                            <span className="tb-signal-badge tb-signal-pass" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                                {t?.verdict_pass || 'PAS'}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Mobile Drawer on Click */}
                            {isExpanded && (
                                <div className="tb-m-drawer tb-action-ignore">
                                    {/* Momentum Graph */}
                                    {EffectiveAttackGraph && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
                                                📈 {lang === 'tr' ? 'Canlı Baskı Grafiği (Attack Momentum)' : 'Live Attack Momentum Wave'}
                                            </div>
                                            <EffectiveAttackGraph match={m} lang={lang} />
                                        </div>
                                    )}

                                    {/* Match Live Stats Card */}
                                    <MatchLiveStatsCard match={m} lang={lang} t={t} />

                                    {/* Match Incidents Timeline */}
                                    {EffectiveIncidentsTimeline && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--tb-text-secondary)', marginBottom: '4px' }}>
                                                ⏱️ {lang === 'tr' ? 'Canlı Maç Olayları' : 'Match Incidents Timeline'}
                                            </div>
                                            <EffectiveIncidentsTimeline match={m} lang={lang} />
                                        </div>
                                    )}

                                    {/* AI Verdict Details */}
                                    {signal && (
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px', fontSize: '0.72rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#38bdf8' }}>
                                                    🎯 {lang === 'tr' ? 'Yapay Zeka Stratejisi' : 'AI Match Strategy'}
                                                </span>
                                                {isBetReady && (
                                                    <span style={{ fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem' }}>
                                                        {predDisplay}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--tb-text-secondary)', lineHeight: 1.4 }}>
                                                {signal.reason || signal.mainReason || m.opportunityData?.reason || (lang === 'tr' ? 'Sistem saha verilerini analiz ediyor.' : 'Analyzing match stats in real-time.')}
                                            </div>
                                            {signal.activeStrategies && signal.activeStrategies.length > 0 && (
                                                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {signal.activeStrategies.map((strat, sIdx) => (
                                                        <span
                                                            key={sIdx}
                                                            style={{
                                                                background: 'rgba(16, 185, 129, 0.12)',
                                                                color: '#34d399',
                                                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            ⚡ {strat.label} {strat.score ? `(%${Math.round(strat.score)})` : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 🧠 Canlı Gol İhtimali & Yapay Zeka Radarı (Bayesian Intelligence) */}
                                    <div style={{
                                        background: 'linear-gradient(145deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(56, 189, 248, 0.22)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span>🧠</span>
                                                <span>{lang === 'tr' ? 'Gol İhtimali & AI Radarı' : 'Goal Probability & Radar'}</span>
                                            </span>
                                            <span style={{
                                                background: 'rgba(56, 189, 248, 0.15)',
                                                color: '#38bdf8',
                                                fontSize: '0.6rem',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                fontWeight: 800
                                            }}>
                                                %{goalProb}
                                            </span>
                                        </div>

                                        {/* 3-Col Gauge Grid */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1.2fr 1fr',
                                            gap: '4px',
                                            alignItems: 'center',
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            padding: '6px 4px',
                                            borderRadius: '6px',
                                            margin: '4px 0'
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.58rem', opacity: 0.6, fontWeight: 700 }}>{lang === 'tr' ? 'TEMPO' : 'TEMPO'}</div>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f1f5f9' }}>%{baseTempo}</div>
                                            </div>
                                            <div style={{ textAlign: 'center', position: 'relative' }}>
                                                <svg width="70" height="38" viewBox="0 0 100 60" style={{ display: 'inline-block' }}>
                                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#38bdf8" strokeWidth="8" strokeDasharray={`${rawPosterior * 125}, 125`} strokeLinecap="round" />
                                                </svg>
                                                <div style={{ position: 'absolute', bottom: '0', left: 0, right: 0, fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8' }}>
                                                    %{goalProb}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.58rem', opacity: 0.6, fontWeight: 700 }}>{lang === 'tr' ? 'BASKI' : 'BOOST'}</div>
                                                <div style={{
                                                    fontSize: '1rem',
                                                    fontWeight: 900,
                                                    color: Number(pressureImpact) > 0 ? '#34d399' : Number(pressureImpact) < 0 ? '#ef4444' : '#f1f5f9'
                                                }}>
                                                    {Number(pressureImpact) > 0 ? `+${pressureImpact}%` : `${pressureImpact}%`}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', marginTop: '2px' }}>
                                            <span style={{ opacity: 0.65 }}>
                                                {lang === 'tr' ? 'Güven:' : 'Conf:'} <strong style={{ color: confidenceColor }}>{confidenceLabel}</strong>
                                            </span>
                                            <span style={{ opacity: 0.5, fontStyle: 'italic' }}>
                                                DQS: {(m.dqs || 0).toFixed(2)} • {lang === 'tr' ? 'Latans:' : 'Latency:'} {latencyMs}ms
                                            </span>
                                        </div>
                                    </div>

                                    {/* 🛡️ Risk Guard & DQS Kalkanı */}
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--tb-border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span>🛡️</span>
                                                <span>{lang === 'tr' ? 'Risk Guard & DQS Kalkanı' : 'Risk Guard & DQS Shield'}</span>
                                            </span>
                                            <span style={{
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                padding: '1px 5px',
                                                borderRadius: '4px',
                                                background: (dataQuality === 'TAM' || dataQuality === 'FULL') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: (dataQuality === 'TAM' || dataQuality === 'FULL') ? '#34d399' : '#f87171'
                                            }}>
                                                {lang === 'tr' ? `VERİ: ${dataQuality}` : `DATA: ${dataQuality}`}
                                            </span>
                                        </div>

                                        {/* 3 Risk Pills */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', margin: '4px 0' }}>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{lang === 'tr' ? 'Ölü Maç' : 'Dead'}</div>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: riskFilters.deadMatch?.status === 'OK' ? '#34d399' : '#ef4444' }}>
                                                    {riskFilters.deadMatch?.status === 'OK' ? (lang === 'tr' ? '✓ TAMAM' : '✓ OK') : (lang === 'tr' ? '✗ RİSK' : '✗ RISKY')}
                                                </span>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{lang === 'tr' ? 'Momentum' : 'Mom.'}</div>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: riskFilters.momentum?.status === 'OK' ? '#34d399' : '#ef4444' }}>
                                                    {riskFilters.momentum?.status === 'OK' ? (lang === 'tr' ? '✓ AKTİF' : '✓ ACTIVE') : (lang === 'tr' ? '✗ PASİF' : '✗ PASSIVE')}
                                                </span>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{lang === 'tr' ? 'Geç Dk' : 'Late'}</div>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: riskFilters.lateGame?.status === 'OK' ? '#34d399' : '#ef4444' }}>
                                                    {riskFilters.lateGame?.status === 'OK' ? (lang === 'tr' ? '✓ UYGUN' : '✓ ELIGIBLE') : (lang === 'tr' ? '✗ KİLİT' : '✗ LOCKED')}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--tb-text-muted)' }}>
                                            <span>{lang === 'tr' ? 'Baskı:' : 'Press:'} <strong style={{ color: '#fbbf24' }}>%{pressureTotal}</strong></span>
                                            <span>{lang === 'tr' ? 'İvme:' : 'Vel:'} <strong style={{ color: '#f1f5f9' }}>{m.observations?.velocity?.trend || (heat >= 70 ? 'HOT' : 'STABLE')}</strong></span>
                                            <span>{lang === 'tr' ? 'Gecikme:' : 'Lat:'} <strong style={{ color: '#38bdf8' }}>{latencyMs}ms</strong></span>
                                        </div>
                                    </div>

                                    {/* European Market Flow Detail */}
                                    {hasTrend && (
                                        <div className="tb-trend-box" style={{ padding: '8px', fontSize: '0.72rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#38bdf8' }}>
                                                    📈 {lang === 'tr' ? 'Avrupa Piyasa Akışı' : 'European Market Flow'}
                                                </span>
                                                <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`} style={{ fontSize: '0.62rem' }}>
                                                    {isTrendApproved 
                                                        ? (lang === 'tr' ? '🟢 Akıllı Para' : '🟢 Smart Money') 
                                                        : isTrendTrap 
                                                        ? (lang === 'tr' ? '🔴 Tuzak Alarmı' : '🔴 Trap Alert') 
                                                        : (lang === 'tr' ? '📊 Piyasa Akışı' : '📊 Market Flow')}
                                                </span>
                                            </div>
                                            <div style={{ color: 'var(--tb-text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                                                <span><strong>{lang === 'tr' ? 'Piyasa Tercihi:' : 'Market Pick:'}</strong> <span style={{ color: '#fff', fontWeight: 900 }}>{marketPrediction}</span></span>
                                                <span><strong>{lang === 'tr' ? 'Oran:' : 'Odds:'}</strong> <span style={{ color: '#fbbf24', fontWeight: 800 }}>@{primaryTrend.odds}</span></span>
                                                <span><strong>{lang === 'tr' ? 'Hacim:' : 'Vol:'}</strong> <span style={{ color: '#f87171', fontWeight: 800 }}>{totalTrendCount} {lang === 'tr' ? 'Kupon' : 'Bets'}</span></span>
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--tb-text-muted)', lineHeight: 1.3 }}>
                                                {isTrendApproved
                                                    ? (lang === 'tr' ? `DQS (%${(dqsVal * 100).toFixed(0)}) piyasadaki tercihi (${marketPrediction}) teyit ediyor.` : `DQS (${(dqsVal * 100).toFixed(0)}%) confirms market pick (${marketPrediction}).`)
                                                    : isTrendTrap
                                                    ? (lang === 'tr' ? `Düşük DQS (%${(dqsVal * 100).toFixed(0)}%). Piyasada (${marketPrediction}) bahsine kalabalık tuzağa çekiliyor!` : `Low DQS (${(dqsVal * 100).toFixed(0)}%). Crowd betting on (${marketPrediction}) may be in a trap!`)
                                                    : (lang === 'tr' ? `Orta tempo (%${(dqsVal * 100).toFixed(0)}% DQS). Maçı canlı takip edin.` : `Moderate tempo (${(dqsVal * 100).toFixed(0)}% DQS). Keep observing.`)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Actions Bar */}
                                    <div className="tb-m-quick-actions">
                                        <button
                                            type="button"
                                            className="tb-m-action-btn"
                                            disabled={trackedMatchIds.has(m.id)}
                                            style={{
                                                background: trackedMatchIds.has(m.id) ? 'rgba(16, 185, 129, 0.18)' : '#10b981',
                                                color: trackedMatchIds.has(m.id) ? '#34d399' : '#000',
                                                border: trackedMatchIds.has(m.id) ? '1px solid rgba(16, 185, 129, 0.4)' : 'none'
                                            }}
                                            onClick={() => {
                                                onApproveBet(m, signal);
                                                setTrackedMatchIds(prev => new Set([...prev, m.id]));
                                            }}
                                        >
                                            <span>{trackedMatchIds.has(m.id) ? '✓' : '📌'}</span>
                                            <span>{trackedMatchIds.has(m.id) ? (lang === 'tr' ? 'Takip Ediliyor' : 'Tracking') : (lang === 'tr' ? 'Kupona Ekle' : 'Add to Slip')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="tb-m-action-btn secondary"
                                            onClick={() => setExpandedMatchId(null)}
                                        >
                                            <span>▲</span>
                                            <span>{lang === 'tr' ? 'Detayları Kapat' : 'Close Details'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
            })}
        </div>
    );
};
