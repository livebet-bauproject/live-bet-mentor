import React, { useState, useEffect } from 'react';

export const SharpPicksCard = ({ lang = 'tr', t = {}, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('today'); // 'today' | 'yesterday'
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'WON' | 'PENDING' | 'LIVE' | 'LOST'
    const [sortBy, setSortBy] = useState('CONF_DESC'); // 'CONF_DESC' | 'CONF_ASC' | 'TIME_ASC' | 'TIME_DESC' | 'ODDS_DESC' | 'ODDS_ASC'
    const [confFilter, setConfFilter] = useState('ALL'); // 'ALL' | '90' | '85' | '80' | '75' | 'UNDER_75'
    const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | 'DC' | 'MS' | 'GOALS' | 'HT'
    const [oddsFilter, setOddsFilter] = useState('ALL'); // 'ALL' | 'SAFE' | 'MEDIUM' | 'HIGH'
    const [rolloverOnly, setRolloverOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchPicks = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const proxyBase = import.meta.env?.VITE_API_BASE_URL || (isLocal ? 'http://localhost:3001' : 'https://live-bet-mentor.onrender.com');
            const url = `${proxyBase}/api/sharp-picks${forceRefresh ? '?refresh=1&t=' + Date.now() : ''}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                if (json && (json.today_picks || json.yesterday_summary)) {
                    setData(json);
                }
            }
        } catch (err) {
            console.error('[SHARP_PICKS] Fetch error:', err);
        } finally {
            setLoading(false);
            if (forceRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchPicks();
        const interval = setInterval(() => {
            if (isMounted) fetchPicks();
        }, 60000); // 1 min auto-refresh
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const formatTip = (tipRaw) => {
        const raw = (tipRaw || '').toUpperCase().trim();
        if (lang === 'tr') {
            if (raw === '1X') return '1X (Ev Sahibi Yenilmez)';
            if (raw === 'X2') return 'X2 (Deplasman Yenilmez)';
            if (raw === '12') return '12 (Çifte Şans: 1 veya 2)';
            if (raw === '1') return 'MS 1 (Ev Sahibi Kazanır)';
            if (raw === '2') return 'MS 2 (Deplasman Kazanır)';
            if (raw === 'X') return 'MS X (Beraberlik)';
            if (raw === 'HT 1') return 'İlk Yarı 1 (Ev Sahibi)';
            if (raw === 'HT 2') return 'İlk Yarı 2 (Deplasman)';
            if (raw === 'OVER 1.5') return '1.5 Gol Üstü';
            if (raw === 'OVER 2.5') return '2.5 Gol Üstü';
            if (raw === 'UNDER 2.5') return '2.5 Gol Altı';
            if (raw === 'GG') return 'KG Var (Her İki Takım Gol Atar)';
            if (raw === 'NG') return 'KG Yok';
        } else if (lang === 'de') {
            if (raw === '1X') return '1X (Doppelte Chance: Heim/Remis)';
            if (raw === 'X2') return 'X2 (Doppelte Chance: Remis/Auswärts)';
            if (raw === '12') return '12 (Doppelte Chance: 1 oder 2)';
            if (raw === '1') return 'Heimsieg (1)';
            if (raw === '2') return 'Auswärtssieg (2)';
            if (raw === 'X') return 'Unentschieden (X)';
            if (raw === 'HT 1') return 'Halbzeit 1 (Heim)';
            if (raw === 'HT 2') return 'Halbzeit 2 (Auswärts)';
            if (raw === 'OVER 1.5') return 'Über 1.5 Tore';
            if (raw === 'OVER 2.5') return 'Über 2.5 Tore';
            if (raw === 'UNDER 2.5') return 'Unter 2.5 Tore';
            if (raw === 'GG') return 'Beide Teams treffen (Ja)';
            if (raw === 'NG') return 'Beide Teams treffen (Nein)';
        } else {
            if (raw === '1X') return '1X (Double Chance: Home/Draw)';
            if (raw === 'X2') return 'X2 (Double Chance: Draw/Away)';
            if (raw === '12') return '12 (Double Chance: 1 or 2)';
            if (raw === '1') return 'Home Win (1)';
            if (raw === '2') return 'Away Win (2)';
            if (raw === 'X') return 'Draw (X)';
            if (raw === 'HT 1') return 'Half-Time 1 (Home)';
            if (raw === 'HT 2') return 'Half-Time 2 (Away)';
            if (raw === 'OVER 1.5') return 'Over 1.5 Goals';
            if (raw === 'OVER 2.5') return 'Over 2.5 Goals';
            if (raw === 'UNDER 2.5') return 'Under 2.5 Goals';
            if (raw === 'GG') return 'Both Teams To Score (BTTS)';
            if (raw === 'NG') return 'Both Teams To Score (No)';
        }
        return raw;
    };

    const getMatchStatusCode = (match) => {
        if (match.status === 'WON') return 'WON';
        if (match.status === 'LOST') return 'LOST';
        if (match.time && String(match.time).includes(':')) {
            const now = new Date();
            const parts = String(match.time).split(':');
            if (parts.length === 2) {
                const matchH = parseInt(parts[0], 10) || 0;
                const matchM = parseInt(parts[1], 10) || 0;
                const nowTotalMin = now.getHours() * 60 + now.getMinutes();
                const matchTotalMin = matchH * 60 + matchM;
                const diffMin = nowTotalMin - matchTotalMin;
                if (diffMin >= 115) return 'RESULT_PENDING';
                if (diffMin >= 0 && diffMin < 115) return 'LIVE';
                return 'UPCOMING';
            }
        }
        return 'UPCOMING';
    };

    const getTipCategory = (tipRaw) => {
        const raw = (tipRaw || '').toUpperCase().trim();
        if (['1X', 'X2', '12'].includes(raw)) return 'DC';
        if (['1', '2', 'X'].includes(raw)) return 'MS';
        if (raw.includes('OVER') || raw.includes('UNDER') || raw === 'GG' || raw === 'NG') return 'GOALS';
        if (raw.startsWith('HT') || raw.startsWith('İY')) return 'HT';
        return 'OTHER';
    };

    const formatStatus = (status, matchTime) => {
        if (status === 'WON') {
            return {
                label: lang === 'tr' ? 'KAZANDI' : (lang === 'de' ? 'GEWONNEN' : 'WON'),
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.15)',
                border: 'rgba(16, 185, 129, 0.4)',
                icon: '🟢'
            };
        }
        if (status === 'LOST') {
            return {
                label: lang === 'tr' ? 'KAYBETTİ' : (lang === 'de' ? 'VERLOREN' : 'LOST'),
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.15)',
                border: 'rgba(239, 68, 68, 0.4)',
                icon: '🔴'
            };
        }

        // If kick-off time is present, determine if match is upcoming, live in-play, or awaiting final result
        if (matchTime && String(matchTime).includes(':')) {
            const now = new Date();
            const parts = String(matchTime).split(':');
            if (parts.length === 2) {
                const matchH = parseInt(parts[0], 10) || 0;
                const matchM = parseInt(parts[1], 10) || 0;
                const nowTotalMin = now.getHours() * 60 + now.getMinutes();
                const matchTotalMin = matchH * 60 + matchM;
                const diffMin = nowTotalMin - matchTotalMin;

                // Match started more than 115 minutes ago -> finished, awaiting official confirmation
                if (diffMin >= 115) {
                    return {
                        label: lang === 'tr' ? 'SONUÇ BEKLENİYOR' : (lang === 'de' ? 'ERGEBNIS AUSSTEHEND' : 'RESULT PENDING'),
                        color: '#f59e0b',
                        bg: 'rgba(245, 158, 11, 0.15)',
                        border: 'rgba(245, 158, 11, 0.4)',
                        icon: '⌛'
                    };
                }

                // Match is currently live (started 0 to 114 minutes ago)
                if (diffMin >= 0 && diffMin < 115) {
                    return {
                        label: lang === 'tr' ? 'CANLI / OYNANIYOR' : (lang === 'de' ? 'LIVE IM SPIEL' : 'LIVE IN-PLAY'),
                        color: '#38bdf8',
                        bg: 'rgba(56, 189, 248, 0.15)',
                        border: 'rgba(56, 189, 248, 0.4)',
                        icon: '⚡'
                    };
                }
            }
        }

        return {
            label: lang === 'tr' ? 'BAŞLAMADI' : (lang === 'de' ? 'AUSSTEHEND' : 'UPCOMING'),
            color: '#94a3b8',
            bg: 'rgba(148, 163, 184, 0.1)',
            border: 'rgba(148, 163, 184, 0.25)',
            icon: '⏳'
        };
    };

    const parseTimeMinutes = (timeStr) => {
        if (!timeStr) return 9999;
        const parts = String(timeStr).split(':');
        if (parts.length === 2) {
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            return h * 60 + m;
        }
        return 9999;
    };

    const todayPicks = data?.today_picks || [];
    const yesterdaySummary = data?.yesterday_summary || {};
    const yesterdayPicks = yesterdaySummary?.picks || [];

    const activeList = activeTab === 'today' ? todayPicks : yesterdayPicks;

    const wonCount = activeList.filter(m => m.status === 'WON').length;
    const lostCount = activeList.filter(m => m.status === 'LOST').length;
    const liveCount = activeList.filter(m => getMatchStatusCode(m) === 'LIVE').length;
    const pendingCount = activeList.filter(m => {
        const code = getMatchStatusCode(m);
        return code === 'UPCOMING' || code === 'RESULT_PENDING' || m.status === 'PENDING';
    }).length;

    const filteredList = activeList.filter(item => {
        // Status Filter
        if (filterStatus === 'WON' && item.status !== 'WON') return false;
        if (filterStatus === 'LOST' && item.status !== 'LOST') return false;
        if (filterStatus === 'LIVE' && getMatchStatusCode(item) !== 'LIVE') return false;
        if (filterStatus === 'PENDING') {
            const code = getMatchStatusCode(item);
            if (code !== 'UPCOMING' && code !== 'RESULT_PENDING' && item.status !== 'PENDING') return false;
        }

        // Model Confidence Filter
        const conf = item.confidence || 0;
        if (confFilter === '90' && conf < 90) return false;
        if (confFilter === '85' && conf < 85) return false;
        if (confFilter === '80' && conf < 80) return false;
        if (confFilter === '75' && conf < 75) return false;
        if (confFilter === 'UNDER_75' && conf >= 75) return false;

        // Market / Tip Filter
        if (marketFilter !== 'ALL') {
            if (getTipCategory(item.tip) !== marketFilter) return false;
        }

        // Odds Filter
        const odds = item.odds || 0;
        if (oddsFilter === 'SAFE' && (odds < 1.10 || odds > 1.35)) return false;
        if (oddsFilter === 'MEDIUM' && (odds <= 1.35 || odds > 1.50)) return false;
        if (oddsFilter === 'HIGH' && odds <= 1.50) return false;

        // Rollover / Bankroll Safe Only
        if (rolloverOnly) {
            const isSafe = item.tier === 'Ultra-Safe' || item.is_top || conf >= 80;
            if (!isSafe) return false;
        }

        // Search Query (Home, Away, League, Tip)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const home = (item.home || '').toLowerCase();
            const away = (item.away || '').toLowerCase();
            const league = (item.league || '').toLowerCase();
            const tip = (item.tip || '').toLowerCase();
            const tipStr = formatTip(item.tip).toLowerCase();
            if (!home.includes(q) && !away.includes(q) && !league.includes(q) && !tip.includes(q) && !tipStr.includes(q)) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => {
        if (sortBy === 'CONF_DESC') {
            const diff = (b.confidence || 0) - (a.confidence || 0);
            if (diff !== 0) return diff;
            return parseTimeMinutes(a.time) - parseTimeMinutes(b.time);
        }
        if (sortBy === 'CONF_ASC') {
            const diff = (a.confidence || 0) - (b.confidence || 0);
            if (diff !== 0) return diff;
            return parseTimeMinutes(a.time) - parseTimeMinutes(b.time);
        }
        if (sortBy === 'TIME_ASC') {
            const diff = parseTimeMinutes(a.time) - parseTimeMinutes(b.time);
            if (diff !== 0) return diff;
            return (b.confidence || 0) - (a.confidence || 0);
        }
        if (sortBy === 'TIME_DESC') {
            const diff = parseTimeMinutes(b.time) - parseTimeMinutes(a.time);
            if (diff !== 0) return diff;
            return (b.confidence || 0) - (a.confidence || 0);
        }
        if (sortBy === 'ODDS_DESC') {
            const diff = (b.odds || 0) - (a.odds || 0);
            if (diff !== 0) return diff;
            return (b.confidence || 0) - (a.confidence || 0);
        }
        if (sortBy === 'ODDS_ASC') {
            const diff = (a.odds || 0) - (b.odds || 0);
            if (diff !== 0) return diff;
            return (b.confidence || 0) - (a.confidence || 0);
        }
        return 0;
    });

    const isAnyFilterActive =
        Boolean(searchQuery.trim()) ||
        confFilter !== 'ALL' ||
        marketFilter !== 'ALL' ||
        oddsFilter !== 'ALL' ||
        filterStatus !== 'ALL' ||
        rolloverOnly ||
        sortBy !== 'CONF_DESC';

    const resetAllFilters = () => {
        setSearchQuery('');
        setSortBy('CONF_DESC');
        setConfFilter('ALL');
        setMarketFilter('ALL');
        setOddsFilter('ALL');
        setFilterStatus('ALL');
        setRolloverOnly(false);
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '20px',
            color: '#f8fafc',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.1)',
            backdropFilter: 'blur(16px)',
            maxWidth: '920px',
            margin: '0 auto',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                            color: '#0f172a',
                            padding: '3px 8px',
                            borderRadius: '6px'
                        }}>
                            {t.sharp_model_tag || 'Mentor Alpha Quant'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {data?.last_updated ? new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        <button
                            onClick={() => fetchPicks(true)}
                            disabled={refreshing}
                            style={{
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                borderRadius: '6px',
                                color: '#38bdf8',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                opacity: refreshing ? 0.7 : 1
                            }}
                            title={lang === 'tr' ? 'Tahminleri Canlı Yenile' : 'Refresh Picks Live'}
                        >
                            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s' }}>🔄</span>
                            <span>{refreshing ? (lang === 'tr' ? 'Yenileniyor...' : 'Refreshing...') : (lang === 'tr' ? 'Yenile' : 'Refresh')}</span>
                        </button>
                    </div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>
                        {t.sharp_picks_title || 'Günün Keskin Seçimleri'}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                        {t.sharp_picks_subtitle || 'Kasa katlamaya uygun, riski en düşük sağlam maç tercihleri.'}
                    </p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#94a3b8',
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            transition: 'all 0.15s'
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Yesterday Verified Trophy Banner */}
            {yesterdaySummary?.total > 0 && (
                <div style={{
                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🏆</span>
                        <div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', textTransform: 'uppercase' }}>
                                {t.sharp_picks_yesterday_success || 'Dünkü Başarı:'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff', marginLeft: '6px' }}>
                                {yesterdaySummary.total} {lang === 'tr' ? 'Maçın' : 'Picks,'} <span style={{ color: '#10b981' }}>{yesterdaySummary.won} {t.sharp_picks_matches_won || "Tuttu"}</span>
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <span style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700'
                        }}>
                            %{yesterdaySummary.win_rate} {t.sharp_picks_win_rate || "Başarı"}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {t.sharp_picks_avg_odds || "Ort. Oran"}: <strong style={{ color: '#f8fafc' }}>{yesterdaySummary.avg_odds}</strong>
                        </span>
                    </div>
                </div>
            )}

            {/* Sub-Tabs (Today vs Yesterday) & Sort Selector */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '14px'
            }}>
                {/* Mode Tabs */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setActiveTab('today')}
                        style={{
                            background: activeTab === 'today' ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === 'today' ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '7px 14px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        {t.sharp_picks_tab_today || "Günün Seçimleri"} ({todayPicks.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('yesterday')}
                        style={{
                            background: activeTab === 'yesterday' ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === 'yesterday' ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '7px 14px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        {t.sharp_picks_tab_yesterday || "Dünün Sonuçları"} ({yesterdayPicks.length})
                    </button>
                </div>

                {/* Primary Sort Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                        📊 {t.sharp_sort_by || 'Sıralama'}:
                    </span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#38bdf8',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                        }}
                    >
                        <option value="CONF_DESC" style={{ background: '#0f172a', color: '#38bdf8' }}>
                            {t.sharp_sort_conf_desc || "🎯 Model Güveni (En Yüksek)"}
                        </option>
                        <option value="CONF_ASC" style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {t.sharp_sort_conf_asc || "📉 Model Güveni (En Düşük)"}
                        </option>
                        <option value="TIME_ASC" style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {t.sharp_sort_time_asc || "⏰ Başlama Saati (En Erken)"}
                        </option>
                        <option value="TIME_DESC" style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {t.sharp_sort_time_desc || "⏰ Başlama Saati (En Geç)"}
                        </option>
                        <option value="ODDS_DESC" style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {t.sharp_sort_odds_desc || "💰 Oran (En Yüksek)"}
                        </option>
                        <option value="ODDS_ASC" style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {t.sharp_sort_odds_asc || "📉 Oran (En Düşük)"}
                        </option>
                    </select>
                </div>
            </div>

            {/* Search Bar & Quick Sort Row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '12px'
            }}>
                {/* Search Box */}
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                    <span style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#64748b',
                        fontSize: '13px',
                        pointerEvents: 'none'
                    }}>
                        🔍
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.sharp_search_placeholder || "Takım veya Lig ara... (örn: Barnet, U17)"}
                        style={{
                            width: '100%',
                            padding: '8px 30px 8px 32px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: searchQuery ? '1px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '8px',
                            color: '#f8fafc',
                            fontSize: '12px',
                            outline: 'none',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s',
                            boxShadow: searchQuery ? '0 0 10px rgba(56, 189, 248, 0.15)' : 'none'
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
                                fontSize: '13px',
                                cursor: 'pointer',
                                padding: '2px'
                            }}
                            title="Aramayı Temizle"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Quick Sort Shortcuts */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Hızlı Sırala:</span>
                    <button
                        onClick={() => setSortBy(sortBy === 'CONF_DESC' ? 'CONF_ASC' : 'CONF_DESC')}
                        style={{
                            background: sortBy.startsWith('CONF') ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${sortBy.startsWith('CONF') ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: sortBy.startsWith('CONF') ? '#38bdf8' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}
                        title="Model Güvenine Göre Sırala"
                    >
                        🎯 Güven {sortBy === 'CONF_DESC' ? '↓ En Yüksek' : sortBy === 'CONF_ASC' ? '↑ En Düşük' : ''}
                    </button>
                    <button
                        onClick={() => setSortBy(sortBy === 'TIME_ASC' ? 'TIME_DESC' : 'TIME_ASC')}
                        style={{
                            background: sortBy.startsWith('TIME') ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${sortBy.startsWith('TIME') ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: sortBy.startsWith('TIME') ? '#38bdf8' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}
                        title="Başlama Saatine Göre Sırala"
                    >
                        ⏰ Saat {sortBy === 'TIME_ASC' ? '↑ Erken' : sortBy === 'TIME_DESC' ? '↓ Geç' : ''}
                    </button>
                    <button
                        onClick={() => setSortBy(sortBy === 'ODDS_DESC' ? 'ODDS_ASC' : 'ODDS_DESC')}
                        style={{
                            background: sortBy.startsWith('ODDS') ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${sortBy.startsWith('ODDS') ? '#facc15' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: sortBy.startsWith('ODDS') ? '#facc15' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}
                        title="Orana Göre Sırala"
                    >
                        💰 Oran {sortBy === 'ODDS_DESC' ? '↓ Yüksek' : sortBy === 'ODDS_ASC' ? '↑ Düşük' : ''}
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                {/* Status Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginRight: '4px' }}>
                        Durum:
                    </span>
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        style={{
                            background: filterStatus === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                            color: filterStatus === 'ALL' ? '#38bdf8' : '#64748b',
                            border: filterStatus === 'ALL' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {t.sharp_filter_all || "Tümü"} ({activeList.length})
                    </button>
                    <button
                        onClick={() => setFilterStatus('WON')}
                        style={{
                            background: filterStatus === 'WON' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            color: filterStatus === 'WON' ? '#10b981' : '#64748b',
                            border: filterStatus === 'WON' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        🟢 {t.sharp_filter_won || "Kazananlar"} ({wonCount})
                    </button>
                    {liveCount > 0 && (
                        <button
                            onClick={() => setFilterStatus('LIVE')}
                            style={{
                                background: filterStatus === 'LIVE' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                                color: filterStatus === 'LIVE' ? '#38bdf8' : '#64748b',
                                border: filterStatus === 'LIVE' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            ⚡ {t.sharp_filter_live || "Canlı"} ({liveCount})
                        </button>
                    )}
                    <button
                        onClick={() => setFilterStatus('PENDING')}
                        style={{
                            background: filterStatus === 'PENDING' ? 'rgba(148, 163, 184, 0.2)' : 'transparent',
                            color: filterStatus === 'PENDING' ? '#cbd5e1' : '#64748b',
                            border: filterStatus === 'PENDING' ? '1px solid rgba(148, 163, 184, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        ⏳ {t.sharp_filter_pending || "Bekleyenler"} ({pendingCount})
                    </button>
                    {lostCount > 0 && (
                        <button
                            onClick={() => setFilterStatus('LOST')}
                            style={{
                                background: filterStatus === 'LOST' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                color: filterStatus === 'LOST' ? '#ef4444' : '#64748b',
                                border: filterStatus === 'LOST' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            🔴 {t.sharp_filter_lost || "Kaybedenler"} ({lostCount})
                        </button>
                    )}
                </div>

                {/* Dropdowns Row: Model Güveni, Bahis Türü, Oran, Kasa Katlama */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    {/* Model Confidence Threshold Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>🎯 Güven:</span>
                        <select
                            value={confFilter}
                            onChange={(e) => setConfFilter(e.target.value)}
                            style={{
                                background: confFilter !== 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                                border: confFilter !== 'ALL' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                                color: confFilter !== 'ALL' ? '#38bdf8' : '#cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="ALL" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_all_confidence || "Tüm Güvenler"}
                            </option>
                            <option value="90" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_conf_90 || "≥ %90 (Elite)"}
                            </option>
                            <option value="85" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_conf_85 || "≥ %85 (Ultra)"}
                            </option>
                            <option value="80" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_conf_80 || "≥ %80 (Yüksek)"}
                            </option>
                            <option value="75" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_conf_75 || "≥ %75 (Güçlü)"}
                            </option>
                            <option value="UNDER_75" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_conf_under75 || "< %75 (Sürpriz)"}
                            </option>
                        </select>
                    </div>

                    {/* Bet Type / Market Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>🎲 Tür:</span>
                        <select
                            value={marketFilter}
                            onChange={(e) => setMarketFilter(e.target.value)}
                            style={{
                                background: marketFilter !== 'ALL' ? 'rgba(129, 140, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                                border: marketFilter !== 'ALL' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.12)',
                                color: marketFilter !== 'ALL' ? '#818cf8' : '#cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="ALL" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_market_all || "Tüm Bahis Türleri"}
                            </option>
                            <option value="DC" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_market_dc || "🛡️ Çifte Şans (1X, X2, 12)"}
                            </option>
                            <option value="MS" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_market_ms || "🏆 Maç Sonucu (MS)"}
                            </option>
                            <option value="GOALS" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_market_goals || "⚽ Gol Bahisleri (Üst/KG)"}
                            </option>
                            <option value="HT" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_market_ht || "⏱️ İlk Yarı (İY)"}
                            </option>
                        </select>
                    </div>

                    {/* Odds Range Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>💰 Oran:</span>
                        <select
                            value={oddsFilter}
                            onChange={(e) => setOddsFilter(e.target.value)}
                            style={{
                                background: oddsFilter !== 'ALL' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                                border: oddsFilter !== 'ALL' ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.12)',
                                color: oddsFilter !== 'ALL' ? '#facc15' : '#cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="ALL" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_odds_all || "Tüm Oranlar"}
                            </option>
                            <option value="SAFE" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_odds_safe || "1.10 - 1.35 (Kasa Katlama)"}
                            </option>
                            <option value="MEDIUM" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_odds_medium || "1.35 - 1.50 (Dengeli)"}
                            </option>
                            <option value="HIGH" style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {t.sharp_odds_high || "1.50+ (Değerli Oran)"}
                            </option>
                        </select>
                    </div>

                    {/* Rollover Toggle */}
                    <button
                        onClick={() => setRolloverOnly(!rolloverOnly)}
                        style={{
                            background: rolloverOnly ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            border: rolloverOnly ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                            color: rolloverOnly ? '#34d399' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        🛡️ {t.sharp_filter_rollover_only || "Kasa Katlama"}
                    </button>

                    {/* Results count & Clear filters */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                            <strong style={{ color: '#38bdf8' }}>{filteredList.length}</strong> / {activeList.length} {t.sharp_showing_count || 'maç'}
                        </span>
                        {isAnyFilterActive && (
                            <button
                                onClick={resetAllFilters}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    color: '#f87171',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                }}
                                title="Tüm filtreleri varsayılana sıfırla"
                            >
                                ✕ {t.sharp_filter_reset || "Sıfırla"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Matches List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '14px' }}>
                    Seçimler ve sonuçlar taranıyor...
                </div>
            ) : filteredList.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: '14px'
                }}>
                    <div style={{ fontSize: '30px', marginBottom: '8px' }}>🔍</div>
                    <div style={{ fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
                        {t.sharp_no_matches_found || "Filtre kriterlerine uygun maç bulunamadı."}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                        Arama metninizi veya filtre seçimlerinizi genişleterek tekrar deneyebilirsiniz.
                    </div>
                    {isAnyFilterActive && (
                        <button
                            onClick={resetAllFilters}
                            style={{
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                color: '#38bdf8',
                                borderRadius: '8px',
                                padding: '6px 16px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            ↺ {t.sharp_filter_reset || "Filtreleri Sıfırla"}
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredList.map((match, idx) => {
                        const statusObj = formatStatus(match.status, match.time);
                        const tipDisplay = formatTip(match.tip);
                        const conf = match.confidence || 85;
                        const confColor = conf >= 85 ? '#10b981' : (conf >= 80 ? '#38bdf8' : '#facc15');
                        const confBg = conf >= 85 ? 'rgba(16, 185, 129, 0.12)' : (conf >= 80 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(250, 204, 21, 0.12)');
                        const confBorder = conf >= 85 ? 'rgba(16, 185, 129, 0.35)' : (conf >= 80 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(250, 204, 21, 0.35)');

                        return (
                            <div
                                key={match.id || idx}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${match.status === 'WON' ? 'rgba(16, 185, 129, 0.3)' : (match.status === 'LOST' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)')}`,
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    transition: 'transform 0.15s, border-color 0.15s'
                                }}
                            >
                                {/* Top Line: League & Time */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
                                        {match.league}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {match.time && (
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                ⏰ {match.time}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            color: statusObj.color,
                                            background: statusObj.bg,
                                            border: `1px solid ${statusObj.border}`,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {statusObj.icon} {statusObj.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Middle Line: Teams & Score */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                                        <span>{match.home}</span>
                                        <span style={{ color: '#64748b', margin: '0 8px', fontWeight: '400' }}>vs</span>
                                        <span>{match.away}</span>
                                    </div>
                                    {match.score && match.score !== '-' && (
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '800',
                                            color: match.status === 'WON' ? '#10b981' : (match.status === 'LOST' ? '#ef4444' : '#f8fafc'),
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255, 255, 255, 0.05)'
                                        }}>
                                            {match.score}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Line: Tip Pill, Odds & Confidence Badge */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                    paddingTop: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)',
                                            border: '1px solid rgba(56, 189, 248, 0.4)',
                                            color: '#e0f2fe',
                                            fontSize: '13px',
                                            fontWeight: '800',
                                            padding: '4px 10px',
                                            borderRadius: '6px'
                                        }}>
                                            🎯 {tipDisplay}
                                        </span>
                                        <span style={{
                                            background: 'rgba(250, 204, 21, 0.15)',
                                            border: '1px solid rgba(250, 204, 21, 0.35)',
                                            color: '#facc15',
                                            fontSize: '13px',
                                            fontWeight: '800',
                                            padding: '4px 8px',
                                            borderRadius: '6px'
                                        }}>
                                            {match.odds ? match.odds.toFixed(2) : '1.30'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: confBg,
                                            border: `1px solid ${confBorder}`,
                                            borderRadius: '6px',
                                            padding: '3px 8px'
                                        }}>
                                            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                                                {t.sharp_confidence || "Model Güveni"}:
                                            </span>
                                            <strong style={{ fontSize: '12px', fontWeight: '800', color: confColor }}>
                                                %{conf}
                                            </strong>
                                            <div style={{
                                                width: '32px',
                                                height: '4px',
                                                background: 'rgba(255, 255, 255, 0.12)',
                                                borderRadius: '2px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${conf}%`,
                                                    height: '100%',
                                                    background: confColor,
                                                    borderRadius: '2px'
                                                }} />
                                            </div>
                                        </div>

                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            color: '#10b981',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            padding: '3px 7px',
                                            borderRadius: '5px',
                                            border: '1px solid rgba(16, 185, 129, 0.25)'
                                        }}>
                                            🛡️ {t.sharp_rollover_suitable || "Kasa Katlama"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SharpPicksCard;
