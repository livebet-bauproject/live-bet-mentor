import React, { useState, useEffect, useRef } from 'react';

// Gentle web audio notification chime (Zero external audio file dependency)
const playChimeSound = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
};

const defaultApiBase = (typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.')
)) ? 'http://localhost:3001' : ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'https://live-bet-mentor.onrender.com');

export const LiveSupportChat = ({
    isOpen = false,
    onClose = () => {},
    onOpen = () => {},
    lang = 'tr',
    userProfile = null,
    apiBase = ''
}) => {
    const activeApiBase = apiBase || defaultApiBase;

    const [sessionId, setSessionId] = useState(() => {
        try {
            return localStorage.getItem('lbm_support_session_id') || '';
        } catch (e) {
            return '';
        }
    });

    const getInitialWelcome = () => [{
        id: 'msg_welcome',
        sender: 'bot',
        text: lang === 'de'
            ? '👋 Hallo! Willkommen beim offiziellen LiveBet Mentor Support-Desk.\n\nIch bin Ihr KI-Assistent. Wie kann ich Ihnen heute bezüglich VIP-Plänen, Testphasen oder Live-Radar-Fragen helfen?'
            : (lang === 'en'
                ? '👋 Hello! Welcome to the official LiveBet Mentor Support Desk.\n\nI am your AI assistant. How can I assist you with VIP memberships, trial access, or live quant radar strategies today?'
                : '👋 Merhaba! LiveBet Mentor Resmi Destek Masasına hoş geldiniz.\n\nBen canlı destek asistanınızım. VIP üyelik paketleri, 3 günlük ücretsiz deneme veya canlı xG radarı hakkında size nasıl yardımcı olabilirim?'),
        timestamp: Date.now()
    }];

    const [messages, setMessages] = useState(() => getInitialWelcome());
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const messagesEndRef = useRef(null);
    const lastTimestampRef = useRef(0);
    const pollTimerRef = useRef(null);

    // Initial session & history load
    useEffect(() => {
        let isMounted = true;

        const initSession = async () => {
            try {
                const currentSessionId = sessionId;
                const res = await fetch(`${activeApiBase}/api/support/history?sessionId=${encodeURIComponent(currentSessionId || '')}&lang=${lang || 'tr'}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        if (data.sessionId && data.sessionId !== sessionId) {
                            setSessionId(data.sessionId);
                            try { localStorage.setItem('lbm_support_session_id', data.sessionId); } catch (e) {}
                        }
                        if (Array.isArray(data.messages)) {
                            setMessages(data.messages);
                            if (data.messages.length > 0) {
                                lastTimestampRef.current = data.messages[data.messages.length - 1].timestamp || 0;
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('[SUPPORT] Init session error:', err.message);
            }
        };

        initSession();

        return () => {
            isMounted = false;
        };
    }, [sessionId, lang, activeApiBase]);

    // Background Long-Polling for incoming Admin replies from Telegram
    useEffect(() => {
        if (!sessionId) return;

        let active = true;

        const pollNewMessages = async () => {
            try {
                const lastTs = lastTimestampRef.current || 0;
                const res = await fetch(`${activeApiBase}/api/support/poll?sessionId=${encodeURIComponent(sessionId)}&lastTimestamp=${lastTs}`);
                if (res.ok && active) {
                    const data = await res.json();
                    if (Array.isArray(data.messages) && data.messages.length > 0) {
                        setMessages(prev => {
                            const existingIds = new Set(prev.map(m => m.id));
                            const uniqueNew = data.messages.filter(m => !existingIds.has(m.id));
                            if (uniqueNew.length === 0) return prev;

                            // Update last timestamp
                            lastTimestampRef.current = uniqueNew[uniqueNew.length - 1].timestamp || lastTimestampRef.current;

                            // Play sound & notify if admin replied
                            const hasAdminMsg = uniqueNew.some(m => m.sender === 'admin');
                            if (hasAdminMsg && soundEnabled) {
                                playChimeSound();
                            }

                            if (!isOpen) {
                                setUnreadCount(c => c + uniqueNew.length);
                            }

                            return [...prev, ...uniqueNew];
                        });
                    }
                }
            } catch (e) {}

            if (active) {
                // Poll every 3.5 seconds
                pollTimerRef.current = setTimeout(pollNewMessages, 3500);
            }
        };

        pollTimerRef.current = setTimeout(pollNewMessages, 3500);

        return () => {
            active = false;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, [sessionId, soundEnabled, isOpen, activeApiBase]);

    // Scroll to bottom when messages update
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            setUnreadCount(0);
        }
    }, [messages, isOpen]);

    const getResolvedUserInfo = () => {
        let name = userProfile?.display_name || userProfile?.name || '';
        let email = userProfile?.email || null;
        let plan = userProfile?.plan || '';
        let isMember = false;

        if (!email) {
            try {
                const savedMember = localStorage.getItem('lbm_member_session');
                if (savedMember) {
                    const p = JSON.parse(savedMember);
                    const prof = p.memberProfile || p.user;
                    email = p.user?.email || prof?.email || email;
                    name = prof?.full_name || p.user?.user_metadata?.display_name || email?.split('@')[0] || name;
                    plan = prof?.plan || 'trial';
                    isMember = true;
                }
            } catch (e) {}
        }
        if (!email) {
            try {
                const savedAdmin = localStorage.getItem('lbm_admin_session');
                if (savedAdmin) {
                    const p = JSON.parse(savedAdmin);
                    email = p.user?.email || 'admin@livebetmentor.com';
                    name = 'LiveBet Admin';
                    plan = 'admin';
                    isMember = true;
                }
            } catch (e) {}
        }

        const isMobile = typeof window !== 'undefined' ? (window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator?.userAgent || '')) : false;

        return {
            name: name || (email ? email.split('@')[0] : 'Misafir Ziyaretçi'),
            email: email || null,
            plan: plan || (email ? 'trial' : 'guest'),
            isMember: isMember || !!email,
            device: {
                isMobile,
                type: isMobile ? 'Mobil' : 'Masaüstü'
            }
        };
    };

    const handleSendMessage = async (customText = null) => {
        const text = (customText !== null ? customText : inputText).trim();
        if (!text || isSending) return;

        setIsSending(true);
        setInputText('');

        // Optimistic local add
        const tempMsg = {
            id: 'temp_' + Date.now(),
            sender: 'user',
            text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const resolvedUser = getResolvedUserInfo();
            const payload = {
                sessionId,
                text,
                lang,
                userInfo: resolvedUser
            };

            const res = await fetch(`${activeApiBase}/api/support/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.session?.sessionId && data.session.sessionId !== sessionId) {
                    setSessionId(data.session.sessionId);
                    try { localStorage.setItem('lbm_support_session_id', data.session.sessionId); } catch (e) {}
                }
                if (Array.isArray(data.session?.messages)) {
                    setMessages(data.session.messages);
                    lastTimestampRef.current = data.session.messages[data.session.messages.length - 1]?.timestamp || Date.now();
                } else if (data.reply) {
                    setMessages(prev => [...prev.filter(m => m.id !== tempMsg.id), tempMsg, data.reply]);
                }
            }
        } catch (err) {
            console.error('[SUPPORT] Send message failed:', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Quick suggestion chips
    const quickChips = [
        {
            id: 'vip',
            label: lang === 'tr' ? '💎 VIP Paket & Fiyat' : (lang === 'de' ? '💎 VIP & Preise' : '💎 VIP Plans & Pricing'),
            query: lang === 'tr' ? 'VIP üyelik fiyatları ve ödeme seçenekleri nelerdir?' : (lang === 'de' ? 'Was kosten die VIP-Pläne und wie kann ich bezahlen?' : 'What are VIP membership plans and payment options?')
        },
        {
            id: 'trial',
            label: lang === 'tr' ? '🚀 3 Günlük Deneme' : (lang === 'de' ? '🚀 3 Tage Test' : '🚀 3-Day Free Trial'),
            query: lang === 'tr' ? '3 günlük ücretsiz VIP denememi nasıl başlatabilirim?' : (lang === 'de' ? 'Wie starte ich meinen 3-tägigen VIP-Testpass?' : 'How can I activate my 3-day free VIP trial?')
        },
        {
            id: 'system',
            label: lang === 'tr' ? '📈 Radar Nasıl Çalışır?' : (lang === 'de' ? '📈 Wie Radar hilft' : '📈 How Radar Works'),
            query: lang === 'tr' ? 'Sistem ve canlı xG radarı nasıl çalışıyor?' : (lang === 'de' ? 'Wie funktioniert die xG-Telemetrie und der Radar?' : 'How does in-play xG radar and DQS score work?')
        },
        {
            id: 'human',
            label: lang === 'tr' ? '👨‍💻 Canlı Temsilci' : (lang === 'de' ? '👨‍💻 Support-Team' : '👨‍💻 Live Human Agent'),
            query: lang === 'tr' ? 'Bir canlı destek temsilcisine bağlanmak istiyorum.' : (lang === 'de' ? 'Ich möchte mit einem Support-Mitarbeiter sprechen.' : 'I would like to speak with a human support representative.')
        }
    ];

    const formatMessageText = (txt = '') => {
        // Parse bold **text** into strong
        const parts = txt.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={idx}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        try {
            const d = new Date(ts);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    return (
        <>
            {/* Floating Action Launcher Button (Bottom-Right) */}
            {!isOpen && (
                <button
                    className="support-chat-launcher-btn"
                    onClick={() => {
                        onOpen();
                        setUnreadCount(0);
                    }}
                    title={lang === 'tr' ? '7/24 Canlı Destek & AI Asistanı' : (lang === 'de' ? '24/7 Live-Support & KI-Assistent' : '24/7 Live Support & AI Assistant')}
                    aria-label="Canlı Destek"
                >
                    <span className="support-launcher-pulse"></span>
                    <span className="support-launcher-icon">💬</span>
                    {unreadCount > 0 && (
                        <span className="support-launcher-badge">{unreadCount}</span>
                    )}
                    <span className="support-launcher-text">
                        {lang === 'tr' ? 'Canlı Destek' : (lang === 'de' ? 'Live-Support' : 'Support')}
                    </span>
                </button>
            )}

            {/* Chat Window Modal */}
            {isOpen && (
                <div className="support-chat-modal glass-panel" role="dialog" aria-modal="true">
                    {/* Header */}
                    <div className="support-chat-header">
                        <div className="support-header-brand">
                            <div className="support-brand-badge">⚡</div>
                            <div className="support-brand-info">
                                <div className="support-brand-title">
                                    <span>{lang === 'tr' ? 'Canlı Destek Masası' : (lang === 'de' ? 'Live-Support-Desk' : 'Live Support Desk')}</span>
                                    <span className="support-status-dot" title="Online"></span>
                                </div>
                                <div className="support-brand-subtitle">
                                    {lang === 'tr' ? 'Canlı İnsan Temsilcisi & AI Asistan' : (lang === 'de' ? 'Mitarbeiter & KI-Assistent' : 'Human Operator & AI Assistant')}
                                </div>
                            </div>
                        </div>

                        <div className="support-header-actions">
                            <button
                                className="support-tool-btn"
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                title={soundEnabled ? (lang === 'tr' ? 'Ses Açık' : 'Sound On') : (lang === 'tr' ? 'Ses Kapalı' : 'Sound Off')}
                            >
                                {soundEnabled ? '🔔' : '🔕'}
                            </button>
                            <button
                                className="support-tool-btn"
                                onClick={onClose}
                                title={lang === 'tr' ? 'Küçült' : (lang === 'de' ? 'Minimieren' : 'Minimize')}
                            >
                                —
                            </button>
                            <button
                                className="support-tool-btn close-btn"
                                onClick={onClose}
                                title={lang === 'tr' ? 'Kapat' : 'Close'}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="support-messages-container">
                        {/* Security Notice */}
                        <div className="support-security-pill">
                            <span>🔒</span>
                            <span>
                                {lang === 'tr' 
                                    ? 'Uçtan uca şifreli ve %100 gizli resmi destek oturumu' 
                                    : (lang === 'de' ? 'Verschlüsselte & 100% private Support-Sitzung' : 'Encrypted & 100% private official support session')}
                            </span>
                        </div>

                        {/* Welcome Hero Card */}
                        {messages.length <= 1 && (
                            <div className="support-welcome-card">
                                <div className="support-welcome-avatar">⚡</div>
                                <div className="support-welcome-title">
                                    {lang === 'tr' ? 'LiveBet Destek Masası' : (lang === 'de' ? 'LiveBet Support-Desk' : 'LiveBet Support Desk')}
                                </div>
                                <div className="support-welcome-desc">
                                    {lang === 'tr'
                                        ? 'Merhaba! Size nasıl yardımcı olabiliriz? Sorunuzu doğrudan aşağıya yazabilir veya sık sorulan konulardan birini seçebilirsiniz.'
                                        : (lang === 'de'
                                            ? 'Hallo! Wie können wir Ihnen helfen? Schreiben Sie uns oder wählen Sie ein Thema.'
                                            : 'Hello! How can we assist you? Type your question below or pick a topic.')}
                                </div>
                                <div className="support-welcome-badges">
                                    <span>🛡️ %100 Gizlilik</span>
                                    <span>⚡ Anında Yanıt</span>
                                    <span>💳 VIP & Kripto</span>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, index) => {
                            const isUser = msg.sender === 'user';
                            const isAdmin = msg.sender === 'admin';

                            return (
                                <div
                                    key={msg.id || index}
                                    className={`support-msg-wrapper ${isUser ? 'msg-user' : isAdmin ? 'msg-admin' : 'msg-bot'}`}
                                >
                                    {!isUser && (
                                        <div className="support-msg-sender-tag">
                                            {isAdmin ? (
                                                <span className="tag-admin">
                                                    <span className="tag-dot"></span>
                                                    {lang === 'tr' ? '🛡️ Destek Yetkilisi' : (lang === 'de' ? '🛡️ Support-Leiter' : '🛡️ Support Lead')}
                                                </span>
                                            ) : (
                                                <span className="tag-bot">
                                                    🤖 {lang === 'tr' ? 'LiveBet AI Asistanı' : (lang === 'de' ? 'LiveBet KI-Assistent' : 'LiveBet AI Assistant')}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="support-msg-bubble">
                                        <div className="support-msg-text">
                                            {formatMessageText(msg.text)}
                                        </div>
                                        <div className="support-msg-time">
                                            {formatTime(msg.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {isSending && (
                            <div className="support-msg-wrapper msg-bot">
                                <div className="support-msg-bubble typing-bubble">
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="support-chips-wrapper">
                        {quickChips.map(chip => (
                            <button
                                key={chip.id}
                                className="support-chip-btn"
                                onClick={() => handleSendMessage(chip.query)}
                                disabled={isSending}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Input Bar */}
                    <div className="support-input-area">
                        <textarea
                            className="support-input-field"
                            rows={1}
                            placeholder={lang === 'tr' ? 'Sorunuzu buraya yazın...' : (lang === 'de' ? 'Schreiben Sie hier Ihre Nachricht...' : 'Type your question here...')}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            className="support-send-btn"
                            onClick={() => handleSendMessage()}
                            disabled={!inputText.trim() || isSending}
                            title={lang === 'tr' ? 'Gönder' : 'Send'}
                        >
                            <span>✈️</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
