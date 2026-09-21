import React, { useState, useEffect, useCallback } from 'react';

export const AuditCockpit = ({
    lang = 'tr',
    proxyBase = '',
    getAdminHeaders = () => ({}),
    onRefreshRequest = null
}) => {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const [auditData, setAuditData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [statusFeedback, setStatusFeedback] = useState({ type: '', message: '' });
    const [showAbuseModal, setShowAbuseModal] = useState(false);

    const t = {
        title: isTr ? 'İÇ DENETİM & KONTROL KULESİ' : isDe ? 'INTERNES AUDIT & KONTROLLTURM' : 'INTERNAL AUDIT & WATCHDOG COCKPIT',
        healthScore: isTr ? 'SİSTEM SAĞLIK PUANI' : isDe ? 'SYSTEM-GESUNDHEIT' : 'SYSTEM HEALTH SCORE',
        dataSla: isTr ? 'CANLI VERİ SLA' : isDe ? 'LIVE-DATEN SLA' : 'LIVE DATA SLA',
        signalEngine: isTr ? 'SİNYAL MOTORU' : isDe ? 'SIGNAL-ENGINE' : 'SIGNAL ENGINE',
        supportSla: isTr ? 'CANLI DESTEK SLA' : isDe ? 'SUPPORT-SLA' : 'SUPPORT SLA',
        fraudHunter: isTr ? 'DENEME KAÇAK AVCISI' : isDe ? 'TESTPHASEN-SCHUTZ' : 'TRIAL FRAUD HUNTER',
        killSwitchActive: isTr ? '🛑 SİNYAL KİLİDİ DEVREDE' : isDe ? '🛑 SIGNAL-STOPP AKTIV' : '🛑 KILL-SWITCH ACTIVE',
        killSwitchOff: isTr ? '🟢 SİNYALLER YAYINDA' : isDe ? '🟢 SIGNALE LIVE' : '🟢 SIGNALS LIVE',
        btnHalt: isTr ? '🛑 ACİL SİNYAL DURDUR' : isDe ? '🛑 NOT-STOPP SIGNALE' : '🛑 EMERGENCY HALT SIGNALS',
        btnResume: isTr ? '▶️ SİNYALLERİ BAŞLAT' : isDe ? '▶️ SIGNALE STARTEN' : '▶️ RESUME SIGNALS',
        btnClearLocks: isTr ? '🔄 KİLİTLERİ SIFIRLA' : isDe ? '🔄 SPERREN ZURÜCKSETZEN' : '🔄 RESET LOCKS',
        btnViewAbuse: isTr ? '🛡️ KAÇAK DENETİMİ' : isDe ? '🛡️ MISSBRAUCHS-LOG' : '🛡️ FRAUD LOG',
        staleAlert: isTr ? '⚠️ KRİTİK VERİ UYARISI: SofaScore veri akışı durdu! Sinyal gönderimi otomatik donduruldu.' : isDe ? '⚠️ KRITISCHE WARNUNG: SofaScore-Datenfluss gestoppt!' : '⚠️ CRITICAL ALERT: Live data feed stalled! Signal engine safely halted.',
        haltAlert: isTr ? '🛑 ACİL DURUM FRENİ DEVREDE: Yönetici sinyal üretimini manuel olarak askıya aldı.' : isDe ? '🛑 NOTFALL-STOPP AKTIV: Manuell angehalten.' : '🛑 EMERGENCY HALT ACTIVE: Admin manually suspended signal generation.',
        liveMatches: isTr ? 'Canlı Maç' : isDe ? 'Live-Spiele' : 'Live Matches',
        secondsAgo: isTr ? 'sn önce' : isDe ? 'Sek. her' : 's ago',
        lockedMatches: isTr ? 'Kilitli Maç' : isDe ? 'Gesperrte Spiele' : 'Locked Matches',
        waitingTickets: isTr ? 'Yanıtsız Destek' : isDe ? 'Offene Tickets' : 'Pending Support',
        blockedAttempts: isTr ? 'Engellenen Cihaz' : isDe ? 'Blockierte Versuche' : 'Blocked Devices',
        modalTitle: isTr ? '🛡️ Engellenen Sahte Deneme Üyelikleri (Çoklu Cihaz / IP)' : isDe ? '🛡️ Blockierte Testversuche' : '🛡️ Blocked Multi-Account Trial Farming',
        close: isTr ? 'Kapat' : isDe ? 'Schließen' : 'Close',
        clearLogs: isTr ? 'Kayıtları Temizle' : isDe ? 'Logs löschen' : 'Clear Logs',
        noAbuse: isTr ? 'Son dönemde engellenen şüpheli kaçak kaydı bulunmuyor.' : isDe ? 'Keine verdächtigen Versuche gefunden.' : 'No suspicious trial farming attempts detected.',
        healthy: isTr ? 'STABİL' : isDe ? 'STABIL' : 'STABLE',
        warning: isTr ? 'UYARI' : isDe ? 'WARNUNG' : 'WARNING',
        critical: isTr ? 'KRİTİK' : isDe ? 'KRITISCH' : 'CRITICAL'
    };

    const fetchCockpitData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const base = proxyBase || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com'));

            const res = await fetch(`${base}/api/admin/audit-cockpit`, {
                headers: getAdminHeaders()
            });

            if (res.ok) {
                const data = await res.json();
                setAuditData(data);
            }
        } catch (e) {
            console.warn('[AUDIT_COCKPIT] Fetch error:', e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [proxyBase, getAdminHeaders]);

    // Initial load and periodic polling every 12 seconds
    useEffect(() => {
        fetchCockpitData(false);
        const interval = setInterval(() => {
            fetchCockpitData(true);
        }, 12000);
        return () => clearInterval(interval);
    }, [fetchCockpitData]);

    const executeAction = async (action, payload = {}) => {
        setActionLoading(true);
        setStatusFeedback({ type: '', message: '' });
        try {
            const base = proxyBase || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com'));

            const res = await fetch(`${base}/api/admin/audit-cockpit/action`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ action, payload })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setStatusFeedback({ type: 'success', message: data.message });
                fetchCockpitData(true);
                if (onRefreshRequest) onRefreshRequest();
            } else {
                setStatusFeedback({ type: 'error', message: data.error || 'İşlem başarısız oldu.' });
            }
        } catch (e) {
            setStatusFeedback({ type: 'error', message: e.message || 'Bağlantı hatası.' });
        } finally {
            setActionLoading(false);
        }
    };

    if (!auditData && loading) {
        return (
            <div style={{
                padding: '1.2rem',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                marginBottom: '1.5rem',
                color: '#94a3b8',
                fontSize: '0.85rem'
            }}>
                ⚡ {t.title} yükleniyor...
            </div>
        );
    }

    if (!auditData) return null;

    const { healthScore = 100, dataSla = {}, signalEngine = {}, supportSla = {}, securityAndAbuse = {} } = auditData;

    const isHalted = Boolean(signalEngine?.emergencyHalt);
    const isDataStale = Boolean(dataSla?.isStale);

    // Color definitions for traffic lights
    const getStatusColor = (status) => {
        if (status === 'HEALTHY') return '#10b981';
        if (status === 'WARNING') return '#f59e0b';
        return '#ef4444';
    };

    const healthBadgeColor = healthScore >= 85 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{
            marginBottom: '2rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(10, 15, 29, 0.95))',
            border: `1px solid ${isHalted || isDataStale ? '#ef4444' : 'rgba(56, 189, 248, 0.3)'}`,
            borderRadius: '14px',
            padding: '1.5rem',
            boxShadow: isHalted || isDataStale
                ? '0 0 25px rgba(239, 68, 68, 0.25)'
                : '0 8px 32px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Top Command Line */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.2rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: healthBadgeColor,
                        boxShadow: `0 0 10px ${healthBadgeColor}`
                    }} />
                    <h3 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>🛡️</span>
                        <span>{t.title}</span>
                    </h3>
                </div>

                {/* Health Score & Quick Refresh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: `1px solid ${healthBadgeColor}`,
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: healthBadgeColor
                    }}>
                        <span>{t.healthScore}:</span>
                        <span style={{ fontSize: '1rem' }}>%{healthScore}</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            ({healthScore >= 85 ? t.healthy : healthScore >= 60 ? t.warning : t.critical})
                        </span>
                    </div>

                    <button
                        onClick={() => fetchCockpitData(false)}
                        disabled={loading || actionLoading}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        🔄 {loading ? '...' : (isTr ? 'Yenile' : 'Refresh')}
                    </button>
                </div>
            </div>

            {/* Critical Alert Banners */}
            {isDataStale && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    padding: '0.8rem 1rem',
                    marginBottom: '1rem',
                    color: '#fca5a5',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                }}>
                    <span>🚨</span>
                    <span>{t.staleAlert} (SofaScore: {dataSla.sofascoreAgeSec}s)</span>
                </div>
            )}

            {isHalted && (
                <div style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '0.8rem 1rem',
                    marginBottom: '1rem',
                    color: '#fde047',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                }}>
                    <span>🛑</span>
                    <span>{t.haltAlert}</span>
                </div>
            )}

            {/* 4 Traffic Light Panels */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                {/* 1. Data Freshness SLA */}
                <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: `1px solid ${getStatusColor(dataSla.status)}`,
                    borderRadius: '10px',
                    padding: '1rem',
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>📡 {t.dataSla}</span>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: getStatusColor(dataSla.status),
                            boxShadow: `0 0 8px ${getStatusColor(dataSla.status)}`
                        }} />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', marginBottom: '0.2rem' }}>
                        {dataSla.sofascoreAgeSec !== null ? `${dataSla.sofascoreAgeSec}s` : 'N/A'}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginLeft: '0.4rem' }}>{t.secondsAgo}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        ⚽ {dataSla.liveMatchCount || 0} {t.liveMatches} | Oranlar: {dataSla.oddsAgeSec !== null ? `${dataSla.oddsAgeSec}s` : 'OK'}
                    </div>
                </div>

                {/* 2. Signal Engine & Kill-Switch Status */}
                <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: `1px solid ${isHalted ? '#ef4444' : '#10b981'}`,
                    borderRadius: '10px',
                    padding: '1rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>🤖 {t.signalEngine}</span>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: isHalted ? '#ef4444' : '#10b981',
                            boxShadow: `0 0 8px ${isHalted ? '#ef4444' : '#10b981'}`
                        }} />
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: isHalted ? '#ef4444' : '#10b981', marginBottom: '0.2rem' }}>
                        {isHalted ? t.killSwitchActive : t.killSwitchOff}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        🔒 {signalEngine.activeLocksCount || 0} {t.lockedMatches} | Sentinel: 🟢 AKTİF
                    </div>
                </div>

                {/* 3. Support Response SLA */}
                <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: `1px solid ${getStatusColor(supportSla.status)}`,
                    borderRadius: '10px',
                    padding: '1rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>🎧 {t.supportSla}</span>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: getStatusColor(supportSla.status),
                            boxShadow: `0 0 8px ${getStatusColor(supportSla.status)}`
                        }} />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: supportSla.waitingCount > 0 ? '#f59e0b' : '#10b981', marginBottom: '0.2rem' }}>
                        {supportSla.waitingCount || 0}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginLeft: '0.4rem' }}>{t.waitingTickets}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {supportSla.waitingCount > 0
                            ? `⚠️ En eski: ${Math.round((supportSla.oldestWaitingSec || 0) / 60)} dk bekliyor`
                            : '✅ Tüm talepler yanıtlandı'}
                    </div>
                </div>

                {/* 4. Trial Abuse & Fraud Defense */}
                <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: `1px solid ${securityAndAbuse.totalAbuseBlocked > 0 ? '#f59e0b' : '#10b981'}`,
                    borderRadius: '10px',
                    padding: '1rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>🛡️ {t.fraudHunter}</span>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: securityAndAbuse.totalAbuseBlocked > 0 ? '#f59e0b' : '#10b981',
                            boxShadow: `0 0 8px ${securityAndAbuse.totalAbuseBlocked > 0 ? '#f59e0b' : '#10b981'}`
                        }} />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', marginBottom: '0.2rem' }}>
                        {securityAndAbuse.totalAbuseBlocked || 0}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginLeft: '0.4rem' }}>{t.blockedAttempts}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        📱 {securityAndAbuse.totalDeviceTrials || 0} Cihaz İmzası Kayıtlı
                    </div>
                </div>
            </div>

            {/* Emergency Action Bar */}
            <div style={{
                display: 'flex',
                gap: '0.8rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginRight: '0.5rem' }}>
                    ⚡ {isTr ? 'ACİL MÜDAHALE:' : 'EMERGENCY ACTIONS:'}
                </span>

                {/* Kill Switch Toggle */}
                <button
                    onClick={() => executeAction('toggle_kill_switch')}
                    disabled={actionLoading}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: isHalted
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: isHalted ? '0 0 15px rgba(16, 185, 129, 0.3)' : '0 0 15px rgba(239, 68, 68, 0.3)'
                    }}
                >
                    {isHalted ? t.btnResume : t.btnHalt}
                </button>

                {/* Reset Match Locks */}
                <button
                    onClick={() => executeAction('clear_locks')}
                    disabled={actionLoading}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid #38bdf8',
                        borderRadius: '8px',
                        color: '#38bdf8',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {t.btnClearLocks}
                </button>

                {/* View Trial Abuse Logs */}
                <button
                    onClick={() => setShowAbuseModal(true)}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        borderRadius: '8px',
                        color: '#f59e0b',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {t.btnViewAbuse} ({securityAndAbuse.totalAbuseBlocked || 0})
                </button>

                {/* Action Feedback Message */}
                {statusFeedback.message && (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: statusFeedback.type === 'success' ? '#10b981' : '#ef4444',
                        marginLeft: 'auto'
                    }}>
                        {statusFeedback.message}
                    </span>
                )}
            </div>

            {/* Abuse Log Modal */}
            {showAbuseModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '2rem',
                        maxWidth: '700px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        boxShadow: '0 0 30px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b' }}>
                                {t.modalTitle}
                            </h4>
                            <button
                                onClick={() => setShowAbuseModal(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '1.2rem',
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {(!securityAndAbuse.recentLogs || securityAndAbuse.recentLogs.length === 0) ? (
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
                                {t.noAbuse}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {securityAndAbuse.recentLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(245, 158, 11, 0.25)',
                                            borderRadius: '8px',
                                            padding: '0.8rem 1rem',
                                            fontSize: '0.8rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#f8fafc', marginBottom: '0.2rem' }}>
                                                🚨 Denenen: <span style={{ color: '#ef4444' }}>{log.attemptedEmail}</span>
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                Asıl Hesap: <span style={{ color: '#38bdf8' }}>{log.originalEmail}</span> | IP: {log.ip || '-'}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                                                Tarih: {new Date(log.timestamp).toLocaleString()} | Cihaz: {log.deviceId?.substring(0, 16)}...
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => executeAction('remove_device_trial', { deviceId: log.deviceId })}
                                            style={{
                                                background: 'rgba(56, 189, 248, 0.1)',
                                                border: '1px solid #38bdf8',
                                                borderRadius: '6px',
                                                color: '#38bdf8',
                                                padding: '0.3rem 0.6rem',
                                                fontSize: '0.7rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isTr ? 'Cihaz Kilidini Aç' : 'Unblock Device'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <button
                                onClick={() => executeAction('clear_abuse_logs')}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid #ef4444',
                                    borderRadius: '8px',
                                    color: '#ef4444',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    fontWeight: 700
                                }}
                            >
                                {t.clearLogs}
                            </button>

                            <button
                                onClick={() => setShowAbuseModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    padding: '0.5rem 1.2rem',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                }}
                            >
                                {t.close}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditCockpit;
