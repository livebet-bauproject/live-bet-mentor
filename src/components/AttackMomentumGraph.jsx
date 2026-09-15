import React, { useState } from 'react';

export const AttackMomentumGraph = ({
    points = [],
    homeTeam = 'Ev Sahibi',
    awayTeam = 'Deplasman',
    currentMinute = 90,
    height = 90,
    lang = 'tr',
    loading = false,
    noGraph = false
}) => {
    const [hoveredPoint, setHoveredPoint] = useState(null);

    if (loading) {
        return (
            <div style={{
                padding: '1.2rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '10px',
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
                padding: '1.2rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '10px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.75rem'
            }}>
                <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>{noGraph ? 'ℹ️' : '📈'}</div>
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

    const svgWidth = 600;
    const svgHeight = height;
    const midY = svgHeight / 2;
    const barWidth = Math.max(2, (svgWidth / totalMinutes) - 1.2);

    // Calculate recent momentum (last 10 data points)
    const recentPoints = points.slice(-10);
    const recentHomeScore = recentPoints.reduce((acc, p) => acc + (p.value > 0 ? p.value : 0), 0);
    const recentAwayScore = recentPoints.reduce((acc, p) => acc + (p.value < 0 ? Math.abs(p.value) : 0), 0);
    const recentTotal = recentHomeScore + recentAwayScore || 1;
    const recentHomePct = Math.round((recentHomeScore / recentTotal) * 100);
    const recentAwayPct = 100 - recentHomePct;

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            position: 'relative'
        }}>
            {/* Header: Teams and Momentum Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 800 }}>
                    <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                        {homeTeam}
                    </span>
                    <span style={{ opacity: 0.35 }}>vs</span>
                    <span style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
                        {awayTeam}
                    </span>
                </div>

                <div style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: recentHomePct > 60 ? '#38bdf8' : recentAwayPct > 60 ? '#f43f5e' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span>⚡ {lang === 'tr' ? 'Son 10 Dk Baskı:' : 'Last 10m Momentum:'}</span>
                    <span style={{ color: '#38bdf8' }}>%{recentHomePct}</span>
                    <span style={{ opacity: 0.3 }}>/</span>
                    <span style={{ color: '#f43f5e' }}>%{recentAwayPct}</span>
                </div>
            </div>

            {/* Hover Tooltip Indicator */}
            {hoveredPoint && (
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(3, 7, 18, 0.95)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: hoveredPoint.value > 0 ? '#38bdf8' : hoveredPoint.value < 0 ? '#f43f5e' : '#fff',
                    zIndex: 10,
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                    ⏱️ {hoveredPoint.minute}'. Dakika — {hoveredPoint.value > 0 ? `${homeTeam} Baskısı (+${hoveredPoint.value})` : hoveredPoint.value < 0 ? `${awayTeam} Baskısı (-${Math.abs(hoveredPoint.value)})` : 'Dengeli Oyun'}
                </div>
            )}

            {/* SVG Chart */}
            <div style={{ width: '100%', overflowX: 'hidden' }}>
                <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    style={{ width: '100%', height: `${height}px`, display: 'block' }}
                >
                    <defs>
                        {/* Home Gradient (Blue to Cyan) */}
                        <linearGradient id="homeGradient" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
                        </linearGradient>

                        {/* Away Gradient (Red to Rose) */}
                        <linearGradient id="awayGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e11d48" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.95" />
                        </linearGradient>
                    </defs>

                    {/* Half Time Divider Line (45') */}
                    <line
                        x1={(45 / totalMinutes) * svgWidth}
                        y1="4"
                        x2={(45 / totalMinutes) * svgWidth}
                        y2={svgHeight - 4}
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeDasharray="2,2"
                        strokeWidth="1"
                    />

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
                        stroke="rgba(255, 255, 255, 0.2)"
                        strokeWidth="1"
                    />

                    {/* Bars Rendering */}
                    {points.map((p) => {
                        const val = p.value || 0;
                        const x = ((p.minute - 1) / totalMinutes) * svgWidth;
                        const barHeight = (Math.abs(val) / maxVal) * (midY - 6);

                        const isHome = val > 0;
                        const y = isHome ? (midY - barHeight) : midY;
                        const fill = isHome ? 'url(#homeGradient)' : 'url(#awayGradient)';

                        return (
                            <rect
                                key={p.minute}
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(1.5, barHeight)}
                                rx={1}
                                ry={1}
                                fill={fill}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s',
                                    opacity: hoveredPoint?.minute === p.minute ? 1 : 0.82
                                }}
                                onMouseEnter={() => setHoveredPoint(p)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            />
                        );
                    })}
                </svg>
            </div>

            {/* Time Axis Labels */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.6rem',
                color: '#64748b',
                fontWeight: 700,
                marginTop: '4px',
                padding: '0 2px'
            }}>
                <span>1'</span>
                <span>15'</span>
                <span>30'</span>
                <span style={{ color: '#94a3b8' }}>İY (45')</span>
                <span>60'</span>
                <span>75'</span>
                <span>90'</span>
            </div>
        </div>
    );
};
export default AttackMomentumGraph;
