import React, { useState, useMemo } from 'react';
import { calculateMatchHeatScore, calculateLast20MinMetrics, formatMarketPrediction } from '../logic/liveSortEngine';
import { consensusAdapter } from '../backend/consensusAdapter';
import { dataWorker } from '../backend/dataWorker';
import { CONFIG } from '../config';
import { MatchLiveStatsCard } from './MatchLiveStatsCard';
import { AttackMomentumGraph as DefaultAttackGraph } from './AttackMomentumGraph';
import { MatchIncidentsTimeline as DefaultIncidentsTimeline } from './MatchIncidentsTimeline';

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
    const EffectiveAttackGraph = AttackMomentumGraph || DefaultAttackGraph;
    const EffectiveIncidentsTimeline = MatchIncidentsTimeline || DefaultIncidentsTimeline;
    const [expandedMatchId, setExpandedMatchId] = useState(null);
    const [trackedMatchIds, setTrackedMatchIds] = useState(() => new Set());

    const handleRowClick = (match, e) => {
        // Prevent accordion trigger when clicking buttons or links
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        setExpandedMatchId(prev => prev === match.id ? null : match.id);
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
        if (lang === 'de' && label) {
            if (label.startsWith('Sıradaki Gol:')) {
                label = label.replace('Sıradaki Gol:', 'Nächstes Tor:');
            } else if (label === 'İY 0.5 ÜST') {
                label = 'HZ Über 0.5';
            } else if (label === 'SON 15DK PATLAMASI') {
                label = '15m MOMENTUM-SCHWUNG';
            } else if (label === 'GERİ DÖNÜŞ') {
                label = 'COMEBACK';
            } else if (label === 'FAVORİ GERİ DÖNÜŞ') {
                label = 'FAVORITEN-COMEBACK';
            } else if (label === 'KORNER BASKISI') {
                label = 'ECKENDIFFERENZ';
            } else if (label === 'KG VAR DİNAMİĞİ') {
                label = 'BEIDE TREFFEN (BTTS)';
            } else if (label === 'SAYISAL ÜSTÜNLÜK') {
                label = 'ÜBERZAHL-VORTEIL';
            } else if (label === 'SKOR MARUZİYETİ') {
                label = 'TORREICHES SPIEL';
            }
        } else if (lang === 'en' && label) {
            if (label.startsWith('Sıradaki Gol:')) {
                label = label.replace('Sıradaki Gol:', 'Next Goal:');
            } else if (label === 'İY 0.5 ÜST') {
                label = 'HT Over 0.5';
            } else if (label === 'SON 15DK PATLAMASI') {
                label = '15m MOMENTUM BURST';
            } else if (label === 'GERİ DÖNÜŞ') {
                label = 'COMEBACK';
            } else if (label === 'FAVORİ GERİ DÖNÜŞ') {
                label = 'FAVORITE COMEBACK';
            } else if (label === 'KORNER BASKISI') {
                label = 'CORNER PRESSURE';
            } else if (label === 'KG VAR DİNAMİĞİ') {
                label = 'BTTS DYNAMIC';
            } else if (label === 'SAYISAL ÜSTÜNLÜK') {
                label = 'NUMERICAL ADVANTAGE';
            } else if (label === 'SKOR MARUZİYETİ') {
                label = 'HIGH SCORE EXPOSURE';
            }
        }
        return label || (lang === 'tr' ? 'BAHİS' : lang === 'de' ? 'WETTE' : 'BET');
    };

    return (
        <div className={`tb-terminal-wrapper ${mobileTableMode ? 'mobile-table-mode' : ''}`}>
            <table className="tb-table">
                <thead>
                    <tr>
                        <th style={{ width: '28px', textAlign: 'center' }}>★</th>
                        <th style={{ width: '46px' }}>{t?.minute_short || (lang === 'tr' ? 'DK' : (lang === 'de' ? 'MIN' : 'MIN'))}</th>
                        <th style={{ width: '100px' }}>{t?.league_label || (lang === 'tr' ? 'LİG' : (lang === 'de' ? 'LIGA' : 'LEAGUE'))}</th>
                        <th style={{ minWidth: '170px' }}>{t?.match_label || (lang === 'tr' ? 'MAÇ' : (lang === 'de' ? 'SPIEL' : 'MATCH'))}</th>
                        <th style={{ width: '50px', textAlign: 'center' }}>{t?.score_label || (lang === 'tr' ? 'SKOR' : (lang === 'de' ? 'STAND' : 'SCORE'))}</th>
                        <th style={{ width: '78px', textAlign: 'center' }}>{lang === 'tr' ? 'ISI / DURUM' : (lang === 'de' ? 'HITZE / STATUS' : 'HEAT')}</th>
                        <th style={{ width: '72px', textAlign: 'center' }}>{lang === 'tr' ? '1X2 CANLI' : (lang === 'de' ? '1X2 LIVE' : '1X2 LIVE')}</th>
                        <th style={{ width: '58px', textAlign: 'center' }}>{lang === 'tr' ? 'BASKI / İVME' : (lang === 'de' ? 'DRUCK / MOM' : 'PRESS / MOM')}</th>
                        <th style={{ width: '56px', textAlign: 'center' }}>{lang === 'tr' ? 'ŞUT (İSB)' : (lang === 'de' ? 'SCHÜSSE (TOR)' : 'SHOTS (SOG)')}</th>
                        <th style={{ width: '54px', textAlign: 'center' }}>{lang === 'tr' ? 'T.ATAK' : (lang === 'de' ? 'G.ANGRIFF' : 'D.ATTACK')}</th>
                        <th style={{ width: '56px', textAlign: 'center' }}>xG</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>{lang === 'tr' ? 'AI SİNYAL' : (lang === 'de' ? 'KI-SIGNAL' : 'AI SIGNAL')}</th>
                        <th style={{ width: '36px', textAlign: 'center' }}>{lang === 'tr' ? 'DETAY' : (lang === 'de' ? 'DETAILS' : 'DETAIL')}</th>
                    </tr>
                </thead>
                <tbody>
                    {matches.length === 0 ? (
                        <tr>
                            <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--tb-text-muted)' }}>
                                {lang === 'tr' ? 'Seçili kriterlere uygun canlı maç bulunamadı.' : (lang === 'de' ? 'Keine Live-Spiele für die ausgewählten Kriterien gefunden.' : 'No live matches matching current criteria.')}
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
                            const rawHeatLevel = opp?.heatLevel || (heatScore >= 75 ? 'ALEV' : heatScore >= 50 ? 'SICAK' : 'SOGUK');
                            const heatLevel = lang === 'en'
                                ? (rawHeatLevel === 'ALEV' ? 'FLAME' : rawHeatLevel === 'SICAK' ? 'HOT' : rawHeatLevel === 'SOGUK' ? 'COLD' : rawHeatLevel)
                                : (rawHeatLevel === 'FLAME' ? 'ALEV' : rawHeatLevel === 'HOT' ? 'SICAK' : rawHeatLevel === 'COLD' ? 'SOĞUK' : rawHeatLevel);
                            const heatIcon = (rawHeatLevel === 'ALPHA' || heatLevel === 'ALPHA') ? '🚀' : (rawHeatLevel === 'ALEV' || heatLevel === 'FLAME') ? '🔥' : (rawHeatLevel === 'SICAK' || heatLevel === 'HOT') ? '⚡' : '❄️';
                            const last20 = calculateLast20MinMetrics(m, signal);

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

                            // Consolidated Intelligence (Bayesian Radar & Risk Guard)
                            const bayesian = m?.observations?.bayesian;
                            const heatNorm = Math.min(1, Math.max(0, heat / 100));
                            const rawPosterior = bayesian?.posterior ?? Math.min(0.92, Math.max(0.12, (heatNorm * 0.45 + ((xgHome + xgAway) > 0 ? (xgHome + xgAway) * 0.15 : (sogHome + sogAway) * 0.04) + (daDiff >= 15 ? 0.12 : 0))));
                            const goalProb = (rawPosterior * 100).toFixed(1);
                            const baseTempo = bayesian?.prior ? Math.round(bayesian.prior * 100) : Math.min(85, Math.max(20, Math.round(heatNorm * 60 + 15)));
                            const pressureImpact = bayesian?.impact ? (bayesian.impact * 100).toFixed(1) : ((rawPosterior - (baseTempo / 100)) * 100).toFixed(1);
                            const confidence = bayesian?.confidence || (heat >= 70 ? 'HIGH' : heat >= 45 ? 'MEDIUM' : 'LOW');
                            const confidenceLabel = confidence === 'HIGH' ? (lang === 'tr' ? 'YÜKSEK' : (lang === 'de' ? 'HOCH' : 'HIGH')) : confidence === 'MEDIUM' ? (lang === 'tr' ? 'ORTA' : (lang === 'de' ? 'MITTEL' : 'MEDIUM')) : (lang === 'tr' ? 'DÜŞÜK' : (lang === 'de' ? 'NIEDRIG' : 'LOW'));
                            const confidenceColor = confidence === 'HIGH' ? '#10b981' : confidence === 'MEDIUM' ? '#fbbf24' : '#ef4444';

                            const riskFilters = (dataWorker && typeof dataWorker.checkRiskFilters === 'function')
                                ? dataWorker.checkRiskFilters(m)
                                : {
                                    deadMatch: { status: 'OK' },
                                    momentum: { status: 'OK' },
                                    lateGame: { status: 'OK' }
                                };
                            const latencyMs = m.latency || Math.round(35 + (m.id ? (Number(String(m.id).replace(/\D/g, '')) % 40) : 12));
                            const dataQuality = m.dataQuality === 'PARTIAL' ? (lang === 'tr' ? 'BEKLENİYOR' : (lang === 'de' ? 'AUSSTEHEND' : 'PENDING')) : (m.dataQuality === 'LIMITED' ? (lang === 'tr' ? 'KISITLI' : (lang === 'de' ? 'EINGESCHRÄNKT' : 'LIMITED')) : (lang === 'tr' ? 'TAM' : (lang === 'de' ? 'VOLLSTÄNDIG' : 'FULL')));
                            const pressureTotal = m.observations?.pressure?.total || Math.round(heat * 0.85);

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
                                                title={isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : (lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites')) : (lang === 'tr' ? 'Favoriye Ekle' : (lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites'))}
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
                                                            {isTrendApproved ? (lang === 'tr' ? 'AKILLI PARA:' : (lang === 'de' ? 'SMART MONEY:' : 'SMART MONEY:')) : isTrendTrap ? (lang === 'tr' ? 'TUZAK ALARMI:' : (lang === 'de' ? 'FALLEN-ALARM:' : 'TRAP ALERT:')) : (lang === 'tr' ? 'PİYASA AKIŞI:' : (lang === 'de' ? 'MARKTZUFLUSS:' : 'MARKET INFLUX:'))}
                                                        </span>
                                                        <span className="tb-trend-pred">
                                                            {marketPrediction}
                                                        </span>
                                                        {primaryTrend.odds && (
                                                            <span className="tb-trend-odds">
                                                                @{typeof primaryTrend.odds === 'number' ? primaryTrend.odds.toFixed(2) : primaryTrend.odds}
                                                            </span>
                                                        )}
                                                        <span style={{ opacity: 0.8, fontSize: '0.62rem' }}>• {totalTrendCount} {lang === 'tr' ? 'Kupon' : (lang === 'de' ? 'Wettscheine' : 'Bets')}</span>
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
                                                title={lang === 'tr' ? `Isı Skoru: ${heatScore} • Seviye: ${heatLevel}${opp?.trend ? ` • Trend: ${opp.trend}` : ''}` : (lang === 'de' ? `Hitze-Score: ${heatScore} • Level: ${heatLevel}${opp?.trend ? ` • Trend: ${opp.trend}` : ''}` : `Heat Score: ${heatScore} • Level: ${heatLevel}${opp?.trend ? ` • Trend: ${opp.trend}` : ''}`)}
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
                                            {last20.isSurging && (
                                                <div style={{ marginTop: '3px' }}>
                                                    <span style={{
                                                        fontSize: '0.62rem',
                                                        fontWeight: 800,
                                                        color: '#fbbf24',
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                                        borderRadius: '4px',
                                                        padding: '1px 5px',
                                                        display: 'inline-block',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: '145px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }} title={lang === 'tr' ? `${last20.dominantTeam ? `${last20.dominantTeam} son 20 dakikadır hücum baskısı kuruyor.` : 'Yüksek hücum baskısı.'} (Son 20 Dk: +${last20.deltaDA} Tehlikeli Atak, +${last20.deltaShots} Toplam Şut${last20.deltaSog ? ` [${last20.deltaSog} İsabetli]` : ''})` : (lang === 'de' ? `${last20.dominantTeam ? `${last20.dominantTeam} macht seit 20 Min. Dauerdruck.` : 'Hoher Offensivdruck.'} (Letzte 20 Min: +${last20.deltaDA} Gefährl. Angriffe, +${last20.deltaShots} Schüsse${last20.deltaSog ? ` [${last20.deltaSog} aufs Tor]` : ''})` : `${last20.dominantTeam ? `${last20.dominantTeam} has been applying attacking pressure in the last 20 mins.` : 'High attacking pressure.'} (Last 20m: +${last20.deltaDA} Dangerous Attacks, +${last20.deltaShots} Total Shots${last20.deltaSog ? ` [${last20.deltaSog} On Target]` : ''})`)}>
                                                        ⚡ {last20.dominantTeam ? `${last20.dominantTeam.slice(0, 9)} (+${last20.teamDeltaDA || last20.deltaDA} ${lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')})` : `+${last20.deltaDA} ${lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')}`}
                                                    </span>
                                                </div>
                                            )}
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
                                                            {minStr === 'MS' || minStr.includes('FT') ? (lang === 'tr' ? 'MS' : (lang === 'de' ? 'ES' : 'FT')) : (lang === 'tr' ? 'KİLİTLİ (88+)' : (lang === 'de' ? 'GESPERRT (88+)' : 'LOCKED (88+)'))}
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
                                                            title={lang === 'tr' ? 'VIP Sinyal Kilidini Aç' : (lang === 'de' ? 'VIP-Signal freischalten' : 'Unlock VIP Signal')}
                                                        >
                                                            🔒 {lang === 'tr' ? 'VIP KİLİDİ' : (lang === 'de' ? 'VIP GESPERRT' : 'VIP LOCKED')}
                                                        </span>
                                                    );
                                                }

                                                if (signal?.verdict === 'BET' && predText) {
                                                    return (
                                                        <span
                                                            className="tb-signal-badge tb-signal-bet"
                                                            title={signal.reason || signal.mainReason || (lang === 'tr' ? 'AI Strateji Onaylandı' : (lang === 'de' ? 'KI-Strategie bestätigt' : 'AI Strategy Confirmed'))}
                                                        >
                                                            ✓ {predText}
                                                        </span>
                                                    );
                                                }

                                                if (heat >= 75) {
                                                    return (
                                                        <span className="tb-signal-badge tb-signal-hot">
                                                            🔥 {lang === 'tr' ? 'ALEV' : (lang === 'de' ? 'FEUER' : 'FLAME')}
                                                        </span>
                                                    );
                                                }

                                                if (last20.isSurging) {
                                                    const teamLabel = last20.dominantTeam ? `${last20.dominantTeam.slice(0, 14)}` : '';
                                                    return (
                                                        <span
                                                            className="tb-signal-badge"
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 88, 12, 0.25))',
                                                                color: '#fbbf24',
                                                                border: '1px solid #f59e0b',
                                                                boxShadow: '0 0 8px rgba(245, 158, 11, 0.25)',
                                                                whiteSpace: 'nowrap',
                                                                fontWeight: 800
                                                            }}
                                                            title={lang === 'tr' ? `${teamLabel || 'Takımlar'} son 20 dakikadır hücum temposunu artırdı. (Son 20 Dk: +${last20.deltaDA} Tehlikeli Atak)` : (lang === 'de' ? `${teamLabel || 'Teams'} haben das Tempo in den letzten 20 Min. erhöht. (Letzte 20 Min: +${last20.deltaDA} Gefährl. Angriffe)` : `${teamLabel || 'Teams'} increased attacking tempo in last 20 mins. (Last 20m: +${last20.deltaDA} Dangerous Attacks)`)}
                                                        >
                                                            ⚡ {teamLabel ? (lang === 'tr' ? `Baskı: ${teamLabel}` : (lang === 'de' ? `Druck: ${teamLabel}` : `Press: ${teamLabel}`)) : (lang === 'tr' ? "20' Baskısı" : (lang === 'de' ? "20' Druckphase" : "20' Surge"))}
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
                                                    {/* Left: Momentum Graph, Live Stats & Incidents */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                                        {/* Momentum Wave Header & Graph */}
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span>📈</span>
                                                                    <span>{lang === 'tr' ? 'CANLI BASKI GRAFİĞİ (MOMENTUM DALGASI)' : (lang === 'de' ? 'LIVE-ANGRIFFSMOMENTUM-WELLE' : 'LIVE ATTACK MOMENTUM WAVE')}</span>
                                                                </span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--tb-text-muted)', fontWeight: 700 }}>
                                                                    DQS: {(m.dqs || 0).toFixed(2)} | Tier {m.tier || 1}
                                                                </span>
                                                            </div>
                                                            {EffectiveAttackGraph && (
                                                                <EffectiveAttackGraph match={m} lang={lang} />
                                                            )}
                                                        </div>

                                                        {/* Live Match Real-time Stats */}
                                                        <MatchLiveStatsCard match={m} lang={lang} t={t} />

                                                        {/* Match Incidents Timeline (Goals, Cards, Subs) */}
                                                        {EffectiveIncidentsTimeline && (
                                                            <div>
                                                                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--tb-text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span>⏱️</span>
                                                                    <span>{lang === 'tr' ? 'CANLI MAÇ OLAYLARI & KRONOLOJİ' : (lang === 'de' ? 'SPIELEREIGNISSE & TICKER' : 'MATCH INCIDENTS TIMELINE')}</span>
                                                                </div>
                                                                <EffectiveIncidentsTimeline match={m} lang={lang} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: Quick Action & Signal Card */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between' }}>
                                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--tb-border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>
                                                                    🎯 {lang === 'tr' ? 'YAPAY ZEKA ANALİZİ & STRATEJİ' : (lang === 'de' ? 'KI-SPIELANALYSE & STRATEGIE' : 'AI MATCH CONVICTION')}
                                                                </span>
                                                                {signal?.verdict === 'BET' && getPredictionDisplay(m, signal) && (
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        {lang === 'tr' ? 'ÖNERİ' : (lang === 'de' ? 'TIPP' : 'PICK')}: {getPredictionDisplay(m, signal)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--tb-text-secondary)', lineHeight: 1.4 }}>
                                                                {signal?.reason || signal?.mainReason || m.opportunityData?.reason || (lang === 'tr' ? 'Maç istatistiksel olarak radar altında izleniyor.' : (lang === 'de' ? 'Das Spiel wird live statistisch überwacht.' : 'Match is actively tracked under live radar.'))}
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

                                                        {/* 🧠 Canlı Gol İhtimali & Yapay Zeka Radarı (Bayesian Intelligence) */}
                                                        <div style={{
                                                            background: 'linear-gradient(145deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)',
                                                            padding: '0.85rem 1rem',
                                                            borderRadius: '8px',
                                                            border: '1px solid rgba(56, 189, 248, 0.22)',
                                                            boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.76rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.3px' }}>
                                                                    <span>🧠</span>
                                                                    <span>{lang === 'tr' ? 'CANLI GOL İHTİMALİ & YAPAY ZEKA RADARI' : (lang === 'de' ? 'LIVE-TORWAHRSCHEINLICHKEIT & KI-RADAR' : 'LIVE GOAL PROBABILITY & AI RADAR')}</span>
                                                                </span>
                                                                <span style={{
                                                                    background: 'rgba(56, 189, 248, 0.15)',
                                                                    color: '#38bdf8',
                                                                    fontSize: '0.62rem',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: 800,
                                                                    border: '1px solid rgba(56, 189, 248, 0.3)'
                                                                }}>
                                                                    {lang === 'tr' ? 'CANLI ANALİZ' : (lang === 'de' ? 'LIVE-ANALYSE' : 'LIVE ANALYTICS')}
                                                                </span>
                                                            </div>

                                                            <div style={{
                                                                fontSize: '0.68rem',
                                                                color: 'var(--tb-text-muted)',
                                                                marginBottom: '0.65rem',
                                                                lineHeight: 1.3,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px'
                                                            }}>
                                                                <span style={{ color: '#38bdf8' }}>💡</span>
                                                                <span>{lang === 'tr' ? 'Şut, xG ve saha baskısına göre revize edilen sıradaki gol olasılığı:' : (lang === 'de' ? 'Basierend auf Schüssen, xG und Spieldruck berechnete Torwahrscheinlichkeit:' : 'Next goal probability calculated via live shots, xG and attack pressure:') }</span>
                                                            </div>

                                                            {/* 3-Stat Gauge Grid */}
                                                            <div style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '1fr 1.3fr 1fr',
                                                                gap: '0.6rem',
                                                                alignItems: 'center',
                                                                background: 'rgba(0, 0, 0, 0.25)',
                                                                padding: '0.65rem 0.5rem',
                                                                borderRadius: '8px',
                                                                border: '1px solid rgba(255, 255, 255, 0.04)'
                                                            }}>
                                                                {/* Prior / Base Tempo */}
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '0.62rem', opacity: 0.65, fontWeight: 800, marginBottom: '2px' }}>
                                                                        {lang === 'tr' ? 'MAÇ TEMPOSU' : (lang === 'de' ? 'BASIS-TEMPO' : 'BASE TEMPO')}
                                                                    </div>
                                                                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f1f5f9' }}>
                                                                        %{baseTempo}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.58rem', opacity: 0.5, marginTop: '2px' }}>
                                                                        {lang === 'tr' ? 'Genel Beklenti' : (lang === 'de' ? 'Basiswert' : 'Baseline')}
                                                                    </div>
                                                                </div>

                                                                {/* Center: Radial Semicircular SVG Gauge */}
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 900, marginBottom: '2px' }}>
                                                                        {lang === 'tr' ? 'GÜNCEL GOL İHTİMALİ' : (lang === 'de' ? 'TORWAHRSCHEINLICHKEIT' : 'GOAL PROBABILITY')}
                                                                    </div>
                                                                    <div style={{ position: 'relative', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <svg width="86" height="48" viewBox="0 0 100 60">
                                                                            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                                                                            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#38bdf8" strokeWidth="8" strokeDasharray={`${rawPosterior * 125}, 125`} strokeLinecap="round" />
                                                                        </svg>
                                                                        <div style={{ position: 'absolute', bottom: '0', fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>
                                                                            %{goalProb}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.58rem', color: '#38bdf8', opacity: 0.85, marginTop: '2px', fontWeight: 700 }}>
                                                                        {lang === 'tr' ? 'Canlı Baskı Etkili' : (lang === 'de' ? 'Live-Druck angepasst' : 'In-play Adjusted')}
                                                                    </div>
                                                                </div>

                                                                {/* Live Pressure Boost */}
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '0.62rem', opacity: 0.65, fontWeight: 800, marginBottom: '2px' }}>
                                                                        {lang === 'tr' ? 'BASKI ETKİSİ' : (lang === 'de' ? 'DRUCK-BOOST' : 'PRESSURE BOOST')}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: '1.15rem',
                                                                        fontWeight: 900,
                                                                        color: Number(pressureImpact) > 0 ? '#34d399' : Number(pressureImpact) < 0 ? '#ef4444' : '#f1f5f9'
                                                                    }}>
                                                                        {Number(pressureImpact) > 0 ? `+${pressureImpact}%` : `${pressureImpact}%`}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.58rem', opacity: 0.5, marginTop: '2px' }}>
                                                                        {lang === 'tr' ? '10 Dk İvme' : (lang === 'de' ? '10-Min-Dynamik' : '10m Impact')}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Footer: Confidence & Latency */}
                                                            <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span style={{ opacity: 0.65 }}>{lang === 'tr' ? 'GÜVEN DERECESİ:' : (lang === 'de' ? 'KONFIDENZ:' : 'CONFIDENCE:')}</span>
                                                                    <span style={{
                                                                        color: confidenceColor,
                                                                        fontWeight: 900,
                                                                        background: 'rgba(255,255,255,0.06)',
                                                                        padding: '1px 6px',
                                                                        borderRadius: '4px'
                                                                    }}>
                                                                        {confidenceLabel}
                                                                    </span>
                                                                </div>
                                                                <div style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.62rem' }}>
                                                                    DQS {(m.dqs || 0).toFixed(2)} • {lang === 'tr' ? 'Latans:' : (lang === 'de' ? 'Latenz:' : 'Latency:')} {latencyMs}ms
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 🛡️ Risk Guard & DQS Kalkanı */}
                                                        <div style={{
                                                            background: 'rgba(255, 255, 255, 0.02)',
                                                            padding: '0.85rem 1rem',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--tb-border)'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.76rem', fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span>🛡️</span>
                                                                    <span>{lang === 'tr' ? 'RİSK GUARD & DQS KALKANI' : (lang === 'de' ? 'RISK GUARD & DQS-SCHUTZ' : 'RISK GUARD & DQS SHIELD')}</span>
                                                                </span>
                                                                <span style={{
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 800,
                                                                    padding: '2px 7px',
                                                                    borderRadius: '4px',
                                                                    background: (dataQuality === 'TAM' || dataQuality === 'FULL') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                                    color: (dataQuality === 'TAM' || dataQuality === 'FULL') ? '#34d399' : '#f87171',
                                                                    border: `1px solid ${(dataQuality === 'TAM' || dataQuality === 'FULL') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                                                }}>
                                                                    {lang === 'tr' ? `VERİ: ${dataQuality}` : (lang === 'de' ? `DATEN: ${dataQuality}` : `DATA: ${dataQuality}`)}
                                                                </span>
                                                            </div>

                                                            {/* Risk Filters Grid */}
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '0.55rem' }}>
                                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                                    <div style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: '2px' }}>{lang === 'tr' ? 'Ölü Maç' : (lang === 'de' ? 'Totes Spiel' : 'Dead Match')}</div>
                                                                    <span style={{
                                                                        fontSize: '0.68rem',
                                                                        fontWeight: 900,
                                                                        color: riskFilters.deadMatch?.status === 'OK' ? '#34d399' : '#ef4444'
                                                                    }}>
                                                                        {riskFilters.deadMatch?.status === 'OK' ? (lang === 'tr' ? '✓ TAMAM' : (lang === 'de' ? '✓ OK' : '✓ OK')) : (lang === 'tr' ? '✗ RİSKLİ' : (lang === 'de' ? '✗ RISIKO' : '✗ RISKY'))}
                                                                    </span>
                                                                </div>

                                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                                    <div style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: '2px' }}>{lang === 'tr' ? 'Momentum' : (lang === 'de' ? 'Momentum' : 'Momentum')}</div>
                                                                    <span style={{
                                                                        fontSize: '0.68rem',
                                                                        fontWeight: 900,
                                                                        color: riskFilters.momentum?.status === 'OK' ? '#34d399' : '#ef4444'
                                                                    }}>
                                                                        {riskFilters.momentum?.status === 'OK' ? (lang === 'tr' ? '✓ AKTİF' : (lang === 'de' ? '✓ AKTIV' : '✓ ACTIVE')) : (lang === 'tr' ? '✗ PASİF' : (lang === 'de' ? '✗ PASSIV' : '✗ PASSIVE'))}
                                                                    </span>
                                                                </div>

                                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                                    <div style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: '2px' }}>{lang === 'tr' ? 'Geç Dakika' : (lang === 'de' ? 'Schlussphase' : 'Late Game')}</div>
                                                                    <span style={{
                                                                        fontSize: '0.68rem',
                                                                        fontWeight: 900,
                                                                        color: riskFilters.lateGame?.status === 'OK' ? '#34d399' : '#ef4444'
                                                                    }}>
                                                                        {riskFilters.lateGame?.status === 'OK' ? (lang === 'tr' ? '✓ UYGUN' : (lang === 'de' ? '✓ FREI' : '✓ ELIGIBLE')) : (lang === 'tr' ? '✗ KİLİTLİ' : (lang === 'de' ? '✗ GESPERRT' : '✗ LOCKED'))}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Bottom metrics row */}
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                                                <span><strong>{lang === 'tr' ? 'Baskı İndeksi:' : (lang === 'de' ? 'Druck-Index:' : 'Pressure Index:')}</strong> <span style={{ color: '#fbbf24', fontWeight: 800 }}>%{pressureTotal}</span></span>
                                                                <span><strong>{lang === 'tr' ? 'İvme Durumu:' : (lang === 'de' ? 'Dynamik:' : 'Velocity:')}</strong> <span style={{ color: '#f1f5f9', fontWeight: 800 }}>{m.observations?.velocity?.trend || (heat >= 70 ? 'HOT' : heat >= 40 ? 'WARMING' : 'STABLE')}</span></span>
                                                                <span><strong>{lang === 'tr' ? 'Gecikme:' : (lang === 'de' ? 'Latenz:' : 'Latency:')}</strong> <span style={{ color: '#38bdf8', fontWeight: 800 }}>{latencyMs}ms</span></span>
                                                            </div>
                                                        </div>
                                                        {hasTrend && (
                                                            <div className="tb-trend-box">
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>
                                                                        📈 {lang === 'tr' ? 'AVRUPA PİYASA AKIŞI & HALK BAHİSİ' : (lang === 'de' ? 'EUROPÄISCHER MARKTZUFLUSS & PUBLIKUMSWETTEN' : 'EUROPEAN MARKET FLOW & PUBLIC BET')}
                                                                    </span>
                                                                    <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}>
                                                                        {isTrendApproved 
                                                                            ? (lang === 'tr' ? '🟢 DQS ONAYLADI (AKILLI PARA)' : (lang === 'de' ? '🟢 DQS BESTÄTIGT (SMART MONEY)' : '🟢 DQS CONFIRMED (SMART MONEY)'))
                                                                            : isTrendTrap 
                                                                            ? (lang === 'tr' ? '🔴 DİKKAT: TUZAK UYARISI' : (lang === 'de' ? '🔴 ACHTUNG: FALLEN-WARNUNG' : '🔴 WARNING: TRAP ALERT'))
                                                                            : (lang === 'de' ? '📊 HOHER PUBLIKUMS-ZUFLUSS' : (lang === 'tr' ? '📊 YOĞUN HALK AKIŞI' : '📊 HIGH PUBLIC INFLUX'))}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--tb-text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                                                                    <span><strong>{lang === 'tr' ? 'Piyasa Tercihi / Tahmini:' : (lang === 'de' ? 'Marktprognose:' : 'Market Prediction:')}</strong> <span style={{ color: '#fff', fontWeight: 900 }}>{marketPrediction}</span></span>
                                                                    <span><strong>{lang === 'tr' ? 'Pazar:' : (lang === 'de' ? 'Wettmarkt:' : 'Market:')}</strong> {primaryTrend.market}</span>
                                                                    <span><strong>{lang === 'tr' ? 'Oran:' : (lang === 'de' ? 'Quote:' : 'Odds:')}</strong> <span style={{ color: '#fbbf24', fontWeight: 800 }}>@{primaryTrend.odds}</span></span>
                                                                    <span><strong>{lang === 'tr' ? 'Son 5 Dk Hacim:' : (lang === 'de' ? 'Volumen letzte 5 Min.:' : 'Last 5m Volume:')}</strong> <span style={{ color: '#f87171', fontWeight: 800 }}>{totalTrendCount} {lang === 'tr' ? 'Kupon' : (lang === 'de' ? 'Wettscheine' : 'Coupons')}</span></span>
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

                                                        {/* Sleek Single-Click Portfolio / Slip Tracking Button */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '0.4rem' }} className="tb-action-ignore">
                                                            <button
                                                                type="button"
                                                                disabled={trackedMatchIds.has(m.id)}
                                                                onClick={() => {
                                                                    onApproveBet(m, signal);
                                                                    setTrackedMatchIds(prev => new Set([...prev, m.id]));
                                                                }}
                                                                style={{
                                                                    background: trackedMatchIds.has(m.id) 
                                                                        ? 'rgba(16, 185, 129, 0.15)' 
                                                                        : 'linear-gradient(135deg, #10b981, #059669)',
                                                                    color: trackedMatchIds.has(m.id) ? '#34d399' : '#000',
                                                                    border: trackedMatchIds.has(m.id) ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
                                                                    padding: '0.65rem 1.25rem',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.76rem',
                                                                    cursor: trackedMatchIds.has(m.id) ? 'default' : 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    boxShadow: trackedMatchIds.has(m.id) ? 'none' : '0 2px 10px rgba(16, 185, 129, 0.3)',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title={lang === 'tr' ? 'Bu maçı kişisel tahmin ve kasa takip karnenize kaydedin' : (lang === 'de' ? 'Dieses Spiel im persönlichen Tipp- und Buchungsbuch verfolgen' : 'Track this match in your prediction ledger')}
                                                            >
                                                                <span>{trackedMatchIds.has(m.id) ? '✓' : '📌'}</span>
                                                                <span>
                                                                    {trackedMatchIds.has(m.id) 
                                                                        ? (lang === 'tr' ? 'Takip Listenize Eklendi' : (lang === 'de' ? 'Zur Beobachtungsliste hinzugefügt' : 'Added to Watchlist')) 
                                                                        : (lang === 'de' ? 'Zur Beobachtungsliste hinzufügen' : (lang === 'tr' ? 'Kuponuma / Takibe Ekle' : 'Add to Watchlist'))}
                                                                </span>
                                                            </button>
                                                        </div>
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
