import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { AttackMomentumGraph } from './AttackMomentumGraph';
import { MatchIncidentsTimeline } from './MatchIncidentsTimeline';
import { sofaScoreAdapter } from '../backend/sofaScoreAdapter';
import { LegalModal } from './LegalModal';
import { LiveTerminalTable } from './LiveTerminalTable';
import { LiveTerminalMobile } from './LiveTerminalMobile';
import { sortMatches, SORT_CRITERIA, calculateMatchHeatScore, isMatchHot, isMatchSurgingLast20, isMatchHighGoalProb, isMatchXgSurplus, isMatchGoldenMinutes, isMatchComeback, calculateLast20MinMetrics, formatMarketPrediction } from '../logic/liveSortEngine';
import '../styles/global.css';
import '../styles/terminal-view.css';

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

    // BETBALLERS STYLE TERMINAL COCKPIT STATES
    const [displayViewMode, setDisplayViewMode] = useState(() => {
        try {
            return localStorage.getItem('lbm_view_mode') || 'TERMINAL';
        } catch {
            return 'TERMINAL';
        }
    });
    const [isSortLocked, setIsSortLocked] = useState(false);
    const [terminalSortCriteria, setTerminalSortCriteria] = useState(SORT_CRITERIA.MOMENTUM);
    const [terminalCategoryFilter, setTerminalCategoryFilter] = useState('ALL');
    const [filterGroupMode, setFilterGroupMode] = useState('GENERAL');
    const [terminalSearchQuery, setTerminalSearchQuery] = useState('');
    const [terminalMobileSubView, setTerminalMobileSubView] = useState(() => {
        try {
            return localStorage.getItem('lbm_mobile_subview') || 'CARDS';
        } catch {
            return 'CARDS';
        }
    });

    const handleSetTerminalMobileSubView = (mode) => {
        setTerminalMobileSubView(mode);
        try {
            localStorage.setItem('lbm_mobile_subview', mode);
        } catch (e) {}
    };
    const [pinnedMatchIds, setPinnedMatchIds] = useState(() => {
        try {
            const saved = localStorage.getItem('lbm_pinned_matches');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });
    const lockedOrderMapRef = useRef(new Map());
    const filterStripRef = useRef(null);

    // Smooth drag-to-scroll for horizontal filter strip
    useEffect(() => {
        const el = filterStripRef.current;
        if (!el) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;
        let hasDragged = false;

        const onMouseDown = (e) => {
            isDown = true;
            hasDragged = false;
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
        };

        const onMouseLeave = () => {
            if (isDown) {
                isDown = false;
                el.classList.remove('grabbing');
            }
        };

        const onMouseUp = () => {
            if (isDown) {
                isDown = false;
                el.classList.remove('grabbing');
            }
        };

        const onMouseMove = (e) => {
            if (!isDown) return;
            const x = e.pageX - el.offsetLeft;
            const walk = x - startX;
            if (Math.abs(walk) > 4) {
                hasDragged = true;
                el.classList.add('grabbing');
                e.preventDefault();
                el.scrollLeft = scrollLeft - walk;
            }
        };

        const onClickCapture = (e) => {
            if (hasDragged) {
                e.stopPropagation();
                e.preventDefault();
                hasDragged = false;
            }
        };

        el.addEventListener('mousedown', onMouseDown);
        el.addEventListener('mouseleave', onMouseLeave);
        el.addEventListener('mouseup', onMouseUp);
        el.addEventListener('mousemove', onMouseMove);
        el.addEventListener('click', onClickCapture, true);

        return () => {
            el.removeEventListener('mousedown', onMouseDown);
            el.removeEventListener('mouseleave', onMouseLeave);
            el.removeEventListener('mouseup', onMouseUp);
            el.removeEventListener('mousemove', onMouseMove);
            el.removeEventListener('click', onClickCapture, true);
        };
    }, [displayViewMode]);

    const togglePinMatch = (matchId) => {
        setPinnedMatchIds(prev => {
            const next = new Set(prev);
            if (next.has(matchId)) next.delete(matchId);
            else next.add(matchId);
            try {
                localStorage.setItem('lbm_pinned_matches', JSON.stringify([...next]));
            } catch (e) {
                console.error('Failed to save pinned matches:', e);
            }
            return next;
        });
    };

    const handleSwitchViewMode = (mode) => {
        setDisplayViewMode(mode);
        try {
            localStorage.setItem('lbm_view_mode', mode);
        } catch (e) {
            console.error('Failed to persist view mode:', e);
        }
    };

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
                    const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                        ? 'http://localhost:3001'
                        : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

                    // 1. Check Backend API upgrade requests
                    try {
                        const res = await fetch(`${proxyBase}/api/members/upgrade-requests`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data?.requests && Array.isArray(data.requests)) {
                                const myReq = data.requests.find(r => 
                                    (r.email === user.email || r.user_id === user.id) && r.status === 'pending'
                                );
                                if (myReq) {
                                    setPendingRequest(myReq);
                                    return;
                                }
                            }
                        }
                    } catch (beErr) {
                        // ignore backend fetch error
                    }

                    // 2. Check Supabase (if table exists)
                    const { data } = await supabase
                        .from('membership_requests')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('status', 'pending')
                        .maybeSingle();

                    if (data) setPendingRequest(data);
                } catch (e) {
                    // Ignore if Supabase offline or table missing
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
        minSources: 2,
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
    const [mobileQuickFilter, setMobileQuickFilter] = useState('ALL'); // 'ALL', 'HOT', 'SECOND_HALF', 'COMBO', 'READY'
    const [isSendingGoldenCombo, setIsSendingGoldenCombo] = useState(false);

    // Membership Request State
    const [pendingRequest, setPendingRequest] = useState(null);
    const [showPlanComparison, setShowPlanComparison] = useState(false);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
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
    const [isScanningResults, setIsScanningResults] = useState(false);

    // Live Attack Momentum Graph & Match Incidents State with Client-Side Memory Caching
    const [matchGraphPoints, setMatchGraphPoints] = useState([]);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphNoData, setGraphNoData] = useState(false);
    const [matchIncidents, setMatchIncidents] = useState([]);
    const [incidentsLoading, setIncidentsLoading] = useState(false);
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
    const clientGraphCache = useRef(new Map());
    const clientIncidentsCache = useRef(new Map());

    useEffect(() => {
        const matchId = selectedMatch?.id;
        if (!matchId) {
            setMatchGraphPoints([]);
            setGraphNoData(false);
            setGraphLoading(false);
            setMatchIncidents([]);
            setIncidentsLoading(false);
            return;
        }

        let isCancelled = false;
        const now = Date.now();

        // 1. Instant cache check (0ms UI render!)
        const cachedGraph = clientGraphCache.current.get(matchId);
        const hasCachedGraph = cachedGraph && (now - cachedGraph.time < 90000);
        if (hasCachedGraph) {
            setMatchGraphPoints(cachedGraph.points || []);
            setGraphNoData(Boolean(cachedGraph.noGraph));
            setGraphLoading(false);
        } else {
            setGraphLoading(true);
            setGraphNoData(false);
        }

        const cachedIncidents = clientIncidentsCache.current.get(matchId);
        const hasCachedIncidents = cachedIncidents && (now - cachedIncidents.time < 60000);
        if (hasCachedIncidents) {
            setMatchIncidents(cachedIncidents.incidents || []);
            setIncidentsLoading(false);
        } else {
            setIncidentsLoading(true);
        }

        // 2. Fetch Incidents (Goals, Cards, Subs, Half Time markers) with fast retry
        const fetchIncidents = (retries = 0) => {
            sofaScoreAdapter.fetchEventIncidents(matchId).then(incs => {
                if (isCancelled) return;
                const list = Array.isArray(incs) ? incs : [];
                const isQueued = Boolean(incs?.isQueued);
                const noIncidents = Boolean(incs?.noIncidents);

                if (list.length > 0 || noIncidents) {
                    setMatchIncidents(list);
                    setIncidentsLoading(false);
                    clientIncidentsCache.current.set(matchId, { time: Date.now(), incidents: list });
                } else if ((isQueued || list.length === 0) && retries < 5) {
                    // Retry every 1.5s while cloud proxy worker fetches and saves incidents
                    setTimeout(() => {
                        if (!isCancelled) fetchIncidents(retries + 1);
                    }, 1500);
                } else {
                    setMatchIncidents(list);
                    setIncidentsLoading(false);
                    clientIncidentsCache.current.set(matchId, { time: Date.now(), incidents: list });
                }
            }).catch(() => {
                if (!isCancelled) {
                    if (retries < 4) {
                        setTimeout(() => {
                            if (!isCancelled) fetchIncidents(retries + 1);
                        }, 1500);
                    } else {
                        setIncidentsLoading(false);
                    }
                }
            });
        };

        // 3. Fetch Attack Momentum Graph (Minute-by-minute wave) with fast retry
        const fetchGraph = (retries = 0) => {
            sofaScoreAdapter.fetchEventGraph(matchId).then(res => {
                if (isCancelled) return;
                const pts = res?.graphPoints || (Array.isArray(res) ? res : []);
                if (pts.length > 0) {
                    setMatchGraphPoints(pts);
                    setGraphNoData(false);
                    setGraphLoading(false);
                    clientGraphCache.current.set(matchId, { time: Date.now(), points: pts, noGraph: false });
                } else if (res?.noGraph) {
                    setMatchGraphPoints([]);
                    setGraphNoData(true);
                    setGraphLoading(false);
                    clientGraphCache.current.set(matchId, { time: Date.now(), points: [], noGraph: true });
                } else if (retries < 6) {
                    // Poll every 1.5s while cloud proxy worker fetches and saves graph
                    setTimeout(() => {
                        if (!isCancelled) fetchGraph(retries + 1);
                    }, 1500);
                } else {
                    setMatchGraphPoints([]);
                    setGraphNoData(true);
                    setGraphLoading(false);
                }
            }).catch(() => {
                if (!isCancelled) {
                    if (retries < 5) {
                        setTimeout(() => {
                            if (!isCancelled) fetchGraph(retries + 1);
                        }, 1500);
                    } else {
                        setMatchGraphPoints([]);
                        setGraphLoading(false);
                    }
                }
            });
        };

        fetchIncidents(0);
        fetchGraph(0);
        return () => { isCancelled = true; };
    }, [selectedMatch?.id]);

    const scanFinishedAlerts = async () => {
        setIsScanningResults(true);
        try {
            await smartAlertService.resolveFinishedAlerts();
            smartAlertService.reEvaluateFinishedAlerts();
            setAlertHistoryList(smartAlertService.getHistory(50));
            setTrackingStats(predictionTracker.getStats());
        } catch (e) {
            console.error('Error resolving finished alerts:', e);
        } finally {
            setIsScanningResults(false);
        }
    };

    useEffect(() => {
        if (showTrackingPanel) {
            scanFinishedAlerts();
        }
    }, [showTrackingPanel]);

    const [showStakingCalc, setShowStakingCalc] = useState(false);
    const [liveOpportunitiesLimit, setLiveOpportunitiesLimit] = useState(5);
    const [hidePendingOpportunities, setHidePendingOpportunities] = useState(false);
    const [momentumWindow, setMomentumWindow] = useState(10);
    const [audioMuted, setAudioMuted] = useState(audioAlert.isMuted);

    // --- INSTITUTIONAL MARKET MONEY FLOW STATE ---
    const [trendingBets, setTrendingBets] = useState([]);
    const [trendingLoading, setTrendingLoading] = useState(false);
    const [trendingLastUpdated, setTrendingLastUpdated] = useState(null);
    const [trendingFilter, setTrendingFilter] = useState('ALL');
    const [trendingSearch, setTrendingSearch] = useState('');
    const [showTrendingGuide, setShowTrendingGuide] = useState(false);

    const fetchTrendingBets = useCallback(async () => {
        setTrendingLoading(true);
        try {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const primaryBase = isLocal ? 'http://localhost:3001' : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');
            const fallbackBase = 'https://live-bet-mentor.onrender.com';

            let res = null;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                res = await fetch(`${primaryBase}/api/market/trending`, { signal: controller.signal });
                clearTimeout(timeoutId);
            } catch (fetchErr) {
                if (isLocal) {
                    res = await fetch(`${fallbackBase}/api/market/trending`);
                } else {
                    throw fetchErr;
                }
            }

            if (res && res.ok) {
                const data = await res.json();
                if (data.bets) {
                    setTrendingBets(data.bets);
                    setTrendingLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
            }
        } catch (err) {
            console.error('[MARKET_TRENDS] Error fetching live volume data:', err);
        } finally {
            setTrendingLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrendingBets();
        const interval = setInterval(fetchTrendingBets, 45000);
        return () => clearInterval(interval);
    }, [fetchTrendingBets]);

    const getRemainingDays = (endDate) => {
        if (!endDate) return null;
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    const [remainingTrialSeconds, setRemainingTrialSeconds] = useState(() => {
        if (!userProfile?.subscription_end) return 0;
        const diff = Math.floor((new Date(userProfile.subscription_end).getTime() - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
    });

    useEffect(() => {
        if (!userProfile?.subscription_end || userProfile?.plan !== 'trial') return;
        const updateTimer = () => {
            const diff = Math.floor((new Date(userProfile.subscription_end).getTime() - Date.now()) / 1000);
            setRemainingTrialSeconds(diff > 0 ? diff : 0);
        };
        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [userProfile?.subscription_end, userProfile?.plan]);

    const formatTrialCountdown = (seconds) => {
        if (seconds <= 0) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

            const payload = {
                userId: user.id,
                email: user.email,
                currentPlan: userProfile?.plan || 'trial',
                requestedPlan: requestedPlan,
                fullName: userProfile?.display_name || userProfile?.full_name || user.email?.split('@')[0],
                phone: userProfile?.phone || ''
            };

            let sentSuccessfully = false;

            // 1. Save to Backend API & send instant Telegram alert to admin
            try {
                const res = await fetch(`${proxyBase}/api/members/upgrade-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) sentSuccessfully = true;
                }
            } catch (beErr) {
                console.warn('[UPGRADE] Backend request warning:', beErr);
            }

            // 2. Also save to Supabase if table exists
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
                if (!error) sentSuccessfully = true;
            } catch (sbErr) {
                // Table doesn't exist yet, backend already handled it
            }

            // 3. Fallback: direct telegram notify admin
            if (!sentSuccessfully) {
                try {
                    await fetch(`${proxyBase}/api/telegram/notify-admin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: user.email,
                            fullName: payload.fullName,
                            plan: requestedPlan,
                            type: 'UPGRADE'
                        })
                    });
                    sentSuccessfully = true;
                } catch (e) {}
            }

            // Update local state
            setPendingRequest({
                user_id: user.id,
                email: user.email,
                current_plan: userProfile?.plan || 'trial',
                requested_plan: requestedPlan,
                status: 'pending'
            });

            alert(lang === 'tr' 
                ? '✅ Yükseltme talebiniz başarıyla iletildi! Yöneticimize bildirim gönderildi, en kısa sürede onaylanacaktır.' 
                : '✅ Upgrade request submitted successfully! Admin has been notified, awaiting approval.');
        } catch (err) {
            console.error('Request Error:', err);
            alert(lang === 'tr' ? 'Bir hata oluştu. Lütfen tekrar deneyin veya Telegram üzerinden iletişime geçin.' : 'An error occurred. Please try again or contact via Telegram.');
        } finally {
            setRequestLoading(false);
        }
    };

    const handleSendToTelegram = async (e, match, opp) => {
        if (e) e.stopPropagation();
        if (!isAdmin) {
            console.warn('[SECURITY] Non-admin user attempted to send signal to Telegram.');
            return;
        }
        
        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            const res = await fetch(`${proxyBase}/api/telegram/send-signal`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-sender': user?.email || 'admin@livebetmentor.com'
                },
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
        if (!isAdmin) {
            console.warn('[SECURITY] Non-admin user attempted to send radar to Telegram.');
            return;
        }

        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            const res = await fetch(`${proxyBase}/api/telegram/send-radar`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-sender': user?.email || 'admin@livebetmentor.com'
                },
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

    const handleSendGoldenComboToTelegram = async (e, combo) => {
        if (e) e.stopPropagation();
        if (!isAdmin) {
            console.warn('[SECURITY] Non-admin user attempted to send golden combo to Telegram.');
            return;
        }
        if (!combo || !combo.picks || combo.picks.length === 0) {
            alert(lang === 'tr' ? '⚠️ Gönderilecek geçerli bir Altın İkili bulunamadı.' : '⚠️ No valid Golden Double found to send.');
            return;
        }

        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        setIsSendingGoldenCombo(true);
        try {
            const res = await fetch(`${proxyBase}/api/telegram/send-combo`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-sender': user?.email || 'admin@livebetmentor.com',
                    'x-admin-token': 'master-admin-token'
                },
                body: JSON.stringify({ combo })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.sent) {
                alert(lang === 'tr' ? '🎟️ Günün Canlı Altın İkilisi Telegram VIP kanalına başarıyla iletildi!' : '🎟️ Golden Double sent to Telegram VIP successfully!');
            } else {
                alert(lang === 'tr' ? `⚠️ Gönderilemedi: ${data.error || data.reason || 'Bilinmeyen hata'}` : `⚠️ Failed: ${data.error || data.reason || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Telegram combo send error:', err);
            alert(lang === 'tr' ? '❌ Telegram servisine bağlanılamadı: ' + err.message : '❌ Connection error to Telegram service: ' + err.message);
        } finally {
            setIsSendingGoldenCombo(false);
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

    const isAdmin = user?.email === 'admin@livebetmentor.com' || userProfile?.plan === 'admin' || user?.email === 'admin@local.dev' || userProfile?.role === 'admin' || user?.id?.startsWith('admin-');

    const t = translations[lang];

    const renderPlanComparison = () => {
        if (!showPlanComparison) return null;

        const isYearly = billingCycle === 'yearly';
        const curr = settings.price_currency || '€';
        const proMonthlyBase = (settings.price_pro !== undefined && settings.price_pro !== '') ? Number(settings.price_pro) : 14.90;
        const premiumMonthlyBase = (settings.price_premium !== undefined && settings.price_premium !== '') ? Number(settings.price_premium) : 34.90;

        const formatPrice = (n) => (n % 1 === 0 ? n.toString() : n.toFixed(2));

        const proPriceVal = isYearly ? (proMonthlyBase === 14.90 ? 9.90 : Math.round(proMonthlyBase * 0.7)) : proMonthlyBase;
        const premiumPriceVal = isYearly ? (premiumMonthlyBase === 34.90 ? 24.90 : Math.round(premiumMonthlyBase * 0.7)) : premiumMonthlyBase;

        const proPrice = `${formatPrice(proPriceVal)} ${curr}`;
        const premiumPrice = `${formatPrice(premiumPriceVal)} ${curr}`;

        const plans = [
            {
                id: 'trial',
                name: t.trial_badge,
                color: '#94a3b8',
                features: t.plan_trial_features,
                price: lang === 'tr' ? '24 Saat Ücretsiz' : '24h Free PRO Trial',
                subtext: lang === 'tr' ? 'Anında erişim, kredi kartsız' : 'Instant access, no card required',
                isFree: true
            },
            {
                id: 'pro',
                name: t.pro_badge,
                color: '#38bdf8',
                features: t.plan_pro_features,
                price: proPrice,
                subtext: isYearly ? (t.billed_annually || (lang === 'tr' ? 'Yıllık faturalandırılır (2 Ay Hediye)' : 'Billed annually (2 months free)')) : null,
                isFree: false
            },
            {
                id: 'premium',
                name: t.premium_badge,
                color: '#00f2fe',
                badge: lang === 'tr' ? 'EN POPÜLER' : 'MOST POPULAR',
                features: t.plan_premium_features,
                price: premiumPrice,
                subtext: isYearly ? (t.billed_annually || (lang === 'tr' ? 'Yıllık faturalandırılır (2 Ay Hediye)' : 'Billed annually (2 months free)')) : null,
                isFree: false
            }
        ];

        return (
            <div className="modal-overlay" onClick={() => setShowPlanComparison(false)} style={{ zIndex: 10001 }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{
                    maxWidth: '1120px',
                    width: '95vw',
                    padding: '2.5rem 1.8rem',
                    maxHeight: '92vh',
                    overflowY: 'auto'
                }}>
                    <button className="close-btn" onClick={() => setShowPlanComparison(false)}>×</button>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '0.6rem', textAlign: 'center', fontWeight: 900, background: 'linear-gradient(to right, #fff, var(--accent-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.compare_plans}</h2>
                    <p style={{ textAlign: 'center', opacity: 0.6, marginBottom: '2rem', fontSize: '1rem' }}>{t.select_best_plan || 'Sizin için en uygun planı seçin ve profesyonel analizin keyfini çıkarın.'}</p>

                    {/* Billing Cycle Toggle */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '2.5rem'
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '6px',
                            borderRadius: '32px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                            gap: '4px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setBillingCycle('monthly')}
                                style={{
                                    background: billingCycle === 'monthly' ? '#38bdf8' : 'transparent',
                                    color: billingCycle === 'monthly' ? '#0f172a' : 'rgba(255,255,255,0.7)',
                                    border: 'none',
                                    padding: '8px 22px',
                                    borderRadius: '24px',
                                    fontWeight: 800,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease'
                                }}
                            >
                                {t.billing_monthly || 'Aylık'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setBillingCycle('yearly')}
                                style={{
                                    background: billingCycle === 'yearly' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                                    color: billingCycle === 'yearly' ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                    border: 'none',
                                    padding: '8px 20px',
                                    borderRadius: '24px',
                                    fontWeight: 800,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.25s ease'
                                }}
                            >
                                <span>{t.billing_yearly || 'Yıllık'}</span>
                                <span style={{
                                    background: billingCycle === 'yearly' ? 'rgba(0,0,0,0.25)' : 'rgba(16, 185, 129, 0.2)',
                                    color: billingCycle === 'yearly' ? '#ffffff' : '#34d399',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.68rem',
                                    fontWeight: 900,
                                    letterSpacing: '0.3px'
                                }}>
                                    {t.annual_discount_badge || '%25 İNDİRİM'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="plans-grid">
                        {plans.map(p => (
                            <div key={p.id} style={{
                                padding: '2.2rem 1.4rem',
                                background: 'rgba(15, 23, 42, 0.6)',
                                borderRadius: '24px',
                                border: `2px solid ${p.id === userProfile?.plan ? p.color : (p.badge ? 'rgba(0, 242, 254, 0.3)' : 'rgba(255,255,255,0.05)')}`,
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                boxShadow: p.id === userProfile?.plan ? `0 0 30px ${p.color}22` : (p.badge ? '0 0 20px rgba(0, 242, 254, 0.1)' : 'none')
                            }}
                                className="plan-card"
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-10px)';
                                    e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${p.color}22`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = p.id === userProfile?.plan ? `0 0 30px ${p.color}22` : (p.badge ? '0 0 20px rgba(0, 242, 254, 0.1)' : 'none');
                                }}>
                                {p.id === userProfile?.plan && (
                                    <div style={{
                                        position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                                        background: p.color, color: '#000', padding: '4px 14px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 900,
                                        boxShadow: `0 0 15px ${p.color}`, letterSpacing: '0.5px'
                                    }}>{t.current_plan_label || 'MEVCUT PLANINIZ'}</div>
                                )}
                                {p.badge && p.id !== userProfile?.plan && (
                                    <div style={{
                                        position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                                        background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', color: '#000', padding: '4px 14px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 900,
                                        boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)', letterSpacing: '0.5px'
                                    }}>{p.badge}</div>
                                )}
                                <h3 style={{ color: p.color, fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 900 }}>{p.name}</h3>

                                <div style={{ minHeight: '65px', marginBottom: '1.8rem' }}>
                                    {p.isFree ? (
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: p.color }}>
                                                {p.price}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '4px', fontWeight: 600 }}>
                                                {p.subtext}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                {p.price}
                                                <span style={{ fontSize: '0.85rem', opacity: 0.4, fontWeight: 600 }}>{t.per_month || '/ay'}</span>
                                            </div>
                                            {p.subtext && (
                                                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px', fontWeight: 700 }}>
                                                    {p.subtext}
                                                </div>
                                            )}
                                        </div>
                                    )}
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <a
                            href={settings?.shopier_link || 'https://shopier.com/livebetmentor'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff',
                                textDecoration: 'none',
                                padding: '1rem',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            💳 {lang === 'tr' ? 'Kredi Kartı / Havale ile Satın Al (Shopier)' : 'Pay with Card / Bank (Shopier)'}
                        </a>

                        <button
                            onClick={() => {
                                const tgUser = (settings?.telegram_support || CONFIG?.SUPPORT?.TELEGRAM || '@Livebetdeskbot').replace('@', '');
                                const cycleText = billingCycle === 'yearly' ? (lang === 'tr' ? 'Yıllık' : 'Yearly') : (lang === 'tr' ? 'Aylık' : 'Monthly');
                                const msg = encodeURIComponent(lang === 'tr'
                                    ? `Merhaba! LiveBet Mentor ${p.name} (${cycleText}) üyeliğine geçiş yapmak istiyorum.`
                                    : `Hello! I would like to upgrade to LiveBet Mentor ${p.name} (${cycleText}) plan.`
                                );
                                window.open(`https://t.me/${tgUser}?text=${msg}`, '_blank');
                                setSelectedPlanForUpgrade(null);
                            }}
                            className="btn btn-primary"
                            style={{ background: '#0088cc', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            ✈️ {t.telegram_upgrade_now || 'Telegram ile Hemen Aktif Et'}
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
        if (!data || (!isAdmin && userProfile?.plan !== 'premium') || !advancedSettings.BAYESIAN_PRICING) return null;

        const confidenceMap = {
            'LOW': t.confidence_low || (lang === 'tr' ? 'DÜŞÜK' : 'LOW'),
            'MEDIUM': t.confidence_medium || (lang === 'tr' ? 'ORTA' : 'MEDIUM'),
            'HIGH': t.confidence_high || (lang === 'tr' ? 'YÜKSEK' : 'HIGH')
        };

        return (
            <div className="grid-col bayesian-grid-col">
                <div className="stats-card bayesian-intel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '6px' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1.1rem' }}>🧠</span>
                            <span>{t.bayesian_intelligence || (lang === 'tr' ? 'CANLI GOL İHTİMALİ & YAPAY ZEKA RADARI' : 'LIVE GOAL PROBABILITY & AI RADAR')}</span>
                        </h3>
                        <div style={{ background: 'var(--accent-color)', color: '#000', fontSize: '0.62rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>
                            {t.production_engine || (lang === 'tr' ? 'CANLI ANALİZ' : 'LIVE ANALYTICS')}
                        </div>
                    </div>

                    {/* Bettor-Friendly Explainer Banner */}
                    <div style={{
                        background: 'rgba(56, 189, 248, 0.07)',
                        border: '1px solid rgba(56, 189, 248, 0.18)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        marginBottom: '1rem',
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        lineHeight: '1.4'
                    }}>
                        <span style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>💡</span>
                        <span>
                            {lang === 'tr'
                                ? 'Sahadaki anlık şut, xG tehlikesi ve hücum baskısına göre sıradaki golün gelme ihtimalini hesaplar.'
                                : 'Calculates the real-time probability of the next goal based on live shots, xG threat and attack pressure.'}
                        </span>
                    </div>

                    <div className="bayesian-gauge-grid">
                        <div className="bayesian-stat-box" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', opacity: 0.65, fontWeight: 800, marginBottom: '0.35rem' }}>
                                {t.prior_prob || (lang === 'tr' ? 'MAÇ TEMPOSU' : 'MATCH BASE TEMPO')}
                            </div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>%{(data.prior * 100).toFixed(0)}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '3px', fontWeight: 600 }}>
                                {lang === 'tr' ? 'İlk genel beklenti' : 'Baseline expected'}
                            </div>
                        </div>

                        <div className="bayesian-gauge-box" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 900, marginBottom: '0.4rem', letterSpacing: '0.3px' }}>
                                {t.posterior_refined || (lang === 'tr' ? 'GÜNCEL GOL İHTİMALİ' : 'CURRENT GOAL PROBABILITY')}
                            </div>
                            <div style={{ position: 'relative', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="100" height="60" viewBox="0 0 100 60">
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--accent-color)" strokeWidth="8" strokeDasharray={`${data.posterior * 125}, 125`} />
                                </svg>
                                <div style={{ position: 'absolute', bottom: '0', fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-color)' }}>
                                    %{(data.posterior * 100).toFixed(1)}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--accent-color)', opacity: 0.85, marginTop: '3px', fontWeight: 700 }}>
                                {lang === 'tr' ? 'Canlı baskıyla revize edilen oran' : 'Refined with in-play pressure'}
                            </div>
                        </div>

                        <div className="bayesian-stat-box" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', opacity: 0.65, fontWeight: 800, marginBottom: '0.35rem' }}>
                                {t.impact || (lang === 'tr' ? 'CANLI BASKI ETKİSİ' : 'LIVE PRESSURE IMPACT')}
                            </div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: data.impact > 0 ? 'var(--success-color)' : (data.impact < 0 ? 'var(--danger-color)' : '#fff') }}>
                                {data.impact > 0 ? `+${(data.impact * 100).toFixed(1)}%` : `${(data.impact * 100).toFixed(1)}%`}
                            </div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '3px', fontWeight: 600 }}>
                                {lang === 'tr' ? 'Son 10 dk hücum katkısı' : 'Recent momentum boost'}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.2rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ opacity: 0.6 }}>{t.confidence_label || (lang === 'tr' ? 'GÜVEN DERECESİ:' : 'CONFIDENCE:')}:</span>
                            <span style={{
                                color: data.confidence === 'HIGH' ? 'var(--success-color)' : data.confidence === 'MEDIUM' ? 'var(--warning-color)' : 'var(--danger-color)',
                                fontWeight: 900,
                                background: 'rgba(255,255,255,0.06)',
                                padding: '2px 8px',
                                borderRadius: '4px'
                            }}>
                                {confidenceMap[data.confidence] || data.confidence}
                            </span>
                        </div>
                        <div style={{ opacity: 0.6, fontStyle: 'italic', fontSize: '0.65rem' }}>
                            {t.evidence_update || (lang === 'tr' ? 'Canlı şutlar, xG gol tehlikesi ve saha baskısıyla anlık hesaplanır.' : 'Calculated dynamically using live shots, xG threat & attack momentum.')}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderMatchDetailsModal = () => {
        if (!selectedMatch) return null;
        const currentMatch = matches.find(m => String(m.id) === String(selectedMatch?.id)) || selectedMatch;
        if (!currentMatch) return null;

        return (
            <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                    <button className="close-btn" onClick={() => setSelectedMatch(null)}>×</button>

                    <div className="intelligence-modal-content">
                        {/* AI & Consensus Layer (Fusion) */}
                        <div className="intelligence-fusion-grid">
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
                                                    const limitCheck = aiUsageLimiter.canMakeAIRequest(user?.id, userProfile?.plan || 'trial');
                                                    if (!limitCheck.allowed) {
                                                        alert(lang === 'tr'
                                                            ? `Günlük AI rapor limitinize ulaştınız (${limitCheck.limit}). Yarın tekrar deneyebilir veya planınızı yükseltebilirsiniz.`
                                                            : `You've reached your daily AI report limit (${limitCheck.limit}). Try again tomorrow or upgrade your plan.`);
                                                        return;
                                                    }

                                                    const matchIdx = dataWorker.fixtures.findIndex(f => String(f.id) === String(currentMatch.id));
                                                    if (matchIdx !== -1) {
                                                        dataWorker.fixtures[matchIdx].aiSummary = t.report_analyzing || "AI Analiz yapıyor...";
                                                        setMatches([...dataWorker.fixtures]);
                                                    }

                                                    const summary = await dataWorker.triggerDeepAnalysis(currentMatch.id, lang);
                                                    aiUsageLimiter.recordAIUsage(user?.id, 'report');

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
                                <h2 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    {(currentMatch.homeTeamLogo || currentMatch.homeTeamId) && (
                                        <img
                                            src={currentMatch.homeTeamLogo || `https://live-bet-mentor.onrender.com/api/team/${currentMatch.homeTeamId}/image`}
                                            alt=""
                                            style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'contain', background: 'rgba(255,255,255,0.06)', padding: '2px', border: '1px solid rgba(34, 197, 94, 0.4)' }}
                                            onError={e => e.target.style.display = 'none'}
                                        />
                                    )}
                                    <span>{currentMatch.homeTeam}</span>
                                    {((currentMatch.cards?.home?.red || 0) > 0 || (currentMatch.stats?.cards?.home?.red || 0) > 0) && (
                                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 900, verticalAlign: 'middle' }}>
                                            🟥 {(currentMatch.cards?.home?.red || currentMatch.stats?.cards?.home?.red)}
                                        </span>
                                    )}
                                    <span style={{ opacity: 0.35, margin: '0 4px' }}>vs</span>
                                    {(currentMatch.awayTeamLogo || currentMatch.awayTeamId) && (
                                        <img
                                            src={currentMatch.awayTeamLogo || `https://live-bet-mentor.onrender.com/api/team/${currentMatch.awayTeamId}/image`}
                                            alt=""
                                            style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'contain', background: 'rgba(255,255,255,0.06)', padding: '2px', border: '1px solid rgba(59, 130, 246, 0.4)' }}
                                            onError={e => e.target.style.display = 'none'}
                                        />
                                    )}
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

                        {/* Live Attack Momentum Wave Graph & Incidents Section */}
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 900,
                                    color: 'var(--accent-color)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <span>📈</span>
                                    <span>{lang === 'tr' ? 'CANLI BASKI GRAFİĞİ (ATTACK MOMENTUM)' : 'LIVE ATTACK MOMENTUM WAVE'}</span>
                                </div>
                                {graphLoading && (
                                    <span style={{ fontSize: '0.65rem', opacity: 0.6, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>🌀</span>
                                        {lang === 'tr' ? 'Grafik yükleniyor...' : 'Loading wave...'}
                                    </span>
                                )}
                            </div>
                            <AttackMomentumGraph
                                points={matchGraphPoints}
                                homeTeam={currentMatch.homeTeam}
                                awayTeam={currentMatch.awayTeam}
                                homeTeamLogo={currentMatch.homeTeamLogo || (currentMatch.homeTeamId ? `https://live-bet-mentor.onrender.com/api/team/${currentMatch.homeTeamId}/image` : null)}
                                awayTeamLogo={currentMatch.awayTeamLogo || (currentMatch.awayTeamId ? `https://live-bet-mentor.onrender.com/api/team/${currentMatch.awayTeamId}/image` : null)}
                                homeTeamId={currentMatch.homeTeamId}
                                awayTeamId={currentMatch.awayTeamId}
                                currentMinute={parseInt(currentMatch.minute) || 90}
                                status={currentMatch.status}
                                incidents={matchIncidents}
                                height={130}
                                lang={lang}
                                loading={graphLoading}
                                noGraph={graphNoData}
                            />

                            {/* Match Incidents Timeline */}
                            <MatchIncidentsTimeline
                                incidents={matchIncidents}
                                homeTeam={currentMatch.homeTeam}
                                awayTeam={currentMatch.awayTeam}
                                homeTeamLogo={currentMatch.homeTeamLogo || (currentMatch.homeTeamId ? `https://live-bet-mentor.onrender.com/api/team/${currentMatch.homeTeamId}/image` : null)}
                                awayTeamLogo={currentMatch.awayTeamLogo || (currentMatch.awayTeamId ? `https://live-bet-mentor.onrender.com/api/team/${currentMatch.awayTeamId}/image` : null)}
                                currentScore={currentMatch.score}
                                lang={lang}
                                loading={incidentsLoading}
                            />
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

                        <div className="modal-footer-actions">
                            <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>
                                <span style={{ width: '8px', height: '8px', background: 'var(--success-color)', borderRadius: '50%' }}></span>
                                {t.live_feed_connected}
                            </div>
                            {view !== 'DASHBOARD' && (
                                <button
                                    onClick={() => {
                                        setView('DASHBOARD');
                                    }}
                                    className="btn btn-outline"
                                    style={{ padding: '0.7rem 1.4rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                                >
                                    🎯 {lang === 'tr' ? 'Canlı Radarda Masaya Git' : 'Go to Live Radar Table'}
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedMatch(null)}
                                className="btn btn-primary"
                                style={{ padding: '0.8rem 2rem', borderRadius: '10px' }}
                            >
                                {t.close_intelligence}
                            </button>
                        </div>
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
            const alertsUpdated = smartAlertService.autoResolveAlerts(enrichedFixtures);
            if (alertsUpdated || newAlerts.length > 0) {
                setActiveAlerts([...smartAlertService.getActiveAlerts()]);
                setAlertHistoryList(smartAlertService.getHistory(50));
                setTrackingStats(predictionTracker.getStats());
            }
            if (newAlerts.length > 0) {
                // Only show popup/toast if notify mode is TOAST (respects SILENT and OFF)
                if (alertNotifyModeRef.current === 'TOAST') {
                    setShowAlertPopup(newAlerts[0]);
                    setToastProgress(100);
                }

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

    const handleTerminalApproveBet = (match, signal) => {
        if (!match) return;
        const strat = signal?.activeStrategies?.[0];
        const predText = strat?.label || signal?.prediction || signal?.reason || match?.opportunityData?.suggestedMarket?.label || (lang === 'tr' ? 'Canlı Takip' : 'Live Pick');
        const scoreObj = (match.score && typeof match.score === 'object')
            ? match.score
            : (typeof match.score === 'string' && match.score.includes('-'))
                ? { home: parseInt(match.score.split('-')[0]) || 0, away: parseInt(match.score.split('-')[1]) || 0 }
                : { home: match.homeScore || 0, away: match.awayScore || 0 };

        // 1. Record directly in Prediction Tracker & Watchlist
        predictionTracker.recordPrediction({
            matchId: match.id,
            match: `${match.homeTeam} vs ${match.awayTeam}`,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            score: scoreObj,
            market: signal?.market || signal?.suggestedMarket || 'Canlı Bahis',
            prediction: predText,
            confidence: signal?.confidence || Math.round(match.opportunityData?.score || 75),
            source: 'LIVE_TERMINAL',
            dqs: match.dqs,
            xgHome: match.stats?.xg?.home || 0,
            xgAway: match.stats?.xg?.away || 0,
            consensusCount: match.consensusReport?.totalSources || 0
        }).then(() => {
            setTrackingStats(predictionTracker.getStats());
        });

        // 2. Also register in bankroll ledger if manager active
        if (bankrollManager) {
            const stake = bankrollManager.calculateRecommendedStake(match, signal) || 100;
            bankrollManager.approveBet(match, signal, stake);
            setBankState(bankrollManager.getState());
        }
    };

    const handleToggleLockSort = () => {
        setIsSortLocked(prev => {
            const next = !prev;
            if (next) {
                // Freeze current list ordering
                const map = new Map();
                processedTerminalMatches.forEach((m, idx) => map.set(m.id, idx));
                lockedOrderMapRef.current = map;
            } else {
                lockedOrderMapRef.current.clear();
            }
            return next;
        });
    };

    const processedTerminalMatches = useMemo(() => {
        let list = enforcedMatches.filter(filterByTier);

        // Search filter
        if (terminalSearchQuery.trim()) {
            const q = terminalSearchQuery.toLowerCase();
            list = list.filter(m => 
                (m.homeTeam && m.homeTeam.toLowerCase().includes(q)) ||
                (m.awayTeam && m.awayTeam.toLowerCase().includes(q)) ||
                (m.league && m.league.toLowerCase().includes(q)) ||
                (m.leagueName && m.leagueName.toLowerCase().includes(q))
            );
        }

        // Category filter
        if (terminalCategoryFilter === 'HOT') {
            list = list.filter(m => isMatchHot(m, signals[m.id]));
        } else if (terminalCategoryFilter === 'RADAR_ALL') {
            list = list.filter(m => 
                isMatchHighGoalProb(m, signals[m.id], 0.55) ||
                isMatchXgSurplus(m, signals[m.id]) ||
                isMatchSurgingLast20(m, signals[m.id]) ||
                isMatchGoldenMinutes(m, signals[m.id]) ||
                isMatchComeback(m, signals[m.id])
            );
        } else if (terminalCategoryFilter === 'SURGE_20') {
            list = list.filter(m => isMatchSurgingLast20(m, signals[m.id]));
        } else if (terminalCategoryFilter === 'GOAL_PROB') {
            list = list.filter(m => isMatchHighGoalProb(m, signals[m.id], 0.55));
        } else if (terminalCategoryFilter === 'XG_SURPLUS') {
            list = list.filter(m => isMatchXgSurplus(m, signals[m.id]));
        } else if (terminalCategoryFilter === 'GOLDEN_MIN') {
            list = list.filter(m => isMatchGoldenMinutes(m, signals[m.id]));
        } else if (terminalCategoryFilter === 'COMEBACK') {
            list = list.filter(m => isMatchComeback(m, signals[m.id]));
        } else if (terminalCategoryFilter === 'BET') {
            list = list.filter(m => signals[m.id]?.verdict === 'BET');
        } else if (terminalCategoryFilter === 'SECOND_HALF') {
            list = list.filter(m => {
                const minStr = String(m.minute || '');
                const min = parseInt(minStr, 10);
                return min >= 45 || minStr.includes('2.Y') || minStr.includes('2H');
            });
        } else if (terminalCategoryFilter === 'PINNED') {
            list = list.filter(m => pinnedMatchIds.has(m.id));
        } else if (terminalCategoryFilter === 'TREND') {
            list = list.filter(m => {
                return (trendingBets || []).some(tb => 
                    consensusAdapter._isFuzzyMatch(tb.home, tb.away, m.homeTeam, m.awayTeam) ||
                    consensusAdapter._isFuzzyMatch(tb.away, tb.home, m.homeTeam, m.awayTeam)
                );
            });
        }

        // Sort matches dynamically
        return sortMatches(
            list,
            terminalSortCriteria,
            signals,
            isSortLocked,
            lockedOrderMapRef.current,
            trendingBets
        );
    }, [
        enforcedMatches,
        activeTierFilter,
        terminalSearchQuery,
        terminalCategoryFilter,
        terminalSortCriteria,
        signals,
        isSortLocked,
        pinnedMatchIds,
        trendingBets
    ]);

    const terminalOpportunitiesMap = useMemo(() => {
        const oppMatches = enforcedMatches.filter(filterByTier).filter(m => {
            const minStr = String(m.minute || '').toLowerCase();
            const code = m.status?.code;
            const desc = String(m.status?.description || '').toLowerCase();
            const isPen = code === 120 || code === 110 || minStr === 'pen.' || minStr.includes('pen') || desc.includes('penalt');
            return !isPen;
        });
        const opps = liveOpportunityScorer.getOpportunities(oppMatches, signals, momentumWindow);
        const map = new Map();
        opps.forEach(o => {
            if (o && o.matchId) map.set(o.matchId, o);
        });
        return map;
    }, [enforcedMatches, activeTierFilter, signals, momentumWindow]);

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
    const renderPortfolio = () => {
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
            <div className="portfolio-view" style={{ paddingBottom: '5rem' }}>
                <div className="section-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>📈 {t.portfolio_title}</h2>
                    <p style={{ opacity: 0.5, fontSize: '0.9rem', fontWeight: 600 }}>{t.subtitle} — v2.0 Algorithm Tracking</p>
                </div>

                {/* Bankroll Discipline & Capital Protection Showcase */}
                <div className="glass-panel" style={{
                    padding: '1.2rem 1.5rem',
                    marginBottom: '1.8rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.7))',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '16px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.3rem' }}>🛡️</span>
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.3px' }}>
                                    {lang === 'tr' ? 'Algoritmik Sermaye Koruma Protokolü' : 'Algorithmic Capital Protection Protocol'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {lang === 'tr' ? 'Hırsı ve kasa sıfırlanmasını (tilt) önleyen otomatik risk kuralları' : 'Automated risk rules preventing drawdown and emotional tilt'}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => { setFaqMode('staking'); setShowFAQ(true); }}
                            style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                padding: '0.35rem 0.8rem',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>❓</span>
                            <span>{lang === 'tr' ? 'Disiplin Rehberi' : 'Discipline Guide'}</span>
                        </button>
                    </div>

                    <div className="bankroll-rules-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.8rem'
                    }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>🔒</span> {lang === 'tr' ? 'GÜNLÜK %5 KÂR KİLİDİ' : 'DAILY 5% TARGET LOCK'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
                                {lang === 'tr' ? 'Günde %5 kâra ulaşıldığında kazancı korumak için sistem kilitlenir.' : 'System stops trading upon hitting 5% daily gain to lock in profits.'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>🛑</span> {lang === 'tr' ? 'GÜNLÜK %3 STOP-LOSS' : 'DAILY 3% STOP-LOSS'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
                                {lang === 'tr' ? 'Maksimum %3 kayıpta hırsı engellemek için işlem alımı durdurulur.' : 'Trading halts at 3% daily drawdown to avoid emotional tilt.'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>🛡️</span> {lang === 'tr' ? 'TEMKİNLİ MOD (%50 KISMA)' : 'CAUTION MODE (-50%)'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
                                {lang === 'tr' ? 'Üst üste 2 kayıpta bahis miktarı risk güvenliği için yarıya indirilir.' : 'Consecutive 2 losses automatically halves stake size for capital safety.'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>📈</span> {lang === 'tr' ? 'BİLEŞİK KELLY MOTORU' : 'FRACTIONAL KELLY'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
                                {lang === 'tr' ? 'Kasa büyüdükçe kâr katlanır, bakiye gerilediğinde risk otomatik küçülür.' : 'Stake scales with bankroll growth; risks decrease during drawdown.'}
                            </div>
                        </div>
                    </div>
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

                {/* Algorithmic Strategy Scorecard (Transparency & Confidence) */}
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📊</span> {lang === 'tr' ? 'Algoritmik Strateji Karnesi' : 'Algorithmic Strategy Scorecard'}
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                {lang === 'tr' ? 'Sistem motorlarının geçmiş performans ve getiri (ROI) karnesi' : 'Historical performance and ROI grading of predictive engines'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800 }}>A+ (Elit: %70+ Başarı)</span>
                            <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 800 }}>A (Pozitif Getiri)</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.8rem' }}>
                        {bankrollManager.getStrategyAnalytics().map(st => (
                            <div key={st.id} style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>{st.icon}</span>
                                        <span>{st.label}</span>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                                        {st.totalBets} {lang === 'tr' ? 'İşlem' : 'Bets'} • {st.wins}W - {st.losses}L
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        display: 'inline-block',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        background: st.badge === 'A+' ? 'rgba(16, 185, 129, 0.2)' : st.badge === 'A' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                                        color: st.badge === 'A+' ? '#10b981' : st.badge === 'A' ? '#38bdf8' : '#94a3b8',
                                        border: `1px solid ${st.badge === 'A+' ? 'rgba(16, 185, 129, 0.4)' : st.badge === 'A' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.1)'}`
                                    }}>
                                        {st.badge}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: st.roi >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                                        %{st.winRate} {lang === 'tr' ? 'İsabet' : 'Win'}
                                    </div>
                                </div>
                            </div>
                        ))}
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

    // --- TRENDING BETS LOCALIZATION HELPERS ---
    const formatTrendingMarket = (market, marketShort, currentLang = 'tr') => {
        const m = (market || '').trim();
        const ms = (marketShort || '').trim().toLowerCase();
        const mLower = m.toLowerCase();

        // Next Goal (Wer schießt das nächste Tor? / Who scores next? / next-point)
        if (ms === 'next-point' || mLower.includes('next') || mLower.includes('nächste') || mLower.includes('sıradaki')) {
            return currentLang === 'tr' ? 'Sıradaki Golü Kim Atar?' : 'Who Scores Next?';
        }

        // Rest of game Over/Under (Over/Under (0.5) rest of the game / Über/Unter (0,5) Restzeit)
        if (mLower.includes('restzeit') || mLower.includes('rest of the game') || mLower.includes('rest of game') || mLower.includes('kalan süre')) {
            const numMatch = m.match(/(\d+[,.]\d+)/);
            const num = numMatch ? numMatch[1].replace(',', '.') : '';
            return currentLang === 'tr' 
                ? (num ? `Kalan Süre Üst/Alt (${num})` : 'Kalan Süre Üst/Alt')
                : (num ? `Rest of Match O/U (${num})` : 'Rest of Match Over/Under');
        }

        // Normal Over/Under (Über/Unter / Over/Under)
        if (mLower.includes('über/unter') || mLower.includes('over/under') || mLower.includes('üst/alt')) {
            const numMatch = m.match(/(\d+[,.]\d+)/);
            const num = numMatch ? numMatch[1].replace(',', '.') : '';
            return currentLang === 'tr'
                ? (num ? `Toplam Gol Üst/Alt (${num})` : 'Toplam Gol Üst/Alt')
                : (num ? `Total Goals O/U (${num})` : 'Total Goals Over/Under');
        }

        // 1X2 / 3-Way Match Result (3-Way / Tipp / standard)
        if (ms === 'standard' || mLower.includes('3-way') || mLower.includes('tipp') || mLower.includes('maç sonucu')) {
            return currentLang === 'tr' ? 'Maç Sonucu (1X2)' : 'Match Result (1X2)';
        }

        // Both Teams to Score (Beide Teams treffen / BTTS)
        if (ms === 'btts' || mLower.includes('beide teams') || mLower.includes('both teams')) {
            return currentLang === 'tr' ? 'Karşılıklı Gol (KG)' : 'Both Teams To Score';
        }

        // Double Chance (Doppelte Chance)
        if (mLower.includes('doppelte chance') || mLower.includes('double chance')) {
            return currentLang === 'tr' ? 'Çifte Şans' : 'Double Chance';
        }

        return m;
    };

    const formatTrendingMarketShort = (marketShort, market, currentLang = 'tr') => {
        const ms = (marketShort || '').trim().toLowerCase();
        const m = (market || '').trim().toLowerCase();

        if (ms === 'next-point' || m.includes('next') || m.includes('nächste') || m.includes('sıradaki')) {
            return currentLang === 'tr' ? 'Sıradaki Gol' : 'Next Goal';
        }

        if (ms === 'standard' || m.includes('3-way') || m.includes('tipp')) {
            return '1X2';
        }

        if (ms === 'btts' || m.includes('both teams') || m.includes('beide teams')) {
            return currentLang === 'tr' ? 'KG' : 'BTTS';
        }

        const numMatch = ms.match(/(\d+[,.]\d+)/) || m.match(/(\d+[,.]\d+)/);
        if (numMatch) {
            const num = numMatch[1].replace(',', '.');
            if (m.includes('rest') || m.includes('restzeit') || m.includes('kalan')) {
                return currentLang === 'tr' ? `Kalan ${num}` : `Rest ${num}`;
            }
            return currentLang === 'tr' ? `Üst/Alt ${num}` : `O/U ${num}`;
        }

        return marketShort || market || '';
    };

    const formatTrendingOutcome = (outcome, currentLang = 'tr') => {
        const o = (outcome || '').trim();
        if (!o) return '';

        // Over / Über X
        const matchOver = o.match(/^(?:über|over)\s*(\d+[,.]?\d*)/i);
        if (matchOver) {
            const num = matchOver[1].replace(',', '.');
            return currentLang === 'tr' ? `Üst ${num}` : `Over ${num}`;
        }

        // Under / Unter X
        const matchUnder = o.match(/^(?:unter|under)\s*(\d+[,.]?\d*)/i);
        if (matchUnder) {
            const num = matchUnder[1].replace(',', '.');
            return currentLang === 'tr' ? `Alt ${num}` : `Under ${num}`;
        }

        // Match results
        const oLower = o.toLowerCase();
        if (oLower === 'unentschieden' || oLower === 'draw' || oLower === 'tie' || oLower === 'x') {
            return currentLang === 'tr' ? 'Beraberlik' : 'Draw';
        }
        if (oLower === 'heimsieg' || oLower === 'home') {
            return currentLang === 'tr' ? 'Ev Sahibi (1)' : 'Home (1)';
        }
        if (oLower === 'auswärtssieg' || oLower === 'away') {
            return currentLang === 'tr' ? 'Deplasman (2)' : 'Away (2)';
        }
        if (oLower === 'ja' || oLower === 'yes') {
            return currentLang === 'tr' ? 'Evet / Var' : 'Yes';
        }
        if (oLower === 'nein' || oLower === 'no') {
            return currentLang === 'tr' ? 'Hayır / Yok' : 'No';
        }

        return o;
    };

    // --- INSTITUTIONAL MARKET MONEY FLOW EVALUATION (SMART MONEY VS PUBLIC TRAP) ---
    const evaluateTrendingBet = useCallback((bet) => {
        const liveMatch = (matches || []).find(m => 
            consensusAdapter._isFuzzyMatch(bet.home, bet.away, m.homeTeam, m.awayTeam) ||
            consensusAdapter._isFuzzyMatch(bet.away, bet.home, m.homeTeam, m.awayTeam)
        );

        if (!liveMatch) {
            return {
                status: 'MARKET',
                badgeText: t.trending_influx_badge || '📊 PİYASA AKIŞI',
                color: '#38bdf8',
                bg: 'rgba(56, 189, 248, 0.1)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                icon: '📊',
                dqs: null,
                liveMatch: null,
                desc: lang === 'tr' 
                    ? 'Avrupa kurumsal bahis bülteninde yüksek hacimli halk ilgisi. Canlı radar dışında veya alt lig.' 
                    : 'High public betting volume in global sportsbook feeds. Outside active radar or minor league.'
            };
        }

        const dqs = liveMatch.dqs !== undefined ? liveMatch.dqs : 0;
        const isApproved = dqs >= 0.50;
        const isTrap = dqs < 0.40;

        if (isApproved) {
            return {
                status: 'APPROVED',
                badgeText: t.trending_smart_money_badge || '🟢 AKILLI PARA',
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                icon: '🟢',
                dqs,
                liveMatch,
                desc: lang === 'tr'
                    ? `Yüksek DQS (%${(dqs * 100).toFixed(0)}) & saha verisi kalabalığın bahsini doğruluyor.`
                    : `High DQS (${(dqs * 100).toFixed(0)}%) & match data confirms crowd influx.`
            };
        } else if (isTrap) {
            return {
                status: 'TRAP',
                badgeText: t.trending_trap_alert_badge || '🔴 TUZAK ALARMI',
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                icon: '🔴',
                dqs,
                liveMatch,
                desc: lang === 'tr'
                    ? `Düşük DQS (%${(dqs * 100).toFixed(0)}) & yetersiz tempo. Kalabalık tuzağa çekiliyor olabilir!`
                    : `Low DQS (${(dqs * 100).toFixed(0)}%) & weak tempo. Crowd may be walking into a trap!`
            };
        } else {
            return {
                status: 'CAUTION',
                badgeText: t.trending_neutral_badge || '🟡 NÖTR / DİKKAT',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.12)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                icon: '🟡',
                dqs,
                liveMatch,
                desc: lang === 'tr'
                    ? `Orta seviye DQS (%${(dqs * 100).toFixed(0)}%). Saha aksiyonunu yakından gözlemleyin.`
                    : `Moderate DQS (${(dqs * 100).toFixed(0)}%). Keep observing match dynamics.`
            };
        }
    }, [matches, lang, t]);

    const renderTrending = () => {
        // Group trending bets by match (eventId or home_away)
        const matchGroupsMap = new Map();
        (trendingBets || []).forEach(bet => {
            const matchKey = bet.eventId ? String(bet.eventId) : `${bet.home}_${bet.away}`;
            if (!matchGroupsMap.has(matchKey)) {
                matchGroupsMap.set(matchKey, {
                    key: matchKey,
                    eventId: bet.eventId,
                    home: bet.home,
                    away: bet.away,
                    competition: bet.competition,
                    score: bet.score,
                    bets: []
                });
            }
            matchGroupsMap.get(matchKey).bets.push(bet);
        });

        // For each group, sort bets by count descending (highest volume bet is primary)
        const groupedMatches = Array.from(matchGroupsMap.values()).map(group => {
            const sortedBets = [...group.bets].sort((a, b) => (b.count || 0) - (a.count || 0));
            const primaryBet = sortedBets[0];
            const otherBets = sortedBets.slice(1);
            const totalCount = sortedBets.reduce((sum, b) => sum + (b.count || 0), 0);
            const evaluation = evaluateTrendingBet(primaryBet);
            return {
                ...group,
                primaryBet,
                otherBets,
                totalCount,
                evaluation
            };
        });

        const approvedCount = groupedMatches.filter(m => m.evaluation.status === 'APPROVED').length;
        const trapCount = groupedMatches.filter(m => m.evaluation.status === 'TRAP').length;
        const marketCount = groupedMatches.filter(m => m.evaluation.status === 'MARKET').length;
        const cautionCount = groupedMatches.filter(m => m.evaluation.status === 'CAUTION').length;

        const filteredMatches = groupedMatches.filter(m => {
            if (trendingFilter === 'APPROVED' && m.evaluation.status !== 'APPROVED') return false;
            if (trendingFilter === 'TRAP' && m.evaluation.status !== 'TRAP') return false;
            if (trendingFilter === 'MARKET' && m.evaluation.status !== 'MARKET' && m.evaluation.status !== 'CAUTION') return false;
            if (trendingFilter === 'CAUTION' && m.evaluation.status !== 'CAUTION') return false;

            if (trendingSearch) {
                const q = trendingSearch.toLowerCase();
                const betsText = m.bets.map(b => 
                    `${b.market} ${b.marketShort} ${b.outcome} ${formatTrendingMarket(b.market, b.marketShort, lang)} ${formatTrendingMarketShort(b.marketShort, b.market, lang)} ${formatTrendingOutcome(b.outcome, lang)}`
                ).join(' ');
                const matchStr = `${m.home} ${m.away} ${m.competition} ${betsText}`.toLowerCase();
                if (!matchStr.includes(q)) return false;
            }
            return true;
        });

        const maxBetCount = Math.max(...(trendingBets || []).map(b => b.count || 1), 1);

        return (
            <div className="trending-view" style={{ paddingBottom: '5rem' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '2rem' }}>🔥</span>
                            <h2 style={{ fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-0.5px', margin: 0, background: 'linear-gradient(135deg, #ffffff, #f87171)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {t.trending_title || 'PİYASA TRENDLERİ & HALK AKIŞI'}
                            </h2>
                        </div>
                        <p style={{ opacity: 0.6, fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                            {t.trending_subtitle || 'Avrupa Canlı Hacim Akışı & LiveBet Mentor DQS Doğrulaması'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.45rem 0.9rem',
                            borderRadius: '999px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: '#f87171'
                        }}>
                            <span className="trending-pulse-dot"></span>
                            <span>{t.trending_live_feed || 'CANLI HACİM AKIŞI (5 DK)'}</span>
                        </div>

                        {trendingLastUpdated && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600 }}>
                                {trendingLastUpdated}
                            </span>
                        )}

                        <button
                            onClick={fetchTrendingBets}
                            disabled={trendingLoading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--accent-color)',
                                background: 'rgba(56, 189, 248, 0.1)',
                                color: 'var(--accent-color)',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: trendingLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ display: 'inline-block', transform: trendingLoading ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>🔄</span>
                            <span>{trendingLoading ? (lang === 'tr' ? 'Yenileniyor...' : 'Refreshing...') : (t.trending_refresh || 'Yenile')}</span>
                        </button>
                    </div>
                </div>

                {/* Collapsible Customer Explainer Guide */}
                <div style={{ marginBottom: '1.8rem' }}>
                    <button
                        onClick={() => setShowTrendingGuide(!showTrendingGuide)}
                        style={{
                            width: '100%',
                            padding: '0.85rem 1.2rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(251, 191, 36, 0.35)',
                            background: showTrendingGuide 
                                ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.05))' 
                                : 'rgba(251, 191, 36, 0.06)',
                            color: '#fbbf24',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 15px rgba(251, 191, 36, 0.1)'
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>💡</span>
                            <span>{t.trending_guide_btn || 'Bu Sistem Nasıl Çalışır? (30 Saniyede Öğren)'}</span>
                        </span>
                        <span style={{ fontSize: '0.85rem', transition: 'transform 0.2s', transform: showTrendingGuide ? 'rotate(180deg)' : 'none' }}>
                            ▼
                        </span>
                    </button>

                    {showTrendingGuide && (
                        <div style={{
                            marginTop: '0.8rem',
                            padding: '1.4rem',
                            borderRadius: '14px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(251, 191, 36, 0.25)',
                            backdropFilter: 'blur(10px)',
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                gap: '1.2rem'
                            }}>
                                <div style={{
                                    padding: '1.2rem',
                                    borderRadius: '10px',
                                    background: 'rgba(56, 189, 248, 0.06)',
                                    border: '1px solid rgba(56, 189, 248, 0.2)'
                                }}>
                                    <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>🌊</div>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.4rem' }}>
                                        {t.trending_guide_step1_title || '1. Canlı Para Akışı (Public Volume)'}
                                    </h4>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.5, color: '#cbd5e1', margin: 0 }}>
                                        {t.trending_guide_step1_desc || "Avrupa'nın önde gelen kurumsal bahis bültenlerinde kalabalığın son 5 dakikada hangi maç ve bahislere hücum ettiği saniye saniye izlenir."}
                                    </p>
                                </div>

                                <div style={{
                                    padding: '1.2rem',
                                    borderRadius: '10px',
                                    background: 'rgba(167, 139, 250, 0.06)',
                                    border: '1px solid rgba(167, 139, 250, 0.2)'
                                }}>
                                    <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>🧠</div>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#a78bfa', marginBottom: '0.4rem' }}>
                                        {t.trending_guide_step2_title || '2. Yapay Zeka & Saha Röntgeni'}
                                    </h4>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.5, color: '#cbd5e1', margin: 0 }}>
                                        {t.trending_guide_step2_desc || "Kalabalığın %90'ı sadece takım ismine veya hırsına kapılarak oynar. Sistemimiz bu bahsi sahadaki gerçek şut, tehlikeli atak ve DQS veri kalitesiyle test eder."}
                                    </p>
                                </div>

                                <div style={{
                                    padding: '1.2rem',
                                    borderRadius: '10px',
                                    background: 'rgba(16, 185, 129, 0.06)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                }}>
                                    <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>⚖️</div>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#34d399', marginBottom: '0.4rem' }}>
                                        {t.trending_guide_step3_title || '3. Akıllı Para vs. Kasa Tuzağı'}
                                    </h4>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.5, color: '#cbd5e1' }}>
                                        <div style={{ marginBottom: '0.4rem' }}>
                                            <strong style={{ color: '#10b981' }}>🟢 ONAYLI TREND:</strong> {lang === 'tr' ? 'Kalabalık haklı, sahada fırtına kopuyor.' : 'Crowd is right, pitch momentum confirms.'}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#ef4444' }}>🔴 TUZAK ALARMI:</strong> {lang === 'tr' ? 'Sahada tempo yok, kalabalık tuzağa çekiliyor. Kasa kazanacak, siz oynamayın!' : 'No pitch tempo, crowd is falling into a bookmaker trap. Stay away!'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* KPI Overview Strip */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {t.trending_total_tracked || 'TOPLAM TREND'}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.3rem', color: '#f8fafc' }}>
                            {groupedMatches.length} <span style={{ fontSize: '0.9rem', opacity: 0.6, fontWeight: 600 }}>{lang === 'tr' ? 'Maç' : 'Matches'}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: '0.2rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span style={{ color: '#34d399', fontWeight: 700 }}>● {approvedCount + trapCount} {lang === 'tr' ? 'Canlı Radarda' : 'in Radar'}</span>
                            <span style={{ opacity: 0.4 }}>|</span>
                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>● {marketCount + cautionCount} {lang === 'tr' ? 'Radar Dışı' : 'Outside Radar'}</span>
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(0,0,0,0.2))' }}>
                        <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🟢 {t.trending_smart_money_count || 'ONAYLI TREND'}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.3rem', color: '#10b981' }}>
                            {approvedCount}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#34d399', opacity: 0.8, marginTop: '0.2rem' }}>
                            {lang === 'tr' ? 'Canlı Radarda & DQS ≥ 0.50' : 'In Live Radar & DQS ≥ 0.50'}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(0,0,0,0.2))' }}>
                        <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🔴 {t.trending_trap_count || 'TUZAK UYARISI'}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.3rem', color: '#ef4444' }}>
                            {trapCount}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#f87171', opacity: 0.8, marginTop: '0.2rem' }}>
                            {lang === 'tr' ? 'Düşük DQS / Ölü Maç Tuzağı' : 'Low DQS / Dead Match Trap'}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(0,0,0,0.2))' }}>
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📊 {t.trending_direct_count || 'CANLI AKIŞ'}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.3rem', color: '#38bdf8' }}>
                            {marketCount + cautionCount}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#38bdf8', opacity: 0.8, marginTop: '0.2rem' }}>
                            {lang === 'tr' ? 'Avrupa Hacmi (Radar Dışı / Alt Lig)' : 'European Volume (Outside Radar)'}
                        </div>
                    </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="trending-filter-bar" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <div className="trending-filter-chips" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'ALL', label: `${t.trending_filter_all || 'TÜMÜ'} (${groupedMatches.length})` },
                            { id: 'APPROVED', label: `${t.trending_filter_approved || '🟢 ONAYLI'} (${approvedCount})`, color: '#10b981' },
                            { id: 'TRAP', label: `${t.trending_filter_trap || '🔴 TUZAKLAR'} (${trapCount})`, color: '#ef4444' },
                            { id: 'MARKET', label: `${t.trending_filter_market || '📊 AKIŞ'} (${marketCount + cautionCount})`, color: '#38bdf8' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setTrendingFilter(f.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    border: trendingFilter === f.id ? `1px solid ${f.color || 'var(--accent-color)'}` : '1px solid rgba(255,255,255,0.08)',
                                    background: trendingFilter === f.id ? (f.color ? `${f.color}22` : 'var(--accent-color)') : 'rgba(255,255,255,0.03)',
                                    color: trendingFilter === f.id ? (f.color || '#000') : '#94a3b8',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="trending-search-box" style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                        <input
                            type="text"
                            placeholder={t.trending_search_placeholder || 'Takım, lig veya bahis tipi ara...'}
                            value={trendingSearch}
                            onChange={(e) => setTrendingSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 1rem 0.6rem 2.2rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        />
                        <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
                            🔍
                        </span>
                        {trendingSearch && (
                            <button
                                onClick={() => setTrendingSearch('')}
                                style={{
                                    position: 'absolute',
                                    right: '0.8rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    opacity: 0.5,
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Bets Grid */}
                {filteredMatches.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
                            {groupedMatches.length === 0 ? (t.trending_empty || 'Şu anda küresel bültende trend olan bahis bulunamadı.') : (t.trending_no_results || 'Seçili filtrelere uygun trend bahis bulunamadı.')}
                        </h4>
                        <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>
                            {lang === 'tr' ? 'Canlı piyasa bülteni 45 saniyede bir taranarak yeni trendler otomatik listelenir.' : 'Live market feed is scanned every 45s for trending public money.'}
                        </p>
                    </div>
                ) : (
                    <div className="trending-matches-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                        gap: '1.2rem'
                    }}>
                        {filteredMatches.map((m, idx) => {
                            const evalInfo = m.evaluation;
                            const heatPercent = Math.min(100, Math.round(((m.primaryBet.count || 1) / maxBetCount) * 100));

                            return (
                                <div
                                    key={m.key || `${m.eventId}-${idx}`}
                                    className="glass-panel"
                                    style={{
                                        padding: '1.3rem',
                                        borderRadius: '14px',
                                        border: `1px solid ${evalInfo.borderColor}`,
                                        background: `linear-gradient(165deg, ${evalInfo.bg}, rgba(15, 23, 42, 0.75))`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        boxShadow: `0 4px 20px ${evalInfo.borderColor}22`,
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-3px)';
                                        e.currentTarget.style.boxShadow = `0 8px 30px ${evalInfo.borderColor}44`;
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = `0 4px 20px ${evalInfo.borderColor}22`;
                                    }}
                                >
                                    {/* Top League & Status Badges */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', maxWidth: '65%' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase',
                                                    color: '#94a3b8',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    🏆 {m.competition || 'Soccer'}
                                                </span>
                                                {m.otherBets.length > 0 && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 800,
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                                        color: '#fbbf24',
                                                        padding: '0.15rem 0.45rem',
                                                        borderRadius: '6px',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        🔥 {m.bets.length} {t.trending_multiple_markets || 'Trend Bahis'}
                                                    </span>
                                                )}
                                            </div>

                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 900,
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '999px',
                                                background: evalInfo.bg,
                                                border: `1px solid ${evalInfo.borderColor}`,
                                                color: evalInfo.color,
                                                letterSpacing: '0.5px',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {evalInfo.badgeText}
                                            </span>
                                        </div>

                                        {/* Match Info & Score */}
                                        <div style={{ marginBottom: '0.8rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc', lineHeight: 1.3 }}>
                                                    {m.home} <span style={{ opacity: 0.3, fontWeight: 400 }}>vs</span> {m.away}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                {m.score && (
                                                    <span style={{
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '4px',
                                                        background: 'rgba(0, 0, 0, 0.4)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 900,
                                                        color: '#facc15'
                                                    }}>
                                                        ⚽ {m.score}
                                                    </span>
                                                )}
                                                {evalInfo.liveMatch?.minute && (
                                                    <span style={{
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '4px',
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        color: '#f87171'
                                                    }}>
                                                        ⏱️ {evalInfo.liveMatch.minute}'
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bet Market & Odds Box (Primary Bet) */}
                                        <div style={{
                                            padding: '0.8rem 1rem',
                                            borderRadius: '10px',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            marginBottom: '0.8rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    {formatTrendingMarket(m.primaryBet.market, m.primaryBet.marketShort, lang) || (lang === 'tr' ? 'Bahis Pazarı' : 'Bet Market')}
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.1rem' }}>
                                                    🎯 {formatTrendingOutcome(m.primaryBet.outcome, lang)}
                                                </div>
                                            </div>

                                            <div style={{
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '8px',
                                                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15))',
                                                border: '1px solid rgba(251, 191, 36, 0.4)',
                                                color: '#fbbf24',
                                                fontWeight: 900,
                                                fontSize: '1.1rem'
                                            }}>
                                                {typeof m.primaryBet.odds === 'number' ? m.primaryBet.odds.toFixed(2) : m.primaryBet.odds}
                                            </div>
                                        </div>

                                        {/* Public Bet Count & Heat Bar (Primary Bet) */}
                                        <div style={{ marginBottom: m.otherBets.length > 0 ? '0.6rem' : '0.8rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.75rem' }}>
                                                <span style={{ color: '#f87171', fontWeight: 800 }}>
                                                    🔥 {m.primaryBet.count} {t.trending_bets_placed || 'kupon oynandı'}
                                                </span>
                                                <span style={{ opacity: 0.4, fontSize: '0.7rem' }}>
                                                    {t.trending_last_5m || 'Son 5 dk'}
                                                </span>
                                            </div>
                                            <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${heatPercent}%`,
                                                    height: '100%',
                                                    borderRadius: '3px',
                                                    background: 'linear-gradient(90deg, #ef4444, #f97316)'
                                                }} />
                                            </div>
                                        </div>

                                        {/* Alternative Trending Bets in same match */}
                                        {m.otherBets.length > 0 && (
                                            <div style={{
                                                marginBottom: '0.8rem',
                                                padding: '0.65rem 0.8rem',
                                                borderRadius: '10px',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(255, 255, 255, 0.07)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.45rem'
                                            }}>
                                                <div style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase',
                                                    color: '#94a3b8',
                                                    letterSpacing: '0.5px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <span>⚡ {t.trending_other_bets || 'Bu Maçtaki Diğer Trend Bahisler'}</span>
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        padding: '0.1rem 0.45rem',
                                                        borderRadius: '999px',
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        color: '#fbbf24',
                                                        fontWeight: 900
                                                    }}>
                                                        +{m.otherBets.length}
                                                    </span>
                                                </div>
                                                {m.otherBets.map((ob, obIdx) => (
                                                    <div
                                                        key={ob.outcomeId || `${ob.marketId}-${obIdx}`}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '0.4rem 0.6rem',
                                                            borderRadius: '6px',
                                                            background: 'rgba(0, 0, 0, 0.25)',
                                                            border: '1px solid rgba(255, 255, 255, 0.04)',
                                                            fontSize: '0.78rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                                                            <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                                                                🎯 {formatTrendingOutcome(ob.outcome, lang)}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.68rem',
                                                                opacity: 0.75,
                                                                whiteSpace: 'nowrap',
                                                                background: 'rgba(255, 255, 255, 0.06)',
                                                                padding: '0.1rem 0.35rem',
                                                                borderRadius: '4px',
                                                                color: '#cbd5e1'
                                                            }}>
                                                                ({formatTrendingMarketShort(ob.marketShort, ob.market, lang)})
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                            <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700 }}>
                                                                🔥 {ob.count}
                                                            </span>
                                                            <span style={{
                                                                padding: '0.15rem 0.45rem',
                                                                borderRadius: '4px',
                                                                background: 'rgba(251, 191, 36, 0.15)',
                                                                border: '1px solid rgba(251, 191, 36, 0.3)',
                                                                color: '#fbbf24',
                                                                fontWeight: 900,
                                                                fontSize: '0.75rem'
                                                            }}>
                                                                {typeof ob.odds === 'number' ? ob.odds.toFixed(2) : ob.odds}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom AI Verification & Action */}
                                    <div>
                                        <div style={{
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            background: 'rgba(0,0,0,0.25)',
                                            border: `1px solid ${evalInfo.borderColor}66`,
                                            fontSize: '0.75rem',
                                            lineHeight: 1.4,
                                            color: '#cbd5e1',
                                            marginBottom: evalInfo.liveMatch ? '0.8rem' : 0
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                                <strong style={{ color: evalInfo.color, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    {evalInfo.icon} AI DOĞRULAMA
                                                </strong>
                                                {evalInfo.dqs !== null && (
                                                    <span style={{ fontWeight: 800, color: evalInfo.color, fontSize: '0.7rem' }}>
                                                        DQS: %{(evalInfo.dqs * 100).toFixed(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div>{evalInfo.desc}</div>
                                        </div>

                                        {evalInfo.liveMatch && (
                                            <button
                                                onClick={() => {
                                                    setSelectedMatch(evalInfo.liveMatch);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--accent-color)',
                                                    background: 'rgba(56, 189, 248, 0.12)',
                                                    color: 'var(--accent-color)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 900,
                                                    cursor: 'pointer',
                                                    letterSpacing: '0.5px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.4rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'var(--accent-color)';
                                                    e.currentTarget.style.color = '#000';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                                                    e.currentTarget.style.color = 'var(--accent-color)';
                                                }}
                                            >
                                                <span>⚡</span>
                                                <span>{t.trending_inspect_radar || 'RADARDA İNCELE'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`dashboard-container ${view === 'DASHBOARD' ? 'dashboard-live-mode' : ''}`} style={{ padding: '1.25rem 1rem', maxWidth: '1440px', width: '100%', boxSizing: 'border-box', margin: '0 auto', minHeight: '100vh', overflowX: 'clip', background: 'radial-gradient(circle at top right, #1e293b, #030712)' }}>

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
                        <div className="user-menu-wrapper" style={{ position: 'relative', zIndex: 9999 }}>
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
                                <div className="user-dropdown-popover glass-panel" style={{ zIndex: 99999 }}>
                                    <div className="user-popover-header">
                                        <div className="user-email-text">{isAdmin || userProfile?.plan === 'admin' ? 'admin@livebetmentor.com' : (user?.email || 'User')}</div>
                                        {isAdmin || userProfile?.plan === 'admin' ? (
                                            <div className="user-expiry-text" style={{ color: '#f59e0b', fontWeight: 800 }}>
                                                👑 {lang === 'tr' ? 'Süper Yönetici (Sınırsız)' : 'Super Admin (Unlimited)'}
                                            </div>
                                        ) : userProfile?.subscription_end && (
                                            <div className="user-expiry-text" style={{ color: (userProfile?.plan === 'trial' || (getRemainingDays(userProfile.subscription_end) ?? 999) <= 3) ? '#38bdf8' : '#94a3b8', fontWeight: 700 }}>
                                                {userProfile?.plan === 'trial' && remainingTrialSeconds > 0
                                                    ? `⏳ ${formatTrialCountdown(remainingTrialSeconds)} ${lang === 'tr' ? 'kaldı' : 'remaining'}`
                                                    : `⏳ ${getRemainingDays(userProfile.subscription_end)} ${t.days_remaining}`}
                                            </div>
                                        )}
                                    </div>

                                    <div className="user-popover-divider"></div>

                                    {/* Language Switch */}
                                    <div className="popover-row">
                                        <span className="popover-label">🌐 {lang === 'tr' ? 'Dil' : lang === 'de' ? 'Sprache' : 'Language'}</span>
                                        <div className="popover-lang-group">
                                            {['tr', 'en', 'de'].map(l => (
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
                            className={`unified-tab-btn trending ${view === 'TRENDING' ? 'active' : ''}`}
                            onClick={() => setView('TRENDING')}
                        >
                            <span>🔥</span>
                            <span>{t.trending_nav || (lang === 'tr' ? 'PİYASA TRENDLERİ' : 'MARKET TRENDS')}</span>
                            {trendingBets.length > 0 && (
                                <span
                                    className="tab-count-pill"
                                    style={{
                                        background: view === 'TRENDING' ? 'rgba(0,0,0,0.3)' : 'rgba(239, 68, 68, 0.25)',
                                        color: view === 'TRENDING' ? '#ffffff' : '#f87171',
                                        border: view === 'TRENDING' ? 'none' : '1px solid rgba(239, 68, 68, 0.4)'
                                    }}
                                >
                                    {new Set((trendingBets || []).map(b => b.eventId ? String(b.eventId) : `${b.home}_${b.away}`)).size}
                                </span>
                            )}
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

            {/* Slim Dismissible Membership / 24h Trial Countdown Banner */}
            {!isAdmin && userProfile?.plan !== 'admin' && !dismissTrialBanner && (
                userProfile?.plan === 'trial' ? (
                    <div className="slim-membership-banner glass-panel" style={{
                        background: 'linear-gradient(90deg, rgba(30, 27, 75, 0.95) 0%, rgba(49, 16, 66, 0.95) 50%, rgba(30, 27, 75, 0.95) 100%)',
                        border: '1px solid rgba(168, 85, 247, 0.45)',
                        boxShadow: '0 4px 20px rgba(168, 85, 247, 0.25)',
                        padding: '0.65rem 1.2rem'
                    }}>
                        <div className="banner-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="banner-icon" style={{ fontSize: '1.3rem' }}>⏳</span>
                            <div className="banner-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ color: '#c084fc', letterSpacing: '0.5px' }}>
                                    {lang === 'tr' ? '24 SAATLİK PRO DENEME:' : '24H PRO TRIAL:'}
                                </strong>
                                <span style={{
                                    background: 'rgba(0, 0, 0, 0.55)',
                                    border: '1px solid rgba(56, 189, 248, 0.55)',
                                    color: '#38bdf8',
                                    fontFamily: 'monospace',
                                    fontWeight: 900,
                                    fontSize: '0.95rem',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    letterSpacing: '1px',
                                    boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)'
                                }}>
                                    {formatTrialCountdown(remainingTrialSeconds)}
                                </span>
                                <span style={{ color: '#e2e8f0', fontSize: '0.82rem', opacity: 0.9 }}>
                                    {lang === 'tr'
                                        ? '— VIP xG Radarı, Alevli Maçlar & Telegram Sinyalleri Aktif'
                                        : '— VIP xG Radar, Hot Matches & Telegram Signals Active'}
                                </span>
                            </div>
                        </div>
                        <div className="banner-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => setShowPlanComparison(true)}
                                className="banner-upgrade-btn"
                                style={{
                                    background: 'linear-gradient(135deg, #a855f7, #38bdf8)',
                                    color: '#000',
                                    fontWeight: 900,
                                    boxShadow: '0 2px 10px rgba(168, 85, 247, 0.4)'
                                }}
                            >
                                ⚡ {lang === 'tr' ? '%30 İndirimle VIP\'ye Geç' : 'Upgrade to VIP (30% OFF)'}
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
                ) : (
                    (userProfile?.subscription_end && getRemainingDays(userProfile?.subscription_end) !== null && getRemainingDays(userProfile?.subscription_end) <= 3) && (
                        <div className="slim-membership-banner glass-panel">
                            <div className="banner-left">
                                <span className="banner-icon">⚠️</span>
                                <div className="banner-text">
                                    <strong>{t.expiry_warning}:</strong>
                                    <span> {`${getRemainingDays(userProfile?.subscription_end)} ${t.days_remaining}`}</span>
                                </div>
                            </div>
                            <div className="banner-right">
                                <button
                                    onClick={() => setShowPlanComparison(true)}
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
                    )
                )
            )}

            {/* Mobile Breaking Ticker: Real-Time Social Proof & In-Play Feed */}
            <div className="mobile-breaking-ticker">
                <span className="ticker-pulse-badge">
                    <span className="ticker-pulse-dot"></span>
                    <span>{lang === 'tr' ? 'CANLI AKIŞ' : 'LIVE FEED'}</span>
                </span>
                <span className="ticker-content">
                    {(() => {
                        const hotMatches = matches.filter(m => (m.stats?.attacks?.home || 0) + (m.stats?.attacks?.away || 0) > 35);
                        if (hotMatches.length > 0) {
                            const topM = hotMatches[0];
                            return lang === 'tr'
                                ? `🔥 ${topM.homeTeam || 'Ev'} - ${topM.awayTeam || 'Dep'} maçında dakikanın gol baskısı yakalandı!`
                                : `🔥 Intense in-play pressure detected in ${topM.homeTeam || 'Home'} - ${topM.awayTeam || 'Away'}!`;
                        }
                        return lang === 'tr'
                            ? `⚡ Canlı İvme Radarı aktif · 24/7 algoritmik değer fırsatları taranıyor...`
                            : `⚡ Live Momentum Radar active · Scanning real-time value edges...`;
                    })()}
                </span>
            </div>

            {/* Mobile Bankroll Glance Bar (Compact 1-Line with click to Portfolio) */}
            <div className="mobile-bankroll-glance" onClick={() => setView('PORTFOLIO')}>
                <div className="glance-left">
                    <span style={{ fontSize: '1rem' }}>💰</span>
                    <span className="glance-balance">{bankState.current_balance.toLocaleString()} ₺</span>
                    <span className={`glance-pl ${bankState.daily_pl >= 0 ? 'positive' : 'negative'}`}>
                        {bankState.daily_pl >= 0 ? '+' : ''}{bankState.daily_pl.toLocaleString()} ₺
                    </span>
                </div>
                <div className="glance-right">
                    <span>🛡️ {bankrollManager.getModeLabel(lang)}</span>
                    <span style={{ fontSize: '0.8rem' }}>➔</span>
                </div>
            </div>

            {view === 'PORTFOLIO' ? (
                renderPortfolio()
            ) : view === 'TRENDING' ? (
                renderTrending()
            ) : view === 'ADMIN' ? (
                <AdminPanel lang={lang} />
            ) : view === 'RADAR' ? (
                <div className="radar-view">
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
                            <div className="market-tabs radar-market-chips" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
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
                        <div className="glass-panel radar-filter-panel" style={{
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
                                <div className="radar-source-chips" style={{ display: 'flex', gap: '0.5rem' }}>
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
                                        minSources: 2,
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

                    <div className="radar-grid radar-cards-grid" style={{
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
                                                <div title={lang === 'tr' ? "Canlı Oynanıyor" : "Match in play"} style={{ background: '#ef4444', color: '#fff', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}>{lang === 'tr' ? '🔴 CANLI' : '🔴 LIVE'}</div>
                                            )}
                                            {s.isUpcoming && s.minutesUntilKickoff > 0 && s.minutesUntilKickoff <= 120 && (
                                                <div title={lang === 'tr' ? "Başlamak Üzere" : "Starting soon"} style={{ background: '#f59e0b', color: '#000', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>⏳ {s.minutesUntilKickoff} {lang === 'tr' ? 'DK' : 'MIN'}</div>
                                            )}
                                            {s.isFinished && (
                                                <div title={lang === 'tr' ? "Maç Sona Erdi" : "Match finished"} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>{lang === 'tr' ? '🏁 BİTTİ' : '🏁 ENDED'}</div>
                                            )}
                                            {s.divergence > CONFIG.MODULAR_SYSTEM.ADVANCED_ANALYSIS.DIVERGENCE_RADAR.THRESHOLD && (
                                                <div title="Conflicting Source Predictions" style={{ background: 'var(--danger-color)', color: '#fff', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 900, borderRadius: '4px' }}>{lang === 'tr' ? 'DİKKAT' : 'CAUTION'}</div>
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
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{t.global_consensus_report} ({s.totalSources}/{RADAR_SOURCES.length} {t.active_badges || 'Kaynak'})</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {agreementPercent >= 70 && s.totalSources >= 2 && (
                                                        <div style={{
                                                            fontSize: '0.65rem',
                                                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(56, 189, 248, 0.2))',
                                                            color: '#34d399',
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontWeight: 900,
                                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                                            boxShadow: '0 0 10px rgba(16, 185, 129, 0.25)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            🔥 %{agreementPercent} {lang === 'tr' ? 'GÜÇLÜ KONSENSÜS' : 'STRONG CONSENSUS'}
                                                        </div>
                                                    )}
                                                    {agreementPercent < 60 && s.totalSources >= 2 && (
                                                        <div style={{ fontSize: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                            ⚠️ {t.divergence_flag || 'DIVERGENCE'}
                                                        </div>
                                                    )}
                                                </div>
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
                                                                            ({Number(s.probabilities[site]) > 100 ? `${lang === 'tr' ? 'İndeks' : 'Index'}: ${s.probabilities[site]}` : `%${s.probabilities[site]}`})
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

                                            {isAdmin && (
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
                                            )}
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
                                    <span style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{lang === 'tr' ? 'CANLI RADAR' : 'LIVE RADAR'}</span>
                                    <span style={{ opacity: 0.4, marginLeft: '0.5rem' }}>{t.settings_frozen}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tier Filter Bar */}
                    <div className="tier-filter-bar">
                        {['ALL', 1, 2, 3].map(tier => {
                            const count = tier === 'ALL' ? matches.length : matches.filter(m => m.tier === tier).length;
                            const isAll = tier === 'ALL';
                            const tierSub = tier === 1 ? 'CORE' : tier === 2 ? 'STABLE' : tier === 3 ? 'DISCOVERY' : '';

                            return (
                                <button
                                    key={tier}
                                    type="button"
                                    onClick={() => setActiveTierFilter(tier)}
                                    className={`tier-btn ${activeTierFilter === tier ? 'active' : ''}`}
                                >
                                    <div className="tier-btn-text">
                                        <span className="tier-btn-main">
                                            <span className="tier-label-short">{isAll ? (lang === 'tr' ? 'TÜMÜ' : 'ALL') : `T${tier}`}</span>
                                            <span className="tier-label-full">{isAll ? (lang === 'tr' ? 'TÜMÜ' : 'ALL') : `TIER ${tier}`}</span>
                                        </span>
                                        <span className="tier-btn-desktop-full">
                                            {isAll ? (t.tier_filter_all || 'TÜM LİGLER') : (t[`tier_${tier}_label`] || `TIER ${tier}`)}
                                        </span>
                                        {tierSub && (
                                            <span className="tier-btn-sub">{tierSub}</span>
                                        )}
                                    </div>
                                    <span className="tier-btn-count">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>



                    {/* ==================== BETBALLERS STYLE COCKPIT TOOLBAR ==================== */}
                    <div className="tb-cockpit-toolbar">
                        {/* Top row on mobile, left block on desktop */}
                        <div className="tb-toolbar-row-top">
                            {/* View Mode Switcher */}
                            <div className="tb-mode-switcher">
                                <button
                                    type="button"
                                    className={`tb-mode-btn ${displayViewMode === 'TERMINAL' ? 'active' : ''}`}
                                    onClick={() => handleSwitchViewMode('TERMINAL')}
                                    title={lang === 'tr' ? 'BetBallers Stili Dinamik ve Kompakt Canlı Tablo' : 'BetBallers Style Live Terminal'}
                                >
                                    <span>📊</span>
                                    <span className="tb-btn-label-full">{lang === 'tr' ? 'Canlı Terminal' : 'Live Terminal'}</span>
                                    <span className="tb-btn-label-short">{lang === 'tr' ? 'Terminal' : 'Terminal'}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`tb-mode-btn ${displayViewMode === 'CLASSIC' ? 'active' : ''}`}
                                    onClick={() => handleSwitchViewMode('CLASSIC')}
                                    title={lang === 'tr' ? 'Klasik Kart Görünümü' : 'Classic Cards View'}
                                >
                                    <span>🎴</span>
                                    <span className="tb-btn-label-full">{lang === 'tr' ? 'Klasik Kartlar' : 'Classic Cards'}</span>
                                    <span className="tb-btn-label-short">{lang === 'tr' ? 'Klasik' : 'Classic'}</span>
                                </button>
                            </div>

                            {/* Dynamic Re-order Lock / Stream Status */}
                            {displayViewMode === 'TERMINAL' && (
                                <button
                                    type="button"
                                    onClick={handleToggleLockSort}
                                    className={`tb-stream-status ${isSortLocked ? 'locked' : 'live'}`}
                                    title={isSortLocked ? (lang === 'tr' ? 'Sıralama kilitli. Canlı akışı başlatmak için tıklayın.' : 'Sort locked. Click to resume live stream.') : (lang === 'tr' ? 'Canlı sıralama devrede. Sıralamayı sabitlemek için tıklayın.' : 'Live sorting active. Click to lock order.')}
                                >
                                    <span className="tb-pulse-dot" />
                                    <span className="tb-status-full">
                                        {isSortLocked
                                            ? (lang === 'tr' ? '🔒 Sıralama Kilitli' : '🔒 Sort Locked')
                                            : (lang === 'tr' ? '🟢 Canlı Akış (Momentum)' : '🟢 Live Stream (Momentum)')}
                                    </span>
                                    <span className="tb-status-short">
                                        {isSortLocked
                                            ? (lang === 'tr' ? '🔒 Sabit' : '🔒 Locked')
                                            : (lang === 'tr' ? '🟢 Canlı' : '🟢 Live')}
                                    </span>
                                </button>
                            )}

                            {/* Mobile Sub-View Switcher: [ 📱 Kart | 📋 Tablo ] */}
                            {displayViewMode === 'TERMINAL' && (
                                <div className="tb-mobile-view-toggle">
                                    <button
                                        type="button"
                                        className={`tb-sub-btn ${terminalMobileSubView === 'CARDS' ? 'active' : ''}`}
                                        onClick={() => handleSetTerminalMobileSubView('CARDS')}
                                        title={lang === 'tr' ? 'Mobil Net Kart Görünümü' : 'Mobile Cards View'}
                                    >
                                        <span>📱</span>
                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Kartlar' : 'Cards'}</span>
                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Kart' : 'Cards'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`tb-sub-btn ${terminalMobileSubView === 'TABLE' ? 'active' : ''}`}
                                        onClick={() => handleSetTerminalMobileSubView('TABLE')}
                                        title={lang === 'tr' ? 'Genişletilmiş Tablo Görünümü' : 'Full Table View'}
                                    >
                                        <span>📋</span>
                                        <span>{lang === 'tr' ? 'Tablo' : 'Table'}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Bottom row on mobile, right block on desktop */}
                        {displayViewMode === 'TERMINAL' && (
                            <div className="tb-toolbar-row-bottom">
                                {/* Search Box */}
                                <div className="tb-search-box">
                                    <span>🔍</span>
                                    <input
                                        type="text"
                                        placeholder={lang === 'tr' ? 'Takım veya lig ara...' : 'Filter team or league...'}
                                        value={terminalSearchQuery}
                                        onChange={(e) => setTerminalSearchQuery(e.target.value)}
                                    />
                                    {terminalSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setTerminalSearchQuery('')}
                                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Sort criteria selector */}
                                <div className="tb-sort-wrapper">
                                    <span className="tb-sort-label">
                                        {lang === 'tr' ? 'Sırala:' : 'Sort:'}
                                    </span>
                                    <select
                                        className="tb-sort-select"
                                        value={terminalSortCriteria}
                                        onChange={(e) => setTerminalSortCriteria(e.target.value)}
                                    >
                                        <option value={SORT_CRITERIA.MOMENTUM}>🔥 {lang === 'tr' ? 'Canlı İvme' : 'Live Momentum'}</option>
                                        <option value={SORT_CRITERIA.GOAL_PROB}>🧠 {lang === 'tr' ? 'Gol İhtimali' : 'Goal Probability'}</option>
                                        <option value={SORT_CRITERIA.LAST_20_MIN}>⚡ {lang === 'tr' ? 'Son 20 Dk İvmesi' : 'Last 20m Momentum'}</option>
                                        <option value={SORT_CRITERIA.TREND_VOLUME}>📈 {lang === 'tr' ? 'Kupon Hacmi' : 'Market Volume'}</option>
                                        <option value={SORT_CRITERIA.MINUTE_DESC}>⏱️ {lang === 'tr' ? 'Dakika' : 'Minute'}</option>
                                        <option value={SORT_CRITERIA.DQS}>🎯 {lang === 'tr' ? 'AI DQS' : 'AI DQS'}</option>
                                        <option value={SORT_CRITERIA.LEAGUE}>🏆 {lang === 'tr' ? 'Lig' : 'League'}</option>
                                        <option value={SORT_CRITERIA.TOTAL_SHOTS}>💥 {lang === 'tr' ? 'Toplam Şut' : 'Total Shots'}</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {displayViewMode === 'TERMINAL' ? (
                        <section className="dashboard-section terminal-cockpit-section" style={{ marginBottom: '3rem' }}>
                            {/* Quick Category Filter Strip with Two Mini Sub-Tabs */}
                            {(() => {
                                const radarMatchesCount = enforcedMatches.filter(filterByTier).filter(m => 
                                    isMatchHighGoalProb(m, signals[m.id], 0.55) ||
                                    isMatchXgSurplus(m, signals[m.id]) ||
                                    isMatchSurgingLast20(m, signals[m.id]) ||
                                    isMatchGoldenMinutes(m, signals[m.id]) ||
                                    isMatchComeback(m, signals[m.id])
                                ).length;

                                return (
                                    <div className="tb-filter-strip-wrapper">
                                        {/* Sub-Tab Navigation Bar between General and Radars */}
                                        <div className="tb-filter-nav-bar">
                                            <div className="tb-filter-group-nav">
                                                <button
                                                    type="button"
                                                    className={`tb-group-nav-btn ${filterGroupMode === 'GENERAL' ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setFilterGroupMode('GENERAL');
                                                        if (['RADAR_ALL', 'GOAL_PROB', 'XG_SURPLUS', 'SURGE_20', 'GOLDEN_MIN', 'COMEBACK'].includes(terminalCategoryFilter)) {
                                                            setTerminalCategoryFilter('ALL');
                                                        }
                                                    }}
                                                >
                                                    <span>📋</span>
                                                    <span className="tb-btn-label-full">{lang === 'tr' ? 'Genel Filtreler' : 'General'}</span>
                                                    <span className="tb-btn-label-short">{lang === 'tr' ? 'Genel' : 'General'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`tb-group-nav-btn radar-mode ${filterGroupMode === 'RADAR' ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setFilterGroupMode('RADAR');
                                                        if (!['RADAR_ALL', 'GOAL_PROB', 'XG_SURPLUS', 'SURGE_20', 'GOLDEN_MIN', 'COMEBACK'].includes(terminalCategoryFilter)) {
                                                            setTerminalCategoryFilter('RADAR_ALL');
                                                        }
                                                    }}
                                                >
                                                    <span>🎯</span>
                                                    <span className="tb-btn-label-full">{lang === 'tr' ? 'Canlı Fırsat Radarları' : 'In-Play Radars'}</span>
                                                    <span className="tb-btn-label-short">{lang === 'tr' ? 'Radarlar' : 'Radars'}</span>
                                                    {radarMatchesCount > 0 && (
                                                        <span className="tb-group-badge">{radarMatchesCount}</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Chips List: Dynamically toggles based on filterGroupMode */}
                                        <div className="tb-filter-strip" ref={filterStripRef}>
                                            {filterGroupMode === 'GENERAL' ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip ${terminalCategoryFilter === 'ALL' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('ALL')}
                                                    >
                                                        <span>⚡</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Tümü' : 'All'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Tümü' : 'All'}</span>
                                                        <span className="tb-chip-count">{enforcedMatches.filter(filterByTier).length}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-hot ${terminalCategoryFilter === 'HOT' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('HOT')}
                                                    >
                                                        <span>🔥</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Sıcak Fırsatlar' : 'Hot Picks'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Sıcak' : 'Hot'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => isMatchHot(m, signals[m.id])).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-trend ${terminalCategoryFilter === 'TREND' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('TREND')}
                                                        title={lang === 'tr' ? 'Avrupa piyasasında trend olan ve şu an canlı radarınızda oynanan maçlar' : 'Trending matches currently active in live radar'}
                                                    >
                                                        <span>📈</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Canlı Trendler' : 'Live Trends'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Trend' : 'Trends'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => {
                                                                return (trendingBets || []).some(tb => 
                                                                    consensusAdapter._isFuzzyMatch(tb.home, tb.away, m.homeTeam, m.awayTeam) ||
                                                                    consensusAdapter._isFuzzyMatch(tb.away, tb.home, m.homeTeam, m.awayTeam)
                                                                );
                                                            }).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-bet ${terminalCategoryFilter === 'BET' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('BET')}
                                                    >
                                                        <span>✓</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'AI Bahis Sinyali' : 'AI Signals'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'AI Sinyal' : 'Signals'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => signals[m.id]?.verdict === 'BET').length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-second-half ${terminalCategoryFilter === 'SECOND_HALF' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('SECOND_HALF')}
                                                    >
                                                        <span>⏱️</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? '2. Yarı (45\'+)' : '2nd Half'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? '2. Yarı' : '2H'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => {
                                                                const minStr = String(m.minute || '');
                                                                const min = parseInt(minStr, 10);
                                                                return min >= 45 || minStr.includes('2.Y') || minStr.includes('2H');
                                                            }).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-pinned ${terminalCategoryFilter === 'PINNED' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('PINNED')}
                                                    >
                                                        <span>★</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Favoriler' : 'Favorites'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Favori' : 'Favs'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => pinnedMatchIds.has(m.id)).length}
                                                        </span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-radar-all ${terminalCategoryFilter === 'RADAR_ALL' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('RADAR_ALL')}
                                                        title={lang === 'tr' ? 'Tüm fırsat radarlarından en az birine uyan canlı maçlar' : 'Matches matching any opportunity radar'}
                                                    >
                                                        <span>🎯</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Tüm Radarlar' : 'All Radars'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Tümü' : 'All'}</span>
                                                        <span className="tb-chip-count">{radarMatchesCount}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-goal-prob ${terminalCategoryFilter === 'GOAL_PROB' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('GOAL_PROB')}
                                                        title={lang === 'tr' ? 'Şut, xG ve saha baskısı analitiğine göre sıradaki gol ihtimali %55 ve üzeri olan canlı maçlar' : 'Live matches with in-play next goal probability >= 55%'}
                                                    >
                                                        <span>🧠</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Gol Radarı' : 'Goal Radar'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Gol' : 'Goals'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => isMatchHighGoalProb(m, signals[m.id], 0.55)).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-xg-surplus ${terminalCategoryFilter === 'XG_SURPLUS' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('XG_SURPLUS')}
                                                        title={lang === 'tr' ? 'Yüksek xG ve şut üretmesine rağmen skorborda yansımamış, yüksek oran vadeden değerli maçlar' : 'Matches generating heavy xG not yet rewarded on scoreboard'}
                                                    >
                                                        <span>⏳</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Geciken Gol' : 'Unrewarded xG'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Geciken' : 'Late Goal'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => isMatchXgSurplus(m, signals[m.id])).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-surge ${terminalCategoryFilter === 'SURGE_20' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('SURGE_20')}
                                                        title={lang === 'tr' ? 'Son 20 dakikada hücum temposu ve tehlike ivmesi tavan yapan canlı maçlar' : 'Matches with surging offensive momentum in the last 20 minutes'}
                                                    >
                                                        <span>⚡</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? '20\' Baskısı' : '20m Surge'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? '20\' Baskı' : '20m Surge'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => isMatchSurgingLast20(m, signals[m.id])).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-golden-min ${terminalCategoryFilter === 'GOLDEN_MIN' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('GOLDEN_MIN')}
                                                        title={lang === 'tr' ? '68-85. dakika aralığında tek farkla devam eden ve tempolu hücum yapılan altın pencere maçları' : 'High-tempo close matches in the 68-85 min golden scoring window'}
                                                    >
                                                        <span>⏱️</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Altın Saat' : 'Golden Window'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Altın' : 'Golden'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => isMatchGoldenMinutes(m, signals[m.id])).length}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`tb-chip chip-comeback ${terminalCategoryFilter === 'COMEBACK' ? 'active' : ''}`}
                                                        onClick={() => setTerminalCategoryFilter('COMEBACK')}
                                                        title={lang === 'tr' ? 'Skor olarak geride olan ama sahada rakip kaleyi ablukaya alan takımların maçları' : 'Trailing teams intensely sieging the opponent for a comeback'}
                                                    >
                                                        <span>🔄</span>
                                                        <span className="tb-btn-label-full">{lang === 'tr' ? 'Geri Dönüş' : 'Comeback'}</span>
                                                        <span className="tb-btn-label-short">{lang === 'tr' ? 'Dönüş' : 'Comeback'}</span>
                                                        <span className="tb-chip-count">
                                                            {enforcedMatches.filter(filterByTier).filter(m => isMatchComeback(m, signals[m.id])).length}
                                                        </span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Active RADAR_ALL Explanatory Banner */}
                            {terminalCategoryFilter === 'RADAR_ALL' && (
                                <div style={{
                                    padding: '0.45rem 0.85rem',
                                    marginBottom: '0.8rem',
                                    background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, rgba(234, 88, 12, 0.08) 100%)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    color: '#fbbf24',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>🎯</span>
                                    <span>
                                        <strong>{lang === 'tr' ? 'Tüm Fırsat Radarları (Konsolide):' : 'All In-Play Radars (Consolidated):'}</strong>{' '}
                                        {lang === 'tr' 
                                            ? 'Gol Radarı, Geciken Gol, 20 Dk Baskısı, Altın Saat veya Geri Dönüş şartlarından en az birini sağlayan tüm canlı maçları listeler.'
                                            : 'Aggregates all live matches meeting any of the 5 specialized opportunity radar conditions.'}
                                    </span>
                                </div>
                            )}

                            {/* Active SURGE_20 Explanatory Banner */}
                            {terminalCategoryFilter === 'SURGE_20' && (
                                <div style={{
                                    padding: '0.45rem 0.85rem',
                                    marginBottom: '0.8rem',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    color: '#fde047',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>⚡</span>
                                    <span>
                                        <strong>{lang === 'tr' ? 'Son 20 Dakika Abluka Radarı:' : 'Last 20-Min Siege Radar:'}</strong>{' '}
                                        {lang === 'tr' 
                                            ? 'Son 20 dakikada hücum temposunu katlayan ve rakip kaleye yüklenen takımları listeler.'
                                            : 'Highlights matches where a team is intensely dominating the opponent in the last 20 minutes.'}
                                    </span>
                                </div>
                            )}

                            {/* Active GOAL_PROB Explanatory Banner */}
                            {terminalCategoryFilter === 'GOAL_PROB' && (
                                <div style={{
                                    padding: '0.45rem 0.85rem',
                                    marginBottom: '0.8rem',
                                    background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    color: '#38bdf8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>🧠</span>
                                    <span>
                                        <strong>{lang === 'tr' ? 'Canlı Gol Radarı (Bayesian Olasılık):' : 'Live Goal Radar (Bayesian Probability):'}</strong>{' '}
                                        {lang === 'tr' 
                                            ? 'Şut hacmi, xG kalitesi ve anlık baskı ivmesine göre sıradaki gol gelme ihtimali %55 ve üzeri olan maçları listeler.'
                                            : 'Lists live matches where shot volume, xG quality, and momentum elevate next goal probability above 55%.'}
                                    </span>
                                </div>
                            )}

                            {/* Active XG_SURPLUS Explanatory Banner */}
                            {terminalCategoryFilter === 'XG_SURPLUS' && (
                                <div style={{
                                    padding: '0.45rem 0.85rem',
                                    marginBottom: '0.8rem',
                                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.08) 100%)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    color: '#34d399',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>⏳</span>
                                    <span>
                                        <strong>{lang === 'tr' ? 'Geciken Gol Radarı (xG Açığı & Değerli Bahis):' : 'Unrewarded xG Radar (Value Bets):'}</strong>{' '}
                                        {lang === 'tr' 
                                            ? 'Yüksek xG (Beklenen Gol) ve şut üretmesine rağmen skorborda henüz yansımamış, yüksek oran potansiyeli olan maçları listeler.'
                                            : 'Highlights matches generating heavy xG not yet rewarded on the scoreboard (Prime Value).'}
                                    </span>
                                </div>
                            )}

                            {/* Active GOLDEN_MIN Explanatory Banner */}
                            {terminalCategoryFilter === 'GOLDEN_MIN' && (
                                <div style={{
                                    padding: '0.45rem 0.85rem',
                                    marginBottom: '0.8rem',
                                    background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.1) 0%, rgba(245, 158, 11, 0.08) 100%)',
                                    border: '1px solid rgba(234, 179, 8, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    color: '#facc15',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>⏱️</span>
                                    <span>
                                        <strong>{lang === 'tr' ? 'Altın Dakikalar Radarı (68\' - 85\' Baskısı):' : 'Golden Window Radar (68\' - 85\' Pressure):'}</strong>{' '}
                                        {lang === 'tr' 
                                            ? 'Canlı bahiste oranların tavan yaptığı ve en çok golün çıktığı 68-85. dakika aralığında tek farkla devam eden tempolu maçları listeler.'
                                            : 'Targets high-tempo close matches in the prime scoring window (68\'-85\') where late-goal odds are maximized.'}
                                    </span>
                                </div>
                            )}

                            {/* Active COMEBACK Explanatory Banner */}
                            {terminalCategoryFilter === 'COMEBACK' && (
                                <div style={{
                                    padding: '0.45rem 0.85rem',
                                    marginBottom: '0.8rem',
                                    background: 'linear-gradient(90deg, rgba(244, 63, 94, 0.1) 0%, rgba(225, 29, 72, 0.08) 100%)',
                                    border: '1px solid rgba(244, 63, 94, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    color: '#fb7185',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>🔄</span>
                                    <span>
                                        <strong>{lang === 'tr' ? 'Geri Dönüş Radarı (Baskı Kuran Takım Geride):' : 'Comeback Radar (Dominant Trailing Team):'}</strong>{' '}
                                        {lang === 'tr' 
                                            ? 'Skor olarak geride olmasına rağmen sahada rakibini abluka altına alan ve geri dönüş arayan takımların maçlarını listeler.'
                                            : 'Highlights teams that are currently trailing on the scoreboard but intensely besieging the opponent for an equalizer.'}
                                    </span>
                                </div>
                            )}

                            {/* Live Terminal Views (Desktop Table & Mobile Stream) */}
                            <LiveTerminalTable
                                matches={processedTerminalMatches}
                                signals={signals}
                                trendingBets={trendingBets}
                                opportunitiesMap={terminalOpportunitiesMap}
                                t={t}
                                lang={lang}
                                selectedMatch={selectedMatch}
                                onSelectMatch={setSelectedMatch}
                                onApproveBet={handleTerminalApproveBet}
                                bankrollManager={bankrollManager}
                                pinnedMatchIds={pinnedMatchIds}
                                togglePinMatch={togglePinMatch}
                                AttackMomentumGraph={AttackMomentumGraph}
                                MatchIncidentsTimeline={MatchIncidentsTimeline}
                                mobileTableMode={terminalMobileSubView === 'TABLE'}
                                userProfile={userProfile}
                                onOpenUpgrade={() => setShowPlanComparison(true)}
                            />

                            <LiveTerminalMobile
                                matches={processedTerminalMatches}
                                signals={signals}
                                trendingBets={trendingBets}
                                opportunitiesMap={terminalOpportunitiesMap}
                                t={t}
                                lang={lang}
                                selectedMatch={selectedMatch}
                                onSelectMatch={setSelectedMatch}
                                onApproveBet={handleTerminalApproveBet}
                                bankrollManager={bankrollManager}
                                pinnedMatchIds={pinnedMatchIds}
                                togglePinMatch={togglePinMatch}
                                AttackMomentumGraph={AttackMomentumGraph}
                                MatchIncidentsTimeline={MatchIncidentsTimeline}
                                hideInTableMode={terminalMobileSubView === 'TABLE'}
                                userProfile={userProfile}
                                onOpenUpgrade={() => setShowPlanComparison(true)}
                            />

                            {/* Global AI Section */}
                            <div style={{ marginTop: '3rem' }}>
                                {renderGlobalAISection('LIVE')}
                            </div>
                        </section>
                    ) : (
                        <>
                            {/* Live Opportunities Panel - Sıcak Fırsatlar & Canlı Radar */}
                            {(() => {
                        const oppMatches = matches.filter(filterByTier).filter(m => {
                            const minStr = String(m.minute || '').toLowerCase();
                            const code = m.status?.code;
                            const desc = String(m.status?.description || '').toLowerCase();
                            const isPen = code === 120 || code === 110 || minStr === 'pen.' || minStr.includes('pen') || desc.includes('penalt');
                            return !isPen;
                        });
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

                            if (isCompact) {
                                return (
                                    <div
                                        key={opp.matchId}
                                        onClick={() => setSelectedMatch(match)}
                                        className="opp-card-container"
                                        style={{
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(15, 23, 42, 0.45)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            opacity: 0.8
                                        }}
                                    >
                                        <div className="opp-meta-row">
                                            <div className="opp-meta-left">
                                                <div className="opp-rank-badge" style={{ background: heatStyle.text }}>
                                                    #{idx + 1}
                                                </div>
                                                {(match.league || match.leagueName) && (
                                                    <span className="opp-league-pill">
                                                        {match.league || match.leagueName}
                                                    </span>
                                                )}
                                                <div className="opp-minute-pill">
                                                    {renderMatchMinute(match.minute, t, false)}
                                                </div>
                                            </div>
                                            <div className="opp-meta-right">
                                                <div className="opp-heat-pill" style={{ color: heatStyle.text }}>
                                                    <span>{opp.score}</span>
                                                    <span style={{ fontSize: '0.58rem', opacity: 0.8 }}>{opp.heatLevel}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="opp-teams-hero" style={{ padding: '0.1rem 0' }}>
                                            <div className="opp-team-side home">
                                                <span className="opp-team-name">{match.homeTeam}</span>
                                            </div>
                                            <div className="opp-score-box" style={{ fontSize: '1rem', padding: '2px 10px' }}>
                                                <span>{match.score?.home ?? 0}</span>
                                                <span className="opp-score-divider">-</span>
                                                <span>{match.score?.away ?? 0}</span>
                                            </div>
                                            <div className="opp-team-side away">
                                                <span className="opp-team-name">{match.awayTeam}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center', opacity: 0.7 }}>
                                            ⏳ Derin İstatistikler Yükleniyor...
                                        </div>
                                    </div>
                                );
                            }

                            // Full Non-Compact Card
                            const daHome = Number(match.stats?.dangerousAttacks?.home || 0);
                            const daAway = Number(match.stats?.dangerousAttacks?.away || 0);
                            const sogHome = Number(match.stats?.shotsOnGoal?.home || 0);
                            const sogAway = Number(match.stats?.shotsOnGoal?.away || 0);
                            const cornersHome = Number(match.stats?.corners?.home || 0);
                            const cornersAway = Number(match.stats?.corners?.away || 0);
                            const xgHome = Number(match.stats?.xg?.home || 0);
                            const xgAway = Number(match.stats?.xg?.away || 0);
                            const pressHome = Number(match.observations?.pressure?.home || 0);
                            const pressAway = Number(match.observations?.pressure?.away || 0);
                            const velocityTrend = match.observations?.velocity?.trend || 'STABLE';

                            // Weighted Attack Pressure Index
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
                            const isHot = velocityTrend === 'HOT';
                            const odds = (match.matchedOdds && match.matchedOdds.home) ? match.matchedOdds : opp.oddsInfo;

                            return (
                                <div
                                    key={opp.matchId}
                                    onClick={() => setSelectedMatch(match)}
                                    className="opp-card-container"
                                    style={{
                                        background: heatStyle.bg,
                                        border: `1px solid ${heatStyle.border}`,
                                        animation: isTop ? 'pulse 2s infinite' : 'none'
                                    }}
                                >
                                    {/* 1. Meta Row: Rank, League, Minute, Heat, Telegram */}
                                    <div className="opp-meta-row">
                                        <div className="opp-meta-left">
                                            <div className="opp-rank-badge" style={{ background: heatStyle.text }}>
                                                #{idx + 1}
                                            </div>
                                            {(match.league || match.leagueName) && (
                                                <span className="opp-league-pill">
                                                    {match.league || match.leagueName}
                                                </span>
                                            )}
                                            <div className="opp-minute-pill">
                                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
                                                {renderMatchMinute(match.minute, t, false)}
                                            </div>
                                        </div>

                                        <div className="opp-meta-right">
                                            <div className="opp-heat-pill" style={{ color: heatStyle.text }}>
                                                <span>{opp.score}</span>
                                                <span style={{ fontSize: '0.58rem', opacity: 0.8 }}>{opp.heatLevel}</span>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleSendToTelegram(e, match, opp)}
                                                    className="opp-telegram-btn"
                                                    title={lang === 'tr' ? "VIP Gruba Gönder" : "Send to VIP Group"}
                                                >
                                                    ✈️
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Teams & Score Hero */}
                                    <div className="opp-teams-hero">
                                        <div className="opp-team-side home">
                                            <span className="opp-team-name">
                                                {match.homeTeam}
                                                {isHomeHeavy && <span style={{ color: '#38bdf8', marginLeft: '4px', fontSize: '0.75rem', animation: 'pulse 1s infinite' }} title={lang === 'tr' ? "Yoğun Ev Baskısı" : "Heavy Home Pressure"}>⚡▶</span>}
                                            </span>
                                            {((match.cards?.home?.red || 0) > 0 || (match.stats?.cards?.home?.red || 0) > 0) && (
                                                <span className="opp-micro-badge" style={{ background: '#ef4444', color: '#fff' }}>
                                                    🟥 {(match.cards?.home?.red || match.stats?.cards?.home?.red)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="opp-score-box">
                                            <span>{match.score?.home ?? 0}</span>
                                            <span className="opp-score-divider">-</span>
                                            <span>{match.score?.away ?? 0}</span>
                                        </div>

                                        <div className="opp-team-side away">
                                            {((match.cards?.away?.red || 0) > 0 || (match.stats?.cards?.away?.red || 0) > 0) && (
                                                <span className="opp-micro-badge" style={{ background: '#ef4444', color: '#fff' }}>
                                                    🟥 {(match.cards?.away?.red || match.stats?.cards?.away?.red)}
                                                </span>
                                            )}
                                            <span className="opp-team-name">
                                                {isAwayHeavy && <span style={{ color: '#f43f5e', marginRight: '4px', fontSize: '0.75rem', animation: 'pulse 1s infinite' }} title={lang === 'tr' ? "Yoğun Deplasman Baskısı" : "Heavy Away Pressure"}>◀⚡</span>}
                                                {match.awayTeam}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 3. Badges Row */}
                                    <div className="opp-badges-row">
                                        {opp.isHalftime && (
                                            <span className="opp-micro-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
                                                ☕ {lang === 'tr' ? '2. YARI DEĞERİ' : '2ND HALF VALUE'}
                                            </span>
                                        )}
                                        {opp.valueDetected && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#000' }}>
                                                💰 {lang === 'tr' ? 'DEĞERLİ ORAN' : 'VALUE ODDS'}
                                            </span>
                                        )}
                                        {match.stats?.xg && (
                                            <span className="opp-micro-badge" style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}>
                                                ⚽ xG: {(Number(match.stats?.xg?.home) || 0).toFixed(1)}-{(Number(match.stats?.xg?.away) || 0).toFixed(1)}
                                            </span>
                                        )}
                                        <span className="opp-micro-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1' }}>
                                            {opp.trend === 'UP' ? '⬆️' : opp.trend === 'DOWN' ? '⬇️' : '➡️'} %{opp.trendDelta > 0 ? '+' : ''}{opp.trendDelta} ({momentumWindow}{lang === 'tr' ? 'dk' : 'm'})
                                        </span>
                                        {opp.smartMoney?.active && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
                                                📉 {lang === 'tr' ? 'BÜYÜK PARA' : 'SMART MONEY'} (-%{opp.smartMoney.dropPct.toFixed(0)})
                                            </span>
                                        )}
                                        {opp.hasValueEV && opp.bestEV && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff' }}>
                                                💎 +EV %{opp.bestEV.ev}
                                            </span>
                                        )}
                                        {opp.hasLatencyEdge && opp.latencyEdge && (
                                            <span className="opp-micro-badge" style={{ background: 'linear-gradient(135deg, #eab308, #f97316)', color: '#000' }}>
                                                ⚡ RADAR (+%{opp.latencyEdge.discrepancyPct})
                                            </span>
                                        )}
                                        {opp.cashOutWarning && (
                                            <span className="opp-micro-badge" style={{ background: '#ef4444', color: '#fff', animation: 'pulse 1.5s infinite' }}>
                                                🛡️ {lang === 'tr' ? 'BAHİS BOZDUR' : 'CASHOUT'}
                                            </span>
                                        )}
                                        {opp.isLowData && (
                                            <span className="opp-micro-badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                                                ⚠️ {lang === 'tr' ? 'Kısıtlı İstatistik' : 'Limited Stats'}
                                            </span>
                                        )}
                                    </div>

                                    {/* 4. Modern Momentum & Pitch Control Box */}
                                    <div className="opp-momentum-container">
                                        <div className="opp-momentum-top">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isHomeHeavy ? '#38bdf8' : '#94a3b8' }}>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block', boxShadow: isHomeHeavy ? '0 0 8px #38bdf8' : 'none' }} />
                                                <span>%{homePct}</span>
                                                {isHomeHeavy && <span style={{ fontSize: '0.58rem', color: '#38bdf8', fontWeight: 900 }}>{lang === 'tr' ? 'BASKI' : 'PRESS'}</span>}
                                            </div>

                                            <div className="opp-momentum-pill" style={{
                                                background: isHot ? 'rgba(239, 68, 68, 0.2)' : (isHomeHeavy || isAwayHeavy ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                                                color: isHot ? '#f87171' : (isHomeHeavy ? '#38bdf8' : isAwayHeavy ? '#f43f5e' : '#94a3b8')
                                            }}>
                                                {isHot ? (lang === 'tr' ? '🔥 RİTİM YÜKSEK' : '🔥 HIGH TEMPO') : (isHomeHeavy ? (lang === 'tr' ? `⚡ ${match.homeTeam?.split(' ')?.[0] || 'Ev'} Yükleniyor` : `⚡ ${match.homeTeam?.split(' ')?.[0] || 'Home'} Pressing`) : isAwayHeavy ? (lang === 'tr' ? `⚡ ${match.awayTeam?.split(' ')?.[0] || 'Dep'} Yükleniyor` : `⚡ ${match.awayTeam?.split(' ')?.[0] || 'Away'} Pressing`) : (lang === 'tr' ? '⚪ DENGELİ TEMPO' : '⚪ BALANCED TEMPO'))}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isAwayHeavy ? '#f43f5e' : '#94a3b8' }}>
                                                {isAwayHeavy && <span style={{ fontSize: '0.58rem', color: '#f43f5e', fontWeight: 900 }}>{lang === 'tr' ? 'BASKI' : 'PRESS'}</span>}
                                                <span>%{awayPct}</span>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f43f5e', display: 'inline-block', boxShadow: isAwayHeavy ? '0 0 8px #f43f5e' : 'none' }} />
                                            </div>
                                        </div>

                                        {/* Dual Colored Gradient Momentum Bar */}
                                        <div className="opp-dual-bar">
                                            <div className="opp-dual-bar-home" style={{ width: `${homePct}%` }} />
                                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255, 255, 255, 0.4)', zIndex: 2 }} />
                                            <div className="opp-dual-bar-away" style={{ width: `${awayPct}%` }} />
                                        </div>

                                        {/* Bottom Row: Micro Metric Badges & Graph Button */}
                                        <div className="opp-momentum-bottom">
                                            <div className="opp-telemetry-row">
                                                <span style={{ color: (sogHome > 0 || sogAway > 0) ? '#38bdf8' : 'inherit' }}>
                                                    🎯 {sogHome}-{sogAway}
                                                </span>
                                                <span style={{ color: (daHome > 0 || daAway > 0) ? '#fbbf24' : 'inherit' }}>
                                                    ⚔️ {daHome}-{daAway}
                                                </span>
                                                <span style={{ color: (cornersHome > 0 || cornersAway > 0) ? '#a78bfa' : 'inherit' }}>
                                                    🚩 {cornersHome}-{cornersAway}
                                                </span>
                                            </div>

                                            <button 
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedMatch(match);
                                                }}
                                                className="opp-wave-btn"
                                                title="Detaylı Baskı Grafiği"
                                            >
                                                <span>📈</span>
                                                <span>{lang === 'tr' ? 'Baskı Grafiği' : 'Wave'}</span>
                                                <span style={{ fontSize: '0.7rem' }}>➔</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 5. Algorithmic Prediction & Live Odds Card */}
                                    {opp.suggestedMarket?.marketKey && (
                                        <div className="opp-prediction-card">
                                            <div className="opp-pred-header">
                                                <span className="opp-pred-tag">
                                                    <span>💡</span>
                                                    <span>{opp.isHalftime ? (lang === 'tr' ? '2. YARI TAHMİNİ' : '2ND HALF PREDICTION') : (lang === 'tr' ? 'SİSTEM TAHMİNİ' : 'SYSTEM PREDICTION')}</span>
                                                </span>
                                                {opp.suggestedMarket.confidence && (
                                                    <span className="opp-pred-confidence">
                                                        %{opp.suggestedMarket.confidence} Güven
                                                    </span>
                                                )}
                                            </div>

                                            <div className="opp-pred-body">
                                                {(t[opp.suggestedMarket.marketKey] || opp.suggestedMarket.label || opp.suggestedMarket.marketKey)
                                                    .replace('{team}', opp.suggestedMarket.team || '')
                                                    .replace('{goals}', opp.suggestedMarket.target || `${((match.score?.home ?? 0) + (match.score?.away ?? 0)) + 0.5}`)}
                                            </div>

                                            {odds && odds.home && (
                                                <div className="opp-odds-row" style={{ marginTop: '0.25rem' }}>
                                                    <div className="opp-odd-pill" style={{ borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                                                        <span className="opp-odd-label">1 (MS 1)</span>
                                                        <span className="opp-odd-val" style={{ color: '#10b981' }}>{odds.home}</span>
                                                    </div>
                                                    <div className="opp-odd-pill">
                                                        <span className="opp-odd-label">X (Beraberlik)</span>
                                                        <span className="opp-odd-val" style={{ color: '#94a3b8' }}>{odds.draw || '-'}</span>
                                                    </div>
                                                    <div className="opp-odd-pill" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                                                        <span className="opp-odd-label">2 (MS 2)</span>
                                                        <span className="opp-odd-val" style={{ color: '#ef4444' }}>{odds.away}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* If no prediction, show odds directly */}
                                    {!opp.suggestedMarket?.marketKey && odds && odds.home && (
                                        <div className="opp-odds-row">
                                            <div className="opp-odd-pill" style={{ borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                                                <span className="opp-odd-label">1 (MS 1)</span>
                                                <span className="opp-odd-val" style={{ color: '#10b981' }}>{odds.home}</span>
                                            </div>
                                            <div className="opp-odd-pill">
                                                <span className="opp-odd-label">X (Beraberlik)</span>
                                                <span className="opp-odd-val" style={{ color: '#94a3b8' }}>{odds.draw || '-'}</span>
                                            </div>
                                            <div className="opp-odd-pill" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                                                <span className="opp-odd-label">2 (MS 2)</span>
                                                <span className="opp-odd-val" style={{ color: '#ef4444' }}>{odds.away}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        };

                        return (
                            <section className="live-opportunities-section" style={{ marginBottom: '4rem' }}>
                                <div className="glass-panel live-opportunities-panel" style={{
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, rgba(15, 23, 42, 0.4) 100%)',
                                    border: '1px solid rgba(239, 68, 68, 0.15)',
                                    borderRadius: '20px'
                                }}>
                                    {/* Streamlined Live Radar Header & Smart Controls */}
                                    <div className="opps-header-container">
                                        {/* Row 1: Brand Title & Live Status Indicator */}
                                        <div className="opps-header-main">
                                            <div className="opps-title-cluster">
                                                <h3 className="opps-title">
                                                    <span className="opps-icon">🔥</span>
                                                    <span className="opps-text-primary">{lang === 'tr' ? 'SICAK FIRSATLAR' : 'HOT OPPORTUNITIES'}</span>
                                                    <span className="opps-text-secondary">{lang === 'tr' ? '& CANLI RADAR' : '& LIVE RADAR'}</span>
                                                </h3>
                                                <div className="opps-live-indicator">
                                                    <span className="opps-pulse-dot" />
                                                    <span className="opps-live-txt">LIVE</span>
                                                </div>
                                            </div>

                                            <div className="opps-stat-pills">
                                                <div className="opps-stat-pill ready">
                                                    <span className="opps-pill-dot ready" />
                                                    <span className="opps-pill-val">{readyOpportunities.length}</span>
                                                    <span className="opps-pill-lbl">{lang === 'tr' ? 'Hazır' : 'Ready'}</span>
                                                </div>
                                                <div className="opps-stat-pill total">
                                                    <span className="opps-pill-val">{allOpportunities.length}</span>
                                                    <span className="opps-pill-lbl">{lang === 'tr' ? 'Canlı' : 'Live'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 2: Category Quick Filters (Scrollable Thumb Strip) */}
                                        <div className="mobile-quick-chips">
                                            <button
                                                type="button"
                                                className={`mobile-quick-chip all ${mobileQuickFilter === 'ALL' ? 'active' : ''}`}
                                                onClick={() => setMobileQuickFilter('ALL')}
                                            >
                                                <span>⚡</span>
                                                <span>{lang === 'tr' ? 'Tümü' : 'All'}</span>
                                                <span className="chip-count">{allOpportunities.length}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`mobile-quick-chip hot ${mobileQuickFilter === 'HOT' ? 'active' : ''}`}
                                                onClick={() => setMobileQuickFilter(mobileQuickFilter === 'HOT' ? 'ALL' : 'HOT')}
                                            >
                                                <span>🔥</span>
                                                <span>{lang === 'tr' ? 'Sıcak Fırsatlar' : 'Hot Picks'}</span>
                                                <span className="chip-count">{allOpportunities.filter(o => o.heatScore >= 70 || o.heatLevel === 'ALEV' || o.heatLevel === 'ALPHA').length}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`mobile-quick-chip ready ${mobileQuickFilter === 'READY' ? 'active' : ''}`}
                                                onClick={() => setMobileQuickFilter(mobileQuickFilter === 'READY' ? 'ALL' : 'READY')}
                                            >
                                                <span>🟢</span>
                                                <span>{lang === 'tr' ? 'Hazır' : 'Ready'}</span>
                                                <span className="chip-count">{readyOpportunities.length}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`mobile-quick-chip second-half ${mobileQuickFilter === 'SECOND_HALF' ? 'active' : ''}`}
                                                onClick={() => setMobileQuickFilter(mobileQuickFilter === 'SECOND_HALF' ? 'ALL' : 'SECOND_HALF')}
                                            >
                                                <span>☕</span>
                                                <span>{lang === 'tr' ? '2. Yarı' : '2nd Half'}</span>
                                                <span className="chip-count">{allOpportunities.filter(o => o.isHalftime || o.isSecondHalfPressure).length}</span>
                                            </button>
                                            {goldenCombo && (
                                                <button
                                                    type="button"
                                                    className={`mobile-quick-chip combo ${mobileQuickFilter === 'COMBO' ? 'active' : ''}`}
                                                    onClick={() => setMobileQuickFilter(mobileQuickFilter === 'COMBO' ? 'ALL' : 'COMBO')}
                                                >
                                                    <span>🎟️</span>
                                                    <span>{lang === 'tr' ? 'Altın İkili' : 'Golden Combo'}</span>
                                                    <span className="chip-count">{goldenCombo.totalOdds}</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Row 3: Secondary Precision Toolbar (Momentum Window & Limits) */}
                                        <div className="opps-sub-toolbar">
                                            {/* Momentum Window Selector */}
                                            <div className="opps-ctrl-group">
                                                <span className="opps-ctrl-title">
                                                    <span>⏱️</span>
                                                    <span>{lang === 'tr' ? 'İvme:' : 'Momentum:'}</span>
                                                </span>
                                                <div className="opps-segmented-bar">
                                                    {[5, 10, 20].map(m => (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setMomentumWindow(m); }}
                                                            className={`opps-segment-btn ${momentumWindow === m ? 'active' : ''}`}
                                                        >
                                                            {m}D
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Limit Filter Selector */}
                                            <div className="opps-ctrl-group">
                                                <span className="opps-ctrl-title">
                                                    <span>🎯</span>
                                                    <span>{lang === 'tr' ? 'Limit:' : 'Limit:'}</span>
                                                </span>
                                                <div className="opps-segmented-bar">
                                                    {[5, 10, 'ALL'].map(limit => (
                                                        <button
                                                            key={limit}
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setLiveOpportunitiesLimit(limit); }}
                                                            className={`opps-segment-btn ${liveOpportunitiesLimit === limit ? 'active' : ''}`}
                                                        >
                                                            {limit === 'ALL' ? (lang === 'tr' ? 'TÜMÜ' : 'ALL') : `TOP ${limit}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* GOLDEN DOUBLE COMBO WIDGET (CANLI KUPON SİHİRBAZI) */}
                                    {goldenCombo && (
                                        <div className={`golden-combo-ticket ${mobileQuickFilter === 'COMBO' ? 'highlighted' : ''}`}>
                                            <div className="golden-combo-header">
                                                <div className="golden-combo-hero-left">
                                                    <span className="golden-combo-icon">🎟️</span>
                                                    <div className="golden-combo-text-block">
                                                        <div className="golden-combo-title-row">
                                                            <span className="golden-combo-main-title">
                                                                {lang === 'tr' ? 'GÜNÜN CANLI ALTIN İKİLİSİ' : 'LIVE GOLDEN DOUBLE'}
                                                            </span>
                                                            <span className="golden-combo-vtag">
                                                                {lang === 'tr' ? 'KUPON SİHİRBAZI v4.0' : 'COMBO WIZARD v4.0'}
                                                            </span>
                                                        </div>
                                                        <div className="golden-combo-desc">
                                                            {lang === 'tr' ? 'Sistemdeki en yüksek olasılığa ve korelasyona sahip 2 canlı fırsatın kurumsal kombinasyonu' : 'Algorithmic 2-leg combo combining the highest conviction opportunities'}
                                                        </div>
                                                        <div className="golden-combo-disclaimer">
                                                            ℹ️ {lang === 'tr' ? 'Olasılık bazlı algoritmik analiz modelidir. Kesin kazanç garantisi içermez, yatırım tavsiyesi değildir.' : 'Algorithmic probability model. Does not guarantee winnings.'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="golden-combo-hero-right">
                                                    <div className="golden-combo-conf-box">
                                                        <div className="golden-combo-conf-lbl">
                                                            {lang === 'tr' ? 'SİSTEM GÜVENİ' : 'CONVICTION'}
                                                        </div>
                                                        <div className="golden-combo-conf-val">
                                                            %{goldenCombo.averageConfidence}
                                                        </div>
                                                    </div>
                                                    <div className="golden-combo-odds-badge">
                                                        <span className="golden-combo-odds-lbl">
                                                            {lang === 'tr' ? 'TOPLAM ORAN' : 'TOTAL ODDS'}
                                                        </span>
                                                        <span className="golden-combo-odds-val">{goldenCombo.totalOdds}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2 Picks Grid */}
                                            <div className="golden-combo-picks">
                                                {goldenCombo.picks.map((pick, pIdx) => (
                                                    <div key={pIdx} className="golden-pick-card">
                                                        <div className="golden-pick-info">
                                                            <div className="golden-pick-match">
                                                                {pick.matchTitle}
                                                            </div>
                                                            <div className="golden-pick-meta">
                                                                {renderMatchMinute(pick.minute, t, false)} • {lang === 'tr' ? 'Skor' : 'Score'}: {pick.score} • {pick.league}
                                                            </div>
                                                            <div className="golden-pick-market">
                                                                🎯 {pick.market}
                                                            </div>
                                                        </div>
                                                        <div className="golden-pick-odds-wrap">
                                                            <div className="golden-pick-odds">
                                                                {pick.odds}
                                                            </div>
                                                            <div className="golden-pick-conf">
                                                                %{pick.confidence} {lang === 'tr' ? 'Güven' : 'Conviction'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Golden Combo Action Bar (Admin Only) */}
                                            {isAdmin && (
                                                <div className="golden-combo-actions">
                                                    <button
                                                        type="button"
                                                        disabled={isSendingGoldenCombo}
                                                        onClick={(e) => handleSendGoldenComboToTelegram(e, goldenCombo)}
                                                        className="golden-combo-vip-btn"
                                                        style={isSendingGoldenCombo ? { opacity: 0.65, cursor: 'wait' } : undefined}
                                                    >
                                                        <span>{isSendingGoldenCombo ? '⏳' : '✈️'}</span>
                                                        <span>
                                                            {isSendingGoldenCombo 
                                                                ? (lang === 'tr' ? 'VIP Gruba İletiliyor...' : 'Sending to VIP...') 
                                                                : (lang === 'tr' ? 'VIP Gruba İlet' : 'Share to VIP')}
                                                        </span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Compute Displayed Opportunities Based on Quick Filter */}
                                    {(() => {
                                        const comboMatchIds = goldenCombo ? goldenCombo.picks.map(p => p.matchId) : [];
                                        const displayedReady = mobileQuickFilter === 'HOT'
                                            ? topReady.filter(o => o.heatScore >= 70 || o.heatLevel === 'ALEV' || o.heatLevel === 'ALPHA')
                                            : mobileQuickFilter === 'SECOND_HALF'
                                            ? topReady.filter(o => o.isHalftime || o.isSecondHalfPressure)
                                            : mobileQuickFilter === 'COMBO'
                                            ? topReady.filter(o => comboMatchIds.includes(o.matchId))
                                            : topReady;

                                        const displayedPending = mobileQuickFilter === 'HOT'
                                            ? topPending.filter(o => o.heatScore >= 70 || o.heatLevel === 'ALEV' || o.heatLevel === 'ALPHA')
                                            : mobileQuickFilter === 'SECOND_HALF'
                                            ? topPending.filter(o => o.isHalftime || o.isSecondHalfPressure)
                                            : (mobileQuickFilter === 'READY' || mobileQuickFilter === 'COMBO')
                                            ? []
                                            : topPending;

                                        return (
                                            <>
                                                {/* SECTION 1: READY OPPORTUNITIES */}
                                                <div style={{ marginBottom: '2.5rem' }}>
                                                    <div className="opps-section-badge ready">
                                                        <span className="opps-badge-dot" />
                                                        <span className="opps-badge-title">
                                                            {lang === 'tr' ? 'CANLI ANALİZ HAZIR' : 'LIVE ANALYSIS READY'}
                                                        </span>
                                                        <span className="opps-badge-count">{displayedReady.length}</span>
                                                    </div>

                                                    {displayedReady.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                            {displayedReady.map((opp, idx) => renderOppCard(opp, idx, false))}
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
                                                            {lang === 'tr' ? 'Seçili filtreye uygun canlı maç bulunamadı.' : 'No live matches match this filter.'}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* SECTION 2: PENDING STATS */}
                                                {displayedPending.length > 0 && !hidePendingOpportunities && (
                                                    <div>
                                                        <div className="opps-section-badge pending">
                                                            <span className="opps-badge-icon">⏳</span>
                                                            <span className="opps-badge-title">
                                                                {lang === 'tr' ? 'CANLI VERİ BEKLENİYOR (RADAR AKTİF)' : 'WAITING FOR LIVE DATA (RADAR ACTIVE)'}
                                                            </span>
                                                            <span className="opps-badge-count">{displayedPending.length}</span>
                                                        </div>

                                                        <div className="pending-opps-grid" style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                                            gap: '0.8rem',
                                                            maxHeight: liveOpportunitiesLimit === 'ALL' ? '600px' : 'none',
                                                            overflowY: liveOpportunitiesLimit === 'ALL' ? 'auto' : 'visible',
                                                            paddingRight: liveOpportunitiesLimit === 'ALL' ? '0.5rem' : '0'
                                                        }}>
                                                            {displayedPending.map((opp, idx) => renderOppCard(opp, idx, true))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
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
                                    
                                    const trendingBet = (trendingBets || []).find(tb => 
                                        consensusAdapter._isFuzzyMatch(tb.home, tb.away, m.homeTeam, m.awayTeam) ||
                                        consensusAdapter._isFuzzyMatch(tb.away, tb.home, m.homeTeam, m.awayTeam)
                                    );
                                    const isTrendApproved = trendingBet && (m.dqs || 0) >= 0.50;
                                    const isTrendTrap = trendingBet && (m.dqs || 0) < 0.40;
                                    const marketPrediction = trendingBet ? formatMarketPrediction(trendingBet, lang) : '';

                                    return (
                                        <div
                                            key={m.id}
                                            className="mobile-match-card glass-panel"
                                            onClick={() => setSelectedMatch(m)}
                                        >
                                            <div className="match-card-header">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    <span className="match-league">{m.league || m.leagueName || 'Football'}</span>
                                                    {trendingBet && (
                                                        <span
                                                            style={{
                                                                fontSize: '0.62rem',
                                                                padding: '0.12rem 0.45rem',
                                                                borderRadius: '999px',
                                                                background: isTrendApproved ? 'rgba(16, 185, 129, 0.15)' : isTrendTrap ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                                                border: `1px solid ${isTrendApproved ? 'rgba(16, 185, 129, 0.4)' : isTrendTrap ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                                                                color: isTrendApproved ? '#34d399' : isTrendTrap ? '#f87171' : '#38bdf8',
                                                                fontWeight: 800,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem'
                                                            }}
                                                        >
                                                            <span>🔥</span>
                                                            <span>{isTrendApproved ? (lang === 'tr' ? 'Akıllı Para:' : 'Smart Money:') : isTrendTrap ? (lang === 'tr' ? 'Tuzak:' : 'Trap:') : (lang === 'tr' ? 'Piyasa:' : 'Market:')} {marketPrediction}{trendingBet.odds ? ` @${trendingBet.odds}` : ''}</span>
                                                            <span style={{ opacity: 0.8 }}>• {trendingBet.count} K</span>
                                                        </span>
                                                    )}
                                                </div>
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
                                        {matches.filter(filterByTier).map(m => {
                                            const trendingBet = (trendingBets || []).find(tb => 
                                                consensusAdapter._isFuzzyMatch(tb.home, tb.away, m.homeTeam, m.awayTeam) ||
                                                consensusAdapter._isFuzzyMatch(tb.away, tb.home, m.homeTeam, m.awayTeam)
                                            );
                                            const isTrendApproved = trendingBet && (m.dqs || 0) >= 0.50;
                                            const isTrendTrap = trendingBet && (m.dqs || 0) < 0.40;
                                            const marketPrediction = trendingBet ? formatMarketPrediction(trendingBet, lang) : '';

                                            return (
                                                <tr key={m.id} onClick={() => setSelectedMatch(m)} style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                    <td style={{ padding: '1.25rem 2rem' }}>
                                                        <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                             <span>{m.homeTeam} <span style={{ opacity: 0.3 }}>-</span> {m.awayTeam}</span>
                                                             {trendingBet && (
                                                                <span
                                                                    title={isTrendApproved 
                                                                        ? (lang === 'tr' ? `Akıllı Para: Piyasa tercihi (${marketPrediction}) saha baskısıyla doğrulanıyor.` : `Smart Money: Market pick (${marketPrediction}) verified by pitch pressure.`)
                                                                        : isTrendTrap
                                                                        ? (lang === 'tr' ? `Tuzak Uyarısı: Kalabalık piyasada (${marketPrediction}) oynuyor ancak saha verisi yetersiz!` : `Trap Alert: Crowd is betting (${marketPrediction}), but pitch stats do not support it!`)
                                                                        : (lang === 'tr' ? `Piyasa Akışı: ${marketPrediction} - Son 5 dakikada ${trendingBet.count} kupon.` : `Market Influx: ${marketPrediction} - ${trendingBet.count} bets in last 5m.`)}
                                                                    style={{
                                                                        fontSize: '0.62rem',
                                                                        padding: '0.15rem 0.5rem',
                                                                        borderRadius: '999px',
                                                                        background: isTrendApproved ? 'rgba(16, 185, 129, 0.15)' : isTrendTrap ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                                                        border: `1px solid ${isTrendApproved ? 'rgba(16, 185, 129, 0.4)' : isTrendTrap ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                                                                        color: isTrendApproved ? '#34d399' : isTrendTrap ? '#f87171' : '#38bdf8',
                                                                        fontWeight: 800,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.35rem'
                                                                    }}
                                                                >
                                                                    <span>🔥</span>
                                                                    <span>{isTrendApproved ? (lang === 'tr' ? 'AKILLI PARA:' : 'SMART MONEY:') : isTrendTrap ? (lang === 'tr' ? 'TUZAK ALARMI:' : 'TRAP ALERT:') : (lang === 'tr' ? 'PİYASA AKIŞI:' : 'INFLUX:')} <strong style={{ color: '#fff' }}>{marketPrediction}</strong>{trendingBet.odds ? ` @${trendingBet.odds}` : ''}</span>
                                                                    <span>•</span>
                                                                    <span>{trendingBet.count} {lang === 'tr' ? 'Kupon' : 'Bets'}</span>
                                                                </span>
                                                             )}
                                                        </div>
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
                                        )})}
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
                        </>
                    )}

                </>
            )
            }

            {displayViewMode !== 'TERMINAL' && renderMatchDetailsModal()}
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
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                            {userProfile?.plan === 'trial' ? (lang === 'tr' ? 'Kalan Süre' : 'Time Remaining') : t.expiry_date}
                                        </div>
                                        <div style={{ fontWeight: 800, color: userProfile?.plan === 'trial' ? '#38bdf8' : 'inherit' }}>
                                            {userProfile?.plan === 'trial'
                                                ? (remainingTrialSeconds > 0 ? `⏳ ${formatTrialCountdown(remainingTrialSeconds)}` : (lang === 'tr' ? 'Süre Doldu' : 'Expired'))
                                                : (userProfile?.subscription_end ? new Date(userProfile.subscription_end).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-')}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8', borderLeft: '3px solid var(--accent-color)' }}>
                                    <div>{t.extend_info}</div>
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ opacity: 0.8, fontSize: '0.7rem', color: userProfile?.plan === 'trial' ? '#38bdf8' : 'inherit' }}>
                                            {userProfile?.plan === 'trial' ? t.plan_features_trial : t.plan_features_pro}
                                        </div>
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
                                        <a
                                            href={settings?.shopier_link || 'https://shopier.com/livebetmentor'}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                marginTop: '0.2rem',
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                color: '#fff',
                                                textDecoration: 'none',
                                                border: 'none',
                                                padding: '0.65rem',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.75rem',
                                                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)'
                                            }}
                                        >
                                            <span>💳</span> {lang === 'tr' ? 'Kredi Kartı ile VIP Satın Al (Shopier)' : 'Pay with Card (Shopier)'}
                                        </a>
                                        <button
                                            onClick={() => {
                                                const tgUser = (settings?.telegram_support || CONFIG?.SUPPORT?.TELEGRAM || '@Livebetdeskbot').replace('@', '');
                                                window.open(`https://t.me/${tgUser}`, '_blank');
                                            }}
                                            style={{
                                                marginTop: '0.3rem',
                                                background: 'rgba(0, 136, 204, 0.1)',
                                                color: '#0088cc',
                                                border: '1px solid #0088cc',
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
                                            <span style={{ fontSize: '1rem' }}>✈️</span> {t.telegram_upgrade}
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
                                    const isLocked = setting.premium && (!isAdmin && userProfile?.plan !== 'premium');
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

                            {/* League Tier Management - Admin Only */}
                            {isAdmin && (
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
                            )}
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
                                    {showAlertPopup.recommendation?.edgeType === 'LATENCY' ? (lang === 'tr' ? 'GECİKME ARBİTRAJI' : 'LATENCY ARBITRAGE') :
                                     showAlertPopup.recommendation?.edgeType === 'PLUS_EV' ? (lang === 'tr' ? 'KURUMSAL +EV DEĞER' : '+EV VALUE') :
                                     `${lang === 'en' ? (showAlertPopup.level === 'ALEV' ? 'FLAME' : showAlertPopup.level === 'SICAK' ? 'HOT' : 'HOT') : (showAlertPopup.level || 'SICAK')} ${lang === 'tr' ? 'FIRSAT' : 'OPPORTUNITY'}`}
                                </span>
                                <span style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(255,255,255,0.08)',
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    color: '#94a3b8',
                                    fontWeight: 700
                                }}>
                                    {showAlertPopup.conditionsMet || 4}/5 {lang === 'tr' ? 'Koşul' : 'Conditions'}
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
                                title={lang === 'tr' ? "Kapat" : "Close"}
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
                                {renderMatchMinute(showAlertPopup.minute, t, false)} • {lang === 'tr' ? 'Skor:' : 'Score:'} {showAlertPopup.score}
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
                                <div style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'tr' ? 'ÖNERİLEN PAZAR' : 'SUGGESTED MARKET'}</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8' }}>
                                    {showAlertPopup.recommendation?.predictionText ||
                                     (showAlertPopup.recommendation?.marketKey === 'POST_GOAL_COOLDOWN' ? (t.POST_GOAL_COOLDOWN || 'Yeni Gol Oldu (Piyasa Dengeleniyor)') :
                                      showAlertPopup.recommendation?.marketKey === 'STABLE_GAME' ? (t.STABLE_GAME || 'Dengeli Oyun / Pas') :
                                      showAlertPopup.recommendation?.marketLabel || 
                                      (t[showAlertPopup.recommendation?.marketKey] || showAlertPopup.recommendation?.marketKey || showAlertPopup.recommendation?.market))}
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
                                    %{showAlertPopup.recommendation?.confidence || 75} {lang === 'tr' ? 'Güven' : 'Confidence'}
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
                                    <div className="tracking-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.8rem', marginBottom: '1.5rem' }}>
                                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>{lang === 'tr' ? 'TOPLAM SİNYAL' : 'TOTAL ALERTS'}</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-color)' }}>{alertHistoryList.length}</div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>{lang === 'tr' ? 'KAZANAN' : 'WON'}</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>
                                                {alertHistoryList.filter(a => a.status === 'WON').length}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>{lang === 'tr' ? 'KAYBEDEN' : 'LOST'}</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>
                                                {alertHistoryList.filter(a => a.status === 'LOST').length}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '0.8rem', borderRadius: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.2rem' }}>{lang === 'tr' ? 'DEVAM EDEN' : 'PENDING'}</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>
                                                {alertHistoryList.filter(a => a.status === 'PENDING').length}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.8 }}>{lang === 'tr' ? 'Gelen Popup & Bildirim Sinyalleri' : 'Incoming Popup & Notification Signals'}</div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                onClick={scanFinishedAlerts}
                                                disabled={isScanningResults}
                                                style={{
                                                    background: isScanningResults ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                                    color: '#38bdf8',
                                                    padding: '0.3rem 0.7rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    cursor: isScanningResults ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                                title={lang === 'tr' ? "Biten maçların skorlarını canlı sorgula ve sonuçlandır" : "Scan and settle finished matches"}
                                            >
                                                <span>{isScanningResults ? '⏳' : '🔄'}</span>
                                                {isScanningResults ? (lang === 'tr' ? 'Sorgulanıyor...' : 'Scanning...') : (lang === 'tr' ? 'Biten Maçları Sorgula' : 'Settle Finished Matches')}
                                            </button>
                                            {alertHistoryList.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(lang === 'tr' ? 'Tüm sinyal geçmişini temizlemek istediğinize emin misiniz?' : 'Are you sure you want to clear all alert history?')) {
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
                                                    🗑️ {lang === 'tr' ? 'Geçmişi Temizle' : 'Clear History'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Alert Cards */}
                                    <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem', paddingRight: '0.3rem' }}>
                                        {alertHistoryList.map(alert => {
                                            const rec = alert.recommendation || {};
                                            const betTitle = rec.predictionText || rec.marketLabel || rec.marketKey || (lang === 'tr' ? 'Tahmin' : 'Prediction');
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
                                                                {alert.level === 'ALEV' ? (lang === 'tr' ? '🔥 ALEV' : '🔥 FLAME') : (lang === 'tr' ? '⚡ SICAK' : '⚡ HOT')}
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

                                                    {(() => {
                                                        const initialScoreStr = typeof alert.score === 'object' 
                                                            ? `${alert.score?.home ?? 0}-${alert.score?.away ?? 0}` 
                                                            : (alert.score || '0-0');
                                                        const initialMinute = alert.minute;

                                                        const liveMatch = matches.find(m => String(m.id) === String(alert.matchId));
                                                        let currentScoreStr = alert.finalScore || null;
                                                        let currentMinuteStr = null;
                                                        let isFinished = alert.status === 'WON' || alert.status === 'LOST';

                                                        if (liveMatch) {
                                                            if (typeof liveMatch.score === 'string' && liveMatch.score.trim()) {
                                                                currentScoreStr = liveMatch.score.replace(/\s+/g, '');
                                                            } else if (liveMatch.homeScore !== undefined && liveMatch.awayScore !== undefined) {
                                                                currentScoreStr = `${liveMatch.homeScore}-${liveMatch.awayScore}`;
                                                            }
                                                            currentMinuteStr = renderMatchMinute(liveMatch.minute, t, false);
                                                            if (liveMatch.isFinished || liveMatch.minute === 'MS' || liveMatch.minute === 'FT') {
                                                                isFinished = true;
                                                            }
                                                        }

                                                        return (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                                                                <div style={{ flex: 1, marginRight: '0.8rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                                                        <span style={{
                                                                            background: 'rgba(255,255,255,0.06)',
                                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                                            padding: '2px 8px',
                                                                            borderRadius: '6px',
                                                                            color: '#94a3b8',
                                                                            fontWeight: 600,
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px'
                                                                        }}>
                                                                            <span>⏱️ {initialMinute}'</span>
                                                                            <span style={{ opacity: 0.4 }}>|</span>
                                                                            <span>{lang === 'tr' ? 'Skor:' : 'Score:'} <strong style={{ color: '#fff' }}>{initialScoreStr}</strong> {lang === 'tr' ? 'anında' : 'at signal'}</span>
                                                                        </span>

                                                                        <span style={{ color: 'var(--accent-color)', fontWeight: 900, fontSize: '0.75rem' }}>➔</span>

                                                                        {currentScoreStr ? (
                                                                            <span style={{
                                                                                background: isFinished ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.18)',
                                                                                border: `1px solid ${isFinished ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.4)'}`,
                                                                                padding: '2px 8px',
                                                                                borderRadius: '6px',
                                                                                color: isFinished ? '#10b981' : '#38bdf8',
                                                                                fontWeight: 800,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '5px'
                                                                            }}>
                                                                                <span style={{ fontSize: '0.65rem' }}>{isFinished ? (lang === 'tr' ? '🏁 Bitiş:' : '🏁 Final:') : (lang === 'tr' ? '🔴 Canlı Skor:' : '🔴 Live:')}</span>
                                                                                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{currentScoreStr}</strong>
                                                                                {!isFinished && currentMinuteStr && (
                                                                                    <span style={{ fontSize: '0.7rem', color: '#38bdf8', opacity: 0.9 }}>({currentMinuteStr})</span>
                                                                                )}
                                                                            </span>
                                                                        ) : (
                                                                            (() => {
                                                                                const elapsedMin = alert.timestamp ? Math.round((Date.now() - alert.timestamp) / 60000) : 0;
                                                                                const initialMinNum = parseInt(String(initialMinute).replace(/\D/g, '')) || 0;
                                                                                const matchEnded = elapsedMin >= 45 || (initialMinNum + elapsedMin >= 95);

                                                                                if (matchEnded) {
                                                                                    return (
                                                                                        <span style={{
                                                                                            background: 'rgba(255,255,255,0.06)',
                                                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                                                            padding: '2px 8px',
                                                                                            borderRadius: '6px',
                                                                                            color: '#94a3b8',
                                                                                            fontSize: '0.7rem',
                                                                                            fontWeight: 700
                                                                                        }}>
                                                                                            🏁 {lang === 'tr' ? 'Maç Bitti (Sonuç Bekleniyor)' : 'Ended (Awaiting Result)'}
                                                                                        </span>
                                                                                    );
                                                                                }

                                                                                return (
                                                                                    <span style={{
                                                                                        background: 'rgba(255,255,255,0.04)',
                                                                                        padding: '2px 8px',
                                                                                        borderRadius: '6px',
                                                                                        color: 'rgba(255,255,255,0.5)',
                                                                                        fontSize: '0.7rem',
                                                                                        fontWeight: 700
                                                                                    }}>
                                                                                        🔴 {lang === 'tr' ? 'Canlı:' : 'Live:'} {initialScoreStr} ({initialMinute}')
                                                                                    </span>
                                                                                );
                                                                            })()
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                                                                        🎯 {betTitle}
                                                                    </div>
                                                                </div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                                                                        {rec.odds ? `${lang === 'tr' ? 'Oran:' : 'Odds:'} ${Number(rec.odds).toFixed(2)}` : ''}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                                        %{rec.confidence || 75} {lang === 'tr' ? 'Güven' : 'Confidence'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Status & Actions */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                                        <div>
                                                            {alert.status === 'WON' ? (
                                                                <span
                                                                    onClick={() => {
                                                                        smartAlertService.updateAlertResult(alert.id, 'LOST');
                                                                        setAlertHistoryList(smartAlertService.getHistory(50));
                                                                    }}
                                                                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                                    title={lang === 'tr' ? "Durumu değiştirmek için tıklayın (Kaybetti)" : "Click to toggle (Lost)"}
                                                                >
                                                                    ✓ {lang === 'tr' ? 'KAZANDI' : 'WON'}
                                                                </span>
                                                            ) : alert.status === 'LOST' ? (
                                                                <span
                                                                    onClick={() => {
                                                                        smartAlertService.updateAlertResult(alert.id, 'WON');
                                                                        setAlertHistoryList(smartAlertService.getHistory(50));
                                                                    }}
                                                                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                                    title={lang === 'tr' ? "Durumu değiştirmek için tıklayın (Kazandı)" : "Click to toggle (Won)"}
                                                                >
                                                                    ✗ {lang === 'tr' ? 'KAYBETTİ' : 'LOST'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                                    ⏳ {lang === 'tr' ? 'DEVAM EDİYOR' : 'IN PROGRESS'}
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
                                                                        title={lang === 'tr' ? "Kazandı olarak işaretle" : "Mark as won"}
                                                                    >
                                                                        ✓ {lang === 'tr' ? 'Kazandı' : 'Won'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            smartAlertService.updateAlertResult(alert.id, 'LOST');
                                                                            setAlertHistoryList(smartAlertService.getHistory(50));
                                                                        }}
                                                                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                                                        title={lang === 'tr' ? "Kaybetti olarak işaretle" : "Mark as lost"}
                                                                    >
                                                                        ✗ {lang === 'tr' ? 'Kaybetti' : 'Lost'}
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
                                                                    alert(lang === 'tr' ? 'Tahmin başarıyla karnenize kaydedildi!' : 'Prediction saved to your ledger!');
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
                                                                title={lang === 'tr' ? "Bu tahmini kişisel kasa karnene ekle" : "Add this prediction to your ledger"}
                                                            >
                                                                + {lang === 'tr' ? 'Portföye Ekle' : 'Add to Ledger'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {alertHistoryList.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
                                                <div>{lang === 'tr' ? 'Henüz tetiklenen sinyal bulunmuyor.' : 'No alerts triggered yet.'}</div>
                                                <div style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>{lang === 'tr' ? 'Canlı maçlarda yüksek baskı veya xG dominasyonu tespit edildiğinde sinyaller burada listelenecektir.' : 'Alerts will appear here when high pressure or xG dominance is detected in live matches.'}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: REGISTERED BETS & BANKROLL TRACKER */}
                            {trackingActiveTab === 'BETS' && (
                                <div>
                                    {/* Summary Stats */}
                                    <div className="tracking-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>{lang === 'tr' ? 'TOPLAM' : 'TOTAL'}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-color)' }}>{trackingStats.total}</div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>{lang === 'tr' ? 'KAZANAN' : 'WON'}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{trackingStats.won}</div>
                                        </div>
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>{lang === 'tr' ? 'KAYBEDEN' : 'LOST'}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{trackingStats.lost}</div>
                                        </div>
                                        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.3rem' }}>{lang === 'tr' ? 'İSABET' : 'ACCURACY'}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24' }}>%{trackingStats.accuracy}</div>
                                        </div>
                                    </div>

                                    {/* By Confidence */}
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.8 }}>
                                            {lang === 'tr' ? 'Güven Seviyesine Göre' : 'By Confidence Level'}
                                        </h4>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            {Object.entries(trackingStats.byConfidence || {}).map(([level, stats]) => (
                                                <div key={level} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px' }}>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>
                                                        {level === 'high' ? (lang === 'tr' ? 'Yüksek (75+)' : 'High (75+)') : level === 'medium' ? (lang === 'tr' ? 'Orta (60-74)' : 'Medium (60-74)') : (lang === 'tr' ? 'Düşük (<60)' : 'Low (<60)')}
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <h4 style={{ fontSize: '0.85rem', margin: 0, opacity: 0.8 }}>
                                                {lang === 'tr' ? 'Son Tahminler & Takip Listesi' : 'Recent Predictions & Watchlist'}
                                            </h4>
                                            {predictionTracker.getRecent(1).length > 0 && (
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm(lang === 'tr' ? 'Tüm tahmin ve kasa karnesini temizlemek istediğinize emin misiniz?' : 'Clear all prediction tracking records?')) {
                                                            await predictionTracker.clearPredictions();
                                                            setTrackingStats(predictionTracker.getStats());
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                                        color: '#ef4444',
                                                        padding: '0.25rem 0.65rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title={lang === 'tr' ? 'Tüm listeyi temizle' : 'Clear all'}
                                                >
                                                    <span>🗑️</span>
                                                    <span>{lang === 'tr' ? 'Karneni Temizle' : 'Clear All'}</span>
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ maxHeight: '320px', overflow: 'auto' }}>
                                            {predictionTracker.getRecent(20).map((pred, idx) => {
                                                const initialScoreStr = (pred.scoreAtPrediction && typeof pred.scoreAtPrediction === 'object')
                                                    ? `${pred.scoreAtPrediction.home ?? 0}-${pred.scoreAtPrediction.away ?? 0}`
                                                    : (typeof pred.scoreAtPrediction === 'string' && pred.scoreAtPrediction.trim()
                                                        ? pred.scoreAtPrediction.replace(/\s+/g, '')
                                                        : '0-0');
                                                const initialMinute = pred.minute;

                                                const liveMatch = matches.find(m => String(m.id) === String(pred.matchId));
                                                let currentScoreStr = null;
                                                if (pred.finalScore && pred.finalScore.home !== undefined && pred.finalScore.away !== undefined) {
                                                    currentScoreStr = `${pred.finalScore.home}-${pred.finalScore.away}`;
                                                } else if (typeof pred.finalScore === 'string' && pred.finalScore.includes('-') && !pred.finalScore.includes('undefined')) {
                                                    currentScoreStr = pred.finalScore.replace(/\s+/g, '');
                                                }
                                                let currentMinuteStr = null;
                                                let isFinished = pred.status === 'WON' || pred.status === 'LOST';

                                                if (liveMatch) {
                                                    if (typeof liveMatch.score === 'string' && liveMatch.score.trim()) {
                                                        currentScoreStr = liveMatch.score.replace(/\s+/g, '');
                                                    } else if (liveMatch.homeScore !== undefined && liveMatch.awayScore !== undefined) {
                                                        currentScoreStr = `${liveMatch.homeScore}-${liveMatch.awayScore}`;
                                                    }
                                                    currentMinuteStr = renderMatchMinute(liveMatch.minute, t, false);
                                                    if (liveMatch.isFinished || liveMatch.minute === 'MS' || liveMatch.minute === 'FT') {
                                                        isFinished = true;
                                                    }
                                                } else if (!currentScoreStr) {
                                                    currentScoreStr = initialScoreStr;
                                                }

                                                return (
                                                    <div key={pred.id} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '0.75rem 0.9rem',
                                                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)',
                                                        borderRadius: '8px',
                                                        marginBottom: '0.4rem',
                                                        border: '1px solid rgba(255,255,255,0.06)'
                                                    }}>
                                                        <div style={{ flex: 1, marginRight: '0.8rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                                                <span style={{
                                                                    background: 'rgba(255,255,255,0.06)',
                                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '6px',
                                                                    color: '#94a3b8',
                                                                    fontWeight: 600,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}>
                                                                    {initialMinute && <span>⏱️ {initialMinute}'</span>}
                                                                    {initialMinute && <span style={{ opacity: 0.4 }}>|</span>}
                                                                    <span>{lang === 'tr' ? 'Skor: ' : 'Score: '}<strong style={{ color: '#fff' }}>{initialScoreStr}</strong> {lang === 'tr' ? 'anında' : 'at signal'}</span>
                                                                </span>

                                                                <span style={{ color: 'var(--accent-color)', fontWeight: 900, fontSize: '0.75rem' }}>➔</span>

                                                                {currentScoreStr ? (
                                                                    <span style={{
                                                                        background: isFinished ? (pred.status === 'WON' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)') : 'rgba(56, 189, 248, 0.18)',
                                                                        border: `1px solid ${isFinished ? (pred.status === 'WON' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)') : 'rgba(56, 189, 248, 0.4)'}`,
                                                                        padding: '2px 8px',
                                                                        borderRadius: '6px',
                                                                        color: isFinished ? (pred.status === 'WON' ? '#10b981' : '#f87171') : '#38bdf8',
                                                                        fontWeight: 800,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '5px'
                                                                    }}>
                                                                        <span style={{ fontSize: '0.65rem' }}>{isFinished ? (lang === 'tr' ? '🏁 Sonuç:' : '🏁 Result:') : (lang === 'tr' ? '🔴 Canlı Skor:' : '🔴 Live Score:')}</span>
                                                                        <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{currentScoreStr}</strong>
                                                                        {!isFinished && currentMinuteStr && (
                                                                            <span style={{ fontSize: '0.7rem', color: '#38bdf8', opacity: 0.9 }}>({currentMinuteStr})</span>
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{
                                                                        background: 'rgba(255,255,255,0.04)',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '6px',
                                                                        color: 'rgba(255,255,255,0.5)',
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 700
                                                                    }}>
                                                                        🔴 {lang === 'tr' ? 'Skor: ' : 'Score: '}{initialScoreStr}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff', marginBottom: '2px' }}>{pred.match}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 700 }}>
                                                                🎯 {t[pred.market] || pred.market} • %{pred.confidence} {t.confidence_score}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {pred.status === 'PENDING' ? (
                                                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                                    <button
                                                                        onClick={async () => {
                                                                            const finalScore = liveMatch ? (
                                                                                typeof liveMatch.score === 'object' ? liveMatch.score :
                                                                                (typeof liveMatch.score === 'string' && liveMatch.score.includes('-')) ? {
                                                                                    home: parseInt(liveMatch.score.split('-')[0]) || 0,
                                                                                    away: parseInt(liveMatch.score.split('-')[1]) || 0
                                                                                } : null
                                                                            ) : (pred.scoreAtPrediction || null);

                                                                            await predictionTracker.updateResult(pred.id, 'WON', finalScore);
                                                                            setTrackingStats(predictionTracker.getStats());
                                                                        }}
                                                                        style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                                        title={lang === 'tr' ? 'Kazandı olarak işaretle' : 'Mark as won'}
                                                                    >
                                                                        ✓
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            const finalScore = liveMatch ? (
                                                                                typeof liveMatch.score === 'object' ? liveMatch.score :
                                                                                (typeof liveMatch.score === 'string' && liveMatch.score.includes('-')) ? {
                                                                                    home: parseInt(liveMatch.score.split('-')[0]) || 0,
                                                                                    away: parseInt(liveMatch.score.split('-')[1]) || 0
                                                                                } : null
                                                                            ) : (pred.scoreAtPrediction || null);

                                                                            await predictionTracker.updateResult(pred.id, 'LOST', finalScore);
                                                                            setTrackingStats(predictionTracker.getStats());
                                                                        }}
                                                                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                                        title={lang === 'tr' ? 'Kaybetti olarak işaretle' : 'Mark as lost'}
                                                                    >
                                                                        ✗
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (window.confirm(lang === 'tr' ? 'Bu maçı tekrar "DEVAM EDİYOR" durumuna geri almak istiyor musunuz?' : 'Reset this match back to PENDING?')) {
                                                                            await predictionTracker.updateResult(pred.id, 'PENDING', null);
                                                                            setTrackingStats(predictionTracker.getStats());
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '0.3rem 0.6rem',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 800,
                                                                        background: pred.status === 'WON' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                                        border: `1px solid ${pred.status === 'WON' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                                                        color: pred.status === 'WON' ? '#10b981' : '#ef4444',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    title={lang === 'tr' ? 'Yanlış tıkladıysanız geri almak (Devam Ediyor yapmak) için tıklayın' : 'Click to undo back to Pending'}
                                                                >
                                                                    {pred.status === 'WON' ? (lang === 'tr' ? '✓ KAZANDI ↺' : '✓ WON ↺') : (lang === 'tr' ? '✗ KAYBETTİ ↺' : '✗ LOST ↺')}
                                                                </button>
                                                            )}

                                                            {/* Individual Delete Button */}
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm(lang === 'tr' ? 'Bu tahmini listeden silmek istediğinize emin misiniz?' : 'Delete this prediction?')) {
                                                                        await predictionTracker.deletePrediction(pred.id);
                                                                        setTrackingStats(predictionTracker.getStats());
                                                                    }
                                                                }}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: 'rgba(255,255,255,0.3)',
                                                                    fontSize: '0.85rem',
                                                                    cursor: 'pointer',
                                                                    padding: '2px 4px'
                                                                }}
                                                                title={lang === 'tr' ? 'Bu kaydı sil' : 'Delete record'}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {predictionTracker.getRecent(20).length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                                    {lang === 'tr' ? 'Henüz kayıtlı tahmin yok' : 'No recorded predictions yet'}
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
                title={lang === 'tr' ? 'Tahmin Performansı' : 'Prediction Performance'}
            >
                📊
            </button>

            {/* Institutional Compliance & Disclaimer Footer */}
            <footer style={{
                marginTop: '4rem',
                marginBottom: '2rem',
                padding: '2.5rem 1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(3, 7, 18, 0.65)',
                borderRadius: '16px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.78rem',
                lineHeight: 1.6
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                    <span style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 900,
                        fontSize: '0.7rem'
                    }}>
                        {t.badge_18_plus || (lang === 'tr' ? '🔞 18+ Yasal Yaş Sınırı' : '🔞 18+ Age Restriction')}
                    </span>
                    <span style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.7rem'
                    }}>
                        {t.badge_responsible || (lang === 'tr' ? '🛡️ Sorumlu Analiz' : '🛡️ Responsible Analytics')}
                    </span>
                    <span style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.7rem'
                    }}>
                        {t.badge_statutory_compliance || (lang === 'tr' ? '⚖️ 7258 Sayılı Kanun Uyumlu' : '⚖️ Strict Regulatory Compliance')}
                    </span>
                </div>
                <div style={{ maxWidth: '850px', margin: '0 auto 0.8rem', color: '#64748b' }}>
                    <strong style={{ color: '#94a3b8' }}>{t.legal_not_bookmaker}</strong>{' '}
                    {t.legal_disclaimer_text}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', alignItems: 'center' }}>
                    <a
                        href="https://t.me/Livebetdeskbot"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            color: '#38bdf8',
                            textDecoration: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        ✈️ {lang === 'tr' ? '7/24 Telegram Destek' : '24/7 Telegram Support'}
                    </a>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <button
                        onClick={() => setIsLegalModalOpen(true)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38bdf8',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 700
                        }}
                    >
                        📜 {t.legal_terms_link}
                    </button>
                </div>
            </footer>

            <LegalModal
                isOpen={isLegalModalOpen}
                onClose={() => setIsLegalModalOpen(false)}
                lang={lang}
            />

            {/* Mobile Bottom Navigation Bar (Sticky app-like navigation on screens <= 768px) */}
            <nav className="mobile-bottom-nav" aria-label="Mobil Navigasyon">
                <button
                    className={`mobile-nav-item ${view === 'DASHBOARD' ? 'active' : ''}`}
                    onClick={() => { setView('DASHBOARD'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    type="button"
                >
                    <span className="mobile-nav-icon">⚡</span>
                    <span className="mobile-nav-label">{lang === 'tr' ? 'Canlı' : 'Live'}</span>
                    {matches.length > 0 && <span className="mobile-nav-badge">{matches.length}</span>}
                </button>
                <button
                    className={`mobile-nav-item trending ${view === 'TRENDING' ? 'active' : ''}`}
                    onClick={() => { setView('TRENDING'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    type="button"
                >
                    <span className="mobile-nav-icon">🔥</span>
                    <span className="mobile-nav-label">{lang === 'tr' ? 'Trendler' : 'Trends'}</span>
                    {(() => {
                        const count = new Set((trendingBets || []).map(b => b.eventId ? String(b.eventId) : `${b.home}_${b.away}`)).size;
                        return count > 0 ? <span className="mobile-nav-badge trending">{count}</span> : null;
                    })()}
                </button>
                <button
                    className={`mobile-nav-item ${view === 'RADAR' ? 'active' : ''}`}
                    onClick={() => { setView('RADAR'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    type="button"
                >
                    <span className="mobile-nav-icon">🎯</span>
                    <span className="mobile-nav-label">{lang === 'tr' ? 'Günlük' : 'Daily'}</span>
                </button>
                <button
                    className={`mobile-nav-item ${view === 'PORTFOLIO' ? 'active' : ''}`}
                    onClick={() => { setView('PORTFOLIO'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    type="button"
                >
                    <span className="mobile-nav-icon">📈</span>
                    <span className="mobile-nav-label">{lang === 'tr' ? 'Portföy' : 'Portfolio'}</span>
                </button>
                {(isAdmin || userProfile?.plan === 'admin') && (
                    <button
                        className={`mobile-nav-item admin ${view === 'ADMIN' ? 'active' : ''}`}
                        onClick={() => { setView('ADMIN'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        type="button"
                    >
                        <span className="mobile-nav-icon">🛡️</span>
                        <span className="mobile-nav-label">Admin</span>
                    </button>
                )}
            </nav>
        </div >
    );
};
