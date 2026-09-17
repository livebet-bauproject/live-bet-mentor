import React, { useState, useEffect } from 'react';
import { sofaScoreAdapter } from '../backend/sofaScoreAdapter';

export const MatchLiveStatsCard = ({ match = null, lang = 'tr', t = {} }) => {
    if (!match) return null;
    const matchId = match?.id;
    const [statsData, setStatsData] = useState(() => {
        if (matchId && sofaScoreAdapter._statsCache?.has(matchId)) {
            return sofaScoreAdapter._statsCache.get(matchId).data;
        }
        return null;
    });
    const [loading, setLoading] = useState(() => {
        if (matchId && sofaScoreAdapter._statsCache?.has(matchId)) return false;
        return Boolean(matchId);
    });

    useEffect(() => {
        if (!matchId) return;

        let isCancelled = false;
        const cached = sofaScoreAdapter._statsCache?.get(matchId);
        if (cached && (Date.now() - cached.time < 45000)) {
            setStatsData(cached.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        sofaScoreAdapter.fetchEventStatistics(matchId)
            .then(stats => {
                if (isCancelled) return;
                setStatsData(stats);
                setLoading(false);
            })
            .catch(() => {
                if (!isCancelled) setLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [matchId]);

    // Extract items from statistics (prefer 'ALL' period)
    const allPeriod = Array.isArray(statsData)
        ? (statsData.find(s => s.period === 'ALL') || statsData[0])
        : null;

    const findStat = (keyName) => {
        if (!allPeriod?.groups) return null;
        for (const group of allPeriod.groups) {
            const item = group.statisticsItems?.find(i => 
                (i.name && i.name.toLowerCase() === keyName.toLowerCase()) ||
                (i.key && i.key.toLowerCase() === keyName.toLowerCase())
            );
            if (item) return item;
        }
        return null;
    };

    // Extract key metrics from fetched stats or fallback to match.stats
    const possessionItem = findStat('Ball possession');
    const xgItem = findStat('Expected goals');
    const totalShotsItem = findStat('Total shots');
    const shotsOnTargetItem = findStat('Shots on target');
    const cornersItem = findStat('Corner kicks');
    const dangerousAttacksItem = findStat('Touches in penalty area') || findStat('Big chances');
    const foulsItem = findStat('Fouls');
    const yellowCardsItem = findStat('Yellow cards');

    // Parse values
    const parseNum = (v, fallback = 0) => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            const clean = parseFloat(v.replace('%', '').trim());
            return isNaN(clean) ? fallback : clean;
        }
        return fallback;
    };

    // Possession
    const possHome = possessionItem ? parseNum(possessionItem.home, 50) : parseNum(match?.stats?.possession?.home, 50);
    const possAway = possessionItem ? parseNum(possessionItem.away, 50) : parseNum(match?.stats?.possession?.away, 50);

    // xG
    const xgHome = xgItem ? parseNum(xgItem.home, 0) : parseNum(match?.stats?.xg?.home, 0);
    const xgAway = xgItem ? parseNum(xgItem.away, 0) : parseNum(match?.stats?.xg?.away, 0);

    // Shots
    const shotsHome = totalShotsItem ? parseNum(totalShotsItem.home, 0) : parseNum(match?.stats?.shots?.home, 0);
    const shotsAway = totalShotsItem ? parseNum(totalShotsItem.away, 0) : parseNum(match?.stats?.shots?.away, 0);
    const sotHome = shotsOnTargetItem ? parseNum(shotsOnTargetItem.home, 0) : parseNum(match?.stats?.shotsOnGoal?.home, 0);
    const sotAway = shotsOnTargetItem ? parseNum(shotsOnTargetItem.away, 0) : parseNum(match?.stats?.shotsOnGoal?.away, 0);

    // Dangerous Attacks / Penalty touches
    const daHome = parseNum(match?.stats?.dangerousAttacks?.home, 0);
    const daAway = parseNum(match?.stats?.dangerousAttacks?.away, 0);
    const penHome = dangerousAttacksItem ? parseNum(dangerousAttacksItem.home, 0) : 0;
    const penAway = dangerousAttacksItem ? parseNum(dangerousAttacksItem.away, 0) : 0;

    // Corners
    const cornersHome = cornersItem ? parseNum(cornersItem.home, 0) : parseNum(match?.stats?.corners?.home, 0);
    const cornersAway = cornersItem ? parseNum(cornersItem.away, 0) : parseNum(match?.stats?.corners?.away, 0);

    // Fouls & Cards
    const foulsHome = foulsItem ? parseNum(foulsItem.home, 0) : parseNum(match?.stats?.fouls?.home, 0);
    const foulsAway = foulsItem ? parseNum(foulsItem.away, 0) : parseNum(match?.stats?.fouls?.away, 0);
    const ycHome = yellowCardsItem ? parseNum(yellowCardsItem.home, 0) : parseNum(match?.cards?.home?.yellow, 0);
    const ycAway = yellowCardsItem ? parseNum(yellowCardsItem.away, 0) : parseNum(match?.cards?.away?.yellow, 0);
    const rcHome = parseNum(match?.cards?.home?.red, 0);
    const rcAway = parseNum(match?.cards?.away?.red, 0);

    const [statPeriod, setStatPeriod] = useState('ALL'); // 'ALL' | 'LAST_20'

    // Calculate 20-minute delta metrics from minuteHistory
    const history = (Array.isArray(match?.minuteHistory) && match.minuteHistory.length > 0)
        ? match.minuteHistory
        : (Array.isArray(match?.history) ? match.history : []);

    let deltaStats = null;
    if (history.length > 1) {
        const now = Date.now();
        const targetMs = 20 * 60 * 1000;
        let bestSnap = null;
        let minDiff = Infinity;
        for (const snap of history) {
            const age = now - snap.timestamp;
            const diff = Math.abs(age - targetMs);
            if (diff < minDiff) {
                minDiff = diff;
                bestSnap = snap;
            }
        }

        if (bestSnap && bestSnap.stats) {
            const snapAgeMin = Math.max(1, Math.round((now - bestSnap.timestamp) / 60000));
            const scale = snapAgeMin < 20 ? (20 / snapAgeMin) : 1.0;

            const oldDAHome = Number(bestSnap.stats.dangerousAttacks?.home) || 0;
            const oldDAAway = Number(bestSnap.stats.dangerousAttacks?.away) || 0;
            const oldSogHome = Number(bestSnap.stats.shotsOnGoal?.home) || 0;
            const oldSogAway = Number(bestSnap.stats.shotsOnGoal?.away) || 0;
            const oldShotsHome = Number(bestSnap.stats.totalShots?.home) || oldSogHome;
            const oldShotsAway = Number(bestSnap.stats.totalShots?.away) || oldSogAway;
            const oldCornersHome = Number(bestSnap.stats.corners?.home) || 0;
            const oldCornersAway = Number(bestSnap.stats.corners?.away) || 0;

            deltaStats = {
                daHome: Math.min(daHome, Math.round(Math.max(0, daHome - oldDAHome) * scale)),
                daAway: Math.min(daAway, Math.round(Math.max(0, daAway - oldDAAway) * scale)),
                sotHome: Math.min(sotHome, Math.round(Math.max(0, sotHome - oldSogHome) * scale)),
                sotAway: Math.min(sotAway, Math.round(Math.max(0, sotAway - oldSogAway) * scale)),
                shotsHome: Math.min(shotsHome || sotHome, Math.round(Math.max(0, (shotsHome || sotHome) - oldShotsHome) * scale)),
                shotsAway: Math.min(shotsAway || sotAway, Math.round(Math.max(0, (shotsAway || sotAway) - oldShotsAway) * scale)),
                cornersHome: Math.min(cornersHome, Math.round(Math.max(0, cornersHome - oldCornersHome) * scale)),
                cornersAway: Math.min(cornersAway, Math.round(Math.max(0, cornersAway - oldCornersAway) * scale)),
            };
        }
    }

    // Fallback if no deep history (rate based)
    if (!deltaStats) {
        const curMin = Math.max(10, parseInt(match?.minute) || 45);
        const windowRatio = Math.min(1.0, 20 / curMin);
        deltaStats = {
            daHome: Math.round(daHome * windowRatio),
            daAway: Math.round(daAway * windowRatio),
            sotHome: Math.round(sotHome * windowRatio),
            sotAway: Math.round(sotAway * windowRatio),
            shotsHome: Math.round((shotsHome || sotHome) * windowRatio),
            shotsAway: Math.round((shotsAway || sotAway) * windowRatio),
            cornersHome: Math.round(cornersHome * windowRatio),
            cornersAway: Math.round(cornersAway * windowRatio),
        };
    }

    // 20-minute momentum percentage from graphPoints
    let possHome20 = possHome;
    let possAway20 = possAway;
    const graphPts = match?.graphPoints || (sofaScoreAdapter.getCachedGraph ? sofaScoreAdapter.getCachedGraph(matchId) : null);
    if (Array.isArray(graphPts) && graphPts.length > 3) {
        const pts20 = graphPts.slice(-20);
        const hScore = pts20.reduce((acc, p) => acc + (p.value > 0 ? p.value : 0), 0);
        const aScore = pts20.reduce((acc, p) => acc + (p.value < 0 ? Math.abs(p.value) : 0), 0);
        if (hScore + aScore >= 10) {
            possHome20 = Math.round((hScore / (hScore + aScore)) * 100);
            possAway20 = 100 - possHome20;
        }
    }

    const isLast20 = statPeriod === 'LAST_20';
    const effectivePossHome = isLast20 ? possHome20 : possHome;
    const effectivePossAway = isLast20 ? possAway20 : possAway;
    const effectiveShotsHome = isLast20 ? deltaStats.shotsHome : (shotsHome || sotHome);
    const effectiveShotsAway = isLast20 ? deltaStats.shotsAway : (shotsAway || sotAway);
    const effectiveSotHome = isLast20 ? deltaStats.sotHome : sotHome;
    const effectiveSotAway = isLast20 ? deltaStats.sotAway : sotAway;
    const effectiveDaHome = isLast20 ? deltaStats.daHome : daHome;
    const effectiveDaAway = isLast20 ? deltaStats.daAway : daAway;
    const effectiveCornersHome = isLast20 ? deltaStats.cornersHome : cornersHome;
    const effectiveCornersAway = isLast20 ? deltaStats.cornersAway : cornersAway;

    // Helper to render horizontal comparative stat bar
    const renderStatBar = (label, homeDisplay, awayDisplay, homeVal, awayVal, isPercent = false) => {
        const total = (homeVal + awayVal) || 1;
        const homePct = isPercent ? homeVal : Math.max(10, Math.min(90, Math.round((homeVal / total) * 100)));
        const awayPct = 100 - homePct;

        return (
            <div style={{ marginBottom: '0.55rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.72rem',
                    marginBottom: '3px'
                }}>
                    <span style={{ fontWeight: 800, color: '#22c55e', minWidth: '40px' }}>{homeDisplay}</span>
                    <span style={{ color: 'var(--tb-text-muted)', fontSize: '0.68rem', fontWeight: 600, textAlign: 'center', flex: 1, padding: '0 4px' }}>
                        {label}
                    </span>
                    <span style={{ fontWeight: 800, color: '#3b82f6', minWidth: '40px', textAlign: 'right' }}>{awayDisplay}</span>
                </div>
                <div style={{
                    display: 'flex',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${homePct}%`,
                        background: '#22c55e',
                        transition: 'width 0.4s ease'
                    }} />
                    <div style={{
                        width: `${awayPct}%`,
                        background: '#3b82f6',
                        transition: 'width 0.4s ease'
                    }} />
                </div>
            </div>
        );
    };

    const hasAnyStats = possHome !== 50 || shotsHome > 0 || shotsAway > 0 || xgHome > 0 || xgAway > 0 || cornersHome > 0 || cornersAway > 0 || daHome > 0 || daAway > 0;

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            position: 'relative'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.65rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                paddingBottom: '0.4rem',
                flexWrap: 'wrap',
                gap: '8px'
            }}>
                <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>📊</span>
                    <span>{lang === 'tr' ? 'CANLI SAHA VERİLERİ & İSTATİSTİKLER' : 'LIVE MATCH METRICS'}</span>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Period Switcher [ Tüm Maç ] [ ⚡ Son 20 Dk ] */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <button
                            type="button"
                            onClick={() => setStatPeriod('ALL')}
                            style={{
                                background: statPeriod === 'ALL' ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                                color: statPeriod === 'ALL' ? '#38bdf8' : 'var(--tb-text-muted)',
                                border: statPeriod === 'ALL' ? '1px solid #38bdf8' : '1px solid transparent',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.64rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {lang === 'tr' ? 'Tüm Maç' : 'Full Match'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatPeriod('LAST_20')}
                            style={{
                                background: statPeriod === 'LAST_20' ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                                color: statPeriod === 'LAST_20' ? '#fbbf24' : 'var(--tb-text-muted)',
                                border: statPeriod === 'LAST_20' ? '1px solid #f59e0b' : '1px solid transparent',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.64rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            ⚡ {lang === 'tr' ? 'Son 20 Dk' : 'Last 20m'}
                        </button>
                    </div>

                    {loading && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🌀</span>
                        </span>
                    )}
                </div>
            </div>

            {!hasAnyStats && !loading ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--tb-text-muted)', fontSize: '0.72rem' }}>
                    {lang === 'tr' ? 'Bu lig maçı için ayrıntılı istatistik akışı bulunmuyor.' : 'Detailed statistics not available for this league match.'}
                </div>
            ) : (
                <div>
                    {isLast20 && (
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.22)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            marginBottom: '0.65rem',
                            fontSize: '0.66rem',
                            color: '#fbbf24',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            <span>⚡</span>
                            <span>{lang === 'tr' ? 'Son 20 dakikada takımların ürettiği net hücum farkları:' : 'Net offensive metrics generated in the last 20 minutes:'}</span>
                        </div>
                    )}

                    {/* Possession or 20m Pressure Share */}
                    {renderStatBar(
                        isLast20 ? (lang === 'tr' ? 'Baskı Payı (Son 20 Dk)' : 'Pressure Share (Last 20m)') : (lang === 'tr' ? 'Topla Oynama' : 'Possession'),
                        `%${effectivePossHome}`,
                        `%${effectivePossAway}`,
                        effectivePossHome,
                        effectivePossAway,
                        true
                    )}

                    {/* Expected Goals (xG) - Only in Full Match */}
                    {!isLast20 && (xgHome > 0 || xgAway > 0) && renderStatBar(
                        lang === 'tr' ? 'Beklenen Gol (xG)' : 'Expected Goals (xG)',
                        xgHome.toFixed(2),
                        xgAway.toFixed(2),
                        xgHome,
                        xgAway
                    )}

                    {/* Total Shots & On Target */}
                    {renderStatBar(
                        isLast20 ? (lang === 'tr' ? 'Son 20 Dk Şut (İsabetli)' : 'Last 20m Shots (Target)') : (lang === 'tr' ? 'Toplam Şut (İsabetli)' : 'Total Shots (On Target)'),
                        isLast20 ? `+${effectiveShotsHome} (+${effectiveSotHome})` : `${shotsHome || sotHome} (${sotHome})`,
                        isLast20 ? `+${effectiveShotsAway} (+${effectiveSotAway})` : `${shotsAway || sotAway} (${sotAway})`,
                        effectiveShotsHome,
                        effectiveShotsAway
                    )}

                    {/* Dangerous Attacks */}
                    {(effectiveDaHome > 0 || effectiveDaAway > 0 || (!isLast20 && (penHome > 0 || penAway > 0))) && renderStatBar(
                        isLast20 ? (lang === 'tr' ? 'Son 20 Dk Tehlikeli Atak' : 'Last 20m Dangerous Attacks') : (penHome > 0 || penAway > 0 ? (lang === 'tr' ? 'Ceza Sahasında Topla Buluşma' : 'Penalty Box Touches') : (lang === 'tr' ? 'Tehlikeli Atak' : 'Dangerous Attacks')),
                        isLast20 ? `+${effectiveDaHome}` : String(penHome > 0 || penAway > 0 ? penHome : daHome),
                        isLast20 ? `+${effectiveDaAway}` : String(penHome > 0 || penAway > 0 ? penAway : daAway),
                        effectiveDaHome,
                        effectiveDaAway
                    )}

                    {/* Corners */}
                    {renderStatBar(
                        isLast20 ? (lang === 'tr' ? 'Son 20 Dk Korner' : 'Last 20m Corners') : (lang === 'tr' ? 'Kornerler' : 'Corners'),
                        isLast20 ? `+${effectiveCornersHome}` : String(cornersHome),
                        isLast20 ? `+${effectiveCornersAway}` : String(cornersAway),
                        effectiveCornersHome,
                        effectiveCornersAway
                    )}

                    {/* Fouls & Cards (Full Match Only) */}
                    {!isLast20 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.70rem',
                            marginTop: '0.5rem',
                            paddingTop: '0.45rem',
                            borderTop: '1px dashed rgba(255, 255, 255, 0.06)',
                            color: 'var(--tb-text-muted)'
                        }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span>Faul: <strong style={{ color: '#fff' }}>{foulsHome}</strong></span>
                                {(ycHome > 0 || rcHome > 0) && (
                                    <span>
                                        {ycHome > 0 && <span style={{ color: '#fbbf24' }}>🟨 {ycHome} </span>}
                                        {rcHome > 0 && <span style={{ color: '#ef4444' }}>🟥 {rcHome}</span>}
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{lang === 'tr' ? 'Disiplin & Faul' : 'Fouls & Discipline'}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {(ycAway > 0 || rcAway > 0) && (
                                    <span>
                                        {ycAway > 0 && <span style={{ color: '#fbbf24' }}>🟨 {ycAway} </span>}
                                        {rcAway > 0 && <span style={{ color: '#ef4444' }}>🟥 {rcAway}</span>}
                                    </span>
                                )}
                                <span>Faul: <strong style={{ color: '#fff' }}>{foulsAway}</strong></span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
