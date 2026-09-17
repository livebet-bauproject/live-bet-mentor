import React, { useState, useMemo } from 'react';
import { calculateMatchHeatScore, formatMarketPrediction } from '../logic/liveSortEngine';
import { consensusAdapter } from '../backend/consensusAdapter';
import { CONFIG } from '../config';

export const LiveTerminalTable = ({
    matches = [],
    signals = {},
    trendingBets = [],
    opportunitiesMap = null,
    t = {},
    lang = 'tr',
    selectedMatch = null,
    onSelectMatch = () => {},
    onApproveBet = () => {},
    bankrollManager = null,
    pinnedMatchIds = new Set(),
    togglePinMatch = () => {},
    AttackMomentumGraph = null,
    MatchIncidentsTimeline = null,
    mobileTableMode = false,
    userProfile = null,
    onOpenUpgrade = () => {}
}) => {
    const [expandedMatchId, setExpandedMatchId] = useState(null);

    const handleRowClick = (match, e) => {
        // Prevent accordion trigger when clicking buttons or links
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        setExpandedMatchId(prev => prev === match.id ? null : match.id);
        onSelectMatch(match);
    };

    const formatScore = (score) => {
        if (!score && score !== 0) return '0 - 0';
        if (typeof score === 'object') {
            return `${score.home ?? 0} - ${score.away ?? 0}`;
        }
        return String(score).replace(':', ' - ');
    };

    const formatMinute = (minute) => {
        if (!minute && minute !== 0) return "0'";
        const str = String(minute).trim();
        if (str.includes('HT') || str.includes('İY')) return t?.halftime_short || 'İY';
        if (str.includes('FT') || str.includes('MS')) return t?.fulltime_short || 'MS';
        if (str.includes('Pen')) return 'Pen.';
        return str.includes("'") ? str : `${str}'`;
    };

    const getPredictionDisplay = (m, signal) => {
        if (!signal || signal.verdict !== 'BET') return null;

        const minStr = String(m?.minute || '').trim();
        const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
        const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;
        if (isLateOrFinished) return null;

        const strat = signal.activeStrategies?.[0];
        let label = strat?.label || signal.prediction || m.opportunityData?.suggestedMarket?.label;
        if (!label && signal.reason && !signal.reason.includes('Kriterlere') && !signal.reason.includes('Strateji')) {
            label = signal.reason;
        }
        return label || 'BAHİS';
    };

    return (
        <div className={`tb-terminal-wrapper ${mobileTableMode ? 'mobile-table-mode' : ''}`}>
            <table className="tb-table">
                <thead>
                    <tr>
                        <th style={{ width: '28px', textAlign: 'center' }}>★</th>
                        <th style={{ width: '46px' }}>{t?.minute_short || 'DK'}</th>
                        <th style={{ width: '100px' }}>{t?.league_label || 'LİG'}</th>
                        <th style={{ minWidth: '170px' }}>{t?.match_label || 'MAÇ'}</th>
                        <th style={{ width: '50px', textAlign: 'center' }}>{t?.score_label || 'SKOR'}</th>
                        <th style={{ width: '78px', textAlign: 'center' }}>{lang === 'tr' ? 'ISI / DURUM' : 'HEAT'}</th>
                        <th style={{ width: '72px', textAlign: 'center' }}>1X2 CANLI</th>
                        <th style={{ width: '58px', textAlign: 'center' }}>BASKI / IVME</th>
                        <th style={{ width: '56px', textAlign: 'center' }}>ŞUT (ISB)</th>
                        <th style={{ width: '54px', textAlign: 'center' }}>T.ATAK</th>
                        <th style={{ width: '56px', textAlign: 'center' }}>xG</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>AI SİNYAL</th>
                        <th style={{ width: '36px', textAlign: 'center' }}>DETAY</th>
                    </tr>
                </thead>
                <tbody>
                    {matches.length === 0 ? (
                        <tr>
                            <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--tb-text-muted)' }}>
                                {lang === 'tr' ? 'Seçili kriterlere uygun canlı maç bulunamadı.' : 'No live matches matching current criteria.'}
                            </td>
                        </tr>
                    ) : (
                        matches.map(m => {
                            const isExpanded = expandedMatchId === m.id;
                            const signal = signals[m.id];
                            const isPinned = pinnedMatchIds.has(m.id);
                            const rawHeat = calculateMatchHeatScore(m, signal);
                            const heat = (typeof rawHeat === 'number' && !isNaN(rawHeat)) ? rawHeat : 0;
                            const opp = (opportunitiesMap instanceof Map ? opportunitiesMap.get(m.id) : null) || m.opportunityData;
                            const rawScore = (opp?.score !== undefined && typeof opp.score === 'number' && !isNaN(opp.score)) ? opp.score : heat;
                            const heatScore = Math.max(0, Math.min(100, Math.round(rawScore || 0)));
                            const heatLevel = opp?.heatLevel || (heatScore >= 75 ? 'ALEV' : heatScore >= 50 ? 'SICAK' : 'SOGUK');
                            const heatIcon = heatLevel === 'ALPHA' ? '🚀' : heatLevel === 'ALEV' ? '🔥' : heatLevel === 'SICAK' ? '⚡' : '❄️';

                            const sogHome = m.stats?.shotsOnGoal?.home || 0;
                            const sogAway = m.stats?.shotsOnGoal?.away || 0;
                            const daHome = m.stats?.dangerousAttacks?.home || 0;
                            const daAway = m.stats?.dangerousAttacks?.away || 0;
                            const daDiff = Math.abs(daHome - daAway);
                            const xgHome = Number(m.stats?.xg?.home || 0);
                            const xgAway = Number(m.stats?.xg?.away || 0);

                            const redHome = Number(m.cards?.home?.red || m.stats?.cards?.home?.red || 0);
                            const redAway = Number(m.cards?.away?.red || m.stats?.cards?.away?.red || 0);
                            const yellowHome = Number(m.cards?.home?.yellow || m.stats?.cards?.home?.yellow || 0);
                            const yellowAway = Number(m.cards?.away?.yellow || m.stats?.cards?.away?.yellow || 0);

                            // Odds
                            const oddsHome = m.odds?.home || m.liveOdds?.home || '-';
                            const oddsDraw = m.odds?.draw || m.liveOdds?.draw || '-';
                            const oddsAway = m.odds?.away || m.liveOdds?.away || '-';

                            // Stat coloring logic: Only highlight if significant divergence (Color Discipline)
                            const daAlertClass = daDiff >= 20 ? 'alert-red' : daDiff >= 12 ? 'alert-amber' : 'neutral';
                            const heatAlertClass = heat >= 75 ? 'alert-red' : heat >= 55 ? 'alert-amber' : 'neutral';

                            // European Market Flow / Trending Bets
                            const matchTrendingBets = (trendingBets || []).filter(tb => 
                                consensusAdapter._isFuzzyMatch(tb.home, tb.away, m.homeTeam, m.awayTeam) ||
                                consensusAdapter._isFuzzyMatch(tb.away, tb.home, m.homeTeam, m.awayTeam)
                            );
                            const hasTrend = matchTrendingBets.length > 0;
                            const primaryTrend = hasTrend 
                                ? [...matchTrendingBets].sort((a, b) => (b.count || 0) - (a.count || 0))[0] 
                                : null;
                            const totalTrendCount = hasTrend
                                ? matchTrendingBets.reduce((sum, b) => sum + (b.count || 0), 0)
                                : 0;
                            const dqsVal = m.dqs !== undefined ? m.dqs : 0;
                            const isTrendApproved = hasTrend && dqsVal >= 0.50;
                            const isTrendTrap = hasTrend && dqsVal < 0.40;
                            const marketPrediction = hasTrend ? formatMarketPrediction(primaryTrend, lang) : '';

                            return (
                                <React.Fragment key={m.id}>
                                    <tr
                                        className={`tb-row ${isExpanded ? 'expanded' : ''}`}
                                        onClick={(e) => handleRowClick(m, e)}
                                    >
                                        {/* Pin / Star */}
                                        <td style={{ textAlign: 'center' }} className="tb-action-ignore">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: isPinned ? '#facc15' : 'rgba(255,255,255,0.2)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                                title={isPinned ? 'Favorilerden Çıkar' : 'Favoriye Ekle'}
                                            >
                                                ★
                                            </button>
                                        </td>

                                        {/* Minute */}
                                        <td className="tb-col-min">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="tb-pulse-dot" />
                                                {formatMinute(m.minute)}
                                            </span>
                                        </td>

                                        {/* League */}
                                        <td className="tb-col-league" title={m.league || m.leagueName || 'League'}>
                                            <span style={{ opacity: 0.6, marginRight: '3px' }}>T{m.tier || 1}</span>
                                            {m.league || m.leagueName || 'Futbol'}
                                        </td>

                                        {/* Teams */}
                                        <td>
                                            <div className="tb-col-match">
                                                <span className="tb-team-name" style={{ textAlign: 'right', flex: 1 }}>
                                                    {m.homeTeam}
                                                </span>

                                                {/* Home Cards */}
                                                {redHome > 0 && <span className="tb-card-badge tb-card-red">{redHome}</span>}
                                                {yellowHome > 0 && <span className="tb-card-badge tb-card-yellow">{yellowHome}</span>}

                                                <span style={{ color: 'var(--tb-text-muted)', fontSize: '0.72rem' }}>vs</span>

                                                {/* Away Cards */}
                                                {yellowAway > 0 && <span className="tb-card-badge tb-card-yellow">{yellowAway}</span>}
                                                {redAway > 0 && <span className="tb-card-badge tb-card-red">{redAway}</span>}

                                                <span className="tb-team-name" style={{ textAlign: 'left', flex: 1 }}>
                                                    {m.awayTeam}
                                                </span>
                                            </div>

                                            {/* Market Trend Pill (Shows exact market pick & volume) */}
                                            {hasTrend && (
                                                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span
                                                        className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}
                                                        title={`Piyasa Bahis Hacmi: ${totalTrendCount} Kupon • Pazar: ${primaryTrend.market || ''} • Tercih: ${primaryTrend.outcome || ''} (@${primaryTrend.odds || ''})`}
                                                    >
                                                        <span>{isTrendApproved ? '🟢' : isTrendTrap ? '🔴' : '📊'}</span>
                                                        <span style={{ fontWeight: 900 }}>
                                                            {isTrendApproved ? (lang === 'tr' ? 'AKILLI PARA:' : 'SMART MONEY:') : isTrendTrap ? (lang === 'tr' ? 'TUZAK ALARMI:' : 'TRAP ALERT:') : (lang === 'tr' ? 'PİYASA AKIŞI:' : 'MARKET INFLUX:')}
                                                        </span>
                                                        <span className="tb-trend-pred">
                                                            {marketPrediction}
                                                        </span>
                                                        {primaryTrend.odds && (
                                                            <span className="tb-trend-odds">
                                                                @{typeof primaryTrend.odds === 'number' ? primaryTrend.odds.toFixed(2) : primaryTrend.odds}
                                                            </span>
                                                        )}
                                                        <span style={{ opacity: 0.8, fontSize: '0.62rem' }}>• {totalTrendCount} {lang === 'tr' ? 'Kupon' : 'Bets'}</span>
                                                    </span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Score */}
                                        <td className="tb-col-score">
                                            {formatScore(m.score)}
                                        </td>

                                        {/* Heat Level & Score Badge */}
                                        <td style={{ textAlign: 'center' }}>
                                            <span
                                                className={`tb-heat-badge tb-heat-${(heatLevel || 'soguk').toLowerCase()}`}
                                                title={`Isı Skoru: ${heatScore} • Seviye: ${heatLevel}${opp?.trend ? ` • Trend: ${opp.trend}` : ''}`}
                                            >
                                                {heatIcon} {heatScore} {heatLevel}
                                            </span>
                                        </td>

                                        {/* 1X2 Odds */}
                                        <td className="tb-stat-cell" style={{ fontSize: '0.72rem' }}>
                                            {oddsHome !== '-' ? (
                                                <span>{oddsHome} / {oddsDraw} / {oddsAway}</span>
                                            ) : (
                                                <span style={{ color: 'var(--tb-text-muted)' }}>-</span>
                                            )}
                                        </td>

                                        {/* Pressure / Momentum Index */}
                                        <td className="tb-stat-cell">
                                            <span className={`tb-pill-stat ${heatAlertClass}`}>
                                                %{heat}
                                            </span>
                                        </td>

                                        {/* Shots on Goal */}
                                        <td className="tb-stat-cell">
                                            <span>{sogHome} - {sogAway}</span>
                                        </td>

                                        {/* Dangerous Attacks */}
                                        <td className="tb-stat-cell">
                                            <span className={`tb-pill-stat ${daAlertClass}`}>
                                                {daHome} - {daAway}
                                            </span>
                                        </td>

                                        {/* xG */}
                                        <td className="tb-stat-cell">
                                            {(xgHome > 0 || xgAway > 0) ? (
                                                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                                    {xgHome.toFixed(2)} - {xgAway.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--tb-text-muted)' }}>-</span>
                                            )}
                                        </td>

                                        {/* AI Signal */}
                                        <td style={{ textAlign: 'center' }}>
                                            {(() => {
                                                const minStr = String(m?.minute || '').trim();
                                                const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
                                                const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;
                                                const predText = getPredictionDisplay(m, signal);

                                                if (isLateOrFinished) {
                                                    return (
                                                        <span className="tb-signal-badge tb-signal-pass" style={{ opacity: 0.6 }}>
                                                            {minStr === 'MS' || minStr.includes('FT') ? 'MS' : 'KİLİTLİ (88+)'}
                                                        </span>
                                                    );
                                                }

                                                const isAdmin = userProfile?.plan === 'admin' || userProfile?.role === 'admin';
                                                const isExpired = !isAdmin && userProfile && (userProfile?.status === 'expired' || (userProfile?.subscription_end && new Date(userProfile.subscription_end) < new Date()));

                                                if (isExpired && (signal?.verdict === 'BET' || heat >= 75)) {
                                                    return (
                                                        <span
                                                            className="tb-signal-badge tb-signal-bet"
                                                            onClick={(e) => { e.stopPropagation(); onOpenUpgrade(); }}
                                                            style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #a78bfa, #38bdf8)', color: '#000', fontWeight: 900, boxShadow: '0 0 10px rgba(167, 139, 250, 0.4)' }}
                                                            title={lang === 'tr' ? 'VIP Sinyal Kilidini Aç' : 'Unlock VIP Signal'}
                                                        >
                                                            🔒 VIP KİLİDİ
                                                        </span>
                                                    );
                                                }

                                                if (signal?.verdict === 'BET' && predText) {
                                                    return (
                                                        <span
                                                            className="tb-signal-badge tb-signal-bet"
                                                            title={signal.reason || signal.mainReason || 'AI Strateji Onaylandı'}
                                                        >
                                                            ✓ {predText}
                                                        </span>
                                                    );
                                                }

                                                if (heat >= 75) {
                                                    return (
                                                        <span className="tb-signal-badge tb-signal-hot">
                                                            🔥 ALEV
                                                        </span>
                                                    );
                                                }

                                                if ((m.dqs || 0) >= (CONFIG?.DECISION?.DQS_THRESHOLD || 0.60)) {
                                                    return (
                                                        <span className="tb-signal-badge tb-signal-pass" style={{ color: '#38bdf8' }}>
                                                            DQS {(m.dqs || 0).toFixed(2)}
                                                        </span>
                                                    );
                                                }

                                                return (
                                                    <span className="tb-signal-badge tb-signal-pass">
                                                        {t?.verdict_pass || 'PAS'}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Detail Expand Arrow */}
                                        <td style={{ textAlign: 'center', color: 'var(--tb-text-muted)' }}>
                                            <span style={{ fontSize: '0.8rem', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                                ▼
                                            </span>
                                        </td>
                                    </tr>

                                    {/* Inline Accordion Detail Tray */}
                                    {isExpanded && (
                                        <tr className="tb-expanded-row">
                                            <td colSpan={13}>
                                                <div className="tb-expanded-content">
                                                    {/* Left: Momentum Graph & Timeline */}
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--tb-text-secondary)' }}>
                                                                📈 {lang === 'tr' ? 'CANLI BASKI GRAFİĞİ' : 'LIVE MOMENTUM GRAPH'}
                                                            </span>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--tb-text-muted)' }}>
                                                                DQS: {(m.dqs || 0).toFixed(2)} | Tier: {m.tier || 1}
                                                            </span>
                                                        </div>
                                                        {AttackMomentumGraph && (
                                                            <AttackMomentumGraph match={m} />
                                                        )}
                                                    </div>

                                                    {/* Right: Quick Action & Signal Card */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between' }}>
                                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--tb-border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>
                                                                    🎯 {lang === 'tr' ? 'YAPAY ZEKA ANALİZİ & STRATEJİ' : 'AI MATCH CONVICTION'}
                                                                </span>
                                                                {signal?.verdict === 'BET' && getPredictionDisplay(m, signal) && (
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        ÖNERİ: {getPredictionDisplay(m, signal)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--tb-text-secondary)', lineHeight: 1.4 }}>
                                                                {signal?.reason || signal?.mainReason || m.opportunityData?.reason || (lang === 'tr' ? 'Maç istatistiksel olarak radar altında izleniyor.' : 'Match is actively tracked under live radar.')}
                                                            </div>
                                                            {signal?.activeStrategies && signal.activeStrategies.length > 0 && (
                                                                <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                    {signal.activeStrategies.map((strat, sIdx) => (
                                                                        <span
                                                                            key={sIdx}
                                                                            style={{
                                                                                background: 'rgba(16, 185, 129, 0.12)',
                                                                                color: '#34d399',
                                                                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                                padding: '3px 8px',
                                                                                borderRadius: '4px',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 700
                                                                            }}
                                                                        >
                                                                            ⚡ {strat.label} {strat.score ? `(%${Math.round(strat.score)})` : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* European Market Flow Detail */}
                                                        {hasTrend && (
                                                            <div className="tb-trend-box">
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>
                                                                        📈 {lang === 'tr' ? 'AVRUPA PİYASA AKIŞI & HALK BAHİSİ' : 'EUROPEAN MARKET FLOW & PUBLIC BET'}
                                                                    </span>
                                                                    <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}>
                                                                        {isTrendApproved 
                                                                            ? (lang === 'tr' ? '🟢 DQS ONAYLADI (AKILLI PARA)' : '🟢 DQS CONFIRMED (SMART MONEY)')
                                                                            : isTrendTrap 
                                                                            ? (lang === 'tr' ? '🔴 DİKKAT: TUZAK UYARISI' : '🔴 WARNING: TRAP ALERT')
                                                                            : (lang === 'tr' ? '📊 YOĞUN HALK AKIŞI' : '📊 HIGH PUBLIC INFLUX')}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--tb-text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                                                                    <span><strong>{lang === 'tr' ? 'Piyasa Tercihi / Tahmini:' : 'Market Prediction:'}</strong> <span style={{ color: '#fff', fontWeight: 900 }}>{marketPrediction}</span></span>
                                                                    <span><strong>{lang === 'tr' ? 'Pazar:' : 'Market:'}</strong> {primaryTrend.market}</span>
                                                                    <span><strong>{lang === 'tr' ? 'Oran:' : 'Odds:'}</strong> <span style={{ color: '#fbbf24', fontWeight: 800 }}>@{primaryTrend.odds}</span></span>
                                                                    <span><strong>{lang === 'tr' ? 'Son 5 Dk Hacim:' : 'Last 5m Volume:'}</strong> <span style={{ color: '#f87171', fontWeight: 800 }}>{totalTrendCount} {lang === 'tr' ? 'Kupon' : 'Coupons'}</span></span>
                                                                </div>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--tb-text-muted)', lineHeight: 1.4 }}>
                                                                    {isTrendApproved
                                                                        ? (lang === 'tr' 
                                                                            ? `Yüksek DQS (%${(dqsVal * 100).toFixed(0)}) & saha verisi piyasadaki kalabalığın bahsini (${marketPrediction}) doğruluyor.` 
                                                                            : `High DQS (${(dqsVal * 100).toFixed(0)}%) and match stats confirm the public bet (${marketPrediction}).`)
                                                                        : isTrendTrap
                                                                        ? (lang === 'tr'
                                                                            ? `Düşük DQS (%${(dqsVal * 100).toFixed(0)}) & yetersiz saha temposu. Kalabalık piyasada (${marketPrediction}) tercihine tuzağa çekiliyor olabilir!`
                                                                            : `Low DQS (${(dqsVal * 100).toFixed(0)}%) and low intensity. The crowd betting on (${marketPrediction}) may be in a trap!`)
                                                                        : (lang === 'tr'
                                                                            ? `Orta seviye DQS (%${(dqsVal * 100).toFixed(0)}%). Saha aksiyonunu yakından gözlemleyin.`
                                                                            : `Moderate DQS (${(dqsVal * 100).toFixed(0)}%). Monitor ongoing pitch dynamics.`)}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {signal?.verdict === 'BET' && bankrollManager && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="tb-action-ignore">
                                                                <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#34d399', display: 'block' }}>{t?.recom_stake_short || 'Önerilen Kasa'}</span>
                                                                    <span style={{ fontWeight: 900, color: '#f1f5f9', fontSize: '0.9rem' }}>
                                                                        {bankrollManager.calculateRecommendedStake(m, signal)} ₺
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onApproveBet(m, signal)}
                                                                    style={{
                                                                        background: '#10b981',
                                                                        color: '#000',
                                                                        border: 'none',
                                                                        padding: '0.75rem 1.25rem',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 900,
                                                                        fontSize: '0.78rem',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {t?.approve_bet || 'BAHSİ ONAYLA'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};
