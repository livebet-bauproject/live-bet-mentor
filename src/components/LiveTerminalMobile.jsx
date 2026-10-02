import React, { useState, useRef, useEffect, useMemo } from 'react';
import { calculateMatchHeatScore, calculateLast20MinMetrics, formatMarketPrediction, getTrendTimelineInfo } from '../logic/liveSortEngine';
import { consensusAdapter } from '../backend/consensusAdapter';
import { dataWorker } from '../backend/dataWorker';
import { CONFIG } from '../config';
import { MatchLiveStatsCard } from './MatchLiveStatsCard';
import { AttackMomentumGraph as DefaultAttackGraph } from './AttackMomentumGraph';
import { MatchIncidentsTimeline as DefaultIncidentsTimeline } from './MatchIncidentsTimeline';
import { GlobalConsensusCard } from './GlobalConsensusCard';

const StarIcon = ({ filled = false, size = 14 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? '#fbbf24' : 'none'}
        stroke={filled ? '#fbbf24' : 'currentColor'}
        strokeWidth={filled ? '1.5' : '2'}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const formatOddsVal = (val) => {
    if (!val || val === '-') return '-';
    const num = parseFloat(val);
    return (!isNaN(num) && num > 1.0) ? num.toFixed(2) : '-';
};

export const LiveTerminalMobile = ({
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
    hideInTableMode = false,
    userProfile = null,
    onOpenUpgrade = () => {},
    terminalCategoryFilter = 'ALL',
    isAdmin = false,
    onSendToTelegram = null,
    momentumWindow = 10
}) => {
    const EffectiveAttackGraph = AttackMomentumGraph || DefaultAttackGraph;
    const EffectiveIncidentsTimeline = MatchIncidentsTimeline || DefaultIncidentsTimeline;
    const [expandedMatchId, setExpandedMatchId] = useState(null);
    const [trackedMatchIds, setTrackedMatchIds] = useState(() => new Set());

    // Freeze card sequence while a match is expanded to eliminate jumping/closing every 2s
    const frozenOrderRef = useRef(null);

    useEffect(() => {
        if (expandedMatchId !== null) {
            if (!frozenOrderRef.current && matches.length > 0) {
                frozenOrderRef.current = matches.map(m => String(m.id));
            }
        } else {
            frozenOrderRef.current = null;
        }
    }, [expandedMatchId, matches]);

    const displayMatches = useMemo(() => {
        if (!expandedMatchId || !frozenOrderRef.current || frozenOrderRef.current.length === 0) {
            return matches;
        }

        const matchMap = new Map();
        matches.forEach(m => matchMap.set(String(m.id), m));

        const ordered = [];
        const seen = new Set();

        frozenOrderRef.current.forEach(id => {
            if (matchMap.has(id)) {
                ordered.push(matchMap.get(id));
                seen.add(id);
            }
        });

        matches.forEach(m => {
            const id = String(m.id);
            if (!seen.has(id)) {
                ordered.push(m);
            }
        });

        return ordered;
    }, [matches, expandedMatchId]);

    const handleCardClick = (match, e) => {
        if (e.target.closest('button') || e.target.closest('.tb-action-ignore')) {
            return;
        }
        const nextId = String(expandedMatchId) === String(match.id) ? null : match.id;
        setExpandedMatchId(nextId);
        if (nextId && dataWorker && typeof dataWorker.setSelectedMatch === 'function') {
            dataWorker.setSelectedMatch(match.id);
        }
    };

    const parseScores = (score) => {
        if (!score && score !== 0) return { home: '0', away: '0' };
        if (typeof score === 'object') {
            return { home: String(score.home ?? 0), away: String(score.away ?? 0) };
        }
        const str = String(score).trim();
        if (str.includes('-')) {
            const parts = str.split('-');
            return { home: parts[0].trim(), away: parts[1].trim() };
        }
        if (str.includes(':')) {
            const parts = str.split(':');
            return { home: parts[0].trim(), away: parts[1].trim() };
        }
        return { home: str, away: '' };
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

        const sm = m.opportunityData?.suggestedMarket;
        if (sm?.marketKey && t?.[sm.marketKey]) {
            let trMarket = t[sm.marketKey]
                .replace('{team}', sm.team || '')
                .replace('{goals}', sm.target || '');
            if (trMarket) return trMarket;
        }

        const strat = signal.activeStrategies?.[0];
        if (strat?.id && t?.[strat.id]) {
            let trStrat = t[strat.id].replace('{team}', strat.team || '');
            if (trStrat) return trStrat;
        }

        let label = strat?.label || signal.prediction || sm?.label;
        if (!label && signal.reason && !signal.reason.includes('Kriterlere') && !signal.reason.includes('Strateji')) {
            label = signal.reason;
        }
        if (!label) return lang === 'tr' ? 'BAHİS' : lang === 'de' ? 'WETTE' : 'BET';

        if (lang === 'de') {
            return label
                .replace(/^Sıradaki Gol:/i, 'Nächstes Tor:')
                .replace(/^İY 0\.5 ÜST/i, 'HZ Über 0.5')
                .replace(/^İlk Yarı 0\.5 Üst/i, '1. HZ Über 0.5')
                .replace(/^İY 1\.5 ÜST/i, 'HZ Über 1.5')
                .replace(/^SON 15DK PATLAMASI/i, '15m MOMENTUM-SCHWUNG')
                .replace(/^GERİ DÖNÜŞ/i, 'COMEBACK')
                .replace(/^FAVORİ GERİ DÖNÜŞ/i, 'FAVORITEN-COMEBACK')
                .replace(/^BASKI LİDERİ/i, 'DRUCK-LEADER')
                .replace(/^İSTATİSTİKSEL BASKI/i, 'STATISTISCHE DOMINANZ')
                .replace(/^KORNER BASKISI/i, 'ECKENDIFFERENZ')
                .replace(/^KG VAR/i, 'BEIDE TREFFEN (BTTS)')
                .replace(/^SAYISAL ÜSTÜNLÜK/i, 'ÜBERZAHL-VORTEIL')
                .replace(/^SKOR MARUZİYETİ/i, 'TORREICHES SPIEL')
                .replace(/^Maç Sonu \/ Kilitli/i, 'Spielende / Gesperrt')
                .replace(/^Kopmuş Maç \(Rehavet \/ Riskli\)/i, 'Entschiedenes Spiel (Riskant)')
                .replace(/^Düşük Tempo \(Ölü Maç\)/i, 'Niedriges Tempo (Totes Spiel)')
                .replace(/^Oran Değersiz \(Pas\)/i, 'Quote ohne Wert (Pass)')
                .replace(/^Geç Dakika \/ Riskli \(Pas\)/i, 'Späte Phase / Riskant (Pass)')
                .replace(/^Maç Kopmuş \/ Oran Düşük/i, 'Spiel entschieden / Quote niedrig')
                .replace(/Maç Sonu Galibiyeti \(MS 1\)/g, 'Heimsieg (1)')
                .replace(/Maç Sonu Galibiyeti \(MS 2\)/g, 'Auswärtssieg (2)')
                .replace(/Üst Bekleniyor/g, 'Tore erwartet')
                .replace(/^GOL ALARMI/i, 'TOR-ALARM')
                .replace(/ÜST/g, 'ÜBER')
                .replace(/ALT/g, 'UNTER');
        }

        if (lang === 'en') {
            return label
                .replace(/^Sıradaki Gol:/i, 'Next Goal:')
                .replace(/^İY 0\.5 ÜST/i, 'HT Over 0.5')
                .replace(/^İlk Yarı 0\.5 Üst/i, '1st Half Over 0.5')
                .replace(/^İY 1\.5 ÜST/i, 'HT Over 1.5')
                .replace(/^SON 15DK PATLAMASI/i, '15m MOMENTUM BURST')
                .replace(/^GERİ DÖNÜŞ/i, 'COMEBACK')
                .replace(/^FAVORİ GERİ DÖNÜŞ/i, 'FAVORITE COMEBACK')
                .replace(/^BASKI LİDERİ/i, 'PRESSURE LEADER')
                .replace(/^İSTATİSTİKSEL BASKI/i, 'STATISTICAL DOMINANCE')
                .replace(/^KORNER BASKISI/i, 'CORNER PRESSURE')
                .replace(/^KG VAR/i, 'BTTS')
                .replace(/^SAYISAL ÜSTÜNLÜK/i, 'NUMERICAL ADVANTAGE')
                .replace(/^SKOR MARUZİYETİ/i, 'HIGH SCORE EXPOSURE')
                .replace(/^Maç Sonu \/ Kilitli/i, 'Match Ended / Locked')
                .replace(/^Kopmuş Maç \(Rehavet \/ Riskli\)/i, 'Blowout Match (High Risk)')
                .replace(/^Düşük Tempo \(Ölü Maç\)/i, 'Low Tempo (Dead Match)')
                .replace(/^Oran Değersiz \(Pas\)/i, 'No Value in Odds (Pass)')
                .replace(/^Geç Dakika \/ Riskli \(Pas\)/i, 'Late Minute / Risky (Pass)')
                .replace(/^Maç Kopmuş \/ Oran Düşük/i, 'Blowout / Low Odds')
                .replace(/Maç Sonu Galibiyeti \(MS 1\)/g, 'Full-Time Win (1)')
                .replace(/Maç Sonu Galibiyeti \(MS 2\)/g, 'Full-Time Win (2)')
                .replace(/Üst Bekleniyor/g, 'Goals Expected')
                .replace(/^GOL ALARMI/i, 'GOAL ALERT')
                .replace(/ÜST/g, 'OVER')
                .replace(/ALT/g, 'UNDER');
        }
        return label;
    };

    if (!Array.isArray(matches) || matches.length === 0) {
        if (terminalCategoryFilter === 'PINNED') {
            return (
                <div className="tb-pinned-empty-state">
                    <div className="tb-pinned-empty-icon">⭐</div>
                    <div className="tb-pinned-empty-title">
                        {lang === 'tr' ? 'Henüz Favori Maçınız Yok' : (lang === 'de' ? 'Noch keine Favoriten vorhanden' : 'No Favorite Matches Yet')}
                    </div>
                    <div className="tb-pinned-empty-desc">
                        {lang === 'tr' 
                            ? 'Canlı takip etmek istediğiniz maçların solundaki ☆ yıldız butonuna basarak maçları buraya sabitleyebilir, anlık baskı ve gol fırsatlarını tek ekranda izleyebilirsiniz.'
                            : (lang === 'de' 
                                ? 'Tippen Sie auf das ☆ Stern-Symbol links neben einem Spiel, um es hier anzuheften.' 
                                : 'Tap the ☆ star button on the left of any match card to pin it here and track live pressure and alerts.')}
                    </div>
                </div>
            );
        }

        return (
            <div className="tb-mobile-empty" style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--tb-surface)',
                border: '1px solid var(--tb-border)',
                borderRadius: '12px',
                color: 'var(--tb-text-muted)',
                fontSize: '0.85rem'
            }}>
                📡 {lang === 'tr' ? 'Seçili filtreye uygun canlı maç bulunamadı.' : (lang === 'de' ? 'Keine Live-Spiele für diesen Filter gefunden.' : 'No live matches matching this filter.')}
            </div>
        );
    }

    return (
        <div className={`tb-mobile-stream ${hideInTableMode ? 'hide-in-table-mode' : ''}`}>
            {displayMatches.map(m => {
                const isExpanded = String(expandedMatchId) === String(m.id);
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
                    : rawHeatLevel;
                const heatIcon = rawHeatLevel === 'ALPHA' ? '🚀' : rawHeatLevel === 'ALEV' ? '🔥' : rawHeatLevel === 'SICAK' ? '⚡' : '❄️';
                const windowMomentum = opp?.components?.momentum ?? opp?.score ?? heat;
                const last20 = calculateLast20MinMetrics(m, signal, momentumWindow);

                    const sogHome = m.stats?.shotsOnGoal?.home || 0;
                    const sogAway = m.stats?.shotsOnGoal?.away || 0;
                    const daHome = m.stats?.dangerousAttacks?.home || 0;
                    const daAway = m.stats?.dangerousAttacks?.away || 0;
                    const daDiff = Math.abs(daHome - daAway);
                    const xgHome = Number(m.stats?.xg?.home || 0);
                    const xgAway = Number(m.stats?.xg?.away || 0);
                    const possHome = Number(m.stats?.possession?.home || 0);
                    const possAway = Number(m.stats?.possession?.away || 0);

                    const redHome = Number(m.cards?.home?.red || m.stats?.cards?.home?.red || 0);
                    const redAway = Number(m.cards?.away?.red || m.stats?.cards?.away?.red || 0);
                    const yellowHome = Number(m.cards?.home?.yellow || m.stats?.cards?.home?.yellow || 0);
                    const yellowAway = Number(m.cards?.away?.yellow || m.stats?.cards?.away?.yellow || 0);

                    const rawHome = m.odds?.home || m.liveOdds?.home || m.matchedOdds?.home || '-';
                    const rawDraw = m.odds?.draw || m.liveOdds?.draw || m.matchedOdds?.draw || '-';
                    const rawAway = m.odds?.away || m.liveOdds?.away || m.matchedOdds?.away || '-';
                    const oddsHome = formatOddsVal(rawHome);
                    const oddsDraw = formatOddsVal(rawDraw);
                    const oddsAway = formatOddsVal(rawAway);
                    const fullOdds = m.odds || m.liveOdds || m.matchedOdds || null;
                    const hasOdds = oddsHome !== '-' || oddsDraw !== '-' || oddsAway !== '-';
                    const minStr = String(m?.minute || '').trim();
                    const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
                    const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;

                    const predDisplay = getPredictionDisplay(m, signal);
                    const isBetReady = signal?.verdict === 'BET' && Boolean(predDisplay) && !isLateOrFinished;
                    const isHot = heat >= 75;

                    // Stat coloring discipline matching desktop
                    const daAlertClass = daDiff >= 20 ? 'alert-red' : daDiff >= 12 ? 'alert-amber' : 'neutral';
                    const heatAlertClass = heat >= 75 ? 'alert-red' : heat >= 55 ? 'alert-amber' : 'neutral';

                    const riskFilters = (dataWorker && typeof dataWorker.checkRiskFilters === 'function')
                        ? dataWorker.checkRiskFilters(m)
                        : {
                            deadMatch: { status: 'OK' },
                            momentum: { status: 'OK' },
                            lateGame: { status: 'OK' }
                        };
                    const scores = parseScores(m.score);
                    const goalDiffVal = Math.abs(scores.home - scores.away);
                    const minVal = parseInt(String(m.minute || '').replace(/[^0-9]/g, '')) || 0;
                    const isDeadMatch = riskFilters?.deadMatch?.status === 'FAIL' || goalDiffVal >= 4 || (goalDiffVal >= 3 && minVal >= 40) || (goalDiffVal >= 2 && minVal >= 75);

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
                    const isEarlyMin = !opp?.isHalftime && minVal < 15;
                    const isTrendApproved = hasTrend && dqsVal >= 0.50 && !isDeadMatch && !isEarlyMin && heatScore >= 45;
                    const isTrendTrap = hasTrend && (dqsVal < 0.40 || isDeadMatch);
                    const marketPrediction = hasTrend ? formatMarketPrediction(primaryTrend, lang) : '';
                    const trendInfo = hasTrend ? getTrendTimelineInfo(primaryTrend, m, lang) : null;

                    // Consolidated Intelligence (Bayesian Radar & Risk Guard)
                    const bayesian = m?.observations?.bayesian;
                    const heatNorm = Math.min(1, Math.max(0, heat / 100));
                    const rawPosterior = bayesian?.posterior ?? Math.min(0.92, Math.max(0.12, (heatNorm * 0.45 + ((xgHome + xgAway) > 0 ? (xgHome + xgAway) * 0.15 : (sogHome + sogAway) * 0.04) + (daDiff >= 15 ? 0.12 : 0))));
                    const goalProb = (rawPosterior * 100).toFixed(1);
                    const baseTempo = bayesian?.prior ? Math.round(bayesian.prior * 100) : Math.min(85, Math.max(20, Math.round(heatNorm * 60 + 15)));
                    const pressureImpact = bayesian?.impact ? (bayesian.impact * 100).toFixed(1) : ((rawPosterior - (baseTempo / 100)) * 100).toFixed(1);
                    const confidence = isDeadMatch 
                        ? 'LOW' 
                        : ((minVal < 10 && !opp?.isHalftime) 
                            ? 'LOW' 
                            : ((minVal < 15 && !opp?.isHalftime) 
                                ? (bayesian?.confidence === 'HIGH' ? 'MEDIUM' : (bayesian?.confidence || 'LOW'))
                                : (bayesian?.confidence || (heat >= 75 ? 'HIGH' : heat >= 50 ? 'MEDIUM' : 'LOW'))));
                    const confidenceLabel = confidence === 'HIGH' ? (lang === 'tr' ? 'YÜKSEK' : (lang === 'de' ? 'HOCH' : 'HIGH')) : confidence === 'MEDIUM' ? (lang === 'tr' ? 'ORTA' : (lang === 'de' ? 'MITTEL' : 'MEDIUM')) : (lang === 'tr' ? 'DÜŞÜK' : (lang === 'de' ? 'NIEDRIG' : 'LOW'));
                    const confidenceColor = confidence === 'HIGH' ? '#10b981' : confidence === 'MEDIUM' ? '#fbbf24' : '#ef4444';

                    const latencyMs = m.latency || Math.round(35 + (m.id ? (Number(String(m.id).replace(/\D/g, '')) % 40) : 12));
                    const dataQuality = m.dataQuality === 'PARTIAL' ? (lang === 'tr' ? 'BEKLENİYOR' : (lang === 'de' ? 'AUSSTEHEND' : 'PENDING')) : (m.dataQuality === 'LIMITED' ? (lang === 'tr' ? 'KISITLI' : (lang === 'de' ? 'EINGESCHRÄNKT' : 'LIMITED')) : (lang === 'tr' ? 'TAM' : (lang === 'de' ? 'VOLLSTÄNDIG' : 'FULL')));
                    const pressureTotal = m.observations?.pressure?.total || Math.round(heat * 0.85);

                    return (
                        <div
                            key={m.id}
                            className={`tb-mobile-card ${isBetReady ? 'bet-border' : isHot ? 'hot-border' : ''} ${isExpanded ? 'expanded' : ''}`}
                            onClick={(e) => handleCardClick(m, e)}
                        >
                            {/* Line 1: Header (Pin, Minute, League, Heat & Caret) */}
                            <div className="tb-m-row-1">
                                <div className="tb-m-min-league">
                                    <button
                                        type="button"
                                        className={`tb-action-ignore tb-fav-btn ${isPinned ? 'pinned' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                        title={isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : (lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites')) : (lang === 'tr' ? 'Favoriye Ekle (Sabitle)' : (lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites'))}
                                        aria-label={isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : (lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites')) : (lang === 'tr' ? 'Favoriye Ekle' : (lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites'))}
                                    >
                                        <StarIcon filled={isPinned} size={14} />
                                    </button>
                                    <span className="tb-m-min">
                                        <span className="tb-pulse-dot" style={{ display: 'inline-block', marginRight: '4px' }} />
                                        {formatMinute(m.minute)}
                                    </span>
                                    <span className="tb-m-league">
                                        <span style={{ opacity: 0.6, marginRight: '3px' }}>T{m.tier || 1}</span>
                                        {m.league || m.leagueName || 'Futbol'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {isAdmin && onSendToTelegram && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onSendToTelegram(e, m, opp); }}
                                            className="tb-action-ignore opp-telegram-btn"
                                            style={{ width: '24px', height: '24px', fontSize: '0.72rem', cursor: 'pointer' }}
                                            title={lang === 'tr' ? "VIP Gruba Gönder" : (lang === 'de' ? "An VIP-Gruppe senden" : "Send to VIP")}
                                        >
                                            ✈️
                                        </button>
                                    )}
                                    <span
                                        className={`tb-heat-badge tb-heat-${(rawHeatLevel || 'soguk').toLowerCase()}`}
                                        title={lang === 'tr' ? `Isı Skoru: ${heatScore} • Seviye: ${heatLevel}` : (lang === 'de' ? `Hitze-Score: ${heatScore} • Level: ${heatLevel}` : `Heat Score: ${heatScore} • Level: ${heatLevel}`)}
                                    >
                                        {heatIcon} {heatScore} {heatLevel}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '0.72rem',
                                            color: 'var(--tb-text-muted)',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease',
                                            display: 'inline-block'
                                        }}
                                    >
                                        ▼
                                    </span>
                                </div>
                            </div>

                            {/* Line 2: Teams & Scores (Clear 2-row layout with cards & scores aligned) */}
                            <div className="tb-m-match-box">
                                <div className="tb-m-team-row">
                                    <div className="tb-m-team-name-group">
                                        <span className="tb-m-team-name">{m.homeTeam}</span>
                                        {yellowHome > 0 && <span className="tb-card-badge tb-card-yellow">{yellowHome}</span>}
                                        {redHome > 0 && <span className="tb-card-badge tb-card-red">{redHome}</span>}
                                    </div>
                                    <span className="tb-m-team-score">{scores.home}</span>
                                </div>
                                <div className="tb-m-team-row">
                                    <div className="tb-m-team-name-group">
                                        <span className="tb-m-team-name">{m.awayTeam}</span>
                                        {yellowAway > 0 && <span className="tb-card-badge tb-card-yellow">{yellowAway}</span>}
                                        {redAway > 0 && <span className="tb-card-badge tb-card-red">{redAway}</span>}
                                    </div>
                                    <span className="tb-m-team-score">{scores.away}</span>
                                </div>

                                {/* Opportunity Micro-Badges (from Classic Cards) */}
                                {opp && (
                                    <div className="tb-badges-row" style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                        {(opp.hasHalftimeValue || (opp.isHalftime && opp.isStatsReady && !opp.isLowData && heatScore >= 50)) && (
                                            <span className="opp-micro-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '0.62rem', padding: '1px 5px' }}>
                                                ☕ {lang === 'tr' ? '2. YARI DEĞERİ' : '2ND HALF VALUE'}
                                            </span>
                                        )}
                                        {opp.valueDetected && !isEarlyMin && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#000', fontWeight: 800, fontSize: '0.62rem', padding: '1px 5px' }}>
                                                💰 {lang === 'tr' ? 'DEĞERLİ ORAN' : 'VALUE ODDS'}
                                            </span>
                                        )}
                                        {opp.hasValueEV && opp.bestEV && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff', fontWeight: 800, fontSize: '0.62rem', padding: '1px 5px' }}>
                                                💎 +EV %{opp.bestEV.ev}
                                            </span>
                                        )}
                                        {opp.smartMoney?.active && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', fontWeight: 800, fontSize: '0.62rem', padding: '1px 5px' }}>
                                                📉 {lang === 'tr' ? 'BÜYÜK PARA' : 'SMART MONEY'} (-%{opp.smartMoney.dropPct?.toFixed ? opp.smartMoney.dropPct.toFixed(0) : opp.smartMoney.dropPct}%)
                                            </span>
                                        )}
                                        {opp.cashOutWarning && (
                                            <span className="opp-micro-badge" style={{ background: '#ef4444', color: '#fff', animation: 'pulse 1.5s infinite', fontWeight: 800, fontSize: '0.62rem', padding: '1px 5px' }}>
                                                🛡️ {lang === 'tr' ? 'BAHİS BOZDUR' : 'CASHOUT'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Line 3: European Market Flow / Akıllı Para Pill (Dedicated full-width line) */}
                            {hasTrend && (
                                <div className="tb-m-trend-bar">
                                    <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}>
                                        <span>{isTrendApproved ? '🟢' : isTrendTrap ? '🔴' : '📊'}</span>
                                        <span style={{ fontWeight: 900 }}>
                                            {isTrendApproved 
                                                ? (lang === 'tr' ? 'AKILLI PARA:' : (lang === 'de' ? 'SMART MONEY:' : 'SMART MONEY:')) 
                                                : isTrendTrap 
                                                ? (isDeadMatch ? (lang === 'tr' ? 'KOPMUŞ MAÇ TUZAĞI:' : (lang === 'de' ? 'FALLE (ENTSCHIEDEN):' : 'BLOWOUT TRAP:')) : (lang === 'tr' ? 'TUZAK ALARMI:' : (lang === 'de' ? 'FALLEN-ALARM:' : 'TRAP ALERT:'))) 
                                                : (lang === 'tr' ? 'PİYASA AKIŞI:' : (lang === 'de' ? 'MARKTZUFLUSS:' : 'MARKET INFLUX:'))}
                                        </span>
                                        <span className="tb-trend-pred">{marketPrediction}</span>
                                        {primaryTrend.odds && (
                                            <span className="tb-trend-odds">
                                                @{typeof primaryTrend.odds === 'number' ? primaryTrend.odds.toFixed(2) : primaryTrend.odds}
                                            </span>
                                        )}
                                        <span style={{ opacity: 0.85, fontSize: '0.62rem' }}>• {totalTrendCount} {lang === 'tr' ? 'Kupon' : (lang === 'de' ? 'Wettscheine' : 'Bets')}</span>
                                        {trendInfo && (
                                            <span style={{ opacity: 0.9, fontSize: '0.62rem', color: trendInfo.isNew ? '#34d399' : '#93c5fd', fontWeight: 700 }}>
                                                • ⚽ {trendInfo.entryScore} {trendInfo.durMinutes > 0 ? `(${trendInfo.durMinutes}dk)` : ''}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}

                            {/* Line 4: 1X2 Live Odds Row (If available) */}
                            {hasOdds && (
                                <div className="tb-m-odds-row" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(15, 23, 42, 0.65)',
                                    border: '1px solid rgba(56, 189, 248, 0.18)',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    margin: '5px 0',
                                    fontSize: '0.72rem'
                                }}>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px' }}>1X2:</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.62rem' }}>1</span>
                                        <strong style={{ color: '#38bdf8' }}>{oddsHome}</strong>
                                    </span>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.62rem' }}>X</span>
                                        <strong style={{ color: '#f1f5f9' }}>{oddsDraw}</strong>
                                    </span>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.62rem' }}>2</span>
                                        <strong style={{ color: '#f43f5e' }}>{oddsAway}</strong>
                                    </span>
                                    <span style={{
                                        marginLeft: 'auto',
                                        fontSize: '0.58rem',
                                        color: '#34d399',
                                        background: 'rgba(16, 185, 129, 0.12)',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        fontWeight: 800
                                    }}>
                                        {lang === 'tr' ? 'CANLI' : (lang === 'de' ? 'LIVE' : 'LIVE')}
                                    </span>
                                </div>
                            )}

                            {/* Line 5: 5-Column Live Stats Grid with Explicit Desktop Labels */}
                            <div className="tb-m-stats-grid">
                                {/* Column 1: BASKI / İVME */}
                                <div className={`tb-m-stat-cell ${heatAlertClass}`}>
                                    <span className="tb-m-stat-label">{lang === 'tr' ? `BASKI (${momentumWindow}D)` : (lang === 'de' ? `DRUCK (${momentumWindow}M)` : `PRESS (${momentumWindow}M)`)}</span>
                                    <span className="tb-m-stat-value">
                                        %{windowMomentum}
                                        {last20.isSurging && (
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: '#fbbf24', fontWeight: 800, marginTop: '2px' }}>
                                                ⚡ {last20.dominantTeam ? `${last20.dominantTeam.slice(0, 9)} (+${last20.teamDeltaDA || last20.deltaDA} ${lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')})` : `+${last20.deltaDA} ${lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')}`}
                                            </span>
                                        )}
                                    </span>
                                </div>

                                {/* Column 2: TOPLA OYNAMA */}
                                <div className="tb-m-stat-cell">
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'TOP %' : (lang === 'de' ? 'BESITZ' : 'POSS')}</span>
                                    <span className="tb-m-stat-value" style={{ 
                                        fontSize: '0.70rem', 
                                        color: possHome >= 60 ? '#38bdf8' : (possAway >= 60 ? '#f43f5e' : 'var(--tb-text-primary)') 
                                    }}>
                                        {(possHome > 0 || possAway > 0) ? `${possHome}-${possAway}` : '-'}
                                    </span>
                                </div>

                                {/* Column 3: ŞUT (İSB) */}
                                <div className="tb-m-stat-cell">
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'ŞUT (İSB)' : (lang === 'de' ? 'SCHÜSSE' : 'SOG')}</span>
                                    <span className="tb-m-stat-value">{sogHome} - {sogAway}</span>
                                </div>

                                {/* Column 4: T.ATAK */}
                                <div className={`tb-m-stat-cell ${daAlertClass}`}>
                                    <span className="tb-m-stat-label">{lang === 'tr' ? 'T.ATAK' : (lang === 'de' ? 'G.ANGRIFF' : 'D.ATTACK')}</span>
                                    <span className="tb-m-stat-value">
                                        {daHome} - {daAway}
                                    </span>
                                </div>

                                {/* Column 5: xG */}
                                <div className="tb-m-stat-cell xg">
                                    <span className="tb-m-stat-label">xG</span>
                                    <span className="tb-m-stat-value">
                                        {(xgHome > 0 || xgAway > 0) ? `${xgHome.toFixed(1)} - ${xgAway.toFixed(1)}` : '-'}
                                    </span>
                                </div>
                            </div>

                            {/* Line 6: AI Signal & DQS Footer */}
                            <div className="tb-m-footer">
                                {(() => {
                                    const isAdmin = userProfile?.plan === 'admin' || userProfile?.role === 'admin';
                                    const isExpired = !isAdmin && userProfile && (userProfile?.status === 'expired' || (userProfile?.subscription_end && new Date(userProfile.subscription_end) < new Date()));

                                    if (isExpired && (isBetReady || isHot)) {
                                        return (
                                            <span
                                                className="tb-signal-badge tb-signal-bet"
                                                onClick={(e) => { e.stopPropagation(); onOpenUpgrade(); }}
                                                style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', background: 'linear-gradient(135deg, #a78bfa, #38bdf8)', color: '#000', fontWeight: 900, boxShadow: '0 0 12px rgba(167, 139, 250, 0.4)' }}
                                            >
                                                🔒 {lang === 'tr' ? 'VIP SİNYAL KİLİDİNİ AÇ' : (lang === 'de' ? 'VIP-SIGNAL FREISCHALTEN' : 'UNLOCK VIP SIGNAL')}
                                            </span>
                                        );
                                    }

                                    if (isLateOrFinished) {
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                                <span>DQS: {(m.dqs || 0).toFixed(2)}</span>
                                                <span className="tb-signal-badge tb-signal-pass" style={{ fontSize: '0.62rem', padding: '1px 5px', opacity: 0.6 }}>
                                                    {minStr === 'MS' || minStr.includes('FT') ? (lang === 'tr' ? 'MS' : (lang === 'de' ? 'ES' : 'FT')) : (lang === 'tr' ? 'KİLİTLİ (88+)' : (lang === 'de' ? 'GESPERRT (88+)' : 'LOCKED (88+)'))}
                                                </span>
                                            </div>
                                        );
                                    }

                                    if (isDeadMatch) {
                                        return (
                                            <span
                                                className="tb-signal-badge"
                                                style={{
                                                    width: '100%',
                                                    justifyContent: 'center',
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    color: '#f87171',
                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                    fontWeight: 800
                                                }}
                                            >
                                                ⚠️ {lang === 'tr' ? 'KOPMUŞ MAÇ' : (lang === 'de' ? 'ENTSCHIEDEN' : 'BLOWOUT')}
                                            </span>
                                        );
                                    }

                                    if (isBetReady) {
                                        const oppMarket = m.opportunityData?.suggestedMarket;
                                        const oddsObj = fullOdds || m.odds || m.liveOdds || m.matchedOdds;
                                        const predOddsRaw = signal.odds || oppMarket?.odds || (
                                            oddsObj ? (
                                                (predDisplay.includes(m.homeTeam) || predDisplay.includes('MS 1') || predDisplay.includes('Ev'))
                                                    ? (oddsObj.nextGoal?.home || oddsObj.home)
                                                    : (predDisplay.includes(m.awayTeam) || predDisplay.includes('MS 2') || predDisplay.includes('Dep'))
                                                        ? (oddsObj.nextGoal?.away || oddsObj.away)
                                                        : (predDisplay.includes('Üst') || predDisplay.includes('Über') || predDisplay.includes('Over'))
                                                            ? (oddsObj.overUnder?.['2.5']?.over || oddsObj.overUnder?.['1.5']?.over)
                                                            : null
                                            ) : null
                                        );
                                        const numOdds = parseFloat(predOddsRaw);
                                        const hasOddsVal = !isNaN(numOdds) && numOdds >= 1.05 && numOdds <= 25.0;

                                        return (
                                            <span className="tb-signal-badge tb-signal-bet" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>✓ {predDisplay}</span>
                                                {hasOddsVal && (
                                                    <span style={{
                                                        background: 'rgba(0, 0, 0, 0.22)',
                                                        color: '#fff',
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.62rem',
                                                        fontWeight: 800
                                                    }}>
                                                        @{numOdds.toFixed(2)}
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    }

                                    if (isHot) {
                                        return (
                                            <span className="tb-signal-badge tb-signal-hot" style={{ width: '100%', justifyContent: 'center' }}>
                                                🔥 {lang === 'tr' ? `ALEV BASKI (%${heat})` : (lang === 'de' ? `FEUER-DRUCK (%${heat})` : `BURNING PRESSURE (%${heat})`)}
                                            </span>
                                        );
                                    }

                                    if (last20.isSurging) {
                                        return (
                                            <span
                                                className="tb-signal-badge"
                                                style={{
                                                    width: '100%',
                                                    justifyContent: 'center',
                                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 88, 12, 0.25))',
                                                    color: '#fbbf24',
                                                    border: '1px solid #f59e0b',
                                                    boxShadow: '0 0 8px rgba(245, 158, 11, 0.25)'
                                                }}
                                            >
                                                ⚡ {last20.dominantTeam ? `${lang === 'tr' ? 'Baskı' : (lang === 'de' ? 'Druck' : 'Surge')}: ${last20.dominantTeam} (+${last20.deltaDA})` : (lang === 'tr' ? `SON 20' BASKISI (+${last20.deltaDA})` : (lang === 'de' ? `LETZTE 20m DRUCK (+${last20.deltaDA})` : `LAST 20m SURGE (+${last20.deltaDA})`))}
                                            </span>
                                        );
                                    }

                                    const hasNoStats = sogHome === 0 && sogAway === 0 && daHome === 0 && daAway === 0;

                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.68rem', color: 'var(--tb-text-muted)' }}>
                                            <span>
                                                AI DQS: <strong style={{ color: (m.dqs || 0) >= 0.50 ? '#38bdf8' : 'var(--tb-text-muted)' }}>{(m.dqs || 0).toFixed(2)}</strong>
                                                {hasNoStats && (
                                                    <span style={{ marginLeft: '5px', fontSize: '0.62rem', color: '#94a3b8', opacity: 0.85 }}>
                                                        ({lang === 'tr' ? 'İstatistik Yok' : (lang === 'de' ? 'Keine Daten' : 'No Stats')})
                                                    </span>
                                                )}
                                            </span>
                                            <span className="tb-signal-badge tb-signal-pass" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                                {t?.verdict_pass || 'PAS'}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Mobile Drawer on Click */}
                            {isExpanded && (
                                <div className="tb-m-drawer tb-action-ignore">
                                    {/* Action Buttons Row */}
                                    <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                                        <button
                                            type="button"
                                            className={`tb-drawer-fav-action ${isPinned ? 'pinned' : ''}`}
                                            style={{ flex: 1 }}
                                            onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                        >
                                            <StarIcon filled={isPinned} size={15} />
                                            <span>
                                                {isPinned 
                                                    ? (lang === 'tr' ? 'Favorilerden Çıkar ★' : 'Remove ★')
                                                    : (lang === 'tr' ? '☆ Favorilere Ekle' : '☆ Pin Match')
                                                }
                                            </span>
                                        </button>
                                        {isAdmin && onSendToTelegram && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onSendToTelegram(e, m, opp); }}
                                                className="opp-telegram-btn"
                                                style={{ width: '38px', height: '38px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}
                                                title={lang === 'tr' ? "VIP Gruba Gönder" : "Send to VIP"}
                                            >
                                                ✈️
                                            </button>
                                        )}
                                    </div>

                                    {/* 📊 CANLI PİYASA ORANLARI (Mobile Live Market Odds Board) */}
                                    {(() => {
                                        const hasAnyOdds = hasOdds || (fullOdds && (
                                            fullOdds.home || fullOdds.away || fullOdds.draw ||
                                            fullOdds.doubleChance || fullOdds.overUnder || fullOdds.nextGoal || fullOdds.btts
                                        ));

                                        const ftHome = formatOddsVal(fullOdds?.home || oddsHome);
                                        const ftDraw = formatOddsVal(fullOdds?.draw || oddsDraw);
                                        const ftAway = formatOddsVal(fullOdds?.away || oddsAway);

                                        const ou25 = fullOdds?.overUnder?.['2.5'] || fullOdds?.overUnder?.['1.5'] || fullOdds?.overUnder?.['0.5'] || null;
                                        const ouLine = fullOdds?.overUnder?.['2.5'] ? '2.5' : (fullOdds?.overUnder?.['1.5'] ? '1.5' : (fullOdds?.overUnder?.['0.5'] ? '0.5' : '2.5'));
                                        const ouOver = ou25 ? formatOddsVal(ou25.over) : '-';
                                        const ouUnder = ou25 ? formatOddsVal(ou25.under) : '-';

                                        const dc1X = fullOdds?.doubleChance?.['1X'] ? formatOddsVal(fullOdds.doubleChance['1X']) : '-';
                                        const dc12 = fullOdds?.doubleChance?.['12'] ? formatOddsVal(fullOdds.doubleChance['12']) : '-';
                                        const dcX2 = fullOdds?.doubleChance?.['X2'] ? formatOddsVal(fullOdds.doubleChance['X2']) : '-';

                                        const ngHome = fullOdds?.nextGoal?.home ? formatOddsVal(fullOdds.nextGoal.home) : '-';
                                        const ngNoGoal = fullOdds?.nextGoal?.noGoal ? formatOddsVal(fullOdds.nextGoal.noGoal) : '-';
                                        const ngAway = fullOdds?.nextGoal?.away ? formatOddsVal(fullOdds.nextGoal.away) : '-';

                                        const bttsYes = fullOdds?.btts?.yes ? formatOddsVal(fullOdds.btts.yes) : '-';
                                        const bttsNo = fullOdds?.btts?.no ? formatOddsVal(fullOdds.btts.no) : '-';

                                        return (
                                            <div style={{
                                                background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)',
                                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                                borderRadius: '8px',
                                                padding: '8px 10px',
                                                marginTop: '6px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <span>📊</span>
                                                        <span>{lang === 'tr' ? 'CANLI PİYASA ORANLARI' : (lang === 'de' ? 'LIVE-MARKTQUOTEN' : 'LIVE MARKET ODDS')}</span>
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.58rem',
                                                        fontWeight: 800,
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: hasAnyOdds ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                        color: hasAnyOdds ? '#34d399' : 'var(--tb-text-muted)',
                                                        border: `1px solid ${hasAnyOdds ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {hasAnyOdds 
                                                            ? (lang === 'tr' ? '🟢 CANLI TAHTA' : (lang === 'de' ? '🟢 LIVE-TAFEL' : '🟢 LIVE BOARD'))
                                                            : (lang === 'tr' ? '⚪ ASKIDA' : (lang === 'de' ? '⚪ AUSGESETZT' : '⚪ SUSPENDED'))}
                                                    </span>
                                                </div>

                                                {!hasAnyOdds ? (
                                                    <div style={{
                                                        fontSize: '0.68rem',
                                                        color: 'var(--tb-text-muted)',
                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '6px',
                                                        padding: '6px 8px'
                                                    }}>
                                                        ⚠️ {lang === 'tr' ? 'Canlı piyasa oranları askıda veya bu karşılaşma için henüz açılmamış.' : 'Live market odds currently suspended.'}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        {/* 1X2 */}
                                                        <div>
                                                            <div style={{ fontSize: '0.60rem', fontWeight: 800, color: 'var(--tb-text-muted)', marginBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span>{lang === 'tr' ? 'MAÇ SONUCU (1X2)' : (lang === 'de' ? 'SPIELAUSGANG (1X2)' : 'FULL-TIME (1X2)')}</span>
                                                                <span style={{ opacity: 0.75, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {m.homeTeam} - {m.awayTeam}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                                                <div style={{ background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '5px', padding: '4px', textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '0.54rem', color: '#94a3b8', fontWeight: 700 }}>1 (Ev)</div>
                                                                    <div style={{ fontSize: '0.80rem', fontWeight: 900, color: ftHome !== '-' ? '#38bdf8' : 'var(--tb-text-muted)' }}>{ftHome}</div>
                                                                </div>
                                                                <div style={{ background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '5px', padding: '4px', textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '0.54rem', color: '#94a3b8', fontWeight: 700 }}>X (Ber.)</div>
                                                                    <div style={{ fontSize: '0.80rem', fontWeight: 900, color: ftDraw !== '-' ? '#f1f5f9' : 'var(--tb-text-muted)' }}>{ftDraw}</div>
                                                                </div>
                                                                <div style={{ background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '5px', padding: '4px', textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '0.54rem', color: '#94a3b8', fontWeight: 700 }}>2 (Dep)</div>
                                                                    <div style={{ fontSize: '0.80rem', fontWeight: 900, color: ftAway !== '-' ? '#f43f5e' : 'var(--tb-text-muted)' }}>{ftAway}</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Over/Under & BTTS */}
                                                        {(ouOver !== '-' || bttsYes !== '-') && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: (ouOver !== '-' && bttsYes !== '-') ? '1fr 1fr' : '1fr', gap: '4px' }}>
                                                                {ouOver !== '-' && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--tb-text-muted)', marginBottom: '2px' }}>
                                                                            {ouLine} {lang === 'tr' ? 'ALT / ÜST' : 'O/U'}
                                                                        </div>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                                                                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                                <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>Üst</div>
                                                                                <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#34d399' }}>{ouOver}</div>
                                                                            </div>
                                                                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                                <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>Alt</div>
                                                                                <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f1f5f9' }}>{ouUnder}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {bttsYes !== '-' && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--tb-text-muted)', marginBottom: '2px' }}>
                                                                            {lang === 'tr' ? 'KG VAR / YOK' : 'BTTS'}
                                                                        </div>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                                                                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                                <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>Var</div>
                                                                                <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#34d399' }}>{bttsYes}</div>
                                                                            </div>
                                                                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                                <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>Yok</div>
                                                                                <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f1f5f9' }}>{bttsNo}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Next Goal */}
                                                        {ngHome !== '-' && (
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#38bdf8', marginBottom: '2px' }}>
                                                                    ⚡ {lang === 'tr' ? 'SIRADAKİ GOL (CANLI)' : 'NEXT GOAL'}
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
                                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>{m.homeTeam?.slice(0, 6)}</div>
                                                                        <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#38bdf8' }}>{ngHome}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>Gol Yok</div>
                                                                        <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f1f5f9' }}>{ngNoGoal}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>{m.awayTeam?.slice(0, 6)}</div>
                                                                        <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f43f5e' }}>{ngAway}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Double Chance */}
                                                        {(dc1X !== '-' && ngHome === '-') && (
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--tb-text-muted)', marginBottom: '2px' }}>
                                                                    {lang === 'tr' ? 'ÇİFTE ŞANS' : 'DOUBLE CHANCE'}
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
                                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>1X</div>
                                                                        <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f1f5f9' }}>{dc1X}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>12</div>
                                                                        <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f1f5f9' }}>{dc12}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 4px', textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.52rem', color: '#94a3b8' }}>X2</div>
                                                                        <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f1f5f9' }}>{dcX2}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Dual Colored Momentum Bar (from Classic) */}
                                    {(() => {
                                        const cornersHome = Number(m.stats?.corners?.home || 0);
                                        const cornersAway = Number(m.stats?.corners?.away || 0);
                                        const pressHome = Number(m.observations?.pressure?.home || 0);
                                        const pressAway = Number(m.observations?.pressure?.away || 0);
                                        const homePower = (daHome * 1.0) + (sogHome * 3.5) + (cornersHome * 1.5) + (xgHome * 15) + (pressHome * 0.5);
                                        const awayPower = (daAway * 1.0) + (sogAway * 3.5) + (cornersAway * 1.5) + (xgAway * 15) + (pressAway * 0.5);
                                        const totalPower = homePower + awayPower;
                                        let homePct = 50;
                                        if (totalPower > 0) {
                                            homePct = Math.min(88, Math.max(12, Math.round((homePower / totalPower) * 100)));
                                        } else if (daHome + daAway > 0) {
                                            homePct = Math.round((daHome / (daHome + daAway)) * 100);
                                        }
                                        const awayPct = 100 - homePct;
                                        const isHomeHeavy = homePct >= 62;
                                        const isAwayHeavy = awayPct >= 62;
                                        const velocityTrend = m.observations?.velocity?.trend || 'STABLE';
                                        const isHot = velocityTrend === 'HOT';

                                        return (
                                            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--tb-border)', borderRadius: '8px', padding: '0.6rem 0.75rem', marginTop: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.68rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isHomeHeavy ? '#38bdf8' : '#94a3b8', fontWeight: isHomeHeavy ? 900 : 700 }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                                                        <span>{m.homeTeam} (%{homePct})</span>
                                                    </div>

                                                    <div style={{
                                                        fontSize: '0.62rem',
                                                        fontWeight: 800,
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: isHot ? 'rgba(239, 68, 68, 0.2)' : (isHomeHeavy || isAwayHeavy ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                                                        color: isHot ? '#f87171' : (isHomeHeavy ? '#38bdf8' : isAwayHeavy ? '#f43f5e' : '#94a3b8')
                                                    }}>
                                                        {isHot ? (lang === 'tr' ? '🔥 RİTİM' : lang === 'de' ? '🔥 RHYTHMUS' : '🔥 RHYTHM') : (isHomeHeavy ? (lang === 'tr' ? '⚡ EV BASKI' : lang === 'de' ? '⚡ HEIMDRUCK' : '⚡ HOME PRESSURE') : isAwayHeavy ? (lang === 'tr' ? '⚡ DEP BASKI' : lang === 'de' ? '⚡ AUSWÄRTSDRUCK' : '⚡ AWAY PRESSURE') : (lang === 'tr' ? '⚪ DENGELİ' : lang === 'de' ? '⚪ AUSGEGLICHEN' : '⚪ BALANCED'))}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isAwayHeavy ? '#f43f5e' : '#94a3b8', fontWeight: isAwayHeavy ? 900 : 700 }}>
                                                        <span>(%{awayPct}) {m.awayTeam}</span>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />
                                                    </div>
                                                </div>

                                                <div style={{ position: 'relative', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                                                    <div style={{ width: `${homePct}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8)', height: '100%' }} />
                                                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: 'rgba(255, 255, 255, 0.6)', zIndex: 2 }} />
                                                    <div style={{ width: `${awayPct}%`, background: 'linear-gradient(90deg, #f43f5e, #e11d48)', height: '100%' }} />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Momentum Graph */}
                                    {EffectiveAttackGraph && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
                                                📈 {lang === 'tr' ? 'Canlı Baskı Grafiği (Attack Momentum)' : (lang === 'de' ? 'Live-Angriffsmomentum-Welle' : 'Live Attack Momentum Wave')}
                                            </div>
                                            <EffectiveAttackGraph match={m} lang={lang} />
                                        </div>
                                    )}

                                    {/* Match Live Stats Card */}
                                    <MatchLiveStatsCard match={m} lang={lang} t={t} />

                                    {/* Match Incidents Timeline */}
                                    {EffectiveIncidentsTimeline && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--tb-text-secondary)', marginBottom: '4px' }}>
                                                ⏱️ {lang === 'tr' ? 'Canlı Maç Olayları' : (lang === 'de' ? 'Spielereignisse & Ticker' : 'Match Incidents Timeline')}
                                            </div>
                                            <EffectiveIncidentsTimeline match={m} lang={lang} />
                                        </div>
                                    )}

                                    {/* AI Verdict Details */}
                                    {signal && (
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px', fontSize: '0.72rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#38bdf8' }}>
                                                    🎯 {lang === 'tr' ? 'Yapay Zeka Stratejisi' : (lang === 'de' ? 'KI-Spielstrategie' : 'AI Match Strategy')}
                                                </span>
                                                {isBetReady && (
                                                    <span style={{ fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem' }}>
                                                        {predDisplay}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--tb-text-secondary)', lineHeight: 1.4 }}>
                                                {signal.reason || signal.mainReason || m.opportunityData?.reason || (lang === 'tr' ? 'Sistem saha verilerini analiz ediyor.' : (lang === 'de' ? 'System analysiert Spieldaten in Echtzeit.' : 'Analyzing match stats in real-time.'))}
                                            </div>
                                            {signal.activeStrategies && signal.activeStrategies.length > 0 && (
                                                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {signal.activeStrategies.map((strat, sIdx) => (
                                                        <span
                                                            key={sIdx}
                                                            style={{
                                                                background: 'rgba(16, 185, 129, 0.12)',
                                                                color: '#34d399',
                                                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            ⚡ {strat.label} {(() => {
                                                                const rawVal = strat.confidence || strat.score;
                                                                if (!rawVal) return '';
                                                                const pct = Math.min(88, Math.max(50, Math.round(rawVal > 100 ? (rawVal / 2) : rawVal)));
                                                                return `(%${pct})`;
                                                            })()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 🧠 Canlı Gol İhtimali & Yapay Zeka Radarı (Bayesian Intelligence) */}
                                    <div style={{
                                        background: 'linear-gradient(145deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(56, 189, 248, 0.22)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span>🧠</span>
                                                <span>{lang === 'tr' ? 'Gol İhtimali & AI Radarı' : (lang === 'de' ? 'Torwahrscheinlichkeit & KI-Radar' : 'Goal Probability & Radar')}</span>
                                            </span>
                                            <span style={{
                                                background: 'rgba(56, 189, 248, 0.15)',
                                                color: '#38bdf8',
                                                fontSize: '0.6rem',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                fontWeight: 800
                                            }}>
                                                %{goalProb}
                                            </span>
                                        </div>

                                        {/* 3-Col Gauge Grid */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1.2fr 1fr',
                                            gap: '4px',
                                            alignItems: 'center',
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            padding: '6px 4px',
                                            borderRadius: '6px',
                                            margin: '4px 0'
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.58rem', opacity: 0.6, fontWeight: 700 }}>{lang === 'tr' ? 'TEMPO' : (lang === 'de' ? 'TEMPO' : 'TEMPO')}</div>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f1f5f9' }}>%{baseTempo}</div>
                                            </div>
                                            <div style={{ textAlign: 'center', position: 'relative' }}>
                                                <svg width="70" height="38" viewBox="0 0 100 60" style={{ display: 'inline-block' }}>
                                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#38bdf8" strokeWidth="8" strokeDasharray={`${rawPosterior * 125}, 125`} strokeLinecap="round" />
                                                </svg>
                                                <div style={{ position: 'absolute', bottom: '0', left: 0, right: 0, fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8' }}>
                                                    %{goalProb}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.58rem', opacity: 0.6, fontWeight: 700 }}>{lang === 'tr' ? 'BASKI' : (lang === 'de' ? 'BOOST' : 'BOOST')}</div>
                                                <div style={{
                                                    fontSize: '1rem',
                                                    fontWeight: 900,
                                                    color: Number(pressureImpact) > 0 ? '#34d399' : Number(pressureImpact) < 0 ? '#ef4444' : '#f1f5f9'
                                                }}>
                                                    {Number(pressureImpact) > 0 ? `+${pressureImpact}%` : `${pressureImpact}%`}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', marginTop: '2px' }}>
                                            <span style={{ opacity: 0.65 }}>
                                                {lang === 'tr' ? 'Güven:' : (lang === 'de' ? 'Konf:' : 'Conf:')} <strong style={{ color: confidenceColor }}>{confidenceLabel}</strong>
                                            </span>
                                            <span style={{ opacity: 0.5, fontStyle: 'italic' }}>
                                                DQS: {(m.dqs || 0).toFixed(2)} • {lang === 'tr' ? 'Latans:' : (lang === 'de' ? 'Latenz:' : 'Latency:')} {latencyMs}ms
                                            </span>
                                        </div>
                                    </div>

                                    {/* 🛡️ Risk Guard & DQS Kalkanı */}
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--tb-border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span>🛡️</span>
                                                <span>{lang === 'tr' ? 'Risk Guard & DQS Kalkanı' : (lang === 'de' ? 'Risk Guard & DQS-Schutz' : 'Risk Guard & DQS Shield')}</span>
                                            </span>
                                            <span style={{
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                padding: '1px 5px',
                                                borderRadius: '4px',
                                                background: (dataQuality === 'TAM' || dataQuality === 'FULL') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: (dataQuality === 'TAM' || dataQuality === 'FULL') ? '#34d399' : '#f87171'
                                            }}>
                                                {lang === 'tr' ? `VERİ: ${dataQuality}` : (lang === 'de' ? `DATEN: ${dataQuality}` : `DATA: ${dataQuality}`)}
                                            </span>
                                        </div>

                                        {/* 3 Risk Pills */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', margin: '4px 0' }}>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{lang === 'tr' ? 'Ölü Maç' : (lang === 'de' ? 'Totes Sp.' : 'Dead')}</div>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: riskFilters.deadMatch?.status === 'OK' ? '#34d399' : '#ef4444' }}>
                                                    {riskFilters.deadMatch?.status === 'OK' ? (lang === 'tr' ? '✓ TAMAM' : (lang === 'de' ? '✓ OK' : '✓ OK')) : (lang === 'tr' ? '✗ RİSK' : (lang === 'de' ? '✗ RISIKO' : '✗ RISKY'))}
                                                </span>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{lang === 'tr' ? 'Momentum' : (lang === 'de' ? 'Mom.' : 'Mom.')}</div>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: riskFilters.momentum?.status === 'OK' ? '#34d399' : '#ef4444' }}>
                                                    {riskFilters.momentum?.status === 'OK' ? (lang === 'tr' ? '✓ AKTİF' : (lang === 'de' ? '✓ AKTIV' : '✓ ACTIVE')) : (lang === 'tr' ? '✗ PASİF' : (lang === 'de' ? '✗ PASSIV' : '✗ PASSIVE'))}
                                                </span>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{lang === 'tr' ? 'Geç Dk' : (lang === 'de' ? 'Spät' : 'Late')}</div>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: riskFilters.lateGame?.status === 'OK' ? '#34d399' : '#ef4444' }}>
                                                    {riskFilters.lateGame?.status === 'OK' ? (lang === 'tr' ? '✓ UYGUN' : (lang === 'de' ? '✓ FREI' : '✓ ELIGIBLE')) : (lang === 'tr' ? '✗ KİLİT' : (lang === 'de' ? '✗ GESPERRT' : '✗ LOCKED'))}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--tb-text-muted)' }}>
                                            <span>{lang === 'tr' ? 'Baskı:' : (lang === 'de' ? 'Druck:' : 'Press:')} <strong style={{ color: '#fbbf24' }}>%{pressureTotal}</strong></span>
                                            <span>{lang === 'tr' ? 'İvme:' : (lang === 'de' ? 'Dynamik:' : 'Vel:')} <strong style={{ color: '#f1f5f9' }}>{m.observations?.velocity?.trend || (heat >= 70 ? 'HOT' : 'STABLE')}</strong></span>
                                            <span>{lang === 'tr' ? 'Gecikme:' : (lang === 'de' ? 'Latenz:' : 'Lat:')} <strong style={{ color: '#38bdf8' }}>{latencyMs}ms</strong></span>
                                        </div>
                                    </div>

                                    {/* 🌐 Global Consensus External Prediction Radar */}
                                    <GlobalConsensusCard match={m} lang={lang} t={t} compact />

                                    {/* European Market Flow Detail */}
                                    {hasTrend && (
                                        <div className="tb-trend-box" style={{ padding: '8px', fontSize: '0.72rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#38bdf8' }}>
                                                    📈 {lang === 'tr' ? 'Avrupa Piyasa Akışı' : (lang === 'de' ? 'Europäischer Marktzufluss' : 'European Market Flow')}
                                                </span>
                                                <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`} style={{ fontSize: '0.62rem' }}>
                                                    {isTrendApproved 
                                                        ? (lang === 'tr' ? '🟢 Akıllı Para' : (lang === 'de' ? '🟢 Smart Money' : '🟢 Smart Money')) 
                                                        : isTrendTrap 
                                                        ? (lang === 'tr' ? '🔴 Tuzak Alarmı' : (lang === 'de' ? '🔴 Fallen-Alarm' : '🔴 Trap Alert')) 
                                                        : (lang === 'de' ? '📊 Marktzufluss' : (lang === 'tr' ? '📊 Piyasa Akışı' : '📊 Market Flow'))}
                                                </span>
                                            </div>

                                            {/* ⏱️ Score & Time Evolution Timeline Strip */}
                                            {trendInfo && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    flexWrap: 'wrap',
                                                    background: 'rgba(15, 23, 42, 0.65)',
                                                    border: '1px solid rgba(56, 189, 248, 0.16)',
                                                    borderRadius: '6px',
                                                    padding: '5px 8px',
                                                    fontSize: '0.68rem',
                                                    marginBottom: '6px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#94a3b8' }}>📍 {lang === 'tr' ? 'Giriş:' : (lang === 'de' ? 'Start:' : 'Entry:')}</span>
                                                        <span style={{ color: '#fbbf24', fontWeight: 900 }}>
                                                            ⚽ {trendInfo.entryScore}
                                                            {trendInfo.entryMinStr && <span style={{ color: '#38bdf8', marginLeft: '3px' }}>({trendInfo.entryMinStr})</span>}
                                                        </span>
                                                    </div>

                                                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#94a3b8' }}>⏱️ {trendInfo.durationLabel}</span>
                                                        {trendInfo.isNew && (
                                                            <span style={{ fontSize: '0.58rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '0 4px', borderRadius: '3px', fontWeight: 800 }}>
                                                                {lang === 'tr' ? 'TAZE' : (lang === 'de' ? 'NEU' : 'FRESH')}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {trendInfo.goalsSince > 0 && (
                                                        <div style={{ width: '100%', marginTop: '2px' }}>
                                                            <span style={{ color: '#10b981', fontWeight: 900, background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.64rem' }}>
                                                                ⚡ +{trendInfo.goalsSince} {lang === 'tr' ? 'Gol Geldi' : (lang === 'de' ? 'Tor gefallen' : 'Goal')} ({trendInfo.entryScore} ➔ {trendInfo.currentScoreStr})
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div style={{ color: 'var(--tb-text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                                                <span><strong>{lang === 'tr' ? 'Piyasa Tercihi:' : (lang === 'de' ? 'Marktprognose:' : 'Market Pick:')}</strong> <span style={{ color: '#fff', fontWeight: 900 }}>{marketPrediction}</span></span>
                                                <span><strong>{lang === 'tr' ? 'Oran:' : (lang === 'de' ? 'Quote:' : 'Odds:')}</strong> <span style={{ color: '#fbbf24', fontWeight: 800 }}>@{primaryTrend.odds}</span></span>
                                                <span><strong>{lang === 'tr' ? 'Hacim:' : (lang === 'de' ? 'Volumen:' : 'Vol:')}</strong> <span style={{ color: '#f87171', fontWeight: 800 }}>{totalTrendCount} {lang === 'tr' ? 'Kupon' : (lang === 'de' ? 'Wettscheine' : 'Bets')}</span></span>
                                            </div>

                                            {trendInfo?.isRest && (
                                                <div style={{ fontSize: '0.65rem', color: '#7dd3fc', background: 'rgba(56, 189, 248, 0.08)', border: '1px dashed rgba(56, 189, 248, 0.25)', borderRadius: '4px', padding: '3px 6px', marginBottom: '4px' }}>
                                                    ℹ️ {lang === 'tr'
                                                        ? `Kalan Süre: ${trendInfo.entryScore} anından sonraki goller sayılır (Toplam en az ${trendInfo.initialGoals + 1} gol).`
                                                        : (lang === 'de'
                                                            ? `Restzeit: Zählt ab ${trendInfo.entryScore} (Mind. ${trendInfo.initialGoals + 1} Tore gesamt).`
                                                            : `Rest of match: Counts goals after ${trendInfo.entryScore} (Min ${trendInfo.initialGoals + 1} total goals).`)}
                                                </div>
                                            )}

                                            <div style={{ fontSize: '0.68rem', color: 'var(--tb-text-muted)', lineHeight: 1.3 }}>
                                                {isTrendApproved
                                                    ? (lang === 'tr' ? `DQS (%${(dqsVal * 100).toFixed(0)}) piyasadaki tercihi (${marketPrediction}) teyit ediyor.` : (lang === 'de' ? `DQS (%${(dqsVal * 100).toFixed(0)}) bestätigt die Marktprognose (${marketPrediction}).` : `DQS (${(dqsVal * 100).toFixed(0)}%) confirms market pick (${marketPrediction}).`))
                                                    : isTrendTrap
                                                    ? (lang === 'tr' ? `Düşük DQS (%${(dqsVal * 100).toFixed(0)}%). Piyasada (${marketPrediction}) bahsine kalabalık tuzağa çekiliyor!` : (lang === 'de' ? `Niedriger DQS (%${(dqsVal * 100).toFixed(0)}%). Das Wettpublikum bei (${marketPrediction}) tappt möglicherweise in eine Falle!` : `Low DQS (${(dqsVal * 100).toFixed(0)}%). Crowd betting on (${marketPrediction}) may be in a trap!`))
                                                    : (lang === 'de' ? `Stabiler Datenfluss (%${(dqsVal * 100).toFixed(0)} DQS). Spiel weiter beobachten.` : (lang === 'tr' ? `Dengeli veri akışı (%${(dqsVal * 100).toFixed(0)} DQS). Maçı canlı takip edin.` : `Stable data flow (${(dqsVal * 100).toFixed(0)}% DQS). Keep observing.`))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Actions Bar */}
                                    <div className="tb-m-quick-actions">
                                        <button
                                            type="button"
                                            className="tb-m-action-btn"
                                            disabled={trackedMatchIds.has(m.id)}
                                            style={{
                                                background: trackedMatchIds.has(m.id) ? 'rgba(16, 185, 129, 0.18)' : '#10b981',
                                                color: trackedMatchIds.has(m.id) ? '#34d399' : '#000',
                                                border: trackedMatchIds.has(m.id) ? '1px solid rgba(16, 185, 129, 0.4)' : 'none'
                                            }}
                                            onClick={() => {
                                                onApproveBet(m, signal);
                                                setTrackedMatchIds(prev => new Set([...prev, m.id]));
                                            }}
                                        >
                                            <span>{trackedMatchIds.has(m.id) ? '✓' : '📌'}</span>
                                            <span>{trackedMatchIds.has(m.id) ? (lang === 'tr' ? 'Takip Ediliyor' : (lang === 'de' ? 'Wird beobachtet' : 'Tracking')) : (lang === 'tr' ? 'Kupona Ekle' : (lang === 'de' ? 'Zum Schein' : 'Add to Slip'))}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="tb-m-action-btn secondary"
                                            onClick={() => setExpandedMatchId(null)}
                                        >
                                            <span>▲</span>
                                            <span>{lang === 'tr' ? 'Detayları Kapat' : (lang === 'de' ? 'Details schließen' : 'Close Details')}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
            })}
        </div>
    );
};
