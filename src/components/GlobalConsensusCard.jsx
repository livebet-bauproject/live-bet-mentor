import React from 'react';
import { RADAR_SOURCES, RADAR_BASE_URLS } from '../utils/radarConstants';
import { consensusAdapter } from '../backend/consensusAdapter';
import { dataWorker } from '../backend/dataWorker';

export const GlobalConsensusCard = ({
    match,
    consensusReport: propConsensusReport,
    lang = 'tr',
    t = {},
    compact = false
}) => {
    // Resolve consensus report: prop -> match.consensusReport -> dynamic computation via consensusData
    const consensusReport = propConsensusReport
        || match?.consensusReport
        || (dataWorker?.consensusData && match ? consensusAdapter.getConsensusSummary(dataWorker.consensusData, match) : null);

    const totalSources = consensusReport?.totalSources || 0;
    const signals = consensusReport?.signals || [];
    const agreement = consensusReport?.agreement || {};

    // Build agreement entries if agreement is present, else group from signals
    const agreementEntries = Object.keys(agreement).length > 0
        ? Object.entries(agreement)
        : (() => {
            const map = {};
            signals.forEach(s => {
                if (s.prediction) {
                    map[s.prediction] = (map[s.prediction] || 0) + 1;
                }
            });
            return Object.entries(map);
        })();

    // Sort predictions by source count descending
    agreementEntries.sort((a, b) => b[1] - a[1]);

    // Strongest consensus percentage
    const maxAgreementCount = agreementEntries.length > 0 ? agreementEntries[0][1] : 0;
    const agreementPercent = totalSources > 0 ? Math.round((maxAgreementCount / totalSources) * 100) : 0;
    const isStrongConsensus = totalSources >= 2 && agreementPercent >= 70;
    const isDivergent = totalSources >= 2 && agreementPercent < 55;

    // Localized labels
    const titleLabel = lang === 'tr'
        ? 'GLOBAL KONSENSUS & DIŞ TAHMİNLER'
        : (lang === 'de' ? 'GLOBALER KONSENS & TIPPS' : 'GLOBAL CONSENSUS & PREDICTIONS');

    const activeCountLabel = lang === 'tr'
        ? `${totalSources} / ${RADAR_SOURCES.length} Kaynak Aktif`
        : (lang === 'de' ? `${totalSources} / ${RADAR_SOURCES.length} Aktive Quellen` : `${totalSources} / ${RADAR_SOURCES.length} Active Sources`);

    const strongLabel = lang === 'tr'
        ? `🔥 %${agreementPercent} GÜÇLÜ KONSENSÜS`
        : (lang === 'de' ? `🔥 %${agreementPercent} STARKER KONSENS` : `🔥 %${agreementPercent} STRONG CONSENSUS`);

    const emptyMessage = lang === 'tr'
        ? 'Bu maç için henüz dış kaynak konsensüs tahmini eşleşmedi.'
        : (lang === 'de' ? 'Noch keine externen Konsens-Tipps für dieses Spiel zugeordnet.' : 'No external consensus predictions matched for this match yet.');

    // Helper for prediction badge color
    const getPredColor = (pred) => {
        const p = String(pred).toUpperCase();
        if (p === '1' || p.includes('EV') || p.includes('HOME')) return '#38bdf8';
        if (p === '2' || p.includes('DEP') || p.includes('AWAY')) return '#34d399';
        if (p === 'X' || p.includes('BER') || p.includes('DRAW')) return '#fbbf24';
        if (p.includes('ÜST') || p.includes('OVER')) return '#a78bfa';
        if (p.includes('ALT') || p.includes('UNDER')) return '#f87171';
        return '#00f2fe';
    };

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: compact ? '0.75rem 0.85rem' : '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--tb-border, rgba(255, 255, 255, 0.08))',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: compact ? '0.72rem' : '0.76rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem' }}>🌐</span>
                    <span>{titleLabel}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isStrongConsensus && (
                        <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(56, 189, 248, 0.25))',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            boxShadow: '0 0 8px rgba(16, 185, 129, 0.2)'
                        }}>
                            {strongLabel}
                        </span>
                    )}
                    {isDivergent && (
                        <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                            ⚠️ {lang === 'tr' ? 'AYRIŞMA' : 'DIVERGENCE'}
                        </span>
                    )}
                    <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: totalSources > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: totalSources > 0 ? '#34d399' : 'var(--tb-text-muted, #94a3b8)',
                        border: totalSources > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        {activeCountLabel}
                    </span>
                </div>
            </div>

            {/* Prediction List or Empty State */}
            {totalSources > 0 && agreementEntries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {agreementEntries.map(([pred, count]) => {
                        const predSignals = signals.filter(s => s.prediction === pred);
                        const predColor = getPredColor(pred);

                        return (
                            <div
                                key={pred}
                                style={{
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 255, 255, 0.04)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem'
                                }}
                            >
                                {/* Prediction Header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            fontWeight: 900,
                                            fontSize: '0.85rem',
                                            color: predColor,
                                            background: `${predColor}18`,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            border: `1px solid ${predColor}40`,
                                            letterSpacing: '0.5px'
                                        }}>
                                            {pred}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--tb-text-secondary, #94a3b8)' }}>
                                            {lang === 'tr' ? 'Tahmini' : (lang === 'de' ? 'Tipp' : 'Pick')}
                                        </span>
                                    </div>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        color: '#38bdf8',
                                        background: 'rgba(56, 189, 248, 0.1)',
                                        padding: '1px 6px',
                                        borderRadius: '4px'
                                    }}>
                                        {count} {lang === 'tr' ? 'Kaynak' : (lang === 'de' ? 'Quellen' : 'Sources')}
                                    </span>
                                </div>

                                {/* Source Badges with Brand Colors & URLs */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {predSignals.map((sig, sIdx) => {
                                        const sourceDef = RADAR_SOURCES.find(rs => rs.id === sig.site);
                                        const label = sourceDef?.label || sig.site;
                                        const color = sourceDef?.color || '#94a3b8';
                                        const url = RADAR_BASE_URLS[sig.site];

                                        return (
                                            <span
                                                key={sIdx}
                                                onClick={(e) => {
                                                    if (url) {
                                                        e.stopPropagation();
                                                        window.open(url, '_blank');
                                                    }
                                                }}
                                                title={url ? `${label} - ${url}` : label}
                                                style={{
                                                    fontSize: '0.62rem',
                                                    fontWeight: 700,
                                                    background: `${color}18`,
                                                    color: color,
                                                    border: `1px solid ${color}40`,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    cursor: url ? 'pointer' : 'default',
                                                    transition: 'opacity 0.2s',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                <span>{label}</span>
                                                {sig.score_pred && (
                                                    <span style={{ opacity: 0.8, fontSize: '0.58rem', fontWeight: 600 }}>({sig.score_pred})</span>
                                                )}
                                                {sig.prob && (
                                                    <span style={{ opacity: 0.9, fontSize: '0.58rem', fontWeight: 700 }}>{sig.prob}</span>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--tb-text-muted, #94a3b8)',
                    fontStyle: 'italic',
                    padding: '0.4rem 0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span>ℹ️</span>
                    <span>{emptyMessage}</span>
                </div>
            )}
        </div>
    );
};
