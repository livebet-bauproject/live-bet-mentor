import React, { useState, useEffect, useRef } from 'react';
import { CONFIG } from '../config';
import { dataWorker } from '../backend/dataWorker';
import { bankrollManager } from '../logic/bankrollManager';
import { autoSettlementEngine } from '../logic/autoSettlementEngine';
import { FAQ } from './FAQ';
import { StakingCalculator } from './StakingCalculator';
import { translations } from '../locales/translations';
import { AdminPanel } from './AdminPanel';
import { consensusAdapter } from '../backend/consensusAdapter';
import { aiAnalystService } from '../backend/aiAnalystService';
import { aiUsageLimiter } from '../backend/aiUsageLimiter';
import { liveOpportunityScorer } from '../logic/liveOpportunityScorer';
import { audioAlert } from '../utils/audioAlert';
import { betBuilderEngine } from '../logic/betBuilderEngine';
import { smartAlertService } from '../backend/smartAlertService';
import { predictionTracker } from '../backend/predictionTracker';
import { database, ref, get } from '../firebase/config';
import { supabase } from '../backend/supabaseClient';
import '../styles/global.css';

const RADAR_SOURCES = [
    { id: 'forebet', label: 'Forebet', color: '#34d399', iq: 'iq_forebet' },
    { id: 'prosoccer', label: 'ProSoccer', color: '#38bdf8', iq: 'iq_prosoccer' },
    { id: 'predictz', label: 'PredictZ', color: '#f87171', iq: 'iq_predictz' },
    { id: 'windrawwin', label: 'WDW', color: '#60a5fa', iq: 'iq_windrawwin' },
    { id: 'statarea', label: 'Statarea', color: '#fbbf24', iq: 'iq_statarea' },
    { id: 'vitibet', label: 'Vitibet', color: '#a78bfa', iq: 'iq_vitibet' },
    { id: 'zulubet', label: 'Zulubet', color: '#f472b6', iq: 'iq_zulubet' },
    { id: 'olbg', label: 'OLBG', color: '#00f2fe', iq: 'iq_olbg' },
    { id: 'soccervista', label: 'SoccerVista', color: '#fb923c', iq: 'iq_soccervista' },
    { id: 'superbet', label: 'SuperBet', color: '#facc15', iq: 'iq_superbet' }
];

const RADAR_BASE_URLS = {
    forebet: 'https://www.forebet.com',
    predictz: 'https://www.predictz.com',
    windrawwin: 'https://www.windrawwin.com',
    statarea: 'https://www.statarea.com',
    vitibet: 'https://www.vitibet.com',
    zulubet: 'https://www.zulubet.com',
    prosoccer: 'https://www.prosoccer.eu',
    olbg: 'https://www.olbg.com/betting-tips/Football/1',
    soccervista: 'https://www.soccervista.com',
    superbet: 'https://superbetpredictions.com'
};

export const renderMatchMinute = (minute, t, withLabel = false) => {
    if (minute === undefined || minute === null || minute === '') return "0'";
    const minStr = minute.toString().trim();
    if (minStr === 'İY' || minStr.includes('HT') || minStr.toLowerCase().includes('half')) {
        return t?.halftime_short || 'İY';
    }
    if (minStr === 'MS' || minStr.includes('FT') || minStr.toLowerCase().includes('ended')) {
        return t?.fulltime_short || 'MS';
    }
    if (minStr.includes('Pen')) return 'Pen.';
    if (minStr.includes('Ert')) return 'Ert.';

    // If already has 2.Y or 2H formatting
    if (minStr.includes('2.Y') || minStr.includes('2H')) return minStr;

    // Stoppage / extra time e.g. 90+, 45+, 90+3'
    if (minStr.includes('+')) {
        if (minStr.endsWith('+')) return minStr;
        return minStr.includes("'") ? minStr : `${minStr}'`;
    }

    const num = parseInt(minStr);
    if (!isNaN(num) && num > 45 && num <= 105) {
        const halfMin = num - 45;
        const halfLabel = t?.second_half_short || '2.Y';
        if (withLabel) {
            return `${halfLabel} ${halfMin}. ${t?.minute_label || 'DK'} (${num}')`;
        }
        return `${halfLabel} ${halfMin}' (${num}')`;
    }

    if (withLabel) {
        return `${minStr.replace("'", "")}. ${t?.minute_label || 'DK'}`;
    }
    return minStr.includes("'") ? minStr : `${minStr}'`;
};

