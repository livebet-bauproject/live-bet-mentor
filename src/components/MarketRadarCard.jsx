import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, initBackendDiscovery } from '../config.js';
import defaultMarketRadar from '../data/market_radar_vault.json';

// --- 🌐 Comprehensive 3-Language Dictionary (TR / EN / DE) ---
const I18N = {
    title: {
        tr: 'Surebet & Piyasa Değer Radarı',
        en: 'Surebet & Value Radar',
        de: 'Surebet & Value-Quoten-Radar'
    },
    badge: {
        tr: '4-SPOR QUANT TERMINAL',
        en: '4-SPORT QUANT TERMINAL',
        de: '4-SPORT QUANT TERMINAL'
    },
    subtitle: {
        tr: 'Piyasada oranları çöken, büroların geride kaldığı matematiksel +EV fırsatları',
        en: 'Institutional smart money drops and lagging market value opportunities',
        de: 'Institutionelle Quotenstürze & träge Buchmacherquoten (+EV Value)'
    },
    guideBtn: {
        tr: 'Nasıl Çalışır?',
        en: 'How it Works',
        de: 'Wie es funktioniert'
    },
    refreshBtn: {
        tr: 'Yenile',
        en: 'Refresh',
        de: 'Aktualisieren'
    },
    guideTitle: {
        tr: 'BU BÖLÜM NASIL OKUNUR & KAZANDIRIR?',
        en: 'HOW TO READ & PROFIT FROM THIS RADAR',
        de: 'WIE MAN DIESES RADAR LIEST & GEWINNE ERZIELT'
    },
    guide1_title: {
        tr: '1. Akıllı Para Düşüşü:',
        en: '1. Smart Money Drop:',
        de: '1. Smart-Money Quotensturz:'
    },
    guide1_desc: {
        tr: 'Dünyada bir tercihe yüklü bahis girince oran aniden çöker (%20-%45 sert düşüş).',
        en: 'When heavy institutional money enters, global market odds collapse by 20% to 45%.',
        de: 'Fließt weltweit hohes Kapital in einen Tipp, bricht die globale Quote drastisch ein (20%-45%).'
    },
    guide2_title: {
        tr: '2. Uyuyan Büroyu Yakala:',
        en: '2. Beat Lagging Bookmakers:',
        de: '2. Träge Buchmacher schlagen:'
    },
    guide2_desc: {
        tr: 'Dünyada oran düşmüşken büron henüz indirmediyse, eski yüksek fiyattan hemen tekli oyna.',
        en: 'If global odds have collapsed but your bookmaker is slow to update, bet at the higher stale price.',
        de: 'Ist die Quote global gefallen, dein Buchmacher hat sie aber noch nicht gesenkt, platziere die Wette zum alten Spitzenwert.'
    },
    guide3_title: {
        tr: '3. Sabit Kasa Disiplini:',
        en: '3. Bankroll Discipline:',
        de: '3. Bankroll-Disziplin:'
    },
    guide3_desc: {
        tr: 'Sadece tekli (single) oynanır. Kasanın %2 veya %3\'ünü aşma.',
        en: 'Play strictly as singles. Never exceed 2% to 3% of your bankroll per bet.',
        de: 'Nur als Einzelwette spielen. Niemals mehr als 2% bis 3% des Kapitals riskieren.'
    },
    hideGuide: {
        tr: 'Gizle',
        en: 'Hide',
        de: 'Ausblenden'
    },
    searchPlaceholder: {
        tr: 'Maç veya Lig ara...',
        en: 'Search match or league...',
        de: 'Spiel oder Liga suchen...'
    },
    dropFilterLabel: {
        tr: 'Düşüş:',
        en: 'Drop:',
        de: 'Sturz:'
    },
    dropAll: {
        tr: 'Tüm Düşüşler (%12+)',
        en: 'All Drops (12%+)',
        de: 'Alle Stürze (12%+)'
    },
    dropMega: {
        tr: '🔥 Mega Çöküş (%30+)',
        en: '🔥 Mega Drop (30%+)',
        de: '🔥 Mega-Sturz (30%+)'
    },
    dropHeavy: {
        tr: '⚡ Sert Düşüş (%20+)',
        en: '⚡ Heavy Drop (20%+)',
        de: '⚡ Starker Sturz (20%+)'
    },
    oddsFilterLabel: {
        tr: 'Oran:',
        en: 'Odds:',
        de: 'Quote:'
    },
    oddsAll: {
        tr: 'Tüm Oranlar (1.35 - 2.50)',
        en: 'All Odds (1.35 - 2.50)',
        de: 'Alle Quoten (1.35 - 2.50)'
    },
    oddsLow: {
        tr: '1.35 - 1.80 (Banko / Düşük Risk)',
        en: '1.35 - 1.80 (Safe / Low Risk)',
        de: '1.35 - 1.80 (Sicher / Geringes Risiko)'
    },
    oddsHigh: {
        tr: '1.80 - 2.50 (Yüksek Değer / +EV)',
        en: '1.80 - 2.50 (High Value / +EV)',
        de: '1.80 - 2.50 (Hoher Value / +EV)'
    },
    sortLabel: {
        tr: 'Sırala:',
        en: 'Sort:',
        de: 'Sortieren:'
    },
    sortDrop: {
        tr: '📉 En Yüksek Düşüş',
        en: '📉 Highest Drop %',
        de: '📉 Höchster Sturz %'
    },
    sortConf: {
        tr: '💎 En Yüksek Güven',
        en: '💎 Highest Confidence',
        de: '💎 Höchstes Vertrauen'
    },
    sortTime: {
        tr: '⏰ Maç Saati (En Yakın)',
        en: '⏰ Match Time',
        de: '⏰ Nächste Spielzeit'
    },
    sortOdds: {
        tr: '📊 En Yüksek Oran',
        en: '📊 Highest Odds',
        de: '📊 Höchste Quote'
    },
    viewTerminal: {
        tr: 'Terminal',
        en: 'Terminal',
        de: 'Terminal'
    },
    viewCards: {
        tr: 'Kart',
        en: 'Cards',
        de: 'Karten'
    },
    colSportTime: {
        tr: 'Spor / Saat',
        en: 'Sport / Time',
        de: 'Sport / Zeit'
    },
    colMatchLeague: {
        tr: 'Maç & Lig',
        en: 'Match & League',
        de: 'Spiel & Liga'
    },
    colTip: {
        tr: 'Önerilen Tercih',
        en: 'Value Pick',
        de: 'Tipp-Empfehlung'
    },
    colOdds: {
        tr: 'Piyasa Oranı',
        en: 'Market Odds',
        de: 'Marktquote'
    },
    colDrop: {
        tr: 'Global Düşüş',
        en: 'Global Drop',
        de: 'Quotensturz'
    },
    colConf: {
        tr: 'Güven',
        en: 'Confidence',
        de: 'Vertrauen'
    },
    colAction: {
        tr: 'İşlem',
        en: 'Action',
        de: 'Aktion'
    },
    copyBtn: {
        tr: 'Kopyala',
        en: 'Copy',
        de: 'Kopieren'
    },
    copiedBtn: {
        tr: 'Alındı',
        en: 'Copied',
        de: 'Kopiert'
    },
    dropLabel: {
        tr: 'Düşüş',
        en: 'Drop',
        de: 'Sturz'
    },
    confLabel: {
        tr: 'Güven',
        en: 'Conf',
        de: 'Vertr.'
    },
    noOppTitle: {
        tr: 'Seçili Filtrede Fırsat Bulunmuyor',
        en: 'No opportunities in selected filter',
        de: 'Keine Gelegenheiten im ausgewählten Filter'
    },
    noOppDesc: {
        tr: 'Filtreleri sıfırlayarak diğer sporlardaki ve oran aralıklarındaki fırsatları görebilirsiniz.',
        en: 'Reset filters to view opportunities across all sports and odds ranges.',
        de: 'Filter zurücksetzen, um Gelegenheiten in allen Sportarten anzuzeigen.'
    },
    footerStatus: {
        tr: '7/24 Otonom Surebet & Değer Motoru Aktif',
        en: 'Autonomous 24/7 Engine Active',
        de: 'Autonome 24/7 Value-Engine aktiv'
    },
    footerCount: {
        tr: 'fırsat listeleniyor',
        en: 'opportunities listed',
        de: 'Gelegenheiten gelistet'
    },
    footerScan: {
        tr: 'Son Tarama:',
        en: 'Last Scan:',
        de: 'Letzter Scan:'
    },
    scanningText: {
        tr: '4 Spor dalı için canlı oran hareketleri taranıyor...',
        en: 'Scanning 4-sport dropping odds feeds...',
        de: 'Scanne Quotenbewegungen für 4 Sportarten...'
    }
};

