import React, { useState, useMemo } from 'react';
import { calculateMatchHeatScore, calculateLast20MinMetrics, formatMarketPrediction, getTrendTimelineInfo, parseNumericMinute } from '../logic/liveSortEngine';
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
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('desc');

    const handleColumnSort = (colKey) => {
        if (sortColumn === colKey) {
            if (sortDirection === 'desc') {
                setSortDirection('asc');
            } else {
                setSortColumn(null);
                setSortDirection('desc');
            }
        } else {
            setSortColumn(colKey);
            setSortDirection('desc');
        }
    };

    const renderSortIcon = (colKey) => {
        if (sortColumn !== colKey) {
            return <span className="tb-sort-indicator tb-sort-idle" aria-hidden="true">⇅</span>;
        }
        return (
            <span className="tb-sort-indicator tb-sort-active" aria-hidden="true">
                {sortDirection === 'desc' ? '▼' : '▲'}
            </span>
        );
    };

    const sortedMatches = useMemo(() => {
        if (!sortColumn) return matches;
        const modifier = sortDirection === 'asc' ? 1 : -1;

        return [...matches].sort((a, b) => {
            let valA = 0;
            let valB = 0;

            switch (sortColumn) {
                case 'minute': {
                    valA = parseNumericMinute(a.minute);
                    valB = parseNumericMinute(b.minute);
                    break;
                }
                case 'score': {
                    const parseGoals = (m) => {
                        if (typeof m.score === 'object' && m.score !== null) {
                            return (Number(m.score.home) || 0) + (Number(m.score.away) || 0);
                        }
                        const parts = String(m.score || '0-0').replace(':', '-').split('-');
                        return (parseInt(parts[0], 10) || 0) + (parseInt(parts[1], 10) || 0);
                    };
                    valA = parseGoals(a);
                    valB = parseGoals(b);
                    break;
                }
                case 'heat': {
                    const sigA = signals[a.id];
                    const oppA = (opportunitiesMap instanceof Map ? opportunitiesMap.get(a.id) : null) || a.opportunityData;
                    valA = calculateMatchHeatScore(a, sigA, oppA);

                    const sigB = signals[b.id];
                    const oppB = (opportunitiesMap instanceof Map ? opportunitiesMap.get(b.id) : null) || b.opportunityData;
                    valB = calculateMatchHeatScore(b, sigB, oppB);
                    break;
                }
                case 'pressure': {
                    const sigA = signals[a.id];
                    const oppA = (opportunitiesMap instanceof Map ? opportunitiesMap.get(a.id) : null) || a.opportunityData;
                    valA = a.observations?.pressure?.total ?? calculateMatchHeatScore(a, sigA, oppA);

                    const sigB = signals[b.id];
                    const oppB = (opportunitiesMap instanceof Map ? opportunitiesMap.get(b.id) : null) || b.opportunityData;
                    valB = b.observations?.pressure?.total ?? calculateMatchHeatScore(b, sigB, oppB);
                    break;
                }
                case 'possession': {
                    valA = Math.abs((Number(a.stats?.possession?.home) || 50) - (Number(a.stats?.possession?.away) || 50));
                    valB = Math.abs((Number(b.stats?.possession?.home) || 50) - (Number(b.stats?.possession?.away) || 50));
                    break;
                }
                case 'shots': {
                    valA = (Number(a.stats?.shotsOnGoal?.home) || 0) + (Number(a.stats?.shotsOnGoal?.away) || 0);
                    valB = (Number(b.stats?.shotsOnGoal?.home) || 0) + (Number(b.stats?.shotsOnGoal?.away) || 0);
                    break;
                }
                case 'da': {
                    valA = (Number(a.stats?.dangerousAttacks?.home) || 0) + (Number(a.stats?.dangerousAttacks?.away) || 0);
                    valB = (Number(b.stats?.dangerousAttacks?.home) || 0) + (Number(b.stats?.dangerousAttacks?.away) || 0);
                    break;
                }
                case 'xg': {
                    valA = (Number(a.stats?.xg?.home) || 0) + (Number(a.stats?.xg?.away) || 0);
                    valB = (Number(b.stats?.xg?.home) || 0) + (Number(b.stats?.xg?.away) || 0);
                    break;
                }
                default:
                    return 0;
            }

            if (valA === valB) {
                return parseNumericMinute(b.minute) - parseNumericMinute(a.minute);
            }
            return valA > valB ? modifier : -modifier;
        });
    }, [matches, sortColumn, sortDirection, signals, opportunitiesMap]);

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
        if (lang === 'de' && label) {
            if (label.startsWith('Sıradaki Gol:')) {
                label = label.replace('Sıradaki Gol:', 'Nächstes Tor:');
            } else if (label === 'İY 0.5 ÜST' || label === 'İlk Yarı 0.5 Üst') {
                label = '1. HZ Über 0.5';
            } else if (label === 'SON 15DK PATLAMASI') {
                label = '15m MOMENTUM-SCHWUNG';
            } else if (label === 'GERİ DÖNÜŞ') {
                label = 'COMEBACK';
            } else if (label === 'FAVORİ GERİ DÖNÜŞ') {
                label = 'FAVORITEN-COMEBACK';
            } else if (label === 'KORNER BASKISI') {
                label = 'ECKENDIFFERENZ';
            } else if (label === 'KG VAR DİNAMİĞİ' || label === 'KG VAR') {
                label = 'BEIDE TREFFEN (BTTS)';
            } else if (label === 'SAYISAL ÜSTÜNLÜK') {
                label = 'ÜBERZAHL-VORTEIL';
            } else if (label === 'SKOR MARUZİYETİ') {
                label = 'TORREICHES SPIEL';
            } else if (label === 'Maç Sonu / Kilitli') {
                label = 'Spielende / Gesperrt';
            } else if (label === 'Kopmuş Maç (Rehavet / Riskli)') {
                label = 'Entschiedenes Spiel (Riskant)';
            } else if (label === 'Son Dakikalar / Fark 2+ (Stabil)') {
                label = 'Späte Phase (Stabil)';
            } else if (label === 'Düşük Tempo (Ölü Maç)') {
                label = 'Niedriges Tempo (Totes Spiel)';
            } else if (label === 'Oran Değersiz (Pas)') {
                label = 'Quote ohne Wert (Pass)';
            } else if (label === 'Geç Dakika / Riskli (Pas)') {
                label = 'Späte Phase / Riskant (Pass)';
            } else if (label === 'Maç Kopmuş / Oran Düşük') {
                label = 'Spiel entschieden / Quote niedrig';
            } else {
                label = label
                    .replace(/Maç Sonu Galibiyeti \(MS 1\)/g, 'Heimsieg (1)')
                    .replace(/Maç Sonu Galibiyeti \(MS 2\)/g, 'Auswärtssieg (2)')
                    .replace(/Üst Bekleniyor/g, 'Tore erwartet');
            }
        } else if (lang === 'en' && label) {
            if (label.startsWith('Sıradaki Gol:')) {
                label = label.replace('Sıradaki Gol:', 'Next Goal:');
            } else if (label === 'İY 0.5 ÜST' || label === 'İlk Yarı 0.5 Üst') {
                label = '1st Half Over 0.5';
            } else if (label === 'SON 15DK PATLAMASI') {
                label = '15m MOMENTUM BURST';
            } else if (label === 'GERİ DÖNÜŞ') {
                label = 'COMEBACK';
            } else if (label === 'FAVORİ GERİ DÖNÜŞ') {
                label = 'FAVORITE COMEBACK';
            } else if (label === 'KORNER BASKISI') {
                label = 'CORNER PRESSURE';
            } else if (label === 'KG VAR DİNAMİĞİ' || label === 'KG VAR') {
                label = 'BTTS DYNAMIC';
            } else if (label === 'SAYISAL ÜSTÜNLÜK') {
                label = 'NUMERICAL ADVANTAGE';
            } else if (label === 'SKOR MARUZİYETİ') {
                label = 'HIGH SCORE EXPOSURE';
            } else if (label === 'Maç Sonu / Kilitli') {
                label = 'Match Ended / Locked';
            } else if (label === 'Kopmuş Maç (Rehavet / Riskli)') {
                label = 'Blowout Match (High Risk)';
            } else if (label === 'Son Dakikalar / Fark 2+ (Stabil)') {
                label = 'Late Phase (Stable)';
            } else if (label === 'Düşük Tempo (Ölü Maç)') {
                label = 'Low Tempo (Dead Match)';
            } else if (label === 'Oran Değersiz (Pas)') {
                label = 'No Value in Odds (Pass)';
            } else if (label === 'Geç Dakika / Riskli (Pas)') {
                label = 'Late Minute / Risky (Pass)';
            } else if (label === 'Maç Kopmuş / Oran Düşük') {
                label = 'Blowout / Low Odds';
            } else {
                label = label
                    .replace(/Maç Sonu Galibiyeti \(MS 1\)/g, 'Full-Time Win (1)')
                    .replace(/Maç Sonu Galibiyeti \(MS 2\)/g, 'Full-Time Win (2)')
                    .replace(/Üst Bekleniyor/g, 'Goals Expected');
            }
        }
        return label || (lang === 'tr' ? 'BAHİS' : lang === 'de' ? 'WETTE' : 'BET');
    };


    const computeMatchData = (m) => {
        const signal = signals[m.id];
        const isPinned = pinnedMatchIds.has(m.id);
        const rawHeat = calculateMatchHeatScore(m, signal);
        const heat = (typeof rawHeat === 'number' && !isNaN(rawHeat)) ? rawHeat : 0;
        const opp = (opportunitiesMap instanceof Map ? opportunitiesMap.get(m.id) : null) || m.opportunityData;
        const rawScore = (opp?.score !== undefined && typeof opp.score === 'number' && !isNaN(opp.score)) ? opp.score : heat;
        const heatScore = Math.max(0, Math.min(100, Math.round(rawScore || 0)));
        const rawHeatLevel = opp?.heatLevel || (heatScore >= 75 ? 'ALEV' : heatScore >= 50 ? 'SICAK' : 'SOGUK');
        const heatLevel = lang === 'en'
            ? (rawHeatLevel === 'ALEV' ? 'FLAME' : rawHeatLevel === 'SICAK' ? 'HOT' : (rawHeatLevel === 'SOGUK' || rawHeatLevel === 'COLD') ? 'COLD' : rawHeatLevel)
            : lang === 'de' ? (rawHeatLevel === 'ALEV' ? 'FEUER' : rawHeatLevel === 'SICAK' ? 'HEISS' : (rawHeatLevel === 'SOGUK' || rawHeatLevel === 'COLD') ? 'KALT' : rawHeatLevel) : (rawHeatLevel === 'ALEV' ? 'ALEV' : rawHeatLevel === 'SICAK' ? 'SICAK' : rawHeatLevel === 'COLD' ? 'SOĞUK' : rawHeatLevel);
        const heatIcon = (rawHeatLevel === 'ALPHA' || heatLevel === 'ALPHA') ? '🚀' : (rawHeatLevel === 'ALEV' || heatLevel === 'FLAME' || heatLevel === 'FEUER') ? '🔥' : (rawHeatLevel === 'SICAK' || heatLevel === 'HOT' || heatLevel === 'HEISS') ? '⚡' : '❄️';
        const windowMomentum = opp?.components?.momentum ?? opp?.score ?? heat;
        const last20 = calculateLast20MinMetrics(m, signal, momentumWindow);

        const possHome = Number(m.stats?.possession?.home || 0);
        const possAway = Number(m.stats?.possession?.away || 0);
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

        const riskFilters = (dataWorker && typeof dataWorker.checkRiskFilters === 'function')
            ? dataWorker.checkRiskFilters(m)
            : {
                deadMatch: { status: 'OK' },
                momentum: { status: 'OK' },
                lateGame: { status: 'OK' }
            };

        // Parse scores reliably for game-state & dead match checks
        let parsedHomeScore = 0;
        let parsedAwayScore = 0;
        if (m.score && typeof m.score === 'object') {
            parsedHomeScore = Number(m.score.home ?? 0) || 0;
            parsedAwayScore = Number(m.score.away ?? 0) || 0;
        } else if (m.homeScore !== undefined || m.awayScore !== undefined) {
            parsedHomeScore = Number(m.homeScore?.current ?? m.homeScore ?? 0) || 0;
            parsedAwayScore = Number(m.awayScore?.current ?? m.awayScore ?? 0) || 0;
        } else if (typeof m.score === 'string' && (m.score.includes('-') || m.score.includes(':'))) {
            const parts = m.score.replace(':', '-').split('-');
            parsedHomeScore = parseInt(parts[0]) || 0;
            parsedAwayScore = parseInt(parts[1]) || 0;
        }
        const goalDiffVal = Math.abs(parsedHomeScore - parsedAwayScore);
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
        const isEarlyMin = !opp?.isHalftime && minVal < 15 && (sogHome + sogAway < 2) && (daHome + daAway < 15);
        const isTrendApproved = hasTrend && dqsVal >= 0.50 && !isDeadMatch && !isEarlyMin && heatScore >= 45;
        const isTrendTrap = hasTrend && (dqsVal < 0.40 || isDeadMatch);
        const marketPrediction = hasTrend ? formatMarketPrediction(primaryTrend, lang) : '';
        const trendInfo = hasTrend ? getTrendTimelineInfo(primaryTrend, m, lang) : null;

        // Consolidated Intelligence (Bayesian Radar & Risk Guard)
        const bayesian = m?.observations?.bayesian;
        const heatNorm = Math.min(1, Math.max(0, heat / 100));
        const rawPosterior = bayesian?.posterior ?? Math.min(0.92, Math.max(0.12, (heatNorm * 0.45 + ((xgHome + xgAway) > 0 ? (xgHome + xgAway) * 0.15 : (sogHome + sogAway) * 0.04) + (daDiff >= 15 ? 0.12 : 0))));
        const effectivePosterior = isDeadMatch ? Math.min(0.32, rawPosterior * 0.45) : rawPosterior;
        const goalProb = (effectivePosterior * 100).toFixed(1);
        const baseTempo = isDeadMatch ? Math.min(28, Math.round((bayesian?.prior || 0.4) * 45)) : (bayesian?.prior ? Math.round(bayesian.prior * 100) : Math.min(85, Math.max(20, Math.round(heatNorm * 60 + 15))));
        const pressureImpact = isDeadMatch ? '-12.0' : (bayesian?.impact ? (bayesian.impact * 100).toFixed(1) : ((effectivePosterior - (baseTempo / 100)) * 100).toFixed(1));
        const confidence = isDeadMatch ? 'LOW' : (bayesian?.confidence || (heat >= 70 ? 'HIGH' : heat >= 45 ? 'MEDIUM' : 'LOW'));
        const confidenceLabel = confidence === 'HIGH' ? (lang === 'tr' ? 'YÜKSEK' : (lang === 'de' ? 'HOCH' : 'HIGH')) : confidence === 'MEDIUM' ? (lang === 'tr' ? 'ORTA' : (lang === 'de' ? 'MITTEL' : 'MEDIUM')) : (lang === 'tr' ? 'DÜŞÜK' : (lang === 'de' ? 'NIEDRIG' : 'LOW'));
        const confidenceColor = confidence === 'HIGH' ? '#10b981' : confidence === 'MEDIUM' ? '#fbbf24' : '#ef4444';
        const latencyMs = m.latency || Math.round(35 + (m.id ? (Number(String(m.id).replace(/\D/g, '')) % 40) : 12));
        const dataQuality = m.dataQuality === 'PARTIAL' ? (lang === 'tr' ? 'BEKLENİYOR' : (lang === 'de' ? 'AUSSTEHEND' : 'PENDING')) : (m.dataQuality === 'LIMITED' ? (lang === 'tr' ? 'KISITLI' : (lang === 'de' ? 'EINGESCHRÄNKT' : 'LIMITED')) : (lang === 'tr' ? 'TAM' : (lang === 'de' ? 'VOLLSTÄNDIG' : 'FULL')));
        const pressureTotal = m.observations?.pressure?.total || Math.round(heat * 0.85);

        const minStr = String(m?.minute || '').trim();
        const minNum = parseInt(minStr.replace(/[^0-9]/g, '')) || 0;
        const isLateOrFinished = minStr.includes('90+') || minStr === 'MS' || minStr.includes('FT') || minNum >= 88;
        const predText = getPredictionDisplay(m, signal);
        const isBetReady = signal?.verdict === 'BET' && Boolean(predText) && !isLateOrFinished;
        const isHot = heat >= 75;

        return {
            signal, isPinned, rawHeat, heat, opp, heatScore, rawHeatLevel, heatLevel, heatIcon, windowMomentum, last20,
            possHome, possAway, sogHome, sogAway, daHome, daAway, daDiff, xgHome, xgAway,
            redHome, redAway, yellowHome, yellowAway, oddsHome, oddsDraw, oddsAway,
            daAlertClass, heatAlertClass, riskFilters, parsedHomeScore, parsedAwayScore, goalDiffVal, minVal, isDeadMatch,
            matchTrendingBets, hasTrend, primaryTrend, totalTrendCount, dqsVal, isEarlyMin, isTrendApproved, isTrendTrap,
            marketPrediction, trendInfo, bayesian, heatNorm, rawPosterior, effectivePosterior, goalProb, baseTempo,
            pressureImpact, confidence, confidenceLabel, confidenceColor, latencyMs, dataQuality, pressureTotal,
            minStr, minNum, isLateOrFinished, predText, isBetReady, isHot
        };
    };

    const renderSignalBadge = (m, d) => {
        const { signal, heat, isDeadMatch, predText, minStr, isLateOrFinished, last20, sogHome, sogAway, xgHome, xgAway } = d;

        if (isLateOrFinished) {
            return (
                <span className="tb-signal-badge tb-signal-pass" style={{ opacity: 0.6 }}>
                    {minStr === 'MS' || minStr.includes('FT') ? (lang === 'tr' ? 'MS' : (lang === 'de' ? 'ES' : 'FT')) : (lang === 'tr' ? 'KİLİTLİ (88+)' : (lang === 'de' ? 'GESPERRT (88+)' : 'LOCKED (88+)'))}
                </span>
            );
        }

        const isAdminUser = userProfile?.plan === 'admin' || userProfile?.role === 'admin';
        const isExpired = !isAdminUser && userProfile && (userProfile?.status === 'expired' || (userProfile?.subscription_end && new Date(userProfile.subscription_end) < new Date()));

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

        if (isDeadMatch) {
            return (
                <span
                    className="tb-signal-badge"
                    style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        fontWeight: 800,
                        whiteSpace: 'nowrap'
                    }}
                    title={d.riskFilters?.deadMatch?.reason || (lang === 'tr' ? 'Maç koptu, takımlarda rehavet riski yüksek.' : (lang === 'de' ? 'Spiel ist entschieden, hohes Risiko taktischer Passivität.' : 'Blowout match, high complacency risk.'))}
                >
                    ⚠️ {lang === 'tr' ? 'KOPMUŞ MAÇ' : (lang === 'de' ? 'ENTSCHIEDEN' : 'BLOWOUT')}
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

        if (heat >= 75 && !isDeadMatch) {
            return (
                <span className="tb-signal-badge tb-signal-hot">
                    🔥 {lang === 'tr' ? 'ALEV' : (lang === 'de' ? 'FEUER' : 'FLAME')}
                </span>
            );
        }

        if (last20.isSurging && !isDeadMatch) {
            const domSide = last20.dominantSide;
            const domSog = domSide === 'HOME' ? sogHome : (domSide === 'AWAY' ? sogAway : (sogHome + sogAway));
            const domXg = domSide === 'HOME' ? xgHome : (domSide === 'AWAY' ? xgAway : (xgHome + xgAway));
            const hasRealThreat = domSog >= 2 || domXg >= 0.25 || (last20.teamDeltaDA || last20.deltaDA) >= 8;

            if (hasRealThreat) {
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
    };

    const renderExpandedTray = (m, d) => {
        const {
            signal, isPinned, rawHeat, heat, opp, heatScore, rawHeatLevel, heatLevel, heatIcon, windowMomentum, last20,
            possHome, possAway, sogHome, sogAway, daHome, daAway, daDiff, xgHome, xgAway,
            redHome, redAway, yellowHome, yellowAway, oddsHome, oddsDraw, oddsAway,
            daAlertClass, heatAlertClass, riskFilters, parsedHomeScore, parsedAwayScore, goalDiffVal, minVal, isDeadMatch,
            matchTrendingBets, hasTrend, primaryTrend, totalTrendCount, dqsVal, isEarlyMin, isTrendApproved, isTrendTrap,
            marketPrediction, trendInfo, bayesian, heatNorm, rawPosterior, effectivePosterior, goalProb, baseTempo,
            pressureImpact, confidence, confidenceLabel, confidenceColor, latencyMs, dataQuality, pressureTotal,
            minStr, minNum, isLateOrFinished, predText, isBetReady, isHot
        } = d;

        return (
                                                <div className="tb-expanded-content">
                                                    {/* 🎖️ EXECUTIVE AI VERDICT BANNER (Single Source of Truth) */}
                                                    <div style={{
                                                        gridColumn: '1 / -1',
                                                        background: isDeadMatch
                                                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(15, 23, 42, 0.85) 100%)'
                                                            : (signal?.verdict === 'BET'
                                                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0.85) 100%)'
                                                                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)'),
                                                        border: `1px solid ${isDeadMatch ? 'rgba(239, 68, 68, 0.4)' : (signal?.verdict === 'BET' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.28)')}`,
                                                        borderRadius: '8px',
                                                        padding: '0.75rem 1rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        flexWrap: 'wrap',
                                                        gap: '10px',
                                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{ fontSize: '1.3rem' }}>
                                                                {isDeadMatch ? '⚠️' : (signal?.verdict === 'BET' ? '🎯' : '🔍')}
                                                            </span>
                                                            <div>
                                                                <div style={{
                                                                    fontSize: '0.82rem',
                                                                    fontWeight: 900,
                                                                    color: isDeadMatch ? '#f87171' : (signal?.verdict === 'BET' ? '#34d399' : '#38bdf8'),
                                                                    letterSpacing: '0.4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px'
                                                                }}>
                                                                    <span>
                                                                        {isDeadMatch
                                                                            ? (lang === 'tr' ? `KOPMUŞ MAÇ (${formatScore(m.score)}) — CANLI BAHİS VETOSU` : (lang === 'de' ? `ENTSCHIEDENES SPIEL (${formatScore(m.score)}) — LIVE-WETT-VETO` : `BLOWOUT (${formatScore(m.score)}) — BETTING VETO`))
                                                                            : (signal?.verdict === 'BET'
                                                                                ? (lang === 'tr' ? 'YAPAY ZEKA STRATEJİSİ ONAYLANDI' : (lang === 'de' ? 'KI-STRATEGIE BESTÄTIGT' : 'AI STRATEGY CONFIRMED'))
                                                                                : (lang === 'tr' ? 'CANLI RADAR İZLEMESİ' : (lang === 'de' ? 'LIVE-RADAR-BEOBACHTUNG' : 'LIVE RADAR TRACKING')))}
                                                                    </span>
                                                                    {isDeadMatch && (
                                                                        <span style={{
                                                                            fontSize: '0.62rem',
                                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                                            color: '#fca5a5',
                                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                                            padding: '1px 6px',
                                                                            borderRadius: '4px',
                                                                            fontWeight: 800
                                                                        }}>
                                                                            {lang === 'tr' ? 'RÖLANTİ RİSKİ' : (lang === 'de' ? 'PASSIVITÄTS-RISIKO' : 'COMPLACENCY RISK')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--tb-text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>
                                                                    {isDeadMatch
                                                                        ? (lang === 'tr'
                                                                            ? `Skor farkı (${goalDiffVal}) nedeniyle takımların oyunu rölantiye alma ve as oyuncuları koruma riski yüksek. Canlı gol pazarları kilitlenmiştir.`
                                                                            : (lang === 'de'
                                                                                ? `Aufgrund der Tordifferenz (${goalDiffVal}) besteht ein hohes Risiko für Passivität und Schonung von Stammspielern. Live-Tormärkte gesperrt.`
                                                                                : `Score differential (${goalDiffVal}) poses complacency risk. In-play goal strategies disabled.`))
                                                                        : (signal?.verdict === 'BET'
                                                                            ? (lang === 'tr' ? `${predText || 'Sıradaki Gol'} yönünde istatistiksel üstünlük ve değer fırsatı tespit edildi.` : (lang === 'de' ? `Statistischer Value-Vorteil für ${predText || 'Nächstes Tor'} bestätigt.` : `Statistical value edge confirmed.`))
                                                                            : (signal?.reason || signal?.mainReason || (lang === 'tr' ? 'Karşılaşma radar altında izleniyor; istatistiksel ve algoritmik şartlar bekleniyor.' : (lang === 'de' ? 'Spiel wird im Radar beobachtet; statistische und algorithmische Kriterien werden abgewartet.' : 'Tracking match.'))))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {signal?.verdict === 'BET' && predText && !isDeadMatch && (
                                                                <span style={{
                                                                    background: '#10b981',
                                                                    color: '#000',
                                                                    padding: '3px 10px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 900
                                                                }}>
                                                                    ✓ {predText}
                                                                </span>
                                                            )}
                                                            <span style={{
                                                                fontSize: '0.68rem',
                                                                fontWeight: 800,
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                padding: '3px 8px',
                                                                borderRadius: '4px',
                                                                color: 'var(--tb-text-muted)'
                                                            }}>
                                                                DQS: {(m.dqs || 0).toFixed(2)} | Tier {m.tier || 1}
                                                            </span>
                                                            {isAdmin && onSendToTelegram && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); onSendToTelegram(e, m, opp); }}
                                                                    className="tb-action-ignore opp-telegram-btn"
                                                                    style={{ width: '30px', height: '30px', fontSize: '0.9rem', cursor: 'pointer' }}
                                                                    title={lang === 'tr' ? "Analizi VIP Telegram Grubuna Gönder" : (lang === 'de' ? "An VIP-Gruppe senden" : "Send to VIP Group")}
                                                                >
                                                                    ✈️
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Left: Momentum Bar & Graph, Live Stats & Incidents */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                                                                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--tb-border)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.72rem' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isHomeHeavy ? '#38bdf8' : '#94a3b8', fontWeight: isHomeHeavy ? 900 : 700 }}>
                                                                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block', boxShadow: isHomeHeavy ? '0 0 8px #38bdf8' : 'none' }} />
                                                                            <span>{m.homeTeam} (%{homePct})</span>
                                                                            {isHomeHeavy && <span style={{ fontSize: '0.62rem', color: '#38bdf8' }}>⚡ BASKI</span>}
                                                                        </div>

                                                                        <div style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 800,
                                                                            padding: '2px 8px',
                                                                            borderRadius: '4px',
                                                                            background: isHot ? 'rgba(239, 68, 68, 0.2)' : (isHomeHeavy || isAwayHeavy ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                                                                            color: isHot ? '#f87171' : (isHomeHeavy ? '#38bdf8' : isAwayHeavy ? '#f43f5e' : '#94a3b8')
                                                                        }}>
                                                                            {isHot ? (lang === 'tr' ? '🔥 RİTİM YÜKSEK' : '🔥 HIGH TEMPO') : (isHomeHeavy ? `⚡ ${m.homeTeam?.split(' ')?.[0] || 'Ev'} Yükleniyor` : isAwayHeavy ? `⚡ ${m.awayTeam?.split(' ')?.[0] || 'Dep'} Yükleniyor` : (lang === 'tr' ? '⚪ DENGELİ TEMPO' : '⚪ BALANCED TEMPO'))}
                                                                        </div>

                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isAwayHeavy ? '#f43f5e' : '#94a3b8', fontWeight: isAwayHeavy ? 900 : 700 }}>
                                                                            {isAwayHeavy && <span style={{ fontSize: '0.62rem', color: '#f43f5e' }}>BASKI ⚡</span>}
                                                                            <span>(%{awayPct}) {m.awayTeam}</span>
                                                                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f43f5e', display: 'inline-block', boxShadow: isAwayHeavy ? '0 0 8px #f43f5e' : 'none' }} />
                                                                        </div>
                                                                    </div>

                                                                    {/* Dual Colored Gradient Bar */}
                                                                    <div style={{ position: 'relative', height: '7px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                                                                        <div style={{ width: `${homePct}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8)', height: '100%' }} />
                                                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: 'rgba(255, 255, 255, 0.6)', zIndex: 2 }} />
                                                                        <div style={{ width: `${awayPct}%`, background: 'linear-gradient(90deg, #f43f5e, #e11d48)', height: '100%' }} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Momentum Wave Header & Graph */}
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span>📈</span>
                                                                    <span>{lang === 'tr' ? 'CANLI BASKI GRAFİĞİ (MOMENTUM DALGASI)' : (lang === 'de' ? 'LIVE-ANGRIFFSMOMENTUM-WELLE' : 'LIVE ATTACK MOMENTUM WAVE')}</span>
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
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <button
                                                                        type="button"
                                                                        className={`tb-action-ignore tb-detail-fav-btn ${isPinned ? 'pinned' : ''}`}
                                                                        onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                                                        title={isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : (lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites')) : (lang === 'tr' ? 'Favoriye Ekle' : (lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites'))}
                                                                    >
                                                                        <StarIcon filled={isPinned} size={12} />
                                                                        <span>{isPinned ? (lang === 'tr' ? 'Favorilerde ★' : (lang === 'de' ? 'Favorisiert ★' : 'Pinned ★')) : (lang === 'tr' ? '☆ Favoriye Ekle' : (lang === 'de' ? '☆ Favorisieren' : '☆ Pin'))}</span>
                                                                    </button>
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
                                                                    <div style={{ fontSize: '0.65rem', color: isDeadMatch ? '#f87171' : '#38bdf8', fontWeight: 900, marginBottom: '2px' }}>
                                                                        {lang === 'tr' ? 'GÜNCEL GOL İHTİMALİ' : (lang === 'de' ? 'TORWAHRSCHEINLICHKEIT' : 'GOAL PROBABILITY')}
                                                                    </div>
                                                                    <div style={{ position: 'relative', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <svg width="86" height="48" viewBox="0 0 100 60">
                                                                            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                                                                            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={isDeadMatch ? '#f87171' : '#38bdf8'} strokeWidth="8" strokeDasharray={`${effectivePosterior * 125}, 125`} strokeLinecap="round" />
                                                                        </svg>
                                                                        <div style={{ position: 'absolute', bottom: '0', fontSize: '1.25rem', fontWeight: 900, color: isDeadMatch ? '#f87171' : '#38bdf8' }}>
                                                                            %{goalProb}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.58rem', color: isDeadMatch ? '#f87171' : '#38bdf8', opacity: 0.85, marginTop: '2px', fontWeight: 700 }}>
                                                                        {isDeadMatch ? (lang === 'tr' ? 'Rehavet İndirimi' : 'Complacency Dampened') : (lang === 'tr' ? 'Canlı Baskı Etkili' : (lang === 'de' ? 'Live-Druck angepasst' : 'In-play Adjusted'))}
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
                                                                <div style={{ opacity: 0.65, fontSize: '0.62rem', color: isDeadMatch ? '#f87171' : 'var(--tb-text-muted)' }}>
                                                                    {isDeadMatch ? (lang === 'tr' ? '⚠️ Taktiksel Rehavet Riski' : (lang === 'de' ? '⚠️ Taktisches Passivitäts-Risiko' : '⚠️ Complacency Risk')) : 'Model: Bayesian v2.2'}
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
                                                                <span><strong>{lang === 'tr' ? 'Oyun Durumu:' : (lang === 'de' ? 'Spielstatus:' : 'Game State:')}</strong> <span style={{ color: isDeadMatch ? '#f87171' : '#34d399', fontWeight: 800 }}>{isDeadMatch ? (lang === 'tr' ? 'KOPMUŞ' : 'BLOWOUT') : (lang === 'tr' ? 'DENGELİ' : 'BALANCED')}</span></span>
                                                            </div>
                                                        </div>

                                                        {/* 🌐 Global Consensus External Prediction Radar */}
                                                        <GlobalConsensusCard match={m} lang={lang} t={t} />

                                                        {hasTrend && (
                                                            <div className="tb-trend-box">
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>
                                                                        📈 {lang === 'tr' ? 'AVRUPA PİYASA AKIŞI & HALK BAHİSİ' : (lang === 'de' ? 'EUROPÄISCHER MARKTZUFLUSS & PUBLIKUMSWETTEN' : 'EUROPEAN MARKET FLOW & PUBLIC BET')}
                                                                    </span>
                                                                    <span className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}>
                                                                        {isTrendApproved 
                                                                            ? (lang === 'tr' ? '🟢 DQS ONAYLADI (AKILLI PARA)' : (lang === 'de' ? '🟢 DQS BESTÄTIGT (SMART MONEY)' : '🟢 DQS CONFIRMED (SMART MONEY)'))
                                                                            : isTrendTrap 
                                                                            ? (isDeadMatch
                                                                                ? (lang === 'tr' ? '🔴 MAÇ KOPTU (KASA TUZAĞI)' : (lang === 'de' ? '🔴 ENTSCHIEDEN (FALLE)' : '🔴 BLOWOUT (BOOKIE TRAP)'))
                                                                                : (lang === 'tr' ? '🔴 DİKKAT: TUZAK UYARISI' : (lang === 'de' ? '🔴 ACHTUNG: FALLEN-WARNUNG' : '🔴 WARNING: TRAP ALERT')))
                                                                            : (lang === 'de' ? '📊 HOHER PUBLIKUMS-ZUFLUSS' : (lang === 'tr' ? '📊 YOĞUN HALK AKIŞI' : '📊 HIGH PUBLIC INFLUX'))}
                                                                    </span>
                                                                </div>

                                                                {/* ⏱️ Entry Score & Active Duration Timeline Strip */}
                                                                {trendInfo && (
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '12px',
                                                                        flexWrap: 'wrap',
                                                                        background: 'rgba(15, 23, 42, 0.65)',
                                                                        border: '1px solid rgba(56, 189, 248, 0.16)',
                                                                        borderRadius: '6px',
                                                                        padding: '6px 10px',
                                                                        fontSize: '0.72rem'
                                                                    }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <span style={{ color: '#94a3b8' }}>📍 {lang === 'tr' ? 'Tahmin Giriş Skoru:' : (lang === 'de' ? 'Einstiegs-Spielstand:' : 'Entry Score:')}</span>
                                                                            <span style={{ color: '#fbbf24', fontWeight: 900 }}>
                                                                                ⚽ {trendInfo.entryScore}
                                                                                {trendInfo.entryMinStr && (
                                                                                    <span style={{ color: '#38bdf8', marginLeft: '4px', fontWeight: 700 }}>
                                                                                        ({trendInfo.entryMinStr})
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>

                                                                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>

                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <span style={{ color: '#94a3b8' }}>⏱️ {lang === 'tr' ? 'Piyasa Süresi:' : (lang === 'de' ? 'Marktdauer:' : 'Market Duration:')}</span>
                                                                            <span style={{ color: trendInfo.isNew ? '#34d399' : '#f1f5f9', fontWeight: 800 }}>
                                                                                {trendInfo.durationLabel}
                                                                            </span>
                                                                            {trendInfo.isNew && (
                                                                                <span style={{ fontSize: '0.62rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                                                                                    {lang === 'tr' ? 'TAZE AKIŞ' : (lang === 'de' ? 'FRISCH' : 'FRESH')}
                                                                                </span>
                                                                            )}
                                                                            {trendInfo.isStale && (
                                                                                <span style={{ fontSize: '0.62rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                                                                    {lang === 'tr' ? 'UZUN SÜRELİ' : (lang === 'de' ? 'LANGZEIT' : 'EXTENDED')}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {trendInfo.goalsSince > 0 && (
                                                                            <>
                                                                                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ color: '#10b981', fontWeight: 900, background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                                                                                        ⚡ +{trendInfo.goalsSince} {lang === 'tr' ? 'Gol Geldi' : (lang === 'de' ? 'Tor gefallen' : 'Goal Scored')} ({trendInfo.entryScore} ➔ {trendInfo.currentScoreStr})
                                                                                    </span>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <div style={{ fontSize: '0.75rem', color: 'var(--tb-text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                                                                    <span><strong>{lang === 'tr' ? 'Piyasa Tercihi / Tahmini:' : (lang === 'de' ? 'Marktprognose:' : 'Market Prediction:')}</strong> <span style={{ color: '#fff', fontWeight: 900 }}>{marketPrediction}</span></span>
                                                                    <span><strong>{lang === 'tr' ? 'Pazar:' : (lang === 'de' ? 'Wettmarkt:' : 'Market:')}</strong> {primaryTrend.market}</span>
                                                                    <span><strong>{lang === 'tr' ? 'Oran:' : (lang === 'de' ? 'Quote:' : 'Odds:')}</strong> <span style={{ color: '#fbbf24', fontWeight: 800 }}>@{primaryTrend.odds}</span></span>
                                                                    <span><strong>{lang === 'tr' ? 'Son 5 Dk Hacim:' : (lang === 'de' ? 'Volumen letzte 5 Min.:' : 'Last 5m Volume:')}</strong> <span style={{ color: '#f87171', fontWeight: 800 }}>{totalTrendCount} {lang === 'tr' ? 'Kupon' : (lang === 'de' ? 'Wettscheine' : 'Coupons')}</span></span>
                                                                </div>

                                                                {trendInfo?.isRest && (
                                                                    <div style={{ fontSize: '0.69rem', color: '#7dd3fc', background: 'rgba(56, 189, 248, 0.08)', border: '1px dashed rgba(56, 189, 248, 0.25)', borderRadius: '4px', padding: '4px 8px' }}>
                                                                        ℹ️ <strong>{lang === 'tr' ? 'Kalan Süre Kuralı:' : (lang === 'de' ? 'Restzeit-Regel:' : 'Rest of Match Rule:')}</strong>{' '}
                                                                        {lang === 'tr'
                                                                            ? (!trendInfo.isUnder 
                                                                                ? `Bu bahis giriş anındaki (${trendInfo.entryScore}) skordan sonraki golleri sayar. Bahsin tutması için kalan sürede en az ${trendInfo.restGoalsNeeded} gol (maçta toplam en az ${trendInfo.totalGoalsTarget} gol) gereklidir.`
                                                                                : `Bu bahis giriş anındaki (${trendInfo.entryScore}) skordan sonraki golleri sayar. Bahsin tutması için kalan sürede en fazla ${trendInfo.restGoalsNeeded} gol (maçta toplam en fazla ${trendInfo.totalGoalsTarget} gol) olabilir.`)
                                                                            : (lang === 'de'
                                                                                ? (!trendInfo.isUnder
                                                                                    ? `Diese Wette zählt Tore erst ab dem Spielstand ${trendInfo.entryScore}. Für einen Gewinn sind in der Restzeit mind. ${trendInfo.restGoalsNeeded} Tore (insgesamt mind. ${trendInfo.totalGoalsTarget} Tore) erforderlich.`
                                                                                    : `Diese Wette zählt Tore erst ab dem Spielstand ${trendInfo.entryScore}. Für einen Gewinn dürfen in der Restzeit max. ${trendInfo.restGoalsNeeded} Tore (insgesamt max. ${trendInfo.totalGoalsTarget} Tore) fallen.`)
                                                                                : (!trendInfo.isUnder
                                                                                    ? `This bet counts goals scored after the ${trendInfo.entryScore} entry score. At least ${trendInfo.restGoalsNeeded} more goals in remaining time (at least ${trendInfo.totalGoalsTarget} total match goals) are required.`
                                                                                    : `This bet counts goals scored after the ${trendInfo.entryScore} entry score. Maximum ${trendInfo.restGoalsNeeded} more goals in remaining time (max ${trendInfo.totalGoalsTarget} total match goals) are allowed.`))}
                                                                    </div>
                                                                )}

                                                                <div style={{ fontSize: '0.7rem', color: 'var(--tb-text-muted)', lineHeight: 1.4 }}>
                                                                    {isTrendApproved
                                                                        ? (lang === 'tr' 
                                                                            ? `Yüksek DQS (%${(dqsVal * 100).toFixed(0)}) & saha verisi piyasadaki kalabalığın bahsini (${marketPrediction}) doğruluyor.` 
                                                                            : (lang === 'de'
                                                                                ? `Hoher DQS (${(dqsVal * 100).toFixed(0)}%) & Spieldaten bestätigen den Markttipp (${marketPrediction}).`
                                                                                : `High DQS (${(dqsVal * 100).toFixed(0)}%) and match stats confirm the public bet (${marketPrediction}).`))
                                                                        : isTrendTrap
                                                                        ? (lang === 'tr'
                                                                            ? (isDeadMatch 
                                                                                ? `Maç skoru koptu ve takımlar rölantiye geçti. Kalabalık (${totalTrendCount} Kupon) rehavet riskine rağmen ezbere ${marketPrediction} oynuyor; bu klasik bir KASA TUZAĞIDIR.`
                                                                                : `Düşük DQS (%${(dqsVal * 100).toFixed(0)}) & yetersiz saha temposu. Kalabalık piyasada (${marketPrediction}) tercihine tuzağa çekiliyor olabilir!`)
                                                                            : (lang === 'de'
                                                                                ? (isDeadMatch
                                                                                    ? `Spiel ist entschieden und Teams schalten herunter. Die Masse (${totalTrendCount} Wettscheine) wettet trotz Passivitäts-Risiko blind auf ${marketPrediction}; eine klassische BUCHMACHER-FALLE.`
                                                                                    : `Niedriger DQS (${(dqsVal * 100).toFixed(0)}%) & geringe Intensität. Der Markttipp (${marketPrediction}) könnte eine Falle sein!`)
                                                                                : (isDeadMatch
                                                                                    ? `Game is blown out and teams are coasting. The crowd (${totalTrendCount} Bets) is blindly betting ${marketPrediction}; this is a classic BOOKIE TRAP.`
                                                                                    : `Low DQS (${(dqsVal * 100).toFixed(0)}%) and low intensity. The crowd betting on (${marketPrediction}) may be in a trap!`)))
                                                                        : (lang === 'tr'
                                                                            ? `Orta seviye DQS (%${(dqsVal * 100).toFixed(0)}%). Saha aksiyonunu yakından gözlemleyin.`
                                                                            : (lang === 'de'
                                                                                ? `Mittlerer DQS (${(dqsVal * 100).toFixed(0)}%). Spielverlauf aufmerksam beobachten.`
                                                                                : `Moderate DQS (${(dqsVal * 100).toFixed(0)}%). Monitor ongoing pitch dynamics.`))}
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

        );
    };
    return (
        <div className={`tb-terminal-wrapper ${mobileTableMode ? 'mobile-table-mode' : ''}`}>
            <div className="tb-desktop-table-view">
            <table className="tb-table">
                <thead>
                    <tr>
                        <th style={{ width: '36px', textAlign: 'center' }} title={lang === 'tr' ? 'Favoriler' : (lang === 'de' ? 'Favoriten' : 'Favorites')}>
                            <StarIcon filled size={13} />
                        </th>
                        <th 
                            className={`sortable ${sortColumn === 'minute' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('minute')}
                            style={{ width: '48px', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'Dakikaya göre sırala' : 'Sort by minute'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                {t?.minute_short || (lang === 'tr' ? 'DK' : (lang === 'de' ? 'MIN' : 'MIN'))}
                                {renderSortIcon('minute')}
                            </span>
                        </th>
                        <th style={{ width: '100px' }}>{t?.league_label || (lang === 'tr' ? 'LİG' : (lang === 'de' ? 'LIGA' : 'LEAGUE'))}</th>
                        <th style={{ minWidth: '170px' }}>{t?.match_label || (lang === 'tr' ? 'MAÇ' : (lang === 'de' ? 'SPIEL' : 'MATCH'))}</th>
                        <th 
                            className={`sortable ${sortColumn === 'score' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('score')}
                            style={{ width: '56px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'Toplam gole göre sırala' : 'Sort by score/goals'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {t?.score_label || (lang === 'tr' ? 'SKOR' : (lang === 'de' ? 'STAND' : 'SCORE'))}
                                {renderSortIcon('score')}
                            </span>
                        </th>
                        <th 
                            className={`sortable ${sortColumn === 'heat' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('heat')}
                            style={{ width: '84px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'Maç Sıcaklığına göre sırala' : 'Sort by match heat'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {lang === 'tr' ? 'ISI / DURUM' : (lang === 'de' ? 'HITZE / STATUS' : 'HEAT')}
                                {renderSortIcon('heat')}
                            </span>
                        </th>
                        <th style={{ width: '72px', textAlign: 'center' }}>{lang === 'tr' ? '1X2 CANLI' : (lang === 'de' ? '1X2 LIVE' : '1X2 LIVE')}</th>
                        <th 
                            className={`sortable ${sortColumn === 'pressure' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('pressure')}
                            style={{ width: '68px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? `Baskı İndeksine göre sırala (${momentumWindow}dk)` : `Sort by pressure (${momentumWindow}m)`}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {lang === 'tr' ? `BASKI (${momentumWindow}D)` : (lang === 'de' ? `DRUCK (${momentumWindow}M)` : `PRESS (${momentumWindow}M)`)}
                                {renderSortIcon('pressure')}
                            </span>
                        </th>
                        <th 
                            className={`sortable ${sortColumn === 'possession' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('possession')}
                            style={{ width: '68px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'Top Hakimiyeti / Baskı Farkına göre sırala' : 'Sort by possession dominance'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {lang === 'tr' ? 'TOP %' : (lang === 'de' ? 'BESITZ' : 'POSS %')}
                                {renderSortIcon('possession')}
                            </span>
                        </th>
                        <th 
                            className={`sortable ${sortColumn === 'shots' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('shots')}
                            style={{ width: '62px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'İsabetli Şut sayısına göre sırala' : 'Sort by shots on goal'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {lang === 'tr' ? 'ŞUT (İSB)' : (lang === 'de' ? 'SCHÜSSE' : 'SHOTS')}
                                {renderSortIcon('shots')}
                            </span>
                        </th>
                        <th 
                            className={`sortable ${sortColumn === 'da' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('da')}
                            style={{ width: '58px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'Tehlikeli Atak sayısına göre sırala' : 'Sort by dangerous attacks'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {lang === 'tr' ? 'T.ATAK' : (lang === 'de' ? 'G.ANGRIFF' : 'D.ATTACK')}
                                {renderSortIcon('da')}
                            </span>
                        </th>
                        <th 
                            className={`sortable ${sortColumn === 'xg' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('xg')}
                            style={{ width: '58px', textAlign: 'center', cursor: 'pointer' }}
                            title={lang === 'tr' ? 'Beklenen Gol (xG) değerine göre sırala' : 'Sort by expected goals'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                xG
                                {renderSortIcon('xg')}
                            </span>
                        </th>
                        <th style={{ width: '150px', textAlign: 'center' }}>{lang === 'tr' ? 'AI SİNYAL' : (lang === 'de' ? 'KI-SIGNAL' : 'AI SIGNAL')}</th>
                        <th style={{ width: '36px', textAlign: 'center' }}>{lang === 'tr' ? 'DETAY' : (lang === 'de' ? 'DETAILS' : 'DETAIL')}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedMatches.length === 0 ? (
                        <tr>
                            <td colSpan={14} style={{ padding: '0', border: 'none' }}>
                                {terminalCategoryFilter === 'PINNED' ? (
                                    <div className="tb-pinned-empty-state">
                                        <div className="tb-pinned-empty-icon">⭐</div>
                                        <div className="tb-pinned-empty-title">
                                            {lang === 'tr' ? 'Henüz Favori Maçınız Yok' : (lang === 'de' ? 'Noch keine Favoriten vorhanden' : 'No Favorite Matches Yet')}
                                        </div>
                                        <div className="tb-pinned-empty-desc">
                                            {lang === 'tr' 
                                                ? 'Canlı takip etmek istediğiniz maçların en solundaki ☆ yıldız butonuna basarak maçları buraya sabitleyebilir, anlık fırsatları tek ekranda izleyebilirsiniz.'
                                                : (lang === 'de' 
                                                    ? 'Klicken Sie auf das ☆ Stern-Symbol ganz links neben einem Spiel, um es hier anzuheften.' 
                                                    : 'Click the ☆ star button on the far left of any match to pin it here and track live pressure in one place.')}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--tb-text-muted)' }}>
                                        {lang === 'tr' ? 'Seçili kriterlere uygun canlı maç bulunamadı.' : (lang === 'de' ? 'Keine Live-Spiele für die ausgewählten Kriterien gefunden.' : 'No live matches matching current criteria.')}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ) : (
                        sortedMatches.map(m => {
                            const d = computeMatchData(m);
                            const isExpanded = expandedMatchId === m.id;
                            const {
                                signal, isPinned, rawHeat, heat, opp, heatScore, rawHeatLevel, heatLevel, heatIcon, windowMomentum, last20,
                                possHome, possAway, sogHome, sogAway, daHome, daAway, daDiff, xgHome, xgAway,
                                redHome, redAway, yellowHome, yellowAway, oddsHome, oddsDraw, oddsAway,
                                daAlertClass, heatAlertClass, riskFilters, parsedHomeScore, parsedAwayScore, goalDiffVal, minVal, isDeadMatch,
                                matchTrendingBets, hasTrend, primaryTrend, totalTrendCount, dqsVal, isEarlyMin, isTrendApproved, isTrendTrap,
                                marketPrediction, trendInfo, bayesian, heatNorm, rawPosterior, effectivePosterior, goalProb, baseTempo,
                                pressureImpact, confidence, confidenceLabel, confidenceColor, latencyMs, dataQuality, pressureTotal,
                                minStr, minNum, isLateOrFinished, predText, isBetReady, isHot
                            } = d;

                            return (
                                <React.Fragment key={m.id}>
                                    <tr
                                        className={`tb-row ${isExpanded ? 'expanded' : ''}`}
                                        onClick={(e) => handleRowClick(m, e)}
                                    >
                                        {/* Pin / Star & Quick VIP Broadcast */}
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }} className="tb-action-ignore">
                                            <button
                                                type="button"
                                                className={`tb-action-ignore tb-fav-btn ${isPinned ? 'pinned' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                                title={isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : (lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites')) : (lang === 'tr' ? 'Favoriye Ekle (Sabitle)' : (lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites'))}
                                                aria-label={isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites') : (lang === 'tr' ? 'Favoriye Ekle' : lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites')}
                                            >
                                                <StarIcon filled={isPinned} size={14} />
                                            </button>
                                            {isAdmin && onSendToTelegram && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); onSendToTelegram(e, m, opp); }}
                                                    className="tb-action-ignore opp-telegram-btn"
                                                    style={{ width: '22px', height: '22px', fontSize: '0.68rem', display: 'inline-flex', verticalAlign: 'middle', marginLeft: '4px' }}
                                                    title={lang === 'tr' ? "Tek Tıkla VIP Gruba Gönder" : (lang === 'de' ? "Mit einem Klick an VIP-Gruppe senden" : "One-Click Send to VIP")}
                                                >
                                                    ✈️
                                                </button>
                                            )}
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

                                            {/* Opportunity Micro-Badges (from Classic Cards) */}
                                            {opp && (
                                                <div className="tb-badges-row" style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
                                                    {(opp.hasHalftimeValue || (opp.isHalftime && opp.isStatsReady && !opp.isLowData && heatScore >= 50)) && (
                                                        <span className="opp-micro-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '0.62rem', padding: '1px 5px' }}>
                                                            ☕ {lang === 'tr' ? '2. YARI DEĞERİ' : (lang === 'de' ? '2. HZ VALUE' : '2ND HALF VALUE')}
                                                        </span>
                                                    )}
                                                    {opp.valueDetected && !isEarlyMin && (
                                                        <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#000', fontWeight: 800, fontSize: '0.62rem', padding: '1px 5px' }}>
                                                            💰 {lang === 'tr' ? 'DEĞERLİ ORAN' : (lang === 'de' ? 'VALUE-QUOTE' : 'VALUE ODDS')}
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

                                            {/* Market Trend Pill (Shows exact market pick & volume) */}
                                            {hasTrend && (
                                                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span
                                                        className={`tb-trend-pill ${isTrendApproved ? 'approved' : isTrendTrap ? 'trap' : 'influx'}`}
                                                        title={lang === 'tr'
                                                            ? `Piyasa Bahis Hacmi: ${totalTrendCount} Kupon • ${trendInfo ? `Giriş Skoru: ${trendInfo.entryScore}${trendInfo.entryMinStr ? ` (${trendInfo.entryMinStr})` : ''} • Süre: ${trendInfo.durationLabel} • ` : ''}Pazar: ${primaryTrend.market || ''} • Tercih: ${primaryTrend.outcome || ''} (@${primaryTrend.odds || ''})${isDeadMatch ? ' • ⚠️ KOPMUŞ MAÇ (KASA TUZAĞI)' : ''}`
                                                            : (lang === 'de'
                                                                ? `Marktwettvolumen: ${totalTrendCount} Wettscheine • ${trendInfo ? `Einstiegsstand: ${trendInfo.entryScore}${trendInfo.entryMinStr ? ` (${trendInfo.entryMinStr})` : ''} • Dauer: ${trendInfo.durationLabel} • ` : ''}Markt: ${primaryTrend.market || ''} • Tipp: ${primaryTrend.outcome || ''} (@${primaryTrend.odds || ''})${isDeadMatch ? ' • ⚠️ ENTSCHIEDENES SPIEL (FALLE)' : ''}`
                                                                : `Market Volume: ${totalTrendCount} Bets • ${trendInfo ? `Entry Score: ${trendInfo.entryScore}${trendInfo.entryMinStr ? ` (${trendInfo.entryMinStr})` : ''} • Duration: ${trendInfo.durationLabel} • ` : ''}Market: ${primaryTrend.market || ''} • Pick: ${primaryTrend.outcome || ''} (@${primaryTrend.odds || ''})${isDeadMatch ? ' • ⚠️ BLOWOUT / DEAD MATCH (TRAP)' : ''}`)}
                                                    >
                                                        <span>{isTrendApproved ? '🟢' : isTrendTrap ? '🔴' : '📊'}</span>
                                                        <span style={{ fontWeight: 900 }}>
                                                            {isTrendApproved 
                                                                ? (lang === 'tr' ? 'AKILLI PARA:' : (lang === 'de' ? 'SMART MONEY:' : 'SMART MONEY:')) 
                                                                : isTrendTrap 
                                                                ? (isDeadMatch ? (lang === 'tr' ? 'KOPMUŞ MAÇ TUZAĞI:' : (lang === 'de' ? 'FALLE (ENTSCHIEDEN):' : 'BLOWOUT TRAP:')) : (lang === 'tr' ? 'TUZAK ALARMI:' : (lang === 'de' ? 'FALLEN-ALARM:' : 'TRAP ALERT:'))) 
                                                                : (lang === 'tr' ? 'PİYASA AKIŞI:' : (lang === 'de' ? 'MARKTZUFLUSS:' : 'MARKET INFLUX:'))}
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
                                                        {trendInfo && (
                                                            <span style={{ opacity: 0.9, fontSize: '0.62rem', color: trendInfo.isNew ? '#34d399' : '#93c5fd', fontWeight: 700 }}>
                                                                • ⚽ {trendInfo.entryScore} {trendInfo.durMinutes > 0 ? `(${trendInfo.durMinutes}dk)` : ''}
                                                            </span>
                                                        )}
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
                                            <span className={`tb-pill-stat ${heatAlertClass}`} title={lang === 'tr' ? `Son ${momentumWindow} dakikalık ivme/baskı skoru: %${windowMomentum}` : `Last ${momentumWindow}m momentum score: %${windowMomentum}`}>
                                                %{windowMomentum}
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
                                                    }} title={lang === 'tr' ? `${last20.dominantTeam ? `${last20.dominantTeam} son ${momentumWindow} dakikadır hücum baskısı kuruyor.` : 'Yüksek hücum baskısı.'} (Son ${momentumWindow} Dk: +${last20.deltaDA} Tehlikeli Atak, +${last20.deltaShots} Toplam Şut${last20.deltaSog ? ` [${last20.deltaSog} İsabetli]` : ''})` : `Last ${momentumWindow}m: +${last20.deltaDA} Attacks`}>
                                                        ⚡ {last20.dominantTeam ? `${last20.dominantTeam.slice(0, 9)} (+${last20.teamDeltaDA || last20.deltaDA} ${lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')})` : `+${last20.deltaDA} ${lang === 'tr' ? 'Atak' : (lang === 'de' ? 'Angr.' : 'Atk')}`}
                                                    </span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Topla Oynama (Possession) */}
                                        <td className="tb-stat-cell" title={lang === 'tr' ? `Topla Oynama: ${m.homeTeam} %${possHome} - %${possAway} ${m.awayTeam}` : `Possession: ${m.homeTeam} ${possHome}% - ${possAway}% ${m.awayTeam}`}>
                                            {(possHome > 0 && possAway > 0 && possHome + possAway >= 90 && possHome + possAway <= 110 && possHome !== 100 && possAway !== 100) ? (
                                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '48px' }}>
                                                    <span style={{ 
                                                        fontSize: '0.72rem', 
                                                        fontWeight: 700, 
                                                        color: possHome >= 60 ? '#38bdf8' : (possAway >= 60 ? '#f43f5e' : 'var(--tb-text-primary)') 
                                                    }}>
                                                        %{possHome} - %{possAway}
                                                    </span>
                                                    <div style={{ 
                                                        width: '100%', 
                                                        height: '3px', 
                                                        background: 'rgba(255,255,255,0.08)', 
                                                        borderRadius: '2px', 
                                                        display: 'flex', 
                                                        overflow: 'hidden' 
                                                    }}>
                                                        <div style={{ width: `${possHome}%`, background: possHome >= 60 ? '#38bdf8' : '#64748b' }} />
                                                        <div style={{ width: `${possAway}%`, background: possAway >= 60 ? '#f43f5e' : '#475569' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--tb-text-muted)' }}>-</span>
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
                                            {renderSignalBadge(m, d)}
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
                                            <td colSpan={14}>
                                                {renderExpandedTray(m, d)}
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

        {/* MOBILE COMPACT TABLE VIEW (Ultra-dense zero-horizontal-scroll live table) */}
        <div className="tb-mobile-compact-view">
            {sortedMatches.length === 0 ? (
                terminalCategoryFilter === 'PINNED' ? (
                    <div className="tb-pinned-empty-state">
                        <div className="tb-pinned-empty-icon">⭐</div>
                        <div className="tb-pinned-empty-title">
                            {lang === 'tr' ? 'Henüz Favori Maçınız Yok' : (lang === 'de' ? 'Noch keine Favoriten vorhanden' : 'No Favorite Matches Yet')}
                        </div>
                        <div className="tb-pinned-empty-desc">
                            {lang === 'tr' 
                                ? 'Canlı takip etmek istediğiniz maçların en solundaki ☆ yıldız butonuna basarak maçları buraya sabitleyebilir, anlık fırsatları tek ekranda izleyebilirsiniz.'
                                : (lang === 'de' 
                                    ? 'Klicken Sie auf das ☆ Stern-Symbol ganz links neben einem Spiel, um es hier anzuheften.' 
                                    : 'Click the ☆ star button on the far left of any match to pin it here and track live pressure in one place.')}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--tb-text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--tb-border)' }}>
                        {lang === 'tr' ? 'Seçili kriterlere uygun canlı maç bulunamadı.' : (lang === 'de' ? 'Keine Live-Spiele für die ausgewählten Kriterien gefunden.' : 'No live matches matching current criteria.')}
                    </div>
                )
            ) : (
                <>
                    <div className="tb-mc-header">
                        <div 
                            className={`tb-mc-th tb-mc-th-match ${sortColumn === 'minute' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('minute')}
                            title={lang === 'tr' ? 'Dakikaya göre sırala' : 'Sort by minute'}
                        >
                            <span>{t?.minute_short || (lang === 'tr' ? 'DK' : 'MIN')} • {t?.match_label || (lang === 'tr' ? 'MAÇ' : 'MATCH')}</span>
                            {renderSortIcon('minute')}
                        </div>
                        <div 
                            className={`tb-mc-th tb-mc-th-score ${sortColumn === 'score' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('score')}
                            title={lang === 'tr' ? 'Toplam gole göre sırala' : 'Sort by score'}
                        >
                            <span>{t?.score_label || (lang === 'tr' ? 'SKOR' : 'SCORE')}</span>
                            {renderSortIcon('score')}
                        </div>
                        <div 
                            className={`tb-mc-th tb-mc-th-intel ${sortColumn === 'heat' ? 'active-sort' : ''}`}
                            onClick={() => handleColumnSort('heat')}
                            title={lang === 'tr' ? 'Isıya göre sırala' : 'Sort by heat'}
                        >
                            <span>{lang === 'tr' ? 'ISI • SİNYAL' : 'HEAT • SIGNAL'}</span>
                            {renderSortIcon('heat')}
                        </div>
                    </div>

                    {sortedMatches.map(m => {
                        const d = computeMatchData(m);
                        const isExpanded = expandedMatchId === m.id;
                        return (
                            <div
                                key={`mc-${m.id}`}
                                className={`tb-mc-row ${isExpanded ? 'expanded' : ''} ${d.isBetReady ? 'bet-edge' : d.isHot ? 'hot-edge' : ''}`}
                                onClick={(e) => handleRowClick(m, e)}
                            >
                                <div className="tb-mc-row-main">
                                    {/* Left: Star + Minute */}
                                    <div className="tb-mc-left-col">
                                        <button
                                            type="button"
                                            className={`tb-action-ignore tb-fav-btn ${d.isPinned ? 'pinned' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); togglePinMatch(m.id); }}
                                            title={d.isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (lang === 'tr' ? 'Favoriye Ekle' : 'Add to Favorites')}
                                            aria-label={d.isPinned ? (lang === 'tr' ? 'Favorilerden Çıkar' : lang === 'de' ? 'Aus Favoriten entfernen' : 'Remove from Favorites') : (lang === 'tr' ? 'Favoriye Ekle' : lang === 'de' ? 'Zu Favoriten hinzufügen' : 'Add to Favorites')}
                                        >
                                            <StarIcon filled={d.isPinned} size={13} />
                                        </button>
                                        <div className="tb-mc-minute">
                                            <span className="tb-pulse-dot" />
                                            <span>{formatMinute(m.minute)}</span>
                                        </div>
                                    </div>

                                    {/* Center: Teams (stacked) + League / Badge */}
                                    <div className="tb-mc-match-col">
                                        <div className="tb-mc-team-line">
                                            <span className="tb-mc-team-name">{m.homeTeam}</span>
                                            {d.redHome > 0 && <span className="tb-card-badge tb-card-red">{d.redHome}</span>}
                                            {d.yellowHome > 0 && <span className="tb-card-badge tb-card-yellow">{d.yellowHome}</span>}
                                        </div>
                                        <div className="tb-mc-team-line">
                                            <span className="tb-mc-team-name">{m.awayTeam}</span>
                                            {d.redAway > 0 && <span className="tb-card-badge tb-card-red">{d.redAway}</span>}
                                            {d.yellowAway > 0 && <span className="tb-card-badge tb-card-yellow">{d.yellowAway}</span>}
                                        </div>
                                        <div className="tb-mc-meta-line">
                                            <span className="tb-mc-league">T{m.tier || 1} {m.league || m.leagueName || 'Futbol'}</span>
                                            {d.isTrendApproved && (
                                                <span className="tb-mc-micro-trend approved" title={d.marketPrediction}>
                                                    🟢 {d.marketPrediction} {d.primaryTrend?.odds ? `@${typeof d.primaryTrend.odds === 'number' ? d.primaryTrend.odds.toFixed(2) : d.primaryTrend.odds}` : ''}
                                                </span>
                                            )}
                                            {d.isTrendTrap && (
                                                <span className="tb-mc-micro-trend trap">
                                                    🔴 {d.isDeadMatch ? (lang === 'tr' ? 'Kopmuş Maç' : 'Blowout') : (lang === 'tr' ? 'Tuzak' : 'Trap')}
                                                </span>
                                            )}
                                            {d.opp?.valueDetected && !d.hasTrend && (
                                                <span className="tb-mc-micro-trend value">
                                                    💰 {lang === 'tr' ? 'Değerli' : 'Value'}
                                                </span>
                                            )}
                                            {d.opp?.hasHalftimeValue && !d.hasTrend && (
                                                <span className="tb-mc-micro-trend ht">
                                                    ☕ {lang === 'tr' ? '2.Yarı' : '2nd Half'}
                                                </span>
                                            )}
                                            {d.opp?.hasValueEV && d.opp?.bestEV && !d.hasTrend && (
                                                <span className="tb-mc-micro-trend ev">
                                                    💎 +EV %{d.opp.bestEV.ev}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Score Column: Stacked with Home & Away */}
                                    <div className="tb-mc-score-col">
                                        <div className="tb-mc-score-val">{d.parsedHomeScore}</div>
                                        <div className="tb-mc-score-val">{d.parsedAwayScore}</div>
                                    </div>

                                    {/* Intel Column: Heat Pill on top, Signal on bottom */}
                                    <div className="tb-mc-intel-col">
                                        <div className="tb-mc-intel-top">
                                            <span className={`tb-heat-badge tb-heat-${(d.rawHeatLevel || 'soguk').toLowerCase()}`}>
                                                {d.heatIcon} {d.heatScore}
                                            </span>
                                            <span className={`tb-pill-stat ${d.heatAlertClass}`} style={{ fontSize: '0.62rem', padding: '1px 4px' }} title={lang === 'tr' ? `Baskı %${d.windowMomentum}` : `Pressure %${d.windowMomentum}`}>
                                                %{d.windowMomentum}
                                            </span>
                                        </div>
                                        <div className="tb-mc-intel-bottom">
                                            {renderSignalBadge(m, d)}
                                        </div>
                                    </div>

                                    {/* Caret Column */}
                                    <div className="tb-mc-caret-col">
                                        <span className={`tb-mc-arrow ${isExpanded ? 'open' : ''}`}>▼</span>
                                    </div>
                                </div>

                                {/* Expanded Accordion Tray */}
                                {isExpanded && (
                                    <div className="tb-mc-expanded-container">
                                        {renderExpandedTray(m, d)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    </div>
    );
};
