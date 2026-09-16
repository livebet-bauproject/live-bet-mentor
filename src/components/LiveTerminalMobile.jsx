import React, { useState } from 'react';
import { calculateMatchHeatScore, formatMarketPrediction } from '../logic/liveSortEngine';
import { consensusAdapter } from '../backend/consensusAdapter';
import { CONFIG } from '../config';

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
    hideInTableMode = false
}) => {
    const [expandedMatchId, setExpandedMatchId] = useState(null);

    const handleCardClick = (match, e) => {
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        setExpandedMatchId(prev => prev === match.id ? null : match.id);
        onSelectMatch(match);
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
        return label || 'BAHİS';
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
                const heatLevel = opp?.heatLevel || (heatScore >= 75 ? 'ALEV' : heatScore >= 50 ? 'SICAK' : 'SOGUK');
                const heatIcon = heatLevel === 'ALPHA' ? '🚀' : heatLevel === 'ALEV' ? '🔥' : heatLevel === 'SICAK' ? '⚡' : '❄️';

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
                                        title={isPinned ? 'Favorilerden Çıkar' : 'Favoriye Ekle'}
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
                                        className={`tb-heat-badge tb-heat-${(heatLevel || 'soguk').toLowerCase()}`}
                                        title={`Isı Skoru: ${heatScore} • Seviye: ${heatLevel}`}
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
                                    <span className="tb-m-stat-value">%{heat}</span>
                                </div>

                                {/* Column 2: ŞUT (İSB) */}
                                <div className="tb-m-stat-cell">
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'ŞUT (İSB)' : 'SOG'}</span>
                                    <span className="tb-m-stat-value">{sogHome} - {sogAway}</span>
                                </div>

                                {/* Column 3: T.ATAK */}
                                <div className={`tb-m-stat-cell ${daAlertClass}`}>
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'T.ATAK' : 'D.ATTACK'}</span>
                                    <span className="tb-m-stat-value">{daHome} - {daAway}</span>
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
                                {isLateOrFinished ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                        <span>DQS: {(m.dqs || 0).toFixed(2)}</span>
                                        <span className="tb-signal-badge tb-signal-pass" style={{ fontSize: '0.62rem', padding: '1px 5px', opacity: 0.6 }}>
                                            {minStr === 'MS' || minStr.includes('FT') ? 'MS' : 'KİLİTLİ (88+)'}
                                        </span>
                                    </div>
                                ) : isBetReady ? (
                                    <span className="tb-signal-badge tb-signal-bet" style={{ width: '100%', justifyContent: 'center' }}>
                                        ✓ {predDisplay}
                                    </span>
                                ) : isHot ? (
                                    <span className="tb-signal-badge tb-signal-hot" style={{ width: '100%', justifyContent: 'center' }}>
                                        🔥 {lang === 'tr' ? `ALEV BASKI (%${heat})` : `BURNING PRESSURE (%${heat})`}
                                    </span>
                                ) : (m.dqs || 0) >= (CONFIG?.DECISION?.DQS_THRESHOLD || 0.60) ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.7rem' }}>
                                        <span style={{ color: 'var(--tb-text-muted)' }}>
                                            AI DQS: <strong style={{ color: '#38bdf8' }}>{(m.dqs || 0).toFixed(2)}</strong>
                                        </span>
                                        <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.68rem' }}>
                                            ● {lang === 'tr' ? 'Tempolu' : 'Active'}
                                        </span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                        <span>DQS: {(m.dqs || 0).toFixed(2)}</span>
                                        <span className="tb-signal-badge tb-signal-pass" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                            {t?.verdict_pass || 'PAS'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Drawer on Click */}
                            {isExpanded && (
                                <div className="tb-m-drawer tb-action-ignore">
                                    {/* Momentum Graph */}
                                    {AttackMomentumGraph && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--tb-text-secondary)', marginBottom: '4px' }}>
                                                📈 Canlı Baskı Grafiği
                                            </div>
                                            <AttackMomentumGraph match={m} />
                                        </div>
                                    )}

                                    {/* Match Incidents Timeline */}
                                    {MatchIncidentsTimeline && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                                            <MatchIncidentsTimeline match={m} />
                                        </div>
                                    )}

                                    {/* AI Verdict Details */}
                                    {signal && (
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px', fontSize: '0.72rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#38bdf8' }}>
                                                    🎯 Yapay Zeka Stratejisi
                                                </span>
                                                {isBetReady && (
                                                    <span style={{ fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem' }}>
                                                        {predDisplay}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--tb-text-secondary)', lineHeight: 1.4 }}>
                                                {signal.reason || signal.mainReason || m.opportunityData?.reason || 'Sistem saha verilerini analiz ediyor.'}
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
                                        {isBetReady && bankrollManager && (
                                            <button
                                                type="button"
                                                className="tb-m-action-btn"
                                                style={{ background: '#10b981', color: '#000' }}
                                                onClick={() => onApproveBet(m, signal)}
                                            >
                                                <span>✓</span>
                                                <span>{t?.approve_bet || 'Bahsi Onayla'} ({bankrollManager.calculateRecommendedStake(m, signal)} ₺)</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="tb-m-action-btn secondary"
                                            onClick={() => onSelectMatch(m)}
                                        >
                                            <span>📊</span>
                                            <span>{lang === 'tr' ? 'Tüm Detaylar' : 'Full Details'}</span>
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
