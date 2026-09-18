import React, { useState, useEffect } from 'react';
import { sofaScoreAdapter } from '../backend/sofaScoreAdapter';
import { calculateLast20MinMetrics } from '../logic/liveSortEngine';

const graphCache = new Map();
const incidentsCache = new Map();

export const AttackMomentumGraph = ({
    match = null,
    points: propPoints = null,
    homeTeam: propHomeTeam = null,
    awayTeam: propAwayTeam = null,
    homeTeamLogo: propHomeTeamLogo = null,
    awayTeamLogo: propAwayTeamLogo = null,
    homeTeamId: propHomeTeamId = null,
    awayTeamId: propAwayTeamId = null,
    currentMinute: propCurrentMinute = null,
    status: propStatus = null,
    incidents: propIncidents = null,
    height = 130,
    lang = 'tr',
    loading: propLoading = null,
    noGraph: propNoGraph = false
}) => {
    const matchId = match?.id;
    const homeTeam = propHomeTeam || (typeof match?.homeTeam === 'object' ? match?.homeTeam?.name : match?.homeTeam) || (lang === 'tr' ? 'Ev Sahibi' : (lang === 'de' ? 'Heim' : 'Home'));
    const awayTeam = propAwayTeam || (typeof match?.awayTeam === 'object' ? match?.awayTeam?.name : match?.awayTeam) || (lang === 'tr' ? 'Deplasman' : (lang === 'de' ? 'Auswärts' : 'Away'));
    const homeTeamId = propHomeTeamId ?? match?.homeTeamId ?? (typeof match?.homeTeam === 'object' ? match?.homeTeam?.id : null);
    const awayTeamId = propAwayTeamId ?? match?.awayTeamId ?? (typeof match?.awayTeam === 'object' ? match?.awayTeam?.id : null);
    const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'https://live-bet-mentor.onrender.com';
    const homeTeamLogo = propHomeTeamLogo || match?.homeTeamLogo || (homeTeamId ? `${apiBase}/api/team/${homeTeamId}/image` : null);
    const awayTeamLogo = propAwayTeamLogo || match?.awayTeamLogo || (awayTeamId ? `${apiBase}/api/team/${awayTeamId}/image` : null);
    const currentMinute = propCurrentMinute ?? (parseInt(match?.minute) || 90);
    const status = propStatus || match?.status;

    const [fetchedPoints, setFetchedPoints] = useState(() => {
        if (propPoints !== null && propPoints !== undefined) return propPoints;
        if (matchId && graphCache.has(matchId)) return graphCache.get(matchId).points || [];
        return [];
    });
    const [fetchedIncidents, setFetchedIncidents] = useState(() => {
        if (propIncidents !== null && propIncidents !== undefined) return propIncidents;
        if (matchId && incidentsCache.has(matchId)) return incidentsCache.get(matchId).incidents || [];
        return [];
    });
    const [loading, setLoading] = useState(() => {
        if (propLoading !== null) return propLoading;
        if (propPoints !== null && propPoints !== undefined) return false;
        if (matchId && graphCache.has(matchId)) return false;
        return Boolean(matchId);
    });
    const [noGraph, setNoGraph] = useState(() => {
        if (propNoGraph) return true;
        if (matchId && graphCache.has(matchId)) return Boolean(graphCache.get(matchId).noGraph);
        return false;
    });

    const [hoveredItem, setHoveredItem] = useState(null); // point or incident

    useEffect(() => {
        if (propPoints !== null && propPoints !== undefined) {
            setFetchedPoints(propPoints);
            setLoading(false);
            return;
        }

        if (!matchId) return;

        let isCancelled = false;
        const now = Date.now();

        // 1. Check cache
        const cachedGraph = graphCache.get(matchId);
        if (cachedGraph && (now - cachedGraph.time < 60000)) {
            setFetchedPoints(cachedGraph.points || []);
            setNoGraph(Boolean(cachedGraph.noGraph));
            setLoading(false);
        } else {
            setLoading(true);
            setNoGraph(false);

            sofaScoreAdapter.fetchEventGraph(matchId).then(res => {
                if (isCancelled) return;
                const pts = res?.graphPoints || (Array.isArray(res) ? res : []);
                if (pts.length > 0) {
                    setFetchedPoints(pts);
                    setNoGraph(false);
                    graphCache.set(matchId, { time: Date.now(), points: pts, noGraph: false });
                } else if (res?.noGraph) {
                    setFetchedPoints([]);
                    setNoGraph(true);
                    graphCache.set(matchId, { time: Date.now(), points: [], noGraph: true });
                } else {
                    setFetchedPoints([]);
                    setNoGraph(true);
                    graphCache.set(matchId, { time: Date.now(), points: [], noGraph: true });
                }
                setLoading(false);
            }).catch(() => {
                if (!isCancelled) {
                    setLoading(false);
                    setNoGraph(true);
                }
            });
        }

        // Fetch incidents if not provided
        if (propIncidents === null || propIncidents === undefined) {
            const cachedIncs = incidentsCache.get(matchId);
            if (cachedIncs && (now - cachedIncs.time < 60000)) {
                setFetchedIncidents(cachedIncs.incidents || []);
            } else {
                sofaScoreAdapter.fetchEventIncidents(matchId).then(incs => {
                    if (isCancelled) return;
                    const list = Array.isArray(incs) ? incs : [];
                    setFetchedIncidents(list);
                    incidentsCache.set(matchId, { time: Date.now(), incidents: list });
                }).catch(() => {});
            }
        }

        return () => {
            isCancelled = true;
        };
    }, [matchId, propPoints, propIncidents]);

    const points = propPoints !== null && propPoints !== undefined ? propPoints : fetchedPoints;
    const incidents = propIncidents !== null && propIncidents !== undefined ? propIncidents : fetchedIncidents;
    const isLoading = propLoading !== null ? propLoading : loading;
    const hasNoGraph = propNoGraph || noGraph;

    if (isLoading) {
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
                <span>{lang === 'tr' ? 'Canlı Baskı Radarı verisi çekiliyor...' : (lang === 'de' ? 'Lade Live-Druckradar-Daten...' : 'Fetching Live Pressure Radar data...')}</span>
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
                <div style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>{hasNoGraph ? 'ℹ️' : '📈'}</div>
                <div>
                    {hasNoGraph
                        ? (lang === 'tr' ? 'Bu lig/kupa maçı için canlı baskı radarı bulunmuyor' : (lang === 'de' ? 'Live-Druckwellenradar für dieses Spiel nicht verfügbar' : 'Live pressure wave radar not available for this event'))
                        : (lang === 'tr' ? 'Canlı Attack Momentum dalga verisi bekleniyor...' : (lang === 'de' ? 'Warte auf Live-Angriffsmomentum-Wellen...' : 'Awaiting live Attack Momentum wave data...'))
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

    // Calculate 20-minute momentum (last 20 data points)
    const points20 = points.slice(-20);
    const homeScore20 = points20.reduce((acc, p) => acc + (p.value > 0 ? p.value : 0), 0);
    const awayScore20 = points20.reduce((acc, p) => acc + (p.value < 0 ? Math.abs(p.value) : 0), 0);
    const total20 = homeScore20 + awayScore20 || 1;
    const homePct20 = Math.round((homeScore20 / total20) * 100);
    const awayPct20 = 100 - homePct20;

    // Match 20m surge metrics (delta attacks & shots)
    const last20Metrics = match ? calculateLast20MinMetrics(match) : null;

    // Filter relevant incidents for graph pins (goals, cards, substitutions)
    const graphIncidents = (Array.isArray(incidents) ? incidents : []).filter(inc => {
        return (inc.incidentType === 'goal' || inc.incidentType === 'card' || inc.incidentType === 'substitution') && inc.time > 0;
    });

    const isLive = status?.type === 'inprogress' || (typeof status === 'string' && !status.toLowerCase().includes('ended') && !status.toLowerCase().includes('finished'));
    const liveX = currentMinute > 0 && currentMinute <= totalMinutes ? ((currentMinute - 1) / totalMinutes) * svgWidth : null;

    const renderTeamBadge = (isHome) => {
        const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'https://live-bet-mentor.onrender.com';
        const logoUrl = isHome
            ? (homeTeamLogo || (homeTeamId ? `${apiBase}/api/team/${homeTeamId}/image` : null))
            : (awayTeamLogo || (awayTeamId ? `${apiBase}/api/team/${awayTeamId}/image` : null));
        const name = isHome ? homeTeam : awayTeam;
        const color = isHome ? '#22c55e' : '#3b82f6';
        const initial = (name || '?').charAt(0).toUpperCase();

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
                flex: '1 1 auto',
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
                        <span>{isHome ? (lang === 'tr' ? 'Ev Sahibi' : (lang === 'de' ? 'Heim' : 'Home')) : (lang === 'tr' ? 'Deplasman' : (lang === 'de' ? 'Auswärts' : 'Away'))}</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 auto', minWidth: 0 }}>
                    {renderTeamBadge(true)}
                    <span style={{ opacity: 0.3, fontWeight: 900, fontSize: '0.75rem', flexShrink: 0 }}>VS</span>
                    {renderTeamBadge(false)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Son 10 Dk Rozeti */}
                    <div style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        background: recentHomePct >= 65 ? 'rgba(34, 197, 94, 0.12)' : (recentAwayPct >= 65 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)'),
                        border: recentHomePct >= 65 ? '1px solid rgba(34, 197, 94, 0.3)' : (recentAwayPct >= 65 ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)'),
                        padding: '3px 8px',
                        borderRadius: '7px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }} title={lang === 'tr' ? 'Son 10 dakikadaki anlık atak dalgası ve baskı dağılımı' : (lang === 'de' ? 'Angriffswellen- und Druckverteilung der letzten 10 Minuten' : 'Last 10-minute wave momentum distribution')}>
                        <span style={{ color: '#fbbf24' }}>⚡ {lang === 'tr' ? "Son 10'" : (lang === 'de' ? "Letzte 10'" : "Last 10m")}:</span>
                        <span style={{ color: '#22c55e' }}>%{recentHomePct}</span>
                        <span style={{ opacity: 0.3 }}>/</span>
                        <span style={{ color: '#3b82f6' }}>%{recentAwayPct}</span>
                    </div>

                    {/* Son 20 Dk Rozeti */}
                    <div style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        background: homePct20 >= 60 ? 'rgba(34, 197, 94, 0.12)' : (awayPct20 >= 60 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)'),
                        border: homePct20 >= 60 ? '1px solid rgba(34, 197, 94, 0.3)' : (awayPct20 >= 60 ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)'),
                        padding: '3px 8px',
                        borderRadius: '7px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }} title={last20Metrics ? (lang === 'tr' ? `${last20Metrics.dominantTeam ? `${last20Metrics.dominantTeam} baskı kuruyor.` : 'Yüksek hücum temposu.'} (Son 20 Dk: +${last20Metrics.deltaDA} Tehlikeli Atak, +${last20Metrics.deltaShots} Şut)` : (lang === 'de' ? `${last20Metrics.dominantTeam ? `${last20Metrics.dominantTeam} baut Dauerdruck auf.` : 'Hohes Angriffstempo.'} (Letzte 20 Min: +${last20Metrics.deltaDA} gefährliche Angriffe, +${last20Metrics.deltaShots} Schüsse)` : `${last20Metrics.dominantTeam ? `${last20Metrics.dominantTeam} applying pressure.` : 'High attacking tempo.'} (Last 20m: +${last20Metrics.deltaDA} Dangerous Attacks, +${last20Metrics.deltaShots} Shots)`)) : ''}>
                        <span style={{ color: '#f59e0b' }}>⏱️ {lang === 'tr' ? "Son 20'" : (lang === 'de' ? "Letzte 20'" : "Last 20m")}:</span>
                        <span style={{ color: '#22c55e' }}>%{homePct20}</span>
                        <span style={{ opacity: 0.3 }}>/</span>
                        <span style={{ color: '#3b82f6' }}>%{awayPct20}</span>
                        {last20Metrics?.deltaDA > 0 && (
                            <span style={{ color: '#fde047', marginLeft: '2px', fontWeight: 900 }}>
                                (+{last20Metrics.teamDeltaDA || last20Metrics.deltaDA} {lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')})
                            </span>
                        )}
                    </div>
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
                            ⏱️ {hoveredItem.minute}' {lang === 'tr' ? 'Dk' : (lang === 'de' ? 'Min' : 'Min')} — {hoveredItem.value > 0
                                ? `${homeTeam} (+${hoveredItem.value})`
                                : hoveredItem.value < 0
                                    ? `${awayTeam} (-${Math.abs(hoveredItem.value)})`
                                    : (lang === 'tr' ? 'Dengeli Oyun' : (lang === 'de' ? 'Ausgeglichenes Spiel' : 'Balanced Play'))}
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
                            ? `⚽ ${inc.time}' ${lang === 'tr' ? 'Gol!' : (lang === 'de' ? 'Tor!' : 'Goal!')} ${playerName} (${isHome ? homeTeam : awayTeam})`
                            : isCard
                                ? `${inc.incidentClass === 'yellow' ? '🟨' : '🟥'} ${inc.time}' ${lang === 'tr' ? 'Kart:' : (lang === 'de' ? 'Karte:' : 'Card:')} ${playerName}`
                                : `🔁 ${inc.time}' ${lang === 'tr' ? 'Değişiklik:' : (lang === 'de' ? 'Auswechslung:' : 'Sub:')} ${playerName}`;

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
                <span style={{ color: '#cbd5e1' }}>45' {lang === 'tr' ? '(İY)' : (lang === 'de' ? '(HZ)' : '(HT)')}</span>
                <span>60'</span>
                <span>75'</span>
                <span>90'</span>
            </div>
        </div>
    );
};

export default AttackMomentumGraph;
