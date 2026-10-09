import React, { useState, useEffect, useMemo } from 'react';
import { getApiBaseUrl, initBackendDiscovery } from '../config.js';
import { bankrollManager } from '../logic/bankrollManager.js';

export const TipsterHub = ({ lang = 'tr', userProfile = null, onOpenVipModal, onFocusMatch, onNavigatePortfolio }) => {
    const [feedData, setFeedData] = useState({ picks: [], leaderboard: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('FEED'); // 'FEED' | 'LEADERBOARD'

    // View & Filter States (Default: Bloomberg-style high-density Terminal Table)
    const [viewMode, setViewMode] = useState('TERMINAL'); // 'TERMINAL' | 'CARDS'
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'LIVE' | 'PREMATCH' | 'COMBO'
    const [filterConfidence, setFilterConfidence] = useState('ALL'); // 'ALL' | '10' | '9_PLUS'
    const [filterSport, setFilterSport] = useState('ALL');
    const [filterOddsRange, setFilterOddsRange] = useState('ALL'); // 'ALL' | 'LOW' (1.40-1.85) | 'MED' (1.85-2.40) | 'HIGH' (2.40+)
    const [sortBy, setSortBy] = useState('NEWEST'); // Default: 'NEWEST' (en son gelene göre) | 'OLDEST' | 'ODDS_DESC' | 'ODDS_ASC' | 'STAKE_DESC' | 'ANALYST'

    // Interactive expansion states for Combos & Analysis Notes
    const [expandedCombos, setExpandedCombos] = useState({});
    const [expandedNotes, setExpandedNotes] = useState({});

    const [toastData, setToastData] = useState(null);
    const [, setBankrollUpdateKey] = useState(0);

    // Multi-language UI text dictionaries
    const t = useMemo(() => {
        const dict = {
            tr: {
                activePicks: 'AKTİF TAHMİN',
                desc: 'Doğrulanmış istatistik geçmişine sahip bağımsız piyasa analistlerinin yüksek güvenli tahminleri.',
                refresh: 'Yenile',
                refreshing: 'Güncelleniyor...',
                livePicks: 'Canlı & Sıcak Tahminler',
                leaderboard: 'Pro Analist Sıralaması (Ligi)',
                viewTerminal: '📊 Terminal (Tablo)',
                viewCards: '🗂️ Kartlar',
                searchPlaceholder: '🔍 Takım, Lig, Analist veya Seçim ara...',
                filterStatus: 'DURUM:',
                filterSportTitle: 'SPOR:',
                filterAll: 'Tümü',
                filterLiveOnly: '🔴 Canlı',
                filterPrematch: '📅 Maç Önü',
                filterCombos: '🎯 Kombineler',
                filterConfTitle: 'GÜVEN:',
                filterConfAll: 'Tümü (8+)',
                filterConf10: '⭐ 10/10 Maksimum',
                filterConf9: '⚡ 9+ Yüksek',
                filterOddsTitle: 'ORAN:',
                filterOddsAll: 'Tümü',
                filterOddsLow: '1.40 - 1.85',
                filterOddsMed: '1.85 - 2.40',
                filterOddsHigh: '2.40+',
                sortByLabel: 'SIRALAMA:',
                sortNewest: '🕒 En Son Gelen (Varsayılan)',
                sortOddsDesc: '📈 En Yüksek Oran',
                sortOddsAsc: '📉 En Düşük Oran',
                sortStakeDesc: '⭐ En Yüksek Güven',
                sortAnalyst: '👤 Analist (A-Z)',
                colTime: 'ZAMAN / TÜR',
                colAnalyst: 'PRO ANALİST',
                colSport: 'SPOR & LİG',
                colMatch: 'KARŞILAŞMA',
                colPick: 'UZMAN SEÇİMİ',
                colOdds: 'PİYASA ORANI',
                colConfidence: 'GÜVEN (STAKE)',
                colActions: 'KASA / İŞLEMLER',
                addToBankroll: 'Kasaya Ekle',
                inBankroll: 'Kasada Açık',
                trackRadar: 'Takip',
                analysisNote: 'Analiz',
                details: 'Detaylar',
                closeDetails: 'Kapat',
                dualConsensus: 'ÇİFTE ONAY',
                resetFilters: 'Filtreleri Temizle',
                showingCount: (shown, total) => `${shown} / ${total} tahmin listeleniyor`,
                noResults: 'Arama ve filtre kriterlerinize uygun tahmin bulunamadı.',
                noResultsTip: 'Filtreleri temizleyerek tüm bağımsız analist sinyallerini görüntüleyebilirsiniz.',
                emptyFeed: 'Kriterlere Uygun Yeni Sinyal Aranıyor',
                emptyFeedDesc: 'Analist motoru arka planda 24/7 akışı takip ediyor. Filtre kriterlerini genişletebilir veya yenile butonuna basabilirsiniz.',
                comboTitle: (n) => `🎯 ${n}'Lİ KOMBİNE KUPON DETAYLARI:`,
                comboTotalOdds: 'Bileşik Toplam Oran:',
                toastAdded: (name) => `💼 "${name}" kasanıza eklendi!`,
                toastAlreadyIn: '⚠️ Bu tahmin zaten kasanızda açık işlem olarak bulunuyor.',
                toastSaved: 'Kupon kasanıza kaydedildi.',
                toastRadar: (name) => `📡 "${name}" canlı radarda takibe alındı!`,
                singlePickTitle: 'UZMAN SEÇİMİ',
                comboMatchLabel: (n) => `🎯 Çoklu Karşılaşma (${n} Maç)`
            },
            en: {
                activePicks: 'ACTIVE PICKS',
                desc: 'High-confidence market picks from independently verified expert analysts with audited records.',
                refresh: 'Refresh',
                refreshing: 'Refreshing...',
                livePicks: 'Live & Hot Picks',
                leaderboard: 'Pro Analyst Leaderboard',
                viewTerminal: '📊 Terminal (Table)',
                viewCards: '🗂️ Cards',
                searchPlaceholder: '🔍 Search match, league, analyst or pick...',
                filterStatus: 'STATUS:',
                filterSportTitle: 'SPORT:',
                filterAll: 'All',
                filterLiveOnly: '🔴 Live',
                filterPrematch: '📅 Pre-Match',
                filterCombos: '🎯 Combos',
                filterConfTitle: 'CONFIDENCE:',
                filterConfAll: 'All (8+)',
                filterConf10: '⭐ 10/10 Max',
                filterConf9: '⚡ 9+ High',
                filterOddsTitle: 'ODDS:',
                filterOddsAll: 'All',
                filterOddsLow: '1.40 - 1.85',
                filterOddsMed: '1.85 - 2.40',
                filterOddsHigh: '2.40+',
                sortByLabel: 'SORT BY:',
                sortNewest: '🕒 Newest First (Default)',
                sortOddsDesc: '📈 Highest Odds',
                sortOddsAsc: '📉 Lowest Odds',
                sortStakeDesc: '⭐ Highest Confidence',
                sortAnalyst: '👤 Analyst (A-Z)',
                colTime: 'TIME / TYPE',
                colAnalyst: 'PRO ANALYST',
                colSport: 'SPORT & LEAGUE',
                colMatch: 'MATCH',
                colPick: 'EXPERT PICK',
                colOdds: 'MARKET ODDS',
                colConfidence: 'STAKE / CONFIDENCE',
                colActions: 'BANKROLL / ACTIONS',
                addToBankroll: 'Add to Bankroll',
                inBankroll: 'In Bankroll',
                trackRadar: 'Track',
                analysisNote: 'Analysis',
                details: 'Details',
                closeDetails: 'Close',
                dualConsensus: 'DUAL CONSENSUS',
                resetFilters: 'Reset Filters',
                showingCount: (shown, total) => `Showing ${shown} of ${total} picks`,
                noResults: 'No picks match your search and filter criteria.',
                noResultsTip: 'Reset filters to view all available verified picks.',
                emptyFeed: 'Searching for Qualifying Signals',
                emptyFeedDesc: 'The analyst engine monitors feeds 24/7. Broaden filters or click refresh.',
                comboTitle: (n) => `🎯 ${n}-LEG COMBO DETAILS:`,
                comboTotalOdds: 'Total Acca Odds:',
                toastAdded: (name) => `💼 "${name}" added to bankroll!`,
                toastAlreadyIn: '⚠️ This pick is already open in your bankroll ledger.',
                toastSaved: 'Pick saved to bankroll.',
                toastRadar: (name) => `📡 "${name}" pinned to live tracking!`,
                singlePickTitle: 'EXPERT PICK',
                comboMatchLabel: (n) => `🎯 Multi-Event Acca (${n} Legs)`
            },
            de: {
                activePicks: 'AKTIVE TIPPS',
                desc: 'Verifizierte Experten-Tipps von unabhängigen Analysten mit geprüfter Rendite.',
                refresh: 'Aktualisieren',
                refreshing: 'Wird aktualisiert...',
                livePicks: 'Live & Heiße Tipps',
                leaderboard: 'Profi-Analysten Rangliste',
                viewTerminal: '📊 Terminal (Tabelle)',
                viewCards: '🗂️ Karten',
                searchPlaceholder: '🔍 Spiel, Liga, Analyst oder Tipp suchen...',
                filterStatus: 'STATUS:',
                filterSportTitle: 'SPORT:',
                filterAll: 'Alle',
                filterLiveOnly: '🔴 Nur Live',
                filterPrematch: '📅 Vor dem Spiel',
                filterCombos: '🎯 Kombis',
                filterConfTitle: 'VERTRAUEN:',
                filterConfAll: 'Alle (8+)',
                filterConf10: '⭐ 10/10 Max',
                filterConf9: '⚡ 9+ Hoch',
                filterOddsTitle: 'QUOTE:',
                filterOddsAll: 'Alle',
                filterOddsLow: '1.40 - 1.85',
                filterOddsMed: '1.85 - 2.40',
                filterOddsHigh: '2.40+',
                sortByLabel: 'SORTIEREN:',
                sortNewest: '🕒 Neueste zuerst (Standard)',
                sortOddsDesc: '📈 Höchste Quoten',
                sortOddsAsc: '📉 Niedrigste Quoten',
                sortStakeDesc: '⭐ Höchstes Vertrauen',
                sortAnalyst: '👤 Analyst (A-Z)',
                colTime: 'ZEIT / TYP',
                colAnalyst: 'PROFI-ANALYST',
                colSport: 'SPORT & LIGA',
                colMatch: 'BEGEGNUNG',
                colPick: 'EXPERTENTIPP',
                colOdds: 'MARKTQUOTE',
                colConfidence: 'VERTRAUEN (EINSATZ)',
                colActions: 'DEPOT / AKTIONEN',
                addToBankroll: 'Zum Depot',
                inBankroll: 'Im Depot',
                trackRadar: 'Verfolgen',
                analysisNote: 'Analyse',
                details: 'Details',
                closeDetails: 'Schließen',
                dualConsensus: 'DOPPELTER KONSENS',
                resetFilters: 'Filter zurücksetzen',
                showingCount: (shown, total) => `${shown} von ${total} Tipps angezeigt`,
                noResults: 'Keine Tipps entsprechen den Filterkriterien.',
                noResultsTip: 'Filter zurücksetzen, um alle geprüften Tipps anzuzeigen.',
                emptyFeed: 'Suche nach qualifizierten Signalen',
                emptyFeedDesc: 'Das Analysten-System überwacht Feeds 24/7. Erweitern Sie die Filter oder aktualisieren Sie.',
                comboTitle: (n) => `🎯 ${n}ER-KOMBI DETAILS:`,
                comboTotalOdds: 'Kombinierte Gesamtquote:',
                toastAdded: (name) => `💼 "${name}" zum Depot hinzugefügt!`,
                toastAlreadyIn: '⚠️ Diese Wette ist bereits im Depot geöffnet.',
                toastSaved: 'Wette zum Depot hinzugefügt.',
                toastRadar: (name) => `📡 "${name}" zur Live-Verfolgung angeheftet!`,
                singlePickTitle: 'EXPERTENTIPP',
                comboMatchLabel: (n) => `🎯 Mehrfach-Kombi (${n} Spiele)`
            }
        };
        return dict[lang] || dict.tr;
    }, [lang]);

    // Listen for bankroll state changes to refresh "in portfolio" badge
    useEffect(() => {
        const handleBankUpdate = () => setBankrollUpdateKey(k => k + 1);
        window.addEventListener('bankroll_state_changed', handleBankUpdate);
        return () => window.removeEventListener('bankroll_state_changed', handleBankUpdate);
    }, []);

    const showToast = (msg, canGoToPortfolio = false) => {
        setToastData({
            message: msg,
            showPortfolioBtn: canGoToPortfolio && typeof onNavigatePortfolio === 'function'
        });
        setTimeout(() => setToastData(null), 4500);
    };

    const isAlreadyInPortfolio = (pickId) => {
        if (!bankrollManager || typeof bankrollManager.isMatchOpenInLedger !== 'function') return false;
        return bankrollManager.isMatchOpenInLedger(pickId) || bankrollManager.isMatchOpenInLedger(`tip-${pickId}`);
    };

    const fetchFeed = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const proxyBase = await initBackendDiscovery() || getApiBaseUrl();
            const params = new URLSearchParams();
            if (forceRefresh) params.append('refresh', '1');

            const res = await fetch(`${proxyBase}/api/tipsters/feed?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.picks)) {
                    // Strictly enforce minimum confidence: 8/10 and above are displayed
                    const highConfidenceOnly = json.picks.filter(p => (p.stake || 0) >= 8);
                    setFeedData({ ...json, picks: highConfidenceOnly });
                }
            }
        } catch (err) {
            console.error('[TIPSTER_HUB] Fetch error:', err);
        } finally {
            setLoading(false);
            if (forceRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        const timer = setInterval(() => fetchFeed(false), 30000); // 30 sec auto-refresh
        return () => clearInterval(timer);
    }, []);

    const handleAddToPortfolio = (pick) => {
        try {
            const betItem = {
                id: `tip-${pick.id}`,
                match_id: pick.id,
                match_name: pick.matchName,
                selection: pick.selection,
                odds: pick.odds,
                stake: Math.max(10, Math.round((pick.stake || 5) * 20)), // 8/10 -> 160 ₺
                status: 'OPEN',
                sport: pick.sport,
                sportDetails: pick.sportDetails,
                created_at: new Date().toISOString(),
                source: `Uzman Analist (${pick.analyst?.name || 'Sistem'})`,
                analyst: pick.analyst,
                comboLegs: pick.comboLegs || null
            };
            if (bankrollManager && typeof bankrollManager.addCustomBet === 'function') {
                const res = bankrollManager.addCustomBet(betItem);
                if (res === false) {
                    showToast(t.toastAlreadyIn);
                    return;
                }
            }
            showToast(t.toastAdded(pick.matchName), true);
        } catch (e) {
            console.error('Error adding to portfolio:', e);
            showToast(t.toastSaved);
        }
    };

    const handleTrackOnRadar = (pick) => {
        if (typeof onFocusMatch === 'function') {
            onFocusMatch(pick.matchName);
        }
        showToast(t.toastRadar(pick.matchName));
    };

    const toggleCombo = (id) => {
        setExpandedCombos(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleNote = (id) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Extract all unique sports present in current picks
    const availableSports = useMemo(() => {
        const sports = new Set();
        (feedData.picks || []).forEach(p => {
            if (p.sport) sports.add(p.sport);
        });
        return Array.from(sports);
    }, [feedData.picks]);

    // Robust age extraction from ageText string or explicit ageMinutes
    const parseAgeMinutes = (pick) => {
        if (typeof pick.ageMinutes === 'number' && !isNaN(pick.ageMinutes) && pick.ageMinutes >= 0) {
            return pick.ageMinutes;
        }

        const text = (pick.ageText || '').toLowerCase().trim();
        if (!text || text === 'yeni' || text === 'az önce' || text === 'just now') {
            return 0;
        }

        const numMatch = text.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : 1;

        if (text.includes('sn') || text.includes('sec')) return num / 60;
        if (text.includes('dk') || text.includes('min')) return num;
        if (text.includes('sa') || text.includes('hour') || text.includes('std')) return num * 60;
        if (text.includes('gün') || text.includes('day') || text.includes('tag')) return num * 1440;
        if (text.includes('dün') || text.includes('yesterday') || text.includes('gestern')) return 1440;

        if (typeof pick.postedAt === 'number' && !isNaN(pick.postedAt) && pick.postedAt > 0) {
            return Math.max(0, (Date.now() - pick.postedAt) / (60 * 1000));
        }

        return 999999;
    };

    // Helper timestamp extractor strictly honoring exact relative age
    const getPickTimestamp = (p) => {
        // In-play live picks always stay at the absolute top
        if (p.isLive) {
            return Date.now() + 1000000;
        }

        const ageMins = parseAgeMinutes(p);
        if (ageMins !== 999999) {
            return Date.now() - (ageMins * 60 * 1000);
        }

        if (typeof p.postedAt === 'number' && !isNaN(p.postedAt) && p.postedAt > 0) {
            return p.postedAt;
        }

        if (p.createdAt) {
            const parsed = new Date(p.createdAt).getTime();
            if (!isNaN(parsed)) return parsed;
        }

        return 0;
    };

    // Filter & Sort picks with strict "En Son Gelene Göre" default
    const filteredAndSortedPicks = useMemo(() => {
        if (!feedData.picks || !Array.isArray(feedData.picks)) return [];

        let list = feedData.picks.filter(p => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchNameMatch = (p.matchName || '').toLowerCase().includes(q);
                const analystMatch = (p.analyst?.name || '').toLowerCase().includes(q);
                const sportMatch = (p.sportDetails || p.sport || '').toLowerCase().includes(q);
                const selectionMatch = (p.selection || '').toLowerCase().includes(q);
                const comboMatch = p.isCombo && Array.isArray(p.comboLegs) && p.comboLegs.some(leg =>
                    (leg.event || '').toLowerCase().includes(q) || (leg.selection || '').toLowerCase().includes(q)
                );
                if (!matchNameMatch && !analystMatch && !sportMatch && !selectionMatch && !comboMatch) {
                    return false;
                }
            }

            // Status filter
            if (filterStatus === 'LIVE' && !p.isLive) return false;
            if (filterStatus === 'PREMATCH' && p.isLive) return false;
            if (filterStatus === 'COMBO' && !p.isCombo) return false;

            // Confidence filter
            if (filterConfidence === '10' && (p.stake || 0) < 10) return false;
            if (filterConfidence === '9_PLUS' && (p.stake || 0) < 9) return false;

            // Sport filter
            if (filterSport !== 'ALL' && (p.sport || '') !== filterSport) return false;

            // Odds range filter
            const oddsVal = typeof p.odds === 'number' ? p.odds : parseFloat(p.odds) || 0;
            if (filterOddsRange === 'LOW' && (oddsVal < 1.40 || oddsVal >= 1.85)) return false;
            if (filterOddsRange === 'MED' && (oddsVal < 1.85 || oddsVal > 2.40)) return false;
            if (filterOddsRange === 'HIGH' && oddsVal <= 2.40) return false;

            return true;
        });

        // Strict Sorting: En Son Gelene Göre (Newest first) by default
        list.sort((a, b) => {
            if (sortBy === 'NEWEST') {
                const timeA = getPickTimestamp(a);
                const timeB = getPickTimestamp(b);
                if (timeB !== timeA) return timeB - timeA;
                return 0;
            }
            if (sortBy === 'OLDEST') {
                const timeA = getPickTimestamp(a);
                const timeB = getPickTimestamp(b);
                if (timeA !== timeB) return timeA - timeB;
                return 0;
            }
            if (sortBy === 'ODDS_DESC') {
                return (b.odds || 0) - (a.odds || 0);
            }
            if (sortBy === 'ODDS_ASC') {
                return (a.odds || 0) - (b.odds || 0);
            }
            if (sortBy === 'STAKE_DESC') {
                return (b.stake || 0) - (a.stake || 0);
            }
            if (sortBy === 'ANALYST') {
                return (a.analyst?.name || '').localeCompare(b.analyst?.name || '');
            }
            return 0;
        });

        return list;
    }, [feedData.picks, searchQuery, filterStatus, filterConfidence, filterSport, filterOddsRange, sortBy]);

    // Check if any filter is active
    const isAnyFilterActive = Boolean(
        searchQuery.trim() ||
        filterStatus !== 'ALL' ||
        filterConfidence !== 'ALL' ||
        filterSport !== 'ALL' ||
        filterOddsRange !== 'ALL' ||
        sortBy !== 'NEWEST'
    );

    const resetFilters = () => {
        setSearchQuery('');
        setFilterStatus('ALL');
        setFilterConfidence('ALL');
        setFilterSport('ALL');
        setFilterOddsRange('ALL');
        setSortBy('NEWEST');
    };

    // Sport emoji helper
    const getSportEmoji = (sportStr) => {
        const s = (sportStr || '').toLowerCase();
        if (s.includes('futbol') || s.includes('football') || s.includes('soccer')) return '⚽';
        if (s.includes('basket')) return '🏀';
        if (s.includes('tenis') || s.includes('tennis')) return '🎾';
        if (s.includes('buz') || s.includes('ice') || s.includes('hockey')) return '🏒';
        if (s.includes('voleybol') || s.includes('volley')) return '🏐';
        if (s.includes('hentbol') || s.includes('handball')) return '🤾';
        if (s.includes('beyzbol') || s.includes('baseball')) return '⚾';
        return '🎯';
    };

    return (
        <div className="tipster-hub-container" style={{
            maxWidth: '1440px',
            margin: '1.25rem auto 3.5rem',
            padding: '0 1rem',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
            {/* Toast notification */}
            {toastData && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    color: '#fff',
                    padding: '0.85rem 1.3rem',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>💼</span>
                        <span>{toastData.message}</span>
                    </div>
                    {toastData.showPortfolioBtn && (
                        <button
                            onClick={() => {
                                setToastData(null);
                                onNavigatePortfolio();
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}
                        >
                            <span>{lang === 'tr' ? 'Kasaya Git' : 'Open Portfolio'}</span>
                            <span>➔</span>
                        </button>
                    )}
                </div>
            )}

            {/* Top Bar / Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: '1.65rem',
                            fontWeight: 900,
                            letterSpacing: '-0.5px',
                            background: 'linear-gradient(135deg, #38bdf8, #60a5fa, #c084fc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem'
                        }}>
                            <span>📡</span>
                            <span>PRO ANALYSTS HUB</span>
                        </h2>
                        <span style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontWeight: 800
                        }}>
                            {feedData.picks.length} {t.activePicks}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                        {t.desc}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                        onClick={() => fetchFeed(true)}
                        disabled={refreshing}
                        style={{
                            padding: '0.6rem 1.1rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#e2e8f0',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'all 0.4s' }}>🔄</span>
                        <span>{refreshing ? t.refreshing : t.refresh}</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs (Feed vs Leaderboard) */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                    onClick={() => setActiveTab('FEED')}
                    style={{
                        padding: '0.7rem 1.4rem',
                        borderRadius: '12px',
                        border: activeTab === 'FEED' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: activeTab === 'FEED' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(37, 99, 235, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                        color: activeTab === 'FEED' ? '#38bdf8' : '#94a3b8',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <span>⚡</span>
                    <span>{t.livePicks}</span>
                    <span style={{
                        background: activeTab === 'FEED' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                        color: activeTab === 'FEED' ? '#000' : '#fff',
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '10px'
                    }}>
                        {feedData.picks.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('LEADERBOARD')}
                    style={{
                        padding: '0.7rem 1.4rem',
                        borderRadius: '12px',
                        border: activeTab === 'LEADERBOARD' ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: activeTab === 'LEADERBOARD' ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(217, 119, 6, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                        color: activeTab === 'LEADERBOARD' ? '#fbbf24' : '#94a3b8',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <span>🏆</span>
                    <span>{t.leaderboard}</span>
                </button>
            </div>

            {/* TAB 1: PICKS FEED */}
            {activeTab === 'FEED' && (
                <div>
                    {/* RICH FILTER & TERMINAL CONTROL PANEL */}
                    <div style={{
                        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85), rgba(10, 15, 26, 0.95))',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '14px',
                        padding: '1rem 1.25rem',
                        marginBottom: '1.25rem',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                    }}>
                        {/* Row 1: Search Input + View Mode Toggle + Sort Selector */}
                        <div style={{
                            display: 'flex',
                            gap: '0.85rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between'
                        }}>
                            {/* Search Field */}
                            <div style={{
                                position: 'relative',
                                flex: '1 1 320px',
                                minWidth: '240px'
                            }}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t.searchPlaceholder}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.45)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 2.2rem 0.65rem 0.9rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                        title={t.resetFilters}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* View Mode Toggle: Terminal vs Cards */}
                            <div style={{
                                display: 'inline-flex',
                                background: 'rgba(0, 0, 0, 0.4)',
                                padding: '3px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                                <button
                                    onClick={() => setViewMode('TERMINAL')}
                                    style={{
                                        padding: '0.5rem 0.9rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: viewMode === 'TERMINAL' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                                        color: viewMode === 'TERMINAL' ? '#ffffff' : '#94a3b8',
                                        fontWeight: 800,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem'
                                    }}
                                >
                                    <span>{t.viewTerminal}</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('CARDS')}
                                    style={{
                                        padding: '0.5rem 0.9rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: viewMode === 'CARDS' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                                        color: viewMode === 'CARDS' ? '#ffffff' : '#94a3b8',
                                        fontWeight: 800,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem'
                                    }}
                                >
                                    <span>{t.viewCards}</span>
                                </button>
                            </div>

                            {/* Sort Selector Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800 }}>{t.sortByLabel}</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.45)',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        borderRadius: '8px',
                                        color: '#38bdf8',
                                        padding: '0.55rem 0.8rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="NEWEST" style={{ background: '#0f172a', color: '#fff' }}>{t.sortNewest}</option>
                                    <option value="ODDS_DESC" style={{ background: '#0f172a', color: '#fff' }}>{t.sortOddsDesc}</option>
                                    <option value="ODDS_ASC" style={{ background: '#0f172a', color: '#fff' }}>{t.sortOddsAsc}</option>
                                    <option value="STAKE_DESC" style={{ background: '#0f172a', color: '#fff' }}>{t.sortStakeDesc}</option>
                                    <option value="ANALYST" style={{ background: '#0f172a', color: '#fff' }}>{t.sortAnalyst}</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Unified Filter Bar (Status, Sport, Confidence, Odds) */}
                        <div style={{
                            display: 'flex',
                            gap: '0.65rem 0.85rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            paddingTop: '0.65rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                            {/* Status Filter */}
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, marginRight: '2px' }}>{t.filterStatus}</span>
                                {[
                                    { id: 'ALL', label: t.filterAll },
                                    { id: 'LIVE', label: t.filterLiveOnly },
                                    { id: 'PREMATCH', label: t.filterPrematch },
                                    { id: 'COMBO', label: t.filterCombos }
                                ].map(btn => (
                                    <button
                                        key={btn.id}
                                        onClick={() => setFilterStatus(btn.id)}
                                        style={{
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            border: filterStatus === btn.id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                            background: filterStatus === btn.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                                            color: filterStatus === btn.id ? '#38bdf8' : '#94a3b8',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>

                            <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>

                            {/* Sport Filter */}
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, marginRight: '2px' }}>{t.filterSportTitle}</span>
                                <button
                                    onClick={() => setFilterSport('ALL')}
                                    style={{
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: '6px',
                                        border: filterSport === 'ALL' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                        background: filterSport === 'ALL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                                        color: filterSport === 'ALL' ? '#38bdf8' : '#94a3b8',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t.filterAll}
                                </button>
                                {availableSports.map(sp => (
                                    <button
                                        key={sp}
                                        onClick={() => setFilterSport(sp)}
                                        style={{
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            border: filterSport === sp ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                            background: filterSport === sp ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                                            color: filterSport === sp ? '#38bdf8' : '#94a3b8',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                    >
                                        <span>{getSportEmoji(sp)}</span>
                                        <span>{sp}</span>
                                    </button>
                                ))}
                            </div>

                            <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>

                            {/* Confidence Filter */}
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, marginRight: '2px' }}>{t.filterConfTitle}</span>
                                {[
                                    { id: 'ALL', label: t.filterConfAll },
                                    { id: '10', label: t.filterConf10 },
                                    { id: '9_PLUS', label: t.filterConf9 }
                                ].map(btn => (
                                    <button
                                        key={btn.id}
                                        onClick={() => setFilterConfidence(btn.id)}
                                        style={{
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            border: filterConfidence === btn.id ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.08)',
                                            background: filterConfidence === btn.id ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.02)',
                                            color: filterConfidence === btn.id ? '#fbbf24' : '#94a3b8',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>

                            <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>

                            {/* Odds Range Filter */}
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, marginRight: '2px' }}>{t.filterOddsTitle}</span>
                                {[
                                    { id: 'ALL', label: t.filterOddsAll },
                                    { id: 'LOW', label: t.filterOddsLow },
                                    { id: 'MED', label: t.filterOddsMed },
                                    { id: 'HIGH', label: t.filterOddsHigh }
                                ].map(btn => (
                                    <button
                                        key={btn.id}
                                        onClick={() => setFilterOddsRange(btn.id)}
                                        style={{
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            border: filterOddsRange === btn.id ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                                            background: filterOddsRange === btn.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                                            color: filterOddsRange === btn.id ? '#10b981' : '#94a3b8',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row 3: Result Count and Reset Button */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.76rem',
                            color: '#94a3b8',
                            paddingTop: '0.4rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.04)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: '#38bdf8', fontWeight: 900 }}>●</span>
                                <span>{t.showingCount(filteredAndSortedPicks.length, feedData.picks.length)}</span>
                            </div>

                            {isAnyFilterActive && (
                                <button
                                    onClick={resetFilters}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444',
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span>✕</span>
                                    <span>{t.resetFilters}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🔄</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                                {lang === 'tr' ? 'Doğrulanmış piyasa sinyalleri taranıyor...' : 'Scanning verified market signals...'}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && feedData.picks.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 2rem',
                            background: 'rgba(15, 23, 42, 0.4)',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📡</div>
                            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
                                {t.emptyFeed}
                            </h3>
                            <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '0.85rem' }}>
                                {t.emptyFeedDesc}
                            </p>
                        </div>
                    )}

                    {/* No Filter Results State */}
                    {!loading && feedData.picks.length > 0 && filteredAndSortedPicks.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '3.5rem 2rem',
                            background: 'rgba(15, 23, 42, 0.5)',
                            borderRadius: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>🔍</div>
                            <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.4rem' }}>
                                {t.noResults}
                            </h3>
                            <p style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
                                {t.noResultsTip}
                            </p>
                            <button
                                onClick={resetFilters}
                                style={{
                                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.55rem 1.2rem',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {t.resetFilters}
                            </button>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* PRIMARY VIEW 1: BLOOMBERG-STYLE TERMINAL TABLE VIEW       */}
                    {/* ======================================================== */}
                    {!loading && filteredAndSortedPicks.length > 0 && viewMode === 'TERMINAL' && (
                        <div style={{
                            background: 'linear-gradient(180deg, #090e1a, #0b1120)',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)'
                        }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    textAlign: 'left',
                                    fontSize: '0.82rem'
                                }}>
                                    {/* Table Header */}
                                    <thead>
                                        <tr style={{
                                            background: '#0d1527',
                                            borderBottom: '2px solid rgba(56, 189, 248, 0.25)',
                                            color: '#94a3b8',
                                            fontSize: '0.72rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}>
                                            {/* ZAMAN / TÜR */}
                                            <th
                                                onClick={() => setSortBy(sortBy === 'NEWEST' ? 'OLDEST' : 'NEWEST')}
                                                style={{ padding: '0.85rem 1rem', cursor: 'pointer', userSelect: 'none' }}
                                                title="Zamana göre sırala (En Yeni / En Eski)"
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ color: sortBy === 'NEWEST' || sortBy === 'OLDEST' ? '#38bdf8' : '#94a3b8' }}>
                                                        {t.colTime}
                                                    </span>
                                                    {sortBy === 'NEWEST' && <span style={{ color: '#38bdf8', fontWeight: 900 }}>▼</span>}
                                                    {sortBy === 'OLDEST' && <span style={{ color: '#38bdf8', fontWeight: 900 }}>▲</span>}
                                                    {sortBy !== 'NEWEST' && sortBy !== 'OLDEST' && <span style={{ opacity: 0.25 }}>↕</span>}
                                                </div>
                                            </th>

                                            {/* PRO ANALİST */}
                                            <th
                                                onClick={() => setSortBy(sortBy === 'ANALYST' ? 'NEWEST' : 'ANALYST')}
                                                style={{ padding: '0.85rem 0.9rem', cursor: 'pointer', userSelect: 'none' }}
                                                title="Analist ismine göre alfabetik sırala"
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ color: sortBy === 'ANALYST' ? '#38bdf8' : '#94a3b8' }}>
                                                        {t.colAnalyst}
                                                    </span>
                                                    {sortBy === 'ANALYST' && <span style={{ color: '#38bdf8', fontWeight: 900 }}>▲</span>}
                                                    {sortBy !== 'ANALYST' && <span style={{ opacity: 0.25 }}>↕</span>}
                                                </div>
                                            </th>

                                            {/* SPOR & LİG */}
                                            <th style={{ padding: '0.85rem 0.9rem' }}>{t.colSport}</th>

                                            {/* KARŞILAŞMA */}
                                            <th style={{ padding: '0.85rem 1rem' }}>{t.colMatch}</th>

                                            {/* UZMAN SEÇİMİ */}
                                            <th style={{ padding: '0.85rem 1rem' }}>{t.colPick}</th>

                                            {/* PİYASA ORANI */}
                                            <th
                                                onClick={() => setSortBy(sortBy === 'ODDS_DESC' ? 'ODDS_ASC' : 'ODDS_DESC')}
                                                style={{ padding: '0.85rem 0.9rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                                title="Orana göre sırala (Yüksek / Düşük)"
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ color: sortBy.startsWith('ODDS') ? '#10b981' : '#94a3b8' }}>
                                                        {t.colOdds}
                                                    </span>
                                                    {sortBy === 'ODDS_DESC' && <span style={{ color: '#10b981', fontWeight: 900 }}>▼</span>}
                                                    {sortBy === 'ODDS_ASC' && <span style={{ color: '#10b981', fontWeight: 900 }}>▲</span>}
                                                    {!sortBy.startsWith('ODDS') && <span style={{ opacity: 0.25 }}>↕</span>}
                                                </div>
                                            </th>

                                            {/* GÜVEN (STAKE) */}
                                            <th
                                                onClick={() => setSortBy(sortBy === 'STAKE_DESC' ? 'NEWEST' : 'STAKE_DESC')}
                                                style={{ padding: '0.85rem 0.9rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                                title="Güven derecesine göre sırala"
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ color: sortBy === 'STAKE_DESC' ? '#fbbf24' : '#94a3b8' }}>
                                                        {t.colConfidence}
                                                    </span>
                                                    {sortBy === 'STAKE_DESC' && <span style={{ color: '#fbbf24', fontWeight: 900 }}>▼</span>}
                                                    {sortBy !== 'STAKE_DESC' && <span style={{ opacity: 0.25 }}>↕</span>}
                                                </div>
                                            </th>

                                            {/* KASA / İŞLEMLER */}
                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>{t.colActions}</th>
                                        </tr>
                                    </thead>

                                    {/* Table Body */}
                                    <tbody>
                                        {filteredAndSortedPicks.map((pick, pIdx) => {
                                            const inPortfolio = isAlreadyInPortfolio(pick.id);
                                            const isComboExpanded = Boolean(expandedCombos[pick.id]);
                                            const isNoteExpanded = Boolean(expandedNotes[pick.id]);
                                            const oddsDisplay = typeof pick.odds === 'number' ? pick.odds.toFixed(2) : pick.odds;

                                            return (
                                                <React.Fragment key={pick.id || pIdx}>
                                                    <tr style={{
                                                        borderBottom: isComboExpanded || isNoteExpanded ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                                                        background: pick.isDualConsensus 
                                                            ? 'rgba(234, 179, 8, 0.04)' 
                                                            : (pIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent'),
                                                        transition: 'background 0.15s ease',
                                                        borderLeft: pick.isDualConsensus ? '3px solid #eab308' : '3px solid transparent'
                                                    }}>
                                                        {/* COL 1: ZAMAN / TÜR */}
                                                        <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                {pick.isLive ? (
                                                                    <span style={{
                                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                                        color: '#ef4444',
                                                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                                                        padding: '2px 7px',
                                                                        borderRadius: '10px',
                                                                        fontSize: '0.68rem',
                                                                        fontWeight: 900,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        width: 'fit-content'
                                                                    }}>
                                                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }}></span>
                                                                        CANLI
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
                                                                        🕒 {pick.ageText || 'Az önce'}
                                                                    </span>
                                                                )}

                                                                {pick.isDualConsensus && (
                                                                    <span style={{
                                                                        background: 'linear-gradient(90deg, #eab308, #d97706)',
                                                                        color: '#000',
                                                                        padding: '1px 6px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.64rem',
                                                                        fontWeight: 900,
                                                                        letterSpacing: '0.4px',
                                                                        width: 'fit-content'
                                                                    }}>
                                                                        ⚡ {t.dualConsensus}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* COL 2: PRO ANALİST */}
                                                        <td style={{ padding: '0.9rem 0.9rem', whiteSpace: 'nowrap' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                                                <div style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '50%',
                                                                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '1rem',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {pick.analyst?.avatarIndex ? ['🎯','🧠','⚡','👑','🔥','🛡️','🔭','⚽'][(pick.analyst.avatarIndex - 1) % 8] : '👑'}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.85rem' }}>
                                                                        {pick.analyst?.name || 'Kıdemli Analist'}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700 }}>
                                                                        {pick.analyst?.badge || '🔥 Formda'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* COL 3: SPOR & LİG */}
                                                        <td style={{ padding: '0.9rem 0.9rem' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 800 }}>
                                                                    <span>{getSportEmoji(pick.sport)}</span>
                                                                    <span>{pick.sport}</span>
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, lineHeight: 1.25 }}>
                                                                    {pick.sportDetails || '-'}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* COL 4: KARŞILAŞMA */}
                                                        <td style={{ padding: '0.9rem 1rem' }}>
                                                            {pick.isCombo ? (
                                                                <div>
                                                                    <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span>🎯</span>
                                                                        <span>{t.comboMatchLabel(pick.comboLegs?.length || 2)}</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600, marginTop: '3px', lineHeight: 1.3 }}>
                                                                        {pick.matchName.replace(/^2'li Kombine:\s*/i, '').replace(/^[0-9]+'li Kombine:\s*/i, '')}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div style={{
                                                                    fontWeight: 800,
                                                                    color: '#ffffff',
                                                                    fontSize: '0.88rem',
                                                                    lineHeight: 1.3
                                                                }}>
                                                                    {pick.matchName}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* COL 5: UZMAN SEÇİMİ */}
                                                        <td style={{ padding: '0.9rem 1rem' }}>
                                                            {pick.isCombo && pick.comboLegs && pick.comboLegs.length > 0 ? (
                                                                <button
                                                                    onClick={() => toggleCombo(pick.id)}
                                                                    style={{
                                                                        background: isComboExpanded ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.12)',
                                                                        border: isComboExpanded ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.4)',
                                                                        color: '#fbbf24',
                                                                        padding: '0.35rem 0.75rem',
                                                                        borderRadius: '8px',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: 900,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '5px'
                                                                    }}
                                                                >
                                                                    <span>🎯 {pick.comboLegs.length}'li Kombine</span>
                                                                    <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>
                                                                        {isComboExpanded ? `▲ ${t.closeDetails}` : `▼ ${t.details}`}
                                                                    </span>
                                                                </button>
                                                            ) : (
                                                                <span style={{
                                                                    color: '#38bdf8',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.86rem',
                                                                    background: 'rgba(56, 189, 248, 0.08)',
                                                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                                                    padding: '3px 8px',
                                                                    borderRadius: '6px',
                                                                    display: 'inline-block'
                                                                }}>
                                                                    {pick.selection || 'Seçim'}
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* COL 6: PİYASA ORANI */}
                                                        <td style={{ padding: '0.9rem 0.9rem', textAlign: 'center' }}>
                                                            <div style={{
                                                                display: 'inline-block',
                                                                background: 'rgba(16, 185, 129, 0.15)',
                                                                border: '1px solid rgba(16, 185, 129, 0.45)',
                                                                color: '#10b981',
                                                                fontWeight: 900,
                                                                fontFamily: 'monospace',
                                                                fontSize: '1.05rem',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '8px',
                                                                letterSpacing: '0.3px',
                                                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
                                                            }}>
                                                                {oddsDisplay}
                                                            </div>
                                                        </td>

                                                        {/* COL 7: GÜVEN (STAKE) */}
                                                        <td style={{ padding: '0.9rem 0.9rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                                <span style={{
                                                                    color: pick.stake >= 9 ? '#fbbf24' : '#38bdf8',
                                                                    fontWeight: 900,
                                                                    fontSize: '0.82rem'
                                                                }}>
                                                                    {pick.stake}/10 {pick.stake >= 9 ? '⭐' : ''}
                                                                </span>
                                                                <div style={{
                                                                    width: '45px',
                                                                    height: '4px',
                                                                    background: 'rgba(255,255,255,0.08)',
                                                                    borderRadius: '2px',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    <div style={{
                                                                        width: `${Math.min(100, (pick.stake / 10) * 100)}%`,
                                                                        height: '100%',
                                                                        background: pick.stake >= 9 ? 'linear-gradient(90deg, #eab308, #fbbf24)' : 'linear-gradient(90deg, #38bdf8, #2563eb)'
                                                                    }}></div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* COL 8: KASA / İŞLEMLER */}
                                                        <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                                {/* Analysis Note Toggle Button */}
                                                                {pick.analysis && (
                                                                    <button
                                                                        onClick={() => toggleNote(pick.id)}
                                                                        title={isNoteExpanded ? 'Notu kapat' : 'Analiz notunu oku'}
                                                                        style={{
                                                                            background: isNoteExpanded ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                                            border: isNoteExpanded ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                                                                            color: isNoteExpanded ? '#38bdf8' : '#94a3b8',
                                                                            padding: '0.45rem 0.6rem',
                                                                            borderRadius: '8px',
                                                                            fontSize: '0.74rem',
                                                                            fontWeight: 700,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        💬
                                                                    </button>
                                                                )}

                                                                {/* Add to Bankroll Button */}
                                                                <button
                                                                    onClick={() => inPortfolio && typeof onNavigatePortfolio === 'function' ? onNavigatePortfolio() : handleAddToPortfolio(pick)}
                                                                    style={{
                                                                        background: inPortfolio 
                                                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.4))' 
                                                                            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.22))',
                                                                        border: inPortfolio ? '1px solid rgba(16, 185, 129, 0.8)' : '1px solid rgba(16, 185, 129, 0.35)',
                                                                        color: inPortfolio ? '#34d399' : '#10b981',
                                                                        padding: '0.45rem 0.75rem',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 800,
                                                                        fontSize: '0.75rem',
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.35rem',
                                                                        boxShadow: inPortfolio ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                    title={inPortfolio ? t.inBankroll : t.addToBankroll}
                                                                >
                                                                    <span>{inPortfolio ? '✓' : '💼'}</span>
                                                                    <span>{inPortfolio ? t.inBankroll : t.addToBankroll}</span>
                                                                </button>

                                                                {/* Track on Live Radar Button */}
                                                                <button
                                                                    onClick={() => handleTrackOnRadar(pick)}
                                                                    title={t.trackRadar}
                                                                    style={{
                                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                        color: '#e2e8f0',
                                                                        padding: '0.45rem 0.65rem',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.74rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.25rem'
                                                                    }}
                                                                >
                                                                    <span>📡</span>
                                                                    <span>{t.trackRadar}</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* EXPANDABLE SUB-ROW 1: COMBO PICK LEGS BREAKDOWN */}
                                                    {isComboExpanded && pick.comboLegs && pick.comboLegs.length > 0 && (
                                                        <tr style={{ background: 'rgba(10, 16, 30, 0.95)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                                            <td colSpan={8} style={{ padding: '0.85rem 1.25rem' }}>
                                                                <div style={{
                                                                    background: 'rgba(245, 158, 11, 0.05)',
                                                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                                                    borderRadius: '10px',
                                                                    padding: '0.85rem 1rem'
                                                                }}>
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        marginBottom: '0.6rem',
                                                                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                                                        paddingBottom: '0.4rem'
                                                                    }}>
                                                                        <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 900 }}>
                                                                            {t.comboTitle(pick.comboLegs.length)}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                                            {t.comboTotalOdds} <b style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '0.95rem' }}>{oddsDisplay}</b>
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
                                                                        {pick.comboLegs.map((leg, lIdx) => (
                                                                            <div key={lIdx} style={{
                                                                                background: 'rgba(0, 0, 0, 0.35)',
                                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                borderRadius: '8px',
                                                                                padding: '0.55rem 0.8rem',
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center'
                                                                            }}>
                                                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                                                                                    <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>
                                                                                        {lIdx + 1}. {leg.event}
                                                                                    </div>
                                                                                    <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.8rem' }}>
                                                                                        {leg.selection}
                                                                                    </div>
                                                                                </div>
                                                                                <span style={{
                                                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                                                    color: '#10b981',
                                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                                    padding: '2px 7px',
                                                                                    borderRadius: '6px',
                                                                                    fontWeight: 900,
                                                                                    fontFamily: 'monospace',
                                                                                    fontSize: '0.82rem',
                                                                                    flexShrink: 0
                                                                                }}>
                                                                                    @{leg.odds}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {/* EXPANDABLE SUB-ROW 2: ANALYST REASONING NOTE */}
                                                    {isNoteExpanded && pick.analysis && (
                                                        <tr style={{ background: 'rgba(10, 16, 30, 0.95)', borderBottom: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                                            <td colSpan={8} style={{ padding: '0.75rem 1.25rem' }}>
                                                                <div style={{
                                                                    background: 'rgba(56, 189, 248, 0.05)',
                                                                    borderLeft: '3px solid #38bdf8',
                                                                    borderRadius: '0 8px 8px 0',
                                                                    padding: '0.7rem 1rem',
                                                                    color: '#cbd5e1',
                                                                    fontSize: '0.82rem',
                                                                    fontStyle: 'italic',
                                                                    lineHeight: 1.5
                                                                }}>
                                                                    <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.74rem', marginBottom: '4px', textTransform: 'uppercase' }}>
                                                                        💬 {pick.analyst?.name || 'Analist'} {lang === 'tr' ? 'Değerlendirme Notu' : 'Analysis Rationale'}:
                                                                    </div>
                                                                    "{pick.analysis}"
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* SECONDARY VIEW 2: CARD GRID VIEW (Optional toggle)       */}
                    {/* ======================================================== */}
                    {!loading && filteredAndSortedPicks.length > 0 && viewMode === 'CARDS' && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {filteredAndSortedPicks.map((pick) => {
                                const inPortfolio = isAlreadyInPortfolio(pick.id);
                                const isComboExpanded = Boolean(expandedCombos[pick.id]);
                                const oddsDisplay = typeof pick.odds === 'number' ? pick.odds.toFixed(2) : pick.odds;

                                return (
                                    <div
                                        key={pick.id}
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                                            border: pick.isDualConsensus 
                                                ? '1px solid rgba(234, 179, 8, 0.4)' 
                                                : '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '16px',
                                            padding: '1.25rem',
                                            boxShadow: pick.isDualConsensus 
                                                ? '0 8px 30px rgba(234, 179, 8, 0.12)' 
                                                : '0 8px 24px rgba(0,0,0,0.25)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Dual Consensus Glow Header */}
                                        {pick.isDualConsensus && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'linear-gradient(90deg, #eab308, #f59e0b)',
                                                color: '#000',
                                                fontSize: '0.68rem',
                                                fontWeight: 900,
                                                letterSpacing: '0.5px',
                                                padding: '3px 12px',
                                                textAlign: 'center',
                                                textTransform: 'uppercase'
                                            }}>
                                                ⚡ {lang === 'tr' ? 'ÇİFTE ONAY: ALGORİTMA + UZMAN SENTEZİ' : 'DUAL CONSENSUS: AI + ANALYST'}
                                            </div>
                                        )}

                                        <div>
                                            {/* Top Row: Analyst Identity */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginTop: pick.isDualConsensus ? '0.75rem' : 0,
                                                marginBottom: '0.9rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                    <div style={{
                                                        width: '38px',
                                                        height: '38px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.1rem',
                                                        fontWeight: 900,
                                                        color: '#fff',
                                                        border: '2px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        {pick.analyst?.avatarIndex ? ['🎯','🧠','⚡','👑','🔥','🛡️','🔭','⚽'][(pick.analyst.avatarIndex - 1) % 8] : '👑'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>
                                                            {pick.analyst?.name || 'Kıdemli Analist'}
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                                                            {pick.analyst?.badge || '🔥 Formda'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: 'right' }}>
                                                    {pick.isLive ? (
                                                        <span style={{
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }}></span>
                                                            CANLI
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
                                                            🕒 {pick.ageText || 'Az önce'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Match Name & League */}
                                            <div style={{ marginBottom: '0.85rem' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                    {getSportEmoji(pick.sport)} {pick.sportDetails || pick.sport}
                                                </div>
                                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', lineHeight: 1.3 }}>
                                                    {pick.matchName}
                                                </div>
                                            </div>

                                            {/* Selection / Combo Details */}
                                            {pick.isCombo && pick.comboLegs && pick.comboLegs.length > 0 ? (
                                                <div style={{
                                                    background: 'rgba(15, 23, 42, 0.75)',
                                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                                    borderRadius: '12px',
                                                    padding: '0.85rem 1rem',
                                                    marginBottom: '0.9rem'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.35rem' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 900 }}>
                                                            {t.comboTitle(pick.comboLegs.length)}
                                                        </span>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                            {t.comboTotalOdds} <b style={{ color: '#10b981', fontSize: '0.95rem', fontFamily: 'monospace' }}>{oddsDisplay}</b>
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                        {pick.comboLegs.map((leg, lIdx) => (
                                                            <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '6px' }}>
                                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                                                                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{leg.event}: </span>
                                                                    <span style={{ color: '#38bdf8', fontWeight: 800 }}>{leg.selection}</span>
                                                                </div>
                                                                <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.78rem', flexShrink: 0, fontFamily: 'monospace' }}>
                                                                    @{leg.odds}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{
                                                    background: 'rgba(15, 23, 42, 0.65)',
                                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                                    borderRadius: '12px',
                                                    padding: '0.85rem 1rem',
                                                    marginBottom: '0.9rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                                            {t.singlePickTitle}
                                                        </div>
                                                        <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#38bdf8' }}>
                                                            {pick.selection || 'Karşılaşma Analiz Seçimi'}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>
                                                            {t.colOdds}
                                                        </div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                                                            {oddsDisplay}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Stake / Confidence Bar */}
                                            <div style={{ marginBottom: '0.9rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>
                                                    <span>{t.colConfidence}:</span>
                                                    <span style={{ color: pick.stake >= 9 ? '#fbbf24' : '#38bdf8', fontWeight: 900 }}>
                                                        {pick.stake}/10 {pick.stake >= 9 ? '⭐ MAKSİMUM' : ''}
                                                    </span>
                                                </div>
                                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min(100, (pick.stake / 10) * 100)}%`,
                                                        height: '100%',
                                                        background: pick.stake >= 9 ? 'linear-gradient(90deg, #eab308, #fbbf24)' : 'linear-gradient(90deg, #38bdf8, #2563eb)',
                                                        borderRadius: '3px'
                                                    }}></div>
                                                </div>
                                            </div>

                                            {/* Analysis Note if available */}
                                            {pick.analysis && (
                                                <div style={{
                                                    fontSize: '0.74rem',
                                                    color: '#94a3b8',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    borderLeft: '2px solid #38bdf8',
                                                    padding: '0.4rem 0.6rem',
                                                    marginBottom: '0.9rem',
                                                    borderRadius: '0 6px 6px 0',
                                                    fontStyle: 'italic'
                                                }}>
                                                    "{pick.analysis}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => inPortfolio && typeof onNavigatePortfolio === 'function' ? onNavigatePortfolio() : handleAddToPortfolio(pick)}
                                                style={{
                                                    flex: 1,
                                                    background: inPortfolio 
                                                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.4))' 
                                                        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.22))',
                                                    border: inPortfolio ? '1px solid rgba(16, 185, 129, 0.8)' : '1px solid rgba(16, 185, 129, 0.35)',
                                                    color: inPortfolio ? '#34d399' : '#10b981',
                                                    padding: '0.65rem 0.8rem',
                                                    borderRadius: '10px',
                                                    fontWeight: 800,
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.35rem',
                                                    transition: 'all 0.2s',
                                                    boxShadow: inPortfolio ? '0 0 12px rgba(16, 185, 129, 0.3)' : 'none'
                                                }}
                                                title={inPortfolio ? t.inBankroll : t.addToBankroll}
                                            >
                                                <span>{inPortfolio ? '✓' : '💼'}</span>
                                                <span>{inPortfolio ? t.inBankroll : t.addToBankroll}</span>
                                            </button>

                                            <button
                                                onClick={() => handleTrackOnRadar(pick)}
                                                title={t.trackRadar}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    color: '#e2e8f0',
                                                    padding: '0.65rem 0.9rem',
                                                    borderRadius: '10px',
                                                    fontWeight: 700,
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}
                                            >
                                                <span>📡</span>
                                                <span>{t.trackRadar}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: LEADERBOARD VIEW */}
            {activeTab === 'LEADERBOARD' && (
                <div>
                    {/* Top 3 Podium Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1.25rem',
                        marginBottom: '2rem'
                    }}>
                        {(feedData.leaderboard || []).slice(0, 3).map((analyst, idx) => {
                            const colors = [
                                { border: '#eab308', grad: 'rgba(234, 179, 8, 0.15)', crown: '👑 1.' },
                                { border: '#94a3b8', grad: 'rgba(148, 163, 184, 0.12)', crown: '🥈 2.' },
                                { border: '#cd7f32', grad: 'rgba(205, 127, 50, 0.12)', crown: '🥉 3.' }
                            ];
                            const curTheme = colors[idx] || colors[0];

                            return (
                                <div
                                    key={analyst.id}
                                    style={{
                                        background: `linear-gradient(135deg, ${curTheme.grad}, rgba(15, 23, 42, 0.85))`,
                                        border: `1px solid ${curTheme.border}`,
                                        borderRadius: '16px',
                                        padding: '1.5rem',
                                        textAlign: 'center',
                                        position: 'relative',
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '14px',
                                        fontSize: '0.82rem',
                                        fontWeight: 900,
                                        color: curTheme.border
                                    }}>
                                        {curTheme.crown}
                                    </div>

                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                        border: `2px solid ${curTheme.border}`,
                                        margin: '0 auto 0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.6rem'
                                    }}>
                                        {['🎯','🧠','⚡','👑','🔥','🛡️','🔭','⚽'][(analyst.avatarIndex - 1) % 8]}
                                    </div>

                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', margin: '0 0 0.2rem' }}>
                                        {analyst.name}
                                    </h3>
                                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginBottom: '0.9rem' }}>
                                        {analyst.badge}
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-around',
                                        background: 'rgba(0,0,0,0.25)',
                                        padding: '0.75rem',
                                        borderRadius: '10px',
                                        marginBottom: '0.8rem'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{lang === 'tr' ? 'BAŞARI' : 'WIN RATE'}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{analyst.winRate}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>ROI</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8' }}>{analyst.roi}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{lang === 'tr' ? 'TAHMİN' : 'PICKS'}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc' }}>{analyst.totalPicks}</div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        {lang === 'tr' ? 'Uzmanlık: ' : 'Specialty: '}
                                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{analyst.specialty}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Full Leaderboard Table */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>
                                {lang === 'tr' ? 'Genel Performans & Form Sıralaması' : 'Overall Performance & Form Standings'}
                            </h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                {lang === 'tr' 
                                    ? 'Sıralama para miktarına göre değil; doğrulanmış % ROI ve başarı oranı istikrarına göredir.' 
                                    : 'Rankings are based strictly on audited % ROI growth and win-rate stability.'}
                            </p>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '0.85rem 1.25rem' }}>#</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>{lang === 'tr' ? 'ANALİST & RÜTBE' : 'ANALYST'}</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>{lang === 'tr' ? 'UZMANLIK ALANI' : 'SPECIALTY'}</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>ROI</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{lang === 'tr' ? 'BAŞARI ORANI' : 'WIN RATE'}</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{lang === 'tr' ? 'SON 5 MAÇ' : 'FORM'}</th>
                                        <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>{lang === 'tr' ? 'DOĞRULANMIŞ TAHMİN' : 'AUDITED PICKS'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(feedData.leaderboard || []).map((analyst, idx) => (
                                        <tr
                                            key={analyst.id}
                                            style={{
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: 900, color: idx < 3 ? '#fbbf24' : '#64748b' }}>
                                                {idx + 1}
                                            </td>
                                            <td style={{ padding: '1rem 1rem' }}>
                                                <div style={{ fontWeight: 800, color: '#f8fafc' }}>{analyst.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{analyst.badge}</div>
                                            </td>
                                            <td style={{ padding: '1rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {analyst.specialty}
                                            </td>
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center', fontWeight: 900, color: '#38bdf8' }}>
                                                {analyst.roi}
                                            </td>
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center', fontWeight: 900, color: '#10b981' }}>
                                                {analyst.winRate}
                                            </td>
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', gap: '3px' }}>
                                                    {(analyst.recentForm || ['W','W','W','W','W']).map((f, fIdx) => (
                                                        <span
                                                            key={fIdx}
                                                            style={{
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '4px',
                                                                background: f === 'W' ? '#10b981' : '#ef4444',
                                                                color: '#000',
                                                                fontSize: '0.62rem',
                                                                fontWeight: 900,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 800, color: '#e2e8f0' }}>
                                                {analyst.totalPicks}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
