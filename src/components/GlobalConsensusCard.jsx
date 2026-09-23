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

    // Resolve live match state
    let curHome = 0;
    let curAway = 0;
    if (match?.score && typeof match.score === 'object') {
        curHome = Number(match.score.home ?? 0) || 0;
        curAway = Number(match.score.away ?? 0) || 0;
    } else if (match?.homeScore !== undefined || match?.awayScore !== undefined) {
        curHome = Number(match.homeScore?.current ?? match.homeScore ?? 0) || 0;
        curAway = Number(match.awayScore?.current ?? match.awayScore ?? 0) || 0;
    } else if (typeof match?.score === 'string' && match.score.includes('-')) {
        const parts = match.score.split('-');
        curHome = parseInt(parts[0]) || 0;
        curAway = parseInt(parts[1]) || 0;
    }
    const currentTotalGoals = curHome + curAway;
    const minute = parseInt(String(match?.minute || '').replace(/[^0-9]/g, '')) || 0;
    const isLive = minute > 0 || (match?.status?.type === 'inprogress') || (typeof match?.status === 'string' && match.status.includes('in'));

    // Helper: Determine if a pre-match prediction is mathematically busted by the live score
    const checkIsPredictionBusted = (pred, scorePred = null) => {
        if (!isLive && currentTotalGoals === 0) return { isBusted: false };
        const checkStr = (scorePred || pred || '').trim();

        // 1. Exact score check: e.g. "1-2", "3-0", "0-2"
        if (/^\d+\s*-\s*\d+$/.test(checkStr)) {
            const parts = checkStr.split('-').map(x => parseInt(x.trim()) || 0);
            const predH = parts[0];
            const predA = parts[1];
            const predTotal = predH + predA;

            if (curHome > predH || curAway > predA || currentTotalGoals > predTotal) {
                return { isBusted: true, reason: lang === 'tr' ? `Skor aşıldı (${curHome}-${curAway})` : `Score exceeded (${curHome}-${curAway})` };
            }
            if (minute >= 82 && (curHome !== predH || curAway !== predA)) {
                return { isBusted: true, reason: lang === 'tr' ? `Süre yetersiz (${minute}')` : `Late game mismatch (${minute}')` };
            }
        }

        // 2. Under / Alt checks
        const underMatch = checkStr.match(/(?:alt|under)\s*([0-9.]+)/i);
        if (underMatch) {
            const threshold = parseFloat(underMatch[1]);
            if (!isNaN(threshold) && currentTotalGoals > threshold) {
                return { isBusted: true, reason: lang === 'tr' ? `${threshold} Üstü oldu (${currentTotalGoals} Gol)` : `Over ${threshold} exceeded` };
            }
        }

        // 3. 1X2 checks on massive blowouts (e.g. 0-5)
        if (minute >= 40) {
            const pUpper = checkStr.toUpperCase();
            if ((pUpper === '1' || pUpper.includes('EV') || pUpper.includes('HOME')) && (curAway - curHome >= 3)) {
                return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            }
            if ((pUpper === '2' || pUpper.includes('DEP') || pUpper.includes('AWAY')) && (curHome - curAway >= 3)) {
                return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            }
            if ((pUpper === 'X' || pUpper.includes('BER') || pUpper.includes('DRAW')) && Math.abs(curHome - curAway) >= 3) {
                return { isBusted: true, reason: lang === 'tr' ? `Fark 3+ (${curHome}-${curAway})` : `Draw impossible (3+ diff)` };
            }
        }

        return { isBusted: false };
    };

    // Filter agreement entries: separate active valid predictions from busted ones
    const evaluatedAgreement = agreementEntries.map(([pred, count]) => {
        const predSignals = signals.filter(s => s.prediction === pred);
        // If all signals for this prediction have busted score predictions or pred is busted
        const bustedInfo = checkIsPredictionBusted(pred, predSignals[0]?.score_pred);
        return {
            pred,
            count,
            signals: predSignals,
            ...bustedInfo
        };
    });

    const validEntries = evaluatedAgreement.filter(e => !e.isBusted);
    const hasAnyBusted = evaluatedAgreement.some(e => e.isBusted);
    const allBusted = evaluatedAgreement.length > 0 && validEntries.length === 0;

    // Strongest consensus percentage based on valid in-play predictions
    const maxAgreementCount = validEntries.length > 0 ? validEntries[0].count : (evaluatedAgreement[0]?.count || 0);
    const agreementPercent = totalSources > 0 ? Math.round((maxAgreementCount / totalSources) * 100) : 0;
    const isStrongConsensus = !allBusted && totalSources >= 2 && agreementPercent >= 70 && validEntries.length > 0;
    const isDivergent = !allBusted && totalSources >= 2 && agreementPercent < 55 && validEntries.length > 0;

    // Localized labels
    const titleLabel = lang === 'tr'
        ? 'GLOBAL KONSENSÜS (DIŞ TAHMİNLER)'
        : (lang === 'de' ? 'GLOBALER KONSENS & TIPPS' : 'GLOBAL CONSENSUS & PREDICTIONS');

    const activeCountLabel = lang === 'tr'
        ? `${totalSources} / ${RADAR_SOURCES.length} Kaynak`
        : (lang === 'de' ? `${totalSources} / ${RADAR_SOURCES.length} Quellen` : `${totalSources} / ${RADAR_SOURCES.length} Sources`);

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
                    <span style={{ fontSize: '0.62rem', color: 'var(--tb-text-muted)', fontWeight: 600 }}>({lang === 'tr' ? 'Maç Öncesi' : 'Pre-match'})</span>
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
                    {allBusted && (
                        <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)'
                        }}>
                            ⚠️ {lang === 'tr' ? 'TAHMİNLER GEÇERSİZ (AŞILDI)' : 'TIPS BUSTED (EXCEEDED)'}
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
            {totalSources > 0 && evaluatedAgreement.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {evaluatedAgreement.map((item) => {
                        const { pred, count, signals: predSignals, isBusted, reason: bustedReason } = item;
                        const predColor = isBusted ? '#64748b' : getPredColor(pred);

                        return (
                            <div
                                key={pred}
                                style={{
                                    background: isBusted ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                                    opacity: isBusted ? 0.7 : 1,
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '6px',
                                    border: isBusted ? '1px dashed rgba(239, 68, 68, 0.2)' : '1px solid rgba(255, 255, 255, 0.04)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem'
                                }}
                            >
                                {/* Prediction Header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontWeight: 900,
                                            fontSize: '0.85rem',
                                            color: predColor,
                                            textDecoration: isBusted ? 'line-through' : 'none',
                                            background: `${predColor}18`,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            border: `1px solid ${predColor}40`,
                                            letterSpacing: '0.5px'
                                        }}>
                                            {pred}
                                        </span>
                                        {isBusted && (
                                            <span style={{
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                color: '#f87171',
                                                background: 'rgba(239, 68, 68, 0.12)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                padding: '1px 6px',
                                                borderRadius: '3px'
                                            }}>
                                                ✗ {lang === 'tr' ? `TUTMADI (${bustedReason})` : `BUSTED (${bustedReason})`}
                                            </span>
                                        )}
                                        {!isBusted && (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--tb-text-secondary, #94a3b8)' }}>
                                                {lang === 'tr' ? 'Tahmini' : (lang === 'de' ? 'Tipp' : 'Pick')}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        color: isBusted ? '#64748b' : '#38bdf8',
                                        background: isBusted ? 'rgba(255, 255, 255, 0.04)' : 'rgba(56, 189, 248, 0.1)',
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
