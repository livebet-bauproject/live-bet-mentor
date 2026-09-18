import React, { useState, useEffect, useRef } from 'react';

export const AnalyticsDashboard = ({ lang = 'tr' }) => {
    const [period, setPeriod] = useState('24h'); // '24h', '7d', '30d', 'all'
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [data, setData] = useState(null);
    const [liveData, setLiveData] = useState(null);
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    const autoRefreshTimerRef = useRef(null);

    const t = lang === 'tr' ? {
        title: '📊 ZİYARETÇİ & SİTE ANALİTİĞİ',
        subtitle: 'Google Analytics bağımsız, 1. taraf, KVKK/GDPR uyumlu, çerezsiz ve %100 AdBlock korumalı gerçek zamanlı analitik.',
        liveOnline: 'ŞU AN CANLI',
        liveVisitors: 'Aktif Ziyaretçi',
        last5Min: '(Son 5 dakika içinde aktif)',
        activePages: 'Şu An İncelenen Sayfalar',
        period24h: 'Son 24 Saat',
        period7d: 'Son 7 Gün',
        period30d: 'Son 30 Gün',
        periodAll: 'Tüm Zamanlar',
        autoRefresh: 'Oto-Yenileme (15s)',
        refresh: 'Yenile',
        exportJson: 'JSON İndir',
        resetData: 'Verileri Sıfırla',
        resetConfirm: 'Tüm ziyaretçi ve analitik loglarını kalıcı olarak silmek istediğinizden emin misiniz?',
        uniqueVisitors: 'Tekil Ziyaretçi',
        totalPageviews: 'Sayfa Görüntüleme',
        totalSessions: 'Toplam Oturum',
        bounceRate: 'Hemen Çıkma Oranı',
        avgDuration: 'Ort. Ziyaret Süresi',
        trendChartTitle: '📈 ZİYARETÇİ & SAYFA GÖRÜNTÜLEME GRAFİĞİ',
        pageviewsLegend: 'Sayfa Görüntüleme',
        visitorsLegend: 'Tekil Ziyaretçi',
        topPagesTitle: '📄 EN ÇOK GEZİLEN SAYFALAR & EKRANLAR',
        pageCol: 'SAYFA / EKRAN',
        viewsCol: 'GÖRÜNTÜLEME',
        shareCol: 'PAY (%)',
        referrersTitle: '🌐 TRAFİK KAYNAKLARI & YÖNLENDİRENLER',
        channelCol: 'KANAL',
        channelDirect: 'Doğrudan (Direct / URL)',
        channelTelegram: 'Telegram (Kanal & Bot)',
        channelGoogle: 'Google / Arama',
        channelSocial: 'Sosyal Medya (X, IG)',
        channelExternal: 'Harici Yönlendirme',
        channelInternal: 'Site İçi Gezinti',
        devicesTitle: '📱 CİHAZ DAĞILIMI',
        deviceMobile: 'Mobil',
        deviceDesktop: 'Masaüstü',
        deviceTablet: 'Tablet',
        browsersTitle: '🌐 TARAYICILAR & SİSTEM',
        countriesTitle: '🌍 COĞRAFİ / ÜLKE DAĞILIMI',
        funnelTitle: '🎯 DÖNÜŞÜM HUNİSİ (CONVERSION FUNNEL)',
        funnelStep1: '1. Site Ziyaretçisi',
        funnelStep2: '2. Kayıt / Deneme Başlatan',
        funnelStep3: '3. Canlı Panele Giren',
        funnelStep4: '4. VIP Yükseltme Talebi',
        funnelStep5: '5. Aktif Üye (Pro/Premium)',
        recentActivityTitle: '⚡ CANLI HAREKET & OLAY AKIŞI',
        noData: 'Henüz kayıtlı ziyaretçi verisi bulunmuyor. Site ziyaret edildikçe veriler buraya anlık yansıyacaktır.',
        loadingText: 'Analitik verileri yükleniyor...'
    } : lang === 'de' ? {
        title: '📊 BESUCHER- & PRODUKT-ANALYTIK',
        subtitle: 'Unabhängig von Google Analytics, First-Party, DSGVO-konform, ohne Cookies und 100% AdBlock-resistent in Echtzeit.',
        liveOnline: 'JETZT LIVE',
        liveVisitors: 'Aktive Besucher',
        last5Min: '(Aktiv in den letzten 5 Minuten)',
        activePages: 'Aktuell aufgerufene Seiten',
        period24h: 'Letzte 24 Stunden',
        period7d: 'Letzte 7 Tage',
        period30d: 'Letzte 30 Tage',
        periodAll: 'Gesamte Zeit',
        autoRefresh: 'Auto-Aktualisierung (15s)',
        refresh: 'Aktualisieren',
        exportJson: 'JSON exportieren',
        resetData: 'Daten zurücksetzen',
        resetConfirm: 'Sind Sie sicher, dass Sie alle Besucher- und Analysedaten unwiderruflich löschen möchten?',
        uniqueVisitors: 'Eindeutige Besucher',
        totalPageviews: 'Seitenaufrufe',
        totalSessions: 'Sitzungen gesamt',
        bounceRate: 'Absprungrate',
        avgDuration: 'Durchschn. Verweildauer',
        trendChartTitle: '📈 BESUCHER- & SEITENAUFRUF-VERLAUF',
        pageviewsLegend: 'Seitenaufrufe',
        visitorsLegend: 'Eindeutige Besucher',
        topPagesTitle: '📄 MEISTBESUCHTE SEITEN & BEREICHE',
        pageCol: 'SEITE / ROUTE',
        viewsCol: 'AUFRUFE',
        shareCol: 'ANTEIL (%)',
        referrersTitle: '🌐 TRAFFIC-QUELLEN & VERWEISE',
        channelCol: 'KANAL',
        channelDirect: 'Direkt (URL / Lesezeichen)',
        channelTelegram: 'Telegram (Kanal & Bot)',
        channelGoogle: 'Google / Suche',
        channelSocial: 'Soziale Medien (X, IG)',
        channelExternal: 'Externe Verweise',
        channelInternal: 'Interne Navigation',
        devicesTitle: '📱 GERÄTEVERTEILUNG',
        deviceMobile: 'Mobil',
        deviceDesktop: 'Desktop',
        deviceTablet: 'Tablet',
        browsersTitle: '🌐 BROWSER & SYSTEME',
        countriesTitle: '🌍 GEOGRAFISCHE VERTEILUNG',
        funnelTitle: '🎯 CONVERSION-TRICHTER',
        funnelStep1: '1. Website-Besucher',
        funnelStep2: '2. Registrierung / Testphase',
        funnelStep3: '3. Dashboard aktiv',
        funnelStep4: '4. Upgrade-Anfrage',
        funnelStep5: '5. Aktive VIP-Mitglieder',
        recentActivityTitle: '⚡ ECHTZEIT-AKTIVITÄTSSTROM',
        noData: 'Noch keine Besucherdaten erfasst. Daten werden in Echtzeit aktualisiert, sobald Besucher aktiv sind.',
        loadingText: 'Lade Analysedaten...'
    } : {
        title: '📊 VISITOR & PRODUCT ANALYTICS',
        subtitle: 'Independent from Google Analytics, 1st-party, GDPR compliant, cookieless, 100% AdBlock-resistant real-time telemetry.',
        liveOnline: 'LIVE ONLINE',
        liveVisitors: 'Active Visitors',
        last5Min: '(Active in the last 5 minutes)',
        activePages: 'Currently Browsed Pages',
        period24h: 'Last 24 Hours',
        period7d: 'Last 7 Days',
        period30d: 'Last 30 Days',
        periodAll: 'All Time',
        autoRefresh: 'Auto-Refresh (15s)',
        refresh: 'Refresh',
        exportJson: 'Export JSON',
        resetData: 'Reset Stats',
        resetConfirm: 'Are you sure you want to permanently wipe all telemetry analytics logs?',
        uniqueVisitors: 'Unique Visitors',
        totalPageviews: 'Pageviews',
        totalSessions: 'Total Sessions',
        bounceRate: 'Bounce Rate',
        avgDuration: 'Avg. Duration',
        trendChartTitle: '📈 TRAFFIC & ENGAGEMENT TIMELINE',
        pageviewsLegend: 'Pageviews',
        visitorsLegend: 'Unique Visitors',
        topPagesTitle: '📄 TOP VISITED PAGES & VIEWS',
        pageCol: 'PAGE / ROUTE',
        viewsCol: 'VIEWS',
        shareCol: 'SHARE (%)',
        referrersTitle: '🌐 TRAFFIC SOURCES & REFERRERS',
        channelCol: 'CHANNEL',
        channelDirect: 'Direct (URL / Bookmark)',
        channelTelegram: 'Telegram (Channel & Bot)',
        channelGoogle: 'Google / Search',
        channelSocial: 'Social Media (X, IG)',
        channelExternal: 'External Referrals',
        channelInternal: 'Internal Navigation',
        devicesTitle: '📱 DEVICE DISTRIBUTION',
        deviceMobile: 'Mobile',
        deviceDesktop: 'Desktop',
        deviceTablet: 'Tablet',
        browsersTitle: '🌐 BROWSERS & PLATFORMS',
        countriesTitle: '🌍 GEOGRAPHIC DISTRIBUTION',
        funnelTitle: '🎯 CONVERSION FUNNEL',
        funnelStep1: '1. Site Visitors',
        funnelStep2: '2. Registered / Trial',
        funnelStep3: '3. Dashboard Active',
        funnelStep4: '4. Upgrade Requested',
        funnelStep5: '5. Paid Members (VIP)',
        recentActivityTitle: '⚡ REAL-TIME ACTIVITY STREAM',
        noData: 'No telemetry events recorded yet. Data will populate in real-time as users browse.',
        loadingText: 'Loading analytics telemetry...'
    };

    const getProxyBase = () => {
        if (typeof window === 'undefined') return 'http://localhost:3001';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocal ? 'http://localhost:3001' : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');
    };

    const getAdminHeaders = () => ({
        'Content-Type': 'application/json',
        'x-admin-sender': 'admin@livebetmentor.com',
        'x-admin-token': 'master-admin-token'
    });

    const fetchSummary = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/analytics/summary?period=${period}`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error('[ANALYTICS UI] Summary fetch error:', e);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    const fetchLive = async () => {
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/analytics/live`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const json = await res.json();
                setLiveData(json);
            }
        } catch (e) {
            console.error('[ANALYTICS UI] Live fetch error:', e);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchSummary();
        fetchLive();
    }, [period]);

    useEffect(() => {
        if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);

        if (autoRefresh) {
            autoRefreshTimerRef.current = setInterval(() => {
                fetchSummary();
                fetchLive();
            }, 15000); // 15 seconds
        }

        return () => {
            if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
        };
    }, [autoRefresh, period]);

    const handleReset = async () => {
        if (!window.confirm(t.resetConfirm)) return;
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/analytics/reset`, {
                method: 'POST',
                headers: getAdminHeaders()
            });
            if (res.ok) {
                setStatusMsg({ type: 'success', text: lang === 'tr' ? 'Analitik verileri sıfırlandı.' : (lang === 'de' ? 'Analysedaten zurückgesetzt.' : 'Analytics data wiped.') });
                setTimeout(() => setStatusMsg(null), 4000);
                fetchSummary();
                fetchLive();
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: e.message });
        }
    };

    const handleExport = () => {
        if (!data) return;
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `livebet_analytics_${period}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return '0s';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (m === 0) return `${s}s`;
        return `${m}dk ${s}s`;
    };

    const formatChannelName = (channel) => {
        switch (channel) {
            case 'telegram': return `📱 ${t.channelTelegram}`;
            case 'google': return `🔍 ${t.channelGoogle}`;
            case 'social': return `💬 ${t.channelSocial}`;
            case 'direct': return `🌐 ${t.channelDirect}`;
            case 'external': return `🔗 ${t.channelExternal}`;
            case 'internal': return `⚡ ${t.channelInternal}`;
            default: return `🌐 ${channel}`;
        }
    };

    const summary = data?.summary || {
        uniqueVisitors: 0,
        totalPageviews: 0,
        totalSessions: 0,
        bounceRate: 0,
        avgDuration: 0,
        liveNow: liveData?.activeCount || 0
    };

    const timeline = data?.timeline || [];
    const maxTimelineValue = Math.max(
        ...timeline.map(item => Math.max(item.pageviews || 0, item.visitors || 0)),
        1
    );

    // Render SVG interactive timeline chart
    const renderTimelineChart = () => {
        if (timeline.length === 0) {
            return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>{t.noData}</div>;
        }

        const width = 800;
        const height = 220;
        const padding = { top: 20, right: 30, bottom: 35, left: 45 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const pointsPv = [];
        const pointsUv = [];

        const step = timeline.length > 1 ? chartWidth / (timeline.length - 1) : chartWidth;

        timeline.forEach((pt, i) => {
            const x = padding.left + (i * step);
            const yPv = padding.top + chartHeight - ((pt.pageviews / maxTimelineValue) * chartHeight);
            const yUv = padding.top + chartHeight - ((pt.visitors / maxTimelineValue) * chartHeight);
            pointsPv.push({ x, y: yPv, val: pt.pageviews, label: pt.label, data: pt });
            pointsUv.push({ x, y: yUv, val: pt.visitors, label: pt.label, data: pt });
        });

        const pathPv = pointsPv.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
        const areaPv = `${pathPv} L ${pointsPv[pointsPv.length - 1].x} ${padding.top + chartHeight} L ${pointsPv[0].x} ${padding.top + chartHeight} Z`;

        const pathUv = pointsUv.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
        const areaUv = `${pathUv} L ${pointsUv[pointsUv.length - 1].x} ${padding.top + chartHeight} L ${pointsUv[0].x} ${padding.top + chartHeight} Z`;

        return (
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                    <defs>
                        <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="uvGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = padding.top + (chartHeight * (1 - ratio));
                        const val = Math.round(maxTimelineValue * ratio);
                        return (
                            <g key={idx}>
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.06)"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={padding.left - 8}
                                    y={y + 3}
                                    fill="#64748b"
                                    fontSize="10"
                                    textAnchor="end"
                                    fontFamily="monospace"
                                >
                                    {val}
                                </text>
                            </g>
                        );
                    })}

                    {/* Filled Area Gradients */}
                    <path d={areaPv} fill="url(#pvGradient)" />
                    <path d={areaUv} fill="url(#uvGradient)" />

                    {/* Lines */}
                    <path d={pathPv} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                    <path d={pathUv} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />

                    {/* Interactive Points and Labels */}
                    {pointsPv.map((p, i) => {
                        // Skip some X labels if there are too many to avoid overlapping
                        const showLabel = timeline.length <= 12 || (i % Math.ceil(timeline.length / 8) === 0) || i === timeline.length - 1;
                        return (
                            <g key={i}>
                                {showLabel && (
                                    <text
                                        x={p.x}
                                        y={height - 10}
                                        fill="#94a3b8"
                                        fontSize="10"
                                        textAnchor="middle"
                                        fontFamily="monospace"
                                    >
                                        {p.label}
                                    </text>
                                )}
                                {/* Invisible hover zone */}
                                <rect
                                    x={p.x - (step / 2)}
                                    y={padding.top}
                                    width={step}
                                    height={chartHeight}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredPoint({ x: p.x, pv: p.val, uv: pointsUv[i].val, label: p.label })}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                />
                            </g>
                        );
                    })}

                    {/* Active Hover Marker */}
                    {hoveredPoint && (
                        <g>
                            <line
                                x1={hoveredPoint.x}
                                y1={padding.top}
                                x2={hoveredPoint.x}
                                y2={padding.top + chartHeight}
                                stroke="rgba(255,255,255,0.4)"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                            />
                            <circle cx={hoveredPoint.x} cy={padding.top + chartHeight - ((hoveredPoint.pv / maxTimelineValue) * chartHeight)} r="4" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                            <circle cx={hoveredPoint.x} cy={padding.top + chartHeight - ((hoveredPoint.uv / maxTimelineValue) * chartHeight)} r="4" fill="#38bdf8" stroke="#fff" strokeWidth="1.5" />
                        </g>
                    )}
                </svg>

                {/* Floating Tooltip */}
                {hoveredPoint && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: `${Math.min(Math.max(hoveredPoint.x - 60, 50), width - 180)}px`,
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.8rem',
                        fontSize: '0.75rem',
                        pointerEvents: 'none',
                        zIndex: 10,
                        backdropFilter: 'blur(8px)'
                    }}>
                        <div style={{ fontWeight: 800, color: '#fff', marginBottom: '0.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem' }}>
                            {hoveredPoint.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                            <span>{t.pageviewsLegend}: <strong>{hoveredPoint.pv}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 700 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }}></span>
                            <span>{t.visitorsLegend}: <strong>{hoveredPoint.uv}</strong></span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1.2rem 1.6rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span>📊</span>
                        <span>{t.title}</span>
                    </h2>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                        {t.subtitle}
                    </p>
                </div>

                {/* Period Buttons & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['24h', '7d', '30d', 'all'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '0.5rem 0.9rem',
                                background: period === p ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${period === p ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '8px',
                                color: period === p ? '#38bdf8' : '#94a3b8',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {p === '24h' ? t.period24h : p === '7d' ? t.period7d : p === '30d' ? t.period30d : t.periodAll}
                        </button>
                    ))}

                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.3rem' }} />

                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            padding: '0.5rem 0.8rem',
                            background: autoRefresh ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${autoRefresh ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '8px',
                            color: autoRefresh ? '#10b981' : '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        ⚡ {t.autoRefresh}
                    </button>

                    <button
                        onClick={() => { fetchSummary(true); fetchLive(); }}
                        disabled={refreshing}
                        style={{
                            padding: '0.5rem 0.8rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        🔄 {t.refresh}
                    </button>

                    <button
                        onClick={handleExport}
                        style={{
                            padding: '0.5rem 0.8rem',
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '8px',
                            color: '#38bdf8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        📥 {t.exportJson}
                    </button>

                    <button
                        onClick={handleReset}
                        style={{
                            padding: '0.5rem 0.8rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        🗑️ {t.resetData}
                    </button>
                </div>
            </div>

            {statusMsg && (
                <div style={{
                    padding: '0.8rem 1.2rem',
                    borderRadius: '8px',
                    background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
                    color: statusMsg.type === 'error' ? '#ef4444' : '#10b981',
                    fontSize: '0.85rem'
                }}>
                    {statusMsg.text}
                </div>
            )}

            {/* REAL-TIME LIVE PULSE BAR */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.05))',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '16px',
                padding: '1.2rem 1.6rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.08)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative', width: '20px', height: '20px' }}>
                        <span style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: '#10b981',
                            opacity: 0.75,
                            animation: 'pulse 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                        }}></span>
                        <span style={{
                            position: 'relative',
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 12px #10b981'
                        }}></span>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
                                {liveData?.activeCount || summary.liveNow || 0}
                            </span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                                {t.liveVisitors}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {t.last5Min}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Live Browsed Pages */}
                {liveData?.activePages && liveData.activePages.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                            {t.activePages}:
                        </span>
                        {liveData.activePages.slice(0, 4).map((p, idx) => (
                            <span
                                key={idx}
                                style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    borderRadius: '6px',
                                    padding: '0.2rem 0.6rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#34d399',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                }}
                            >
                                <span style={{ fontFamily: 'monospace' }}>{p.path}</span>
                                <span style={{ background: '#10b981', color: '#000', borderRadius: '4px', padding: '0 0.3rem', fontSize: '0.65rem', fontWeight: 900 }}>
                                    {p.count}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* TOP 5 KPI METRICS GRID */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem'
            }}>
                <div style={{
                    padding: '1.4rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                        👥 {t.uniqueVisitors}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8' }}>
                        {summary.uniqueVisitors.toLocaleString('tr-TR')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                        Tekil Cihaz / IP (Tuzlu Hash)
                    </div>
                </div>

                <div style={{
                    padding: '1.4rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                        👁️ {t.totalPageviews}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>
                        {summary.totalPageviews.toLocaleString('tr-TR')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                        Oturum Başı: {summary.totalSessions > 0 ? (summary.totalPageviews / summary.totalSessions).toFixed(1) : 0} sayfa
                    </div>
                </div>

                <div style={{
                    padding: '1.4rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                        ⏱️ {t.totalSessions}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#a78bfa' }}>
                        {summary.totalSessions.toLocaleString('tr-TR')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                        30dk Hareketsizlik Limiti
                    </div>
                </div>

                <div style={{
                    padding: '1.4rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                        📉 {t.bounceRate}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: summary.bounceRate < 45 ? '#10b981' : summary.bounceRate < 65 ? '#fbbf24' : '#ef4444' }}>
                        %{summary.bounceRate}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                        Tek sayfa &lt;12sn terk
                    </div>
                </div>

                <div style={{
                    padding: '1.4rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(244, 114, 182, 0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                        ⏳ {t.avgDuration}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f472b6' }}>
                        {formatDuration(summary.avgDuration)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                        Oturum Başı Ortalama
                    </div>
                </div>
            </div>

            {/* INTERACTIVE TIMELINE CHART */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1.6rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📈</span>
                        <span>{t.trendChartTitle}</span>
                    </h3>

                    {/* Chart Legend */}
                    <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.75rem', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981' }}>
                            <span style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px' }}></span>
                            <span>{t.pageviewsLegend}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
                            <span style={{ width: '12px', height: '3px', background: '#38bdf8', borderRadius: '2px', borderBottom: '1px dashed #38bdf8' }}></span>
                            <span>{t.visitorsLegend}</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>{t.loadingText}</div>
                ) : (
                    renderTimelineChart()
                )}
            </div>

            {/* DUAL COLUMN: TOP PAGES & TRAFFIC SOURCES */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: '1.5rem'
            }}>
                {/* Left: Top Pages */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    padding: '1.5rem'
                }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📄</span>
                        <span>{t.topPagesTitle}</span>
                    </h3>

                    {(!data?.topPages || data.topPages.length === 0) ? (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '1rem 0' }}>{t.noData}</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {data.topPages.map((page, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.3rem',
                                    background: 'rgba(255,255,255,0.015)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 0.8rem',
                                    border: '1px solid rgba(255,255,255,0.04)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 900, minWidth: '18px' }}>#{idx + 1}</span>
                                            <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {page.path}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: '110px', justifyContent: 'flex-end' }}>
                                            <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem' }}>
                                                {page.views} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>hit</span>
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, minWidth: '35px', textAlign: 'right' }}>
                                                %{page.pct}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${Math.max(page.pct, 4)}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #38bdf8, #10b981)',
                                            borderRadius: '2px'
                                        }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Traffic Channels & Referrers */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    padding: '1.5rem'
                }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🌐</span>
                        <span>{t.referrersTitle}</span>
                    </h3>

                    {(!data?.topChannels || data.topChannels.length === 0) ? (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '1rem 0' }}>{t.noData}</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {data.topChannels.map((ch, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.3rem',
                                    background: 'rgba(255,255,255,0.015)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 0.8rem',
                                    border: '1px solid rgba(255,255,255,0.04)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                        <span style={{ color: '#fff', fontWeight: 700 }}>
                                            {formatChannelName(ch.channel)}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.85rem' }}>
                                                {ch.count} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>ziyaret</span>
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, minWidth: '35px', textAlign: 'right' }}>
                                                %{ch.pct}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${Math.max(ch.pct, 3)}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #10b981, #a78bfa)',
                                            borderRadius: '2px'
                                        }}></div>
                                    </div>
                                </div>
                            ))}

                            {/* Top Domain Referrers */}
                            {data?.topReferrers && data.topReferrers.length > 0 && (
                                <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 700 }}>
                                        Harici Yönlendiren Siteler:
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {data.topReferrers.map((ref, idx) => (
                                            <span key={idx} style={{
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '6px',
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '0.7rem',
                                                color: '#cbd5e1'
                                            }}>
                                                {ref.domain} ({ref.count})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3-COLUMN: DEVICES, BROWSERS & COUNTRIES */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1.5rem'
            }}>
                {/* 1. Device Breakdown */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    padding: '1.4rem'
                }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff' }}>
                        {t.devicesTitle}
                    </h4>
                    {(() => {
                        const dev = data?.devices || { desktop: 0, mobile: 0, tablet: 0 };
                        const totalDev = (dev.desktop + dev.mobile + dev.tablet) || 1;
                        const mobPct = Math.round((dev.mobile / totalDev) * 100);
                        const deskPct = Math.round((dev.desktop / totalDev) * 100);
                        const tabPct = Math.round((dev.tablet / totalDev) * 100);

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                        <span style={{ color: '#fff' }}>📱 {t.deviceMobile}</span>
                                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>%{mobPct} ({dev.mobile})</span>
                                    </div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${mobPct}%`, height: '100%', background: '#38bdf8' }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                        <span style={{ color: '#fff' }}>💻 {t.deviceDesktop}</span>
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>%{deskPct} ({dev.desktop})</span>
                                    </div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${deskPct}%`, height: '100%', background: '#10b981' }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                        <span style={{ color: '#fff' }}>📟 {t.deviceTablet}</span>
                                        <span style={{ color: '#a78bfa', fontWeight: 700 }}>%{tabPct} ({dev.tablet})</span>
                                    </div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${tabPct}%`, height: '100%', background: '#a78bfa' }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* 2. Browser Breakdown */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    padding: '1.4rem'
                }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff' }}>
                        {t.browsersTitle}
                    </h4>
                    {(() => {
                        const br = data?.browsers || {};
                        const entries = Object.entries(br).sort((a, b) => b[1] - a[1]).slice(0, 4);
                        if (entries.length === 0) return <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{t.noData}</div>;
                        const totalBr = entries.reduce((sum, e) => sum + e[1], 0) || 1;

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {entries.map(([name, count], idx) => {
                                    const pct = Math.round((count / totalBr) * 100);
                                    return (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                                                <span style={{ color: '#cbd5e1' }}>🌐 {name}</span>
                                                <span style={{ color: '#fbbf24', fontWeight: 700 }}>%{pct} ({count})</span>
                                            </div>
                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: '#fbbf24' }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>

                {/* 3. Country Breakdown */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    padding: '1.4rem'
                }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff' }}>
                        {t.countriesTitle}
                    </h4>
                    {(!data?.countries || data.countries.length === 0) ? (
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{t.noData}</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {data.countries.slice(0, 5).map((c, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1rem' }}>{c.flag}</span>
                                        <span style={{ color: '#fff', fontWeight: 600 }}>{c.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ color: '#10b981', fontWeight: 800 }}>{c.count}</span>
                                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>%{c.pct}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CONVERSION FUNNEL */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1.6rem'
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1.2rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🎯</span>
                    <span>{t.funnelTitle}</span>
                </h3>

                {(() => {
                    const f = data?.funnel || { visitors: 0, registered: 0, engaged: 0, upgradeRequests: 0, paidUsers: 0 };
                    const base = Math.max(f.visitors, 1);

                    const steps = [
                        { label: t.funnelStep1, count: f.visitors, pct: 100, color: '#38bdf8', icon: '🌐' },
                        { label: t.funnelStep2, count: f.registered, pct: Math.round((f.registered / base) * 100), color: '#10b981', icon: '📝' },
                        { label: t.funnelStep3, count: f.engaged, pct: Math.round((f.engaged / base) * 100), color: '#fbbf24', icon: '⚡' },
                        { label: t.funnelStep4, count: f.upgradeRequests, pct: Math.round((f.upgradeRequests / base) * 100), color: '#a78bfa', icon: '💎' },
                        { label: t.funnelStep5, count: f.paidUsers, pct: Math.round((f.paidUsers / base) * 100), color: '#f59e0b', icon: '👑' }
                    ];

                    return (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: '1rem'
                        }}>
                            {steps.map((step, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${step.color}33`,
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    position: 'relative'
                                }}>
                                    <div style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>{step.icon}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.2rem' }}>
                                        {step.label}
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: step.color }}>
                                        {step.count}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                        Dönüşüm: <strong>%{step.pct}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* REAL-TIME ACTIVITY STREAM */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1.5rem'
            }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚡</span>
                    <span>{t.recentActivityTitle}</span>
                </h3>

                {(!data?.recentActivity || data.recentActivity.length === 0) ? (
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{t.noData}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                        {data.recentActivity.map((ev, idx) => {
                            const timeAgoSeconds = Math.max(Math.round((Date.now() - ev.time) / 1000), 0);
                            const timeStr = timeAgoSeconds < 60 ? `${timeAgoSeconds}s önce` : `${Math.floor(timeAgoSeconds / 60)}dk önce`;
                            return (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.8rem',
                                    background: 'rgba(255,255,255,0.015)',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    fontSize: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            background: ev.type === 'pageview' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                            color: ev.type === 'pageview' ? '#38bdf8' : '#fbbf24'
                                        }}>
                                            {ev.type === 'pageview' ? 'SAYFA' : (ev.name || 'OLAY')}
                                        </span>
                                        <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                                            {ev.path}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                            ({ev.deviceType} / {ev.browser})
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                                            {timeStr}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes pulse {
                    0% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                    }
                    70% {
                        transform: scale(1.6);
                        box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
                    }
                    100% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                    }
                }
            `}</style>
        </div>
    );
};

export default AnalyticsDashboard;