const getI18n = (key, lang = 'tr') => {
    const item = I18N[key];
    if (!item) return key;
    return item[lang] || item['en'] || item['tr'] || '';
};

const getSportLabel = (sportKey, lang = 'tr') => {
    const sportsDict = {
        ALL: { tr: 'Tümü', en: 'All', de: 'Alle' },
        soccer: { tr: 'Futbol', en: 'Football', de: 'Fußball' },
        basketball: { tr: 'Basketbol', en: 'Basketball', de: 'Basketball' },
        tennis: { tr: 'Tenis', en: 'Tennis', de: 'Tennis' },
        handball: { tr: 'Hentbol', en: 'Handball', de: 'Handball' }
    };
    return sportsDict[sportKey]?.[lang] || sportsDict[sportKey]?.['en'] || sportKey;
};

const formatLocalizedTip = (tipRaw, lang = 'tr') => {
    if (!tipRaw) return '';
    if (lang === 'tr') return tipRaw;

    // Pattern: "MS 2 (Sahita S. Kazanır)" or "MS 1 (Ochi M. Kazanır)"
    const match = tipRaw.match(/MS\s*([12X])\s*\((.*?)\s*Kazanır\)/i);
    if (match) {
        const side = match[1];
        const team = match[2];
        if (lang === 'de') {
            return side === '1' ? `Heimsieg (${team})` : (side === '2' ? `Auswärtssieg (${team})` : `Unentschieden`);
        }
        return side === '1' ? `Home Win (${team})` : (side === '2' ? `Away Win (${team})` : `Draw (X)`);
    }

    if (lang === 'de') {
        return tipRaw.replace(/Kazanır/g, 'gewinnt').replace(/Beraberlik/g, 'Unentschieden');
    }
    return tipRaw.replace(/Kazanır/g, 'to Win').replace(/Beraberlik/g, 'Draw');
};