export const Dashboard = ({ user, userProfile, onLogout, lang, setLang, settings = {} }) => {
    const [matches, setMatches] = useState([]);
    const [signals, setSignals] = useState({});
    const [bankState, setBankState] = useState(bankrollManager.getState());
    const [lastFetchSeconds, setLastFetchSeconds] = useState(0);
    const [healthStats, setHealthStats] = useState(dataWorker.healthStats);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [decisionMode, setDecisionMode] = useState(dataWorker.decisionMode);
    const [showFAQ, setShowFAQ] = useState(false);
    const [faqMode, setFaqMode] = useState('live');

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [activeTierFilter, setActiveTierFilter] = useState('ALL');
    const [leagueTierMap, setLeagueTierMap] = useState({
        tier1: [...CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.TIER_1],
        tier2: [...CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.TIER_2]
    });
    const [advancedSettings, setAdvancedSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('lbm_advanced_settings');
            if (saved && saved !== 'undefined' && saved !== 'null') {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    Object.assign(CONFIG.MODULAR_SYSTEM.OPTIONAL_MODULES, parsed);
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Error parsing advanced settings:', e);
        }
        return { ...CONFIG.MODULAR_SYSTEM.OPTIONAL_MODULES };
    });
    const [view, setView] = useState('DASHBOARD'); // 'DASHBOARD', 'ADMIN', 'RADAR'
    const [consensusData, setConsensusData] = useState({});
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [dismissTrialBanner, setDismissTrialBanner] = useState(false);

    useEffect(() => {
        if (user) {
            const plan = userProfile?.plan || 'premium';
            aiAnalystService.setUserContext(user.id, plan);
            smartAlertService.setUserContext(user.id, plan);
            predictionTracker.init(user.id).then(() => {
                setTrackingStats(predictionTracker.getStats());
            });

            // Fetch pending membership request
            const fetchPendingRequest = async () => {
                try {
                    const { data } = await supabase
                        .from('membership_requests')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('status', 'pending')
                        .maybeSingle();

                    if (data) setPendingRequest(data);
                } catch (e) {
                    // Ignore if Supabase offline
                }
            };
            fetchPendingRequest();
        }
    }, [user, userProfile]);

    const PLAN_COLORS = {
        trial: '#10b981',
        pro: '#38bdf8',
        premium: '#a78bfa',
        admin: '#f59e0b'
    };

    // Radar Filters State
    const [radarFilters, setRadarFilters] = useState({
        sources: ['forebet', 'predictz', 'windrawwin', 'statarea', 'vitibet', 'zulubet', 'prosoccer', 'olbg', 'soccervista', 'superbet'],
        minSources: 1,
        search: '',
        valueOnly: false,
        hideDivergent: false,
        todayOnly: false, // Default false so upcoming matches tonight & tomorrow are displayed
        hideFinished: true, // Auto-filter out completed/finished matches
        sortBy: 'TIME' // Chronological: Live -> Nearest Upcoming -> Tomorrow
    });
    const [selectedMarket, setSelectedMarket] = useState('1X2');
    const [expandedLeagues, setExpandedLeagues] = useState({});

    // Global AI Report State
    const [globalReport, setGlobalReport] = useState({ content: '', type: null, loading: false });

    // Live Odds State for Opportunity Scoring
    const [liveOdds, setLiveOdds] = useState(null);

    // Membership Request State
    const [pendingRequest, setPendingRequest] = useState(null);
    const [showPlanComparison, setShowPlanComparison] = useState(false);
    const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState(null);
    const [requestLoading, setRequestLoading] = useState(false);

    // Alert & Tracking System State
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [showAlertPopup, setShowAlertPopup] = useState(null);
    const [alertNotifyMode, setAlertNotifyMode] = useState(() => {
        try {
            return localStorage.getItem('alert_notify_mode') || 'TOAST'; // 'TOAST', 'SILENT', 'OFF'
        } catch (e) {
            return 'TOAST';
        }
    });
    const alertNotifyModeRef = useRef(alertNotifyMode);
    useEffect(() => {
        alertNotifyModeRef.current = alertNotifyMode;
    }, [alertNotifyMode]);
    const [toastProgress, setToastProgress] = useState(100);
    const [isToastPaused, setIsToastPaused] = useState(false);
    const [trackingStats, setTrackingStats] = useState(predictionTracker.getStats());
    const [showTrackingPanel, setShowTrackingPanel] = useState(false);
    const [trackingActiveTab, setTrackingActiveTab] = useState('ALERTS'); // 'ALERTS' or 'BETS'
    const [alertHistoryList, setAlertHistoryList] = useState(() => smartAlertService.getHistory(50));
    const [showStakingCalc, setShowStakingCalc] = useState(false);
    const [liveOpportunitiesLimit, setLiveOpportunitiesLimit] = useState(5);
    const [hidePendingOpportunities, setHidePendingOpportunities] = useState(false);
    const [momentumWindow, setMomentumWindow] = useState(10);
    const [audioMuted, setAudioMuted] = useState(audioAlert.isMuted);

    const getRemainingDays = (endDate) => {
        if (!endDate) return 0;
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    // Auto-dismiss floating toast after 10 seconds (with pause on hover)
    useEffect(() => {
        if (!showAlertPopup || alertNotifyMode !== 'TOAST') return;

        setToastProgress(100);
        const timer = setInterval(() => {
            setIsToastPaused(paused => {
                if (!paused) {
                    setToastProgress(prev => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            setShowAlertPopup(null);
                            return 0;
                        }
                        return prev - 1; // 100 steps * 100ms = 10 seconds
                    });
                }
                return paused;
            });
        }, 100);

        return () => clearInterval(timer);
    }, [showAlertPopup, alertNotifyMode]);

    const requestUpgrade = async (requestedPlan) => {
        if (!user || requestLoading) return;
        setRequestLoading(true);
        try {
            const { error } = await supabase
                .from('membership_requests')
                .insert([
                    {
                        user_id: user.id,
                        email: user.email,
                        current_plan: userProfile?.plan || 'trial',
                        requested_plan: requestedPlan,
                        status: 'pending'
                    }
                ]);

            if (error) throw error;

            // Update local state
            setPendingRequest({
                user_id: user.id,
                email: user.email,
                current_plan: userProfile?.plan || 'trial',
                requested_plan: requestedPlan,
                status: 'pending'
            });

            alert(lang === 'tr' ? 'Yükseltme talebiniz iletildi! Yönetici onayı bekleniyor.' : 'Upgrade request submitted! Awaiting admin approval.');
        } catch (err) {
            console.error('Request Error:', err);
            alert(lang === 'tr' ? 'Bir hata oluştu. Lütfen tekrar deneyin.' : 'An error occurred. Please try again.');
        } finally {
            setRequestLoading(false);
        }
    };

    const handleSendToTelegram = async (e, match, opp) => {
        if (e) e.stopPropagation();
        
        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            const res = await fetch(`${proxyBase}/api/telegram/send-signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    minute: match.minute,
                    score: (match.score && typeof match.score === 'object') ? `${match.score.home ?? 0}-${match.score.away ?? 0}` : (match.score || '0-0'),
                    level: opp.heatLevel || 'SICAK',
                    recommendation: opp.suggestedMarket || { 
                        marketKey: 'market_expected_goal', 
                        confidence: opp.score,
                        team: opp.dominatingTeam === 'home' ? match.homeTeam : opp.dominatingTeam === 'away' ? match.awayTeam : null
                    },
                    dqs: opp.score,
                    conditions: {
                        highPressure: opp.heatLevel === 'ALEV' || opp.heatLevel === 'ALPHA',
                        xgAdvantage: (match.stats?.xg?.home || 0) > (match.stats?.xg?.away || 0) + 0.5 || (match.stats?.xg?.away || 0) > (match.stats?.xg?.home || 0) + 0.5,
                        qualityData: opp.score > 70
                    }
                })
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.sent) {
                    alert(lang === 'tr' ? '🚀 Sinyal VIP grubuna gönderildi!' : '🚀 Signal sent to VIP group!');
                } else {
                    alert(lang === 'tr' ? `⚠️ Gönderilmedi: ${data.reason || 'Kriter dışı'}` : `⚠️ Not sent: ${data.reason || 'Excluded'}`);
                }
            } else {
                alert(lang === 'tr' ? '❌ Backend hatası.' : '❌ Backend error.');
            }
        } catch (err) {
            console.error('Telegram error:', err);
            alert(lang === 'tr' ? '❌ Bağlantı hatası.' : '❌ Connection error.');
        }
    };

    const handleSendRadarToTelegram = async (e, s, consensusPred, agreementPercent) => {
        if (e) e.stopPropagation();

        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            const res = await fetch(`${proxyBase}/api/telegram/send-radar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    home: s.home,
                    away: s.away,
                    league: s.league,
                    time: s.time,
                    date: s.date,
                    topPred: consensusPred,
                    topCount: s.agreement?.[consensusPred] || 0,
                    totalSources: s.totalSources,
                    agreementPercent: agreementPercent,
                    predictions: s.predictions,
                    probabilities: s.probabilities,
                    scorePredictions: s.scorePredictions,
                    form: s.form,
                    ranks: s.ranks,
                    points: s.points,
                    agreement: s.agreement,
                    sendTeaser: true
                })
            });
            const data = await res.json();
            if (data.sent) {
                alert(lang === 'tr' ? `🚀 ${s.home} vs ${s.away} maçı Telegram VIP Grubuna gönderildi!` : `🚀 ${s.home} vs ${s.away} sent to Telegram VIP!`);
            } else {
                alert(lang === 'tr' ? `⚠️ Gönderilemedi: ${data.error || 'Bilinmeyen hata'}` : `⚠️ Failed: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Telegram radar send error:', err);
            alert(lang === 'tr' ? '❌ Telegram servisine bağlanılamadı.' : '❌ Connection error to Telegram service.');
        }
    };

    const radarMatches = React.useMemo(() => {
        if (view !== 'RADAR') return [];
        return consensusAdapter.getAllConsensusSummary(consensusData, selectedMarket);
    }, [view, consensusData, selectedMarket]);

    const filteredRadarMatches = React.useMemo(() => {
        if (view !== 'RADAR' || radarMatches.length === 0) return [];
        return radarMatches.filter(m => {
            // 1. Remove Finished Matches if filter active
            if (radarFilters.hideFinished && m.isFinished) {
                return false;
            }

            // Cross-reference with live/recent SofaScore fixtures
            if (radarFilters.hideFinished && matches && matches.length > 0) {
                const sofaMatch = matches.find(fm => 
                    consensusAdapter._isFuzzyMatch(m.home, m.away, fm.homeTeam, fm.awayTeam)
                );
                if (sofaMatch) {
                    const desc = (sofaMatch.status?.description || sofaMatch.status || '').toLowerCase();
                    const type = (sofaMatch.status?.type || '').toLowerCase();
                    if (type === 'finished' || desc.includes('ended') || desc.includes('ft') || desc.includes('finished')) {
                        return false;
                    }
                }
            }

            const matchSourceIds = Object.keys(m.predictions);
            const activeMatchSources = matchSourceIds.filter(s => radarFilters.sources.includes(s));

            if (activeMatchSources.length === 0) return false;
            if (activeMatchSources.length < radarFilters.minSources) return false;

            if (radarFilters.valueOnly && !m.isValue) return false;
            if (radarFilters.hideDivergent && m.divergence > CONFIG.MODULAR_SYSTEM.ADVANCED_ANALYSIS.DIVERGENCE_RADAR.THRESHOLD) return false;

            if (radarFilters.search) {
                const query = radarFilters.search.toLowerCase();
                return m.home.toLowerCase().includes(query) ||
                    m.away.toLowerCase().includes(query) ||
                    (m.league && m.league.toLowerCase().includes(query));
            }

            if (radarFilters.todayOnly) {
                const d = new Date();
                const todayStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (m.date !== todayStr) return false;
            }

            // --- PLAN BASED LEAGUE ENFORCEMENT ---
            const userPlan = userProfile?.plan || 'trial';
            const league = m.league || '';
            const tier1 = CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.TIER_1;
            const tier2 = CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.TIER_2;

            if (userPlan === 'trial') {
                if (!tier1.some(l => league.includes(l))) return false;
            } else if (userPlan === 'pro') {
                const isTier1 = tier1.some(l => league.includes(l));
                const isTier2 = tier2.some(l => league.includes(l));
                if (!isTier1 && !isTier2) return false;
            }

            return true;
        }).sort((a, b) => {
            // Finished matches always pushed to the very end if visible
            if (a.isFinished !== b.isFinished) {
                return a.isFinished ? 1 : -1;
            }

            // Upcoming (sıradaki) maçlar en önde listelenir
            if (a.isUpcoming !== b.isUpcoming) {
                return a.isUpcoming ? -1 : 1;
            }

            if (radarFilters.sortBy === 'TIME') {
                const tsA = a.kickoffTimestamp || 9999999999999;
                const tsB = b.kickoffTimestamp || 9999999999999;
                if (tsA !== tsB) return tsA - tsB;
            }

            // Priority 1: Full Consensus (8/8)
            const aIsFull = a.totalSources === 8 && Math.max(...Object.values(a.agreement)) === 8;
            const bIsFull = b.totalSources === 8 && Math.max(...Object.values(b.agreement)) === 8;
            if (aIsFull && !bIsFull) return -1;
            if (!aIsFull && bIsFull) return 1;

            // Priority 2: Agreement Percentage
            const aPercent = (Math.max(...Object.values(a.agreement)) / a.totalSources);
            const bPercent = (Math.max(...Object.values(b.agreement)) / b.totalSources);
            if (aPercent !== bPercent) return bPercent - aPercent;

            // Priority 3: Total Sources count
            return b.totalSources - a.totalSources;
        });
    }, [radarMatches, radarFilters, matches, userProfile]);

    const isAdmin = user?.email === 'karabulut.hamza@gmail.com';

    const t = translations[lang];

    const renderPlanComparison = () => {
        if (!showPlanComparison) return null;

        const plans = [
            { id: 'trial', name: t.trial_badge, color: '#94a3b8', features: t.plan_trial_features, price: t.plan_trial_price || 'Free' },
            { id: 'pro', name: t.pro_badge, color: '#38bdf8', features: t.plan_pro_features, price: (t.plan_pro_price || '$29/mo').replace('{price}', settings.price_pro || '29').replace('{curr}', settings.price_currency || '€') },
            { id: 'premium', name: t.premium_badge, color: '#00f2fe', features: t.plan_premium_features, price: (t.plan_premium_price || '$79/mo').replace('{price}', settings.price_premium || '79').replace('{curr}', settings.price_currency || '€') }
        ];

        return (
            <div className="modal-overlay" onClick={() => setShowPlanComparison(false)} style={{ zIndex: 10001 }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{
                    maxWidth: '1000px',
                    padding: '3rem',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                }}>
                    <button className="close-btn" onClick={() => setShowPlanComparison(false)}>×</button>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center', fontWeight: 900, background: 'linear-gradient(to right, #fff, var(--accent-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.compare_plans}</h2>
                    <p style={{ textAlign: 'center', opacity: 0.6, marginBottom: '3rem', fontSize: '1rem' }}>{t.select_best_plan || 'Sizin için en uygun planı seçin ve profesyonel analizin keyfini çıkarın.'}</p>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1.5rem',
                        alignItems: 'stretch'
                    }}>
                        {plans.map(p => (
                            <div key={p.id} style={{
                                padding: '2.5rem 2rem',
                                background: 'rgba(15, 23, 42, 0.6)',
                                borderRadius: '24px',
                                border: `2px solid ${p.id === userProfile?.plan ? p.color : 'rgba(255,255,255,0.05)'}`,
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                boxShadow: p.id === userProfile?.plan ? `0 0 30px ${p.color}22` : 'none'
                            }}
                                className="plan-card"
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-10px)';
                                    e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${p.color}11`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = p.id === userProfile?.plan ? `0 0 30px ${p.color}22` : 'none';
                                }}>
                                {p.id === userProfile?.plan && (
                                    <div style={{
                                        position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                                        background: p.color, color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 900,
                                        boxShadow: `0 0 15px ${p.color}`
                                    }}>{t.current_plan_label || 'MEVCUT PLANINIZ'}</div>
                                )}
                                <h3 style={{ color: p.color, fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 900 }}>{p.name}</h3>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    {p.price}
                                    <span style={{ fontSize: '0.8rem', opacity: 0.4, fontWeight: 600 }}>/ay</span>
                                </div>

                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem 0', flex: 1 }}>
                                    {p.features?.map((f, i) => (
                                        <li key={i} style={{ fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                                            <span style={{ color: p.color, fontWeight: 900 }}>✓</span>
                                            <span style={{ opacity: 0.85, lineHeight: '1.4' }}>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => {
                                        if (p.id === userProfile?.plan) return;
                                        if (pendingRequest?.requested_plan === p.id) return;
                                        setSelectedPlanForUpgrade(p);
                                    }}
                                    disabled={p.id === userProfile?.plan || (pendingRequest?.requested_plan === p.id) || requestLoading}
                                    style={{
                                        width: '100%',
                                        padding: '1.2rem',
                                        borderRadius: '16px',
                                        background: p.id === userProfile?.plan ? 'rgba(255,255,255,0.05)' : p.color,
                                        color: p.id === userProfile?.plan ? 'rgba(255,255,255,0.3)' : '#000',
                                        border: 'none',
                                        fontWeight: 900,
                                        fontSize: '1rem',
                                        cursor: (p.id === userProfile?.plan || pendingRequest?.requested_plan === p.id) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s ease',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px'
                                    }}>
                                    {p.id === userProfile?.plan ? t.current_plan : (pendingRequest?.requested_plan === p.id ? t.request_pending : t.select_plan)}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderUpgradeConfirmation = () => {
        if (!selectedPlanForUpgrade) return null;

        const p = selectedPlanForUpgrade;
        const features = p.id === 'pro' ? t.plan_pro_features : t.plan_premium_features;

        return (
            <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={() => setSelectedPlanForUpgrade(null)}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', padding: '2.5rem' }}>
                    <button className="close-btn" onClick={() => setSelectedPlanForUpgrade(null)}>×</button>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{p.id === 'pro' ? '🚀' : '💎'}</div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: p.color }}>{p.name} {t.upgrade_plan}</h2>
                        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginTop: '0.5rem' }}>{t.confirmation_desc || 'Sistemin tam gücüne erişmek üzeresiniz.'}</p>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '1rem', letterSpacing: '1px' }}>{t.top_benefits || 'ÖNE ÇIKAN AVANTAJLAR'}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {features.slice(0, 3).map((f, i) => (
                                <li key={i} style={{ display: 'flex', gap: '0.7rem', marginBottom: '0.8rem', fontSize: '0.9rem', alignItems: 'center' }}>
                                    <span style={{ color: p.color }}>✦</span> {f}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            onClick={() => {
                                const whatsappNum = (settings.whatsapp_number || CONFIG.SUPPORT.WHATSAPP).replace('+', '').replace(/\s/g, '');
                                const msg = encodeURIComponent(`Merhaba, ${p.name} paketi için üyeliğimi yükseltmek istiyorum. (Email: ${user?.email})`);
                                window.open(`https://wa.me/${whatsappNum}?text=${msg}`, '_blank');
                                setSelectedPlanForUpgrade(null);
                            }}
                            className="btn btn-primary"
                            style={{ background: '#25D366', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1rem', color: '#000' }}
                        >
                            🟢 {t.whatsapp_upgrade_now || 'WhatsApp ile Hemen Aktif Et'}
                        </button>

                        <button
                            onClick={() => {
                                requestUpgrade(p.id);
                                setSelectedPlanForUpgrade(null);
                                setShowPlanComparison(false);
                            }}
                            className="btn btn-outline"
                            style={{ padding: '1rem', borderRadius: '12px', fontSize: '0.9rem' }}
                        >
                            📩 {t.request_upgrade || 'Sistemden Talep Gönder'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderBayesianIntelligence = (match) => {
        const data = match?.observations?.bayesian;
        if (!data || userProfile?.plan !== 'premium' || !advancedSettings.BAYESIAN_PRICING) return null;

        return (
            <div className="grid-col" style={{ gridColumn: 'span 3', marginTop: '1.5rem' }}>
                <div className="stats-card" style={{
                    background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.05) 0%, rgba(15, 23, 42, 0.4) 100%)',
                    border: '1px solid rgba(0, 242, 254, 0.2)',
                    padding: '1.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                            <span style={{ marginRight: '0.5rem' }}>🧠</span> BAYESIAN INTELLIGENCE
                        </h3>
                        <div style={{ background: 'var(--accent-color)', color: '#000', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>PRODUCTION ENGINE</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '2rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.5rem' }}>PRIOR PROB</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>%{(data.prior * 100).toFixed(0)}</div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '1rem' }}>POSTERIOR (REFINED)</div>
                            <div style={{ position: 'relative', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="100" height="60" viewBox="0 0 100 60">
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--accent-color)" strokeWidth="8" strokeDasharray={`${data.posterior * 125}, 125`} />
                                </svg>
                                <div style={{ position: 'absolute', bottom: '0', fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-color)' }}>
                                    %{(data.posterior * 100).toFixed(1)}
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.5rem' }}>IMPACT</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: data.impact > 0 ? 'var(--success-color)' : (data.impact < 0 ? 'var(--danger-color)' : '#fff') }}>
                                {data.impact > 0 ? `+${(data.impact * 100).toFixed(1)}%` : `${(data.impact * 100).toFixed(1)}%`}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <span style={{ opacity: 0.6 }}>CONFIDENCE:</span>
                            <span style={{ color: data.confidence === 'HIGH' ? 'var(--success-color)' : 'var(--warning-color)', fontWeight: 800 }}>{data.confidence}</span>
                        </div>
                        <div style={{ opacity: 0.6, fontStyle: 'italic' }}>Evidence update based on DQS, Momentum & xG support.</div>
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (selectedMatch) {
            dataWorker.setSelectedMatch(selectedMatch.id);
        } else {
            dataWorker.setSelectedMatch(null);
        }
    }, [selectedMatch]);

    // Live Odds Fetching for Opportunity Scoring (Local Proxy first, then Firebase)
    useEffect(() => {
        const fetchLiveOdds = async () => {
            try {
                // 1. Try local proxy first
                const proxyBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
                try {
                    const res = await fetch(`${proxyBase}/api/odds/live`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && (data.matches?.length > 0 || Object.keys(data).length > 2)) {
                            setLiveOdds(data);
                            liveOpportunityScorer.setLiveOdds(data);
                            return;
                        }
                    }
                } catch (pe) { /* fallback to firebase */ }

                // 2. Fallback to Firebase
                const snapshot = await get(ref(database, 'live_odds'));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setLiveOdds(data);
                    // Pass to opportunity scorer for value detection
                    liveOpportunityScorer.setLiveOdds(data);
                }
            } catch (e) {
                console.log('[ODDS] Odds fetch failed:', e.message);
            }
        };

        fetchLiveOdds();
        const interval = setInterval(fetchLiveOdds, 30000); // Every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Fetch dynamic AI weights & quarantines from Self-Learning Engine
    useEffect(() => {
        const fetchAiWeights = async () => {
            try {
                const proxyBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
                const res = await fetch(`${proxyBase}/api/learning/weights`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.version) {
                        liveOpportunityScorer.setDynamicWeights(data);
                    }
                }
            } catch (e) {
                // Silently ignore if proxy is temporarily offline
            }
        };

        fetchAiWeights();
        const interval = setInterval(fetchAiWeights, 60000); // Recalibrate every 60 seconds
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        dataWorker.start();

        let lastConsensusRef = null;
        let lastFixturesUpdate = 0;

        const syncUI = () => {
            // 1. Second counter (lightweight)
            if (dataWorker.healthStats.lastFetch) {
                setLastFetchSeconds(Math.floor((Date.now() - dataWorker.healthStats.lastFetch) / 1000));
            }

            // 2. Only update consensus data when reference actually changes (every ~2 mins)
            if (dataWorker.consensusData && dataWorker.consensusData !== lastConsensusRef) {
                lastConsensusRef = dataWorker.consensusData;
                setConsensusData(dataWorker.consensusData);
            }

            // 3. Only recalculate fixtures and signals when a new poll completed
            if (dataWorker.lastUpdated && dataWorker.lastUpdated === lastFixturesUpdate) {
                return;
            }
            if (!dataWorker.lastUpdated && (!dataWorker.fixtures || dataWorker.fixtures.length === 0)) {
                return;
            }
            lastFixturesUpdate = dataWorker.lastUpdated;

            setHealthStats({ ...dataWorker.healthStats });

            const currentFixtures = dataWorker.fixtures;
            if (!currentFixtures || currentFixtures.length === 0) {
                setMatches(prev => prev.length === 0 ? prev : []);
                setSignals(prev => Object.keys(prev).length === 0 ? prev : {});
                return;
            }

            // AUTO-SETTLEMENT ENGINE (v4.0): Settle any concluded matches automatically
            try {
                autoSettlementEngine.settleOpenBets(currentFixtures);
            } catch (e) {
                console.warn('[Dashboard] Error in autoSettlementEngine:', e);
            }

            setMatches([...currentFixtures]);

            const updatedSignals = {};
            const enrichedFixtures = currentFixtures.map(m => {
                const sig = dataWorker.getSignalForMatch(m.id) || m.signal;
                if (sig) {
                    updatedSignals[m.id] = sig;
                    bankrollManager.logVerdict(m.id, sig.verdict);
                }

                // ENRICH: Add opportunity data for Smart Alerts
                const opp = liveOpportunityScorer.calculateOpportunityScore(m, sig);
                return { ...m, opportunityData: opp };
            });

            setSignals(updatedSignals);
            setBankState(bankrollManager.getState());

            // Check for smart alerts with enriched data
            const newAlerts = smartAlertService.checkMatches(enrichedFixtures, updatedSignals);
            smartAlertService.autoResolveAlerts(enrichedFixtures);
            if (newAlerts.length > 0) {
                setActiveAlerts([...smartAlertService.getActiveAlerts()]);
                setAlertHistoryList(smartAlertService.getHistory(50));
                // Only show popup/toast if notify mode is TOAST (respects SILENT and OFF)
                if (alertNotifyModeRef.current === 'TOAST') {
                    setShowAlertPopup(newAlerts[0]);
                    setToastProgress(100);
                }
                setTrackingStats(predictionTracker.getStats());

                // Trigger FinTech terminal chime
                try {
                    const topAlert = newAlerts[0];
                    if (topAlert.level === 'ALEV' || topAlert.recommendation?.edgeType === 'LATENCY') {
                        audioAlert.playChime('ALEV');
                    } else {
                        audioAlert.playChime('SICAK');
                    }
                } catch (e) {
                    console.warn('[AudioAlert] Play failed:', e);
                }
            }
        };

        // Run immediately on mount!
        syncUI();

        // Responsive sync interval (2000ms)
        const interval = setInterval(syncUI, 2000);

        // Direct subscription to dataWorker for instant UI updates!
        const unsubscribeWorker = dataWorker.subscribe(syncUI);

        // Subscribe to alerts
        const unsubscribe = smartAlertService.subscribe((alert) => {
            setActiveAlerts([...smartAlertService.getActiveAlerts()]);
            setAlertHistoryList(smartAlertService.getHistory(50));
        });

        // Auto-check for result processing (Every 60s)
        const resultCheckInterval = setInterval(() => {
            predictionTracker.checkPendingPredictions().then(() => {
                setTrackingStats(predictionTracker.getStats());
            });
        }, 60000);

        return () => {
            clearInterval(interval);
            clearInterval(resultCheckInterval);
            unsubscribe();
            unsubscribeWorker();
            dataWorker.stop();
        };
    }, []);

    const getEnforcedMatches = () => {
        const isLocalDev = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.startsWith('192.168.') ||
                           window.location.hostname.startsWith('10.') ||
                           window.location.hostname.startsWith('172.');
        const effectivePlan = (isAdmin || isLocalDev) ? 'premium' : (userProfile?.plan || 'trial');

        if (effectivePlan === 'trial') {
            // PROD Trial: Only Tier 1
            return matches.filter(m => m.tier === 1);
        } else if (effectivePlan === 'pro') {
            // PROD Pro: Tier 1 & 2
            return matches.filter(m => m.tier === 1 || m.tier === 2);
        }
        return matches; // Premium or Admin/LocalDev
    };

    const enforcedMatches = getEnforcedMatches();
    const analytics = bankrollManager.getAnalytics();

    const eligibleMatches = enforcedMatches
        .filter(m => m.dqs >= CONFIG.DECISION.DQS_THRESHOLD);

    const observationMatches = enforcedMatches
        .filter(m => (m.dqs || 0) < CONFIG.DECISION.DQS_THRESHOLD)
        .sort((a, b) => (b.dqs || 0) - (a.dqs || 0));

    const filterByTier = (m) => activeTierFilter === 'ALL' || m.tier === activeTierFilter;

    const handleGenerateGlobalReport = async (type) => {
        // Enforce AI Usage Limits
        const limitCheck = aiUsageLimiter.canMakeAIRequest(user?.id, userProfile?.plan || 'trial');
        if (!limitCheck.allowed) {
            alert(lang === 'tr'
                ? `Günlük AI rapor limitinize ulaştınız (${limitCheck.limit}). Yarın tekrar deneyebilir veya planınızı yükseltebilirsiniz.`
                : `You've reached your daily AI report limit (${limitCheck.limit}). Try again tomorrow or upgrade your plan.`);
            return;
        }

        setGlobalReport({ content: '', type, loading: true });

        try {
            let report = "";
            if (type === 'LIVE') {
                report = await dataWorker.generateGlobalIntelligence('LIVE');
            } else {
                // Pre-match logic: Selective mix for the AI "Judge"
                const highConsensus = filteredRadarMatches.filter(m =>
                    m.agreement && (Math.max(...Object.values(m.agreement)) / m.totalSources) >= 0.80 && m.totalSources >= 4
                ).slice(0, 4);

                const highDivergence = filteredRadarMatches.filter(m =>
                    m.divergence > 30 && m.totalSources >= 3 && !highConsensus.find(hc => hc.match === m.match)
                ).sort((a, b) => b.divergence - a.divergence).slice(0, 4);

                const candidates = [...highConsensus, ...highDivergence];

                if (candidates.length === 0) {
                    report = "Şu an kriterlere uygun 'Altın Seçim' veya 'Tartışmalı Maç' bulunamadı.";
                } else {
                    report = await aiAnalystService.getGlobalIntelligenceReport(candidates, 'PRE-MATCH');
                }
            }

            // Record usage
            aiUsageLimiter.recordAIUsage(user?.id, 'report');

            setGlobalReport({ content: report, type, loading: false });
        } catch (error) {
            console.error('[AI_REPORT] Generation Error:', error);
            setGlobalReport({
                content: "Bu rapor şu an teknik bir sorun nedeniyle hazırlanamıyor. Lütfen tekrar deneyin.",
                type,
                loading: false
            });
        }
    };

    const renderGlobalAISection = (type) => {
        const isLoading = globalReport.loading && globalReport.type === type;
        const hasContent = globalReport.content && globalReport.type === type;

        return (
            <div className="global-ai-container glass-panel" style={{
                marginBottom: '2.5rem',
                padding: '2rem',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.4) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '16px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.6rem', letterSpacing: '0.5px' }}>
                            <span style={{ fontSize: '1.2rem' }}>💎</span>
                            {t.global_title}
                        </h4>
                        <span style={{
                            background: 'var(--accent-color)',
                            color: '#000',
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            letterSpacing: '1px'
                        }}>PRO</span>
                    </div>

                    <button
                        onClick={() => handleGenerateGlobalReport(type)}
                        disabled={isLoading}
                        style={{
                            background: isLoading ? 'rgba(255,255,255,0.05)' : 'var(--accent-color)',
                            color: '#000',
                            border: 'none',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 900,
                            cursor: isLoading ? 'default' : 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: isLoading ? 'none' : '0 4px 15px rgba(56, 189, 248, 0.3)'
                        }}
                    >
                        {isLoading ? (
                            <>
                                <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>🌀</span>
                                {t.analyzing}
                            </>
                        ) : (
                            <>
                                <span>🚀</span>
                                {t.generate_report}
                            </>
                        )}
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div className="skeleton-loader" style={{ height: '0.8rem', width: '95%', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}></div>
                        <div className="skeleton-loader" style={{ height: '0.8rem', width: '85%', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}></div>
                        <div className="skeleton-loader" style={{ height: '0.8rem', width: '90%', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}></div>
                    </div>
                ) : hasContent ? (
                    <div className="ai-report-content" style={{ padding: '0.5rem' }}>
                        {(() => {
                            let data = null;
                            try {
                                const clean = globalReport.content.replace(/```json|```/g, '').trim();
                                data = JSON.parse(clean);
                            } catch (e) {
                                return (
                                    <p style={{ fontSize: '0.85rem', color: '#e2e8f0', whiteSpace: 'pre-line' }}>
                                        {globalReport.content}
                                    </p>
                                );
                            }

                            return (
                                <>
                                    {data.report_summary && (
                                        <div style={{
                                            padding: '1rem',
                                            background: 'rgba(56, 189, 248, 0.1)',
                                            borderRadius: '8px',
                                            marginBottom: '1.5rem',
                                            fontSize: '0.8rem',
                                            color: 'var(--accent-color)',
                                            borderLeft: '4px solid var(--accent-color)',
                                            lineHeight: '1.5'
                                        }}>
                                            {data.report_summary}
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
                                        {data.golden_picks?.map((pick, i) => (
                                            <div key={i} className="glass-panel" style={{
                                                padding: '1.5rem',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.8rem',
                                                position: 'relative',
                                                transition: 'transform 0.3s'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>{pick.match || 'Maç Bilgisi'}</h5>
                                                        {(pick.market || pick.time_info) && (
                                                            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{pick.market || pick.time_info}</span>
                                                        )}
                                                    </div>
                                                    <div style={{
                                                        background: pick.verdict === 'BET' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                        color: pick.verdict === 'BET' ? 'var(--success-color)' : 'var(--danger-color)',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 900
                                                    }}>
                                                        {pick.verdict || pick.risk || 'N/A'}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                    {pick.probability && (
                                                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                                            <span style={{ opacity: 0.6 }}>Olasılık:</span> <b style={{ color: 'var(--accent-color)' }}>%{pick.probability}</b>
                                                        </div>
                                                    )}
                                                    {pick.edge && (
                                                        <div style={{ background: 'rgba(250, 204, 21, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                                            <span style={{ opacity: 0.6 }}>Edge:</span> <b style={{ color: '#facc15' }}>%{pick.edge}</b>
                                                        </div>
                                                    )}
                                                    {pick.risk && (
                                                        <div style={{ background: pick.risk === 'DÜŞÜK' ? 'rgba(16, 185, 129, 0.1)' : pick.risk === 'YÜKSEK' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(250, 204, 21, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                                            <span style={{ opacity: 0.6 }}>Risk:</span> <b style={{ color: pick.risk === 'DÜŞÜK' ? 'var(--success-color)' : pick.risk === 'YÜKSEK' ? 'var(--danger-color)' : '#facc15' }}>{pick.risk}</b>
                                                        </div>
                                                    )}
                                                </div>

                                                {pick.reason && (
                                                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                                        <b>Neden:</b> {pick.reason}
                                                    </div>
                                                )}

                                                {pick.hidden_insight && (
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', marginTop: 'auto' }}>
                                                        <span style={{ color: 'var(--accent-color)', fontWeight: 800 }}>💡 Insight:</span> {pick.hidden_insight}
                                                    </div>
                                                )}

                                                {pick.trap_alert && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--danger-color)', opacity: 0.8, marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <span>⚠️</span> {pick.trap_alert}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {data.strategic_combo && (
                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1.2rem',
                                            background: 'rgba(167, 139, 250, 0.05)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(167, 139, 250, 0.2)'
                                        }}>
                                            <h6 style={{ margin: '0 0 0.5rem 0', color: '#a78bfa', fontSize: '0.8rem', fontWeight: 900 }}>🎯 STRATEJİK KOMBİNASYON</h6>
                                            {typeof data.strategic_combo === 'string' ? (
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#e2e8f0' }}>{data.strategic_combo}</p>
                                            ) : (
                                                <div style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                                                    {data.strategic_combo.type && <p style={{ margin: '0 0 0.3rem 0', fontWeight: 700 }}>{data.strategic_combo.type}</p>}
                                                    {data.strategic_combo.matches && (
                                                        <ul style={{ margin: '0.3rem 0', paddingLeft: '1.2rem' }}>
                                                            {data.strategic_combo.matches.map((m, idx) => <li key={idx}>{m}</li>)}
                                                        </ul>
                                                    )}
                                                    {data.strategic_combo.combined_probability && (
                                                        <p style={{ margin: '0.3rem 0 0 0', opacity: 0.7 }}>Kombine Olasılık: %{data.strategic_combo.combined_probability}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Avoid List */}
                                    {data.avoid_list && data.avoid_list.length > 0 && (
                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1rem',
                                            background: 'rgba(239, 68, 68, 0.05)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(239, 68, 68, 0.2)'
                                        }}>
                                            <h6 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger-color)', fontSize: '0.75rem', fontWeight: 900 }}>⚠️ KAÇINILMASI GEREKENLER</h6>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#e2e8f0' }}>
                                                {data.avoid_list.map((item, idx) => <li key={idx} style={{ marginBottom: '0.3rem' }}>{item}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Value Picks */}
                                    {data.value_picks && data.value_picks.length > 0 && (
                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1rem',
                                            background: 'rgba(16, 185, 129, 0.05)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(16, 185, 129, 0.2)'
                                        }}>
                                            <h6 style={{ margin: '0 0 0.5rem 0', color: 'var(--success-color)', fontSize: '0.75rem', fontWeight: 900 }}>💎 DEĞER MAÇLARI</h6>
                                            {data.value_picks.map((pick, idx) => (
                                                <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#e2e8f0' }}>
                                                    <b>{pick.match}</b>
                                                    {pick.market && <span style={{ opacity: 0.7 }}> - {pick.market}</span>}
                                                    {pick.reason && <p style={{ margin: '0.2rem 0 0 0', opacity: 0.8, fontSize: '0.7rem' }}>{pick.reason}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.5, fontSize: '0.8rem', fontStyle: 'italic' }}>
                        {t.report_standby_desc}
                    </div>
                )}
            </div>
        );
    };

    // Portfolio Rendering Logic
    const RenderPortfolio = () => {
        const state = bankrollManager.getState();
        const ledger = state.ledger || [];
        const initialBalance = state.initial_balance || 1000;
        const currentBalance = state.balance || 1000;
        const totalProfit = currentBalance - initialBalance;
        const roi = (totalProfit / initialBalance) * 100;

        const wins = ledger.filter(l => l.status === 'WIN').length;
        const losses = ledger.filter(l => l.status === 'LOSS').length;
        const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

        // Custom SVG Chart Data
        const settlementPoints = ledger.filter(l => l.type === 'SETTLEMENT' || l.type === 'INIT').map(l => l.balance_after || l.amount);
        const points = settlementPoints.length > 0 ? settlementPoints : [initialBalance];
        const max = Math.max(...points, initialBalance * 1.05);
        const min = Math.min(...points, initialBalance * 0.95);
        const range = max - min || 1;
        
        const svgPoints = points.map((p, i) => {
            const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
            const y = 100 - ((p - min) / range) * 100;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div className="portfolio-view" style={{ animation: 'fadeIn 0.5s ease', paddingBottom: '5rem' }}>
                <div className="section-header" style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>📈 {t.portfolio_title}</h2>
                    <p style={{ opacity: 0.5, fontSize: '0.9rem', fontWeight: 600 }}>{t.subtitle} — v2.0 Algorithm Tracking</p>
                </div>

                <div className="portfolio-grid">
                    <div className="portfolio-card glass-panel">
                        <span className="label">{t.total_profit}</span>
                        <div className="value" style={{ color: totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} ₺
                        </div>
                        <div className="trend" style={{ color: totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                            {totalProfit >= 0 ? '↑' : '↓'} {roi.toFixed(1)}% ROI
                        </div>
                    </div>
                    <div className="portfolio-card glass-panel">
                        <span className="label">{t.win_rate}</span>
                        <div className="value" style={{ color: 'var(--accent-color)' }}>
                            %{winRate.toFixed(1)}
                        </div>
                        <div className="trend" style={{ opacity: 0.6 }}>
                            {wins}W - {losses}L
                        </div>
                    </div>
                    <div className="portfolio-card glass-panel">
                        <span className="label">{t.current_balance}</span>
                        <div className="value">{currentBalance.toFixed(2)} ₺</div>
                        <div className="trend" style={{ opacity: 0.6 }}>{t.starting_balance}: {initialBalance}₺</div>
                    </div>
                    <div className="portfolio-card glass-panel">
                        <span className="label">{t.active_exposure}</span>
                        <div className="value" style={{ color: 'var(--warning-color)' }}>
                            {ledger.filter(l => l.status === 'OPEN').reduce((acc, curr) => acc + curr.stake, 0).toFixed(2)} ₺
                        </div>
                        <div className="trend" style={{ opacity: 0.6 }}>{ledger.filter(l => l.status === 'OPEN').length} {t.open_short}</div>
                    </div>
                </div>

                <div className="chart-panel glass-panel">
                    <h3>📊 {t.growth_chart}</h3>
                    <div className="svg-chart-container">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {points.length > 1 && (
                                <>
                                    <path
                                        d={`M 0,100 L ${svgPoints} L 100,100 Z`}
                                        fill="url(#chartGradient)"
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="var(--accent-color)"
                                        strokeWidth="0.5"
                                        points={svgPoints}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </>
                            )}
                            {points.map((p, i) => {
                                const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
                                const y = 100 - ((p - min) / range) * 100;
                                return (
                                    <circle key={i} cx={x} cy={y} r="0.8" fill="var(--accent-color)" />
                                );
                            })}
                        </svg>
                    </div>
                </div>

                <div className="portfolio-list-panel glass-panel" style={{ padding: '0' }}>
                    <div className="portfolio-row" style={{ borderBottom: '1px solid var(--glass-border)', opacity: 0.5, fontSize: '0.7rem', fontWeight: 800 }}>
                        <span>{t.match_score}</span>
                        <span>{t.recom_stake_short}</span>
                        <span>{t.status}</span>
                        <span>SONUÇ</span>
                        <span>TARİH</span>
                    </div>
                    {ledger.slice().reverse().filter(l => l.type === 'SETTLEMENT' || l.status === 'OPEN' || l.type === 'INIT').slice(0, 15).map((l, i) => (
                        <div key={i} className="portfolio-row" style={{ borderBottom: i < 14 ? '1px solid var(--glass-border)' : 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{l.match || 'System Entry'}</span>
                                <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>{l.reason || 'Account Setup'}</span>
                            </div>
                            <span style={{ color: 'var(--accent-color)', fontWeight: 800 }}>{l.stake || 0} ₺</span>
                            <span>
                                <span className={`status-pill ${l.status === 'WIN' ? 'ok' : l.status === 'LOSS' ? 'fail' : ''}`} style={{ 
                                    background: l.status === 'OPEN' ? 'rgba(56, 189, 248, 0.1)' : '', 
                                    color: l.status === 'OPEN' ? 'var(--accent-color)' : '', 
                                    border: l.status === 'OPEN' ? '1px solid var(--accent-color)' : '' 
                                }}>
                                    {l.status || 'INFO'}
                                </span>
                            </span>
                            <span style={{ color: (l.profit || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 800 }}>
                                {l.profit ? (l.profit >= 0 ? '+' : '') + l.profit.toFixed(2) + ' ₺' : '-'}
                            </span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                {new Date(l.timestamp).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', background: 'radial-gradient(circle at top right, #1e293b, #030712)' }}>

            {pendingRequest && (
                <div style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeIn 0.5s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>⏳</span>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t.request_pending_title || 'Yükseltme Talebi Beklemede'}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                {pendingRequest.requested_plan.toUpperCase()} planı için talebiniz iletildi. Onaylanınca özellikleriniz açılacaktır.
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modern Institutional Terminal Header */}
            <header className="terminal-header glass-panel">
                {/* Top Row: Brand & Quick Action Controls */}
                <div className="terminal-header-top">
                    <div className="brand-group" onClick={() => setView('DASHBOARD')}>
                        <div className="brand-logo-badge">⚡</div>
                        <div className="brand-text">
                            <div className="brand-title">
                                <span>{t.title || 'LIVE BET MENTOR'}</span>
                                <span className="live-status-dot" title="Autonomous Radar Online"></span>
                            </div>
                            <div className="brand-subtitle">{t.subtitle}</div>
                        </div>
                    </div>

                    <div className="terminal-header-actions">
                        {/* Notification Mode Toggle */}
                        <button
                            className="icon-ctrl-btn"
                            onClick={() => {
                                const nextMode = alertNotifyMode === 'TOAST' ? 'SILENT' : alertNotifyMode === 'SILENT' ? 'OFF' : 'TOAST';
                                setAlertNotifyMode(nextMode);
                                try { localStorage.setItem('alert_notify_mode', nextMode); } catch (e) {}
                            }}
                            title={alertNotifyMode === 'TOAST' ? 'Bildirim: Açık (Toast)' : alertNotifyMode === 'SILENT' ? 'Bildirim: Sessiz' : 'Bildirim: Kapalı'}
                        >
                            <span>{alertNotifyMode === 'TOAST' ? '🔔' : alertNotifyMode === 'SILENT' ? '🔕' : '🚫'}</span>
                            <span className="ctrl-label">{alertNotifyMode === 'TOAST' ? (lang === 'tr' ? 'Açık' : 'On') : alertNotifyMode === 'SILENT' ? (lang === 'tr' ? 'Sessiz' : 'Silent') : (lang === 'tr' ? 'Kapalı' : 'Off')}</span>
                        </button>

                        {/* Audio Alert Toggle */}
                        <button
                            className="icon-ctrl-btn"
                            onClick={() => {
                                const newMuted = audioAlert.toggle();
                                setAudioMuted(newMuted);
                            }}
                            title={!audioMuted ? 'Ses: Açık' : 'Ses: Kapalı'}
                        >
                            <span>{!audioMuted ? '🔊' : '🔇'}</span>
                            <span className="ctrl-label">{!audioMuted ? (lang === 'tr' ? 'Ses Açık' : 'Audio On') : (lang === 'tr' ? 'Sessiz' : 'Muted')}</span>
                        </button>

                        {/* Signal History & Bets Button */}
                        <button
                            className="icon-ctrl-btn signal-history-btn"
                            onClick={() => {
                                smartAlertService.autoResolveAlerts(matches);
                                setAlertHistoryList(smartAlertService.getHistory(50));
                                setTrackingStats(predictionTracker.getStats());
                                setTrackingActiveTab('ALERTS');
                                setShowTrackingPanel(true);
                            }}
                            title="Sinyal Geçmişi & Tahmin Karnesi"
                        >
                            <span>📊</span>
                            <span className="ctrl-label">{lang === 'tr' ? 'Sinyaller' : 'Signals'}</span>
                            {alertHistoryList.length > 0 && (
                                <span className="badge-count">{alertHistoryList.length}</span>
                            )}
                        </button>

                        {/* User Profile Avatar / Menu Trigger */}
                        <div className="user-menu-wrapper" style={{ position: 'relative' }}>
                            <button
                                className="user-profile-trigger"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            >
                                <span className="user-avatar-icon">👤</span>
                                <span className="user-plan-badge" style={{
                                    background: PLAN_COLORS[userProfile?.plan || 'trial'] + '22',
                                    color: PLAN_COLORS[userProfile?.plan || 'trial'],
                                    border: `1px solid ${PLAN_COLORS[userProfile?.plan || 'trial']}55`
                                }}>
                                    {t[(userProfile?.plan || 'trial') + '_badge']}
                                </span>
                                <span className="user-arrow-icon">{showUserMenu ? '▲' : '▼'}</span>
                            </button>

                            {/* Dropdown Popover */}
                            {showUserMenu && (
                                <div className="user-dropdown-popover glass-panel">
                                    <div className="user-popover-header">
                                        <div className="user-email-text">{user?.email}</div>
                                        {userProfile?.subscription_end && (
                                            <div className="user-expiry-text" style={{ color: getRemainingDays(userProfile.subscription_end) <= 3 ? '#ef4444' : '#94a3b8' }}>
                                                ⏳ {getRemainingDays(userProfile.subscription_end)} {t.days_remaining}
                                            </div>
                                        )}
                                    </div>

                                    <div className="user-popover-divider"></div>

                                    {/* Language Switch */}
                                    <div className="popover-row">
                                        <span className="popover-label">🌐 {lang === 'tr' ? 'Dil' : 'Language'}</span>
                                        <div className="popover-lang-group">
                                            {['tr', 'en'].map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => setLang(l)}
                                                    className={`popover-lang-btn ${lang === l ? 'active' : ''}`}
                                                >
                                                    {l.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Settings Button */}
                                    <button
                                        className="popover-action-btn"
                                        onClick={() => { setShowAdvanced(true); setShowUserMenu(false); }}
                                    >
                                        <span>⚙️</span>
                                        <span>{t.advanced_settings || 'Gelişmiş Ayarlar'}</span>
                                    </button>

                                    {/* Reset Data Button */}
                                    <button
                                        className="popover-action-btn text-danger"
                                        onClick={() => {
                                            localStorage.removeItem('lbm_bankroll_state');
                                            window.location.reload();
                                        }}
                                    >
                                        <span>🔄</span>
                                        <span>{lang === 'tr' ? 'Verileri Sıfırla' : 'Reset System'}</span>
                                    </button>

                                    <div className="user-popover-divider"></div>

                                    {/* Logout Button */}
                                    <button
                                        className="popover-logout-btn"
                                        onClick={() => { setShowUserMenu(false); onLogout(); }}
                                    >
                                        <span>🚪</span>
                                        <span>{t.logout}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Row: Single Unified Navigation Bar */}
                <div className="terminal-nav-row">
                    <div className="unified-nav-tabs">
                        <button
                            className={`unified-tab-btn ${view === 'DASHBOARD' ? 'active' : ''}`}
                            onClick={() => setView('DASHBOARD')}
                        >
                            <span>⚡</span>
                            <span>{lang === 'tr' ? 'CANLI RADAR' : 'LIVE RADAR'}</span>
                            {matches.length > 0 && <span className="tab-count-pill">{matches.length}</span>}
                        </button>
                        <button
                            className={`unified-tab-btn ${view === 'RADAR' ? 'active' : ''}`}
                            onClick={() => setView('RADAR')}
                        >
                            <span>🎯</span>
                            <span>{lang === 'tr' ? 'GÜNLÜK RADAR' : 'DAILY RADAR'}</span>
                        </button>
                        <button
                            className={`unified-tab-btn ${view === 'PORTFOLIO' ? 'active' : ''}`}
                            onClick={() => setView('PORTFOLIO')}
                        >
                            <span>📈</span>
                            <span>{lang === 'tr' ? 'PORTFÖY' : 'PORTFOLIO'}</span>
                        </button>
                        {(isAdmin || userProfile?.plan === 'admin') && (
                            <button
                                className={`unified-tab-btn admin ${view === 'ADMIN' ? 'active' : ''}`}
                                onClick={() => setView('ADMIN')}
                            >
                                <span>🛡️</span>
                                <span>ADMIN</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Micro KPI Ticker Strip */}
                <div className="terminal-kpi-strip">
                    <div className="kpi-pill success">
                        <span className="kpi-label">{t.pass_rate}:</span>
                        <span className="kpi-val">{(analytics.passRate || 0).toFixed(1)}%</span>
                    </div>
                    <div className="kpi-pill neutral">
                        <span className="kpi-label">{t.no_bet_rate}:</span>
                        <span className="kpi-val">{(analytics.noBetRate || 0).toFixed(1)}%</span>
                    </div>
                    <div className="kpi-pill accent">
                        <span className="kpi-label">{t.limit}:</span>
                        <span className="kpi-val">{bankState.daily_bet_count}/{CONFIG.BANKROLL.HIERARCHY.THRESHOLDS.DAILY_BET_LIMIT}</span>
                    </div>
                    <button
                        onClick={() => { setFaqMode('live'); setShowFAQ(true); }}
                        className="kpi-faq-btn"
                        title={lang === 'tr' ? 'Sistem Rehberi & SSS' : 'System Guide & FAQ'}
                    >
                        <span>❓</span>
                        <span className="kpi-faq-text">{lang === 'tr' ? 'Rehber' : 'Guide'}</span>
                    </button>
                </div>
            </header>

            {/* Slim Dismissible Membership Warning Banner */}
            {!dismissTrialBanner && (userProfile?.plan === 'trial' || getRemainingDays(userProfile?.subscription_end) <= 3) && (
                <div className="slim-membership-banner glass-panel">
                    <div className="banner-left">
                        <span className="banner-icon">{getRemainingDays(userProfile?.subscription_end) <= 3 ? '⚠️' : '🎁'}</span>
                        <div className="banner-text">
                            <strong>{getRemainingDays(userProfile?.subscription_end) <= 3 ? t.expiry_warning : t.trial_banner_title}:</strong>
                            <span> {getRemainingDays(userProfile?.subscription_end) <= 3
                                ? `${getRemainingDays(userProfile?.subscription_end)} ${t.days_remaining}`
                                : t.trial_banner_desc}</span>
                        </div>
                    </div>
                    <div className="banner-right">
                        <button
                            onClick={() => setShowAdvanced(true)}
                            className="banner-upgrade-btn"
                        >
                            {t.upgrade_plan}
                        </button>
                        <button
                            onClick={() => setDismissTrialBanner(true)}
                            className="banner-dismiss-btn"
                            title={lang === 'tr' ? 'Kapat' : 'Close'}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {view === 'PORTFOLIO' ? (
                <RenderPortfolio />
            ) : view === 'ADMIN' ? (
                <AdminPanel lang={lang} />
            ) : view === 'RADAR' ? (
                <div className="radar-view" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
                        <div>
                            <h3 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px' }}>
                                <span style={{ marginRight: '1rem' }}>🎯</span>
                                {t.daily_radar}
                            </h3>
                            <div style={{ marginTop: '0.5rem', opacity: 0.6, fontSize: '0.85rem' }}>
                                {filteredRadarMatches.length} / {radarMatches.length} {t.matches_found}
                            </div>

                            {/* Market Selector Tabs */}
                            <div className="market-tabs" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                                {[
                                    { id: '1X2', label: '1X2', icon: '🎯' },
                                    { id: 'OU25', label: t.market_ou25 || 'Over/Under 2.5', icon: '📊' },
                                    { id: 'BTTS', label: t.market_btts || 'Both Teams to Score', icon: '🔥' }
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMarket(m.id)}
                                        style={{
                                            padding: '0.6rem 1.2rem',
                                            borderRadius: '10px',
                                            border: '1px solid ' + (selectedMarket === m.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'),
                                            background: selectedMarket === m.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                                            color: selectedMarket === m.id ? '#000' : 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <span>{m.icon}</span> {m.label}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setShowStakingCalc(true)}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        borderRadius: '10px',
                                        border: '1px solid #fbbf24',
                                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.05))',
                                        color: '#fbbf24',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 15px rgba(251, 191, 36, 0.2)'
                                    }}
                                >
                                    <span>💰</span> {t.open_staking_calc || 'BAHİS HESAPLAYICI'}
                                </button>
                                <button
                                    onClick={() => { setFaqMode('radar'); setShowFAQ(true); }}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        borderRadius: '10px',
                                        border: '1px solid var(--accent-color)',
                                        background: 'rgba(0, 242, 254, 0.05)',
                                        color: 'var(--accent-color)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginLeft: '0.5rem'
                                    }}
                                >
                                    <span>❓</span> {t.consensus_guide}
                                </button>
                            </div>
                        </div>

                        {/* Radar Filter Bar */}
                        <div className="glass-panel" style={{
                            padding: '1.2rem 2rem',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '16px',
                            border: '1px solid var(--glass-border)',
                            display: 'flex',
                            gap: '2rem',
                            alignItems: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>{t.source_selection}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {RADAR_SOURCES.filter(s => {
                                        if (userProfile?.plan === 'trial') {
                                            return ['forebet', 'predictz', 'statarea'].includes(s.id);
                                        }
                                        return true;
                                    }).map(source => {
                                        const isActive = radarFilters.sources.includes(source.id);
                                        return (
                                            <button
                                                key={source.id}
                                                onClick={(e) => {
                                                    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
                                                    setRadarFilters(prev => {
                                                        if (isMultiSelect) {
                                                            // Toggle logic for multi-select
                                                            return {
                                                                ...prev,
                                                                sources: isActive
                                                                    ? prev.sources.filter(s => s !== source.id)
                                                                    : [...prev.sources, source.id]
                                                            };
                                                        } else {
                                                            // Single-select focus (standard click)
                                                            // If already active and only one, keep it OR if many, focus this one
                                                            return {
                                                                ...prev,
                                                                sources: [source.id]
                                                            };
                                                        }
                                                    });
                                                }}
                                                style={{
                                                    background: isActive ? source.color + '22' : 'rgba(255,255,255,0.03)',
                                                    color: isActive ? source.color : 'rgba(255,255,255,0.3)',
                                                    border: `1px solid ${isActive ? source.color + '66' : 'rgba(255,255,255,0.1)'}`,
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.8rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.5px', marginBottom: '2px' }}>{source.label}</span>
                                                    <span style={{
                                                        fontSize: '0.5rem',
                                                        fontWeight: 700,
                                                        background: 'rgba(255,255,255,0.1)',
                                                        padding: '1px 5px',
                                                        borderRadius: '3px',
                                                        textTransform: 'uppercase',
                                                        opacity: 0.8
                                                    }}>
                                                        {t[source.iq]}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }}></div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>{t.min_sources}</span>
                                <select
                                    value={radarFilters.minSources}
                                    onChange={(e) => setRadarFilters(prev => ({ ...prev, minSources: parseInt(e.target.value) }))}
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '0.4rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        outline: 'none'
                                    }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <option key={n} value={n}>{n}+ Source</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>{t.search_label}</span>
                                <input
                                    type="text"
                                    placeholder={t.search_team}
                                    value={radarFilters.search}
                                    onChange={(e) => setRadarFilters(prev => ({ ...prev, search: e.target.value }))}
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '0.4rem 1rem',
                                        fontSize: '0.75rem',
                                        width: '180px',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setRadarFilters(prev => ({ ...prev, hideFinished: !prev.hideFinished }))}
                                    style={{
                                        background: radarFilters.hideFinished ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                                        color: radarFilters.hideFinished ? 'var(--success-color)' : 'rgba(255,255,255,0.3)',
                                        border: `1px solid ${radarFilters.hideFinished ? 'var(--success-color)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.4rem'
                                    }}
                                    title="Biten maçları gizle / göster"
                                >
                                    <span>⚽</span>
                                    <span>{radarFilters.hideFinished ? (lang === 'tr' ? 'Bitenler Gizli' : 'Finished Hidden') : (lang === 'tr' ? 'Bitenleri Göster' : 'Show Finished')}</span>
                                </button>
                                <button
                                    onClick={() => setRadarFilters(prev => ({ ...prev, sortBy: prev.sortBy === 'CONSENSUS' ? 'TIME' : 'CONSENSUS' }))}
                                    style={{
                                        background: radarFilters.sortBy === 'TIME' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                                        color: radarFilters.sortBy === 'TIME' ? 'var(--accent-color)' : 'rgba(255,255,255,0.3)',
                                        border: `1px solid ${radarFilters.sortBy === 'TIME' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                                    }}
                                >
                                    {radarFilters.sortBy === 'TIME' ? (t.sort_by_time || '🕒 Saate Göre') : (t.sort_by_fit || '🎯 Uyuma Göre')}
                                </button>
                                <button
                                    onClick={() => setRadarFilters(prev => ({ ...prev, valueOnly: !prev.valueOnly }))}
                                    style={{
                                        background: radarFilters.valueOnly ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                                        color: radarFilters.valueOnly ? 'var(--success-color)' : 'rgba(255,255,255,0.3)',
                                        border: `1px solid ${radarFilters.valueOnly ? 'var(--success-color)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                                    }}
                                >{t.value_mode}</button>
                                <button
                                    onClick={() => setRadarFilters(prev => ({ ...prev, hideDivergent: !prev.hideDivergent }))}
                                    style={{
                                        background: radarFilters.hideDivergent ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.03)',
                                        color: radarFilters.hideDivergent ? 'var(--danger-color)' : 'rgba(255,255,255,0.3)',
                                        border: `1px solid ${radarFilters.hideDivergent ? 'var(--danger-color)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                                    }}
                                >{t.safe_mode}</button>
                                <button
                                    onClick={() => setRadarFilters(prev => ({ ...prev, todayOnly: !prev.todayOnly }))}
                                    style={{
                                        background: radarFilters.todayOnly ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255,255,255,0.03)',
                                        color: radarFilters.todayOnly ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                                        border: `1px solid ${radarFilters.todayOnly ? '#a78bfa66' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                                    }}
                                >📅 {radarFilters.todayOnly ? t.today : (lang === 'tr' ? 'Tüm Maçlar (Yarın Dahil)' : 'All (Inc. Tomorrow)')}</button>
                            </div>

                            <button
                                onClick={() => {
                                    const userPlan = userProfile?.plan || 'trial';
                                    const allowedSources = RADAR_SOURCES.filter(s => {
                                        if (userPlan === 'trial') return ['forebet', 'predictz', 'statarea'].includes(s.id);
                                        return true;
                                    }).map(s => s.id);

                                    setRadarFilters({
                                        sources: allowedSources,
                                        minSources: 1,
                                        search: '',
                                        valueOnly: false,
                                        hideDivergent: false,
                                        todayOnly: false,
                                        hideFinished: true,
                                        sortBy: 'TIME'
                                    });
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--accent-color)',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    marginTop: '1.2rem',
                                    opacity: 0.7
                                }}
                            >
                                {t.clear_filters}
                            </button>
                        </div>
                    </div>

                    {renderGlobalAISection('PRE-MATCH')}

                    <div className="radar-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                        gap: '2rem'
                    }}>
                        {filteredRadarMatches.length > 0 ? (
                            filteredRadarMatches.map(s => {
                                const maxAgreement = Math.max(...Object.values(s.agreement));
                                const agreementPercent = (maxAgreement / s.totalSources) * 100;
                                const consensusPred = Object.entries(s.agreement).find(([p, c]) => c === maxAgreement)?.[0];

                                return (
                                    <div
                                        key={s.match}
                                        className="radar-card glass-panel"
                                        onClick={() => s.forebetUrl && window.open(s.forebetUrl, '_blank')}
                                        style={{
                                            padding: '2rem',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            border: s.totalSources >= 6 ? '2px solid var(--accent-color)' : '1px solid var(--glass-border)',
                                            boxShadow: s.totalSources >= 7
                                                ? '0 10px 30px rgba(0, 242, 254, 0.2), 0 0 15px rgba(0, 242, 254, 0.1)'
                                                : (s.totalSources >= 6 ? '0 5px 20px rgba(0, 242, 254, 0.1)' : 'none'),
                                            background: 'rgba(15, 23, 42, 0.4)',
                                            cursor: s.forebetUrl ? 'pointer' : 'default',
                                            opacity: s.isFinished ? 0.45 : 1,
                                            filter: s.isFinished ? 'grayscale(60%)' : 'none'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (s.forebetUrl) {
                                                e.currentTarget.style.transform = 'translateY(-5px)';
                                                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(16, 185, 129, 0.1)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'none';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        {/* Consensus Badges */}
                                        {s.totalSources === 8 && Math.max(...Object.values(s.agreement)) === 8 ? (
                                            <div style={{
                                                position: 'absolute', top: 0, right: 0,
                                                background: 'var(--accent-color)', color: '#000',
                                                padding: '0.4rem 1.2rem', fontSize: '0.7rem', fontWeight: 900,
                                                borderBottomLeftRadius: '12px', letterSpacing: '1px', zIndex: 10,
                                                boxShadow: '0 0 15px var(--accent-color)'
                                            }}>
                                                🔥 {t.full_consensus_label || '8/8 FULL CONSENSUS'}
                                            </div>
                                        ) : s.totalSources >= 4 && agreementPercent >= 75 ? (
                                            <div style={{
                                                position: 'absolute', top: 0, right: 0,
                                                background: 'var(--success-color)', color: '#000',
                                                padding: '0.3rem 1rem', fontSize: '0.65rem', fontWeight: 900,
                                                borderBottomLeftRadius: '12px', letterSpacing: '1px', zIndex: 10
                                            }}>
                                                {t.high_consensus_label || 'HIGH AGREEMENT'}
                                            </div>
                                        ) : null}

                                        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '0.5rem', zIndex: 10, alignItems: 'center' }}>
                                            {s.isValue && (
                                                <div title="High Edge Detection" style={{ background: 'var(--accent-color)', color: '#000', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>VALUE</div>
                                            )}
                                            {s.isLive && (
                                                <div title="Canlı Oynanıyor" style={{ background: '#ef4444', color: '#fff', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}>🔴 CANLI</div>
                                            )}
                                            {s.isUpcoming && s.minutesUntilKickoff > 0 && s.minutesUntilKickoff <= 120 && (
                                                <div title="Başlamak Üzere" style={{ background: '#f59e0b', color: '#000', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>⏳ {s.minutesUntilKickoff} DK</div>
                                            )}
                                            {s.isFinished && (
                                                <div title="Maç Sona Erdi" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>🏁 BİTTİ</div>
                                            )}
                                            {s.divergence > CONFIG.MODULAR_SYSTEM.ADVANCED_ANALYSIS.DIVERGENCE_RADAR.THRESHOLD && (
                                                <div title="Conflicting Source Predictions" style={{ background: 'var(--danger-color)', color: '#fff', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>DİKKAT</div>
                                            )}
                                        </div>

                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedLeagues(prev => ({ ...prev, [s.match]: !prev[s.match] }));
                                                    }}
                                                    style={{
                                                        fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase',
                                                        letterSpacing: '1px', color: 'var(--accent-color)', fontWeight: 800,
                                                        cursor: s.league?.length > 60 ? 'pointer' : 'default',
                                                        overflow: 'hidden',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: expandedLeagues[s.match] ? 'unset' : 3,
                                                        WebkitBoxOrient: 'vertical',
                                                        lineHeight: '1.2'
                                                    }}
                                                    title={s.league?.length > 60 ? 'Tamamını görmek için tıkla' : ''}
                                                >
                                                    {s.league && s.league !== 'Others' && s.league !== 'Unknown' ? s.league : (t.match_overview || 'MAÇ ÖZETİ')}
                                                </div>
                                                {s.date && (
                                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-color)', display: 'flex', gap: '0.5rem' }}>
                                                        <span>🗓️ {s.date}</span>
                                                        {s.time && <span style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}>🕒 {s.time}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                                {s.home} <span style={{ opacity: 0.3, fontWeight: 400 }}>vs</span> {s.away}
                                            </div>
                                            {s.forebetUrl && (
                                                <div style={{ fontSize: '0.6rem', color: 'var(--accent-color)', marginTop: '0.4rem', fontWeight: 700 }}>🔗 ANALİZ İÇİN TIKLA</div>
                                            )}
                                        </div>

                                        <div style={{ marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{t.global_consensus_report} ({s.totalSources}/{RADAR_SOURCES.length} {t.active_badges || 'Kaynak'})</div>
                                                {agreementPercent < 60 && s.totalSources >= 2 && (
                                                    <div style={{ fontSize: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                        ⚠️ {t.divergence_flag || 'DIVERGENCE'}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                                {Object.entries(s.predictions).map(([site, pred]) => {
                                                    const sourceConfig = RADAR_SOURCES.find(rs => rs.id === site);
                                                    const color = sourceConfig ? sourceConfig.color : '#94a3b8';
                                                    const url = RADAR_BASE_URLS[site];

                                                    return (
                                                        <div
                                                            key={site}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (url) window.open(url, '_blank');
                                                            }}
                                                            title={url ? `${sourceConfig?.label || site} sitesine git` : ''}
                                                            style={{
                                                                padding: '0.8rem',
                                                                background: 'rgba(255,255,255,0.02)',
                                                                borderRadius: '10px',
                                                                border: `1px solid ${color}33`,
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                cursor: url ? 'pointer' : 'default',
                                                                transition: 'transform 0.2s, background 0.2s'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                {url && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔗</span>}
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: color, textTransform: 'uppercase' }}>{site}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>{pred}</span>
                                                                    {s.odds?.[site] && (
                                                                        <span style={{ fontSize: '0.7rem', color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '4px', fontWeight: 900 }}>
                                                                            @{s.odds[site]}
                                                                        </span>
                                                                    )}
                                                                    {s.probabilities?.[site] && (
                                                                        <span style={{ fontSize: '0.65rem', color: color, opacity: 0.8, fontWeight: 700 }}>
                                                                            (%{s.probabilities[site]})
                                                                        </span>
                                                                    )}
                                                                    {s.tipCounts?.[site] && (
                                                                        <span style={{ fontSize: '0.6rem', color: color, opacity: 0.6, fontWeight: 800 }}>
                                                                            ({s.tipCounts[site]})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {s.scorePredictions?.[site] && (
                                                                    <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.7, color: 'var(--accent-color)' }}>
                                                                        {s.scorePredictions[site]}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Dual Team Form */}
                                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '5px' }}>EV FORMU</div>
                                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                                        {s.form?.home?.length > 0 ? (
                                                            <>
                                                                {s.form.home.slice(0, 5).map((f, i) => (
                                                                    <span key={i} style={{
                                                                        width: '14px', height: '14px', borderRadius: '3px',
                                                                        background: f === 'W' ? 'var(--success-color)' : f === 'D' ? 'var(--warning-color)' : 'var(--danger-color)',
                                                                        fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900
                                                                    }}>{f}</span>
                                                                ))}
                                                            </>
                                                        ) : <span style={{ fontSize: '0.55rem', opacity: 0.2 }}>Veri Yok</span>}
                                                    </div>
                                                    <div style={{ marginTop: '5px', fontSize: '0.55rem', opacity: 0.3, fontWeight: 700 }}>
                                                        SIRA: {s.ranks?.home || '-'} | PUAN: {s.points?.home || '-'}
                                                    </div>
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '5px' }}>DEP FORMU</div>
                                                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                        {s.form?.away?.length > 0 ? (
                                                            <>
                                                                {s.form.away.slice(0, 5).map((f, i) => (
                                                                    <span key={i} style={{
                                                                        width: '14px', height: '14px', borderRadius: '3px',
                                                                        background: f === 'W' ? 'var(--success-color)' : f === 'D' ? 'var(--warning-color)' : 'var(--danger-color)',
                                                                        fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900
                                                                    }}>{f}</span>
                                                                ))}
                                                            </>
                                                        ) : <span style={{ fontSize: '0.55rem', opacity: 0.2 }}>Veri Yok</span>}
                                                    </div>
                                                    <div style={{ marginTop: '5px', fontSize: '0.55rem', opacity: 0.3, fontWeight: 700 }}>
                                                        SIRA: {s.ranks?.away || '-'} | PUAN: {s.points?.away || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.2rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>{t.consensus_agreement || 'ORTAK AKIL SKORU'}</div>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--success-color)' }}>%{agreementPercent.toFixed(0)}</div>
                                            </div>
                                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${agreementPercent}%`,
                                                    height: '100%',
                                                    background: `linear-gradient(to right, ${agreementPercent > 60 ? 'var(--success-color)' : 'var(--warning-color)'}, #fff)`,
                                                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                                                }}></div>
                                            </div>
                                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{t.consensus_verdict || 'AĞIRLIKLI TAHMİN'}:</span>
                                                <span style={{ marginLeft: '0.5rem', fontWeight: 900, fontSize: '1.2rem', color: 'var(--accent-color)' }}>{consensusPred}</span>
                                            </div>

                                            <button
                                                onClick={(e) => handleSendRadarToTelegram(e, s, consensusPred, agreementPercent)}
                                                style={{
                                                    width: '100%',
                                                    marginTop: '0.9rem',
                                                    padding: '0.65rem 1rem',
                                                    background: 'linear-gradient(135deg, #229ED9 0%, #1778F2 100%)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '10px',
                                                    color: '#fff',
                                                    fontWeight: 800,
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    boxShadow: '0 4px 12px rgba(34, 158, 217, 0.25)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 158, 217, 0.4)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 158, 217, 0.25)';
                                                }}
                                            >
                                                <span>✈️</span> {lang === 'tr' ? "Telegram VIP'ye Gönder" : "Broadcast to Telegram VIP"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ gridColumn: '1 / -1', padding: '10rem 2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--glass-border)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, opacity: 0.5 }}>{t.waiting_for_sources || 'Dış kaynak verileri senkronize ediliyor...'}</div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (

                <>
                    {/* Bankroll Strategy Panel (Phase 13) */}
                    <div className="bankroll-binding-panel bankroll-ledger-container">
                        <div className="glass-panel" style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', color: 'var(--accent-color)' }}>{t.bankroll_panel}</h3>
                                <div className="engine-status-area" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.6 }}>{t.active_mod}: {bankrollManager.getModeLabel(lang)}</span>
                                    {bankState.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.NO_BET ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', animation: 'pulse 2s infinite' }}>
                                            <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1px' }}>{t.no_bet} (STOP)</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                                            <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1px' }}>{t.active}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="metrics-grid">
                                <div className="br-metric">
                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{t.current_balance}</span>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{bankState.current_balance.toLocaleString()} ₺</div>
                                </div>
                                <div className="br-metric">
                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{t.daily_pl}</span>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: bankState.daily_pl >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                        {bankState.daily_pl > 0 ? '+' : ''}{bankState.daily_pl.toLocaleString()} ₺
                                    </div>
                                </div>
                                <div className="br-metric">
                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{t.active_mode}</span>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                        {bankrollManager.getModeLabel(lang)}
                                        {bankState.current_mode === CONFIG.BANKROLL.HIERARCHY.MODES.NO_BET && (
                                            <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--danger-color)', fontWeight: 800 }}>
                                                {bankState.daily_pl / CONFIG.BANKROLL.HIERARCHY.INITIAL_BALANCE >= 0.05 ? t.daily_target_reached :
                                                    bankState.daily_pl / CONFIG.BANKROLL.HIERARCHY.INITIAL_BALANCE <= -0.03 ? t.daily_stoploss_reached : t.bankroll_stop}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.75rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                                <span style={{ marginRight: '0.5rem' }}>⚠️</span> {t.local_storage_warning}
                            </div>
                        </div>

                        {/* Mini Ledger */}
                        <div className="glass-panel ledger-view" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)', maxHeight: '250px', overflowY: 'auto' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.6, letterSpacing: '1px' }}>{t.ledger_title}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.86rem' }}>
                                {bankState.ledger.slice(-10).reverse().map(entry => (
                                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
                                        <div style={{ flexGrow: 1 }}>
                                            <span style={{
                                                color: entry.type.includes('WIN') ? 'var(--success-color)' : entry.type.includes('LOSS') ? 'var(--danger-color)' : 'var(--accent-color)',
                                                fontWeight: 800,
                                                marginRight: '0.8rem'
                                            }}>{t[`${entry.type.toLowerCase().replace('bet_', '').replace('system_', '')}_short`] || entry.type}</span>
                                            <span style={{ opacity: 0.8 }}>{entry.match_name || t[entry.reason] || entry.reason || t.system_event}</span>

                                            {entry.type === 'BET_OPEN' && (
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    <button
                                                        onClick={() => { bankrollManager.processResult(entry.match_id, true, entry.stake_amount); setBankState(bankrollManager.getState()); }}
                                                        style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success-color)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '4px', fontSize: '0.6rem', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 800 }}
                                                    >{t.win_btn}</button>
                                                    <button
                                                        onClick={() => { bankrollManager.processResult(entry.match_id, false, entry.stake_amount); setBankState(bankrollManager.getState()); }}
                                                        style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', fontSize: '0.6rem', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 800 }}
                                                    >{t.loss_btn}</button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontWeight: 700, textAlign: 'right', minWidth: '60px' }}>
                                            {entry.profit ? (entry.profit > 0 ? `+${entry.profit}` : entry.profit) : (entry.stake_amount ? `-${entry.stake_amount}` : '')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Health Monitor */}
                    <div className="glass-panel health-monitor" style={{ marginBottom: '3rem', padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3rem' }}>
                            <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(16, 185, 129, 0.05)', padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div className="pulse" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success-color)', boxShadow: '0 0 10px var(--success-color)' }}></div>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t.system_status}: {t.active}</span>
                            </div>

                            <div className="health-metrics-grid">
                                <div className="metric">
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '1px' }}>{t.last_update}</div>
                                    <div className={lastFetchSeconds > 15 ? 'danger' : 'success'} style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.3rem' }}>
                                        {lastFetchSeconds} <span style={{ fontSize: '0.8rem' }}>{t.seconds_ago}</span>
                                    </div>
                                </div>
                                <div className="metric">
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '1px' }}>{t.live_matches}</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.3rem' }}>{healthStats.totalDiscovered || matches.length}</div>
                                </div>
                                <div className="metric">
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '1px' }}>{t.dqs_filter}</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.3rem' }}>
                                        <span style={{ color: 'var(--success-color)' }}>{healthStats.dqsAbove}</span> <span style={{ opacity: 0.3 }}>/</span> <span style={{ opacity: 0.5 }}>{healthStats.dqsBelow}</span>
                                    </div>
                                </div>
                                <div className="metric">
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '1px' }}>{t.security_nobet}</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.3rem', color: healthStats.noBetCount > 0 ? 'var(--warning-color)' : 'inherit' }}>
                                        {healthStats.noBetCount} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{t.triggered}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="engine-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <select
                                    value={decisionMode}
                                    onChange={(e) => { dataWorker.decisionMode = e.target.value; setDecisionMode(e.target.value); }}
                                    style={{ background: 'rgba(15, 23, 42, 0.9)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', borderRadius: '10px', padding: '0.6rem 1.2rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', outline: 'none' }}
                                >
                                    <option value={CONFIG.DECISION.MODES.CORE_DQS}>{t.mode_core_label}</option>
                                    <option value={CONFIG.DECISION.MODES.DQS_RISK}>{t.mode_risk_label}</option>
                                    <option value={CONFIG.DECISION.MODES.FULL_STACK}>{t.mode_full_label}</option>
                                </select>
                                <div style={{ textAlign: 'right', fontSize: '0.7rem', paddingRight: '0.5rem' }}>
                                    <span style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{dataWorker.dataSource}</span>
                                    <span style={{ opacity: 0.4, marginLeft: '0.5rem' }}>{t.settings_frozen}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tier Filter Bar */}
                    <div className="tier-filter-bar" style={{ display: 'flex', gap: '0.6rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        {['ALL', 1, 2, 3].map(tier => {
                            const count = tier === 'ALL' ? matches.length : matches.filter(m => m.tier === tier).length;
                            return (
                                <button
                                    key={tier}
                                    onClick={() => setActiveTierFilter(tier)}
                                    style={{
                                        background: activeTierFilter === tier ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                                        color: activeTierFilter === tier ? '#000' : 'var(--text-secondary)',
                                        border: '1px solid ' + (activeTierFilter === tier ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'),
                                        borderRadius: '10px',
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        boxShadow: activeTierFilter === tier ? '0 0 15px var(--accent-glow)' : 'none',
                                    }}
                                >
                                    <span>{tier === 'ALL' ? (t.tier_filter_all || 'TÜM LİGLER') : (t[`tier_${tier}_label`] || `TIER ${tier}`)}</span>
                                    <span style={{
                                        background: activeTierFilter === tier ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.1)',
                                        padding: '1px 6px',
                                        borderRadius: '6px',
                                        fontSize: '0.65rem'
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>



                    {/* Live Opportunities Panel - Sıcak Fırsatlar & Canlı Radar */}
                    {(() => {
                        const oppMatches = matches.filter(filterByTier);
                        const allOpportunities = liveOpportunityScorer.getOpportunities(oppMatches, signals, momentumWindow);
                        const goldenCombo = betBuilderEngine.generateGoldenCombo(allOpportunities, oppMatches);

                        // Apply limit to TOTAL opportunities first
                        const limitedOpportunities = liveOpportunitiesLimit === 'ALL'
                            ? allOpportunities
                            : allOpportunities.slice(0, liveOpportunitiesLimit);

                        // Then split into ready/pending
                        const readyOpportunities = allOpportunities.filter(o => o.isStatsReady);
                        const pendingOpportunities = allOpportunities.filter(o => !o.isStatsReady);

                        const topReady = limitedOpportunities.filter(o => o.isStatsReady);
                        const topPending = limitedOpportunities.filter(o => !o.isStatsReady);

                        const heatColors = {
                            ALPHA: { bg: 'rgba(56, 189, 248, 0.2)', border: 'var(--accent-color)', text: 'var(--accent-color)', icon: '🚀' },
                            ALEV: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#ef4444', icon: '🔥' },
                            SICAK: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', text: '#fbbf24', icon: '⚡' },
                            SOGUK: { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8', icon: '❄️' }
                        };

                        const renderOppCard = (opp, idx, isCompact = false) => {
                            const match = matches.find(m => m.id === opp.matchId);
                            if (!match) return null;
                            const heatStyle = heatColors[opp.heatLevel] || heatColors.SOGUK;
                            const isTop = idx === 0 && opp.heatLevel === 'ALEV' && !isCompact;

                            return (
                                <div
                                    key={opp.matchId}
                                    onClick={() => setSelectedMatch(match)}
                                    style={{
                                        padding: isCompact ? '0.8rem 1rem' : '1.2rem',
                                        background: isCompact ? 'rgba(15, 23, 42, 0.3)' : heatStyle.bg,
                                        border: `1px solid ${isCompact ? 'rgba(255,255,255,0.05)' : heatStyle.border}`,
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        opacity: isCompact ? 0.7 : 1,
                                        animation: isTop ? 'pulse 2s infinite' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'center' : 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? '0.5rem' : '0.8rem', marginBottom: isCompact ? '0' : '0.5rem' }}>
                                                {/* Ranking Badge - shows for both compact and non-compact */}
                                                <div style={{
                                                    fontSize: isCompact ? '0.6rem' : '0.7rem',
                                                    fontWeight: 900,
                                                    color: '#000',
                                                    background: heatStyle.text,
                                                    minWidth: isCompact ? '20px' : '24px',
                                                    height: isCompact ? '20px' : '24px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: isCompact ? '5px' : '6px',
                                                    flexShrink: 0,
                                                    boxShadow: isCompact ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                                                }}>
                                                    #{idx + 1}
                                                </div>
                                                {(match.league || match.leagueName) && (
                                                    <span style={{
                                                        fontSize: '0.6rem',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        border: '1px solid rgba(255, 255, 255, 0.14)',
                                                        color: '#cbd5e1',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {match.league || match.leagueName}
                                                    </span>
                                                )}
                                                <span style={{ fontWeight: 800, fontSize: isCompact ? '0.85rem' : '1rem', color: isCompact ? '#e2e8f0' : heatStyle.text, display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                    <span>{match.homeTeam}</span>
                                                    {((match.cards?.home?.red || 0) > 0 || (match.stats?.cards?.home?.red || 0) > 0) && (
                                                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 900, lineHeight: '1.2', display: 'inline-flex', alignItems: 'center', gap: '2px', verticalAlign: 'middle' }}>
                                                            🟥 {(match.cards?.home?.red || match.stats?.cards?.home?.red)}
                                                        </span>
                                                    )}
                                                    <span style={{ opacity: 0.35, margin: '0 3px' }}>vs</span>
                                                    <span>{match.awayTeam}</span>
                                                    {((match.cards?.away?.red || 0) > 0 || (match.stats?.cards?.away?.red || 0) > 0) && (
                                                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 900, lineHeight: '1.2', display: 'inline-flex', alignItems: 'center', gap: '2px', verticalAlign: 'middle' }}>
                                                            🟥 {(match.cards?.away?.red || match.stats?.cards?.away?.red)}
                                                        </span>
                                                    )}
                                                </span>
                                                {opp.valueDetected && (
                                                    <span style={{
                                                        background: 'linear-gradient(135deg, #10b981, #34d399)',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.5rem',
                                                        fontWeight: 900,
                                                        color: '#000'
                                                    }}>💰 VALUE</span>
                                                )}
                                                {opp.smartMoney?.active && (
                                                    <span style={{
                                                        background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.5rem',
                                                        fontWeight: 900,
                                                        color: '#fff',
                                                        marginLeft: '4px'
                                                    }}>📉 SMART MONEY (-%{opp.smartMoney.dropPct.toFixed(0)})</span>
                                                )}
                                                {opp.isTrap && (
                                                    <span style={{
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        border: '1px solid #ef4444',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.5rem',
                                                        fontWeight: 900,
                                                        color: '#ef4444',
                                                        marginLeft: '4px'
                                                    }}>⚠️ TUZAK ORAN</span>
                                                )}
                                                {opp.hasValueEV && opp.bestEV && (
                                                    <span style={{
                                                        background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.5rem',
                                                        fontWeight: 900,
                                                        color: '#fff',
                                                        marginLeft: '4px',
                                                        boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)'
                                                    }}>💎 +EV %{opp.bestEV.ev} ({opp.bestEV.label})</span>
                                                )}
                                                {opp.hasLatencyEdge && opp.latencyEdge && (
                                                    <span style={{
                                                        background: 'linear-gradient(135deg, #eab308, #f97316)',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.5rem',
                                                        fontWeight: 900,
                                                        color: '#000',
                                                        marginLeft: '4px',
                                                        boxShadow: '0 0 10px rgba(234, 179, 8, 0.6)'
                                                    }}>⚡ GECİKME (+%{opp.latencyEdge.discrepancyPct})</span>
                                                )}
                                                {opp.cashOutWarning && (
                                                    <span style={{
                                                        background: 'linear-gradient(135deg, #ef4444, #991b1b)',
                                                        padding: '0.1rem 0.45rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.5rem',
                                                        fontWeight: 900,
                                                        color: '#fff',
                                                        marginLeft: '4px',
                                                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)',
                                                        animation: 'pulse 1.5s infinite'
                                                    }} title={opp.cashOutWarning.reason}>🛡️ CASHOUT ÖNERİSİ</span>
                                                )}
                                            </div>

                                            {!isCompact && (
                                                <>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span>{renderMatchMinute(match.minute, t, false)} • <span style={{ fontWeight: 800, color: 'var(--accent-color)' }}>{match.score?.home ?? 0} - {match.score?.away ?? 0}</span></span>
                                                        {opp.isHalftime && (
                                                            <span style={{
                                                                background: 'rgba(245, 158, 11, 0.15)',
                                                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                                                color: '#fbbf24',
                                                                fontSize: '0.6rem',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                fontWeight: 800
                                                            }}>☕ 2. YARI DEĞERİ</span>
                                                        )}
                                                        {match.stats?.xg && (
                                                            <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>
                                                                xG: {(Number(match.stats?.xg?.home) || 0).toFixed(1)}-{(Number(match.stats?.xg?.away) || 0).toFixed(1)}
                                                            </span>
                                                        )}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                                            {opp.trend === 'UP' ? <span style={{ color: '#10b981' }}>⬆️</span> : opp.trend === 'DOWN' ? <span style={{ color: '#ef4444' }}>⬇️</span> : <span style={{ opacity: 0.5 }}>➡️</span>}
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>%{opp.trendDelta > 0 ? '+' : ''}{opp.trendDelta}</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.6rem', opacity: 0.4 }}>({momentumWindow}dk)</span>
                                                    </div>

                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '0.8rem',
                                                        alignItems: 'center',
                                                        marginBottom: '0.6rem',
                                                        padding: '0.4rem 0.6rem',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        borderRadius: '8px'
                                                    }}>
                                                        <div style={{ flex: 1 }}>
                                                            {(() => {
                                                                const daHome = match.stats?.dangerousAttacks?.home || 0;
                                                                const daAway = match.stats?.dangerousAttacks?.away || 0;
                                                                const total = daHome + daAway || 1;
                                                                const homePercent = Math.round((daHome / total) * 100);
                                                                return (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                        <span style={{ fontSize: '0.55rem', fontWeight: 700 }}>{homePercent}%</span>
                                                                        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                                                                            <div style={{ width: `${homePercent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                                                                        </div>
                                                                        <span style={{ fontSize: '0.55rem', fontWeight: 700 }}>{100 - homePercent}%</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.55rem', fontWeight: 700 }}>
                                                            <span style={{ color: 'var(--accent-color)' }}>🎯 {match.stats?.shotsOnGoal?.home || 0}-{match.stats?.shotsOnGoal?.away || 0}</span>
                                                            <span style={{ color: '#fbbf24' }}>⚔️ {match.stats?.dangerousAttacks?.home || 0}-{match.stats?.dangerousAttacks?.away || 0}</span>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                        {(() => {
                                                            const odds = (match.matchedOdds && match.matchedOdds.home) ? match.matchedOdds : opp.oddsInfo;
                                                            if (!odds) return null;
                                                            return (
                                                                <div style={{
                                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                                    background: 'rgba(16, 185, 129, 0.08)',
                                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                                    padding: '0.3rem 0.6rem',
                                                                    borderRadius: '8px'
                                                                }}>
                                                                    <span style={{ fontSize: '0.55rem', opacity: 0.6, fontWeight: 600 }}>1X2</span>
                                                                    <span style={{
                                                                        fontSize: '0.7rem', fontWeight: 900,
                                                                        color: '#10b981',
                                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                                        padding: '0.1rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        minWidth: '32px',
                                                                        textAlign: 'center'
                                                                    }}>{odds.home}</span>
                                                                    <span style={{
                                                                        fontSize: '0.7rem', fontWeight: 900,
                                                                        color: '#94a3b8',
                                                                        background: 'rgba(148, 163, 184, 0.1)',
                                                                        padding: '0.1rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        minWidth: '32px',
                                                                        textAlign: 'center'
                                                                    }}>{odds.draw || '-'}</span>
                                                                    <span style={{
                                                                        fontSize: '0.7rem', fontWeight: 900,
                                                                        color: '#ef4444',
                                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                                        padding: '0.1rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        minWidth: '32px',
                                                                        textAlign: 'center'
                                                                    }}>{odds.away}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                        {opp.suggestedMarket?.marketKey && (
                                                            <div style={{ 
                                                                marginTop: '0.4rem',
                                                                padding: '0.5rem 0.8rem',
                                                                background: 'rgba(251, 191, 36, 0.1)',
                                                                border: '1px solid rgba(251, 191, 36, 0.2)',
                                                                borderRadius: '8px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.6rem'
                                                            }}>
                                                                <span style={{ fontSize: '0.75rem' }}>💡</span>
                                                                <div>
                                                                    <div style={{ fontSize: '0.55rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                                        {opp.isHalftime ? (lang === 'tr' ? '2. YARI TAHMİNİ' : '2ND HALF PREDICTION') : (lang === 'tr' ? 'SİSTEM TAHMİNİ' : 'SYSTEM PREDICTION')}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fbbf24' }}>
                                                                        {(t[opp.suggestedMarket.marketKey] || opp.suggestedMarket.label || opp.suggestedMarket.marketKey)
                                                                            .replace('{team}', opp.suggestedMarket.team || '')
                                                                            .replace('{goals}', opp.suggestedMarket.target || `${((match.score?.home ?? 0) + (match.score?.away ?? 0)) + 0.5}`)}
                                                                        {opp.suggestedMarket.confidence && (
                                                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', opacity: 0.7 }}>
                                                                                %{opp.suggestedMarket.confidence}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {isCompact && (
                                                <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '0.2rem' }}>
                                                    {renderMatchMinute(match.minute, t, false)} • {match.score?.home ?? 0} - {match.score?.away ?? 0} • Veri Bekleniyor...
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: isCompact ? '1.2rem' : '1.8rem', fontWeight: 900, color: heatStyle.text }}>
                                                {opp.score}
                                            </div>
                                            {!isCompact && <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{opp.heatLevel}</div>}
                                            
                                            {/* Manual Telegram Button */}
                                            <button 
                                                onClick={(e) => handleSendToTelegram(e, match, opp)}
                                                style={{
                                                    marginTop: '0.8rem',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: '#24A1DE', // Telegram Blue
                                                    border: 'none',
                                                    color: '#fff',
                                                    fontSize: '1rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 2px 8px rgba(36, 161, 222, 0.4)',
                                                    transition: 'transform 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                title="VIP Gruba Gönder"
                                            >
                                                ✈️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <section className="live-opportunities-section" style={{ marginBottom: '4rem' }}>
                                <div className="glass-panel" style={{
                                    padding: '2rem',
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, rgba(15, 23, 42, 0.4) 100%)',
                                    border: '1px solid rgba(239, 68, 68, 0.15)',
                                    borderRadius: '20px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <h3 style={{
                                                fontSize: '1.3rem',
                                                fontWeight: 900,
                                                letterSpacing: '-0.5px',
                                                background: 'linear-gradient(to right, #ef4444, #fbbf24)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.8rem'
                                            }}>
                                                🔥 {lang === 'tr' ? 'SICAK FIRSATLAR & CANLI RADAR' : 'HOT OPPORTUNITIES & LIVE RADAR'}
                                            </h3>
                                            
                                            {/* Momentum Window Selector */}
                                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                {[5, 10, 20].map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={(e) => { e.stopPropagation(); setMomentumWindow(m); }}
                                                        style={{
                                                            background: momentumWindow === m ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
                                                            color: momentumWindow === m ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                                                            border: 'none',
                                                            padding: '0.4rem 0.8rem',
                                                            borderRadius: '8px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 900,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            minWidth: '50px'
                                                        }}
                                                    >
                                                        {m}D
                                                        <span style={{ fontSize: '0.5rem', opacity: momentumWindow === m ? 0.7 : 0.3 }}>{lang === 'tr' ? 'İVME' : 'TREND'}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                {[5, 10, 'ALL'].map(limit => (
                                                    <button
                                                        key={limit}
                                                        onClick={(e) => { e.stopPropagation(); setLiveOpportunitiesLimit(limit); }}
                                                        style={{
                                                            background: liveOpportunitiesLimit === limit ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                                                            padding: '0.3rem 0.8rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 800,
                                                            color: liveOpportunitiesLimit === limit ? '#ef4444' : 'var(--text-secondary)',
                                                            border: `1px solid ${liveOpportunitiesLimit === limit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                        {limit === 'ALL' ? (lang === 'tr' ? 'TÜMÜ' : 'ALL') : `TOP ${limit}`}
                                                    </button>
                                                ))}
                                                {/* Sadece Hazır Toggle */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setHidePendingOpportunities(!hidePendingOpportunities); }}
                                                    style={{
                                                        background: hidePendingOpportunities ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                        padding: '0.3rem 0.8rem',
                                                        borderRadius: '20px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 800,
                                                        color: hidePendingOpportunities ? '#10b981' : 'var(--text-secondary)',
                                                        border: `1px solid ${hidePendingOpportunities ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        marginLeft: '0.5rem'
                                                    }}>
                                                    {lang === 'tr' ? '✓ HAZIR' : '✓ READY'}
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {allOpportunities.length} {lang === 'tr' ? 'fırsat' : 'opportunities'}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>
                                                🟢 {readyOpportunities.length} {lang === 'tr' ? 'hazır' : 'ready'} • ⏳ {pendingOpportunities.length} {lang === 'tr' ? 'bekliyor' : 'pending'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* GOLDEN DOUBLE COMBO WIDGET (CANLI KUPON SİHİRBAZI) */}
                                    {goldenCombo && (
                                        <div style={{
                                            marginBottom: '2.5rem',
                                            padding: '1.5rem',
                                            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(249, 115, 22, 0.08) 50%, rgba(15, 23, 42, 0.7) 100%)',
                                            border: '1.5px solid rgba(234, 179, 8, 0.4)',
                                            borderRadius: '16px',
                                            boxShadow: '0 10px 30px -5px rgba(234, 179, 8, 0.25)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                    <span style={{ fontSize: '1.8rem' }}>🎟️</span>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#fbbf24', letterSpacing: '0.5px' }}>
                                                                {lang === 'tr' ? 'GÜNÜN CANLI ALTIN İKİLİSİ' : 'LIVE GOLDEN DOUBLE'}
                                                            </span>
                                                            <span style={{
                                                                background: 'rgba(234, 179, 8, 0.2)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                                                borderRadius: '6px',
                                                                padding: '2px 8px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 900
                                                            }}>KUPON SİHİRBAZI v4.0</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '2px' }}>
                                                            {lang === 'tr' ? 'Sistemdeki en yüksek olasılığa ve korelasyona sahip 2 canlı fırsatın kurumsal kombinasyonu' : 'Algorithmic 2-leg combo combining the highest conviction opportunities'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', fontWeight: 800 }}>
                                                            {lang === 'tr' ? 'SİSTEM GÜVENİ' : 'CONVICTION'}
                                                        </div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                                                            %{goldenCombo.averageConfidence}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        background: 'linear-gradient(135deg, #eab308, #f97316)',
                                                        color: '#000',
                                                        padding: '0.6rem 1.2rem',
                                                        borderRadius: '12px',
                                                        fontWeight: 900,
                                                        fontSize: '1.3rem',
                                                        boxShadow: '0 4px 15px rgba(234, 179, 8, 0.4)',
                                                        textAlign: 'center'
                                                    }}>
                                                        <span style={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', opacity: 0.85, fontWeight: 900 }}>
                                                            {lang === 'tr' ? 'TOPLAM ORAN' : 'TOTAL ODDS'}
                                                        </span>
                                                        {goldenCombo.totalOdds}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2 Picks Grid */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
                                                {goldenCombo.picks.map((pick, pIdx) => (
                                                    <div key={pIdx} style={{
                                                        background: 'rgba(0,0,0,0.35)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: '12px',
                                                        padding: '1rem 1.2rem',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                                                {pick.matchTitle}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '2px' }}>
                                                                {renderMatchMinute(pick.minute, t, false)} • Skor: {pick.score} • {pick.league}
                                                            </div>
                                                            <div style={{ marginTop: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#fbbf24' }}>
                                                                🎯 {pick.market}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{
                                                                background: 'rgba(56, 189, 248, 0.15)',
                                                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                fontSize: '1rem',
                                                                fontWeight: 900,
                                                                color: '#38bdf8'
                                                            }}>
                                                                {pick.odds}
                                                            </div>
                                                            <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, marginTop: '4px' }}>
                                                                %{pick.confidence} Güven
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 1: READY OPPORTUNITIES */}
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            marginBottom: '1rem',
                                            padding: '0.4rem 0.8rem',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            borderRadius: '8px',
                                            width: 'fit-content',
                                            border: '1px solid rgba(16, 185, 129, 0.2)'
                                        }}>
                                            <span style={{ fontSize: '0.8rem' }}>🟢</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10b981', letterSpacing: '0.5px' }}>
                                                {lang === 'tr' ? 'CANLI ANALİZ HAZIR' : 'LIVE ANALYSIS READY'}
                                            </span>
                                        </div>

                                        {topReady.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {topReady.map((opp, idx) => renderOppCard(opp, idx, false))}
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: '2rem',
                                                textAlign: 'center',
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: '16px',
                                                fontSize: '0.85rem',
                                                opacity: 0.5
                                            }}>
                                                {lang === 'tr' ? 'Şu an tam analiz bekleyen canlı maç bulunmuyor.' : 'No live matches ready for full analysis yet.'}
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 2: PENDING STATS */}
                                    {topPending.length > 0 && !hidePendingOpportunities && (
                                        <div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.6rem',
                                                marginBottom: '1rem',
                                                padding: '0.4rem 0.8rem',
                                                background: 'rgba(148, 163, 184, 0.1)',
                                                borderRadius: '8px',
                                                width: 'fit-content',
                                                border: '1px solid rgba(148, 163, 184, 0.2)'
                                            }}>
                                                <span style={{ fontSize: '0.8rem' }}>⏳</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.5px' }}>
                                                    {lang === 'tr' ? 'CANLI VERİ BEKLENİYOR (RADAR AKTİF)' : 'WAITING FOR LIVE DATA (RADAR ACTIVE)'}
                                                </span>
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                                gap: '0.8rem',
                                                maxHeight: liveOpportunitiesLimit === 'ALL' ? '600px' : 'none',
                                                overflowY: liveOpportunitiesLimit === 'ALL' ? 'auto' : 'visible',
                                                paddingRight: liveOpportunitiesLimit === 'ALL' ? '0.5rem' : '0'
                                            }}>
                                                {topPending.map((opp, idx) => renderOppCard(opp, idx, true))}
                                            </div>

                                            <div style={{
                                                marginTop: '1.5rem',
                                                fontSize: '0.65rem',
                                                opacity: 0.4,
                                                textAlign: 'center',
                                                fontStyle: 'italic',
                                                padding: '0.8rem',
                                                borderTop: '1px solid rgba(255,255,255,0.03)'
                                            }}>
                                                * {lang === 'tr' ? 'Bu maçlar için yeterli istatistik toplandığında otomatik olarak yukarıdaki analiz bölümüne taşınacaktır.' : 'These matches will automatically move to the analysis section once enough live stats are collected.'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })()}

                    {/* Live Matches Main Display */}
                    <section className="dashboard-section live-matches-main" style={{ marginBottom: '3.5rem' }}>
                        <div className="section-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.4rem' }}>⚽</span>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
                                    {lang === 'tr' ? 'CANLI MAÇLAR' : 'LIVE MATCHES'}
                                </h2>
                                <span style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    padding: '0.15rem 0.6rem',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 900
                                }}>
                                    {matches.filter(filterByTier).length} {lang === 'tr' ? 'Maç' : 'Matches'}
                                </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {activeTierFilter === 'ALL' ? (lang === 'tr' ? 'Tüm Kademeler' : 'All Tiers') : `Tier ${activeTierFilter}`}
                            </span>
                        </div>

                        {/* Mobile Match Cards (Screen < 768px) */}
                        <div className="mobile-matches-view">
                            {matches.filter(filterByTier).length === 0 ? (
                                <div className="no-matches-mobile glass-panel">
                                    <span>📡</span>
                                    <p>{lang === 'tr' ? 'Bu kademede şu anda canlı maç bulunmuyor.' : 'No live matches in this tier currently.'}</p>
                                </div>
                            ) : (
                                matches.filter(filterByTier).map(m => {
                                    const isQualified = (m.dqs || 0) >= CONFIG.DECISION.DQS_THRESHOLD;
                                    const scoreHome = (m.score && typeof m.score === 'object') ? (m.score.home ?? 0) : (typeof m.score === 'string' && m.score.includes(':') ? m.score.split(':')[0]?.trim() : (typeof m.score === 'string' && m.score.includes('-') ? m.score.split('-')[0]?.trim() : 0));
                                    const scoreAway = (m.score && typeof m.score === 'object') ? (m.score.away ?? 0) : (typeof m.score === 'string' && m.score.includes(':') ? m.score.split(':')[1]?.trim() : (typeof m.score === 'string' && m.score.includes('-') ? m.score.split('-')[1]?.trim() : 0));
                                    return (
                                        <div
                                            key={m.id}
                                            className="mobile-match-card glass-panel"
                                            onClick={() => setSelectedMatch(m)}
                                        >
                                            <div className="match-card-header">
                                                <span className="match-league">{m.league || m.leagueName || 'Football'}</span>
                                                <div className="match-minute-pill">
                                                    <span className="live-minute-dot"></span>
                                                    <span>{renderMatchMinute(m.minute, t, false)}</span>
                                                </div>
                                            </div>

                                            <div className="match-card-body">
                                                <div className="match-teams-box">
                                                    <div className="team-row">
                                                        <span className="team-name">{m.homeTeam}</span>
                                                        <span className="team-score">{scoreHome}</span>
                                                    </div>
                                                    <div className="team-row">
                                                        <span className="team-name">{m.awayTeam}</span>
                                                        <span className="team-score">{scoreAway}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="match-card-footer">
                                                <div className="match-metric">
                                                    <span className="metric-label">DQS</span>
                                                    <span className={`metric-value ${isQualified ? 'text-success' : 'text-danger'}`}>
                                                        {m.dqs ? m.dqs.toFixed(2) : '0.00'}
                                                    </span>
                                                </div>
                                                <div className="match-metric">
                                                    <span className="metric-label">{t.sog}</span>
                                                    <span className="metric-value">{m.stats?.shotsOnGoal?.home || 0}:{m.stats?.shotsOnGoal?.away || 0}</span>
                                                </div>
                                                <div className="match-metric">
                                                    <span className="metric-label">TIER</span>
                                                    <span className="metric-value">T{m.tier}</span>
                                                </div>
                                                <div className="match-status-badge">
                                                    <span className={`status-pill ${isQualified ? 'qualified' : 'rejected'}`}>
                                                        {isQualified ? (t.in_analysis || 'ANALİZDE') : (t.rejected || 'BEKLEMEDE')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table (Screen >= 768px) */}
                        <div className="desktop-matches-view glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                                            <th style={{ padding: '1.25rem 2rem', color: 'var(--accent-color)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 800 }}>{t.match_score}</th>
                                            <th style={{ padding: '1.25rem 1rem', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 800 }}>{t.minute_short}</th>
                                            <th style={{ padding: '1rem', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 800 }}>{t.dqs}</th>
                                            <th style={{ padding: '1rem', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 800 }}>{t.tier_label}</th>
                                            <th style={{ padding: '1rem', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 800 }}>{t.sog}</th>
                                            <th style={{ padding: '1.25rem 2rem', textAlign: 'right', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 800 }}>{t.status}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matches.filter(filterByTier).map(m => (
                                            <tr key={m.id} onClick={() => setSelectedMatch(m)} style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '1.25rem 2rem' }}>
                                                    <div style={{ fontWeight: 800 }}>{m.homeTeam} <span style={{ opacity: 0.3 }}>-</span> {m.awayTeam}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', marginTop: '0.25rem', fontWeight: 600 }}>{(m.score && typeof m.score === 'object') ? `${m.score.home ?? 0} : ${m.score.away ?? 0}` : (m.score || '0 : 0')}</div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', fontWeight: 800 }}>{renderMatchMinute(m.minute, t, false)}</td>
                                                <td style={{ padding: '1rem', fontWeight: 800, color: (m.dqs || 0) >= CONFIG.DECISION.DQS_THRESHOLD ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                                    {m.dqs ? m.dqs.toFixed(2) : '0.00'}
                                                </td>
                                                <td style={{ padding: '1rem' }}><span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>T{m.tier}</span></td>
                                                <td style={{ padding: '1rem', opacity: 0.7, fontWeight: 700 }}>{m.stats?.shotsOnGoal?.home || 0} <span style={{ opacity: 0.3 }}>/</span> {m.stats?.shotsOnGoal?.away || 0}</td>
                                                <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                                    <span style={{
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        background: (m.dqs || 0) >= CONFIG.DECISION.DQS_THRESHOLD ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                        color: (m.dqs || 0) >= CONFIG.DECISION.DQS_THRESHOLD ? 'var(--success-color)' : 'var(--danger-color)',
                                                        border: `1px solid ${(m.dqs || 0) >= CONFIG.DECISION.DQS_THRESHOLD ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                                    }}>
                                                        {(m.dqs || 0) >= CONFIG.DECISION.DQS_THRESHOLD ? (t.in_analysis || 'ANALİZDE') : (t.rejected || 'BEKLEMEDE')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    {renderGlobalAISection('LIVE')}

                    {/* Analysis Candidates */}
                    <section className="dashboard-section" style={{ marginBottom: '5rem' }}>
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>DQS {t.analysis_candidates}</h2>
                            <span style={{ padding: '0.3rem 0.8rem', borderRadius: '8px', background: 'var(--success-color)', color: '#000', fontSize: '0.75rem', fontWeight: 800 }}>{eligibleMatches.filter(filterByTier).length}</span>
                        </div>
                        {/* Active Matches Grid */}
                        <div className="match-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '2rem',
                            marginBottom: '4rem'
                        }}>
                            {eligibleMatches.filter(filterByTier).map(match => {
                                const signal = signals[match.id];
                                const isVip = match.tier === 1;
                                const isSignalReady = !!signal;
                                return (
                                    <div key={match.id} className={`match-card glass-panel ${isVip ? 'vip-glow' : ''}`} style={{
                                        padding: '2rem',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        border: isVip ? '1px solid var(--success-color)' : '1px solid var(--glass-border)',
                                        boxShadow: isVip ? '0 0 20px rgba(16, 185, 129, 0.15)' : 'none'
                                    }} onClick={() => setSelectedMatch(match)}>
                                        {isVip && (
                                            <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--success-color)', color: '#000', padding: '0.2rem 1rem', fontSize: '0.6rem', fontWeight: 900, borderBottomLeftRadius: '10px', letterSpacing: '1px', zIndex: 10 }}>VIP</div>
                                        )}
                                        {isSignalReady && signal.observations?.reverseSignal && (
                                            <div style={{ position: 'absolute', top: isVip ? '25px' : 0, right: 0, background: 'var(--danger-color)', color: '#fff', padding: '0.2rem 1rem', fontSize: '0.6rem', fontWeight: 900, borderBottomLeftRadius: '10px', letterSpacing: '1px', animation: 'pulse 2s infinite', zIndex: 10 }}>REVERSE SIGNAL</div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                            <div>
                                                {(match.league || match.leagueName) && (
                                                    <div style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 800,
                                                        color: '#94a3b8',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <span>🏆</span>
                                                        <span>{match.league || match.leagueName}</span>
                                                    </div>
                                                )}
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                                                    {match.homeTeam}
                                                    {((match.cards?.home?.red || 0) > 0 || (match.stats?.cards?.home?.red || 0) > 0) && (
                                                        <span style={{ marginLeft: '6px', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', fontWeight: 900 }}>
                                                            🟥 {(match.cards?.home?.red || match.stats?.cards?.home?.red)}
                                                        </span>
                                                    )}
                                                    <span style={{ opacity: 0.3, margin: '0 6px' }}>vs</span>
                                                    {match.awayTeam}
                                                    {((match.cards?.away?.red || 0) > 0 || (match.stats?.cards?.away?.red || 0) > 0) && (
                                                        <span style={{ marginLeft: '6px', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', fontWeight: 900 }}>
                                                            🟥 {(match.cards?.away?.red || match.stats?.cards?.away?.red)}
                                                        </span>
                                                    )}
                                                </h3>
                                                <div className="match-meta" style={{ marginTop: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 800 }}>
                                                        {renderMatchMinute(match.minute, t, true)}
                                                        <span style={{ opacity: 0.5, margin: '0 0.5rem' }}>|</span>
                                                        {(match.score && typeof match.score === 'object') ? `${match.score.home ?? 0} - ${match.score.away ?? 0}` : (match.score || '0 - 0')}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`tier-badge tier-${match.tier}`} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: match.tier === 1 ? 'var(--success-color)' : match.tier === 2 ? 'var(--warning-color)' : 'var(--text-secondary)', color: '#000' }}>TIER {match.tier}</span>
                                        </div>

                                        {/* Match Stats & Status */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.4rem' }}>{t.shots_on_target || 'SOG'}</div>
                                                <div style={{ fontWeight: 800, color: 'var(--success-color)' }}>
                                                    {match.stats?.shotsOnGoal?.home || 0} - {match.stats?.shotsOnGoal?.away || 0}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.4rem' }}>{t.dangerous_attacks || 'DA'}</div>
                                                <div style={{ fontWeight: 800, color: '#ff9800' }}>
                                                    {match.stats?.dangerousAttacks?.home || 0} - {match.stats?.dangerousAttacks?.away || 0}
                                                </div>
                                            </div>
                                            {match.stats?.xg && (Number(match.stats.xg.home) > 0 || Number(match.stats.xg.away) > 0) && (
                                                <div style={{ textAlign: 'center', gridColumn: 'span 2', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                                                    <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.2rem' }}>xG (Expected Goals)</div>
                                                    <div style={{ fontWeight: 800, color: 'var(--warning-color)', fontSize: '0.9rem' }}>
                                                        {(Number(match.stats.xg.home) || 0).toFixed(2)} - {(Number(match.stats.xg.away) || 0).toFixed(2)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 600 }}>{t.dqs_score_label.replace(':', '')}: <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{(match.dqs || 0).toFixed(2)}</span></div>
                                            <div style={{
                                                padding: '0.5rem 1.2rem',
                                                borderRadius: '8px',
                                                background: (isSignalReady && signal.verdict === 'BET') ? 'var(--success-color)' : 'rgba(255,255,255,0.05)',
                                                color: (isSignalReady && signal.verdict === 'BET') ? '#000' : 'var(--text-secondary)',
                                                fontWeight: 800,
                                                fontSize: '0.8rem',
                                                letterSpacing: '1px'
                                            }}>
                                                {!isSignalReady ? 'ANALİZ...' : (signal.verdict === 'BET' ? t.verdict_bet : t.verdict_pass)}
                                            </div>
                                        </div>

                                        {isSignalReady && signal.verdict === 'BET' && (
                                            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                                                    <span style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block' }}>{t.recom_stake_short}</span>
                                                    <span style={{ fontWeight: 800, color: 'var(--accent-color)' }}>{bankrollManager.calculateRecommendedStake(match, signal)} ₺</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const stake = bankrollManager.calculateRecommendedStake(match, signal);
                                                        if (bankrollManager.approveBet(match, signal, stake)) {
                                                            alert(t.bet_approved_alert);
                                                            setBankState(bankrollManager.getState());

                                                            // Record in Prediction Tracker
                                                            predictionTracker.recordPrediction({
                                                                matchId: match.id,
                                                                match: `${match.homeTeam} vs ${match.awayTeam}`,
                                                                homeTeam: match.homeTeam,
                                                                awayTeam: match.awayTeam,
                                                                minute: match.minute,
                                                                score: match.score,
                                                                market: signal.market || 'Match Result',
                                                                prediction: signal.prediction,
                                                                confidence: signal.confidence || 75,
                                                                source: 'LIVE_SYSTEM',
                                                                dqs: match.dqs,
                                                                xgHome: match.stats?.xg?.home || 0,
                                                                xgAway: match.stats?.xg?.away || 0,
                                                                consensusCount: match.consensusReport?.totalSources || 0
                                                            }).then(() => {
                                                                setTrackingStats(predictionTracker.getStats());
                                                            });
                                                        }
                                                    }}
                                                    style={{ background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                                                >
                                                    {t.approve_bet}
                                                </button>
                                            </div>
                                        )}

                                        {isSignalReady && signal.verdict === 'PASS' && (
                                            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: signal.reasonKey === 'bankroll_stop' ? 'var(--danger-color)' : 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                                                <span style={{ opacity: 0.6 }}>{signal.reasonKey === 'bankroll_stop' ? '🛑' : '⚠️'}</span> {t[signal.reasonKey] || signal.mainReason}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Observation Only */}
                    <section className="dashboard-section observational" style={{ marginBottom: '5rem', opacity: 0.7 }}>
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, opacity: 0.7 }}>{t.observation_only}</h2>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 800 }}>{observationMatches.filter(filterByTier).length}</span>
                        </div>
                        <div className="matches-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                            {observationMatches.filter(filterByTier).map(match => (
                                <div key={match.id} className="match-card glass-panel" style={{ padding: '1.5rem', filter: 'grayscale(1)', opacity: 0.5 }} onClick={() => setSelectedMatch(match)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{match.homeTeam} vs {match.awayTeam}</h4>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                                                {renderMatchMinute(match.minute, t, true)}
                                                <span style={{ opacity: 0.5, margin: '0 0.5rem' }}>|</span>
                                                {(match.score && typeof match.score === 'object') ? `${match.score.home ?? 0} - ${match.score.away ?? 0}` : (match.score || '0 - 0')}
                                                {match.stats?.xg && (Number(match.stats.xg.home) > 0 || Number(match.stats.xg.away) > 0) && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--warning-color)', marginLeft: '0.5rem', fontWeight: 800 }}>
                                                        (xG {(Number(match.stats.xg.home) || 0).toFixed(2)} - {(Number(match.stats.xg.away) || 0).toFixed(2)})
                                                    </span>
                                                )}
                                                {match.isPartial && (
                                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginLeft: '0.8rem', opacity: 0.5 }}>
                                                        [BASIC]
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.6 }}>{t.dqs_label} {(match.dqs || 0).toFixed(2)}</div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--danger-color)' }}>{t.rejected.toUpperCase()}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tier 3 Performance Monitor - Improved */}
                        {(() => {
                            // Filter leagues with actual data (min 3 observations and >0% win rate)
                            const performanceData = Object.entries(dataWorker.tier3Performance || {})
                                .map(([league, stats]) => ({
                                    league,
                                    winRate: stats.totalObserved > 0 ? Math.round((stats.potentialWins / stats.totalObserved) * 100) : 0,
                                    total: stats.totalObserved || 0,
                                    wins: stats.potentialWins || 0
                                }))
                                .filter(item => item.total >= 3) // Only show leagues with min 3 games tracked
                                .sort((a, b) => b.winRate - a.winRate); // Sort by win rate descending

                            const promotionCandidates = performanceData.filter(item => item.winRate >= 70);
                            const regularLeagues = performanceData.filter(item => item.winRate < 70 && item.winRate > 0);

                            if (performanceData.length === 0) return null;

                            return (
                                <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            🔬 {t.tier3_monitor_title}
                                        </h4>
                                        <span style={{ fontSize: '0.65rem', opacity: 0.5, background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                                            {performanceData.length} {lang === 'tr' ? 'lig takipte' : 'leagues tracked'}
                                        </span>
                                    </div>

                                    {/* Promotion Candidates - High Success */}
                                    {promotionCandidates.length > 0 && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--success-color)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                🏆 {lang === 'tr' ? 'YÜKSELTME ADAYLARI' : 'PROMOTION CANDIDATES'} ({promotionCandidates.length})
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.8rem' }}>
                                                {promotionCandidates.slice(0, 6).map(item => (
                                                    <div key={item.league} style={{
                                                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                                                        padding: '1rem',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.75rem', flex: 1, paddingRight: '0.5rem' }}>{item.league}</div>
                                                            <div style={{
                                                                fontSize: '1.1rem',
                                                                fontWeight: 900,
                                                                color: 'var(--success-color)',
                                                                background: 'rgba(16, 185, 129, 0.15)',
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: '6px',
                                                                minWidth: '45px',
                                                                textAlign: 'center'
                                                            }}>
                                                                %{item.winRate}
                                                            </div>
                                                        </div>
                                                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.4rem' }}>
                                                            <div style={{ width: `${item.winRate}%`, height: '100%', background: 'var(--success-color)', transition: 'width 0.5s ease' }}></div>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.6 }}>
                                                            <span>{item.wins}/{item.total} {lang === 'tr' ? 'başarılı' : 'wins'}</span>
                                                            <span style={{ color: 'var(--warning-color)', fontWeight: 700 }}>↑ TIER 2</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Regular Tracked Leagues */}
                                    {regularLeagues.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, marginBottom: '0.8rem' }}>
                                                📊 {lang === 'tr' ? 'TAKİPTEKİ DİĞER LİGLER' : 'OTHER TRACKED LEAGUES'}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {regularLeagues.slice(0, 12).map(item => (
                                                    <div key={item.league} style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        padding: '0.5rem 0.8rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.7rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        border: '1px solid rgba(255,255,255,0.05)'
                                                    }}>
                                                        <span style={{ fontWeight: 700, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.league}</span>
                                                        <span style={{
                                                            fontWeight: 800,
                                                            color: item.winRate >= 50 ? 'var(--warning-color)' : item.winRate >= 30 ? 'var(--text-secondary)' : 'var(--danger-color)',
                                                            fontSize: '0.65rem'
                                                        }}>
                                                            %{item.winRate}
                                                        </span>
                                                    </div>
                                                ))}
                                                {regularLeagues.length > 12 && (
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, padding: '0.5rem', alignSelf: 'center' }}>
                                                        +{regularLeagues.length - 12} {lang === 'tr' ? 'daha' : 'more'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty State Info */}
                                    {performanceData.length > 0 && promotionCandidates.length === 0 && (
                                        <div style={{ marginTop: '1rem', fontSize: '0.65rem', opacity: 0.4, fontStyle: 'italic', textAlign: 'center' }}>
                                            💡 {lang === 'tr' ? '%70+ başarı oranına ulaşan ligler Tier 2\'ye yükseltme adayı olur' : 'Leagues reaching 70%+ success rate become Tier 2 promotion candidates'}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </section>


                    {/* Match Details Modal */}
                    {selectedMatch && (
                        (() => {
                            const currentMatch = matches.find(m => String(m.id) === String(selectedMatch?.id)) || selectedMatch;
                            if (!currentMatch) return null;

                            return (
                                <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
                                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                                        <button className="close-btn" onClick={() => setSelectedMatch(null)}>×</button>

                                        <div className="intelligence-modal-content">
                                            {/* AI & Consensus Layer (Fusion) */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                                {/* AI Expert Column */}
                                                <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderRadius: '15px', padding: '1.5rem', border: '1px solid rgba(56, 189, 248, 0.2)', boxShadow: '0 0 30px rgba(56, 189, 248, 0.1)', position: 'relative', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: 0, fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '1rem' }}>🤖</span> {t.ai_expert_summary}
                                                        </h4>

                                                        {(!currentMatch.aiSummary || currentMatch.aiSummary.includes('bekleniyor')) && (
                                                            currentMatch.dqs < 0.40 ? (
                                                                <div style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    color: '#ef4444',
                                                                    padding: '0.4rem 0.8rem',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 800,
                                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.4rem'
                                                                }}>
                                                                    <span>⚠️</span> {t.insufficient_data}
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={async () => {
                                                                        // Enforce AI Usage Limits
                                                                        const limitCheck = aiUsageLimiter.canMakeAIRequest(user?.id, userProfile?.plan || 'trial');
                                                                        if (!limitCheck.allowed) {
                                                                            alert(lang === 'tr'
                                                                                ? `Günlük AI rapor limitinize ulaştınız (${limitCheck.limit}). Yarın tekrar deneyebilir veya planınızı yükseltebilirsiniz.`
                                                                                : `You've reached your daily AI report limit (${limitCheck.limit}). Try again tomorrow or upgrade your plan.`);
                                                                            return;
                                                                        }

                                                                        // First set loading state immediately
                                                                        const matchIdx = dataWorker.fixtures.findIndex(f => String(f.id) === String(currentMatch.id));
                                                                        if (matchIdx !== -1) {
                                                                            dataWorker.fixtures[matchIdx].aiSummary = t.report_analyzing || "AI Analiz yapıyor...";
                                                                            setMatches([...dataWorker.fixtures]);
                                                                        }

                                                                        // Then trigger the actual analysis
                                                                        const summary = await dataWorker.triggerDeepAnalysis(currentMatch.id);

                                                                        // Record usage
                                                                        aiUsageLimiter.recordAIUsage(user?.id, 'report');

                                                                        // Update state with the result
                                                                        if (matchIdx !== -1 && summary) {
                                                                            dataWorker.fixtures[matchIdx].aiSummary = summary;
                                                                        }
                                                                        setMatches([...dataWorker.fixtures]);
                                                                    }}
                                                                    className="pulse"
                                                                    style={{
                                                                        background: 'var(--accent-color)',
                                                                        color: '#000',
                                                                        border: 'none',
                                                                        padding: '0.4rem 0.8rem',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer',
                                                                        textTransform: 'uppercase'
                                                                    }}
                                                                >
                                                                    {t.deep_analysis || 'DERİN ANALİZ'}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>

                                                    {(currentMatch.aiSummary === (t.report_analyzing || "AI Analiz yapıyor...") || currentMatch.aiSummary === "AI Analiz yapıyor...") ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                            <div className="skeleton-loader" style={{ height: '0.8rem', width: '90%', borderRadius: '4px' }}></div>
                                                            <div className="skeleton-loader" style={{ height: '0.8rem', width: '70%', borderRadius: '4px' }}></div>
                                                            <div className="skeleton-loader" style={{ height: '0.8rem', width: '85%', borderRadius: '4px' }}></div>
                                                            <span style={{ fontSize: '0.7rem', opacity: 0.5, fontStyle: 'italic', marginTop: '0.5rem' }}>{t.ai_processing || 'Gelişmiş veri setleri taranıyor...'}</span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ whiteSpace: 'pre-line' }}>
                                                            <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#fff', opacity: 0.95 }}>
                                                                {currentMatch.aiSummary || (t.ai_standby || "Analiz raporu için butona basın...")}
                                                            </p>

                                                            {/* Probabilistic Markets Mini-Display */}
                                                            {currentMatch.aiSummary && currentMatch.aiSummary.includes('%') && (
                                                                <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                        <div style={{ fontSize: '0.6rem', opacity: 0.5, textTransform: 'uppercase' }}>Tahmini Güven</div>
                                                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--success-color)' }}>
                                                                            %{currentMatch.aiSummary.match(/%(\d+)/)?.[1] || '??'}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-color)' }}>{t.quant_badge || 'KUANT ANALİZ'}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Global Consensus Column */}
                                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '15px', padding: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                    <h4 style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '1rem' }}>🌐</span> {t.global_consensus_report}
                                                    </h4>
                                                    <div style={{ marginTop: '1.2rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--success-color)' }}>
                                                                {currentMatch.consensusReport?.totalSources || 0}
                                                            </span>
                                                            <span style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 600 }}>/ {RADAR_SOURCES.length} {t.active_badges}</span>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                            {Object.entries(currentMatch.consensusReport?.agreement || {}).map(([pred, count]) => {
                                                                const sources = (currentMatch.consensusReport?.signals || [])
                                                                    .filter(s => s.prediction === pred)
                                                                    .map(s => RADAR_SOURCES.find(rs => rs.id === s.site)?.label || s.site);

                                                                return (
                                                                    <div key={pred} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                            <span style={{ fontWeight: 800, color: 'var(--accent-color)', fontSize: '0.85rem' }}>{pred}</span>
                                                                            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{count} Kaynak</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                                            {sources.map(src => (
                                                                                <span key={src} style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', opacity: 0.8 }}>
                                                                                    {src}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            {!currentMatch.consensusReport?.totalSources && (
                                                                <div style={{ fontSize: '0.7rem', opacity: 0.4, fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                                                                    Henüz dış kaynak verisi eşleşmedi.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="modal-header">
                                                <div className="header-top">
                                                    <h2 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                        <span>{currentMatch.homeTeam}</span>
                                                        {((currentMatch.cards?.home?.red || 0) > 0 || (currentMatch.stats?.cards?.home?.red || 0) > 0) && (
                                                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 900, verticalAlign: 'middle' }}>
                                                                🟥 {(currentMatch.cards?.home?.red || currentMatch.stats?.cards?.home?.red)}
                                                            </span>
                                                        )}
                                                        <span style={{ opacity: 0.35, margin: '0 4px' }}>vs</span>
                                                        <span>{currentMatch.awayTeam}</span>
                                                        {((currentMatch.cards?.away?.red || 0) > 0 || (currentMatch.stats?.cards?.away?.red || 0) > 0) && (
                                                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 900, verticalAlign: 'middle' }}>
                                                                🟥 {(currentMatch.cards?.away?.red || currentMatch.stats?.cards?.away?.red)}
                                                            </span>
                                                        )}
                                                    </h2>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                                        <span className="tier-badge">TIER {currentMatch.tier}</span>
                                                        <span className="minute-badge">{renderMatchMinute(currentMatch.minute, t, false)}</span>
                                                        <span className="score-badge">{(currentMatch.score && typeof currentMatch.score === 'object') ? `${currentMatch.score.home ?? 0} - ${currentMatch.score.away ?? 0}` : (currentMatch.score || '0 - 0')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="modal-grid">
                                                {/* Column 1: Engine Quality */}
                                                <div className="grid-col">
                                                    <h3><span style={{ marginRight: '0.5rem' }}>⚡</span> DQS MOTORU</h3>
                                                    <div className="stats-card">
                                                        <div className="dqs-display">
                                                            <div className="dqs-label">
                                                                <span>DQS Skoru:</span>
                                                                <span style={{ color: 'var(--accent-color)', fontWeight: 800 }}>{(currentMatch.dqs || 0).toFixed(4)}</span>
                                                            </div>
                                                            <div className="dqs-bar-bg">
                                                                <div className="dqs-bar-fill" style={{ width: `${(currentMatch.dqs || 0) * 100}%` }}></div>
                                                            </div>
                                                        </div>

                                                        <div className="stat-row-pill" style={{ marginTop: '1.5rem' }}>
                                                            <span style={{ opacity: 0.6 }}>LATANS:</span>
                                                            <span style={{ fontWeight: 700 }}>{currentMatch.latency || 0}ms</span>
                                                        </div>

                                                        <div className="stat-row-pill" style={{ marginTop: '1rem' }}>
                                                            <span style={{ opacity: 0.6 }}>{t.data_integrity}:</span>
                                                            <span className={`status-pill ${currentMatch.dataQuality === 'OK' ? 'ok' : (currentMatch.dataQuality === 'LIMITED' ? 'warning' : 'fail')}`}>
                                                                {currentMatch.dataQuality === 'PARTIAL' ? 'BEKLENİYOR' : (currentMatch.dataQuality === 'LIMITED' ? 'KISITLI' : 'TAM')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Column 2: Expert Analysis & Risk */}
                                                <div className="grid-col">
                                                    <h3><span style={{ marginRight: '0.5rem' }}>🛡️</span> {t.risk_guard}</h3>
                                                    <div className="stats-card">
                                                        {/* Expert Metrics Display */}
                                                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                                                                <span>{t.pressure_label}</span>
                                                                <span style={{ color: 'var(--warning-color)' }}>%{currentMatch.observations?.pressure?.total || 0}</span>
                                                            </div>
                                                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem' }}>
                                                                <div style={{ width: `${currentMatch.observations?.pressure?.total || 0}%`, height: '100%', background: 'var(--warning-color)', transition: 'width 1s ease' }}></div>
                                                            </div>

                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t.velocity_label}</div>
                                                            <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, textAlign: 'center' }}>
                                                                {currentMatch.observations?.velocity?.trend === 'HOT' ? t.velocity_hot :
                                                                    currentMatch.observations?.velocity?.trend === 'WARMING' ? t.velocity_warming :
                                                                        currentMatch.observations?.velocity?.trend === 'COOLING' ? t.velocity_cooling : t.velocity_stable}
                                                            </div>
                                                        </div>

                                                        {Object.entries(dataWorker.checkRiskFilters(currentMatch)).map(([key, f]) => (
                                                            <div key={key} className="stat-row-pill" style={{ marginBottom: '0.8rem' }}>
                                                                <span style={{ opacity: 0.8 }}>{t[key] || key}</span>
                                                                <span className={`status-pill ${f.status === 'OK' ? 'ok' : f.status === 'FAIL' ? 'fail' : 'warning'}`}>
                                                                    {f.status === 'OK' ? t.status_ok : t.status_fail}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Column 3: Live Snapshot */}
                                                <div className="grid-col">
                                                    <h3><span style={{ marginRight: '0.5rem' }}>📊</span> {t.stats_title}</h3>
                                                    <div className="stats-card" style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                                        {currentMatch.stats?.groups && currentMatch.stats.groups.length > 0 ? (
                                                            currentMatch.stats.groups.map(group => (
                                                                <div key={group.groupName} style={{ marginBottom: '1.8rem' }}>
                                                                    <h4 style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.8rem', paddingBottom: '0.3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-color)' }}>
                                                                        {t[group.groupName] || group.groupName}
                                                                    </h4>
                                                                    {group.statisticsItems.map(item => {
                                                                        const parseVal = (v) => {
                                                                            if (typeof v === 'string') return parseFloat(v.replace('%', '')) || 0;
                                                                            return parseFloat(v) || 0;
                                                                        };
                                                                        const homeVal = parseVal(item.home);
                                                                        const awayVal = parseVal(item.away);
                                                                        const total = homeVal + awayVal;
                                                                        const homePct = total > 0 ? (homeVal / total) * 100 : 50;

                                                                        const isXG = item.name.toLowerCase().includes('expected') || item.name.toLowerCase() === 'xg';

                                                                        return (
                                                                            <div key={item.name} className="stat-item" style={{ marginBottom: '1rem' }}>
                                                                                <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                                                                                    <span style={{ opacity: 0.8, color: isXG ? 'var(--warning-color)' : 'inherit' }}>
                                                                                        {t[item.name] || item.name}
                                                                                    </span>
                                                                                    <span style={{ fontWeight: 800 }}>
                                                                                        {isXG ? `${homeVal.toFixed(2)} - ${awayVal.toFixed(2)}` : `${item.home} - ${item.away}`}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="stat-bar-bg" style={{ display: 'flex', height: '3px', borderRadius: '1.5px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                                                    <div className="stat-bar-home" style={{ width: `${homePct}%`, background: isXG ? 'var(--warning-color)' : 'var(--accent-color)', height: '100%', transition: 'width 0.5s ease' }}></div>
                                                                                    <div className="stat-bar-away" style={{ width: `${100 - homePct}%`, background: 'rgba(255,255,255,0.15)', height: '100%', transition: 'width 0.5s ease' }}></div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                                                {currentMatch.isPartial ? (t.loading_stats || 'Detaylar yükleniyor...') : (t.no_stats_available || 'İstatistik verisi bulunamadı')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Bayesian Intelligence Section (Premium Only) */}
                                                {renderBayesianIntelligence(currentMatch)}
                                            </div>

                                            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                                                <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>
                                                    <span style={{ width: '8px', height: '8px', background: 'var(--success-color)', borderRadius: '50%' }}></span>
                                                    {t.live_feed_connected}
                                                </div>
                                                <button
                                                    onClick={() => setSelectedMatch(null)}
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.8rem 2rem', borderRadius: '10px' }}
                                                >
                                                    {t.close_intelligence}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    )}
                    {/* Match Details Modal end */}
                </>
            )
            }

            {renderPlanComparison()}
            {renderUpgradeConfirmation()}

            {
                showAdvanced && (
                    <div className="modal-overlay" onClick={() => setShowAdvanced(false)}>
                        <div className="modal-content settings glass-panel" onClick={e => e.stopPropagation()}>
                            <button className="close-btn" onClick={() => setShowAdvanced(false)}>×</button>
                            <h2>{t.advanced_settings_title}</h2>

                            {/* Membership Info */}
                            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>👤</span> {t.account_details}
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase' }}>{t.membership_plan}</div>
                                        <div style={{ fontWeight: 800, color: PLAN_COLORS[userProfile?.plan || 'trial'] }}>{t[(userProfile?.plan || 'trial') + '_badge']}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase' }}>{t.expiry_date}</div>
                                        <div style={{ fontWeight: 800 }}>{userProfile?.subscription_end ? new Date(userProfile.subscription_end).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-'}</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8', borderLeft: '3px solid var(--accent-color)' }}>
                                    <div>{t.extend_info}</div>
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ opacity: 0.6, fontSize: '0.65rem' }}>{userProfile?.plan === 'trial' ? t.plan_features_trial : t.plan_features_pro}</div>
                                        <button
                                            onClick={() => setShowPlanComparison(true)}
                                            style={{
                                                marginTop: '0.5rem',
                                                background: 'var(--accent-color)',
                                                color: '#000',
                                                border: 'none',
                                                padding: '0.7rem',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                                        >
                                            <span style={{ fontSize: '1.1rem' }}>🏆</span> {t.compare_plans}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const whatsappNum = (settings.whatsapp_number || CONFIG.SUPPORT.WHATSAPP).replace('+', '').replace(/\s/g, '');
                                                window.open(`https://wa.me/${whatsappNum}?text=Merhaba,%20üyeliğimi%20yükseltmek%20istiyorum.`, '_blank');
                                            }}
                                            style={{
                                                marginTop: '0.3rem',
                                                background: 'rgba(37, 211, 102, 0.1)',
                                                color: '#25D366',
                                                border: '1px solid #25D366',
                                                padding: '0.6rem',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.7rem'
                                            }}
                                        >
                                            <span style={{ fontSize: '1rem' }}>📱</span> {t.whatsapp_upgrade}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-list">
                                {[
                                    { id: 'XG_ANALYSIS', label: t.toggle_xg, premium: true },
                                    { id: 'BAYESIAN_PRICING', label: t.toggle_bayesian, premium: true },
                                    { id: 'LEAGUE_PROFILES', label: t.toggle_league_profiles, premium: false }
                                ].map(setting => {
                                    const isLocked = false; // Bypassed for local Admin access
                                    return (
                                        <div key={setting.id} className={`setting-item ${isLocked ? 'locked' : ''}`}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span>{setting.label}</span>
                                                {setting.premium && <span style={{ background: 'var(--accent-color)', color: '#000', fontSize: '0.5rem', padding: '2px 4px', borderRadius: '4px', fontWeight: 900 }}>PREMIUM</span>}
                                            </div>
                                            <div
                                                className={`toggle ${advancedSettings[setting.id] ? 'on' : ''} ${isLocked ? 'disabled' : ''}`}
                                                onClick={() => {
                                                    if (isLocked) {
                                                        alert(t.premium_required || 'Bu özellik sadece Premium üyeler içindir.');
                                                        return;
                                                    }
                                                    const newVal = !advancedSettings[setting.id];
                                                    const newSettings = { ...advancedSettings, [setting.id]: newVal };
                                                    setAdvancedSettings(newSettings);
                                                    localStorage.setItem('lbm_advanced_settings', JSON.stringify(newSettings));
                                                    CONFIG.MODULAR_SYSTEM.OPTIONAL_MODULES[setting.id] = newVal;
                                                }}
                                            ><div className="knob"></div></div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="league-management">
                                <h4>{t.league_tier_management}</h4>
                                {['tier1', 'tier2'].map(tierKey => (
                                    <div key={tierKey} className="tier-group">
                                        <label>{tierKey === 'tier1' ? t.tier_1_label : t.tier_2_label}</label>
                                        <div className="leagues">
                                            {leagueTierMap[tierKey].map(league => (
                                                <span key={league} className="league-chip" onClick={() => {
                                                    const otherTier = tierKey === 'tier1' ? 'tier2' : 'tier1';
                                                    const newMap = { ...leagueTierMap };
                                                    newMap[tierKey] = newMap[tierKey].filter(l => l !== league);
                                                    newMap[otherTier].push(league);
                                                    setLeagueTierMap(newMap);
                                                    CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.TIER_1 = newMap.tier1;
                                                    CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS.TIER_2 = newMap.tier2;
                                                }}>{league} ⇄</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SMART ALERT FLOATING TOAST (Non-intrusive, bottom-right, auto-dismiss) */}
            {
                showAlertPopup && alertNotifyMode !== 'OFF' && (
                    <div 
                        className="alert-toast-container" 
                        onMouseEnter={() => setIsToastPaused(true)}
                        onMouseLeave={() => setIsToastPaused(false)}
                        style={{
                            position: 'fixed',
                            bottom: '24px',
                            right: '24px',
                            zIndex: 9999,
                            width: '420px',
                            maxWidth: 'calc(100vw - 32px)',
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            borderRadius: '16px',
                            border: `1.5px solid ${
                                showAlertPopup.level === 'ALEV' || showAlertPopup.recommendation?.edgeType === 'LATENCY' 
                                    ? 'rgba(239, 68, 68, 0.7)' 
                                    : showAlertPopup.recommendation?.edgeType === 'PLUS_EV'
                                        ? 'rgba(168, 85, 247, 0.7)'
                                        : 'rgba(251, 191, 36, 0.6)'
                            }`,
                            boxShadow: `0 20px 40px -10px rgba(0,0,0,0.8), 0 0 25px ${
                                showAlertPopup.level === 'ALEV' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(251, 191, 36, 0.2)'
                            }`,
                            padding: '1.2rem',
                            animation: 'slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.8rem',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header bar: Badge + Title + Close button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.3rem' }}>
                                    {showAlertPopup.recommendation?.edgeType === 'LATENCY' ? '⚡' : 
                                     showAlertPopup.recommendation?.edgeType === 'PLUS_EV' ? '💎' : 
                                     showAlertPopup.level === 'ALEV' ? '🔥' : '🎯'}
                                </span>
                                <span style={{
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    letterSpacing: '0.5px',
                                    textTransform: 'uppercase',
                                    color: showAlertPopup.recommendation?.edgeType === 'LATENCY' ? '#f97316' :
                                           showAlertPopup.recommendation?.edgeType === 'PLUS_EV' ? '#c084fc' :
                                           showAlertPopup.level === 'ALEV' ? '#ef4444' : '#fbbf24'
                                }}>
                                    {showAlertPopup.recommendation?.edgeType === 'LATENCY' ? 'GECİKME ARBİTRAJI' :
                                     showAlertPopup.recommendation?.edgeType === 'PLUS_EV' ? 'KURUMSAL +EV DEĞER' :
                                     `${showAlertPopup.level || 'SICAK'} FIRSAT`}
                                </span>
                                <span style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(255,255,255,0.08)',
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    color: '#94a3b8',
                                    fontWeight: 700
                                }}>
                                    {showAlertPopup.conditionsMet || 4}/5 Koşul
                                </span>
                            </div>
                            <button 
                                onClick={() => setShowAlertPopup(null)} 
                                style={{ 
                                    background: 'rgba(255,255,255,0.06)', 
                                    border: 'none', 
                                    color: '#94a3b8', 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '50%', 
                                    cursor: 'pointer', 
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                title="Kapat"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Match info: Teams + Minute + Score */}
                        {(showAlertPopup.league || showAlertPopup.leagueName) && (
                            <div style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span>🏆</span>
                                <span>{showAlertPopup.league || showAlertPopup.leagueName}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                <span>{showAlertPopup.homeTeam || showAlertPopup.match?.split(' vs ')?.[0]}</span>
                                {((showAlertPopup.cards?.home?.red || 0) > 0 || (showAlertPopup.redCards?.home || 0) > 0) && (
                                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>
                                        🟥 {showAlertPopup.cards?.home?.red || showAlertPopup.redCards?.home}
                                    </span>
                                )}
                                <span style={{ opacity: 0.35, margin: '0 2px' }}>vs</span>
                                <span>{showAlertPopup.awayTeam || showAlertPopup.match?.split(' vs ')?.[1]}</span>
                                {((showAlertPopup.cards?.away?.red || 0) > 0 || (showAlertPopup.redCards?.away || 0) > 0) && (
                                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>
                                        🟥 {showAlertPopup.cards?.away?.red || showAlertPopup.redCards?.away}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                                {renderMatchMinute(showAlertPopup.minute, t, false)} • Skor: {showAlertPopup.score}
                            </div>
                        </div>

                        {/* Recommendation Box */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '0.75rem 0.9rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ÖNERİLEN PAZAR</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8' }}>
                                    {showAlertPopup.recommendation?.predictionText ||
                                     showAlertPopup.recommendation?.marketLabel || 
                                     (t[showAlertPopup.recommendation?.marketKey] || showAlertPopup.recommendation?.marketKey || showAlertPopup.recommendation?.market)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ 
                                    background: 'rgba(16, 185, 129, 0.2)', 
                                    color: '#34d399', 
                                    padding: '3px 8px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 900 
                                }}>
                                    %{showAlertPopup.recommendation?.confidence || 75} Güven
                                </div>
                                {showAlertPopup.recommendation?.odds && Number(showAlertPopup.recommendation.odds) > 1.05 && (
                                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '2px', fontWeight: 800, color: '#fbbf24' }}>
                                        @{Number(showAlertPopup.recommendation.odds).toFixed(2)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reasoning snippet */}
                        <div style={{ fontSize: '0.7rem', opacity: 0.75, lineHeight: 1.4 }}>
                            {Array.isArray(showAlertPopup.recommendation?.reasoning) ?
                                showAlertPopup.recommendation.reasoning.slice(0, 3).map(r => {
                                    if (typeof r === 'string') return r;
                                    let txt = t[r.key] || r.key;
                                    if (r.params) Object.entries(r.params).forEach(([k, v]) => txt = txt.replace(`{${k}}`, v));
                                    return txt;
                                }).join(' • ')
                                : (showAlertPopup.recommendation?.reasoning || '')}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
                            <button
                                onClick={() => {
                                    const match = matches.find(m => String(m.id) === String(showAlertPopup.matchId));
                                    let scoreObj = { home: 0, away: 0 };
                                    if (typeof showAlertPopup.score === 'string' && showAlertPopup.score.includes('-')) {
                                        const parts = showAlertPopup.score.split('-');
                                        scoreObj = { home: parseInt(parts[0]) || 0, away: parseInt(parts[1]) || 0 };
                                    } else if (typeof showAlertPopup.score === 'object') {
                                        scoreObj = showAlertPopup.score;
                                    }
                                    const marketTitle = showAlertPopup.recommendation?.predictionText || showAlertPopup.recommendation?.marketLabel || showAlertPopup.recommendation?.marketKey || showAlertPopup.recommendation?.market;
                                    predictionTracker.recordPrediction({
                                        matchId: showAlertPopup.matchId,
                                        match: showAlertPopup.match,
                                        homeTeam: showAlertPopup.homeTeam,
                                        awayTeam: showAlertPopup.awayTeam,
                                        minute: showAlertPopup.minute,
                                        score: scoreObj,
                                        market: marketTitle,
                                        prediction: marketTitle,
                                        confidence: showAlertPopup.recommendation?.confidence,
                                        source: 'ALERT',
                                        dqs: match?.dqs,
                                        xgHome: match?.stats?.xg?.home,
                                        xgAway: match?.stats?.xg?.away,
                                        consensusCount: match?.consensusReport?.totalSources
                                    });
                                    setTrackingStats(predictionTracker.getStats());
                                    setShowAlertPopup(null);
                                }}
                                style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '0.6rem',
                                    borderRadius: '8px',
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
                                    transition: 'transform 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                ✓ Oyna & Kaydet
                            </button>
                            <button
                                onClick={() => setShowAlertPopup(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '0.6rem 1rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Kapat
                            </button>
                        </div>

                        {/* 10-second countdown bar */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            height: '3px',
                            background: showAlertPopup.level === 'ALEV' ? '#ef4444' : '#fbbf24',
                            width: `${toastProgress}%`,
                            transition: 'width 0.1s linear'
                        }} />
                    </div>
                )
            }

            {/* TRACKING & SIGNAL HISTORY PANEL */}
            {
                showTrackingPanel && (
                    <div className="modal-overlay" onClick={() => setShowTrackingPanel(false)}>
                        <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '85vh', overflow: 'auto' }}>
                            <button className="close-btn" onClick={() => setShowTrackingPanel(false)}>×</button>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', margin: 0, fontSize: '1.25rem' }}>
                                    <span>📊</span> {lang === 'tr' ? 'Sinyal Geçmişi & Tahmin Karnesi' : 'Signal History & Prediction Tracker'}
                                </h2>
                            </div>

                            {/* Tab Switcher */}
                            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
                                <button
                                    onClick={() => setTrackingActiveTab('ALERTS')}
                                    style={{
                                        background: trackingActiveTab === 'ALERTS' ? 'linear-gradient(135deg, #38bdf8, #2563eb)' : 'rgba(255,255,255,0.05)',
                                        color: trackingActiveTab === 'ALERTS' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        padding: '0.55rem 1.2rem',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span>🔔</span>
                                    <span>{lang === 'tr' ? 'Gelen Sinyal Geçmişi' : 'Smart Alerts History'}</span>
                                    {alertHistoryList.length > 0 && (
                                        <span style={{
                                            background: trackingActiveTab === 'ALERTS' ? 'rgba(0,0,0,0.3)' : '#38bdf8',
                                            color: '#fff',
                                            borderRadius: '10px',
                                            padding: '0.1rem 0.45rem',
                                            fontSize: '0.65rem',
                                            fontWeight: 900
                                        }}>
                                            {alertHistoryList.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setTrackingActiveTab('BETS')}
                                    style={{
                                        background: trackingActiveTab === 'BETS' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                                        color: trackingActiveTab === 'BETS' ? '#000' : 'var(--text-secondary)',
                                        border: 'none',
                                        padding: '0.55rem 1.2rem',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span>📈</span>
                                    <span>{lang === 'tr' ? 'Tahmin & Kasa Karnesi' : 'Prediction & Bankroll Tracker'}</span>
                                    {trackingStats.total > 0 && (
                                        <span style={{
                                            background: trackingActiveTab === 'BETS' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
                                            color: trackingActiveTab === 'BETS' ? '#000' : '#fff',
                                            borderRadius: '10px',
                                            padding: '0.1rem 0.45rem',
                                            fontSize: '0.65rem',
                                            fontWeight: 900
                                        }}>
                                            {trackingStats.total}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* TAB 1: SMART ALERTS HISTORY */}
                            {trackingActiveTab === 'ALERTS' && (
                                <div>
                                    {/* Alert Stats Summary */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.8rem', marginBottom: '1.5rem' }}>
                                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>TOPLAM SİNYAL</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-color)' }}>{alertHistoryList.length}</div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>KAZANAN</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>
                                                {alertHistoryList.filter(a => a.status === 'WON').length}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>KAYBEDEN</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>
                                                {alertHistoryList.filter(a => a.status === 'LOST').length}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>DEVAM EDEN</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>
                                                {alertHistoryList.filter(a => a.status === 'PENDING').length}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.8 }}>Gelen Popup & Bildirim Sinyalleri</div>
                                        {alertHistoryList.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Tüm sinyal geçmişini temizlemek istediğinize emin misiniz?')) {
                                                        smartAlertService.clearHistory();
                                                        setAlertHistoryList([]);
                                                    }
                                                }}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                    color: '#ef4444',
                                                    padding: '0.3rem 0.7rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️ Geçmişi Temizle
                                            </button>
                                        )}
                                    </div>

                                    {/* Alert Cards */}
                                    <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem', paddingRight: '0.3rem' }}>
                                        {alertHistoryList.map(alert => {
                                            const rec = alert.recommendation || {};
                                            const betTitle = rec.predictionText || rec.marketLabel || rec.marketKey || 'Tahmin';
                                            const timeStr = alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                            return (
                                                <div
                                                    key={alert.id}
                                                    style={{
                                                        background: alert.level === 'ALEV' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                                                        border: `1px solid ${alert.status === 'WON' ? 'rgba(16, 185, 129, 0.4)' : alert.status === 'LOST' ? 'rgba(239, 68, 68, 0.3)' : alert.level === 'ALEV' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                        borderRadius: '10px',
                                                        padding: '0.9rem',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.5rem'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                            <span style={{
                                                                fontSize: '0.65rem',
                                                                fontWeight: 900,
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: '6px',
                                                                background: alert.level === 'ALEV' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                                                color: '#fff'
                                                            }}>
                                                                {alert.level === 'ALEV' ? '🔥 ALEV' : '⚡ SICAK'}
                                                            </span>
                                                            {(alert.league || alert.leagueName) && (
                                                                <span style={{
                                                                    fontSize: '0.6rem',
                                                                    padding: '1px 5px',
                                                                    borderRadius: '4px',
                                                                    background: 'rgba(255, 255, 255, 0.08)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                    color: '#cbd5e1',
                                                                    fontWeight: 700,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.5px'
                                                                }}>
                                                                    {alert.league || alert.leagueName}
                                                                </span>
                                                            )}
                                                            <span style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                                <span>{alert.homeTeam || alert.match?.split(' vs ')?.[0]}</span>
                                                                {((alert.cards?.home?.red || 0) > 0 || (alert.redCards?.home || 0) > 0) && (
                                                                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>
                                                                        🟥 {alert.cards?.home?.red || alert.redCards?.home}
                                                                    </span>
                                                                )}
                                                                <span style={{ opacity: 0.35, margin: '0 2px' }}>vs</span>
                                                                <span>{alert.awayTeam || alert.match?.split(' vs ')?.[1]}</span>
                                                                {((alert.cards?.away?.red || 0) > 0 || (alert.redCards?.away || 0) > 0) && (
                                                                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>
                                                                        🟥 {alert.cards?.away?.red || alert.redCards?.away}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{timeStr}</div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>
                                                                ⏱️ {alert.minute}' • Skor: {typeof alert.score === 'object' ? `${alert.score?.home ?? 0}-${alert.score?.away ?? 0}` : (alert.score || '0-0')} anında
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                                                                🎯 {betTitle}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                                                                {rec.odds ? `Oran: ${Number(rec.odds).toFixed(2)}` : ''}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                                %{rec.confidence || 75} Güven
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status & Actions */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                                        <div>
                                                            {alert.status === 'WON' ? (
                                                                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                                    ✓ KAZANDI
                                                                </span>
                                                            ) : alert.status === 'LOST' ? (
                                                                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                                    ✗ KAYBETTİ
                                                                </span>
                                                            ) : (
                                                                <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                                    ⏳ DEVAM EDİYOR
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                            {alert.status === 'PENDING' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            smartAlertService.updateAlertResult(alert.id, 'WON');
                                                                            setAlertHistoryList(smartAlertService.getHistory(50));
                                                                        }}
                                                                        style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                                                        title="Kazandı olarak işaretle"
                                                                    >
                                                                        ✓ Kazandı
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            smartAlertService.updateAlertResult(alert.id, 'LOST');
                                                                            setAlertHistoryList(smartAlertService.getHistory(50));
                                                                        }}
                                                                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                                                        title="Kaybetti olarak işaretle"
                                                                    >
                                                                        ✗ Kaybetti
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    const match = matches.find(m => String(m.id) === String(alert.matchId));
                                                                    let scoreObj = { home: 0, away: 0 };
                                                                    if (typeof alert.score === 'string' && alert.score.includes('-')) {
                                                                        const parts = alert.score.split('-');
                                                                        scoreObj = { home: parseInt(parts[0]) || 0, away: parseInt(parts[1]) || 0 };
                                                                    } else if (typeof alert.score === 'object') {
                                                                        scoreObj = alert.score;
                                                                    }
                                                                    predictionTracker.recordPrediction({
                                                                        matchId: alert.matchId,
                                                                        match: alert.match,
                                                                        homeTeam: alert.homeTeam,
                                                                        awayTeam: alert.awayTeam,
                                                                        minute: alert.minute,
                                                                        score: scoreObj,
                                                                        market: betTitle,
                                                                        prediction: betTitle,
                                                                        confidence: rec.confidence,
                                                                        source: 'ALERT'
                                                                    });
                                                                    setTrackingStats(predictionTracker.getStats());
                                                                    alert('Tahmin başarıyla karnenize kaydedildi!');
                                                                }}
                                                                style={{
                                                                    background: 'rgba(56, 189, 248, 0.1)',
                                                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                                                    color: '#38bdf8',
                                                                    padding: '0.3rem 0.6rem',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Bu tahmini kişisel kasa karnene ekle"
                                                            >
                                                                + Portföye Ekle
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {alertHistoryList.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
                                                <div>Henüz tetiklenen sinyal bulunmuyor.</div>
                                                <div style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>Canlı maçlarda yüksek baskı veya xG dominasyonu tespit edildiğinde sinyaller burada listelenecektir.</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: REGISTERED BETS & BANKROLL TRACKER */}
                            {trackingActiveTab === 'BETS' && (
                                <div>
                                    {/* Summary Stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>TOPLAM</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-color)' }}>{trackingStats.total}</div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>KAZANAN</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{trackingStats.won}</div>
                                        </div>
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>KAYBEDEN</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{trackingStats.lost}</div>
                                        </div>
                                        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>İSABET</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24' }}>%{trackingStats.accuracy}</div>
                                        </div>
                                    </div>

                                    {/* By Confidence */}
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.8 }}>Güven Seviyesine Göre</h4>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            {Object.entries(trackingStats.byConfidence || {}).map(([level, stats]) => (
                                                <div key={level} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>
                                                        {level === 'high' ? 'Yüksek (75+)' : level === 'medium' ? 'Orta (60-74)' : 'Düşük (<60)'}
                                                    </div>
                                                    <div style={{ fontWeight: 800, marginTop: '0.3rem' }}>
                                                        {stats.total > 0 ? `${((stats.won / stats.total) * 100).toFixed(0)}%` : '-'}
                                                        <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '0.3rem' }}>({stats.won}/{stats.total})</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recent Predictions */}
                                    <div>
                                        <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.8 }}>Son Tahminler</h4>
                                        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                                            {predictionTracker.getRecent(20).map((pred, idx) => (
                                                <div key={pred.id} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.8rem',
                                                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                    borderRadius: '8px',
                                                    marginBottom: '0.3rem'
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{pred.match}</div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                                            {t[pred.market] || pred.market} • %{pred.confidence} {t.confidence_score}
                                                            {pred.minute && <span style={{ marginLeft: '0.5rem', color: 'var(--text-primary)', opacity: 0.8 }}>@{renderMatchMinute(pred.minute, t, false)} ({(pred.scoreAtPrediction && typeof pred.scoreAtPrediction === 'object') ? `${pred.scoreAtPrediction.home ?? 0}-${pred.scoreAtPrediction.away ?? 0}` : (pred.scoreAtPrediction || '0-0')})</span>}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                        {pred.status === 'PENDING' ? (
                                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                                <button onClick={() => {
                                                                    predictionTracker.updateResult(pred.id, 'WON', {});
                                                                    setTrackingStats(predictionTracker.getStats());
                                                                }} style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>✓</button>
                                                                <button onClick={() => {
                                                                    predictionTracker.updateResult(pred.id, 'LOST', {});
                                                                    setTrackingStats(predictionTracker.getStats());
                                                                }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>✗</button>
                                                            </div>
                                                        ) : (
                                                            <span style={{
                                                                padding: '0.3rem 0.6rem',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                background: pred.status === 'WON' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                                color: pred.status === 'WON' ? '#10b981' : '#ef4444'
                                                            }}>{pred.status === 'WON' ? 'KAZANDI' : 'KAYBETTİ'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {predictionTracker.getRecent(20).length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                                    Henüz kayıtlı tahmin yok
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Floating Tracking Button */}
            {showStakingCalc && <StakingCalculator onClose={() => setShowStakingCalc(false)} lang={lang} />}
            {showFAQ && <FAQ onClose={() => setShowFAQ(false)} lang={lang} mode={faqMode} />}
            <button
                className="floating-kpi-fab"
                onClick={() => {
                    smartAlertService.autoResolveAlerts(matches);
                    setAlertHistoryList(smartAlertService.getHistory(50));
                    setTrackingStats(predictionTracker.getStats());
                    setTrackingActiveTab('ALERTS');
                    setShowTrackingPanel(true);
                }}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                    color: '#fff',
                    border: 'none',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(56, 189, 248, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}
                title="Tahmin Performansı"
            >
                📊
            </button>
        </div >
    );
};
