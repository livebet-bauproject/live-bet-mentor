import React, { useState } from 'react';
import { calculateMatchHeatScore } from '../logic/liveSortEngine';
import { CONFIG } from '../config';

export const LiveTerminalTable = ({
    matches = [],
    signals = {},
    t = {},
    lang = 'tr',
    selectedMatch = null,
    onSelectMatch = () => {},
    onApproveBet = () => {},
    bankrollManager = null,
    pinnedMatchIds = new Set(),
    togglePinMatch = () => {},
    AttackMomentumGraph = null,
    MatchIncidentsTimeline = null
}) => {
    const [expandedMatchId, setExpandedMatchId] = useState(null);

    const handleRowClick = (match, e) => {
        // Prevent accordion trigger when clicking buttons or links
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        setExpandedMatchId(prev => prev === match.id ? null : match.id);
        onSelectMatch(match);
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

    return (
        <div className="tb-terminal-wrapper">
            <table className="tb-table">
                <thead>
                    <tr>
                        <th style={{ width: '32px', textAlign: 'center' }}>★</th>
                        <th style={{ width: '55px' }}>{t?.minute_short || 'DK'}</th>
                        <th style={{ width: '110px' }}>{t?.league_label || 'LİG'}</th>
                        <th>{t?.match_label || 'MAÇ'}</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>{t?.score_label || 'SKOR'}</th>
                        <th style={{ width: '85px', textAlign: 'center' }}>1X2 CANLI</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>BASKI / IVME</th>
                        <th style={{ width: '70px', textAlign: 'center' }}>ŞUT (ISB)</th>
                        <th style={{ width: '70px', textAlign: 'center' }}>T.ATAK</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>xG</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>AI SİNYAL</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>DETAY</th>
                    </tr>
                </thead>
                <tbody>
                    {matches.length === 0 ? (
                        <tr>
                            <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--tb-text-muted)' }}>
                                {lang === 'tr' ? 'Seçili kriterlere uygun canlı maç bulunamadı.' : 'No live matches matching current criteria.'}
                            </td>
                        </tr>
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
                            const yellowHome = Number(m.cards?.home?.yellow || m.stats?.cards?.home?.yellow || 0);
                            const yellowAway = Number(m.cards?.away?.yellow || m.stats?.cards?.away?.yellow || 0);

                            // Odds
                            const oddsHome = m.odds?.home || m.liveOdds?.home || '-';
                            const oddsDraw = m.odds?.draw || m.liveOdds?.draw || '-';
                            const oddsAway = m.odds?.away || m.liveOdds?.away || '-';

                            // Stat coloring logic: Only highlight if significant divergence (Color Discipline)
                            const daAlertClass = daDiff >= 20 ? 'alert-red' : daDiff >= 12 ? 'alert-amber' : 'neutral';
                            const heatAlertClass = heat >= 75 ? 'alert-red' : heat >= 55 ? 'alert-amber' : 'neutral';

                            return (
                                <React.Fragment key={m.id}>
                                    <tr
                                        className={`tb-row ${isExpanded ? 'expanded' : ''}`}
                                        onClick={(e) => handleRowClick(m, e)}
                                    >
                                        {/* Pin / Star */}
                                        <td style={{ textAlign: 'center' }} className="tb-action-ignore">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: isPinned ? '#facc15' : 'rgba(255,255,255,0.2)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                                title={isPinned ? 'Favorilerden Çıkar' : 'Favoriye Ekle'}
                                            >
                                                ★
                                            </button>
                                        </td>

                                        {/* Minute */}
                                        <td className="tb-col-min">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="tb-pulse-dot" />
                                                {formatMinute(m.minute)}
                                            </span>
                                        </td>

                                        {/* League */}
                                        <td className="tb-col-league" title={m.league || m.leagueName || 'League'}>
                                            <span style={{ opacity: 0.6, marginRight: '3px' }}>T{m.tier || 1}</span>
                                            {m.league || m.leagueName || 'Futbol'}
                                        </td>

                                        {/* Teams */}
                                        <td>
                                            <div className="tb-col-match">
                                                <span className="tb-team-name" style={{ textAlign: 'right', flex: 1 }}>
                                                    {m.homeTeam}
                                                </span>

                                                {/* Home Cards */}
                                                {redHome > 0 && <span className="tb-card-badge tb-card-red">{redHome}</span>}
                                                {yellowHome > 0 && <span className="tb-card-badge tb-card-yellow">{yellowHome}</span>}

                                                <span style={{ color: 'var(--tb-text-muted)', fontSize: '0.72rem' }}>vs</span>

                                                {/* Away Cards */}
                                                {yellowAway > 0 && <span className="tb-card-badge tb-card-yellow">{yellowAway}</span>}
                                                {redAway > 0 && <span className="tb-card-badge tb-card-red">{redAway}</span>}

                                                <span className="tb-team-name" style={{ textAlign: 'left', flex: 1 }}>
                                                    {m.awayTeam}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Score */}
                                        <td className="tb-col-score">
                                            {formatScore(m.score)}
                                        </td>

                                        {/* 1X2 Odds */}
                                        <td className="tb-stat-cell" style={{ fontSize: '0.72rem' }}>
                                            {oddsHome !== '-' ? (
                                                <span>{oddsHome} / {oddsDraw} / {oddsAway}</span>
                                            ) : (
                                                <span style={{ color: 'var(--tb-text-muted)' }}>-</span>
                                            )}
                                        </td>

                                        {/* Pressure / Momentum Index */}
                                        <td className="tb-stat-cell">
                                            <span className={`tb-pill-stat ${heatAlertClass}`}>
                                                %{heat}
                                            </span>
                                        </td>

                                        {/* Shots on Goal */}
                                        <td className="tb-stat-cell">
                                            <span>{sogHome} - {sogAway}</span>
                                        </td>

                                        {/* Dangerous Attacks */}
                                        <td className="tb-stat-cell">
                                            <span className={`tb-pill-stat ${daAlertClass}`}>
                                                {daHome} - {daAway}
                                            </span>
                                        </td>

                                        {/* xG */}
                                        <td className="tb-stat-cell">
                                            {(xgHome > 0 || xgAway > 0) ? (
                                                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                                    {xgHome.toFixed(2)} - {xgAway.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--tb-text-muted)' }}>-</span>
                                            )}
                                        </td>

                                        {/* AI Signal */}
                                        <td style={{ textAlign: 'center' }}>
                                            {signal?.verdict === 'BET' ? (
                                                <span className="tb-signal-badge tb-signal-bet">
                                                    ✓ {signal.prediction || 'BAHİS'}
                                                </span>
                                            ) : heat >= 75 ? (
                                                <span className="tb-signal-badge tb-signal-hot">
                                                    🔥 ALEV
                                                </span>
                                            ) : (m.dqs || 0) >= (CONFIG?.DECISION?.DQS_THRESHOLD || 0.60) ? (
                                                <span className="tb-signal-badge tb-signal-pass" style={{ color: '#38bdf8' }}>
                                                    DQS {(m.dqs || 0).toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="tb-signal-badge tb-signal-pass">
                                                    {t?.verdict_pass || 'PAS'}
                                                </span>
                                            )}
                                        </td>

                                        {/* Detail Expand Arrow */}
                                        <td style={{ textAlign: 'center', color: 'var(--tb-text-muted)' }}>
                                            <span style={{ fontSize: '0.8rem', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                                ▼
                                            </span>
                                        </td>
                                    </tr>

                                    {/* Inline Accordion Detail Tray */}
                                    {isExpanded && (
                                        <tr className="tb-expanded-row">
                                            <td colSpan={12}>
                                                <div className="tb-expanded-content">
                                                    {/* Left: Momentum Graph & Timeline */}
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--tb-text-secondary)' }}>
                                                                📈 {lang === 'tr' ? 'CANLI BASKI GRAFİĞİ' : 'LIVE MOMENTUM GRAPH'}
                                                            </span>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--tb-text-muted)' }}>
                                                                DQS: {(m.dqs || 0).toFixed(2)} | Tier: {m.tier || 1}
                                                            </span>
                                                        </div>
                                                        {AttackMomentumGraph && (
                                                            <AttackMomentumGraph match={m} />
                                                        )}
                                                    </div>

                                                    {/* Right: Quick Action & Signal Card */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between' }}>
                                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--tb-border)' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.4rem', color: '#38bdf8' }}>
                                                                🎯 {lang === 'tr' ? 'YAPAY ZEKA ANALİZİ' : 'AI MATCH CONVICTION'}
                                                            </div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--tb-text-secondary)', lineHeight: 1.4 }}>
                                                                {signal?.mainReason || (lang === 'tr' ? 'Maç istatistiksel olarak radar altında izleniyor.' : 'Match is actively tracked under live radar.')}
                                                            </div>
                                                        </div>

                                                        {signal?.verdict === 'BET' && bankrollManager && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="tb-action-ignore">
                                                                <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#34d399', display: 'block' }}>{t?.recom_stake_short || 'Önerilen Kasa'}</span>
                                                                    <span style={{ fontWeight: 900, color: '#f1f5f9', fontSize: '0.9rem' }}>
                                                                        {bankrollManager.calculateRecommendedStake(m, signal)} ₺
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onApproveBet(m, signal)}
                                                                    style={{
                                                                        background: '#10b981',
                                                                        color: '#000',
                                                                        border: 'none',
                                                                        padding: '0.75rem 1.25rem',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 900,
                                                                        fontSize: '0.78rem',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {t?.approve_bet || 'BAHSİ ONAYLA'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};