const formatLocalizedAdvantage = (dropPct, lang = 'tr') => {
    const num = Math.round(Number(dropPct) || 0);
    if (lang === 'tr') return `%${num} Global Oran Düşüşü (Değerli Fiyat)`;
    if (lang === 'de') return `%${num} Globaler Quotensturz (Value-Quote)`;
    return `%${num} Global Market Drop (+EV Edge)`;
};

export const MarketRadarCard = ({ lang = 'tr', onClose }) => {
    const activeLang = (lang === 'tr' || lang === 'de' || lang === 'en') ? lang : 'tr';
    const txt = (key) => getI18n(key, activeLang);

    const [data, setData] = useState(defaultMarketRadar || null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSport, setSelectedSport] = useState('ALL'); // 'ALL' | 'soccer' | 'basketball' | 'tennis' | 'handball'
    const [minDrop, setMinDrop] = useState('ALL'); // 'ALL' | '30' | '20'
    const [oddsRange, setOddsRange] = useState('ALL'); // 'ALL' | 'LOW' | 'HIGH'
    const [sortBy, setSortBy] = useState('DROP_DESC'); // 'DROP_DESC' | 'CONF_DESC' | 'TIME_ASC' | 'ODDS_DESC'
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('TERMINAL'); // 'TERMINAL' | 'GRID'
    const [showGuide, setShowGuide] = useState(true);
    const [copiedId, setCopiedId] = useState(null);

    const fetchRadar = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const proxyBase = await initBackendDiscovery() || getApiBaseUrl();
            let loaded = false;

            // 1. Try Live Server Proxy first
            if (proxyBase) {
                try {
                    const url = `${proxyBase}/api/market-radar${forceRefresh ? '?t=' + Date.now() : ''}`;
                    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                    if (res.ok) {
                        const contentType = res.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            const json = await res.json();
                            if (json && Array.isArray(json.opportunities) && json.opportunities.length > 0) {
                                setData(json);
                                loaded = true;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[MARKET_RADAR] Proxy fetch skipped, attempting fallback:', e.message);
                }
            }

            // 2. If proxy didn't deliver, fallback to static Vercel CDN asset
            if (!loaded) {
                try {
                    const staticUrl = `/market_radar_vault.json?t=${Date.now()}`;
                    const res = await fetch(staticUrl);
                    if (res.ok) {
                        const json = await res.json();
                        if (json && Array.isArray(json.opportunities) && json.opportunities.length > 0) {
                            setData(json);
                            loaded = true;
                        }
                    }
                } catch (e) {
                    console.warn('[MARKET_RADAR] Static fallback failed:', e.message);
                }
            }
        } catch (err) {
            console.error('[MARKET_RADAR] General fetch error:', err);
        } finally {
            setLoading(false);
            if (forceRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRadar();
        const interval = setInterval(() => {
            fetchRadar();
        }, 60000); // 1 min auto-refresh
        return () => clearInterval(interval);
    }, []);

    const opportunities = data?.opportunities || [];

    // Filter by sport, drop %, odds range, and search
    const filtered = opportunities.filter((item) => {
        if (selectedSport !== 'ALL' && item.sport !== selectedSport) return false;
        if (minDrop === '30' && (item.drop_pct || 0) < 30) return false;
        if (minDrop === '20' && (item.drop_pct || 0) < 20) return false;
        if (oddsRange === 'LOW' && ((item.odds || 0) < 1.35 || (item.odds || 0) > 1.80)) return false;
        if (oddsRange === 'HIGH' && ((item.odds || 0) < 1.80 || (item.odds || 0) > 2.50)) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchText = `${item.home} ${item.away} ${item.league} ${item.sport_name} ${item.tip}`.toLowerCase();
            if (!matchText.includes(q)) return false;
        }
        return true;
    });

    // Sort opportunities
    filtered.sort((a, b) => {
        if (sortBy === 'DROP_DESC') return (b.drop_pct || 0) - (a.drop_pct || 0);
        if (sortBy === 'CONF_DESC') return (b.confidence || 0) - (a.confidence || 0);
        if (sortBy === 'ODDS_DESC') return (b.odds || 0) - (a.odds || 0);
        if (sortBy === 'TIME_ASC') return (a.time || '').localeCompare(b.time || '');
        return 0;
    });

    const handleCopy = (item) => {
        const localizedTip = formatLocalizedTip(item.tip, activeLang);
        const localizedAdv = formatLocalizedAdvantage(item.drop_pct, activeLang);
        const headerTitle = activeLang === 'tr' ? 'LiveBet Surebet & Değer Radarı' : (activeLang === 'de' ? 'LiveBet Surebet & Value-Radar' : 'LiveBet Surebet & Value Radar');
        const tipPrefix = activeLang === 'tr' ? 'Tercih' : (activeLang === 'de' ? 'Tipp' : 'Pick');
        const edgePrefix = activeLang === 'tr' ? 'Avantaj' : (activeLang === 'de' ? 'Vorteil' : 'Edge');
        const confPrefix = activeLang === 'tr' ? 'Güven' : (activeLang === 'de' ? 'Vertrauen' : 'Confidence');

        const text = `🎯 ${headerTitle}\n🏆 ${item.league}\n⏰ ${item.time} | ${item.home} vs ${item.away}\n👉 ${tipPrefix}: ${localizedTip} (${Number(item.odds).toFixed(2)})\n💎 ${edgePrefix}: ${localizedAdv}\n⚡ ${confPrefix}: %${item.confidence}`;
        navigator.clipboard?.writeText(text);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div style={{
            background: 'linear-gradient(180deg, #090e18 0%, #060911 100%)',
            border: '1px solid rgba(6, 182, 212, 0.45)',
            borderRadius: '20px',
            boxShadow: '0 0 70px rgba(6, 182, 212, 0.25), 0 25px 50px -12px rgba(0, 0, 0, 0.95)',
            color: '#f8fafc',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '1140px',
            maxHeight: '90vh'
        }}>
            {/* Header */}
            <div style={{
                padding: '1.1rem 1.4rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.18) 0%, rgba(14, 165, 233, 0.06) 60%, transparent 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.8rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(6, 182, 212, 0.2)',
                        border: '1px solid rgba(6, 182, 212, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem'
                    }}>
                        💎
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
                                {txt('title')}
                            </h2>
                            <span style={{
                                padding: '2px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 900,
                                borderRadius: '999px',
                                background: '#06b6d4',
                                color: '#000',
                                letterSpacing: '0.5px'
                            }}>
                                {txt('badge')}
                            </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                            {txt('subtitle')}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={() => setShowGuide(!showGuide)}
                        style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '10px',
                            background: showGuide ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                            border: showGuide ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.12)',
                            color: showGuide ? '#06b6d4' : '#cbd5e1',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                        }}
                    >
                        <span>💡</span>
                        <span>{txt('guideBtn')}</span>
                    </button>

                    <button
                        onClick={() => fetchRadar(true)}
                        disabled={refreshing}
                        style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: refreshing ? '#06b6d4' : '#cbd5e1',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
                        <span>{txt('refreshBtn')}</span>
                    </button>

                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#94a3b8',
                                fontSize: '1rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* 💡 3-Dilde Kolay Anlaşılır Rehber Banner */}
            {showGuide && (
                <div style={{
                    background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    borderRadius: '12px',
                    padding: '0.8rem 1.1rem',
                    margin: '0.75rem 1.25rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 900, color: '#38bdf8' }}>
                            <span>🎯</span>
                            <span>{txt('guideTitle')}</span>
                        </div>
                        <button
                            onClick={() => setShowGuide(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: 700
                            }}
                        >
                            ✕ {txt('hideGuide')}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '0.65rem',
                        fontSize: '0.76rem',
                        color: '#cbd5e1',
                        lineHeight: '1.4'
                    }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 10px', borderRadius: '8px', borderLeft: '3px solid #06b6d4' }}>
                            <strong style={{ color: '#06b6d4' }}>{txt('guide1_title')}</strong> {txt('guide1_desc')}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 10px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                            <strong style={{ color: '#10b981' }}>{txt('guide2_title')}</strong> {txt('guide2_desc')}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 10px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                            <strong style={{ color: '#f59e0b' }}>{txt('guide3_title')}</strong> {txt('guide3_desc')}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Bar: Sports Tabs + Dropdown Filters + View Mode */}
            <div style={{
                padding: '0.75rem 1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
            }}>
                {/* Row 1: Sport Tabs + Search */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.6rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
                        {[
                            { key: 'ALL', icon: '🌐' },
                            { key: 'soccer', icon: '⚽' },
                            { key: 'basketball', icon: '🏀' },
                            { key: 'tennis', icon: '🎾' },
                            { key: 'handball', icon: '🤾' },
                        ].map((tab) => {
                            const count = tab.key === 'ALL' 
                                ? opportunities.length 
                                : opportunities.filter(o => o.sport === tab.key).length;
                            const isActive = selectedSport === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setSelectedSport(tab.key)}
                                    style={{
                                        padding: '0.4rem 0.75rem',
                                        borderRadius: '8px',
                                        border: isActive ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(8, 145, 178, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                                        color: isActive ? '#06b6d4' : '#94a3b8',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{getSportLabel(tab.key, activeLang)}</span>
                                    <span style={{
                                        padding: '1px 5px',
                                        borderRadius: '999px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        background: isActive ? '#06b6d4' : 'rgba(255,255,255,0.08)',
                                        color: isActive ? '#000' : '#cbd5e1'
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ position: 'relative', width: '210px' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={txt('searchPlaceholder')}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '0.4rem 1.6rem 0.4rem 0.7rem',
                                borderRadius: '8px',
                                background: 'rgba(0, 0, 0, 0.55)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                fontSize: '0.78rem',
                                outline: 'none'
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
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 2: Quant Filter Dropdowns + View Switcher */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                    fontSize: '0.75rem',
                    paddingTop: '2px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Düşüş Filtresi */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{txt('dropFilterLabel')}</span>
                            <select
                                value={minDrop}
                                onChange={(e) => setMinDrop(e.target.value)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    color: minDrop !== 'ALL' ? '#34d399' : '#cbd5e1',
                                    border: minDrop !== 'ALL' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">{txt('dropAll')}</option>
                                <option value="30">{txt('dropMega')}</option>
                                <option value="20">{txt('dropHeavy')}</option>
                            </select>
                        </div>

                        {/* Oran Aralığı */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{txt('oddsFilterLabel')}</span>
                            <select
                                value={oddsRange}
                                onChange={(e) => setOddsRange(e.target.value)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    color: oddsRange !== 'ALL' ? '#06b6d4' : '#cbd5e1',
                                    border: oddsRange !== 'ALL' ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">{txt('oddsAll')}</option>
                                <option value="LOW">{txt('oddsLow')}</option>
                                <option value="HIGH">{txt('oddsHigh')}</option>
                            </select>
                        </div>

                        {/* Sıralama */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{txt('sortLabel')}</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="DROP_DESC">{txt('sortDrop')}</option>
                                <option value="CONF_DESC">{txt('sortConf')}</option>
                                <option value="TIME_ASC">{txt('sortTime')}</option>
                                <option value="ODDS_DESC">{txt('sortOdds')}</option>
                            </select>
                        </div>
                    </div>

                    {/* View Switcher: Terminal Tablo vs Kart */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '2px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <button
                            onClick={() => setViewMode('TERMINAL')}
                            style={{
                                padding: '3px 9px',
                                borderRadius: '6px',
                                border: 'none',
                                background: viewMode === 'TERMINAL' ? '#06b6d4' : 'transparent',
                                color: viewMode === 'TERMINAL' ? '#000' : '#94a3b8',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                            }}
                        >
                            <span>📟</span>
                            <span>{txt('viewTerminal')}</span>
                        </button>
                        <button
                            onClick={() => setViewMode('GRID')}
                            style={{
                                padding: '3px 9px',
                                borderRadius: '6px',
                                border: 'none',
                                background: viewMode === 'GRID' ? '#06b6d4' : 'transparent',
                                color: viewMode === 'GRID' ? '#000' : '#94a3b8',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                            }}
                        >
                            <span>🎴</span>
                            <span>{txt('viewCards')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.8rem 1.25rem',
                minHeight: '280px'
            }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🔄</div>
                        <div style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
                            {txt('scanningText')}
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>💎</div>
                        <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: '#e2e8f0' }}>
                            {txt('noOppTitle')}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                            {txt('noOppDesc')}
                        </p>
                    </div>
                ) : viewMode === 'TERMINAL' ? (
                    /* 📟 QUANT TERMINAL TABLO GÖRÜNÜMÜ */
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: '0 4px',
                            fontSize: '0.8rem'
                        }}>
                            <thead>
                                <tr style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>{txt('colSportTime')}</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>{txt('colMatchLeague')}</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>{txt('colTip')}</th>
                                    <th style={{ textAlign: 'center', padding: '6px 12px' }}>{txt('colOdds')}</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>{txt('colDrop')}</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>{txt('colConf')}</th>
                                    <th style={{ textAlign: 'right', padding: '6px 12px' }}>{txt('colAction')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => {
                                    const isCopied = copiedId === item.id;
                                    const dropNum = item.drop_pct || 0;
                                    const isMegaDrop = dropNum >= 35;
                                    const localizedTip = formatLocalizedTip(item.tip, activeLang);
                                    const sportLabel = getSportLabel(item.sport, activeLang);

                                    return (
                                        <tr
                                            key={item.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                borderRadius: '8px',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)';
                                            }}
                                        >
                                            {/* Spor & Saat */}
                                            <td style={{ padding: '8px 12px', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>{sportLabel}</span>
                                                        <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 800 }}>⏰ {item.time}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Maç & Lig */}
                                            <td style={{ padding: '8px 12px', maxWidth: '280px' }}>
                                                <div style={{ fontWeight: 800, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.home} <span style={{ color: '#64748b', fontWeight: 500 }}>vs</span> {item.away}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.league}
                                                </div>
                                            </td>

                                            {/* Önerilen Tercih */}
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(6, 182, 212, 0.15)',
                                                    border: '1px solid rgba(6, 182, 212, 0.35)',
                                                    color: '#38bdf8',
                                                    fontWeight: 800,
                                                    fontSize: '0.76rem',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    👉 {localizedTip}
                                                </span>
                                            </td>

                                            {/* Piyasa Oranı */}
                                            <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    fontSize: '0.92rem',
                                                    fontWeight: 900,
                                                    fontFamily: 'monospace',
                                                    color: '#fff',
                                                    background: 'rgba(255, 255, 255, 0.08)',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {Number(item.odds).toFixed(2)}
                                                </span>
                                            </td>

                                            {/* Global Düşüş */}
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        padding: '3px 7px',
                                                        borderRadius: '6px',
                                                        background: isMegaDrop ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.18)',
                                                        border: isMegaDrop ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                                                        color: isMegaDrop ? '#fca5a5' : '#34d399',
                                                        fontWeight: 800,
                                                        fontSize: '0.76rem'
                                                    }}>
                                                        📉 %{dropNum} {txt('dropLabel')}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Güven */}
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '48px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${item.confidence || 80}%`,
                                                            height: '100%',
                                                            background: (item.confidence || 80) >= 90 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : '#06b6d4'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>
                                                        %{item.confidence}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Kopyala / İşlem */}
                                            <td style={{ padding: '8px 12px', borderTopRightRadius: '8px', borderBottomRightRadius: '8px', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleCopy(item)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        background: isCopied ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                                                        border: isCopied ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                                                        color: isCopied ? '#000' : '#cbd5e1',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {isCopied ? '✓' : '📋'} {isCopied ? txt('copiedBtn') : txt('copyBtn')}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* 🎴 KART GÖRÜNÜMÜ */
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                        gap: '0.85rem'
                    }}>
                        {filtered.map((item) => {
                            const isCopied = copiedId === item.id;
                            const dropNum = item.drop_pct || 0;
                            const isMegaDrop = dropNum >= 35;
                            const localizedTip = formatLocalizedTip(item.tip, activeLang);
                            const localizedAdv = formatLocalizedAdvantage(item.drop_pct, activeLang);

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.7)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '14px',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.15s',
                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', maxWidth: '75%', overflow: 'hidden' }}>
                                                <span>{item.icon}</span>
                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.league}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.7rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                ⏰ {item.time}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.7rem' }}>
                                            {item.home} <span style={{ color: '#64748b', fontSize: '0.85rem' }}>vs</span> {item.away}
                                        </div>

                                        <div style={{
                                            background: 'rgba(0, 0, 0, 0.35)',
                                            border: '1px solid rgba(6, 182, 212, 0.25)',
                                            borderRadius: '8px',
                                            padding: '0.6rem 0.8rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.7rem'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                                    {txt('colTip')}
                                                </div>
                                                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38bdf8' }}>
                                                    {localizedTip}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                                    {txt('colOdds')}
                                                </div>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff' }}>
                                                    {Number(item.odds).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            background: isMegaDrop ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                            border: isMegaDrop ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                            borderRadius: '6px',
                                            padding: '0.45rem 0.7rem',
                                            fontSize: '0.74rem',
                                            color: isMegaDrop ? '#fca5a5' : '#34d399',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            marginBottom: '0.7rem'
                                        }}>
                                            <span>📉</span>
                                            <span>{localizedAdv}</span>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                        paddingTop: '0.6rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <div style={{ width: '50px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${item.confidence || 80}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg, #10b981, #06b6d4)'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>
                                                %{item.confidence} {txt('confLabel')}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleCopy(item)}
                                            style={{
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '6px',
                                                background: isCopied ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                                                border: isCopied ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                                                color: isCopied ? '#000' : '#cbd5e1',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {isCopied ? '✓' : '📋'} {isCopied ? txt('copiedBtn') : txt('copyBtn')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Status Bar */}
            <div style={{
                padding: '0.65rem 1.25rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#64748b'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{txt('footerStatus')}</span>
                    <span style={{ color: '#475569' }}>•</span>
                    <span>{filtered.length} {txt('footerCount')}</span>
                </div>
                {data?.last_updated && (
                    <span>{txt('footerScan')} {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
            </div>
        </div>
    );
};
