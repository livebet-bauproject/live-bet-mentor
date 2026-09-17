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
                paddingBottom: '0.4rem'
            }}>
                <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>📊</span>
                    <span>{lang === 'tr' ? 'CANLI SAHA VERİLERİ & İSTATİSTİKLER' : 'LIVE MATCH METRICS'}</span>
                </span>
                {loading && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🌀</span>
                        <span>{lang === 'tr' ? 'Güncelleniyor...' : 'Updating...'}</span>
                    </span>
                )}
            </div>

            {!hasAnyStats && !loading ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--tb-text-muted)', fontSize: '0.72rem' }}>
                    {lang === 'tr' ? 'Bu lig maçı için ayrıntılı istatistik akışı bulunmuyor.' : 'Detailed statistics not available for this league match.'}
                </div>
            ) : (
                <div>
                    {/* Possession */}
                    {renderStatBar(
                        lang === 'tr' ? 'Topla Oynama' : 'Possession',
                        `%${possHome}`,
                        `%${possAway}`,
                        possHome,
                        possAway,
                        true
                    )}

                    {/* Expected Goals (xG) */}
                    {renderStatBar(
                        lang === 'tr' ? 'Beklenen Gol (xG)' : 'Expected Goals (xG)',
                        xgHome.toFixed(2),
                        xgAway.toFixed(2),
                        xgHome,
                        xgAway
                    )}

                    {/* Total Shots & On Target */}
                    {renderStatBar(
                        lang === 'tr' ? 'Toplam Şut (İsabetli)' : 'Total Shots (On Target)',
                        `${shotsHome || sotHome} (${sotHome})`,
                        `${shotsAway || sotAway} (${sotAway})`,
                        shotsHome || sotHome,
                        shotsAway || sotAway
                    )}

                    {/* Dangerous Attacks or Penalty Box Touches */}
                    {(daHome > 0 || daAway > 0 || penHome > 0 || penAway > 0) && renderStatBar(
                        penHome > 0 || penAway > 0 ? (lang === 'tr' ? 'Ceza Sahasında Topla Buluşma' : 'Penalty Box Touches') : (lang === 'tr' ? 'Tehlikeli Atak' : 'Dangerous Attacks'),
                        String(penHome > 0 || penAway > 0 ? penHome : daHome),
                        String(penHome > 0 || penAway > 0 ? penAway : daAway),
                        penHome > 0 || penAway > 0 ? penHome : daHome,
                        penHome > 0 || penAway > 0 ? penAway : daAway
                    )}

                    {/* Corners */}
                    {renderStatBar(
                        lang === 'tr' ? 'Kornerler' : 'Corners',
                        String(cornersHome),
                        String(cornersAway),
                        cornersHome,
                        cornersAway
                    )}

                    {/* Fouls & Cards */}
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
                </div>
            )}
        </div>
    );
};
