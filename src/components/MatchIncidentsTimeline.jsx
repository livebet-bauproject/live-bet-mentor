import React, { useState } from 'react';

export const MatchIncidentsTimeline = ({
    incidents = [],
    homeTeam = 'Ev Sahibi',
    awayTeam = 'Deplasman',
    homeTeamLogo = null,
    awayTeamLogo = null,
    currentScore = null,
    lang = 'tr',
    loading = false
}) => {
    const [filter, setFilter] = useState('ALL'); // 'ALL' or 'KEY' (Goals & Cards only)

    if (loading) {
        return (
            <div style={{
                padding: '1.2rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                color: 'var(--accent-color)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '1rem'
            }}>
                <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🌀</span>
                <span>{lang === 'tr' ? 'SofaScore maç olayları yükleniyor...' : 'Loading SofaScore match events...'}</span>
            </div>
        );
    }

    if (!Array.isArray(incidents) || incidents.length === 0) {
        return (
            <div style={{
                marginTop: '1rem',
                padding: '1.2rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.75rem'
            }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>⏱️</div>
                <div>
                    {lang === 'tr'
                        ? 'Bu karşılaşmada henüz önemli bir maç olayı (gol, kart, oyuncu değişikliği) kaydedilmedi.'
                        : 'No major match events (goals, cards, substitutions) recorded yet for this fixture.'}
                </div>
            </div>
        );
    }

    // Filter incidents if requested
    const filteredIncidents = incidents.filter(inc => {
        if (filter === 'KEY') {
            return inc.incidentType === 'goal' || inc.incidentType === 'card' || inc.incidentType === 'period';
        }
        return true;
    });

    // Helper: format minute string
    const formatMinute = (inc) => {
        const time = inc.time ?? 0;
        const added = inc.addedTime;
        if (added && added < 900) {
            return `${time}'+${added}`;
        }
        return `${time}'`;
    };

    const renderTeamLogo = (isHome, size = 18) => {
        const logo = isHome ? homeTeamLogo : awayTeamLogo;
        const name = isHome ? homeTeam : awayTeam;
        const initial = (name || '?').charAt(0).toUpperCase();

        if (logo) {
            return (
                <img
                    src={logo}
                    alt={name}
                    style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        objectFit: 'contain',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '1px',
                        border: `1px solid ${isHome ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                    }}
                    onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                />
            );
        }

        return (
            <span style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                background: isHome ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                color: isHome ? '#4ade80' : '#60a5fa',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: 900,
                border: `1px solid ${isHome ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
            }}>
                {initial}
            </span>
        );
    };

    return (
        <div style={{
            marginTop: '1.2rem',
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '1rem',
            overflow: 'hidden'
        }}>
            {/* Header: Title & Filter Toggle */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.8rem',
                paddingBottom: '0.6rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem' }}>⏱️</span>
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        letterSpacing: '0.5px',
                        color: 'var(--accent-color)',
                        textTransform: 'uppercase'
                    }}>
                        {lang === 'tr' ? 'MAÇ OLAYLARI (SOFASCORE TIMELINE)' : 'MATCH INCIDENTS (SOFASCORE TIMELINE)'}
                    </span>
                    <span style={{
                        fontSize: '0.6rem',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#94a3b8',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 700
                    }}>
                        {filteredIncidents.filter(i => i.incidentType !== 'period' && i.incidentType !== 'injuryTime').length}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setFilter('ALL')}
                        style={{
                            background: filter === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            color: filter === 'ALL' ? '#38bdf8' : '#94a3b8',
                            border: filter === 'ALL' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {lang === 'tr' ? 'Tümü' : 'All'}
                    </button>
                    <button
                        onClick={() => setFilter('KEY')}
                        style={{
                            background: filter === 'KEY' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            color: filter === 'KEY' ? '#38bdf8' : '#94a3b8',
                            border: filter === 'KEY' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {lang === 'tr' ? 'Goller & Kartlar' : 'Goals & Cards'}
                    </button>
                </div>
            </div>

            {/* Incidents Stream */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '380px',
                overflowY: 'auto',
                paddingRight: '4px'
            }}>
                {filteredIncidents.map((inc, idx) => {
                    const itype = inc.incidentType;
                    const isHome = inc.isHome;
                    const minStr = formatMinute(inc);

                    // 1. Period Dividers (FT, HT, ET)
                    if (itype === 'period') {
                        const periodLabel = inc.text === 'HT'
                            ? (lang === 'tr' ? 'DEVRE ARASI (İY)' : 'HALF TIME (HT)')
                            : inc.text === 'FT'
                                ? (lang === 'tr' ? 'MAÇ SONU (MS)' : 'FULL TIME (FT)')
                                : (inc.text || 'DÖNEM');

                        const scoreDisplay = inc.homeScore !== undefined && inc.awayScore !== undefined
                            ? `${inc.homeScore} - ${inc.awayScore}`
                            : (currentScore ? `${currentScore.home ?? 0} - ${currentScore.away ?? 0}` : '');

                        return (
                            <div
                                key={`period-${idx}`}
                                style={{
                                    margin: '0.5rem 0',
                                    padding: '4px 10px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.07)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    color: '#cbd5e1'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ opacity: 0.6 }}>🏁</span>
                                    <span>{periodLabel}</span>
                                </div>
                                {scoreDisplay && (
                                    <span style={{
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38bdf8',
                                        padding: '1px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 900
                                    }}>
                                        {scoreDisplay}
                                    </span>
                                )}
                            </div>
                        );
                    }

                    // 2. Injury Time Notification
                    if (itype === 'injuryTime') {
                        return (
                            <div
                                key={`inj-${idx}`}
                                style={{
                                    textAlign: 'center',
                                    fontSize: '0.62rem',
                                    color: '#94a3b8',
                                    opacity: 0.7,
                                    padding: '2px 0'
                                }}
                            >
                                ⏱️ +{inc.length || 1} {lang === 'tr' ? 'dakika uzatma eklendi' : 'minutes added time'}
                            </div>
                        );
                    }

                    // 3. Goals, Cards, Substitutions
                    const playerName = inc.player?.shortName || inc.player?.name || inc.playerName || '';
                    const playerIn = inc.playerIn?.shortName || inc.playerIn?.name || '';
                    const playerOut = inc.playerOut?.shortName || inc.playerOut?.name || '';
                    const assistName = inc.assist1?.shortName || inc.assist1?.name;

                    const isGoal = itype === 'goal';
                    const isCard = itype === 'card';
                    const isSub = itype === 'substitution';

                    const cardClass = inc.incidentClass; // 'yellow', 'red', 'yellowRed'

                    // Row background & styling
                    const teamColor = isHome ? '#22c55e' : '#3b82f6';
                    const rowBg = isGoal
                        ? (isHome ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)')
                        : 'rgba(255, 255, 255, 0.02)';
                    const rowBorder = isGoal
                        ? (isHome ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)')
                        : '1px solid rgba(255, 255, 255, 0.04)';

                    return (
                        <div
                            key={inc.id || idx}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: isHome ? '42px 1fr' : '1fr 42px',
                                gap: '8px',
                                alignItems: 'center',
                                padding: '6px 10px',
                                background: rowBg,
                                border: rowBorder,
                                borderRadius: '8px',
                                transition: 'background 0.2s',
                                borderLeft: isHome ? `3px solid ${teamColor}` : undefined,
                                borderRight: !isHome ? `3px solid ${teamColor}` : undefined
                            }}
                        >
                            {/* Minute Column (Left if Home, Right if Away) */}
                            {isHome && (
                                <div style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 900,
                                    color: isGoal ? '#4ade80' : '#94a3b8',
                                    textAlign: 'left'
                                }}>
                                    {minStr}
                                </div>
                            )}

                            {/* Event Details */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                justifyContent: isHome ? 'flex-start' : 'flex-end',
                                textAlign: isHome ? 'left' : 'right',
                                flexWrap: 'wrap'
                            }}>
                                {!isHome && renderTeamLogo(false, 16)}

                                {/* Event Icon & Badge */}
                                {isGoal && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {inc.homeScore !== undefined && inc.awayScore !== undefined && (
                                            <span style={{
                                                background: isHome ? '#22c55e' : '#3b82f6',
                                                color: '#fff',
                                                fontSize: '0.65rem',
                                                fontWeight: 900,
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                {inc.homeScore} - {inc.awayScore}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.9rem' }}>⚽</span>
                                        <div>
                                            <span style={{ fontWeight: 800, fontSize: '0.72rem', color: '#fff' }}>
                                                {playerName}
                                            </span>
                                            {inc.incidentClass === 'penalty' && (
                                                <span style={{ fontSize: '0.6rem', color: '#fbbf24', marginLeft: '4px' }}>(P)</span>
                                            )}
                                            {inc.incidentClass === 'ownGoal' && (
                                                <span style={{ fontSize: '0.6rem', color: '#f43f5e', marginLeft: '4px' }}>(K.K.)</span>
                                            )}
                                            {assistName && (
                                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', opacity: 0.8 }}>
                                                    {lang === 'tr' ? 'Asist:' : 'Assist:'} {assistName}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isCard && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            width: '9px',
                                            height: '13px',
                                            borderRadius: '2px',
                                            background: cardClass === 'yellow' ? '#facc15' : '#ef4444',
                                            boxShadow: cardClass === 'yellow' ? '0 0 6px rgba(250, 204, 21, 0.5)' : '0 0 6px rgba(239, 68, 68, 0.5)'
                                        }} />
                                        <div>
                                            <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#f1f5f9' }}>
                                                {playerName}
                                            </span>
                                            {inc.reason && (
                                                <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: '4px', opacity: 0.7 }}>
                                                    ({inc.reason})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isSub && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.68rem',
                                        flexDirection: isHome ? 'row' : 'row-reverse'
                                    }}>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>🔁</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <span style={{ color: '#4ade80', fontWeight: 700 }}>
                                                ⬆️ {playerIn}
                                            </span>
                                            <span style={{ color: '#94a3b8', opacity: 0.65, fontSize: '0.62rem' }}>
                                                ⬇️ {playerOut}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {isHome && renderTeamLogo(true, 16)}
                            </div>

                            {/* Minute Column (Right if Away) */}
                            {!isHome && (
                                <div style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 900,
                                    color: isGoal ? '#60a5fa' : '#94a3b8',
                                    textAlign: 'right'
                                }}>
                                    {minStr}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MatchIncidentsTimeline;
