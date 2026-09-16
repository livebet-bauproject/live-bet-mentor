import React, { useState } from 'react';

export const AttackMomentumGraph = ({
    points = [],
    homeTeam = 'Ev Sahibi',
    awayTeam = 'Deplasman',
    homeTeamLogo = null,
    awayTeamLogo = null,
    homeTeamId = null,
    awayTeamId = null,
    currentMinute = 90,
    status = null,
    incidents = [],
    height = 130,
    lang = 'tr',
    loading = false,
    noGraph = false
}) => {
    const [hoveredItem, setHoveredItem] = useState(null); // point or incident

    if (loading) {
        return (
            <div style={{
                padding: '1.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
                color: 'var(--accent-color)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}>
                <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🌀</span>
                <span>{lang === 'tr' ? 'SofaScore Attack Momentum verisi çekiliyor...' : 'Fetching SofaScore wave data...'}</span>
            </div>
        );
    }

    if (!Array.isArray(points) || points.length === 0) {
        return (
            <div style={{
                padding: '1.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.75rem'
            }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>{noGraph ? 'ℹ️' : '📈'}</div>
                <div>
                    {noGraph
                        ? (lang === 'tr' ? 'Bu lig/kupa maçı için SofaScore canlı dalga radarı bulunmuyor' : 'No live wave radar provided by SofaScore for this event')
                        : (lang === 'tr' ? 'Canlı Attack Momentum dalga verisi bekleniyor...' : 'Awaiting live Attack Momentum wave data...')
                    }
                </div>
            </div>
        );
    }

    // Maximum absolute value for vertical scaling (minimum 35 to avoid over-exaggerating tiny actions)
    const maxVal = Math.max(35, ...points.map(p => Math.abs(p.value || 0)));
    const totalMinutes = Math.max(90, points[points.length - 1]?.minute || 90);

    const svgWidth = 640;
    const svgHeight = height;
    const midY = svgHeight / 2;
    const barWidth = Math.max(2.2, (svgWidth / totalMinutes) - 1.2);

    // Calculate recent momentum (last 10 data points)
    const recentPoints = points.slice(-10);
    const recentHomeScore = recentPoints.reduce((acc, p) => acc + (p.value > 0 ? p.value : 0), 0);
    const recentAwayScore = recentPoints.reduce((acc, p) => acc + (p.value < 0 ? Math.abs(p.value) : 0), 0);
    const recentTotal = recentHomeScore + recentAwayScore || 1;
    const recentHomePct = Math.round((recentHomeScore / recentTotal) * 100);
    const recentAwayPct = 100 - recentHomePct;

    // Filter relevant incidents for graph pins (goals, cards, substitutions)
    const graphIncidents = (Array.isArray(incidents) ? incidents : []).filter(inc => {
        return (inc.incidentType === 'goal' || inc.incidentType === 'card' || inc.incidentType === 'substitution') && inc.time > 0;
    });

    const isLive = status?.type === 'inprogress' || (typeof status === 'string' && !status.toLowerCase().includes('ended') && !status.toLowerCase().includes('finished'));
    const liveX = currentMinute > 0 && currentMinute <= totalMinutes ? ((currentMinute - 1) / totalMinutes) * svgWidth : null;

    const renderTeamBadge = (isHome) => {
        const logoUrl = isHome
            ? (homeTeamLogo || (homeTeamId ? `https://img.sofascore.com/api/v1/team/${homeTeamId}/image` : null))
            : (awayTeamLogo || (awayTeamId ? `https://img.sofascore.com/api/v1/team/${awayTeamId}/image` : null));
        const name = isHome ? homeTeam : awayTeam;
        const color = isHome ? '#22c55e' : '#3b82f6';
        const initial = (name || '?').charAt(0).toUpperCase();

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '130px',
                maxWidth: '160px'
            }}>
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={name}
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            objectFit: 'contain',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px',
                            border: `1.5px solid ${color}`
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div
                    style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isHome ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: color,
                        display: logoUrl ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        border: `1.5px solid ${color}`
                    }}
                >
                    {initial}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{
                        color: '#f8fafc',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {name}
                    </span>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.6rem',
                        color: color,
                        fontWeight: 700
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                        <span>{isHome ? (lang === 'tr' ? 'Ev Sahibi' : 'Home') : (lang === 'tr' ? 'Deplasman' : 'Away')}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '1rem',
            position: 'relative'
        }}>
            {/* Header: Teams and Momentum Summary */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.8rem',
                flexWrap: 'wrap',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    {renderTeamBadge(true)}
                    <span style={{ opacity: 0.3, fontWeight: 900, fontSize: '0.8rem' }}>VS</span>
                    {renderTeamBadge(false)}
                </div>

                <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    color: recentHomePct > 60 ? '#22c55e' : recentAwayPct > 60 ? '#3b82f6' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span>⚡ {lang === 'tr' ? 'Son 10 Dk Baskı:' : 'Last 10m Momentum:'}</span>
                    <span style={{ color: '#22c55e' }}>%{recentHomePct}</span>
                    <span style={{ opacity: 0.3 }}>/</span>
                    <span style={{ color: '#3b82f6' }}>%{recentAwayPct}</span>
                </div>
            </div>

            {/* Hover Tooltip Indicator */}
            {hoveredItem && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '12px',
                    background: 'rgba(3, 7, 18, 0.95)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#fff',
                    zIndex: 20,
                    pointerEvents: 'none',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    {hoveredItem.isIncident ? (
                        <span>{hoveredItem.text}</span>
                    ) : (
                        <span>
                            ⏱️ {hoveredItem.minute}'. Dk — {hoveredItem.value > 0
                                ? `${homeTeam} (+${hoveredItem.value})`
                                : hoveredItem.value < 0
                                    ? `${awayTeam} (-${Math.abs(hoveredItem.value)})`
                                    : 'Dengeli Oyun'}
                        </span>
                    )}
                </div>
            )}

            {/* SVG Chart with Incident Markers */}
            <div style={{ width: '100%', overflowX: 'hidden', position: 'relative' }}>
                <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    style={{ width: '100%', height: `${height}px`, display: 'block' }}
                >
                    <defs>
                        {/* Home Gradient: SofaScore Green */}
                        <linearGradient id="sofaHomeGradient" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#15803d" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.95" />
                        </linearGradient>

                        {/* Away Gradient: SofaScore Blue */}
                        <linearGradient id="sofaAwayGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.95" />
                        </linearGradient>

                        {/* Filter for glowing incident pins */}
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#22c55e" floodOpacity="0.6" />
                        </filter>
                    </defs>

                    {/* Half Time Divider Line (45') */}
                    <line
                        x1={(45 / totalMinutes) * svgWidth}
                        y1="4"
                        x2={(45 / totalMinutes) * svgWidth}
                        y2={svgHeight - 4}
                        stroke="rgba(255, 255, 255, 0.25)"
                        strokeDasharray="3,3"
                        strokeWidth="1.2"
                    />
                    <text
                        x={(45 / totalMinutes) * svgWidth + 4}
                        y="12"
                        fill="rgba(255, 255, 255, 0.4)"
                        fontSize="9"
                        fontWeight="bold"
                    >
                        45'
                    </text>

                    {/* 15', 30', 60', 75' Grid Lines */}
                    {[15, 30, 60, 75].map(m => (
                        <line
                            key={m}
                            x1={(m / totalMinutes) * svgWidth}
                            y1="8"
                            x2={(m / totalMinutes) * svgWidth}
                            y2={svgHeight - 8}
                            stroke="rgba(255, 255, 255, 0.05)"
                            strokeDasharray="1,3"
                            strokeWidth="1"
                        />
                    ))}

                    {/* Neutral Center Zero Line */}
                    <line
                        x1="0"
                        y1={midY}
                        x2={svgWidth}
                        y2={midY}
                        stroke="rgba(255, 255, 255, 0.22)"
                        strokeWidth="1"
                    />

                    {/* Bars Rendering */}
                    {points.map((p) => {
                        const val = p.value || 0;
                        const x = ((p.minute - 1) / totalMinutes) * svgWidth;
                        const barHeight = (Math.abs(val) / maxVal) * (midY - 14);

                        const isHome = val > 0;
                        const y = isHome ? (midY - barHeight) : midY;
                        const fill = isHome ? 'url(#sofaHomeGradient)' : 'url(#sofaAwayGradient)';

                        return (
                            <rect
                                key={`bar-${p.minute}`}
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(1.8, barHeight)}
                                rx={1}
                                ry={1}
                                fill={fill}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'opacity 0.15s',
                                    opacity: hoveredItem?.minute === p.minute ? 1 : 0.85
                                }}
                                onMouseEnter={() => setHoveredItem(p)}
                                onMouseLeave={() => setHoveredItem(null)}
                            />
                        );
                    })}

                    {/* Live Match Cursor (Red dashed line with pulsing indicator) */}
                    {liveX !== null && isLive && (
                        <g>
                            <line
                                x1={liveX}
                                y1="0"
                                x2={liveX}
                                y2={svgHeight}
                                stroke="#ef4444"
                                strokeDasharray="3,2"
                                strokeWidth="1.5"
                                style={{ opacity: 0.85 }}
                            />
                            <circle
                                cx={liveX}
                                cy="6"
                                r="4"
                                fill="#ef4444"
                                style={{ animation: 'pulse 1.5s infinite' }}
                            />
                            <text
                                x={liveX > svgWidth - 40 ? liveX - 34 : liveX + 4}
                                y="18"
                                fill="#ef4444"
                                fontSize="8"
                                fontWeight="900"
                            >
                                {currentMinute}'
                            </text>
                        </g>
                    )}

                    {/* Incident Pins Overlaid on Graph (Goals, Cards, Substitutions) */}
                    {graphIncidents.map((inc, i) => {
                        const incX = ((inc.time - 0.5) / totalMinutes) * svgWidth;
                        const isHome = inc.isHome;
                        const isGoal = inc.incidentType === 'goal';
                        const isCard = inc.incidentType === 'card';
                        const isSub = inc.incidentType === 'substitution';

                        // Y placement: goals near top/bottom, cards closer to zero line
                        const pinY = isHome ? (isGoal ? 12 : 24) : (isGoal ? svgHeight - 12 : svgHeight - 24);

                        const playerName = inc.player?.shortName || inc.player?.name || inc.playerName || (isSub ? `${inc.playerIn?.shortName || ''} ⇄ ${inc.playerOut?.shortName || ''}` : '');
                        const tooltipText = isGoal
                            ? `⚽ ${inc.time}' Gol! ${playerName} (${isHome ? homeTeam : awayTeam})`
                            : isCard
                                ? `${inc.incidentClass === 'yellow' ? '🟨' : '🟥'} ${inc.time}' Kart: ${playerName}`
                                : `🔁 ${inc.time}' Değişiklik: ${playerName}`;

                        return (
                            <g
                                key={`inc-pin-${inc.id || i}`}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredItem({ isIncident: true, text: tooltipText })}
                                onMouseLeave={() => setHoveredItem(null)}
                            >
                                {isGoal && (
                                    <>
                                        <circle
                                            cx={incX}
                                            cy={pinY}
                                            r="7.5"
                                            fill={isHome ? '#22c55e' : '#3b82f6'}
                                            stroke="#fff"
                                            strokeWidth="1.2"
                                            filter="url(#glow)"
                                        />
                                        <text
                                            x={incX}
                                            y={pinY + 3.2}
                                            fontSize="9"
                                            textAnchor="middle"
                                        >
                                            ⚽
                                        </text>
                                    </>
                                )}

                                {isCard && (
                                    <rect
                                        x={incX - 4}
                                        y={pinY - 6}
                                        width="8"
                                        height="12"
                                        rx="1.5"
                                        fill={inc.incidentClass === 'yellow' ? '#facc15' : '#ef4444'}
                                        stroke="rgba(0,0,0,0.5)"
                                        strokeWidth="0.8"
                                    />
                                )}

                                {isSub && (
                                    <>
                                        <circle
                                            cx={incX}
                                            cy={pinY}
                                            r="6"
                                            fill="rgba(15, 23, 42, 0.85)"
                                            stroke={isHome ? '#22c55e' : '#3b82f6'}
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={incX}
                                            y={pinY + 2.8}
                                            fontSize="7"
                                            textAnchor="middle"
                                        >
                                            🔁
                                        </text>
                                    </>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Time Axis Labels */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.62rem',
                color: '#64748b',
                fontWeight: 800,
                marginTop: '6px',
                padding: '0 2px'
            }}>
                <span>0'</span>
                <span>15'</span>
                <span>30'</span>
                <span style={{ color: '#cbd5e1' }}>45' (İY)</span>
                <span>60'</span>
                <span>75'</span>
                <span>90'</span>
            </div>
        </div>
    );
};

export default AttackMomentumGraph;
