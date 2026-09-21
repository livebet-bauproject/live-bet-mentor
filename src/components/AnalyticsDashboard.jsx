import React, { useState, useEffect, useRef } from 'react';
import { getAdminHeaders } from '../utils/adminAuth';

export const AnalyticsDashboard = ({ lang = 'tr' }) => {
    const [subTab, setSubTab] = useState('overview'); // 'overview', 'audit', 'events', 'funnel', 'traffic'
    const [period, setPeriod] = useState('24h'); // '24h', '7d', '30d', 'all'
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [data, setData] = useState(null);
    const [liveData, setLiveData] = useState(null);
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    // User Audit Inspector State
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userPlanFilter, setUserPlanFilter] = useState('all');
    const [inspectingSession, setInspectingSession] = useState(null);
    const [inspectingDetail, setInspectingDetail] = useState(null);
    const [inspectingLoading, setInspectingLoading] = useState(false);

    const autoRefreshTimerRef = useRef(null);

    const t = lang === 'tr' ? {
        title: '📊 ZİYARETÇİ & SİTE ANALİTİĞİ',
        subtitle: 'Google Analytics bağımsız, 1. taraf, KVKK/GDPR uyumlu, çerezsiz ve %100 AdBlock korumalı gerçek zamanlı kurumsal analitik motoru.',
        tabOverview: '📊 Genel Bakış',
        tabAudit: '🕵️ Kullanıcı Denetimi',
        tabEvents: '⚡ Olaylar & Etkileşim',
        tabFunnel: '🎯 Dönüşüm Hunisi',
        tabTraffic: '🌐 Trafik & Kampanya',
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
        totalEvents: 'Toplam Olay & Aksiyon',
        trendChartTitle: '📈 ZİYARETÇİ, SAYFA & ETKİLEŞİM GRAFİĞİ',
        pageviewsLegend: 'Sayfa Görüntüleme',
        visitorsLegend: 'Tekil Ziyaretçi',
        eventsLegend: 'Etkileşim / Olay',
        topPagesTitle: '📄 EN ÇOK GEZİLEN SAYFALAR & EKRANLAR',
        referrersTitle: '🌐 TRAFİK KANALLARI & KAYNAKLARI',
        devicesTitle: '📱 CİHAZ DAĞILIMI',
        browsersTitle: '🌐 TARAYICILAR & SİSTEM',
        countriesTitle: '🌍 COĞRAFİ DAĞILIM',
        funnelTitle: '🎯 DÖNÜŞÜM HUNİSİ & FİRE ANALİZİ (CONVERSION & DROP-OFF)',
        userAuditTitle: '🕵️ KULLANICI DENETİM DEFTERİ (USER AUDIT TRAIL)',
        userAuditSubtitle: 'Google Analytics gizliliği nedeniyle gösterilemeyen birebir kullanıcı oturumları, ziyaret edilen yollar ve tıklama hareketleri.',
        eventsTitle: '⚡ ÖZEL OLAYLAR & BUTON ETKİLEŞİMLERİ (EVENT TELEMETRY)',
        scrollTitle: '📜 SAYFA KAYDIRMA (SCROLL) DERİNLİĞİ',
        campaignsTitle: '🎯 UTM KAMPANYALARI & REKLAM DÖNÜŞÜMÜ',
        noData: 'Henüz kayıtlı analitik verisi bulunmuyor. Site ziyaret edildikçe veriler buraya anlık yansıyacaktır.',
        loadingText: 'Analitik telemetri verileri yükleniyor...',
        inspectBtn: 'Detaylı İncele',
        inspectorTitle: 'KULLANICI OTURUM KRONOLOJİSİ',
        inspectorClose: 'Kapat',
        searchPlaceholder: 'E-posta, Ziyaretçi ID veya Ülke ara...',
        planAll: 'Tüm Planlar',
        planGuest: 'Misafir',
        planTrial: 'Deneme',
        planPro: 'Pro / VIP',
        planAdmin: 'Admin'
    } : lang === 'de' ? {
        title: '📊 BESUCHER- & PRODUKT-ANALYTIK',
        subtitle: 'Unabhängig von Google Analytics, First-Party, DSGVO-konform, ohne Cookies und 100% AdBlock-resistent in Echtzeit.',
        tabOverview: '📊 Übersicht',
        tabAudit: '🕵️ Benutzer-Audit',
        tabEvents: '⚡ Ereignisse',
        tabFunnel: '🎯 Funnel-Analyse',
        tabTraffic: '🌐 Traffic & Kampagnen',
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
        totalEvents: 'Ereignisse & Aktionen',
        trendChartTitle: '📈 BESUCHER-, SEITEN- & INTERAKTIONS-VERLAUF',
        pageviewsLegend: 'Seitenaufrufe',
        visitorsLegend: 'Eindeutige Besucher',
        eventsLegend: 'Interaktionen',
        topPagesTitle: '📄 MEISTBESUCHTE SEITEN & BEREICHE',
        referrersTitle: '🌐 TRAFFIC-QUELLEN & KANÄLE',
        devicesTitle: '📱 GERÄTEVERTEILUNG',
        browsersTitle: '🌐 BROWSER & SYSTEME',
        countriesTitle: '🌍 GEOGRAFISCHE VERTEILUNG',
        funnelTitle: '🎯 CONVERSION-TRICHTER & ABBRUCH-ANALYSE',
        userAuditTitle: '🕵️ BENUTZER-AUDIT-PROTOKOLL',
        userAuditSubtitle: 'Detaillierte Benutzerpfade und Klickverläufe in Echtzeit.',
        eventsTitle: '⚡ EREIGNIS-TELEMETRIE & BUTTON-KLICKS',
        scrollTitle: '📜 SCROLL-TIEFE DER SEITEN',
        campaignsTitle: '🎯 UTM-KAMPAGNEN & MARKETING-TRACKING',
        noData: 'Noch keine Daten vorhanden.',
        loadingText: 'Lade Analysedaten...',
        inspectBtn: 'Prüfen',
        inspectorTitle: 'SITZUNGS-CHRONIK DES BENUTZERS',
        inspectorClose: 'Schließen',
        searchPlaceholder: 'E-Mail, ID oder Land suchen...',
        planAll: 'Alle Pläne',
        planGuest: 'Gast',
        planTrial: 'Testphase',
        planPro: 'Pro / VIP',
        planAdmin: 'Admin'
    } : {
        title: '📊 VISITOR & ENTERPRISE ANALYTICS',
        subtitle: 'Independent from Google Analytics, 1st-party, GDPR compliant, cookieless, 100% AdBlock-resistant real-time telemetry.',
        tabOverview: '📊 Overview',
        tabAudit: '🕵️ User Audit Trail',
        tabEvents: '⚡ Event Telemetry',
        tabFunnel: '🎯 Funnel & Drop-off',
        tabTraffic: '🌐 Traffic & UTM',
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
        totalEvents: 'Total Events & Clicks',
        trendChartTitle: '📈 TRAFFIC, PAGEVIEWS & INTERACTION TIMELINE',
        pageviewsLegend: 'Pageviews',
        visitorsLegend: 'Unique Visitors',
        eventsLegend: 'Interactions / Events',
        topPagesTitle: '📄 TOP VISITED PAGES & VIEWS',
        referrersTitle: '🌐 TRAFFIC SOURCES & CHANNELS',
        devicesTitle: '📱 DEVICE DISTRIBUTION',
        browsersTitle: '🌐 BROWSERS & PLATFORMS',
        countriesTitle: '🌍 GEOGRAPHIC DISTRIBUTION',
        funnelTitle: '🎯 CONVERSION FUNNEL & DROP-OFF ANALYSIS',
        userAuditTitle: '🕵️ USER-LEVEL AUDIT TRAIL & JOURNEY INSPECTOR',
        userAuditSubtitle: 'Granular user-level session paths, interaction timelines and actions that Google Analytics cannot show due to PII rules.',
        eventsTitle: '⚡ CUSTOM EVENTS & BUTTON INTERACTION TELEMETRY',
        scrollTitle: '📜 SCROLL DEPTH ANALYSIS',
        campaignsTitle: '🎯 UTM CAMPAIGNS & ATTRIBUTION',
        noData: 'No telemetry events recorded yet.',
        loadingText: 'Loading telemetry stats...',
        inspectBtn: 'Inspect Session',
        inspectorTitle: 'USER SESSION CHRONOLOGICAL TIMELINE',
        inspectorClose: 'Close',
        searchPlaceholder: 'Search by Email, ID or Country...',
        planAll: 'All Plans',
        planGuest: 'Guest',
        planTrial: 'Trial',
        planPro: 'Pro / VIP',
        planAdmin: 'Admin'
    };

    const getProxyBase = () => {
        if (typeof window === 'undefined') return 'http://localhost:3001';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocal ? 'http://localhost:3001' : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');
    };

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

    const fetchUserDetail = async (session) => {
        setInspectingSession(session);
        setInspectingLoading(true);
        setInspectingDetail(null);
        try {
            const proxyBase = getProxyBase();
            const q = session.sessionId ? `sessionId=${encodeURIComponent(session.sessionId)}` : `visitorId=${encodeURIComponent(session.visitorId)}`;
            const res = await fetch(`${proxyBase}/api/analytics/user-detail?${q}`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const json = await res.json();
                setInspectingDetail(json);
            }
        } catch (e) {
            console.error('[ANALYTICS UI] User detail error:', e);
        } finally {
            setInspectingLoading(false);
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
                setStatusMsg({ type: 'success', text: lang === 'tr' ? 'Analitik verileri sıfırlandı.' : 'Analytics data wiped.' });
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
            case 'telegram': return '📱 Telegram (Kanal & Bot)';
            case 'google': return '🔍 Google / Arama';
            case 'social': return '💬 Sosyal Medya (X, IG)';
            case 'direct': return '🌐 Doğrudan (Direct / URL)';
            case 'external': return '🔗 Harici Yönlendirme';
            case 'internal': return '⚡ Site İçi Gezinti';
            default: return `🌐 ${channel}`;
        }
    };

    const summary = data?.summary || {
        uniqueVisitors: 0,
        totalPageviews: 0,
        totalSessions: 0,
        totalEvents: 0,
        bounceRate: 0,
        avgDuration: 0,
        liveNow: liveData?.activeCount || 0,
        telegramClicks: 0,
        vipClicks: 0
    };

    const timeline = data?.timeline || [];
    const maxTimelineValue = Math.max(
        ...timeline.map(item => Math.max(item.pageviews || 0, item.visitors || 0, item.events || 0)),
        1
    );

    // Filter user journeys in audit table
    const filteredJourneys = (data?.userJourneys || []).filter(item => {
        if (userPlanFilter !== 'all') {
            const plan = (item.plan || 'guest').toLowerCase();
            if (userPlanFilter === 'pro' && !['pro', 'premium'].includes(plan)) return false;
            if (userPlanFilter === 'trial' && plan !== 'trial') return false;
            if (userPlanFilter === 'guest' && plan !== 'guest') return false;
            if (userPlanFilter === 'admin' && plan !== 'admin') return false;
        }
        if (!userSearchTerm) return true;
        const term = userSearchTerm.toLowerCase();
        return (
            (item.email && item.email.toLowerCase().includes(term)) ||
            (item.visitorId && item.visitorId.toLowerCase().includes(term)) ||
            (item.countryName && item.countryName.toLowerCase().includes(term)) ||
            (item.countryCode && item.countryCode.toLowerCase().includes(term)) ||
            (item.plan && item.plan.toLowerCase().includes(term))
        );
    });

    // Render interactive SVG timeline chart
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
        const pointsEv = [];

        const step = timeline.length > 1 ? chartWidth / (timeline.length - 1) : chartWidth;

        timeline.forEach((pt, i) => {
            const x = padding.left + (i * step);
            const yPv = padding.top + chartHeight - ((pt.pageviews / maxTimelineValue) * chartHeight);
            const yUv = padding.top + chartHeight - ((pt.visitors / maxTimelineValue) * chartHeight);
            const yEv = padding.top + chartHeight - (((pt.events || 0) / maxTimelineValue) * chartHeight);
            pointsPv.push({ x, y: yPv, val: pt.pageviews, label: pt.label, data: pt });
            pointsUv.push({ x, y: yUv, val: pt.visitors, label: pt.label, data: pt });
            pointsEv.push({ x, y: yEv, val: pt.events || 0, label: pt.label, data: pt });
        });

        const pathPv = pointsPv.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
        const areaPv = `${pathPv} L ${pointsPv[pointsPv.length - 1].x} ${padding.top + chartHeight} L ${pointsPv[0].x} ${padding.top + chartHeight} Z`;

        const pathUv = pointsUv.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
        const areaUv = `${pathUv} L ${pointsUv[pointsUv.length - 1].x} ${padding.top + chartHeight} L ${pointsUv[0].x} ${padding.top + chartHeight} Z`;

        const pathEv = pointsEv.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

        return (
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                    <defs>
                        <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="uvGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
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
                    <path d={pathUv} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
                    <path d={pathEv} fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />

                    {/* Interactive Points and Labels */}
                    {pointsPv.map((p, i) => {
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
                                <rect
                                    x={p.x - (step / 2)}
                                    y={padding.top}
                                    width={step}
                                    height={chartHeight}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredPoint({ x: p.x, pv: p.val, uv: pointsUv[i].val, ev: pointsEv[i].val, label: p.label })}
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
                            <circle cx={hoveredPoint.x} cy={padding.top + chartHeight - ((hoveredPoint.ev / maxTimelineValue) * chartHeight)} r="3.5" fill="#fbbf24" stroke="#fff" strokeWidth="1" />
                        </g>
                    )}
                </svg>

                {/* Floating Tooltip */}
                {hoveredPoint && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: `${Math.min(Math.max(hoveredPoint.x - 60, 50), width - 190)}px`,
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.9rem',
                        fontSize: '0.75rem',
                        pointerEvents: 'none',
                        zIndex: 10,
                        backdropFilter: 'blur(8px)'
                    }}>
                        <div style={{ fontWeight: 800, color: '#fff', marginBottom: '0.3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem' }}>
                            {hoveredPoint.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                            <span>{t.pageviewsLegend}: <strong>{hoveredPoint.pv}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }}></span>
                            <span>{t.visitorsLegend}: <strong>{hoveredPoint.uv}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }}></span>
                            <span>{t.eventsLegend}: <strong>{hoveredPoint.ev}</strong></span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'inherit' }}>
            {/* Header Controls */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1.2rem 1.6rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span>📊</span>
                        <span>{t.title}</span>
                    </h2>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8', maxWidth: '750px' }}>
                        {t.subtitle}
                    </p>
                </div>

                {/* Period Buttons & Global Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['24h', '7d', '30d', 'all'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '0.45rem 0.85rem',
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

                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.2rem' }} />

                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            padding: '0.45rem 0.8rem',
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
                            padding: '0.45rem 0.8rem',
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
                            padding: '0.45rem 0.8rem',
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
                            padding: '0.45rem 0.8rem',
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
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(6, 95, 70, 0.05))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
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
                        {liveData.activePages.slice(0, 5).map((p, idx) => (
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
                                    gap: '0.4rem'
                                }}
                            >
                                <span style={{ fontFamily: 'monospace' }}>{p.path}</span>
                                <span style={{ background: '#10b981', color: '#000', borderRadius: '4px', padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 900 }}>
                                    {p.count}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* NAVIGATION TABS */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '0.5rem',
                overflowX: 'auto'
            }}>
                {[
                    { id: 'overview', label: t.tabOverview },
                    { id: 'audit', label: t.tabAudit },
                    { id: 'events', label: t.tabEvents },
                    { id: 'funnel', label: t.tabFunnel },
                    { id: 'traffic', label: t.tabTraffic }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        style={{
                            padding: '0.65rem 1.2rem',
                            background: subTab === tab.id ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                            border: `1px solid ${subTab === tab.id ? '#38bdf8' : 'transparent'}`,
                            borderRadius: '10px',
                            color: subTab === tab.id ? '#38bdf8' : '#94a3b8',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {subTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* 6 KEY METRICS GRID */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '1rem'
                    }}>
                        <div style={{
                            padding: '1.3rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                👥 {t.uniqueVisitors}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#38bdf8' }}>
                                {summary.uniqueVisitors.toLocaleString('tr-TR')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                                %100 AdBlock Korumalı
                            </div>
                        </div>

                        <div style={{
                            padding: '1.3rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                👁️ {t.totalPageviews}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#10b981' }}>
                                {summary.totalPageviews.toLocaleString('tr-TR')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                                Oturum Başı: {summary.totalSessions > 0 ? (summary.totalPageviews / summary.totalSessions).toFixed(1) : 0} sayfa
                            </div>
                        </div>

                        <div style={{
                            padding: '1.3rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(167, 139, 250, 0.25)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                ⏱️ {t.totalSessions}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#a78bfa' }}>
                                {summary.totalSessions.toLocaleString('tr-TR')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                                30dk Hareketsizlik Limiti
                            </div>
                        </div>

                        <div style={{
                            padding: '1.3rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(251, 191, 36, 0.25)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                📉 {t.bounceRate}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: summary.bounceRate < 45 ? '#10b981' : summary.bounceRate < 65 ? '#fbbf24' : '#ef4444' }}>
                                %{summary.bounceRate}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                                Tek sayfa &lt;12sn terk
                            </div>
                        </div>

                        <div style={{
                            padding: '1.3rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(244, 114, 182, 0.25)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                ⏳ {t.avgDuration}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#f472b6' }}>
                                {formatDuration(summary.avgDuration)}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                                Oturum Başı Ortalama
                            </div>
                        </div>

                        <div style={{
                            padding: '1.3rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(234, 179, 8, 0.25)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                ⚡ {t.totalEvents}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#eab308' }}>
                                {(summary.totalEvents || 0).toLocaleString('tr-TR')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                                <span style={{ color: '#38bdf8' }}>📱 TG: {summary.telegramClicks || 0}</span>
                                <span style={{ color: '#a78bfa' }}>💎 VIP: {summary.vipClicks || 0}</span>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24' }}>
                                    <span style={{ width: '12px', height: '3px', background: '#fbbf24', borderRadius: '2px' }}></span>
                                    <span>{t.eventsLegend}</span>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>{t.loadingText}</div>
                        ) : (
                            renderTimelineChart()
                        )}
                    </div>

                    {/* DUAL COLUMN: TOP PAGES & TRAFFIC CHANNELS */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {/* Top Pages */}
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

                        {/* Traffic Channels */}
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
                        {/* Devices */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.4rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff' }}>{t.devicesTitle}</h4>
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
                                                <span style={{ color: '#fff' }}>📱 Mobil</span>
                                                <span style={{ color: '#38bdf8', fontWeight: 700 }}>%{mobPct} ({dev.mobile})</span>
                                            </div>
                                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${mobPct}%`, height: '100%', background: '#38bdf8' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                                <span style={{ color: '#fff' }}>💻 Masaüstü</span>
                                                <span style={{ color: '#10b981', fontWeight: 700 }}>%{deskPct} ({dev.desktop})</span>
                                            </div>
                                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${deskPct}%`, height: '100%', background: '#10b981' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                                <span style={{ color: '#fff' }}>📟 Tablet</span>
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

                        {/* Browsers */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.4rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff' }}>{t.browsersTitle}</h4>
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

                        {/* Countries */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.4rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff' }}>{t.countriesTitle}</h4>
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
                </div>
            )}

            {/* TAB 2: USER AUDIT TRAIL (KILLER FEATURE) */}
            {subTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '16px',
                        padding: '1.4rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>🕵️</span>
                                    <span>{t.userAuditTitle}</span>
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.3rem 0 0 0' }}>
                                    {t.userAuditSubtitle}
                                </p>
                            </div>

                            {/* Search & Plan Filter */}
                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    placeholder={t.searchPlaceholder}
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.8rem',
                                        color: '#fff',
                                        fontSize: '0.75rem',
                                        minWidth: '220px'
                                    }}
                                />

                                <select
                                    value={userPlanFilter}
                                    onChange={(e) => setUserPlanFilter(e.target.value)}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.8rem',
                                        color: '#fff',
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    <option value="all">{t.planAll}</option>
                                    <option value="pro">{t.planPro}</option>
                                    <option value="trial">{t.planTrial}</option>
                                    <option value="guest">{t.planGuest}</option>
                                    <option value="admin">{t.planAdmin}</option>
                                </select>
                            </div>
                        </div>

                        {/* Audit Trail Sessions Table */}
                        {filteredJourneys.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                                {t.noData}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                                            <th style={{ padding: '0.7rem 0.6rem' }}>KULLANICI / KİMLİK</th>
                                            <th style={{ padding: '0.7rem 0.6rem' }}>KONUM</th>
                                            <th style={{ padding: '0.7rem 0.6rem' }}>CİHAZ / SİSTEM</th>
                                            <th style={{ padding: '0.7rem 0.6rem' }}>SÜRE & SAYFA</th>
                                            <th style={{ padding: '0.7rem 0.6rem' }}>GEZİNTİ ROTASI</th>
                                            <th style={{ padding: '0.7rem 0.6rem' }}>SON HAREKET</th>
                                            <th style={{ padding: '0.7rem 0.6rem', textAlign: 'right' }}>DENETLE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredJourneys.map((session, idx) => {
                                            const isPro = ['pro', 'premium'].includes(session.plan);
                                            const isTrial = session.plan === 'trial';
                                            const isAdmin = session.plan === 'admin';
                                            const planBadgeColor = isAdmin ? '#ef4444' : isPro ? '#f59e0b' : isTrial ? '#10b981' : '#64748b';

                                            return (
                                                <tr key={idx} style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                                    transition: 'background 0.15s'
                                                }}>
                                                    <td style={{ padding: '0.7rem 0.6rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 900,
                                                                background: `${planBadgeColor}22`,
                                                                color: planBadgeColor,
                                                                border: `1px solid ${planBadgeColor}55`,
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {session.plan || 'guest'}
                                                            </span>
                                                            <div style={{ fontWeight: 700, color: session.email ? '#38bdf8' : '#fff' }}>
                                                                {session.email || `Anonim (${session.visitorId.slice(0, 8)})`}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', whiteSpace: 'nowrap' }}>
                                                        <span style={{ fontSize: '0.95rem', marginRight: '0.3rem' }}>{session.countryFlag}</span>
                                                        <span style={{ color: '#cbd5e1' }}>{session.countryName}</span>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', color: '#94a3b8' }}>
                                                        {session.deviceType === 'mobile' ? '📱' : '💻'} {session.browser} / {session.os}
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', whiteSpace: 'nowrap' }}>
                                                        <div style={{ color: '#fff', fontWeight: 700 }}>{formatDuration(session.durationSeconds)}</div>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{session.pageviews} sayfa • {session.eventsCount} olay</div>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', maxWidth: '240px' }}>
                                                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', overflow: 'hidden' }}>
                                                            {session.paths.slice(0, 3).map((p, pIdx) => (
                                                                <span key={pIdx} style={{
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    padding: '0.15rem 0.4rem',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.68rem',
                                                                    fontFamily: 'monospace',
                                                                    color: '#38bdf8'
                                                                }}>
                                                                    {p}
                                                                </span>
                                                            ))}
                                                            {session.paths.length > 3 && (
                                                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>+{session.paths.length - 3}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem' }}>
                                                        {session.recentActions && session.recentActions.length > 0 ? (
                                                            <span style={{
                                                                fontSize: '0.68rem',
                                                                color: session.recentActions[session.recentActions.length - 1].name?.includes('vip') ? '#f59e0b' :
                                                                       session.recentActions[session.recentActions.length - 1].name?.includes('telegram') ? '#38bdf8' : '#94a3b8'
                                                            }}>
                                                                {session.recentActions[session.recentActions.length - 1].name || session.recentActions[session.recentActions.length - 1].type}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Gezinti</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => fetchUserDetail(session)}
                                                            style={{
                                                                background: 'rgba(56, 189, 248, 0.12)',
                                                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                                                borderRadius: '6px',
                                                                padding: '0.3rem 0.7rem',
                                                                color: '#38bdf8',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {t.inspectBtn}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: CUSTOM EVENTS & TELEMETRY */}
            {subTab === 'events' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Events KPI Counters */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem'
                    }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.2rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>📱 TELEGRAM BOT & KANAL TIKLAMALARI</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.3rem' }}>
                                {summary.telegramClicks || 0}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Telegram'a giden toplam kullanıcı etkileşimi</div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '16px', padding: '1.2rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>💎 VIP / PRO YÜKSELTME TIKLAMALARI</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.3rem' }}>
                                {summary.vipClicks || 0}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Abonelik paketine tıklayan sıcak adaylar</div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px', padding: '1.2rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>⚡ TOPLAM KAYITLI ETKİLEŞİM</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', marginTop: '0.3rem' }}>
                                {summary.totalEvents || 0}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Buton, filtre, modal ve scroll olayları</div>
                        </div>
                    </div>

                    {/* Events Breakdown Table */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>⚡</span>
                            <span>{t.eventsTitle}</span>
                        </h3>

                        {(!data?.eventsSummary || data.eventsSummary.length === 0) ? (
                            <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '1rem 0' }}>{t.noData}</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                                            <th style={{ padding: '0.6rem' }}>OLAY ADI (EVENT NAME)</th>
                                            <th style={{ padding: '0.6rem' }}>TOPLAM TETİKLENME</th>
                                            <th style={{ padding: '0.6rem' }}>TEKİL KULLANICI</th>
                                            <th style={{ padding: '0.6rem', textAlign: 'right' }}>SON GÖRÜLME</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.eventsSummary.map((ev, idx) => {
                                            const timeAgoSeconds = Math.max(Math.round((Date.now() - ev.lastSeen) / 1000), 0);
                                            const timeStr = timeAgoSeconds < 60 ? `${timeAgoSeconds}s önce` : `${Math.floor(timeAgoSeconds / 60)}dk önce`;

                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <td style={{ padding: '0.7rem 0.6rem' }}>
                                                        <span style={{
                                                            background: 'rgba(56, 189, 248, 0.1)',
                                                            color: '#38bdf8',
                                                            border: '1px solid rgba(56, 189, 248, 0.25)',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontFamily: 'monospace',
                                                            fontWeight: 700
                                                        }}>
                                                            {ev.name}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', color: '#10b981', fontWeight: 800 }}>
                                                        {ev.count} kez
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', color: '#fff', fontWeight: 700 }}>
                                                        {ev.uniqueVisitors} kişi
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.6rem', color: '#94a3b8', textAlign: 'right' }}>
                                                        {timeStr}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Scroll Depth Analysis */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>📜</span>
                            <span>{t.scrollTitle}</span>
                        </h3>
                        {(() => {
                            const sc = data?.scrollDepth || { '25': 0, '50': 0, '75': 0, '100': 0 };
                            const maxSc = Math.max(sc['25'], sc['50'], sc['75'], sc['100'], 1);
                            const tiers = [
                                { label: '%25 Sayfa Derinliği (Başlık & İlk Ekran)', val: sc['25'], color: '#38bdf8' },
                                { label: '%50 Sayfa Derinliği (Özellikler & Tablo)', val: sc['50'], color: '#10b981' },
                                { label: '%75 Sayfa Derinliği (Fiyatlar & VIP Paketler)', val: sc['75'], color: '#fbbf24' },
                                { label: '%100 Sayfa Derinliği (Sayfa Sonu & Footer)', val: sc['100'], color: '#a78bfa' }
                            ];

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                    {tiers.map((tItem, idx) => {
                                        const pct = Math.round((tItem.val / maxSc) * 100);
                                        return (
                                            <div key={idx}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                                                    <span style={{ color: '#fff', fontWeight: 600 }}>{tItem.label}</span>
                                                    <span style={{ color: tItem.color, fontWeight: 800 }}>{tItem.val} kişi (%{pct})</span>
                                                </div>
                                                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: tItem.color }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* TAB 4: ADVANCED CONVERSION FUNNEL */}
            {subTab === 'funnel' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '16px',
                        padding: '1.6rem'
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 1.2rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🎯</span>
                            <span>{t.funnelTitle}</span>
                        </h3>

                        {(() => {
                            const f = data?.funnel || { visitors: 0, registered: 0, engaged: 0, upgradeRequests: 0, paidUsers: 0, dropoffs: {} };
                            const base = Math.max(f.visitors, 1);

                            const steps = [
                                { label: '1. Site Ziyaretçisi', count: f.visitors, pct: 100, color: '#38bdf8', icon: '🌐', dropoff: f.dropoffs?.step1to2 },
                                { label: '2. Kayıt / Deneme Başlatan', count: f.registered, pct: Math.round((f.registered / base) * 100), color: '#10b981', icon: '📝', dropoff: f.dropoffs?.step2to3 },
                                { label: '3. Canlı Masada Aktif Kalma', count: f.engaged, pct: Math.round((f.engaged / base) * 100), color: '#fbbf24', icon: '⚡', dropoff: f.dropoffs?.step3to4 },
                                { label: '4. VIP Yükseltme Talebi', count: f.upgradeRequests, pct: Math.round((f.upgradeRequests / base) * 100), color: '#a78bfa', icon: '💎', dropoff: f.dropoffs?.step4to5 },
                                { label: '5. Aktif VIP / Pro Üye', count: f.paidUsers, pct: Math.round((f.paidUsers / base) * 100), color: '#f59e0b', icon: '👑', dropoff: 0 }
                            ];

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                                        gap: '1rem'
                                    }}>
                                        {steps.map((step, idx) => (
                                            <div key={idx} style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${step.color}44`,
                                                borderRadius: '14px',
                                                padding: '1.2rem',
                                                position: 'relative'
                                            }}>
                                                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{step.icon}</div>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', marginBottom: '0.3rem' }}>
                                                    {step.label}
                                                </div>
                                                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: step.color }}>
                                                    {step.count}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                                                    Toplam Oran: <strong>%{step.pct}</strong>
                                                </div>
                                                {step.dropoff > 0 && (
                                                    <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: '0.3rem', fontWeight: 700 }}>
                                                        ⚠️ %{step.dropoff} sonraki adıma geçmedi
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Visual Horizontal Funnel Cascade Bar */}
                                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.6rem' }}>
                                            KADEMELİ HUNİ GEÇİŞ ORANLARI
                                        </div>
                                        <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
                                            {steps.map((s, idx) => {
                                                const w = Math.max(s.pct, 3);
                                                return (
                                                    <div
                                                        key={idx}
                                                        title={`${s.label}: %${s.pct}`}
                                                        style={{
                                                            width: `${w}%`,
                                                            height: '100%',
                                                            background: s.color,
                                                            opacity: 0.85,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.65rem',
                                                            color: '#000',
                                                            fontWeight: 900
                                                        }}
                                                    >
                                                        %{s.pct}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* TAB 5: TRAFFIC & UTM CAMPAIGNS */}
            {subTab === 'traffic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Top Referrer Domains */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🔗</span>
                            <span>HARİCİ YÖNLENDİREN ALAN ADLARI (REFERRER DOMAINS)</span>
                        </h3>

                        {(!data?.topReferrers || data.topReferrers.length === 0) ? (
                            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{t.noData}</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                                {data.topReferrers.map((ref, idx) => (
                                    <div key={idx} style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '8px',
                                        padding: '0.8rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>🌐 {ref.domain}</span>
                                        <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '0.85rem' }}>{ref.count} hit</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* UTM Campaigns Table */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🎯</span>
                            <span>{t.campaignsTitle}</span>
                        </h3>

                        {(!data?.topCampaigns || data.topCampaigns.length === 0) ? (
                            <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '1rem 0' }}>
                                Henüz UTM etiketli bağlantı (utm_source, utm_campaign) üzerinden ziyaretçi gelmedi.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                                            <th style={{ padding: '0.6rem' }}>UTM SOURCE</th>
                                            <th style={{ padding: '0.6rem' }}>UTM CAMPAIGN</th>
                                            <th style={{ padding: '0.6rem' }}>MEDIUM</th>
                                            <th style={{ padding: '0.6rem' }}>SAYFA GÖRÜNTÜLEME</th>
                                            <th style={{ padding: '0.6rem', textAlign: 'right' }}>TEKİL ZİYARETÇİ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topCampaigns.map((c, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '0.7rem 0.6rem', color: '#38bdf8', fontWeight: 700 }}>{c.source}</td>
                                                <td style={{ padding: '0.7rem 0.6rem', color: '#fff', fontWeight: 600 }}>{c.campaign}</td>
                                                <td style={{ padding: '0.7rem 0.6rem', color: '#94a3b8' }}>{c.medium}</td>
                                                <td style={{ padding: '0.7rem 0.6rem', color: '#10b981', fontWeight: 800 }}>{c.views}</td>
                                                <td style={{ padding: '0.7rem 0.6rem', color: '#fbbf24', fontWeight: 800, textAlign: 'right' }}>{c.visitors}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: SINGLE USER SESSION CHRONOLOGY INSPECTOR */}
            {inspectingSession && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: '#0b1329',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '850px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.2rem 1.6rem',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span>🕵️</span>
                                    <span>{t.inspectorTitle}</span>
                                </h3>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                    Oturum ID: <span style={{ fontFamily: 'monospace', color: '#fff' }}>{inspectingSession.sessionId}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setInspectingSession(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                ✕ {t.inspectorClose}
                            </button>
                        </div>

                        {/* Modal Profile Info Card */}
                        <div style={{
                            padding: '1rem 1.6rem',
                            background: 'rgba(56, 189, 248, 0.05)',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            gap: '1.5rem',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            fontSize: '0.8rem'
                        }}>
                            <div>
                                <span style={{ color: '#64748b' }}>Kullanıcı / Plan: </span>
                                <strong style={{ color: '#fff' }}>{inspectingSession.email || 'Anonim'}</strong>
                                <span style={{ marginLeft: '0.4rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>
                                    ({inspectingSession.plan})
                                </span>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Konum: </span>
                                <strong style={{ color: '#fff' }}>{inspectingSession.countryFlag} {inspectingSession.countryName}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Cihaz: </span>
                                <strong style={{ color: '#fff' }}>{inspectingSession.deviceType} / {inspectingSession.browser}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Toplam Süre: </span>
                                <strong style={{ color: '#10b981' }}>{formatDuration(inspectingSession.durationSeconds)}</strong>
                            </div>
                        </div>

                        {/* Modal Body: Chronological Timeline Stream */}
                        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                            {inspectingLoading ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>{t.loadingText}</div>
                            ) : !inspectingDetail || inspectingDetail.events.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Olay detayı bulunamadı.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', position: 'relative' }}>
                                    {/* Connecting vertical line */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '15px',
                                        bottom: '15px',
                                        left: '19px',
                                        width: '2px',
                                        background: 'rgba(56, 189, 248, 0.2)',
                                        zIndex: 1
                                    }} />

                                    {inspectingDetail.events.map((ev, evIdx) => {
                                        const d = new Date(ev.time);
                                        const timeFormatted = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                        const isPage = ev.type === 'pageview';
                                        const isEvent = ev.type === 'event';
                                        const dotColor = isPage ? '#10b981' : isEvent ? '#fbbf24' : '#38bdf8';

                                        return (
                                            <div key={evIdx} style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                alignItems: 'flex-start',
                                                position: 'relative',
                                                zIndex: 2
                                            }}>
                                                {/* Bullet Icon */}
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: '#0f172a',
                                                    border: `2px solid ${dotColor}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.85rem',
                                                    flexShrink: 0
                                                }}>
                                                    {isPage ? '📄' : isEvent ? '⚡' : '💓'}
                                                </div>

                                                {/* Action Details Card */}
                                                <div style={{
                                                    flex: 1,
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '10px',
                                                    padding: '0.7rem 1rem',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                                        <span style={{
                                                            fontWeight: 800,
                                                            color: dotColor,
                                                            textTransform: 'uppercase',
                                                            fontSize: '0.7rem'
                                                        }}>
                                                            {isPage ? 'SAYFA AÇILIŞI' : isEvent ? (ev.name || 'ÖZEL OLAY') : 'CANLI KALMA'}
                                                        </span>
                                                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                            {timeFormatted}
                                                        </span>
                                                    </div>

                                                    <div style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                        {ev.path}
                                                    </div>

                                                    {ev.title && (
                                                        <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                                                            {ev.title}
                                                        </div>
                                                    )}

                                                    {ev.data && Object.keys(ev.data).length > 0 && (
                                                        <div style={{
                                                            marginTop: '0.4rem',
                                                            padding: '0.4rem 0.6rem',
                                                            background: 'rgba(0,0,0,0.3)',
                                                            borderRadius: '6px',
                                                            fontSize: '0.7rem',
                                                            color: '#e2e8f0',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {JSON.stringify(ev.data)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
