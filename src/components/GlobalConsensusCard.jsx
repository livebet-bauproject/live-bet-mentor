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

    // Helper: Format probability safely (e.g. 70 -> "%70", ignore "0" or corrupted "238")
    const formatSignalProb = (prob) => {
        if (!prob) return null;
        const cleanStr = String(prob).replace(/[%]/g, '').trim();
        const val = parseFloat(cleanStr);
        if (isNaN(val) || val <= 0 || val > 100) return null;
        const rounded = Math.round(val);
        return lang === 'tr' ? `%${rounded}` : `${rounded}%`;
    };

    // Helper: Determine if an exact score prediction is mathematically busted
    const checkScoreBusted = (scoreStr) => {
        if (!isLive && currentTotalGoals === 0) return { isBusted: false };
        if (!scoreStr || scoreStr === 'N/A' || scoreStr === '-') return { isBusted: false };
        const cleanStr = String(scoreStr).trim().replace(':', '-');
        const m = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!m) return { isBusted: false };
        const predH = parseInt(m[1], 10);
        const predA = parseInt(m[2], 10);
        const predTotal = predH + predA;

        if (curHome > predH || curAway > predA || currentTotalGoals > predTotal) {
            return { isBusted: true, reason: lang === 'tr' ? `Skor aşıldı (${curHome}-${curAway})` : `Score exceeded (${curHome}-${curAway})` };
        }
        if (minute >= 80 && (curHome !== predH || curAway !== predA)) {
            return { isBusted: true, reason: lang === 'tr' ? `Süre yetersiz (${minute}')` : `Late game mismatch (${minute}')` };
        }
        return { isBusted: false };
    };

    // Helper: Determine if a 1X2 prediction is mathematically or practically busted by the live score
    const check1X2Busted = (pred) => {
        if (!isLive) return { isBusted: false };
        const p = String(pred || '').trim().toUpperCase();
        const diff = curHome - curAway; // >0: Home leading, <0: Away leading

        // Home win (1)
        if (p === '1' || p.includes('EV') || p.includes('HOME')) {
            if (minute >= 40 && diff <= -3) return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            if (minute >= 75 && diff <= -2) return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            if (minute >= 82 && diff < 0) return { isBusted: true, reason: lang === 'tr' ? `Maç geride (${minute}')` : `Behind late (${minute}')` };
            if (minute >= 88 && diff <= 0) return { isBusted: true, reason: lang === 'tr' ? `Süre yetersiz (${minute}')` : `Late mismatch (${minute}')` };
        }

        // Away win (2)
        if (p === '2' || p.includes('DEP') || p.includes('AWAY')) {
            if (minute >= 40 && diff >= 3) return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            if (minute >= 75 && diff >= 2) return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            if (minute >= 82 && diff > 0) return { isBusted: true, reason: lang === 'tr' ? `Maç geride (${minute}')` : `Behind late (${minute}')` };
            if (minute >= 88 && diff >= 0) return { isBusted: true, reason: lang === 'tr' ? `Süre yetersiz (${minute}')` : `Late mismatch (${minute}')` };
        }

        // Draw (X)
        if (p === 'X' || p.includes('BER') || p.includes('DRAW')) {
            if (minute >= 40 && Math.abs(diff) >= 3) return { isBusted: true, reason: lang === 'tr' ? `Fark 3+ (${curHome}-${curAway})` : `Draw impossible (3+ diff)` };
            if (minute >= 75 && Math.abs(diff) >= 2) return { isBusted: true, reason: lang === 'tr' ? `Fark 2+ (${curHome}-${curAway})` : `Draw unlikely late` };
            if (minute >= 86 && Math.abs(diff) >= 1) return { isBusted: true, reason: lang === 'tr' ? `Beraberlik zor (${minute}')` : `Draw impossible late` };
        }

        // Double Chance 1X
        if (p === '1X') {
            if (minute >= 75 && diff <= -2) return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            if (minute >= 85 && diff < 0) return { isBusted: true, reason: lang === 'tr' ? `Maç geride (${minute}')` : `Behind late` };
        }

        // Double Chance X2
        if (p === 'X2') {
            if (minute >= 75 && diff >= 2) return { isBusted: true, reason: lang === 'tr' ? `Fark kapandı (${curHome}-${curAway})` : `Diff insurmountable` };
            if (minute >= 85 && diff > 0) return { isBusted: true, reason: lang === 'tr' ? `Maç geride (${minute}')` : `Behind late` };
        }

        // Under checks
        if (p.includes('ALT') || p.includes('UNDER')) {
            const threshold = parseFloat((p.match(/(?:alt|under)\s*([0-9.]+)/i) || [])[1]) || 2.5;
            if (currentTotalGoals > threshold) {
                return { isBusted: true, reason: lang === 'tr' ? `${threshold} Üstü oldu (${currentTotalGoals} Gol)` : `Over ${threshold} exceeded` };
            }
        }

        return { isBusted: false };
    };

    // Filter agreement entries: separate active valid predictions from busted ones
    const evaluatedAgreement = agreementEntries.map(([pred, count]) => {
        const predSignals = signals.filter(s => s.prediction === pred);
        const bustedInfo = check1X2Busted(pred);
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
        if (p === '1X') return '#818cf8';
        if (p === 'X2') return '#2dd4bf';
        if (p === '12') return '#c084fc';
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
                                                {pred === '1' ? (lang === 'tr' ? 'Ev Sahibi Galibiyeti' : (lang === 'de' ? 'Heimsieg' : 'Home Win')) :
                                                 pred === '2' ? (lang === 'tr' ? 'Deplasman Galibiyeti' : (lang === 'de' ? 'Auswärtssieg' : 'Away Win')) :
                                                 pred === 'X' ? (lang === 'tr' ? 'Beraberlik' : (lang === 'de' ? 'Unentschieden' : 'Draw')) :
                                                 pred === '1X' ? (lang === 'tr' ? 'Çifte Şans 1X' : (lang === 'de' ? 'Doppelte Chance 1X' : 'Double Chance 1X')) :
                                                 pred === 'X2' ? (lang === 'tr' ? 'Çifte Şans X2' : (lang === 'de' ? 'Doppelte Chance X2' : 'Double Chance X2')) :
                                                 pred === '12' ? (lang === 'tr' ? 'Çifte Şans 12' : (lang === 'de' ? 'Doppelte Chance 12' : 'Double Chance 12')) :
                                                 (lang === 'tr' ? 'Tahmini' : (lang === 'de' ? 'Tipp' : 'Pick'))}
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
                                        const scoreBustedInfo = checkScoreBusted(sig.score_pred);
                                        const formattedProb = formatSignalProb(sig.prob);

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
                                                {sig.score_pred && sig.score_pred !== 'N/A' && (
                                                    <span
                                                        title={scoreBustedInfo.isBusted ? scoreBustedInfo.reason : undefined}
                                                        style={{
                                                            opacity: scoreBustedInfo.isBusted ? 0.45 : 0.85,
                                                            fontSize: '0.58rem',
                                                            fontWeight: 600,
                                                            textDecoration: scoreBustedInfo.isBusted ? 'line-through' : 'none'
                                                        }}
                                                    >
                                                        ({sig.score_pred})
                                                    </span>
                                                )}
                                                {formattedProb && (
                                                    <span style={{ opacity: 0.9, fontSize: '0.58rem', fontWeight: 700 }}>
                                                        {formattedProb}
                                                    </span>
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
