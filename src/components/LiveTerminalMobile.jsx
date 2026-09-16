import React, { useState } from 'react';
import { calculateMatchHeatScore } from '../logic/liveSortEngine';
import { consensusAdapter } from '../backend/consensusAdapter';
import { CONFIG } from '../config';

export const LiveTerminalMobile = ({
    matches = [],
    signals = {},
    trendingBets = [],
    t = {},
    lang = 'tr',
    selectedMatch = null,
    onSelectMatch = () => {},
    onApproveBet = () => {},
    bankrollManager = null,
    pinnedMatchIds = new Set(),
    togglePinMatch = () => {},
    AttackMomentumGraph = null
}) => {
    const [expandedMatchId, setExpandedMatchId] = useState(null);

    const handleCardClick = (match, e) => {
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        setExpandedMatchId(prev => prev === match.id ? null : match.id);
    };

    const formatScore = (score) => {
        if (!score && score !== 0) return '0 - 0';
        if (typeof score === 'object') {
            return `${score.home ?? 0} - ${score.away ?? 0}`;
        }
        return String(score).replace(':', ' - ');
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
        const strat = signal.activeStrategies?.[0];
        let label = strat?.label || signal.prediction || m.opportunityData?.suggestedMarket?.label;
        if (!label && signal.reason && !signal.reason.includes('Kriterlere') && !signal.reason.includes('Strateji')) {
            label = signal.reason;
        }
        return label || 'BAHİS';
    };

    return (
        <div className="tb-mobile-stream">
            {matches.length === 0 ? (
                <div style={{
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
            ) : (
                matches.map(m => {
                    const isExpanded = expandedMatchId === m.id;
                    const signal = signals[m.id];
                    const isPinned = pinnedMatchIds.has(m.id);
                    const heat = calculateMatchHeatScore(m, signal);

                    const sogHome = m.stats?.shotsOnGoal?.home || 0;
                    const sogAway = m.stats?.shotsOnGoal?.away || 0;
                    const daHome = m.stats?.dangerousAttacks?.home || 0;
                    const daAway = m.stats?.dangerousAttacks?.away || 0;
                    const daDiff = Math.abs(daHome - daAway);
                    const xgHome = Number(m.stats?.xg?.home || 0);
                    const xgAway = Number(m.stats?.xg?.away || 0);

                    const redHome = Number(m.cards?.home?.red || m.stats?.cards?.home?.red || 0);
                    const redAway = Number(m.cards?.away?.red || m.stats?.cards?.away?.red || 0);

                    const isBetReady = signal?.verdict === 'BET';
                    const isHot = heat >= 75;

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

                    return (
                        <div
                            key={m.id}
                            className={`tb-mobile-card ${isBetReady ? 'bet-border' : isHot ? 'hot-border' : ''}`}
                            onClick={(e) => handleCardClick(m, e)}
                        >
                            {/* Line 1: Meta, Minute, League & Score */}
                            <div className="tb-m-row-1">
                                <div className="tb-m-min-league">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: isPinned ? '#facc15' : 'rgba(255,255,255,0.2)',
                                            fontSize: '0.75rem',
                                            padding: 0,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ★
                                    </button>
                                    <span className="tb-m-min">
                                        <span className="tb-pulse-dot" style={{ display: 'inline-block', marginRight: '3px' }} />
                                        {formatMinute(m.minute)}
                                    </span>
                                    <span className="tb-m-league">
                                        {m.league || m.leagueName || 'Futbol'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {heat >= 60 && (
                                        <span className={`tb-m-heat-pill ${heat >= 75 ? 'tb-pill-stat alert-red' : 'tb-pill-stat alert-amber'}`}>
                                            🔥 %{heat}
                                        </span>
                                    )}
                                    <span className="tb-m-score">
                                        {formatScore(m.score)}
                                    </span>
                                </div>
                            </div>

                            {/* Line 2: Teams */}
                            <div className="tb-m-row-2">
                                <div className="tb-m-teams">
                                    <span style={{ fontWeight: 700, color: 'var(--tb-text-primary)' }}>{m.homeTeam}</span>
                                    {redHome > 0 && <span className="tb-card-badge tb-card-red">{redHome}</span>}
                                    <span className="vs">-</span>
                                    <span style={{ fontWeight: 700, color: 'var(--tb-text-primary)' }}>{m.awayTeam}</span>
                                    {redAway > 0 && <span className="tb-card-badge tb-card-red">{redAway}</span>}
                                </div>
                                {hasTrend && (
                                    <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center' }}>
                                        <span
                                            className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}
                                            style={{ fontSize: '0.62rem', padding: '1px 5px' }}
                                        >
                                            <span>{isTrendApproved ? '🟢' : isTrendTrap ? '🔴' : '📊'}</span>
                                            <span>{isTrendApproved ? (lang === 'tr' ? 'AKILLI PARA' : 'SMART MONEY') : isTrendTrap ? (lang === 'tr' ? 'TUZAK' : 'TRAP') : (lang === 'tr' ? 'PİYASA' : 'MARKET')}</span>
                                            <span style={{ opacity: 0.85 }}>• {totalTrendCount} {lang === 'tr' ? 'Kupon' : 'Bets'}</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Line 3: Compact Stats & Sinyal Badge */}
                            <div className="tb-m-row-3">
                                <div className="tb-m-stats-cluster">
                                    <span title="İsabetli Şut">🎯 {sogHome}-{sogAway}</span>
                                    <span title="Tehlikeli Atak" style={{ color: daDiff >= 15 ? '#f87171' : 'inherit' }}>
                                        ⚡ {daHome}-{daAway}
                                    </span>
                                    {(xgHome > 0 || xgAway > 0) && (
                                        <span style={{ color: '#fbbf24' }}>
                                            xG {xgHome.toFixed(1)}-{xgAway.toFixed(1)}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    {isBetReady ? (
                                        <span className="tb-signal-badge tb-signal-bet" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                            ✓ {getPredictionDisplay(m, signal)}
                                        </span>
                                    ) : isHot ? (
                                        <span className="tb-signal-badge tb-signal-hot" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                            🔥 ALEV
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--tb-text-muted)' }}>
                                            DQS {(m.dqs || 0).toFixed(2)}
                                        </span>
                                    )}
                                </div>
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

                                    {/* AI Verdict Details */}
                                    {signal && (
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px', fontSize: '0.72rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#38bdf8' }}>
                                                    🎯 Yapay Zeka Stratejisi
                                                </span>
                                                {isBetReady && (
                                                    <span style={{ fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem' }}>
                                                        {getPredictionDisplay(m, signal)}
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
                                                    📈 {lang === 'tr' ? 'Avrupa Piyasa Akışı' : 'Market Flow'}
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
                                                <span><strong>{lang === 'tr' ? 'Oyun:' : 'Bet:'}</strong> {primaryTrend.market} {primaryTrend.outcome} (@{primaryTrend.odds})</span>
                                                <span><strong>{lang === 'tr' ? 'Hacim:' : 'Vol:'}</strong> {totalTrendCount} {lang === 'tr' ? 'Kupon' : 'Bets'}</span>
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--tb-text-muted)', lineHeight: 1.3 }}>
                                                {isTrendApproved
                                                    ? (lang === 'tr' ? `DQS (%${(dqsVal * 100).toFixed(0)}) halk akışını teyit ediyor.` : `DQS (${(dqsVal * 100).toFixed(0)}%) confirms crowd betting.`)
                                                    : isTrendTrap
                                                    ? (lang === 'tr' ? `Düşük DQS (%${(dqsVal * 100).toFixed(0)}%). Kalabalık tuzağa çekiliyor!` : `Low DQS (${(dqsVal * 100).toFixed(0)}%). Crowd may be walking into a trap!`)
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
                })
            )}
        </div>
    );
};
