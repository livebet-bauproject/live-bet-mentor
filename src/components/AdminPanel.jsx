import React, { useState, useEffect } from 'react';
import { supabase } from '../backend/supabaseClient';
import { bankrollManager } from '../logic/bankrollManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { TradingDesk } from './TradingDesk';
import { AuditCockpit } from './AuditCockpit';

const SupportStaffDesk = ({
    lang = 'tr',
    supportOperators = [],
    supportSessions = [],
    supportLoading = false,
    activeSupportSession = null,
    sessionChatLoading = false,
    adminSupportReply = '',
    setAdminSupportReply,
    replySending = false,
    supportSubTab = 'chats',
    setSupportSubTab,
    supportFilter = 'all',
    setSupportFilter,
    newOpName,
    setNewOpName,
    newOpChatId,
    setNewOpChatId,
    newOpUsername,
    setNewOpUsername,
    newOpEmail,
    setNewOpEmail,
    selectedMemberForOp,
    setSelectedMemberForOp,
    profiles = [],
    fetchSupportData,
    fetchSessionDetail,
    handleSendSupportReply,
    handleAddOperator,
    handleToggleOperator,
    handleDeleteOperator,
    handleCloseSupportSession,
    handleArchiveSupportSession = () => {},
    handleUnarchiveSupportSession = () => {},
    handleDeleteSupportSession = () => {},
    handleClearClosedSessions = () => {},
    handleGrantVipFromChat = () => {},
    targetTelegramSessionId = null
}) => {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 900 : false);
    const [mobileShowChat, setMobileShowChat] = useState(() => Boolean(targetTelegramSessionId || activeSupportSession));
    const [liveTranslatedText, setLiveTranslatedText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [extraTranslations, setExtraTranslations] = useState({});

    useEffect(() => {
        const handleResize = () => {
            setIsMobileScreen(window.innerWidth < 900);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (activeSupportSession || targetTelegramSessionId) {
            setMobileShowChat(true);
        }
    }, [activeSupportSession?.sessionId, targetTelegramSessionId]);

    // Live Debounced Translation Preview when Admin is typing in Turkish to foreign user (DE / EN)
    useEffect(() => {
        if (!activeSupportSession || !adminSupportReply.trim()) {
            setLiveTranslatedText('');
            setIsTranslating(false);
            return;
        }

        const targetLang = activeSupportSession.lang || 'tr';
        if (targetLang === 'tr') {
            setLiveTranslatedText('');
            setIsTranslating(false);
            return;
        }

        setIsTranslating(true);
        const timer = setTimeout(async () => {
            try {
                const proxyBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
                    ? 'http://localhost:3001'
                    : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

                const res = await fetch(`${proxyBase}/api/support/translate?text=${encodeURIComponent(adminSupportReply.trim())}&source=tr&target=${targetLang}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.translatedText) {
                        setLiveTranslatedText(data.translatedText);
                    }
                }
            } catch (err) {
                console.warn('[TRANSLATE] Live preview error:', err);
            } finally {
                setIsTranslating(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [adminSupportReply, activeSupportSession?.sessionId, activeSupportSession?.lang]);

    const handleTranslateSingleMessage = async (msgId, text, sourceLang) => {
        try {
            const proxyBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

            const res = await fetch(`${proxyBase}/api/support/translate?text=${encodeURIComponent(text)}&source=${sourceLang || 'auto'}&target=tr`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.translatedText) {
                    setExtraTranslations(prev => ({ ...prev, [msgId]: data.translatedText }));
                }
            }
        } catch (e) {
            console.warn('Translate error:', e);
        }
    };

    const waitingSessions = supportSessions.filter(s => s.status === 'waiting_admin');
    const activeSessions = supportSessions.filter(s => s.status === 'active');
    const closedSessions = supportSessions.filter(s => s.status === 'closed');
    const archivedSessions = supportSessions.filter(s => s.status === 'archived');

    const filteredSessions = supportSessions.filter(s => {
        if (supportFilter === 'waiting' && s.status !== 'waiting_admin') return false;
        if (supportFilter === 'active' && s.status !== 'active') return false;
        if (supportFilter === 'closed' && s.status !== 'closed') return false;
        if (supportFilter === 'archived' && s.status !== 'archived') return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const email = (s.userInfo?.email || '').toLowerCase();
            const name = (s.userInfo?.name || '').toLowerCase();
            const sId = (s.sessionId || '').toLowerCase();
            const msgMatch = (s.messages || []).some(m => (m.text || '').toLowerCase().includes(q));
            return email.includes(q) || name.includes(q) || sId.includes(q) || msgMatch;
        }

        return true;
    });

    const quickTemplates = isTr ? [
        "👋 Merhaba! Size nasıl yardımcı olabilirim?",
        "💎 VIP PRO üyelik ücretimiz aylık 29€'dur. Kredi kartı veya kripto ile anında açılır.",
        "🚀 3 Günlük ücretsiz denemeniz hesabınıza tanımlandı. Bol kazançlar!",
        "💳 Havale/EFT bilgisi: Garanti BBVA IBAN: TR..."
    ] : isDe ? [
        "👋 Hallo! Wie kann ich Ihnen behilflich sein?",
        "💎 VIP PRO Pass kostet 29€ / Monat (inkl. aller Live-xG-Radare).",
        "🚀 Ihr 3-Tage-Kostenlos-Test wurde freigeschaltet. Viel Erfolg!",
        "💳 Für Banküberweisung kontaktieren Sie uns bitte hier."
    ] : [
        "👋 Hello! How may I assist you today?",
        "💎 VIP PRO Monthly Pass is 29€ / mo (instant activation via Card / Crypto).",
        "🚀 Your 3-Day complimentary trial pass is active. Good luck!",
        "💳 Wire / Bank transfer details requested."
    ];

    return (
        <div style={{ maxWidth: '1200px' }}>
            {/* Header Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1.2rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(56, 189, 248, 0.08))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>🎧</span>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>
                            {isTr ? 'CANLI DESTEK MASASI & PERSONEL YÖNETİMİ' : (isDe ? 'LIVE-SUPPORT & MITARBEITER' : 'LIVE SUPPORT DESK & STAFF')}
                        </span>
                        {waitingSessions.length > 0 && (
                            <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                fontSize: '0.7rem',
                                fontWeight: 900,
                                background: '#ef4444',
                                color: '#fff'
                            }}>
                                ⚠️ {waitingSessions.length} {isTr ? 'YANIT BEKLİYOR' : (isDe ? 'WARTET' : 'WAITING')}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.3rem' }}>
                        {isTr
                            ? 'Web sitesindeki müşteri sohbetlerini anlık izleyin, cevaplayın ve Telegram üzerinden cevap verebilecek personeller atayın.'
                            : 'Monitor web live chats, reply in real-time, and manage support operators with Telegram bridge.'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                        onClick={() => setSupportSubTab('chats')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: supportSubTab === 'chats' ? '#10b981' : 'rgba(255,255,255,0.05)',
                            color: supportSubTab === 'chats' ? '#000' : '#e2e8f0',
                            border: `1px solid ${supportSubTab === 'chats' ? '#10b981' : 'rgba(255,255,255,0.1)'}`
                        }}
                    >
                        💬 {isTr ? 'Canlı Sohbetler' : 'Live Chats'} ({supportSessions.length})
                    </button>
                    <button
                        onClick={() => setSupportSubTab('operators')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: supportSubTab === 'operators' ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                            color: supportSubTab === 'operators' ? '#000' : '#e2e8f0',
                            border: `1px solid ${supportSubTab === 'operators' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`
                        }}
                    >
                        👥 {isTr ? 'Destek Personeli' : 'Support Staff'} ({supportOperators.length})
                    </button>
                    <button
                        onClick={fetchSupportData}
                        disabled={supportLoading}
                        style={{
                            padding: '0.5rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)'
                        }}
                    >
                        {supportLoading ? '...' : '🔄'}
                    </button>
                </div>
            </div>

            {/* SUBTAB 1: LIVE CHATS & SESSIONS */}
            {supportSubTab === 'chats' && (
                <div>
                    {/* Filter Pills & Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {[
                                { key: 'all', label: isTr ? `Tümü (${supportSessions.length})` : `All (${supportSessions.length})` },
                                { key: 'waiting', label: `🟡 ${isTr ? 'Yanıt Bekleyenler' : 'Waiting'} (${waitingSessions.length})` },
                                { key: 'active', label: `🟢 ${isTr ? 'Aktif' : 'Active'} (${activeSessions.length})` },
                                { key: 'closed', label: `⚪ ${isTr ? 'Çözüldü' : 'Closed'} (${closedSessions.length})` },
                                { key: 'archived', label: `📁 ${isTr ? 'Arşiv' : 'Archived'} (${archivedSessions.length})` }
                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setSupportFilter(f.key)}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: '20px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background: supportFilter === f.key ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                                        color: supportFilter === f.key ? '#38bdf8' : '#94a3b8',
                                        border: `1px solid ${supportFilter === f.key ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`
                                    }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {(closedSessions.length > 0 || archivedSessions.length > 0) && (
                            <button
                                onClick={handleClearClosedSessions}
                                style={{
                                    padding: '0.35rem 0.8rem',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                }}
                                title={isTr ? 'Çözülmüş ve arşivlenmiş tüm sohbetleri kalıcı olarak siler' : 'Permanently remove closed and archived sessions'}
                            >
                                🧹 {isTr ? 'Eskileri Temizle' : 'Clear Old'}
                            </button>
                        )}
                    </div>

                    {/* Master-Detail Split Grid */}
                    <div style={{
                        display: isMobileScreen ? 'block' : 'grid',
                        gridTemplateColumns: isMobileScreen ? '1fr' : 'minmax(300px, 380px) 1fr',
                        gap: '1.2rem',
                        alignItems: 'start'
                    }}>
                        {/* Left: Session List */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.6)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: '1rem',
                            maxHeight: isMobileScreen ? 'none' : '620px',
                            overflowY: 'auto',
                            display: (isMobileScreen && mobileShowChat && activeSupportSession) ? 'none' : 'block'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.8rem', textTransform: 'uppercase' }}>
                                {isTr ? 'Sohbet Oturumları' : 'Chat Sessions'} ({filteredSessions.length})
                            </div>

                            {/* Live Search Box for Audit & Past History */}
                            <div style={{ marginBottom: '0.8rem' }}>
                                <input
                                    type="text"
                                    placeholder={isTr ? "🔍 Kullanıcı, e-posta veya mesaj ara..." : "🔍 Search user, email or message..."}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.45rem 0.75rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '0.75rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {filteredSessions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                                    {isTr ? 'Bu filtreye uygun aktif sohbet oturumu bulunamadı.' : 'No chat sessions match this filter.'}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {filteredSessions.map(sess => {
                                        const isSelected = activeSupportSession?.sessionId === sess.sessionId;
                                        const isWaiting = sess.status === 'waiting_admin';
                                        const isTargetFromTelegram = Boolean(targetTelegramSessionId && sess.sessionId === targetTelegramSessionId);
                                        const isMember = Boolean(
                                            sess.userInfo?.isMember || 
                                            (sess.userInfo?.email && !sess.userInfo?.email.toLowerCase().includes('ziyaretci') && sess.userInfo?.email !== 'Misafir')
                                        );
                                        const isMobile = sess.userInfo?.device?.isMobile;

                                        return (
                                            <div
                                                key={sess.sessionId}
                                                onClick={() => {
                                                    fetchSessionDetail(sess.sessionId);
                                                    if (isMobileScreen) setMobileShowChat(true);
                                                }}
                                                style={{
                                                    padding: '0.8rem',
                                                    borderRadius: '8px',
                                                    background: isTargetFromTelegram
                                                        ? (isSelected ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.1)')
                                                        : (isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)'),
                                                    border: isTargetFromTelegram
                                                        ? '2px solid #f59e0b'
                                                        : `1px solid ${isSelected ? '#38bdf8' : isWaiting ? '#fbbf24' : 'rgba(255,255,255,0.06)'}`,
                                                    boxShadow: isTargetFromTelegram ? '0 0 12px rgba(245, 158, 11, 0.35)' : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {/* Top row: Target badge if from telegram, or status badge */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <span style={{ fontSize: '0.85rem' }}>{isMember ? '👑' : '🌐'}</span>
                                                        <span style={{
                                                            fontSize: '0.62rem',
                                                            fontWeight: 900,
                                                            padding: '0.12rem 0.4rem',
                                                            borderRadius: '4px',
                                                            background: isMember ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                                                            color: isMember ? '#fbbf24' : '#94a3b8',
                                                            border: `1px solid ${isMember ? 'rgba(245, 158, 11, 0.4)' : 'rgba(148, 163, 184, 0.25)'}`
                                                        }}>
                                                            {isMember ? (isTr ? 'KAYITLI ÜYE' : 'MEMBER') : (isTr ? 'MİSAFİR' : 'GUEST')}
                                                        </span>
                                                        {isTargetFromTelegram && (
                                                            <span style={{
                                                                fontSize: '0.6rem',
                                                                fontWeight: 900,
                                                                padding: '0.12rem 0.4rem',
                                                                borderRadius: '4px',
                                                                background: '#f59e0b',
                                                                color: '#000',
                                                                letterSpacing: '0.3px'
                                                            }}>
                                                                🎯 TELEGRAM
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span style={{
                                                        fontSize: '0.62rem',
                                                        fontWeight: 800,
                                                        padding: '0.15rem 0.45rem',
                                                        borderRadius: '6px',
                                                        background: isWaiting
                                                            ? 'rgba(251, 191, 36, 0.2)'
                                                            : sess.status === 'closed'
                                                            ? 'rgba(100, 116, 139, 0.2)'
                                                            : sess.status === 'archived'
                                                            ? 'rgba(167, 139, 250, 0.2)'
                                                            : 'rgba(16, 185, 129, 0.2)',
                                                        color: isWaiting
                                                            ? '#fbbf24'
                                                            : sess.status === 'closed'
                                                            ? '#94a3b8'
                                                            : sess.status === 'archived'
                                                            ? '#a78bfa'
                                                            : '#10b981',
                                                        border: `1px solid ${
                                                            isWaiting
                                                                ? '#fbbf24'
                                                                : sess.status === 'closed'
                                                                ? '#94a3b8'
                                                                : sess.status === 'archived'
                                                                ? '#a78bfa'
                                                                : '#10b981'
                                                        }`
                                                    }}>
                                                        {isWaiting
                                                            ? (isTr ? 'YANIT BEKLİYOR' : 'WAITING')
                                                            : sess.status === 'closed'
                                                            ? (isTr ? 'ÇÖZÜLDÜ' : 'CLOSED')
                                                            : sess.status === 'archived'
                                                            ? (isTr ? 'ARŞİV' : 'ARCHIVED')
                                                            : (isTr ? 'AKTİF' : 'ACTIVE')}
                                                    </span>
                                                </div>

                                                {/* Customer identifier */}
                                                <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#fff', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {sess.userInfo?.email || sess.userInfo?.name || (isTr ? `Ziyaretçi #${sess.sessionId.substring(sess.sessionId.length - 6)}` : `Guest #${sess.sessionId.substring(sess.sessionId.length - 6)}`)}
                                                </div>

                                                {/* Meta badges: Language, Plan, Device */}
                                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                                        {(sess.lang || 'tr').toUpperCase()}
                                                    </span>
                                                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: isMember ? '#fbbf24' : '#94a3b8' }}>
                                                        {sess.userInfo?.plan || (isMember ? 'PRO' : 'Misafir')}
                                                    </span>
                                                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                                        {isMobile ? '📱 Mobil' : '💻 Masaüstü'}
                                                    </span>
                                                    <span style={{ opacity: 0.6, marginLeft: 'auto' }}>
                                                        #{sess.sessionId.substring(sess.sessionId.length - 6)}
                                                    </span>
                                                </div>

                                                {sess.lastMessage && (
                                                    <div style={{
                                                        fontSize: '0.72rem',
                                                        color: sess.lastMessage.sender === 'user' ? '#38bdf8' : '#cbd5e1',
                                                        fontStyle: 'italic',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        "{sess.lastMessage.text}"
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Live Chat Window */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.6)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: isMobileScreen ? '0.85rem' : '1.2rem',
                            display: (isMobileScreen && (!mobileShowChat || !activeSupportSession)) ? 'none' : 'flex',
                            flexDirection: 'column',
                            minHeight: '500px'
                        }}>
                            {/* Mobile Back to Sessions Button */}
                            {isMobileScreen && activeSupportSession && (
                                <button
                                    type="button"
                                    onClick={() => setMobileShowChat(false)}
                                    style={{
                                        alignSelf: 'flex-start',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.45rem 0.85rem',
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        color: '#38bdf8',
                                        fontWeight: 800,
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        marginBottom: '0.9rem'
                                    }}
                                >
                                    <span>←</span>
                                    <span>{isTr ? 'Tüm Sohbetler Listesine Dön' : 'Back to Sessions List'}</span>
                                    <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>({filteredSessions.length})</span>
                                </button>
                            )}

                            {!activeSupportSession ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flex: 1,
                                    color: '#64748b',
                                    textAlign: 'center',
                                    gap: '1rem',
                                    padding: '3rem'
                                }}>
                                    <span style={{ fontSize: '2.5rem' }}>💬</span>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>
                                        {isTr ? 'Sohbet Ayrıntıları' : 'Chat Details'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', maxWidth: '320px' }}>
                                        {isTr
                                            ? 'Müşteriyle canlı yazışmaları görmek veya yanıt vermek için sol listeden bir oturum seçin.'
                                            : 'Select a chat session from the list on the left to read messages and reply.'}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
                                    {/* High-visibility Target Banner if opened from Telegram */}
                                    {targetTelegramSessionId && activeSupportSession.sessionId === targetTelegramSessionId && (
                                        <div style={{
                                            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))',
                                            border: '1px solid #f59e0b',
                                            borderRadius: '8px',
                                            padding: '0.7rem 1rem',
                                            marginBottom: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.8rem',
                                            boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                                                <div>
                                                    <div style={{ fontWeight: 900, fontSize: '0.82rem', color: '#fef08a' }}>
                                                        {isTr ? 'TELEGRAM BİLDİRİMİNDEN BAĞLANILDI' : 'CONNECTED VIA TELEGRAM NOTIFICATION'}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#fde047', opacity: 0.9 }}>
                                                        {isTr ? 'Telegram botunuza mesaj atan müşteri bu kişidir. Doğrudan bu ekrandan yazışabilirsiniz.' : 'Directly replying to the user who triggered the Telegram bot notification.'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#000', fontWeight: 900, padding: '0.2rem 0.5rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                                {isTr ? 'DOĞRU KİŞİ SEÇİLDİ ✓' : 'TARGET MATCHED ✓'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Active Session Header with Details and Actions */}
                                    {(() => {
                                        const isMember = Boolean(
                                            activeSupportSession.userInfo?.isMember || 
                                            (activeSupportSession.userInfo?.email && !activeSupportSession.userInfo?.email.toLowerCase().includes('ziyaretci') && activeSupportSession.userInfo?.email !== 'Misafir')
                                        );
                                        const isMobile = activeSupportSession.userInfo?.device?.isMobile;

                                        return (
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                paddingBottom: '0.8rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                                marginBottom: '1rem',
                                                flexWrap: 'wrap',
                                                gap: '0.8rem'
                                            }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '1.1rem' }}>{isMember ? '👑' : '🌐'}</span>
                                                        <span style={{ fontWeight: 900, fontSize: '1rem', color: '#fff' }}>
                                                            {activeSupportSession.userInfo?.email || activeSupportSession.userInfo?.name || (isTr ? 'Misafir Müşteri' : 'Guest Visitor')}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontWeight: 800,
                                                            background: isMember ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                                                            color: isMember ? '#fbbf24' : '#94a3b8',
                                                            border: `1px solid ${isMember ? 'rgba(245, 158, 11, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`
                                                        }}>
                                                            {isMember ? (isTr ? 'KAYITLI ÜYE' : 'MEMBER') : (isTr ? 'MİSAFİR (Üye Girişi Yok)' : 'GUEST')}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontWeight: 800,
                                                            background: 'rgba(56, 189, 248, 0.15)',
                                                            color: '#38bdf8',
                                                            border: '1px solid rgba(56, 189, 248, 0.3)'
                                                        }}>
                                                            {activeSupportSession.userInfo?.plan || (isMember ? 'PRO' : 'Misafir')}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: '4px',
                                                            background: 'rgba(255,255,255,0.05)',
                                                            color: '#cbd5e1'
                                                        }}>
                                                            {isMobile ? '📱 Mobil Cihaz' : '💻 Masaüstü / PC'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.35rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                        <span>Oturum: <code style={{ color: '#38bdf8' }}>{activeSupportSession.sessionId}</code></span>
                                                        <span>•</span>
                                                        <span>Dil: <strong>{(activeSupportSession.lang || 'tr').toUpperCase()}</strong></span>
                                                        <span>•</span>
                                                        <span>Durum: <strong style={{ color: activeSupportSession.status === 'closed' ? '#94a3b8' : activeSupportSession.status === 'archived' ? '#a78bfa' : '#10b981' }}>
                                                            {activeSupportSession.status === 'closed' ? 'Çözüldü' : activeSupportSession.status === 'archived' ? 'Arşiv' : 'Aktif'}
                                                        </strong></span>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {/* Quick VIP Buttons */}
                                                    <button
                                                        onClick={() => handleGrantVipFromChat(activeSupportSession.sessionId, 30, 'pro')}
                                                        title={isTr ? 'Bu müşteriye anında 30 Gün VIP tanımlar ve sohbete kutlama mesajı geçer' : 'Grant 30 Days VIP'}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10b981',
                                                            border: '1px solid #10b981'
                                                        }}
                                                    >
                                                        💎 +30G VIP
                                                    </button>
                                                    <button
                                                        onClick={() => handleGrantVipFromChat(activeSupportSession.sessionId, 3, 'trial')}
                                                        title={isTr ? '3 Günlük Deneme Paketi tanımlar' : 'Grant 3 Days Trial'}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer',
                                                            background: 'rgba(56, 189, 248, 0.15)',
                                                            color: '#38bdf8',
                                                            border: '1px solid #38bdf8'
                                                        }}
                                                    >
                                                        🚀 +3G Deneme
                                                    </button>

                                                    {/* Archive / Unarchive */}
                                                    {activeSupportSession.status === 'archived' ? (
                                                        <button
                                                            onClick={() => handleUnarchiveSupportSession(activeSupportSession.sessionId)}
                                                            style={{
                                                                padding: '0.35rem 0.65rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.68rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                background: 'rgba(167, 139, 250, 0.15)',
                                                                color: '#a78bfa',
                                                                border: '1px solid #a78bfa'
                                                            }}
                                                            title={isTr ? 'Arşivden çıkar ve aktife al' : 'Unarchive session'}
                                                        >
                                                            🔄 Arşivden Çıkar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleArchiveSupportSession(activeSupportSession.sessionId)}
                                                            style={{
                                                                padding: '0.35rem 0.65rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.68rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                color: '#cbd5e1',
                                                                border: '1px solid rgba(255, 255, 255, 0.2)'
                                                            }}
                                                            title={isTr ? 'Sohbeti arşive kaldır' : 'Archive session'}
                                                        >
                                                            📁 Arşivle
                                                        </button>
                                                    )}

                                                    {/* Close / Resolve */}
                                                    <button
                                                        onClick={() => handleCloseSupportSession(activeSupportSession.sessionId)}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            background: activeSupportSession.status === 'closed' ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.15)',
                                                            color: activeSupportSession.status === 'closed' ? '#94a3b8' : '#ef4444',
                                                            border: '1px solid currentColor'
                                                        }}
                                                        title={activeSupportSession.status === 'closed' ? 'Zaten Çözüldü' : 'Oturumu Kapat / Çözüldü'}
                                                    >
                                                        {activeSupportSession.status === 'closed' ? '✓ Çözüldü' : '🔒 Kapat'}
                                                    </button>

                                                    {/* Delete session */}
                                                    <button
                                                        onClick={() => handleDeleteSupportSession(activeSupportSession.sessionId)}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)'
                                                        }}
                                                        title={isTr ? 'Bu sohbeti tamamen sil' : 'Delete chat session'}
                                                    >
                                                        🗑️ Sil
                                                    </button>

                                                    {/* Refresh */}
                                                    <button
                                                        onClick={() => fetchSessionDetail(activeSupportSession.sessionId)}
                                                        disabled={sessionChatLoading}
                                                        style={{
                                                            padding: '0.35rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            background: 'rgba(255,255,255,0.05)',
                                                            color: '#38bdf8',
                                                            border: '1px solid #38bdf8'
                                                        }}
                                                        title="Yenile"
                                                    >
                                                        {sessionChatLoading ? '...' : '🔄'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Messages Box */}
                                    <div style={{
                                        flex: 1,
                                        maxHeight: '380px',
                                        minHeight: '260px',
                                        overflowY: 'auto',
                                        padding: '0.8rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.8rem',
                                        background: 'rgba(0,0,0,0.25)',
                                        borderRadius: '8px',
                                        marginBottom: '1rem'
                                    }}>
                                        {(activeSupportSession.messages || []).map((msg, idx) => {
                                            const isUser = msg.sender === 'user';
                                            const isBot = msg.sender === 'bot';

                                            return (
                                                <div
                                                    key={msg.id || idx}
                                                    style={{
                                                        alignSelf: isUser ? 'flex-start' : isBot ? 'flex-start' : 'flex-end',
                                                        maxWidth: '85%',
                                                        background: isUser
                                                            ? '#1e293b'
                                                            : isBot
                                                            ? 'rgba(15, 23, 42, 0.9)'
                                                            : 'linear-gradient(135deg, #059669, #047857)',
                                                        border: isBot ? '1px solid #38bdf8' : 'none',
                                                        borderRadius: '10px',
                                                        padding: '0.7rem 0.9rem',
                                                        color: '#fff',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                                    }}
                                                >
                                                    <div style={{
                                                        fontSize: '0.62rem',
                                                        fontWeight: 800,
                                                        color: isUser ? '#38bdf8' : isBot ? '#38bdf8' : '#a7f3d0',
                                                        marginBottom: '0.25rem',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        gap: '0.6rem'
                                                    }}>
                                                        <span>{isUser ? '👤 Müşteri' : isBot ? '🤖 AI Canlı Asistan' : `🛡️ ${msg.senderName || 'Destek Yetkilisi'}`}</span>
                                                        <span style={{ opacity: 0.6, fontWeight: 400 }}>
                                                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    {/* Message Content with Multi-Language Translation */}
                                                    {isUser && (
                                                        <div>
                                                            <div style={{ fontSize: '0.82rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                                                                {msg.text}
                                                            </div>
                                                            {/* Automatic Turkish Translation for Foreign Customer */}
                                                            {(msg.translatedText || extraTranslations[msg.id]) ? (
                                                                <div style={{
                                                                    marginTop: '0.45rem',
                                                                    paddingTop: '0.45rem',
                                                                    borderTop: '1px dashed rgba(255, 255, 255, 0.2)',
                                                                    fontSize: '0.78rem',
                                                                    color: '#34d399',
                                                                    display: 'flex',
                                                                    alignItems: 'flex-start',
                                                                    gap: '0.4rem'
                                                                }}>
                                                                    <span>🇹🇷</span>
                                                                    <div>
                                                                        <strong style={{ color: '#a7f3d0' }}>Türkçe Çevirisi:</strong> {msg.translatedText || extraTranslations[msg.id]}
                                                                    </div>
                                                                </div>
                                                            ) : (activeSupportSession.lang && activeSupportSession.lang !== 'tr' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleTranslateSingleMessage(msg.id, msg.text, activeSupportSession.lang)}
                                                                    style={{
                                                                        marginTop: '0.35rem',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#38bdf8',
                                                                        fontSize: '0.68rem',
                                                                        cursor: 'pointer',
                                                                        padding: 0,
                                                                        textDecoration: 'underline'
                                                                    }}
                                                                >
                                                                    🇹🇷 Türkçeye Çevir
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isBot && (
                                                        <div style={{ fontSize: '0.82rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                                                            {msg.text}
                                                        </div>
                                                    )}

                                                    {!isUser && !isBot && (
                                                        <div>
                                                            <div style={{ fontSize: '0.82rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                                                                {msg.originalText || msg.text}
                                                            </div>
                                                            {msg.originalText && msg.originalText !== msg.text && (
                                                                <div style={{
                                                                    marginTop: '0.35rem',
                                                                    paddingTop: '0.35rem',
                                                                    borderTop: '1px dashed rgba(255,255,255,0.2)',
                                                                    fontSize: '0.72rem',
                                                                    color: '#cbd5e1',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem'
                                                                }}>
                                                                    <span>{msg.targetLang === 'de' ? '🇩🇪' : (msg.targetLang === 'en' ? '🇬🇧' : '🌐')}</span>
                                                                    <span><strong>Müşteriye İletilen:</strong> <em>{msg.text}</em></span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Quick Response Chips */}
                                    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
                                        {quickTemplates.map((tmpl, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setAdminSupportReply(tmpl)}
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '15px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#cbd5e1',
                                                    fontSize: '0.68rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                💡 {tmpl.substring(0, 35)}...
                                            </button>
                                        ))}
                                    </div>

                                    {/* Reply Box with Live Debounced Translation */}
                                    <form onSubmit={(e) => handleSendSupportReply(e, liveTranslatedText)} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                                            <input
                                                type="text"
                                                value={adminSupportReply}
                                                onChange={(e) => setAdminSupportReply(e.target.value)}
                                                placeholder={
                                                    activeSupportSession?.lang === 'de'
                                                        ? "Türkçe yazın, otomatik Almancaya çevrilecektir..."
                                                        : (activeSupportSession?.lang === 'en'
                                                            ? "Türkçe yazın, otomatik İngilizceye çevrilecektir..."
                                                            : (isTr ? "Müşteriye yanıt yazın..." : "Type reply to customer..."))
                                                }
                                                style={{
                                                    flex: 1,
                                                    padding: '0.75rem 1rem',
                                                    background: 'rgba(0,0,0,0.3)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '8px',
                                                    color: '#fff',
                                                    fontSize: '0.85rem'
                                                }}
                                            />
                                            <button
                                                type="submit"
                                                disabled={replySending || !adminSupportReply.trim()}
                                                style={{
                                                    padding: '0.75rem 1.4rem',
                                                    background: '#10b981',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    color: '#000',
                                                    fontWeight: 800,
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    opacity: replySending || !adminSupportReply.trim() ? 0.5 : 1,
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {replySending ? '...' : (
                                                    activeSupportSession?.lang === 'de'
                                                        ? '🇩🇪 Çevir & Gönder'
                                                        : (activeSupportSession?.lang === 'en' ? '🇬🇧 Çevir & Gönder' : (isTr ? 'Gönder' : 'Send'))
                                                )}
                                            </button>
                                        </div>

                                        {/* Real-time Live Translation Preview Box */}
                                        {activeSupportSession?.lang && activeSupportSession.lang !== 'tr' && adminSupportReply.trim() && (
                                            <div style={{
                                                padding: '0.5rem 0.8rem',
                                                borderRadius: '8px',
                                                background: 'rgba(16, 185, 129, 0.12)',
                                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '0.6rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontSize: '1.2rem' }}>
                                                        {activeSupportSession.lang === 'de' ? '🇩🇪' : (activeSupportSession.lang === 'en' ? '🇬🇧' : '🌐')}
                                                    </span>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                            {isTranslating ? '⏳ ÇEVRİLİYOR...' : (activeSupportSession.lang === 'de' ? 'Almanca Çeviri Önizlemesi (Müşteriye Gidecek Olan)' : 'İngilizce Çeviri Önizlemesi (Müşteriye Gidecek Olan)')}
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', color: '#fff', fontStyle: 'italic', wordBreak: 'break-word', marginTop: '2px' }}>
                                                            {isTranslating ? 'Metin çevriliyor...' : (liveTranslatedText || '...')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '12px',
                                                    background: 'rgba(255,255,255,0.08)',
                                                    color: '#a7f3d0',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    ⚡ Canlı Çeviri Aktif
                                                </span>
                                            </div>
                                        )}
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SUBTAB 2: OPERATORS & SUPPORT STAFF MANAGEMENT */}
            {supportSubTab === 'operators' && (
                <div>
                    {/* Information Security Box */}
                    <div style={{
                        padding: '1.2rem',
                        borderRadius: '10px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        marginBottom: '1.5rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.6',
                        color: '#cbd5e1'
                    }}>
                        <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                            🛡️ {isTr ? 'GÜVENLİ DESTEK PERSONELİ (ROLE-BASED SUPPORT STAFF)' : 'ROLE-BASED SUPPORT STAFF SECURITY'}
                        </div>
                        <div>
                            • <strong>{isTr ? 'Sıfır Risk & Tam İzolasyon:' : 'Zero Risk & Isolation:'}</strong> {isTr ? 'Burada yetkilendirdiğiniz operatörler sadece canlı sohbet mesajlarını okuyabilir ve cevaplayabilir. VIP verme, bakiye, kullanıcı silme veya finansal ayarlara ASLA erişemezler.' : 'Assigned operators can only view and answer live chat inquiries. They have ZERO access to billing, VIP grants, or admin controls.'}
                        </div>
                        <div>
                            • <strong>{isTr ? '100% Gizlilik Garantisi:' : '100% Privacy:'}</strong> {isTr ? 'Personelin kişisel Telegram hesabı veya telefon numarası müşteriye ASLA gösterilmez. Müşteri ekranda daima "LiveBet Mentor Destek Masası" görür.' : 'Personal Telegram handles and phone numbers are completely concealed. Customers only see LiveBet Mentor Support.'}
                        </div>
                        <div>
                            • <strong>{isTr ? 'Anlık Telegram Köprüsü:' : 'Instant Telegram Bridge:'}</strong> {isTr ? 'Müşteri destek kutusuna yazdığında, görevlendirdiğiniz personelin Telegram\'ına anında bildirim düşer. Personel telefonundan Telegram\'daki bildirime "Yanıtla" yaparak veya bu web panelinden doğrudan cevap verebilir.' : 'When a customer needs help, operators receive instant notifications in Telegram and can reply directly by quoting the message or using this dashboard.'}
                        </div>
                    </div>

                    {/* Add Operator Form */}
                    <div className="glass-panel" style={{
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        marginBottom: '2rem'
                    }}>
                        <h4 style={{ color: '#38bdf8', fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            ➕ {isTr ? 'YENİ DESTEK OPERATÖRÜ / PERSONEL ATAMA' : 'ASSIGN NEW SUPPORT OPERATOR'}
                        </h4>

                        {/* Quick Picker from Registered Members */}
                        {profiles && profiles.length > 0 && (
                            <div style={{ marginBottom: '1.2rem', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    ⚡ {isTr ? 'Hızlı Seçim: Sitede Kayıtlı Üyelerden Personel Olarak Ata' : 'Fast Select from Registered Members'}
                                </label>
                                <select
                                    value={selectedMemberForOp}
                                    onChange={(e) => {
                                        const emailVal = e.target.value;
                                        setSelectedMemberForOp(emailVal);
                                        const found = profiles.find(p => p.email === emailVal);
                                        if (found) {
                                            setNewOpName(found.full_name || found.email.split('@')[0]);
                                            setNewOpEmail(found.email);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '0.78rem' }}
                                >
                                    <option value="">-- {isTr ? 'Kayıtlı bir üyeyi seçin (İsteğe bağlı)' : 'Select member (optional)'} --</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.email}>
                                            {p.email} {p.full_name ? `(${p.full_name})` : ''} - {p.plan || 'Trial'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <form onSubmit={handleAddOperator} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) 140px', gap: '0.8rem', alignItems: 'end' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.4rem' }}>
                                    {isTr ? 'Personel Adı / Unvanı *' : 'Staff Name *'}
                                </label>
                                <input
                                    type="text"
                                    value={newOpName}
                                    onChange={(e) => setNewOpName(e.target.value)}
                                    placeholder={isTr ? "Örn: Ahmet - Canlı Destek" : "Staff Name"}
                                    style={{ width: '100%', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 800, marginBottom: '0.4rem' }}>
                                    {isTr ? 'Telegram Chat ID * (Zorunlu)' : 'Telegram Chat ID * (Required)'}
                                </label>
                                <input
                                    type="text"
                                    value={newOpChatId}
                                    onChange={(e) => setNewOpChatId(e.target.value)}
                                    placeholder="Örn: 589412345"
                                    style={{ width: '100%', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', border: '1px solid #fbbf24', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.4rem' }}>
                                    {isTr ? 'Telegram Kullanıcı Adı (İsteğe Bağlı)' : 'Telegram Username (Optional)'}
                                </label>
                                <input
                                    type="text"
                                    value={newOpUsername}
                                    onChange={(e) => setNewOpUsername(e.target.value)}
                                    placeholder="@kullaniciadi"
                                    style={{ width: '100%', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.4rem' }}>
                                    {isTr ? 'Site E-posta (Hesap Eşleme)' : 'Site Account Email'}
                                </label>
                                <input
                                    type="email"
                                    value={newOpEmail}
                                    onChange={(e) => setNewOpEmail(e.target.value)}
                                    placeholder="personel@mail.com"
                                    style={{ width: '100%', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    padding: '0.75rem',
                                    background: '#38bdf8',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#000',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                {isTr ? '➕ Yetkilendir' : '➕ Authorize'}
                            </button>
                        </form>

                        {/* Helper tip on finding Telegram Chat ID */}
                        <div style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            💡 <strong>{isTr ? 'Personelin Telegram Chat ID\'si Nasıl Bulunur?' : 'How to find Telegram Chat ID?'}</strong> {isTr ? 'Personeliniz Telegram\'da botumuza (@Livebetmentorbot) /start yazabilir veya Telegram\'da @userinfobot botunu başlatıp ID\'sini anında alabilir.' : 'Your staff can message @Livebetmentorbot or @userinfobot on Telegram to immediately get their numeric ID.'}
                        </div>
                    </div>

                    {/* Active Operators List */}
                    <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', color: '#fff' }}>
                            👥 {isTr ? 'YETKİLİ DESTEK PERSONELİ LİSTESİ' : 'AUTHORIZED SUPPORT STAFF'} ({supportOperators.length})
                        </h4>

                        {supportOperators.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', color: '#64748b' }}>
                                {isTr
                                    ? 'Henüz atanmış bir destek operatörü yok. Yukarıdaki formdan ekleyebilirsiniz.'
                                    : 'No support operators assigned yet. Add one using the form above.'}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                                            <th style={{ padding: '0.8rem' }}>{isTr ? 'PERSONEL / UNVAN' : 'STAFF NAME'}</th>
                                            <th style={{ padding: '0.8rem' }}>TELEGRAM CHAT ID</th>
                                            <th style={{ padding: '0.8rem' }}>TELEGRAM USER</th>
                                            <th style={{ padding: '0.8rem' }}>{isTr ? 'SİTE HESABI' : 'SITE ACCOUNT'}</th>
                                            <th style={{ padding: '0.8rem' }}>{isTr ? 'DURUM' : 'STATUS'}</th>
                                            <th style={{ padding: '0.8rem' }}>{isTr ? 'İŞLEM' : 'ACTION'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supportOperators.map(op => (
                                            <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.8rem', fontWeight: 800, color: '#fff' }}>
                                                    {op.name}
                                                </td>
                                                <td style={{ padding: '0.8rem', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>
                                                    {op.telegramChatId}
                                                </td>
                                                <td style={{ padding: '0.8rem', color: '#38bdf8' }}>
                                                    {op.telegramUsername ? `@${op.telegramUsername}` : '-'}
                                                </td>
                                                <td style={{ padding: '0.8rem', color: '#94a3b8' }}>
                                                    {op.email || '-'}
                                                </td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    <button
                                                        onClick={() => handleToggleOperator(op.id)}
                                                        style={{
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer',
                                                            background: op.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                            color: op.active ? '#10b981' : '#ef4444',
                                                            border: `1px solid ${op.active ? '#10b981' : '#ef4444'}`
                                                        }}
                                                    >
                                                        {op.active ? (isTr ? '● AKTİF' : 'ACTIVE') : (isTr ? '○ PASİF' : 'INACTIVE')}
                                                    </button>
                                                </td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    <button
                                                        onClick={() => handleDeleteOperator(op.id, op.name)}
                                                        style={{
                                                            padding: '0.35rem 0.7rem',
                                                            borderRadius: '6px',
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: '1px solid #ef4444',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        🗑️ {isTr ? 'Sil' : 'Delete'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const AdminPanel = ({ lang = 'tr', initialTab, initialSessionId }) => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subscriptionDays, setSubscriptionDays] = useState(3);
    const [selectedPlan, setSelectedPlan] = useState('trial');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [activeTab, setActiveTab] = useState(() => {
        if (initialTab) return initialTab;
        try {
            if (typeof window !== 'undefined') {
                const p = new URLSearchParams(window.location.search);
                if (p.get('tab') === 'support_staff' || p.get('tab') === 'support' || p.get('session')) return 'support_staff';
                if (p.get('tab') === 'web_analytics') return 'web_analytics';
                if (p.get('tab') === 'audit' || p.get('tab') === 'internal_audit') return 'audit';
            }
        } catch (e) {}
        return 'pending';
    });
    const [upgradeRequests, setUpgradeRequests] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [systemSettings, setSystemSettings] = useState({});
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [supabaseOffline, setSupabaseOffline] = useState(false);
    const [officeStatus, setOfficeStatus] = useState(null);
    const [officeLoading, setOfficeLoading] = useState(false);
    const [officeActionLoading, setOfficeActionLoading] = useState(false);

    // Support Staff & Live Chat States
    const [supportOperators, setSupportOperators] = useState([]);
    const [supportSessions, setSupportSessions] = useState([]);
    const [supportLoading, setSupportLoading] = useState(false);
    const [activeSupportSession, setActiveSupportSession] = useState(null);
    const [sessionChatLoading, setSessionChatLoading] = useState(false);
    const [adminSupportReply, setAdminSupportReply] = useState('');
    const [replySending, setReplySending] = useState(false);
    const [supportSubTab, setSupportSubTab] = useState('chats'); // 'chats' | 'operators'
    const [supportFilter, setSupportFilter] = useState('all'); // 'all' | 'waiting' | 'active' | 'closed'
    const [newOpName, setNewOpName] = useState('');
    const [newOpChatId, setNewOpChatId] = useState('');
    const [newOpUsername, setNewOpUsername] = useState('');
    const [newOpEmail, setNewOpEmail] = useState('');
    const [selectedMemberForOp, setSelectedMemberForOp] = useState('');

    const PLANS = {
        trial: { label: 'Trial', color: '#10b981' },
        pro: { label: 'Pro', color: '#38bdf8' },
        premium: { label: 'Premium', color: '#a78bfa' },
        admin: { label: 'Admin', color: '#f59e0b' }
    };

    const t = lang === 'tr' ? {
        title: '🛡️ YÖNETİCİ KONTROL MERKEZİ',
        addMember: 'YENİ ÜYE EKLE',
        email: 'E-POSTA',
        tempPass: 'GEÇİCİ ŞİFRE',
        duration: 'SÜRE',
        plan: 'PLAN',
        days: 'gün',
        tabPending: 'ONAY BEKLİYOR',
        tabActive: 'AKTİF ÜYELER',
        tabAll: 'TÜM ÜYELER',
        memberList: 'Üye Listesi',
        emailCol: 'E-POSTA',
        dateCol: 'KAYIT TARİHİ',
        statusCol: 'DURUM',
        planCol: 'PLAN',
        expiryCol: 'BİTİŞ TARİHİ',
        remainingCol: 'KALAN',
        actionsCol: 'İŞLEM',
        statusPending: 'ONAY BEKLİYOR',
        statusApproved: 'AKTİF',
        statusRejected: 'REDDEDİLDİ',
        statusExpired: 'SÜRESİ DOLDU',
        statusBanned: 'YASAKLI',
        approve: 'ONAYLA',
        reject: 'REDDET',
        extend: 'UZAT',
        ban: 'YASAKLA',
        unban: 'YASAĞI KALDIR',
        delete: 'SİL',
        save: 'KAYDET',
        cancel: 'İPTAL',
        confirmDelete: 'Bu kullanıcıyı tamamen silmek istediğine emin misin?',
        confirmReject: 'Bu üyelik başvurusunu reddetmek istediğine emin misin?',
        userCreated: 'Kullanıcı başarıyla eklendi!',
        userApproved: 'Üyelik onaylandı!',
        userRejected: 'Başvuru reddedildi.',
        userDeleted: 'Kullanıcı silindi.',
        subscriptionUpdated: 'Üyelik süresi güncellendi!',
        loading: 'Yükleniyor...',
        noUsers: 'Kullanıcı bulunamadı.',
        quickDurations: 'Hızlı:',
        requestedPlan: 'TALEP EDİLEN',
        currentPlan: 'MEVCUT PLAN',
        tabSettings: 'SİSTEM AYARLARI',
        saveSettings: 'AYARLARI KAYDET',
        telegramSupport: 'Telegram Kullanıcı Adı',
        proPrice: 'Pro Plan Fiyatı',
        premiumPrice: 'Premium Plan Fiyatı',
        currency: 'Para Birimi',
        supportEmail: 'Destek E-postası',
        settingsUpdated: 'Sistem ayarları güncellendi!',
        tabTelegram: 'TELEGRAM BOT',
        botStatus: 'BOT DURUMU',
        botActive: 'AKTİF',
        botInactive: 'DEVRE DIŞI',
        botError: 'HATA',
        sendTestReport: 'GÜNLÜK RAPOR GÖNDER',
        signalsToday: 'Bugünkü Sinyal Sayısı',
        vipGroupId: 'VIP Grup ID',
        publicChannel: 'Halka Açık Kanal',
        minLevel: 'Min. Sinyal Seviyesi',
        refreshStatus: 'DURUMU GÜNCELLE',
        strategyTitle: '📊 BAHİS STRATEJİLERİ',
        strategyDesc: 'Hangi algoritmaların sinyal üreteceğini seçin.',
        onlyXG: 'Sadece xG Verisi Olanlar',
        stratPress: 'Baskı Dominasyonu',
        stratMomentum: 'Son 15dk İvmesi',
        stratFHG: 'İY 0.5 Üst',
        stratComeback: 'Geri Dönüş',
        stratStats: 'Stat Dominasyonu',
        stratCorners: 'Korner Baskısı',
        stratBTTS: 'KG Var',
        stratRedCard: 'Sayısal Üstünlük (Kırmızı Kart)',
        tabWebAnalytics: 'ZİYARETÇİ & SİTE ANALİTİĞİ',
        tabAnalytics: 'STRATEJİ KARNESİ (ROI)',
        strategyScorecardTitle: '🎯 STRATEJİ BAŞARI & ROI KARNESİ',
        strategyScorecardDesc: 'Sistemin kullandığı algoritmaların canlı bahis performansı, kazanma oranları ve getiri (ROI) karnesi.',
        stratCol: 'STRATEJİ',
        betsCol: 'TOPLAM BAHİS',
        winLossCol: 'K / K',
        stakedCol: 'YATIRILAN',
        profitCol: 'NET KÂR/ZARAR',
        winRateCol: 'BAŞARI ORANI',
        roiCol: 'ROI (%)',
        badgeCol: 'DERECELENDİRME',
        totalStaked: 'Toplam Yatırılan',
        totalProfit: 'Kümülatif Net Kâr',
        avgRoi: 'Ortalama ROI',
        topStrategy: 'En Başarılı Algoritma',
        clvTitle: 'Kapanış Oranı (CLV)',
        clvBeat: 'Piyasayı Yenme Gücü',
        resetStats: 'İSTATİSTİKLERİ SIFIRLA',
        resetConfirm: 'Tüm strateji performans verilerini sıfırlamak istediğinize emin misiniz?',
        tabOffice: 'OTONOM KOMUTA (3 GÖREVLİ)',
        tabSupportStaff: 'CANLI DESTEK & PERSONEL',
        tabAudit: 'İÇ DENETİM & KONTROL KULESİ'
    } : lang === 'de' ? {
        title: '🛡️ ADMINISTRATOR-KONTROLLZENTRUM',
        addMember: 'NEUES MITGLIED HINZUFÜGEN',
        email: 'E-MAIL',
        tempPass: 'VORLÄUFIGES PASSWORT',
        duration: 'LAUFZEIT',
        plan: 'PLAN',
        days: 'Tage',
        tabPending: 'WARTET AUF FREISCHALTUNG',
        tabActive: 'AKTIVE MITGLIEDER',
        tabAll: 'ALLE MITGLIEDER',
        memberList: 'Mitgliederliste',
        emailCol: 'E-MAIL',
        dateCol: 'REGISTRIERUNG',
        statusCol: 'STATUS',
        planCol: 'PLAN',
        expiryCol: 'ABLAUFDATUM',
        remainingCol: 'VERBLEIBEND',
        actionsCol: 'AKTIONEN',
        statusPending: 'WARTET AUF FREISCHALTUNG',
        statusApproved: 'AKTIV',
        statusRejected: 'ABGELEHNT',
        statusExpired: 'ABGELAUFEN',
        statusBanned: 'GESPERRT',
        approve: 'GENEHMIGEN',
        reject: 'ABLEHNEN',
        extend: 'VERLÄNGERN',
        ban: 'SPERREN',
        unban: 'ENTSPERREN',
        delete: 'LÖSCHEN',
        save: 'SPEICHERN',
        cancel: 'ABBRECHEN',
        confirmDelete: 'Möchten Sie diesen Benutzer wirklich endgültig löschen?',
        confirmReject: 'Möchten Sie diesen Mitgliedsantrag wirklich ablehnen?',
        userCreated: 'Benutzer erfolgreich hinzugefügt!',
        userApproved: 'Mitgliedschaft genehmigt!',
        userRejected: 'Antrag abgelehnt.',
        userDeleted: 'Benutzer gelöscht.',
        subscriptionUpdated: 'Mitgliedschaftslaufzeit aktualisiert!',
        loading: 'Laden...',
        noUsers: 'Keine Benutzer gefunden.',
        quickDurations: 'Schnellauswahl:',
        tabUpgrades: 'UPGRADE-ANFRAGEN',
        requestedPlan: 'ANGEFORDERT',
        currentPlan: 'AKTUELLER PLAN',
        tabSettings: 'SYSTEMEINSTELLUNGEN',
        saveSettings: 'EINSTELLUNGEN SPEICHERN',
        telegramSupport: 'Telegram-Benutzername',
        proPrice: 'Pro-Plan Preis',
        premiumPrice: 'Premium-Plan Preis',
        currency: 'Währungssymbol',
        supportEmail: 'Support-E-Mail',
        settingsUpdated: 'Systemeinstellungen aktualisiert!',
        tabTelegram: 'TELEGRAM-BOT',
        botStatus: 'BOT-STATUS',
        botActive: 'AKTIV',
        botInactive: 'INAKTIV',
        botError: 'FEHLER',
        sendTestReport: 'TAGESBERICHT SENDEN',
        signalsToday: 'Heutige Signale',
        vipGroupId: 'VIP-Gruppen-ID',
        publicChannel: 'Öffentlicher Kanal',
        minLevel: 'Min. Signal-Level',
        refreshStatus: 'STATUS AKTUALISIEREN',
        strategyTitle: '📊 WETTSTRATEGIEN',
        strategyDesc: 'Wählen Sie, welche Algorithmen Signale erzeugen sollen.',
        onlyXG: 'Nur mit xG-Daten',
        stratPress: 'Druckdominanz',
        stratMomentum: 'Momentum letzte 15 Min.',
        stratFHG: '1. HZ Über 0.5',
        stratComeback: 'Comeback-Druck',
        stratStats: 'Statistik-Dominanz',
        stratCorners: 'Eckball-Druck',
        stratBTTS: 'Beide treffen (BTTS)',
        stratRedCard: 'Überzahl (Rote Karte)',
        tabWebAnalytics: 'BESUCHER- & WEB-ANALYTIK',
        tabAnalytics: 'STRATEGIE-REPORT (ROI)',
        strategyScorecardTitle: '🎯 STRATEGIE-PERFORMANCE & ROI-REPORT',
        strategyScorecardDesc: 'Live-Wettalgorithmen-Performance, Erfolgsquoten und Return on Investment (ROI).',
        stratCol: 'STRATEGIE',
        betsCol: 'WETTEN GESAMT',
        winLossCol: 'G / V',
        stakedCol: 'EINSATZ GESAMT',
        profitCol: 'NETTOGEWINN/-VERLUST',
        winRateCol: 'ERFOLGSQUOTE',
        roiCol: 'ROI (%)',
        badgeCol: 'BEWERTUNG',
        totalStaked: 'Gesamteinsatz',
        totalProfit: 'Kumulierter Reingewinn',
        avgRoi: 'Durchschnittlicher ROI',
        topStrategy: 'Bester Algorithmus',
        clvTitle: 'Closing Line Value (CLV)',
        clvBeat: 'Marktschlagende Stärke',
        resetStats: 'STATISTIKEN ZURÜCKSETZEN',
        resetConfirm: 'Möchten Sie wirklich alle Strategie-Performancedaten zurücksetzen?',
        tabOffice: 'AUTONOMES KOMMANDO (3 AGENTEN)',
        tabSupportStaff: 'LIVE-SUPPORT & MITARBEITER',
        tabAudit: 'INTERNES AUDIT & KONTROLLTURM'
    } : {
        title: '🛡️ ADMIN CONTROL CENTER',
        addMember: 'ADD NEW MEMBER',
        email: 'EMAIL',
        tempPass: 'TEMP PASSWORD',
        duration: 'DURATION',
        plan: 'PLAN',
        days: 'days',
        tabPending: 'PENDING',
        tabActive: 'ACTIVE',
        tabAll: 'ALL MEMBERS',
        memberList: 'Member List',
        emailCol: 'EMAIL',
        dateCol: 'REGISTERED',
        statusCol: 'STATUS',
        planCol: 'PLAN',
        expiryCol: 'EXPIRY',
        remainingCol: 'REMAINING',
        actionsCol: 'ACTIONS',
        statusPending: 'PENDING',
        statusApproved: 'ACTIVE',
        statusRejected: 'REJECTED',
        statusExpired: 'EXPIRED',
        statusBanned: 'BANNED',
        approve: 'APPROVE',
        reject: 'REJECT',
        extend: 'EXTEND',
        ban: 'BAN',
        unban: 'UNBAN',
        delete: 'DELETE',
        save: 'SAVE',
        cancel: 'CANCEL',
        confirmDelete: 'Are you sure you want to completely delete this user?',
        confirmReject: 'Are you sure you want to reject this membership application?',
        userCreated: 'User created successfully!',
        userApproved: 'Membership approved!',
        userRejected: 'Application rejected.',
        userDeleted: 'User deleted.',
        subscriptionUpdated: 'Subscription updated!',
        loading: 'Loading...',
        noUsers: 'No users found.',
        quickDurations: 'Quick:',
        tabUpgrades: 'UPGRADE REQUESTS',
        requestedPlan: 'REQUESTED',
        currentPlan: 'CURRENT',
        tabSettings: 'SYSTEM SETTINGS',
        saveSettings: 'SAVE SETTINGS',
        telegramSupport: 'Telegram Username',
        proPrice: 'Pro Plan Price',
        premiumPrice: 'Premium Plan Price',
        currency: 'Currency Symbol',
        supportEmail: 'Support Email',
        settingsUpdated: 'System settings updated!',
        tabTelegram: 'TELEGRAM BOT',
        botStatus: 'BOT STATUS',
        botActive: 'ACTIVE',
        botInactive: 'INACTIVE',
        botError: 'ERROR',
        sendTestReport: 'SEND DAILY REPORT',
        signalsToday: 'Signals Today',
        vipGroupId: 'VIP Group ID',
        publicChannel: 'Public Channel',
        minLevel: 'Min. Signal Level',
        refreshStatus: 'REFRESH STATUS',
        strategyTitle: '📊 BETTING STRATEGIES',
        strategyDesc: 'Select which algorithms generate signals.',
        onlyXG: 'xG Data Available Only',
        stratPress: 'Pressure Dominance',
        stratMomentum: 'Last 15m Momentum',
        stratFHG: '1st Half Over 0.5',
        stratComeback: 'Comeback Surge',
        stratStats: 'Stat Dominance',
        stratCorners: 'Corner Pressure',
        stratBTTS: 'BTTS Dynamic',
        stratRedCard: 'Numerical Advantage (Red Card)',
        tabWebAnalytics: 'VISITOR & WEB ANALYTICS',
        tabAnalytics: 'STRATEGY SCORECARD (ROI)',
        strategyScorecardTitle: '🎯 STRATEGY PERFORMANCE & ROI SCORECARD',
        strategyScorecardDesc: 'Live betting algorithm performance, win rates, and return on investment (ROI) breakdown.',
        stratCol: 'STRATEGY',
        betsCol: 'TOTAL BETS',
        winLossCol: 'W / L',
        stakedCol: 'STAKED',
        profitCol: 'NET P/L',
        winRateCol: 'WIN RATE',
        roiCol: 'ROI (%)',
        badgeCol: 'TIER GRADE',
        totalStaked: 'Total Staked',
        totalProfit: 'Cumulative Net P/L',
        avgRoi: 'Average ROI',
        topStrategy: 'Top Algorithm',
        clvTitle: 'Closing Line Value (CLV)',
        clvBeat: 'Beating The Market',
        resetStats: 'RESET STATS',
        resetConfirm: 'Are you sure you want to reset all strategy performance analytics?',
        tabOffice: 'AUTONOMOUS COMMAND (3 AGENTS)',
        tabSupportStaff: 'LIVE SUPPORT & STAFF',
        tabAudit: 'INTERNAL AUDIT & COCKPIT'
    };

    const [strategySettings, setStrategySettings] = useState({});
    const [strategyAnalytics, setStrategyAnalytics] = useState([]);

    const loadStrategyAnalytics = async () => {
        try {
            const proxyBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');
            const res = await fetch(`${proxyBase}/api/analytics/strategy-performance`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.strategies) && data.strategies.length > 0) {
                    setStrategyAnalytics(data.strategies);
                    return;
                }
            }
        } catch (err) {
            console.warn('Error fetching server strategy analytics, falling back to local:', err);
        }

        try {
            setStrategyAnalytics(bankrollManager.getStrategyAnalytics());
        } catch (e) {
            console.error('Error loading strategy analytics:', e);
        }
    };

    const handleResetStrategyStats = () => {
        if (window.confirm(t.resetConfirm)) {
            if (bankrollManager.state) {
                bankrollManager.state.strategyStats = {};
                bankrollManager.saveState();
            }
            loadStrategyAnalytics();
            setStatus({ type: 'success', message: 'Strateji istatistikleri sıfırlandı.' });
        }
    };

    useEffect(() => {
        fetchProfiles();
        fetchUpgradeRequests();
        fetchSystemSettings();
        fetchTelegramStatus();
        fetchOfficeStatus();
        loadStrategyAnalytics();
        fetchSupportData();
        
        // Load strategy settings from localStorage
        let savedStrats = {};
        try {
            const raw = localStorage.getItem('lbm_strategy_settings');
            if (raw && raw !== 'undefined' && raw !== 'null') savedStrats = JSON.parse(raw);
        } catch {
            savedStrats = {};
        }
        setStrategySettings({
            ONLY_XG: true,
            PRESS: true,
            MOMENTUM: true,
            FHG: true,
            COMEBACK: true,
            STATS: true,
            CORNERS: true,
            BTTS: true,
            RED_CARD_ADV: true,
            ...savedStrats
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'support_staff') {
            fetchSupportData();
            const interval = setInterval(() => {
                fetchSupportData();
                if (activeSupportSession?.sessionId) {
                    fetchSessionDetail(activeSupportSession.sessionId);
                }
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [activeTab, activeSupportSession?.sessionId]);

    // Automatically focus target session when arriving from Telegram deep-link
    useEffect(() => {
        const targetSid = initialSessionId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') : null);
        if (targetSid) {
            setActiveTab('support_staff');
            setSupportSubTab('chats');
            fetchSessionDetail(targetSid);
        }
    }, [initialSessionId]);

    const handleToggleStrategy = (key) => {
        const newSettings = { ...strategySettings, [key]: !strategySettings[key] };
        setStrategySettings(newSettings);
        localStorage.setItem('lbm_strategy_settings', JSON.stringify(newSettings));
    };

    const [telegramStatus, setTelegramStatus] = useState(null);
    const [telegramLoading, setTelegramLoading] = useState(false);

    const getProxyBase = () => (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3001'
        : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

    const getAdminHeaders = () => {
        let token = '';
        try {
            const adminStored = localStorage.getItem('lbm_admin_session');
            if (adminStored) {
                const parsed = JSON.parse(adminStored);
                token = parsed.token || parsed.access_token || '';
            }
            if (!token) {
                const memberStored = localStorage.getItem('lbm_member_session');
                if (memberStored) {
                    const parsed = JSON.parse(memberStored);
                    token = parsed.token || parsed.access_token || '';
                }
            }
        } catch (e) {}

        const effectiveToken = token || 'master-admin-token';
        const headers = {
            'Content-Type': 'application/json',
            'x-admin-sender': 'admin@livebetmentor.com',
            'Authorization': `Bearer ${effectiveToken}`,
            'x-admin-token': effectiveToken
        };
        return headers;
    };

    const fetchTelegramStatus = async () => {
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/telegram/status`, {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            setTelegramStatus(data);
        } catch (e) {
            console.error('Error fetching telegram status:', e);
        }
    };

    const fetchSupportData = async () => {
        setSupportLoading(true);
        try {
            const proxyBase = getProxyBase();
            const headers = getAdminHeaders();
            const [opRes, sessRes] = await Promise.all([
                fetch(`${proxyBase}/api/admin/support/operators`, { headers }).catch(() => null),
                fetch(`${proxyBase}/api/admin/support/sessions`, { headers }).catch(() => null)
            ]);
            if (opRes && opRes.ok) {
                const opData = await opRes.json();
                if (opData.success) setSupportOperators(opData.operators || []);
            }
            if (sessRes && sessRes.ok) {
                const sessData = await sessRes.json();
                if (sessData.success) setSupportSessions(sessData.sessions || []);
            }
        } catch (e) {
            console.error('Error fetching support data:', e);
        } finally {
            setSupportLoading(false);
        }
    };

    const fetchSessionDetail = async (sessionId) => {
        setSessionChatLoading(true);
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/admin/support/sessions/${sessionId}`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setActiveSupportSession(data.session);
                }
            }
        } catch (e) {
            console.error('Error fetching session detail:', e);
        } finally {
            setSessionChatLoading(false);
        }
    };

    const handleSendSupportReply = async (e, customTranslatedText = null) => {
        if (e) e.preventDefault();
        if (!activeSupportSession || !adminSupportReply.trim()) return;
        setReplySending(true);
        try {
            const proxyBase = getProxyBase();
            const textToSend = (customTranslatedText && typeof customTranslatedText === 'string' && customTranslatedText.trim())
                ? customTranslatedText.trim()
                : adminSupportReply.trim();

            const res = await fetch(`${proxyBase}/api/admin/support/reply`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({
                    sessionId: activeSupportSession.sessionId,
                    text: textToSend,
                    originalText: adminSupportReply.trim(),
                    senderName: 'Destek Masası'
                })
            });
            if (res.ok) {
                setAdminSupportReply('');
                await fetchSessionDetail(activeSupportSession.sessionId);
                fetchSupportData();
            }
        } catch (e) {
            console.error('Error sending support reply:', e);
        } finally {
            setReplySending(false);
        }
    };

    const handleAddOperator = async (e) => {
        if (e) e.preventDefault();
        if (!newOpChatId.trim()) {
            setStatus({ type: 'error', message: 'Telegram Chat ID zorunludur!' });
            return;
        }
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/admin/support/operators`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({
                    name: newOpName.trim() || 'Destek Temsilcisi',
                    telegramChatId: newOpChatId.trim(),
                    telegramUsername: newOpUsername.trim(),
                    email: newOpEmail.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'Operatör başarıyla eklendi!' });
                setNewOpName('');
                setNewOpChatId('');
                setNewOpUsername('');
                setNewOpEmail('');
                setSelectedMemberForOp('');
                fetchSupportData();
            } else {
                setStatus({ type: 'error', message: data.error || 'Operatör eklenemedi.' });
            }
        } catch (e) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const handleToggleOperator = async (id) => {
        try {
            const proxyBase = getProxyBase();
            await fetch(`${proxyBase}/api/admin/support/operators/${id}/toggle`, {
                method: 'POST',
                headers: getAdminHeaders()
            });
            fetchSupportData();
        } catch (e) {}
    };

    const handleDeleteOperator = async (id, name) => {
        if (!window.confirm(`${name || 'Bu personeli'} silmek istediğinize emin misiniz? Artık destek mesajlarını göremeyecek.`)) return;
        try {
            const proxyBase = getProxyBase();
            await fetch(`${proxyBase}/api/admin/support/operators/${id}`, {
                method: 'DELETE',
                headers: getAdminHeaders()
            });
            fetchSupportData();
        } catch (e) {}
    };

    const handleCloseSupportSession = async (sessionId) => {
        try {
            const proxyBase = getProxyBase();
            await fetch(`${proxyBase}/api/admin/support/sessions/${sessionId}/close`, {
                method: 'POST',
                headers: getAdminHeaders()
            });
            if (activeSupportSession?.sessionId === sessionId) {
                setActiveSupportSession(prev => prev ? { ...prev, status: 'closed' } : null);
            }
            fetchSupportData();
        } catch (e) {}
    };

    const handleArchiveSupportSession = async (sessionId) => {
        try {
            const proxyBase = getProxyBase();
            await fetch(`${proxyBase}/api/admin/support/sessions/${sessionId}/archive`, {
                method: 'POST',
                headers: getAdminHeaders()
            });
            if (activeSupportSession?.sessionId === sessionId) {
                setActiveSupportSession(prev => prev ? { ...prev, status: 'archived' } : null);
            }
            fetchSupportData();
        } catch (e) {}
    };

    const handleUnarchiveSupportSession = async (sessionId) => {
        try {
            const proxyBase = getProxyBase();
            await fetch(`${proxyBase}/api/admin/support/sessions/${sessionId}/unarchive`, {
                method: 'POST',
                headers: getAdminHeaders()
            });
            if (activeSupportSession?.sessionId === sessionId) {
                setActiveSupportSession(prev => prev ? { ...prev, status: 'active' } : null);
            }
            fetchSupportData();
        } catch (e) {}
    };

    const handleDeleteSupportSession = async (sessionId) => {
        if (!window.confirm('Bu sohbet oturumunu ve tüm mesaj geçmişini kalıcı olarak silmek istediğinize emin misiniz?')) {
            return;
        }
        try {
            const proxyBase = getProxyBase();
            await fetch(`${proxyBase}/api/admin/support/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: getAdminHeaders()
            });
            if (activeSupportSession?.sessionId === sessionId) {
                setActiveSupportSession(null);
            }
            fetchSupportData();
            setStatus({ type: 'success', message: 'Sohbet başarıyla silindi.' });
        } catch (e) {
            setStatus({ type: 'error', message: 'Sohbet silinemedi.' });
        }
    };

    const handleClearClosedSessions = async () => {
        if (!window.confirm('Çözülen ve arşivlenen tüm eski sohbetleri kalıcı olarak temizlemek istiyor musunuz?')) {
            return;
        }
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/admin/support/sessions/clear-closed`, {
                method: 'POST',
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: `${data.purgedCount || 0} eski sohbet temizlendi.` });
                if (activeSupportSession?.status === 'closed' || activeSupportSession?.status === 'archived') {
                    setActiveSupportSession(null);
                }
                fetchSupportData();
            }
        } catch (e) {}
    };

    const handleGrantVipFromChat = async (sessionId, days = 30, plan = 'pro') => {
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/admin/support/sessions/${sessionId}/grant-vip`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ days, plan })
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: `Kullanıcıya başarıyla +${days} Günlük ${plan.toUpperCase()} tanımlandı!` });
                fetchSessionDetail(sessionId);
                fetchSupportData();
                fetchMembers();
            } else {
                setStatus({ type: 'error', message: data.error || 'VIP tanımlanamadı.' });
            }
        } catch (e) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const handleSendTelegramReport = async () => {
        setTelegramLoading(true);
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/telegram/send-report`, { 
                method: 'POST',
                headers: getAdminHeaders()
            });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Rapor başarıyla gönderildi!' });
                fetchTelegramStatus();
            }
        } catch (e) {
            setStatus({ type: 'error', message: 'Rapor gönderilirken hata oluştu.' });
        }
        setTelegramLoading(false);
    };

    const handleUpdateTelegramLang = async (newLang) => {
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/telegram/config`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ lang: newLang })
            });
            const data = await res.json();
            if (data.success && data.status) {
                setTelegramStatus(data.status);
                const msg = newLang === 'tr' 
                    ? 'Telegram dili Türkçe yapıldı! 🇹🇷' 
                    : newLang === 'de' 
                    ? 'Telegram-Sprache auf Deutsch gesetzt! 🇩🇪' 
                    : 'Telegram language set to English! 🇬🇧';
                setStatus({ type: 'success', message: msg });
            }
        } catch (e) {
            console.error('Error updating telegram language:', e);
            setStatus({ type: 'error', message: 'Dil güncellenirken hata oluştu.' });
        }
    };

    const fetchOfficeStatus = async () => {
        try {
            setOfficeLoading(true);
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/autonomous-office/status`, {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setOfficeStatus(data);
            }
        } catch (e) {
            console.error('Error fetching office status:', e);
        } finally {
            setOfficeLoading(false);
        }
    };

    const handleOfficeAction = async (action, payload = {}) => {
        try {
            setOfficeActionLoading(true);
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/autonomous-office/trigger-action`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ action, payload })
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'Otonom işlem başarıyla gerçekleştirildi!' });
                fetchOfficeStatus();
            } else {
                setStatus({ type: 'error', message: data.error || 'İşlem başarısız' });
            }
        } catch (e) {
            console.error('Error triggering office action:', e);
            setStatus({ type: 'error', message: 'Bağlantı hatası' });
        } finally {
            setOfficeActionLoading(false);
        }
    };

    const fetchProfiles = async () => {
        setLoading(true);
        const proxyBase = getProxyBase();
        const merged = [];
        const seen = new Set();

        // 1. Fetch from Supabase
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                data.forEach(p => {
                    const normEmail = (p.email || '').toLowerCase().trim();
                    if (normEmail && !seen.has(normEmail)) {
                        seen.add(normEmail);
                        merged.push(p);
                    }
                });
                setSupabaseOffline(false);
            } else if (error) {
                console.warn('Supabase profiles warning:', error.message);
            }
        } catch (sbErr) {
            console.warn('Supabase connection warning:', sbErr);
        }

        // 2. Fetch from Backend proxy and merge with Supabase records (backend proxy takes priority for live subscription data)
        try {
            const res = await fetch(`${proxyBase}/api/members`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.members)) {
                    data.members.forEach(m => {
                        const normEmail = (m.email || '').toLowerCase().trim();
                        const existingIdx = merged.findIndex(p => 
                            ((p.email || '').toLowerCase().trim() === normEmail) || 
                            (p.id && m.id && p.id === m.id)
                        );
                        if (existingIdx >= 0) {
                            merged[existingIdx] = {
                                ...merged[existingIdx],
                                ...m,
                                id: merged[existingIdx].id || m.id,
                                plan: m.plan || merged[existingIdx].plan,
                                status: m.status || merged[existingIdx].status,
                                subscription_end: m.subscription_end || merged[existingIdx].subscription_end
                            };
                        } else if (normEmail && !seen.has(normEmail)) {
                            seen.add(normEmail);
                            merged.push(m);
                        }
                    });
                }
            }
        } catch (beErr) {
            console.warn('Backend members fetch failed:', beErr);
        }

        setProfiles(merged);
        setLoading(false);
    };

    const fetchUpgradeRequests = async () => {
        const mergedRequests = [];
        const seen = new Set();

        // 1. Fetch from Backend Proxy
        try {
            const res = await fetch(`${proxyBase}/api/members/upgrade-requests`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.requests && Array.isArray(data.requests)) {
                    data.requests.filter(r => r.status === 'pending').forEach(r => {
                        seen.add(r.id);
                        mergedRequests.push(r);
                    });
                }
            }
        } catch (beErr) {
            console.warn('Backend upgrade requests fetch warning:', beErr);
        }

        // 2. Fetch from Supabase (if table exists)
        try {
            const { data, error } = await supabase
                .from('membership_requests')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                data.forEach(r => {
                    if (!seen.has(r.id)) {
                        seen.add(r.id);
                        mergedRequests.push(r);
                    }
                });
            }
        } catch (e) {
            console.warn('Error fetching upgrade requests from Supabase:', e);
        }

        setUpgradeRequests(mergedRequests);
    };

    const approveUpgrade = async (request) => {
        try {
            // 1. Resolve in Backend Proxy
            try {
                await fetch(`${proxyBase}/api/members/resolve-upgrade`, {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ id: request.id, action: 'approved' })
                });
            } catch (beErr) {
                console.warn('Backend resolve-upgrade error:', beErr);
            }

            // 2. Update Supabase Profile (if present)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // Default 30 days for upgrades

            try {
                await supabase
                    .from('profiles')
                    .update({
                        plan: request.requested_plan,
                        status: 'approved',
                        subscription_start: new Date().toISOString(),
                        subscription_end: expiryDate.toISOString()
                    })
                    .eq('id', request.user_id);
            } catch (sbErr) {}

            // 3. Update Supabase Request Status (if table exists)
            try {
                await supabase
                    .from('membership_requests')
                    .update({
                        status: 'approved',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', request.id);
            } catch (sbErr) {}

            setStatus({ type: 'success', message: t.userApproved });
            fetchProfiles();
            fetchUpgradeRequests();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Hata oluştu' });
        }
    };

    const rejectUpgrade = async (requestId) => {
        if (!window.confirm(t.confirmReject)) return;
        try {
            // 1. Resolve in Backend Proxy
            try {
                await fetch(`${proxyBase}/api/members/resolve-upgrade`, {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ id: requestId, action: 'rejected' })
                });
            } catch (beErr) {
                console.warn('Backend resolve-upgrade reject error:', beErr);
            }

            // 2. Update Supabase (if table exists)
            try {
                await supabase
                    .from('membership_requests')
                    .update({
                        status: 'rejected',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', requestId);
            } catch (sbErr) {}

            setStatus({ type: 'success', message: t.userRejected });
            fetchUpgradeRequests();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Hata oluştu' });
        }
    };

    const fetchSystemSettings = async () => {
        setSettingsLoading(true);
        try {
            const { data, error } = await supabase.from('system_settings').select('*');
            if (!error && data) {
                const settingsObj = {};
                data.forEach(item => {
                    settingsObj[item.key] = item.value;
                });
                setSystemSettings(settingsObj);
            }
        } catch (e) {
            console.warn('Error fetching system settings:', e);
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            const updates = Object.entries(systemSettings).map(([key, value]) => ({
                key, value, updated_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('system_settings')
                .upsert(updates);

            if (error) throw error;
            setStatus({ type: 'success', message: t.settingsUpdated });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Ayarlar güncellenirken hata oluştu' });
        }
        setSettingsLoading(false);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setStatus({ type: 'info', message: lang === 'tr' ? 'Kullanıcı oluşturuluyor...' : (lang === 'de' ? 'Benutzer wird erstellt...' : 'Creating user...') });
        const proxyBase = getProxyBase();

        // 1. Create in Backend API
        try {
            await fetch(`${proxyBase}/api/members/create`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ email, password, plan: selectedPlan, days: subscriptionDays })
            });
        } catch (e) {}

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + subscriptionDays);

        // 2. Also create in Supabase Auth & Profiles
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: 'user'
                    }
                }
            });

            if (data?.user) {
                await supabase
                    .from('profiles')
                    .update({
                        status: 'approved',
                        subscription_start: startDate.toISOString(),
                        subscription_end: endDate.toISOString(),
                        approved_at: new Date().toISOString(),
                        plan: selectedPlan
                    })
                    .eq('id', data.user.id);
            }
        } catch (sbErr) {
            console.warn('Supabase create user error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userCreated });
        setEmail('');
        setPassword('');
        fetchProfiles();
    };

    const approveUser = async (profile, days = subscriptionDays, plan = selectedPlan) => {
        const proxyBase = getProxyBase();
        const effectivePlan = plan || profile.plan || 'trial';
        const effectiveDays = (effectivePlan === 'trial' && days === subscriptionDays) ? 3 : days;
        
        // 1. Update backend proxy
        try {
            await fetch(`${proxyBase}/api/members/approve`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ id: profile.id, email: profile.email, days: effectiveDays, plan: effectivePlan })
            });
        } catch (e) {}

        // 2. Update Supabase profiles
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + effectiveDays);

        try {
            const updates = {
                status: 'approved',
                subscription_start: startDate.toISOString(),
                subscription_end: endDate.toISOString(),
                approved_at: new Date().toISOString(),
                plan: effectivePlan
            };
            let query = supabase.from('profiles').update(updates);
            if (profile.id && profile.email) {
                query = query.or(`id.eq.${profile.id},email.eq.${profile.email}`);
            } else if (profile.id) {
                query = query.eq('id', profile.id);
            } else if (profile.email) {
                query = query.eq('email', profile.email);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase approve error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userApproved });
        fetchProfiles();
    };

    const rejectUser = async (profileOrId) => {
        if (!confirm(t.confirmReject)) return;
        const id = typeof profileOrId === 'object' ? profileOrId.id : profileOrId;
        const email = typeof profileOrId === 'object' ? profileOrId.email : null;
        const proxyBase = getProxyBase();

        // 1. Update backend proxy
        try {
            await fetch(`${proxyBase}/api/members/reject`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ id, email })
            });
        } catch (e) {}

        // 2. Update Supabase
        try {
            let query = supabase.from('profiles').update({ status: 'rejected' });
            if (id && email) {
                query = query.or(`id.eq.${id},email.eq.${email}`);
            } else if (id) {
                query = query.eq('id', id);
            } else if (email) {
                query = query.eq('email', email);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase reject error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userRejected });
        fetchProfiles();
    };

    const toggleBan = async (id, isBanned) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_banned: !isBanned })
            .eq('id', id);

        if (error) {
            setStatus({ type: 'error', message: error.message });
        } else {
            fetchProfiles();
        }
    };

    const deleteUser = async (profileOrId) => {
        if (!confirm(t.confirmDelete)) return;
        const id = typeof profileOrId === 'object' ? profileOrId.id : profileOrId;
        const email = typeof profileOrId === 'object' ? profileOrId.email : null;
        const proxyBase = getProxyBase();

        // 1. Delete from backend proxy
        try {
            await fetch(`${proxyBase}/api/members/delete`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ id, email })
            });
        } catch (e) {}

        // 2. Delete from Supabase
        try {
            let query = supabase.from('profiles').delete();
            if (id && email) {
                query = query.or(`id.eq.${id},email.eq.${email}`);
            } else if (id) {
                query = query.eq('id', id);
            } else if (email) {
                query = query.eq('email', email);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase delete error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userDeleted });
        fetchProfiles();
    };

    const updateSubscription = async (profileId, days, plan, userEmail = null, resetExactDays = null) => {
        const proxyBase = getProxyBase();
        const currentProfile = profiles.find(p => (profileId && p.id === profileId) || (userEmail && (p.email || '').toLowerCase() === userEmail.toLowerCase()));
        
        let targetEnd = null;
        if (resetExactDays) {
            targetEnd = new Date(Date.now() + resetExactDays * 24 * 60 * 60 * 1000).toISOString();
        } else if (days !== undefined && days !== null && Number(days) !== 0) {
            let baseDate = currentProfile?.subscription_end ? new Date(currentProfile.subscription_end) : new Date();
            if (isNaN(baseDate.getTime()) || baseDate < new Date()) baseDate = new Date();
            targetEnd = new Date(baseDate.getTime() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
        }

        const updates = {
            status: 'approved'
        };
        if (targetEnd) updates.subscription_end = targetEnd;
        if (plan) updates.plan = plan;

        // 1. Immediate optimistic UI update so the table and modal update instantly
        setProfiles(prev => prev.map(p => {
            const matches = (profileId && p.id === profileId) || 
                            (userEmail && (p.email || '').toLowerCase() === (userEmail || '').toLowerCase());
            if (matches) {
                return {
                    ...p,
                    ...updates,
                    plan: plan || p.plan || 'trial',
                    subscription_end: targetEnd || p.subscription_end,
                    status: 'approved'
                };
            }
            return p;
        }));

        // 2. Update backend proxy (authoritative source)
        try {
            const res = await fetch(`${proxyBase}/api/members/extend`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ 
                    id: profileId, 
                    email: userEmail || currentProfile?.email,
                    days: days !== undefined && days !== null ? days : null,
                    plan: plan || null,
                    resetDays: resetExactDays || null
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.member) {
                    setProfiles(prev => prev.map(p => {
                        const matches = (profileId && p.id === profileId) || 
                                        (userEmail && (p.email || '').toLowerCase() === (userEmail || '').toLowerCase());
                        if (matches) {
                            return {
                                ...p,
                                ...data.member,
                                id: p.id || data.member.id
                            };
                        }
                        return p;
                    }));
                }
            }
        } catch (e) {
            console.error('Backend extend error:', e);
        }

        // 3. Update Supabase
        try {
            const cleanEmail = (userEmail || currentProfile?.email || '').trim().toLowerCase();
            if (cleanEmail) {
                await supabase.from('profiles').update(updates).eq('email', cleanEmail);
            } else if (profileId) {
                await supabase.from('profiles').update(updates).eq('id', profileId);
            }
        } catch (sbErr) {
            console.warn('Supabase update subscription error:', sbErr);
        }

        const successText = days ? `+${days} gün eklendi!` : (resetExactDays ? `${resetExactDays} gün tanımlandı!` : (plan ? `Paket ${plan.toUpperCase()} olarak güncellendi!` : t.subscriptionUpdated));
        setStatus({ type: 'success', message: successText });
        fetchProfiles();
    };

    const getStatusInfo = (profile) => {
        if (profile.is_banned) {
            return { label: t.statusBanned, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
        }
        if (profile.status === 'rejected') {
            return { label: t.statusRejected, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
        }
        if (profile.status === 'pending_telegram') {
            return { label: lang === 'tr' ? 'TELEGRAM ONAYI BEKLİYOR' : (lang === 'de' ? 'TELEGRAM WARTEND' : 'PENDING TELEGRAM'), color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' };
        }
        if (profile.status === 'pending' || !profile.status) {
            return { label: t.statusPending, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' };
        }
        if (profile.subscription_end) {
            const endDate = new Date(profile.subscription_end);
            if (endDate < new Date()) {
                return { label: t.statusExpired, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' };
            }
        }
        return { label: t.statusApproved, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    };

    const getRemainingDays = (endDate) => {
        if (!endDate) return '-';
        const end = new Date(endDate);
        const now = new Date();
        const diffMs = end - now;
        if (diffMs <= 0) return lang === 'tr' ? 'Doldu' : (lang === 'de' ? 'Abgelaufen' : 'Expired');
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        if (diffHours <= 24) return `${diffHours} ${lang === 'tr' ? 'saat' : (lang === 'de' ? 'Std.' : 'hours')}`;
        const diffDays = Math.ceil(diffHours / 24);
        return `${diffDays} ${t.days}`;
    };

    const filteredProfiles = profiles.filter(p => {
        if (activeTab === 'pending') return p.status === 'pending' || (!p.status && !p.is_banned);
        if (activeTab === 'active') {
            const statusInfo = getStatusInfo(p);
            return statusInfo.label === t.statusApproved;
        }
        return true;
    });

    const pendingCount = profiles.filter(p => p.status === 'pending' || (!p.status && !p.is_banned)).length;

    return (
        <div className="admin-container" style={{ color: '#fff' }}>
            {/* 🛡️ INTERNAL AUDIT & OPERATIONS WATCHDOG COCKPIT */}
            <AuditCockpit
                lang={lang}
                proxyBase={getProxyBase()}
                getAdminHeaders={getAdminHeaders}
                onRefreshRequest={fetchProfiles}
            />

            {/* Add New Member Form */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--warning-color)' }}>
                <h2 style={{ color: 'var(--warning-color)', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                    {t.title}
                </h2>

                <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(150px, 1fr) 100px 120px 100px', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.email}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="musteri@mail.com"
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.tempPass}</label>
                        <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="sifre123"
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.duration}</label>
                        <select
                            value={subscriptionDays}
                            onChange={(e) => setSubscriptionDays(parseInt(e.target.value))}
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                        >
                            <option value={3}>3 {lang === 'tr' ? 'gün (3 Günlük Deneme / 72s)' : (lang === 'de' ? 'Tage (3-Tage-Test / 72h)' : 'days (3-Day Trial / 72h)')}</option>
                            <option value={7}>7 {lang === 'tr' ? 'gün (1 Hafta)' : (lang === 'de' ? 'Tage (1 Woche)' : 'days (1 Week)')}</option>
                            <option value={30}>30 {lang === 'tr' ? 'gün (1 Ay)' : (lang === 'de' ? 'Tage (1 Monat)' : 'days (1 Month)')}</option>
                            <option value={90}>90 {lang === 'tr' ? 'gün (3 Ay)' : (lang === 'de' ? 'Tage (3 Monate)' : 'days (3 Months)')}</option>
                            <option value={180}>180 {lang === 'tr' ? 'gün (6 Ay)' : (lang === 'de' ? 'Tage (6 Monate)' : 'days (6 Months)')}</option>
                            <option value={365}>365 {lang === 'tr' ? 'gün (1 Yıl)' : (lang === 'de' ? 'Tage (1 Jahr)' : 'days (1 Year)')}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.plan}</label>
                        <select
                            value={selectedPlan}
                            onChange={(e) => {
                                const p = e.target.value;
                                setSelectedPlan(p);
                                if (p === 'trial') setSubscriptionDays(3);
                                else if (subscriptionDays === 3) setSubscriptionDays(30);
                            }}
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                        >
                            <option value="trial">Trial (Deneme)</option>
                            <option value="pro">Pro</option>
                            <option value="premium">Premium</option>
                        </select>
                    </div>
                    <button type="submit" style={{ padding: '0.8rem', background: 'var(--warning-color)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
                        {t.addMember}
                    </button>
                </form>

                {status.message && (
                    <div style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '8px', background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)', color: status.type === 'error' ? '#ef4444' : status.type === 'success' ? '#10b981' : '#38bdf8', fontSize: '0.85rem', border: '1px solid currentColor' }}>
                        {status.message}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setActiveTab('pending')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'pending' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'pending' ? '#fbbf24' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'pending' ? '#fbbf24' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {t.tabPending}
                    {pendingCount > 0 && (
                        <span style={{
                            background: '#fbbf24',
                            color: '#000',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 900
                        }}>
                            {pendingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('active')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'active' ? '#10b981' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'active' ? '#10b981' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                    }}
                >
                    {t.tabActive}
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'all' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'all' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                    }}
                >
                    {t.tabAll} ({profiles.length})
                </button>
                <button
                    onClick={() => setActiveTab('upgrades')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'upgrades' ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'upgrades' ? '#a78bfa' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'upgrades' ? '#a78bfa' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {t.tabUpgrades}
                    {upgradeRequests.length > 0 && (
                        <span style={{
                            background: '#a78bfa',
                            color: '#000',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 900
                        }}>
                            {upgradeRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'settings' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'settings' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'settings' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    ⚙️ {t.tabSettings}
                </button>
                <button
                    onClick={() => setActiveTab('telegram')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'telegram' ? 'rgba(37, 211, 102, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'telegram' ? '#25D366' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'telegram' ? '#25D366' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    📱 {t.tabTelegram}
                </button>
                <button
                    onClick={() => { setActiveTab('office'); fetchOfficeStatus(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'office' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(56, 189, 248, 0.2))' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'office' ? '#10b981' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'office' ? '#10b981' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'office' ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                >
                    🤖 {t.tabOffice}
                </button>
                <button
                    onClick={() => setActiveTab('trading_desk')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'trading_desk' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(168, 85, 247, 0.25))' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'trading_desk' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'trading_desk' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'trading_desk' ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none'
                    }}
                >
                    <span>🏦</span>
                    <span>{lang === 'tr' ? 'BAHİS OFİSİ (KUANT DESK)' : (lang === 'de' ? 'WETTBÜRO (QUANT DESK)' : 'SPORTSBOOK DESK')}</span>
                    <span style={{
                        background: '#38bdf8',
                        color: '#000',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '8px',
                        fontSize: '0.65rem',
                        fontWeight: 900
                    }}>
                        PRO
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('web_analytics')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'web_analytics' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'web_analytics' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'web_analytics' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    📊 {t.tabWebAnalytics}
                </button>
                <button
                    onClick={() => { setActiveTab('analytics'); loadStrategyAnalytics(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'analytics' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'analytics' ? '#eab308' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'analytics' ? '#eab308' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    🎯 {t.tabAnalytics}
                </button>
                <button
                    onClick={() => { setActiveTab('support_staff'); fetchSupportData(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'support_staff' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(56, 189, 248, 0.2))' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'support_staff' ? '#10b981' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'support_staff' ? '#10b981' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'support_staff' ? '0 0 15px rgba(16, 185, 129, 0.25)' : 'none'
                    }}
                >
                    <span>🎧</span>
                    <span>{t.tabSupportStaff || 'CANLI DESTEK & PERSONEL'}</span>
                    {supportSessions.filter(s => s.status === 'waiting_admin').length > 0 && (
                        <span style={{
                            background: '#ef4444',
                            color: '#fff',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '8px',
                            fontSize: '0.65rem',
                            fontWeight: 900
                        }}>
                            {supportSessions.filter(s => s.status === 'waiting_admin').length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'audit' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(245, 158, 11, 0.25))' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'audit' ? '#ef4444' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'audit' ? '#ef4444' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'audit' ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none'
                    }}
                >
                    <span>🛡️</span>
                    <span>{t.tabAudit || 'İÇ DENETİM & KONTROL KULESİ'}</span>
                    <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '8px',
                        fontSize: '0.65rem',
                        fontWeight: 900
                    }}>
                        CANLI
                    </span>
                </button>
            </div>

            {/* Content Section */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                {supabaseOffline && profiles.length === 0 && (
                    <div style={{
                        padding: '0.8rem 1.2rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                    }}>
                        <span>💾</span>
                        <span>
                            {lang === 'tr'
                                ? 'Bulut veritabanı beklemede. Sistem yerel/backend depolama modunda sorunsuz çalışmaktadır.'
                                : 'Cloud database is in standby. System running in backend storage mode.'}
                        </span>
                    </div>
                )}
                {activeTab !== 'web_analytics' && activeTab !== 'trading_desk' && activeTab !== 'support_staff' && activeTab !== 'audit' && (
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 800 }}>
                        {activeTab === 'upgrades' ? t.tabUpgrades : activeTab === 'settings' ? t.tabSettings : activeTab === 'analytics' ? t.strategyScorecardTitle : activeTab === 'office' ? t.tabOffice : t.memberList}
                    </h3>
                )}

                {activeTab === 'support_staff' ? (
                    <SupportStaffDesk
                        lang={lang}
                        supportOperators={supportOperators}
                        supportSessions={supportSessions}
                        supportLoading={supportLoading}
                        activeSupportSession={activeSupportSession}
                        sessionChatLoading={sessionChatLoading}
                        adminSupportReply={adminSupportReply}
                        setAdminSupportReply={setAdminSupportReply}
                        replySending={replySending}
                        supportSubTab={supportSubTab}
                        setSupportSubTab={setSupportSubTab}
                        supportFilter={supportFilter}
                        setSupportFilter={setSupportFilter}
                        newOpName={newOpName}
                        setNewOpName={setNewOpName}
                        newOpChatId={newOpChatId}
                        setNewOpChatId={setNewOpChatId}
                        newOpUsername={newOpUsername}
                        setNewOpUsername={setNewOpUsername}
                        newOpEmail={newOpEmail}
                        setNewOpEmail={setNewOpEmail}
                        selectedMemberForOp={selectedMemberForOp}
                        setSelectedMemberForOp={setSelectedMemberForOp}
                        profiles={profiles}
                        fetchSupportData={fetchSupportData}
                        fetchSessionDetail={fetchSessionDetail}
                        handleSendSupportReply={handleSendSupportReply}
                        handleAddOperator={handleAddOperator}
                        handleToggleOperator={handleToggleOperator}
                        handleDeleteOperator={handleDeleteOperator}
                        handleCloseSupportSession={handleCloseSupportSession}
                        handleArchiveSupportSession={handleArchiveSupportSession}
                        handleUnarchiveSupportSession={handleUnarchiveSupportSession}
                        handleDeleteSupportSession={handleDeleteSupportSession}
                        handleClearClosedSessions={handleClearClosedSessions}
                        handleGrantVipFromChat={handleGrantVipFromChat}
                        targetTelegramSessionId={initialSessionId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') : null)}
                    />
                ) : activeTab === 'audit' ? (
                    <AuditCockpit
                        lang={lang}
                        proxyBase={getProxyBase()}
                        getAdminHeaders={getAdminHeaders}
                        onRefreshRequest={fetchProfiles}
                        mode="full"
                    />
                ) : activeTab === 'web_analytics' ? (
                    <AnalyticsDashboard lang={lang} />
                ) : activeTab === 'trading_desk' ? (
                    <TradingDesk lang={lang} />
                ) : activeTab === 'office' ? (
                    <div style={{ maxWidth: '1100px' }}>
                        {/* Header Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            padding: '1.2rem',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(56, 189, 248, 0.05))',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            marginBottom: '2rem'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⚡</span>
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                                        {lang === 'tr' ? '7/24 OTONOM NÖBET DURUMU' : (lang === 'de' ? '24/7 AUTONOMER SCHICHT-STATUS' : '24/7 AUTONOMOUS SHIFT STATUS')}
                                    </span>
                                    <span style={{
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '20px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        background: officeStatus?.autoModeEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: officeStatus?.autoModeEnabled ? '#10b981' : '#ef4444',
                                        border: `1px solid ${officeStatus?.autoModeEnabled ? '#10b981' : '#ef4444'}`
                                    }}>
                                        {officeStatus?.autoModeEnabled ? (lang === 'tr' ? 'OTONOM MOD: AKTİF' : (lang === 'de' ? 'AUTONOMER MODUS: AKTIV' : 'AUTONOMOUS: ACTIVE')) : (lang === 'tr' ? 'OTONOM MOD: DEVRE DIŞI' : (lang === 'de' ? 'AUTONOMER MODUS: DEAKTIVIERT' : 'AUTONOMOUS: DISABLED'))}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.3rem' }}>
                                    {lang === 'tr'
                                        ? '3 Görevli (Nöbetçi, Tahsildar, Pazarlamacı) arka planda 60 saniyede bir otonom döngü yürütür.'
                                        : '3 Agents (Sentinel, Cashier, Marketing) run background autonomous cycle every 60s.'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button
                                    onClick={() => handleOfficeAction('toggle_auto_mode')}
                                    disabled={officeActionLoading}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        background: officeStatus?.autoModeEnabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.2)',
                                        color: officeStatus?.autoModeEnabled ? '#ef4444' : '#10b981',
                                        border: `1px solid ${officeStatus?.autoModeEnabled ? '#ef4444' : '#10b981'}`
                                    }}
                                >
                                    {officeStatus?.autoModeEnabled ? (lang === 'tr' ? '⏸️ Otonomu Durdur' : (lang === 'de' ? '⏸️ Autonom pausieren' : '⏸️ Pause Auto')) : (lang === 'tr' ? '▶️ Otonomu Başlat' : (lang === 'de' ? '▶️ Autonom starten' : '▶️ Resume Auto'))}
                                </button>
                                <button
                                    onClick={fetchOfficeStatus}
                                    disabled={officeLoading}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#38bdf8',
                                        border: '1px solid #38bdf8'
                                    }}
                                >
                                    {officeLoading ? '...' : (lang === 'tr' ? '🔄 Yenile' : (lang === 'de' ? '🔄 Aktualisieren' : '🔄 Refresh'))}
                                </button>
                            </div>
                        </div>

                        {/* 3 Agents Mission Deck */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            
                            {/* 1. NÖBETÇİ CARD */}
                            <div className="glass-panel" style={{
                                padding: '1.5rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                🛡️ {lang === 'tr' ? 'NÖBETÇİ' : (lang === 'de' ? 'WÄCHTER' : 'SENTINEL')}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang === 'tr' ? 'Sistem & Risk Bekçisi' : (lang === 'de' ? 'System- & Risikowächter' : 'System & Risk Guardian')}</div>
                                        </div>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            background: officeStatus?.sentinel?.status === 'HEALTHY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                            color: officeStatus?.sentinel?.status === 'HEALTHY' ? '#10b981' : '#f59e0b',
                                            border: `1px solid ${officeStatus?.sentinel?.status === 'HEALTHY' ? '#10b981' : '#f59e0b'}`
                                        }}>
                                            {officeStatus?.sentinel?.status || 'HEALTHY'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Canlı Maç Havuzu:' : (lang === 'de' ? 'Live-Spielpool:' : 'Live Matches:')}</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>{officeStatus?.sentinel?.liveMatchCount || 0} maç</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Veri Tazeliği (Gecikme):' : (lang === 'de' ? 'Datenaktualität (Latenz):' : 'Data Freshness:')}</span>
                                            <span style={{ fontWeight: 800, color: (officeStatus?.sentinel?.sofascoreAgeSec > 180 ? '#f59e0b' : '#10b981') }}>
                                                {officeStatus?.sentinel?.sofascoreAgeSec !== null ? `${officeStatus?.sentinel?.sofascoreAgeSec}s` : 'Beklemede'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Karantinadaki Ligler:' : (lang === 'de' ? 'Ligen in Quarantäne:' : 'Quarantined Leagues:') }</span>
                                            <span style={{ fontWeight: 800, color: (officeStatus?.sentinel?.quarantinedLeagues?.length > 0 ? '#ef4444' : '#10b981') }}>
                                                {officeStatus?.sentinel?.quarantinedLeagues?.length || 0} lig
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleOfficeAction('sentinel_scan_now')}
                                        disabled={officeActionLoading}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            background: 'rgba(56, 189, 248, 0.15)',
                                            color: '#38bdf8',
                                            border: '1px solid rgba(56, 189, 248, 0.3)',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🔍 {lang === 'tr' ? 'Şimdi Tara' : (lang === 'de' ? 'Jetzt scannen' : 'Scan Now')}
                                    </button>
                                    <button
                                        onClick={() => handleOfficeAction('sentinel_heal_locks')}
                                        disabled={officeActionLoading}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🧹 {lang === 'tr' ? 'Kilit Sıfırla' : (lang === 'de' ? 'Sperren leeren' : 'Clear Locks')}
                                    </button>
                                </div>
                            </div>

                            {/* 2. TAHSİLDAR CARD */}
                            <div className="glass-panel" style={{
                                padding: '1.5rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                💰 {lang === 'tr' ? 'TAHSİLDAR' : (lang === 'de' ? 'KASSIERER' : 'CASHIER')}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang === 'tr' ? 'Kasa & Satış Yöneticisi' : (lang === 'de' ? 'Kassen- & Verkaufsmanager' : 'Sales & Access Bot')}</div>
                                        </div>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#10b981',
                                            border: '1px solid #10b981'
                                        }}>
                                            {lang === 'tr' ? 'NÖBETTE' : (lang === 'de' ? 'IM DIENST' : 'ACTIVE')}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Aktif VIP Üye Sayısı:' : (lang === 'de' ? 'Aktive VIP-Mitglieder:' : 'Active VIP Members:')}</span>
                                            <span style={{ fontWeight: 800, color: '#10b981' }}>{officeStatus?.cashier?.activeVipCount || 0} üye</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? '3 Günlük Deneme (Aktif / Bitiyor):' : (lang === 'de' ? '3-Tage-Test (Aktiv / Endend):' : '3-Day Trials (Active/Soon):')}</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>
                                                {officeStatus?.cashier?.activeTrialCount || 0} / <span style={{ color: '#f59e0b' }}>{officeStatus?.cashier?.expiringSoonCount || 0}</span>
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Tahmini MRR (Aylık Gelir):' : (lang === 'de' ? 'Geschätzter MRR (Monatsumsatz):' : 'Estimated MRR:')}</span>
                                            <span style={{ fontWeight: 800, color: '#38bdf8' }}>{officeStatus?.cashier?.estimatedMrr || '€0.00'}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOfficeAction('cashier_send_campaign')}
                                    disabled={officeActionLoading}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: '6px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🚀 {lang === 'tr' ? 'Biten Denemelere Kampanya At' : (lang === 'de' ? 'Kampagne an abgelaufene Tests senden' : 'Offer Expired Trials')}
                                </button>
                            </div>

                            {/* 3. PAZARLAMACI CARD */}
                            <div className="glass-panel" style={{
                                padding: '1.5rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(167, 139, 250, 0.25)',
                                background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                📢 {lang === 'tr' ? 'PAZARLAMACI' : (lang === 'de' ? 'MARKETING' : 'MARKETING')}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang === 'tr' ? 'FOMO & Sosyal Kanıt Botu' : (lang === 'de' ? 'FOMO & Social-Proof-Bot' : 'FOMO & Social Proof Bot')}</div>
                                        </div>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            background: 'rgba(167, 139, 250, 0.2)',
                                            color: '#a78bfa',
                                            border: '1px solid #a78bfa'
                                        }}>
                                            {lang === 'tr' ? 'HAZIR' : (lang === 'de' ? 'BEREIT' : 'READY')}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Bugünkü Skor (K/K):' : (lang === 'de' ? 'Heutige Bilanz (G/V):' : 'Today W/L:')}</span>
                                            <span style={{ fontWeight: 800, color: '#10b981' }}>
                                                {officeStatus?.marketing?.todayWon || 0}W / {officeStatus?.marketing?.todayLost || 0}L (%{officeStatus?.marketing?.winRate || '0.0'})
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Basılan FOMO Afişi:' : (lang === 'de' ? 'Gesendete FOMO-Karten:' : 'FOMO Cards Sent:') }</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>{officeStatus?.marketing?.fomoCardsDispatched || 0} adet</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Son Sinyal:' : (lang === 'de' ? 'Letztes Signal:' : 'Last Signal:')}</span>
                                            <span style={{ fontWeight: 800, color: '#38bdf8', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {officeStatus?.marketing?.lastSignal || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOfficeAction('marketing_daily_recap')}
                                    disabled={officeActionLoading}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: '6px',
                                        background: 'rgba(167, 139, 250, 0.15)',
                                        color: '#a78bfa',
                                        border: '1px solid rgba(167, 139, 250, 0.3)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    📢 {lang === 'tr' ? 'Günün ROI Raporunu Kanala Fırlat' : (lang === 'de' ? 'Tages-ROI-Bericht im Kanal teilen' : 'Broadcast Daily ROI Recap')}
                                </button>
                            </div>
                        </div>

                        {/* LIVE ACTION FEED (Console Log) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>📜</span>
                                    <span>{lang === 'tr' ? 'OTONOM OLAY VE KARAR AKIŞI' : (lang === 'de' ? 'AUTONOMER ENTSCHEIDUNGS- & AKTIONEN-STREAM' : 'AUTONOMOUS DECISION & ACTION FEED')}</span>
                                </div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{lang === 'tr' ? 'Son 30 Aksiyon' : (lang === 'de' ? 'Letzte 30 Aktionen' : 'Last 30 Actions')}</span>
                            </div>

                            <div style={{
                                background: '#0a0f1d',
                                borderRadius: '10px',
                                padding: '1rem',
                                maxHeight: '320px',
                                overflowY: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                {(!officeStatus?.recentLogs || officeStatus.recentLogs.length === 0) ? (
                                    <div style={{ opacity: 0.4, textAlign: 'center', padding: '1rem' }}>
                                        {lang === 'tr' ? 'Henüz kaydedilmiş otonom işlem bulunmuyor.' : (lang === 'de' ? 'Noch keine autonomen Aktionen aufgezeichnet.' : 'No recorded autonomous actions yet.')}
                                    </div>
                                ) : (
                                    officeStatus.recentLogs.map((log) => {
                                        const agentColors = {
                                            SENTINEL: '#38bdf8',
                                            CASHIER: '#10b981',
                                            MARKETING: '#a78bfa',
                                            OFFICE: '#f59e0b'
                                        };
                                        const color = agentColors[log.agent] || '#94a3b8';
                                        const time = new Date(log.timestamp).toLocaleTimeString('tr-TR');

                                        return (
                                            <div key={log.id} style={{
                                                display: 'flex',
                                                gap: '0.8rem',
                                                padding: '0.4rem 0',
                                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                                alignItems: 'flex-start'
                                            }}>
                                                <span style={{ color: '#64748b', flexShrink: 0 }}>[{time}]</span>
                                                <span style={{
                                                    color,
                                                    fontWeight: 700,
                                                    flexShrink: 0,
                                                    padding: '0 4px',
                                                    background: `${color}15`,
                                                    borderRadius: '4px'
                                                }}>
                                                    {log.agent}
                                                </span>
                                                <span style={{ color: '#e2e8f0', flex: 1 }}>{log.message}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : loading ? (
                    <p>{t.loading}</p>
                ) : activeTab === 'upgrades' ? (
                    upgradeRequests.length === 0 ? (
                        <p style={{ color: '#64748b' }}>{t.noUsers}</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                        <th style={{ padding: '1rem' }}>{t.emailCol}</th>
                                        <th style={{ padding: '1rem' }}>{t.currentPlan}</th>
                                        <th style={{ padding: '1rem' }}>{t.requestedPlan}</th>
                                        <th style={{ padding: '1rem' }}>{t.dateCol}</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>{t.actionsCol}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upgradeRequests.map(req => (
                                        <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{req.email}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                                                    {(req.current_plan || 'trial').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                                                    {(req.requested_plan || '').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(req.created_at).toLocaleDateString('tr-TR')}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => approveUpgrade(req)}
                                                        style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                    >
                                                        {t.approve}
                                                    </button>
                                                    <button
                                                        onClick={() => rejectUpgrade(req.id)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                    >
                                                        {t.reject}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : activeTab === 'settings' ? (
                    <div style={{ maxWidth: '800px' }}>
                        {/* MODULAR STRATEGY GRID (v2.1) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {t.strategyTitle}
                            </h3>
                            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '1.5rem' }}>{t.strategyDesc}</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                <StrategyToggle label={t.onlyXG} active={strategySettings.ONLY_XG} onToggle={() => handleToggleStrategy('ONLY_XG')} highlight />
                                <StrategyToggle label={t.stratPress} active={strategySettings.PRESS} onToggle={() => handleToggleStrategy('PRESS')} />
                                <StrategyToggle label={t.stratMomentum} active={strategySettings.MOMENTUM} onToggle={() => handleToggleStrategy('MOMENTUM')} />
                                <StrategyToggle label={t.stratFHG} active={strategySettings.FHG} onToggle={() => handleToggleStrategy('FHG')} />
                                <StrategyToggle label={t.stratComeback} active={strategySettings.COMEBACK} onToggle={() => handleToggleStrategy('COMEBACK')} />
                                <StrategyToggle label={t.stratStats} active={strategySettings.STATS} onToggle={() => handleToggleStrategy('STATS')} />
                                <StrategyToggle label={t.stratCorners} active={strategySettings.CORNERS} onToggle={() => handleToggleStrategy('CORNERS')} />
                                <StrategyToggle label={t.stratBTTS} active={strategySettings.BTTS} onToggle={() => handleToggleStrategy('BTTS')} />
                                <StrategyToggle label={t.stratRedCard} active={strategySettings.RED_CARD_ADV !== false} onToggle={() => handleToggleStrategy('RED_CARD_ADV')} />
                            </div>
                        </div>

                        <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.telegramSupport}</label>
                                    <input
                                        type="text"
                                        placeholder="@Livebetdeskbot"
                                        value={systemSettings.telegram_support || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, telegram_support: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.supportEmail}</label>
                                    <input
                                        type="email"
                                        value={systemSettings.support_email || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, support_email: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                                    💳 {lang === 'tr' ? 'Shopier Kredi Kartı Ödeme / Mağaza Linki' : (lang === 'de' ? 'Shopier Kreditkarten-Zahlungslink / Shop' : 'Shopier Payment / Store Link')}
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://www.shopier.com/QuantDataLabs"
                                    value={systemSettings.shopier_link || ''}
                                    onChange={(e) => setSystemSettings({ ...systemSettings, shopier_link: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                />
                                <span style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '0.3rem', display: 'block' }}>
                                    {lang === 'tr' ? 'Kullanıcılar web panelinde veya Telegram botunda kredi kartı ile öde butonuna bastığında bu linke yönlendirilir.' : (lang === 'de' ? 'Benutzer werden auf diesen Link weitergeleitet, wenn sie im Web-Panel oder im Telegram-Bot auf Kartenzahlung klicken.' : 'Users will be redirected to this URL when clicking Pay with Card.')}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.proPrice}</label>
                                    <input
                                        type="text"
                                        value={systemSettings.price_pro || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, price_pro: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.premiumPrice}</label>
                                    <input
                                        type="text"
                                        value={systemSettings.price_premium || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, price_premium: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.currency}</label>
                                    <input
                                        type="text"
                                        value={systemSettings.price_currency || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, price_currency: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={settingsLoading}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--accent-color)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    cursor: settingsLoading ? 'not-allowed' : 'pointer',
                                    marginTop: '1rem',
                                    opacity: settingsLoading ? 0.7 : 1
                                }}
                            >
                                {settingsLoading ? t.loading : t.saveSettings}
                            </button>
                        </form>
                    </div>
                ) : activeTab === 'telegram' ? (
                    <div style={{ maxWidth: '800px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div className="stats-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t.botStatus}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: telegramStatus?.enabled ? '#10b981' : '#ef4444', boxShadow: telegramStatus?.enabled ? '0 0 10px #10b981' : 'none' }}></div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: telegramStatus?.enabled ? '#10b981' : '#ef4444' }}>
                                        {telegramStatus?.enabled ? t.botActive : t.botInactive}
                                    </div>
                                </div>
                            </div>
                            <div className="stats-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t.signalsToday}</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-color)' }}>{telegramStatus?.todaySignals || 0}</div>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '1.2rem', opacity: 0.8 }}>Bot Konfigürasyonu</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>{t.vipGroupId} (TR / EN / DE)</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                            🇹🇷 {telegramStatus?.vipChannels?.tr || telegramStatus?.vipGroup || '-'}
                                        </div>
                                        {telegramStatus?.vipChannels?.en && (
                                            <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                                                🇬🇧 {telegramStatus.vipChannels.en}
                                            </div>
                                        )}
                                        {telegramStatus?.vipChannels?.de && (
                                            <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '2px' }}>
                                                🇩🇪 {telegramStatus.vipChannels.de}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>{t.publicChannel}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{telegramStatus?.publicChannel || 'Ayarlanmadı'}</div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>{t.minLevel}</div>
                                        <div style={{ display: 'inline-block', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900 }}>
                                            {telegramStatus?.minLevel || 'SICAK'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.4rem' }}>
                                            {lang === 'tr' ? 'Telegram Yayın Dili' : lang === 'de' ? 'Telegram Übertragungssprache' : 'Telegram Broadcast Language'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateTelegramLang('tr')}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    border: (telegramStatus?.lang === 'tr' || !telegramStatus?.lang) ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                                    background: (telegramStatus?.lang === 'tr' || !telegramStatus?.lang) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                                                    color: (telegramStatus?.lang === 'tr' || !telegramStatus?.lang) ? '#10b981' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🇹🇷 Türkçe
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateTelegramLang('en')}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    border: telegramStatus?.lang === 'en' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                                                    background: telegramStatus?.lang === 'en' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                                                    color: telegramStatus?.lang === 'en' ? '#38bdf8' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🇬🇧 English
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateTelegramLang('de')}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    border: telegramStatus?.lang === 'de' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                                                    background: telegramStatus?.lang === 'de' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.02)',
                                                    color: telegramStatus?.lang === 'de' ? '#f59e0b' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🇩🇪 Deutsch
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleSendTelegramReport}
                                disabled={telegramLoading || !telegramStatus?.enabled}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: '#25D366',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 900,
                                    fontSize: '0.85rem',
                                    cursor: (telegramLoading || !telegramStatus?.enabled) ? 'not-allowed' : 'pointer',
                                    opacity: (telegramLoading || !telegramStatus?.enabled) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.6rem'
                                }}
                            >
                                📊 {telegramLoading ? t.loading : t.sendTestReport}
                            </button>
                            <button
                                onClick={fetchTelegramStatus}
                                style={{
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 {t.refreshStatus}
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'analytics' ? (
                    <div>
                        {(() => {
                            const totalBets = strategyAnalytics.reduce((acc, s) => acc + (s.totalBets || 0), 0);
                            const totalStaked = strategyAnalytics.reduce((acc, s) => acc + (s.staked || 0), 0);
                            const totalProfit = strategyAnalytics.reduce((acc, s) => acc + (s.profit || 0), 0);
                            const avgRoi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : '0.0';
                            const topStrat = strategyAnalytics.filter(s => s.totalBets > 0).sort((a, b) => b.roi - a.roi)[0];
                            const clv = bankrollManager.getCLVAnalytics();

                            return (
                                <>
                                    {/* KPI Summary Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem', marginBottom: '2rem' }}>
                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.totalStaked}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>₺{totalStaked.toLocaleString('tr-TR')}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>{totalBets} {t.betsCol.toLowerCase()}</div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.totalProfit}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                                {totalProfit >= 0 ? `+₺${totalProfit.toLocaleString('tr-TR')}` : `-₺${Math.abs(totalProfit).toLocaleString('tr-TR')}`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: totalProfit >= 0 ? '#10b981' : '#ef4444', marginTop: '0.2rem' }}>
                                                {totalProfit >= 0 ? '▲ Kârda' : '▼ Zararda'}
                                            </div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.avgRoi}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: parseFloat(avgRoi) >= 0 ? '#38bdf8' : '#ef4444' }}>
                                                %{avgRoi}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Kümülatif Getiri</div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.clvTitle}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: clv.avgCLV >= 0 ? '#10b981' : '#ef4444' }}>
                                                {clv.avgCLV >= 0 ? `+${clv.avgCLV}%` : `${clv.avgCLV}%`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                %{clv.beatMarketPct} {t.clvBeat}
                                            </div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.topStrategy}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span>{topStrat ? topStrat.icon : '🎯'}</span>
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topStrat ? topStrat.label : 'Veri Bekleniyor'}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                {topStrat ? `%${topStrat.roi} ROI (${topStrat.totalBets} bahis)` : 'Sinyal bekleniyor'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                                            {t.strategyScorecardDesc}
                                        </p>
                                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                                            <button
                                                onClick={loadStrategyAnalytics}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: 'rgba(56, 189, 248, 0.1)',
                                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                                    borderRadius: '8px',
                                                    color: '#38bdf8',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🔄 Yenile
                                            </button>
                                            <button
                                                onClick={handleResetStrategyStats}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    borderRadius: '8px',
                                                    color: '#ef4444',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️ {t.resetStats}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scorecard Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '0.9rem' }}>{t.stratCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.betsCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.winLossCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'right' }}>{t.stakedCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'right' }}>{t.profitCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.winRateCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'right' }}>{t.roiCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.badgeCol}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {strategyAnalytics.map(strat => {
                                                    const badgeBg = strat.badge === 'A+' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 179, 8, 0.15))'
                                                        : strat.badge === 'A' ? 'rgba(16, 185, 129, 0.2)'
                                                        : strat.badge === 'B' ? 'rgba(56, 189, 248, 0.15)'
                                                        : 'rgba(255, 255, 255, 0.05)';
                                                    const badgeColor = strat.badge === 'A+' ? '#fbbf24'
                                                        : strat.badge === 'A' ? '#10b981'
                                                        : strat.badge === 'B' ? '#38bdf8'
                                                        : '#64748b';
                                                    const badgeBorder = strat.badge === 'A+' ? '1px solid rgba(251, 191, 36, 0.4)'
                                                        : strat.badge === 'A' ? '1px solid rgba(16, 185, 129, 0.3)'
                                                        : strat.badge === 'B' ? '1px solid rgba(56, 189, 248, 0.2)'
                                                        : '1px solid rgba(255, 255, 255, 0.1)';

                                                    return (
                                                        <tr key={strat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                                                            <td style={{ padding: '1rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                    <span style={{ fontSize: '1.2rem' }}>{strat.icon}</span>
                                                                    <div>
                                                                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>{strat.label}</div>
                                                                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace' }}>ID: {strat.id}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: strat.totalBets > 0 ? '#fff' : '#64748b' }}>
                                                                {strat.totalBets}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem' }}>
                                                                <span style={{ color: '#10b981', fontWeight: 700 }}>{strat.wins || 0}W</span>
                                                                <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                                                                <span style={{ color: '#ef4444', fontWeight: 700 }}>{strat.losses || 0}L</span>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                                                ₺{(strat.staked || 0).toLocaleString('tr-TR')}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: (strat.profit || 0) > 0 ? '#10b981' : (strat.profit || 0) < 0 ? '#ef4444' : '#94a3b8' }}>
                                                                {(strat.profit || 0) > 0 ? `+₺${strat.profit.toLocaleString('tr-TR')}` : (strat.profit || 0) < 0 ? `-₺${Math.abs(strat.profit).toLocaleString('tr-TR')}` : '₺0'}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: '70px' }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: strat.winRate >= 60 ? '#10b981' : strat.winRate >= 40 ? '#38bdf8' : strat.totalBets === 0 ? '#64748b' : '#ef4444' }}>
                                                                        %{strat.winRate}
                                                                    </span>
                                                                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                        <div style={{ width: `${strat.winRate}%`, height: '100%', background: strat.winRate >= 60 ? '#10b981' : '#38bdf8' }}></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem', color: strat.roi > 0 ? '#10b981' : strat.roi < 0 ? '#ef4444' : '#64748b' }}>
                                                                {strat.roi > 0 ? `+${strat.roi}%` : `${strat.roi}%`}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '0.25rem 0.65rem',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 900,
                                                                    background: badgeBg,
                                                                    color: badgeColor,
                                                                    border: badgeBorder,
                                                                    display: 'inline-block',
                                                                    minWidth: '38px'
                                                                }}>
                                                                    {strat.badge}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ) : filteredProfiles.length === 0 ? (
                    <p style={{ color: '#64748b' }}>{t.noUsers}</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                    <th style={{ padding: '1rem' }}>{t.emailCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.dateCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.statusCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.planCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.expiryCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.remainingCol}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>{t.actionsCol}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProfiles.map(profile => {
                                    const statusInfo = getStatusInfo(profile);
                                    const isEditing = editingUser === profile.id;
                                    const planInfo = PLANS[profile.plan] || PLANS.trial;

                                    return (
                                        <tr key={profile.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{profile.email}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(profile.created_at).toLocaleDateString('tr-TR')}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.8rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    background: statusInfo.bg,
                                                    color: statusInfo.color
                                                }}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingUser(isEditing ? null : profile.id)}
                                                    style={{
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 900,
                                                        background: planInfo.color + '15',
                                                        color: planInfo.color,
                                                        border: `1px solid ${planInfo.color}40`,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title={lang === 'tr' ? 'Paketi değiştirmek için tıkla' : 'Click to change plan'}
                                                >
                                                    <span>{planInfo.label}</span>
                                                    <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>✏️</span>
                                                </button>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                                {profile.subscription_end ? new Date(profile.subscription_end).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                                {getRemainingDays(profile.subscription_end)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', position: 'relative' }}>
                                                    {(profile.status === 'pending' || profile.status === 'pending_telegram' || !profile.status) && !profile.is_banned && (
                                                        <>
                                                            <button
                                                                onClick={() => approveUser(profile, profile.plan === 'trial' ? 3 : subscriptionDays, profile.plan || selectedPlan)}
                                                                title={t.approve}
                                                                style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#10b981', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                                                            >
                                                                {t.approve}
                                                            </button>
                                                            <button
                                                                onClick={() => rejectUser(profile.id)}
                                                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                                                            >
                                                                {t.reject}
                                                            </button>
                                                        </>
                                                    )}

                                                    {!profile.is_banned && (
                                                        <button
                                                            onClick={() => setEditingUser(profile.id)}
                                                            style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                            title={lang === 'tr' ? 'Üyelik paketini ve süresini düzenle' : 'Manage subscription and plan'}
                                                        >
                                                            <span>✏️</span>
                                                            <span>{t.extend} / {t.plan}</span>
                                                        </button>
                                                    )}

                                                    {/* Ban/Unban */}
                                                    <button
                                                        onClick={() => toggleBan(profile.id, profile.is_banned)}
                                                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.65rem' }}
                                                    >
                                                        {profile.is_banned ? t.unban : t.ban}
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => deleteUser(profile)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem' }}
                                                    >
                                                        {t.delete}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Edit Member Subscription & Plan Modal */}
                {editingUser && (() => {
                    const profile = profiles.find(p => p.id === editingUser);
                    if (!profile) return null;
                    const planInfo = PLANS[profile.plan] || PLANS.trial;

                    return (
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 999999,
                                background: 'rgba(3, 7, 18, 0.85)',
                                backdropFilter: 'blur(12px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '1rem',
                                animation: 'fadeIn 0.2s ease-out'
                            }}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) setEditingUser(null);
                            }}
                        >
                            <div
                                style={{
                                    background: 'linear-gradient(135deg, #0f172a 0%, #030712 100%)',
                                    border: '1px solid rgba(56, 189, 248, 0.35)',
                                    borderRadius: '16px',
                                    maxWidth: '460px',
                                    width: '100%',
                                    padding: '1.5rem',
                                    color: '#e2e8f0',
                                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.2)',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1.1rem',
                                    maxHeight: '90vh',
                                    overflowY: 'auto'
                                }}
                            >
                                {/* Header info with Close Button */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            ⚙️ {lang === 'tr' ? 'Üyelik & Süre Yönetimi' : (lang === 'de' ? 'Mitgliedschaft & Laufzeitverwaltung' : 'Manage Subscription')}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.35rem', wordBreak: 'break-all' }}>
                                            {profile.email}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.45rem', fontSize: '0.72rem' }}>
                                            <span style={{ padding: '0.15rem 0.55rem', borderRadius: '6px', background: planInfo.color + '22', color: planInfo.color, border: `1px solid ${planInfo.color}50`, fontWeight: 800 }}>
                                                {planInfo.label}
                                            </span>
                                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                                                ⏳ {getRemainingDays(profile.subscription_end)} {lang === 'tr' ? 'kaldı' : (lang === 'de' ? 'verbleibend' : 'left')}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            borderRadius: '8px',
                                            color: '#94a3b8',
                                            fontSize: '0.9rem',
                                            width: '30px',
                                            height: '30px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            flexShrink: 0
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* 1. Hızlı 1-Tık Presetler (Paket + Süre Birlikte) */}
                                <div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.5px' }}>
                                        ⚡ {lang === 'tr' ? 'Hızlı Paket Tanımla (Paket + Süre)' : (lang === 'de' ? 'Schnellpaket zuweisen (Paket + Tage)' : 'Quick Presets (Plan + Days)')}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => updateSubscription(profile.id, null, 'trial', profile.email, 3)}
                                            title={lang === 'tr' ? '3 Günlük Deneme başlatır' : (lang === 'de' ? 'Startet 3-Tage-Testzugang' : 'Start 3-day trial')}
                                            style={{
                                                background: profile.plan === 'trial' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.1)',
                                                border: `1px solid ${profile.plan === 'trial' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}`,
                                                color: '#10b981',
                                                padding: '0.6rem 0.4rem',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '3px',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <span>⚡ {lang === 'tr' ? '3G Deneme' : (lang === 'de' ? '3T Test' : '3D Trial')}</span>
                                            <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>(72 Saat)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updateSubscription(profile.id, null, 'pro', profile.email, 30)}
                                            title={lang === 'tr' ? '1 Aylık PRO tanımlar' : (lang === 'de' ? 'Weist 1 Monat PRO zu' : 'Assign 1-Month Pro')}
                                            style={{
                                                background: profile.plan === 'pro' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.1)',
                                                border: `1px solid ${profile.plan === 'pro' ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}`,
                                                color: '#38bdf8',
                                                padding: '0.6rem 0.4rem',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '3px',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <span>👑 {lang === 'tr' ? '1 Ay PRO' : (lang === 'de' ? '1 Mon. PRO' : '1 Mo PRO')}</span>
                                            <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>(30 Gün)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updateSubscription(profile.id, null, 'premium', profile.email, 30)}
                                            title={lang === 'tr' ? '1 Aylık PREMIUM tanımlar' : (lang === 'de' ? 'Weist 1 Monat VIP zu' : 'Assign 1-Month Premium')}
                                            style={{
                                                background: profile.plan === 'premium' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.1)',
                                                border: `1px solid ${profile.plan === 'premium' ? '#a855f7' : 'rgba(168, 85, 247, 0.3)'}`,
                                                color: '#c084fc',
                                                padding: '0.6rem 0.4rem',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '3px',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <span>💎 {lang === 'tr' ? '1 Ay VIP' : (lang === 'de' ? '1 Mon. VIP' : '1 Mo VIP')}</span>
                                            <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>(30 Gün)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 2. Mevcut Bitiş Tarihine Gün Ekle */}
                                <div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.5px' }}>
                                        ⏳ {lang === 'tr' ? 'Mevcut Süreye Gün Ekle (+ Gün)' : (lang === 'de' ? 'Laufzeit verlängern (+ Tage)' : 'Extend Current Duration (+ Days)')}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                                        {[
                                            { d: 1, label: '+1 Gün' },
                                            { d: 3, label: lang === 'tr' ? '+3 Gün' : (lang === 'de' ? '+3 Tage' : '+3 Days') },
                                            { d: 7, label: lang === 'tr' ? '+7 Gün (1 Hf)' : (lang === 'de' ? '+7 Tage' : '+7 Days') },
                                            { d: 30, label: lang === 'tr' ? '+30 Gün (1 Ay)' : (lang === 'de' ? '+30 Tage' : '+30 Days') },
                                            { d: 90, label: lang === 'tr' ? '+90 Gün (3 Ay)' : (lang === 'de' ? '+90 Tage' : '+90 Days') },
                                            { d: 365, label: lang === 'tr' ? '+365 Gün (1 Yıl)' : (lang === 'de' ? '+365 Tage' : '+1 Year') }
                                        ].map(item => (
                                            <button
                                                key={item.d}
                                                type="button"
                                                onClick={() => updateSubscription(profile.id, item.d, null, profile.email)}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    padding: '0.5rem 0.5rem',
                                                    borderRadius: '8px',
                                                    color: '#e2e8f0',
                                                    cursor: 'pointer',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    transition: 'all 0.15s'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Sadece Plan Değiştir */}
                                <div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.5px' }}>
                                        🏷️ {lang === 'tr' ? 'Sadece Paketi Değiştir (Süreyi Koru)' : (lang === 'de' ? 'Nur Paket ändern (Tage beibehalten)' : 'Change Plan Only (Keep Days)')}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                                        {Object.keys(PLANS).filter(k => k !== 'admin').map(p => {
                                            const isCurrent = profile.plan === p;
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => updateSubscription(profile.id, null, p, profile.email)}
                                                    style={{
                                                        background: isCurrent ? PLANS[p].color : 'transparent',
                                                        color: isCurrent ? '#000' : PLANS[p].color,
                                                        border: `1px solid ${PLANS[p].color}`,
                                                        padding: '0.5rem 0.5rem',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {isCurrent && <span>✓</span>}
                                                    <span>{PLANS[p].label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Kapat / Vazgeç */}
                                <div style={{ textAlign: 'right', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            color: '#cbd5e1',
                                            padding: '0.45rem 1rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 700
                                        }}
                                    >
                                        ✕ {lang === 'tr' ? 'Kapat / Vazgeç' : (lang === 'de' ? 'Schließen / Abbrechen' : 'Close')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div >
    );
};

const StrategyToggle = ({ label, active, onToggle, highlight = false }) => (
    <div 
        onClick={onToggle}
        style={{ 
            padding: '1rem', 
            background: active ? (highlight ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.1)') : 'rgba(0,0,0,0.2)',
            border: `1px solid ${active ? (highlight ? '#a78bfa' : '#38bdf8') : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            boxShadow: active ? `0 4px 15px ${highlight ? 'rgba(167, 139, 250, 0.1)' : 'rgba(56, 189, 248, 0.1)'}` : 'none'
        }}
    >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: active ? '#fff' : '#64748b' }}>{label}</span>
        <div style={{ 
            width: '36px', 
            height: '20px', 
            background: active ? (highlight ? '#a78bfa' : '#38bdf8') : '#334155',
            borderRadius: '10px',
            position: 'relative',
            transition: 'background 0.2s'
        }}>
            <div style={{ 
                width: '14px', 
                height: '14px', 
                background: '#fff', 
                borderRadius: '50%',
                position: 'absolute',
                top: '3px',
                left: active ? '19px' : '3px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}></div>
        </div>
    </div>
);

export default AdminPanel;
