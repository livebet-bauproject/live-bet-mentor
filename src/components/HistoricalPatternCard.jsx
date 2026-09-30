import React from 'react';
import { HistoricalPatternMatcher } from '../logic/historicalPatternMatcher.js';

export const HistoricalPatternCard = ({ match, deltaStats = null, lang = 'tr' }) => {
    if (!match) return null;

    const pattern = HistoricalPatternMatcher.matchPattern(match, deltaStats, lang);
    if (!pattern) return null;

    if (pattern.isTrap) {
        return (
            <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                marginTop: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
            }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                            {pattern.title}
                        </span>
                        <span style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 800
                        }}>
                            {lang === 'tr' ? 'KASA KORUMA DEVREDE' : 'CAPITAL GUARD ACTIVE'}
                        </span>
                    </div>
                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.72rem', lineHeight: '1.4' }}>
                        {pattern.insight}
                    </p>
                    <div style={{ marginTop: '6px', fontSize: '0.65rem', color: '#94a3b8' }}>
                        📊 {lang === 'tr' ? `Taranan benzer ${pattern.matchedCount} maçta gol olma olasılığı sadece %${pattern.goalProbability}` : `Goal probability in ${pattern.matchedCount} similar matches: %${pattern.goalProbability}`}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            marginTop: '0.75rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Ambient Background Glow */}
            <div style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '100px',
                height: '100px',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(0,0,0,0) 70%)',
                pointerEvents: 'none'
            }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🏛️</span>
                    <div>
                        <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.78rem' }}>
                            {pattern.title}
                        </span>
                        <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                            {lang === 'tr' ? `Arşivdeki ${pattern.matchedCount} benzer maç ile eşleşti` : `Matched with ${pattern.matchedCount} historical fixtures`}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        background: pattern.goalProbability >= 80 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        border: pattern.goalProbability >= 80 ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                        color: pattern.goalProbability >= 80 ? '#4ade80' : '#fbbf24',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.64rem',
                        fontWeight: 900
                    }}>
                        ⭐ %{pattern.goalProbability} {lang === 'tr' ? 'GOL İHTİMALİ' : 'GOAL PROB'}
                    </span>
                </div>
            </div>

            {/* Probability Progress Bar */}
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '3px' }}>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>
                        {lang === 'tr' ? 'Kalan Sürede Gol Çıktı' : 'Goal Scored'}: %{pattern.goalProbability}
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                        {lang === 'tr' ? 'Kilitlendi' : 'No Goal'}: %{100 - pattern.goalProbability}
                    </span>
                </div>
                <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    display: 'flex'
                }}>
                    <div style={{
                        width: `${pattern.goalProbability}%`,
                        background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                        height: '100%',
                        borderRadius: '4px'
                    }} />
                    <div style={{
                        width: `${100 - pattern.goalProbability}%`,
                        background: 'rgba(239, 68, 68, 0.35)',
                        height: '100%'
                    }} />
                </div>
            </div>

            {/* Historical Insight & Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '6px',
                marginBottom: '0.6rem'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '0.65rem'
                }}>
                    <span style={{ color: '#94a3b8', display: 'block' }}>⏱️ {lang === 'tr' ? 'Ortalama Gol Dk:' : 'Avg Goal Min:'}</span>
                    <span style={{ color: '#fde047', fontWeight: 800, fontSize: '0.74rem' }}>{pattern.avgGoalMinute}'</span>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '0.65rem'
                }}>
                    <span style={{ color: '#94a3b8', display: 'block' }}>🎯 {lang === 'tr' ? 'Baskı Kuranın Golü:' : 'Dominant Score:'}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.74rem' }}>%{pattern.dominantTeamWinPct}</span>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '0.65rem'
                }}>
                    <span style={{ color: '#94a3b8', display: 'block' }}>📈 {lang === 'tr' ? 'Tarihsel Kâr (ROI):' : 'Historical ROI:'}</span>
                    <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.74rem' }}>+{pattern.roiPct}%</span>
                </div>
            </div>

            {/* Pattern Insight Note */}
            <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                borderLeft: '3px solid #f59e0b',
                padding: '5px 9px',
                borderRadius: '0 6px 6px 0',
                fontSize: '0.68rem',
                color: '#fef3c7',
                lineHeight: '1.35'
            }}>
                💡 {pattern.insight}
            </div>
        </div>
    );
};
