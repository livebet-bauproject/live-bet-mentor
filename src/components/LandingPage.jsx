import React, { useState, useEffect } from 'react';
import { supabase } from '../backend/supabaseClient';
import { translations } from '../locales/translations';
import { LegalModal } from './LegalModal';
import { StakingCalculator } from './StakingCalculator';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { trackAnalyticsEvent } from '../utils/analyticsTracker';
import '../styles/global.css';

export const LandingPage = ({ onLoginSuccess, onNavigate, lang, setLang }) => {
    const [view, setView] = useState('login'); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(true);
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const [activeFaqIndex, setActiveFaqIndex] = useState(0);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [pendingVerification, setPendingVerification] = useState(null);
    const [verifiedSuccess, setVerifiedSuccess] = useState(false);

    const t = translations[lang] || translations['tr'];

    const handleCopyCode = (code) => {
        if (!code) return;
        try {
            if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(code);
            } else {
                const ta = document.createElement('textarea');
                ta.value = code;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (e) {
            console.error('Copy failed:', e);
        }
    };

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auto-poll verification status when waiting for Telegram activation
    useEffect(() => {
        if (!pendingVerification?.trialCode) return;

        let isMounted = true;
        const checkStatus = async () => {
            const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001'
                : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

            try {
                const res = await fetch(`${proxyBase}/api/members/trial-status?code=${encodeURIComponent(pendingVerification.trialCode)}`);
                const data = await res.json();
                if (data && data.verified && data.user && isMounted) {
                    setVerifiedSuccess(true);
                    const signedToken = data.token || data.access_token || '';
                    const userSession = {
                        user: {
                            id: data.user.id,
                            email: data.user.email,
                            user_metadata: { display_name: data.user.full_name || data.user.email.split('@')[0] }
                        },
                        memberProfile: data.user,
                        token: signedToken,
                        access_token: signedToken || ('member-token-' + data.user.id)
                    };
                    localStorage.setItem('lbm_member_session', JSON.stringify(userSession));
                    trackAnalyticsEvent('register_success_telegram', { email: data.user.email, plan: 'trial' });
                    setTimeout(() => {
                        if (isMounted) onLoginSuccess(userSession);
                    }, 1200);
                }
            } catch (err) {
                // Ignore transient polling network errors
            }
        };

        const interval = setInterval(checkStatus, 2500);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [pendingVerification, onLoginSuccess]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError(null);

        if (view === 'register' && !agreedToTerms) {
            setError(lang === 'tr' 
                ? 'Lütfen kullanım koşullarını ve 18+ yaş şartını onaylayınız.' 
                : (lang === 'de' ? 'Bitte akzeptieren Sie die Nutzungsbedingungen und das Mindestalter von 18 Jahren.' : 'Please accept the 18+ requirement and Terms of Service.'));
            return;
        }

        setLoading(true);

        const cleanEmail = (email || '').trim().toLowerCase();
        const isAdmin = cleanEmail === 'admin@livebetmentor.com' || cleanEmail === 'admin' || cleanEmail === 'karabulut.hamza@gmail.com';

        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            if (view === 'login') {
                // 1. Try Backend Members API
                try {
                    const res = await fetch(`${proxyBase}/api/members/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: cleanEmail, password })
                    });
                    const resData = await res.json();
                    if (res.ok && resData.success && resData.user) {
                        const signedToken = resData.token || resData.access_token || '';
                        if (resData.user.plan === 'admin') {
                            const adminSession = {
                                user: {
                                    id: 'admin-super',
                                    email: 'admin@livebetmentor.com',
                                    plan: 'admin',
                                    user_metadata: { display_name: 'LiveBet Admin' }
                                },
                                token: signedToken,
                                access_token: signedToken || 'master-admin-token',
                                expires_at: 9999999999
                            };
                            localStorage.setItem('lbm_admin_session', JSON.stringify(adminSession));
                            onLoginSuccess(adminSession);
                            setLoading(false);
                            return;
                        }

                        if (resData.pendingVerification || resData.status === 'pending_telegram') {
                            setPendingVerification({
                                trialCode: resData.trialCode,
                                botUsername: resData.botUsername || 'Livebetdesk',
                                email: cleanEmail
                            });
                            setLoading(false);
                            return;
                        }

                        if (resData.status === 'pending') {
                            setError(lang === 'tr' 
                                ? '⏳ Üyeliğiniz onay beklemektedir. Yönetici onayından sonra giriş yapabilirsiniz.' 
                                : (lang === 'de' ? '⏳ Ihre Mitgliedschaft wartet auf Freischaltung durch den Administrator.' : 'Your account is pending admin approval.'));
                            setLoading(false);
                            return;
                        }
                        if (resData.status === 'expired') {
                            setError(lang === 'tr' 
                                ? '📅 Abonelik süreniz dolmuştur. Lütfen üyeliğinizi yenileyin.' 
                                : (lang === 'de' ? '📅 Ihr Abonnement ist abgelaufen. Bitte erneuern Sie Ihre Mitgliedschaft.' : 'Subscription has expired.'));
                            setLoading(false);
                            return;
                        }
                        const userSession = {
                            user: {
                                id: resData.user.id,
                                email: resData.user.email,
                                user_metadata: { display_name: resData.user.full_name || resData.user.email.split('@')[0] }
                            },
                            memberProfile: resData.user,
                            token: signedToken,
                            access_token: signedToken || ('member-token-' + resData.user.id)
                        };
                        localStorage.setItem('lbm_member_session', JSON.stringify(userSession));
                        trackAnalyticsEvent('login_success', { email: cleanEmail, plan: resData.user?.plan || 'member' });
                        onLoginSuccess(userSession);
                        return;
                    } else if (resData.error) {
                        setError(resData.error);
                        setLoading(false);
                        return;
                    }
                } catch (beErr) {
                    console.warn('Backend login connection issue:', beErr);
                }

                // Fallback Supabase (only if backend is unreachable)
                try {
                    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
                    if (authError) throw authError;
                    onLoginSuccess(data.session);
                } catch (sbErr) {
                    setError(lang === 'tr' 
                        ? 'Giriş yapılamadı: E-posta veya şifre hatalı, ya da sunucuya erişilemiyor.' 
                        : (lang === 'de' ? 'Anmeldung fehlgeschlagen: Ungültige Anmeldedaten oder Server nicht erreichbar.' : 'Login failed: Invalid credentials or server unreachable.'));
                }
            } else {
                if (password.length < 6) {
                    setError(lang === 'tr' 
                        ? 'Şifreniz en az 6 karakter olmalıdır.' 
                        : (lang === 'de' ? 'Das Passwort muss mindestens 6 Zeichen lang sein.' : 'Password must be at least 6 characters.'));
                    setLoading(false);
                    return;
                }

                // REGISTER: Require Telegram-Verified Single-Use 3-Day PRO Trial
                const deviceId = getDeviceFingerprint();
                try {
                    const regRes = await fetch(`${proxyBase}/api/members/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: cleanEmail, password, plan: 'trial', deviceId })
                    });
                    const regData = await regRes.json();
                    if (regRes.ok && regData.success) {
                        if (regData.pendingVerification && regData.trialCode) {
                            setPendingVerification({
                                trialCode: regData.trialCode,
                                botUsername: regData.botUsername || 'Livebetdesk',
                                email: cleanEmail
                            });
                            setLoading(false);
                            return;
                        } else if (regData.user) {
                            const signedToken = regData.token || regData.access_token || '';
                            const userSession = {
                                user: {
                                    id: regData.user.id,
                                    email: regData.user.email,
                                    user_metadata: { display_name: regData.user.full_name || regData.user.email.split('@')[0] }
                                },
                                memberProfile: regData.user,
                                token: signedToken,
                                access_token: signedToken || ('member-token-' + regData.user.id)
                            };
                            localStorage.setItem('lbm_member_session', JSON.stringify(userSession));
                            trackAnalyticsEvent('register_success', { email: cleanEmail, plan: regData.user.plan || 'trial' });
                            onLoginSuccess(userSession);
                            return;
                        }
                    } else if (regData.error) {
                        setError(regData.error);
                        if (regData.deviceUsed) {
                            setTimeout(() => {
                                setView('login');
                            }, 4500);
                        }
                        setLoading(false);
                        return;
                    }
                } catch (beErr) {
                    console.warn('Backend register failed:', beErr);
                    setError(lang === 'tr'
                        ? 'Doğrulama sunucusuna bağlanılamadı. Lütfen birkaç saniye sonra tekrar deneyiniz.'
                        : (lang === 'de' ? 'Verbindung zum Authentifizierungsserver fehlgeschlagen. Bitte versuchen Sie es in wenigen Sekunden erneut.' : 'Could not connect to authentication server. Please try again.'));
                    setLoading(false);
                    return;
                }
            }
        } catch (err) {
            setError(err.message || (lang === 'tr' ? 'İşlem gerçekleştirilemedi.' : (lang === 'de' ? 'Vorgang fehlgeschlagen.' : 'Operation failed.')));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-page" style={{
            minHeight: '100vh',
            background: '#030712',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', sans-serif",
            overflowX: 'hidden'
        }}>
            {/* Background Gradient Orbs */}
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vh', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)', filter: 'blur(100px)' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50vw', height: '50vh', background: 'radial-gradient(circle, rgba(167, 139, 250, 0.05) 0%, transparent 70%)', filter: 'blur(100px)' }} />
            </div>

            {/* Navigation */}
            <nav className="landing-nav" style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                padding: scrollY > 20 ? '0.75rem 1.5rem' : '1.1rem 2rem',
                background: scrollY > 20 ? 'rgba(3, 7, 18, 0.92)' : 'rgba(3, 7, 18, 0.4)',
                backdropFilter: 'blur(20px)',
                borderBottom: scrollY > 20 ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                transition: 'all 0.3s ease',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div className="landing-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                        width: '34px', height: '34px',
                        background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                        borderRadius: '9px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, color: '#030712', fontSize: '0.9rem',
                        boxShadow: '0 0 16px rgba(56, 189, 248, 0.35)',
                        flexShrink: 0
                    }}>LM</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 900, letterSpacing: '-0.5px', fontSize: '1.1rem', color: '#fff', whiteSpace: 'nowrap' }}>LIVE BET MENTOR</span>
                        <span className="live-badge" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '2px 6px', borderRadius: '10px',
                            fontSize: '0.62rem', fontWeight: 800, color: '#10b981'
                        }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
                            LIVE
                        </span>
                    </div>
                </div>

                <div className="landing-nav-actions" style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                    <a 
                        href={`https://t.me/Livebetdeskbot?start=lang_${lang || 'tr'}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="landing-nav-tg"
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '5px', 
                            background: 'rgba(0, 136, 204, 0.12)', 
                            border: '1px solid rgba(0, 136, 204, 0.35)', 
                            color: '#38bdf8', 
                            padding: '0.4rem 0.75rem', 
                            borderRadius: '8px', 
                            textDecoration: 'none', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>✈️</span>
                        <span className="nav-tg-label">{lang === 'tr' ? 'Telegram Destek' : (lang === 'de' ? 'Telegram Support' : 'Support')}</span>
                    </a>

                    <div className="landing-lang-switcher" style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', padding: '2px' }}>
                        {['tr', 'en', 'de'].map(l => (
                            <button
                                key={l}
                                onClick={() => setLang(l)}
                                style={{
                                    background: lang === l ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                                    border: 'none',
                                    color: lang === l ? '#38bdf8' : '#94a3b8',
                                    padding: '0.3rem 0.55rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    fontSize: '0.7rem'
                                }}
                            >
                                {l.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div className="landing-nav-desktop-buttons" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button onClick={() => setView('login')} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>{t.landing_cta_login}</button>
                        <button onClick={() => setView('register')} style={{ background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#030712', border: 'none', padding: '0.55rem 1.15rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)', fontSize: '0.85rem' }}>{t.landing_cta_main}</button>
                    </div>
                </div>
            </nav>

            {/* Main Content Split */}
            <main style={{ flex: 1, display: 'flex', minHeight: '100vh', zIndex: 1 }}>
                {/* Left Side: Marketing & Comparison */}
                <div style={{ flex: 1.2, padding: '8rem 4rem 4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '650px' }}>
                        <div style={{ display: 'inline-block', padding: '0.4rem 1rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '20px', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2rem' }}>
                            🛡️ {t.landing_hero_subtitle}
                        </div>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-2px' }}>
                            {t.landing_hero_title}
                        </h1>
                        <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '3rem' }}>
                            {t.landing_hero_desc}
                        </p>

                        {/* Staking vs Parlay Comparison UI */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2rem', marginBottom: '4rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📊 {t.landing_comparison_title}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderRadius: '16px' }}>
                                    <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.5rem' }}>{t.landing_parlay_label}</div>
                                    <div style={{ height: '8px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '4px', marginBottom: '1rem' }}>
                                        <div style={{ width: '15%', height: '100%', background: '#ef4444', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>❌ {t.landing_parlay_outcome}</div>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '16px' }}>
                                    <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.5rem' }}>{t.landing_staking_label}</div>
                                    <div style={{ height: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '4px', marginBottom: '1rem' }}>
                                        <div style={{ width: '85%', height: '100%', background: '#10b981', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>✅ {t.landing_staking_outcome}</div>
                                </div>
                            </div>
                        </div>

                        {/* Features List */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <h4 style={{ color: '#38bdf8', fontWeight: 800, marginBottom: '0.5rem', fontSize: '1rem' }}>{t.landing_feature_1}</h4>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{t.landing_feature_1_desc}</p>
                            </div>
                            <div>
                                <h4 style={{ color: '#a78bfa', fontWeight: 800, marginBottom: '0.5rem', fontSize: '1rem' }}>{t.landing_feature_2}</h4>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{t.landing_feature_2_desc}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Interactive Auth Form */}
                <div className="landing-auth-container" style={{ flex: 0.8, background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(40px)', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                    <div className="glass-panel landing-auth-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(3, 7, 18, 0.95) 100%)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.08)' }}>
                        {pendingVerification ? (
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
                                    <div style={{
                                        width: '68px',
                                        height: '68px',
                                        margin: '0 auto 1rem',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #0088cc, #38bdf8)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 0 30px rgba(0, 136, 204, 0.5)',
                                        fontSize: '1.9rem'
                                    }}>
                                        ✈️
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '2px 9px',
                                        background: 'rgba(0, 136, 204, 0.15)',
                                        border: '1px solid rgba(0, 136, 204, 0.35)',
                                        borderRadius: '20px',
                                        color: '#38bdf8',
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        marginBottom: '0.6rem'
                                    }}>
                                        🔒 {lang === 'tr' ? 'TEK KULLANIMLIK DOĞRULAMA' : (lang === 'de' ? 'EINMALIGE VERIFIZIERUNG' : 'ONE-TIME VERIFICATION')}
                                    </div>
                                    <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '0.4rem', color: '#fff' }}>
                                        {lang === 'tr' ? '3 Günlük VIP Denemeyi Başlat' : (lang === 'de' ? '3-Tage VIP-Test starten' : 'Activate 3-Day VIP Trial')}
                                    </h2>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                        {lang === 'tr'
                                            ? 'Mükerrer ve sahte hesapları engellemek amacıyla 3 günlük (72 saat) deneme hakkı tek seferlik Telegram üzerinden tanımlanır.'
                                            : (lang === 'de' ? 'Um Mehrfach- und Fake-Accounts zu verhindern, wird der 3-tägige (72h) Testzugang einmalig über Telegram freigeschaltet.' : 'To prevent duplicate and fake accounts, your 3-day (72h) trial is single-use and activated via Telegram.')}
                                    </p>
                                </div>

                                <div style={{
                                    background: 'rgba(0, 136, 204, 0.08)',
                                    border: '1px solid rgba(0, 136, 204, 0.25)',
                                    borderRadius: '16px',
                                    padding: '1.1rem',
                                    marginBottom: '1.2rem',
                                    fontSize: '0.82rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                        <span style={{ color: '#94a3b8' }}>{lang === 'tr' ? 'E-posta:' : (lang === 'de' ? 'E-Mail:' : 'Email:')}</span>
                                        <span style={{ color: '#fff', fontWeight: 700, wordBreak: 'break-all' }}>{pendingVerification.email}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#94a3b8' }}>{lang === 'tr' ? 'Aktivasyon Kodu:' : (lang === 'de' ? 'Aktivierungscode:' : 'Code:')}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#38bdf8', fontWeight: 900, fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '1px' }}>{pendingVerification.trialCode}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(pendingVerification.trialCode)}
                                                style={{
                                                    background: copiedCode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                                    border: '1px solid ' + (copiedCode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.15)'),
                                                    color: copiedCode ? '#10b981' : '#cbd5e1',
                                                    borderRadius: '6px',
                                                    padding: '2px 8px',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer',
                                                    fontWeight: 700
                                                }}
                                            >
                                                {copiedCode ? (lang === 'tr' ? '✓ Kopyalandı' : (lang === 'de' ? '✓ Kopiert' : '✓ Copied')) : (lang === 'tr' ? 'Kopyala' : (lang === 'de' ? 'Kopieren' : 'Copy'))}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div style={{ padding: '0.7rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', marginBottom: '1rem' }}>
                                        {error}
                                    </div>
                                )}

                                {verifiedSuccess ? (
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        borderRadius: '14px',
                                        color: '#10b981',
                                        textAlign: 'center',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        marginBottom: '1rem'
                                    }}>
                                        ✅ {lang === 'tr' ? 'Telegram Onayı Alındı! Yönlendiriliyorsunuz...' : (lang === 'de' ? 'Telegram-Bestätigung erhalten! Weiterleitung zum Dashboard...' : 'Telegram Verified! Launching Dashboard...')}
                                    </div>
                                ) : (
                                    <>
                                        <a
                                            href={`https://t.me/${pendingVerification.botUsername || 'Livebetdesk'}?start=${pendingVerification.trialCode}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.6rem',
                                                width: '100%',
                                                padding: '0.95rem 1rem',
                                                background: 'linear-gradient(135deg, #0088cc, #0284c7)',
                                                border: 'none',
                                                borderRadius: '14px',
                                                color: '#fff',
                                                fontWeight: 900,
                                                fontSize: '0.92rem',
                                                textDecoration: 'none',
                                                textAlign: 'center',
                                                boxShadow: '0 8px 24px rgba(0, 136, 204, 0.35)',
                                                marginBottom: '0.8rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span>⚡</span>
                                            <span>{lang === 'tr' ? 'Telegram ile Tek Tıkla Başlat' : (lang === 'de' ? 'Mit 1 Klick in Telegram starten' : 'Activate 1-Click in Telegram')}</span>
                                        </a>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            color: '#64748b',
                                            fontSize: '0.78rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: '#38bdf8',
                                                boxShadow: '0 0 8px #38bdf8'
                                            }} />
                                            <span>{lang === 'tr' ? 'Telegram onayı bekleniyor... (Otomatik algılanır)' : (lang === 'de' ? 'Warte auf Telegram-Start... (Wird automatisch erkannt)' : 'Waiting for Telegram start... (Auto-detecting)')}</span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setError(null);
                                                const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                                    ? 'http://localhost:3001'
                                                    : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');
                                                try {
                                                    const res = await fetch(`${proxyBase}/api/members/trial-status?code=${encodeURIComponent(pendingVerification.trialCode)}`);
                                                    const data = await res.json();
                                                    if (data && data.verified && data.user) {
                                                        setVerifiedSuccess(true);
                                                        const signedToken = data.token || data.access_token || '';
                                                        const userSession = {
                                                            user: {
                                                                id: data.user.id,
                                                                email: data.user.email,
                                                                user_metadata: { display_name: data.user.full_name || data.user.email.split('@')[0] }
                                                            },
                                                            memberProfile: data.user,
                                                            token: signedToken,
                                                            access_token: signedToken || ('member-token-' + data.user.id)
                                                        };
                                                        localStorage.setItem('lbm_member_session', JSON.stringify(userSession));
                                                        setTimeout(() => {
                                                            onLoginSuccess(userSession);
                                                        }, 800);
                                                    } else {
                                                        setError(lang === 'tr'
                                                            ? 'Henüz Telegram onayı tamamlanmadı. Lütfen açılan Telegram botunda "Başlat" butonuna basınız.'
                                                            : (lang === 'de' ? 'Telegram-Bestätigung noch nicht abgeschlossen. Bitte drücken Sie im Bot auf "Starten".' : 'Telegram verification not yet completed. Please tap Start in the bot.'));
                                                    }
                                                } catch (err) {
                                                    setError(lang === 'tr' ? 'Bağlantı hatası oluştu.' : (lang === 'de' ? 'Verbindungsfehler aufgetreten.' : 'Connection error.'));
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.7rem',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '12px',
                                                color: '#94a3b8',
                                                fontWeight: 700,
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                marginBottom: '1rem'
                                            }}
                                        >
                                            🔄 {lang === 'tr' ? 'Onayı Manuel Kontrol Et' : (lang === 'de' ? 'Status manuell prüfen' : 'Check Status Manually')}
                                        </button>
                                    </>
                                )}

                                <div style={{ textAlign: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPendingVerification(null);
                                            setView('login');
                                            setError(null);
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        {lang === 'tr' ? '← Başka Hesapla Giriş Yap' : (lang === 'de' ? '← Mit anderem Konto anmelden' : '← Log In With Another Account')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Segmented Tab Switcher */}
                                <div className="landing-segmented-tabs" style={{
                                    display: 'flex',
                                    background: 'rgba(3, 7, 18, 0.65)',
                                    borderRadius: '12px',
                                    padding: '4px',
                                    marginBottom: '1.4rem',
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => { setError(null); setView('login'); }}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '0.65rem 0.5rem',
                                            borderRadius: '9px',
                                            border: 'none',
                                            background: view === 'login' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(37, 99, 235, 0.25))' : 'transparent',
                                            boxShadow: view === 'login' ? '0 0 15px rgba(56, 189, 248, 0.2), inset 0 0 0 1px rgba(56, 189, 248, 0.4)' : 'none',
                                            color: view === 'login' ? '#38bdf8' : '#94a3b8',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span>🔑</span>
                                        <span>{t.landing_cta_login}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setError(null); setView('register'); }}
                                        style={{
                                            flex: 1.25,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '0.65rem 0.5rem',
                                            borderRadius: '9px',
                                            border: 'none',
                                            background: view === 'register' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(168, 85, 247, 0.25))' : 'transparent',
                                            boxShadow: view === 'register' ? '0 0 15px rgba(56, 189, 248, 0.25), inset 0 0 0 1px rgba(56, 189, 248, 0.5)' : 'none',
                                            color: view === 'register' ? '#38bdf8' : '#94a3b8',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span>⚡</span>
                                        <span>{lang === 'tr' ? '3 Günlük VIP Deneme' : (lang === 'de' ? '3-Tage VIP Test' : '3-Day VIP Trial')}</span>
                                        <span style={{
                                            fontSize: '0.6rem',
                                            background: '#10b981',
                                            color: '#000',
                                            fontWeight: 900,
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            lineHeight: 1
                                        }}>
                                            {lang === 'tr' ? 'HEDİYE' : (lang === 'de' ? 'GRATIS' : 'FREE')}
                                        </span>
                                    </button>
                                </div>

                                {/* Header text depending on view */}
                                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.35rem', color: '#fff', letterSpacing: '-0.5px' }}>
                                        {view === 'login' ? t.landing_cta_login : (lang === 'tr' ? '3 Günlük VIP Deneme' : (lang === 'de' ? '3-Tage VIP-Test starten' : '3-Day Free VIP Access'))}
                                    </h2>
                                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45, margin: 0 }}>
                                        {view === 'login' ? t.login_to_panel : (t.register_subtitle || (lang === 'tr' ? 'Cuma-Pazar tüm bülten dahil. Anında canlı maç radarını test edin.' : (lang === 'de' ? 'Volles Wochenende inklusive. Sofort den Live-Radar testen.' : 'Full weekend matchdays included. Zero commitment.')))}
                                    </p>
                                </div>

                                {view === 'register' && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '6px',
                                        background: 'rgba(56, 189, 248, 0.05)',
                                        border: '1px solid rgba(56, 189, 248, 0.18)',
                                        borderRadius: '12px',
                                        padding: '0.65rem 0.4rem',
                                        marginBottom: '1.25rem',
                                        textAlign: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.95rem', marginBottom: '2px' }}>⚡</div>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8' }}>{lang === 'tr' ? 'Anında Erişim' : (lang === 'de' ? 'Sofortzugriff' : 'Instant')}</div>
                                        </div>
                                        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                            <div style={{ fontSize: '0.95rem', marginBottom: '2px' }}>💳</div>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981' }}>{lang === 'tr' ? 'Kartsız' : (lang === 'de' ? 'Keine Karte' : 'No Card')}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.95rem', marginBottom: '2px' }}>🎯</div>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#fbbf24' }}>{lang === 'tr' ? '0-100 Isı' : (lang === 'de' ? '0-100 Radar' : '0-100 Radar')}</div>
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.5px' }}>
                                            <span>✉️</span>
                                            <span>{t.email}</span>
                                        </label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                placeholder="name@example.com"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.85rem 1rem 0.85rem 2.5rem',
                                                    background: 'rgba(3, 7, 18, 0.6)',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '12px',
                                                    color: '#fff',
                                                    fontSize: '0.92rem',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <span style={{ position: 'absolute', left: '0.9rem', color: '#64748b', fontSize: '0.9rem', pointerEvents: 'none' }}>@</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                <span>🔒</span>
                                                <span>{t.password}</span>
                                            </label>
                                            {view === 'register' && (
                                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                                    {lang === 'tr' ? '(En az 6 karakter)' : (lang === 'de' ? '(Min. 6 Zeichen)' : '(Min. 6 chars)')}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                placeholder="••••••••"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.85rem 2.6rem 0.85rem 2.5rem',
                                                    background: 'rgba(3, 7, 18, 0.6)',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '12px',
                                                    color: '#fff',
                                                    fontSize: '0.92rem',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <span style={{ position: 'absolute', left: '0.9rem', color: '#64748b', fontSize: '0.9rem', pointerEvents: 'none' }}>🔑</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '0.8rem',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#94a3b8',
                                                    cursor: 'pointer',
                                                    fontSize: '1rem',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                                title={showPassword ? 'Gizle' : 'Göster'}
                                            >
                                                {showPassword ? '👁️' : '👁️‍🗨️'}
                                            </button>
                                        </div>
                                    </div>

                                    {view === 'register' && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '0.65rem',
                                            fontSize: '0.72rem',
                                            color: '#94a3b8',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            padding: '0.75rem',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255, 255, 255, 0.07)'
                                        }}>
                                            <input
                                                type="checkbox"
                                                id="termsCheckbox"
                                                checked={agreedToTerms}
                                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                                required
                                                style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#38bdf8', width: '16px', height: '16px' }}
                                            />
                                            <label htmlFor="termsCheckbox" style={{ cursor: 'pointer', lineHeight: 1.45 }}>
                                                <span>{t.legal_agree_checkbox}</span>{' '}
                                                <span
                                                    onClick={(e) => { e.preventDefault(); setIsLegalModalOpen(true); }}
                                                    style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 800 }}
                                                >
                                                    [{t.legal_terms_link}]
                                                </span>
                                            </label>
                                        </div>
                                    )}

                                    {error && (
                                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', color: '#f87171', fontSize: '0.82rem', textAlign: 'center', lineHeight: 1.4 }}>
                                            ⚠️ {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="landing-submit-btn"
                                        style={{
                                            width: '100%',
                                            padding: '0.95rem 1rem',
                                            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #0ea5e9 100%)',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: '#030712',
                                            fontWeight: 900,
                                            fontSize: '0.95rem',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.25s ease',
                                            boxShadow: '0 8px 24px rgba(56, 189, 248, 0.35)',
                                            opacity: loading ? 0.75 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            marginTop: '0.2rem'
                                        }}
                                    >
                                        {loading ? (
                                            <span>{lang === 'tr' ? '⏳ İşleniyor...' : (lang === 'de' ? '⏳ Bitte warten...' : 'Processing...')}</span>
                                        ) : view === 'login' ? (
                                            <>
                                                <span>🚀</span>
                                                <span>{t.landing_cta_login}</span>
                                                <span>→</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>⚡</span>
                                                <span>{lang === 'tr' ? '3 Günlük VIP Denemeyi Başlat' : (lang === 'de' ? '3-Tage VIP-Test starten' : 'Start 3-Day VIP Trial')}</span>
                                                <span>→</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Trust Strip */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '1.2rem',
                                    marginTop: '1.2rem',
                                    paddingTop: '0.85rem',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                    color: '#64748b',
                                    fontSize: '0.7rem',
                                    fontWeight: 700
                                }}>
                                    <span>🔒 256-Bit SSL</span>
                                    <span>⚡ Anında Erişim</span>
                                    <span>🛡️ No Spams</span>
                                </div>

                                {/* Toggle between Login and Register */}
                                <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setView(view === 'login' ? 'register' : 'login');
                                            setError('');
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#38bdf8',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        {view === 'login' ? (
                                            <span>{lang === 'tr' ? 'Hesabınız yok mu? 3 Gün Ücretsiz PRO Deneyin →' : (lang === 'de' ? 'Kein Konto? 3 Tage kostenlosen VIP-Test starten →' : 'No account? Start 3-Day Free VIP Trial →')}</span>
                                        ) : (
                                            <span>{lang === 'tr' ? 'Zaten hesabınız var mı? Giriş Yapın →' : (lang === 'de' ? 'Bereits ein Konto? Anmelden →' : 'Already have an account? Sign In →')}</span>
                                        )}
                                    </button>
                                </div>

                                {/* Direct Telegram Support Card */}
                                <div style={{
                                    marginTop: '1.2rem',
                                    background: 'rgba(0, 136, 204, 0.06)',
                                    border: '1px solid rgba(0, 136, 204, 0.18)',
                                    borderRadius: '12px',
                                    padding: '0.65rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#94a3b8' }}>
                                        <span>💬</span>
                                        <span>{lang === 'tr' ? 'Sorunuz mu var?' : (lang === 'de' ? 'Haben Sie Fragen?' : 'Need support?')}</span>
                                    </div>
                                    <a
                                        href={`https://t.me/Livebetdeskbot?start=lang_${lang || 'tr'}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            color: '#38bdf8',
                                            fontSize: '0.74rem',
                                            fontWeight: 800,
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                    >
                                        <span>Telegram Masası</span>
                                        <span>→</span>
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* Semantic SEO & Knowledge Hub Section */}
            <section style={{
                position: 'relative',
                zIndex: 1,
                padding: '5rem 2rem 2rem',
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%'
            }}>
                {/* Section 1: Methodology & Quant Architecture */}
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <div style={{ display: 'inline-block', padding: '0.35rem 0.9rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '20px', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '1px' }}>
                        🔬 {lang === 'tr' ? 'BİLİMSEL ANALİTİK & QUANT MİMARİSİ' : (lang === 'de' ? 'WISSENSCHAFTLICHE ANALYTIK & QUANT-ARCHITEKTUR' : 'SCIENTIFIC ANALYTICS & QUANT ARCHITECTURE')}
                    </div>
                    <h2 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1rem' }}>
                        {lang === 'tr' ? 'Duygularla Değil, Matematiksel Modellerle Karar Verin' : (lang === 'de' ? 'Entscheiden Sie mit mathematischen Modellen, nicht mit Emotionen' : 'Decide with Mathematical Models, Not Emotions')}
                    </h2>
                    <p style={{ color: '#94a3b8', maxWidth: '750px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
                        {lang === 'tr' 
                            ? 'LiveBet Mentor, sıradan tahmin sitelerinin aksine kupon veya kesinlik satmaz. Canlı veri akışını Poisson, xG ve olasılık regresyonu ile saniyeler içinde işleyen profesyonel bir telemetri terminalidir.'
                            : (lang === 'de'
                                ? 'LiveBet Mentor verkauft keine vorgefertigten Wettscheine. Es ist ein professionelles Telemetrie-Terminal, das Live-Datenströme sekundengenau mittels Poisson- und xG-Modellen verarbeitet.'
                                : 'Unlike generic tipsters, LiveBet Mentor does not sell fixed picks. It is a high-frequency telemetry terminal processing in-play feeds via Poisson regression and expected goals (xG).')}
                    </p>
                </div>

                {/* 4 Quant Pillars Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '20px', padding: '2rem' }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>📊</div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.6rem' }}>
                            {lang === 'tr' ? 'Poisson Dağılımı & xG' : (lang === 'de' ? 'Poisson-Verteilung & xG' : 'Poisson Distribution & xG')}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                            {lang === 'tr' 
                                ? 'Geçmiş lig ortalamaları ile anlık saha içi şut kalitesini birleştirerek kalan dakikalar için gol olasılık dağılımını dinamik hesaplar.'
                                : (lang === 'de'
                                    ? 'Kombiniert historische Liga-Durchschnitte mit Schussqualität zur dynamischen Berechnung der verbleibenden Torwahrscheinlichkeiten.'
                                    : 'Combines historical league benchmarks with in-play shot quality to dynamically calculate remaining goal probability distributions.')}
                        </p>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '20px', padding: '2rem' }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>🛡️</div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginBottom: '0.6rem' }}>
                            {lang === 'tr' ? 'Kelly Kriteri & Kasa Disiplini' : (lang === 'de' ? 'Kelly-Kriterium & Bankroll' : 'Kelly Criterion & Discipline')}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                            {lang === 'tr' 
                                ? 'Kombine kuponların iflas riskine karşı sermayenizi yalnızca pozitif beklenen değere (+EV) göre optimize edilmiş yüzdelerle böler.'
                                : (lang === 'de'
                                    ? 'Schützt vor dem Ruin-Risiko von Kombiwetten durch mathematisch optimierte Einsätze ausschließlich bei positivem Erwartungswert (+EV).'
                                    : 'Protects against parlay ruin by sizing stakes strictly proportional to proven mathematical edge (+EV) and capital preservation limits.')}
                        </p>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '20px', padding: '2rem' }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>⚡</div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.6rem' }}>
                            {lang === 'tr' ? '0-100 Isı İndeksi (Momentum)' : (lang === 'de' ? '0-100 Hitze-Index (Momentum)' : '0-100 Heat Index (Momentum)')}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                            {lang === 'tr' 
                                ? 'Son 10 dakikalık ceza sahası aksiyonlarını, kornerleri ve isabetli şutları süzerek maçın gerçek baskı yönünü 0-100 arasında canlı skorlar.'
                                : (lang === 'de'
                                    ? 'Filtert Strafraumaktionen, Ecken und Torschüsse der letzten 10 Minuten für ein präzises Live-Druckwellen-Ranking.'
                                    : 'Filters rolling 10-minute box entries, corners, and on-target efforts to score real in-play pressure on a 0-100 dynamic scale.')}
                        </p>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '20px', padding: '2rem' }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>⏱️</div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#a855f7', marginBottom: '0.6rem' }}>
                            {lang === 'tr' ? 'DQS & Latans Kalkanı' : (lang === 'de' ? 'DQS & Latenz-Schild' : 'DQS & Latency Shield')}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                            {lang === 'tr' 
                                ? 'Veri sağlayıcı kaynaklı gecikme 30 saniyeyi aştığında veya istatistiklerde tutarsızlık olduğunda sistem anında NO-BET kalkanı kaldırır.'
                                : (lang === 'de'
                                    ? 'Überschreitet die Datenverzögerung 30 Sekunden, schützt das System Ihr Kapital automatisch mit einem NO-BET Schild.'
                                    : 'When feed latency exceeds 30 seconds or conflicting stats appear, the engine triggers an instant NO-BET shield against stale data.')}
                        </p>
                    </div>
                </div>

                {/* Section 2: Interactive Staking Calculator Lead Magnet Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '24px',
                    padding: '2.5rem',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '2rem',
                    marginBottom: '5rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                            💰 {lang === 'tr' ? 'ÜCRETSİZ KANTİTATİF ARAÇ' : (lang === 'de' ? 'KOSTENLOSES QUANT-TOOL' : 'FREE QUANT TOOL')}
                        </div>
                        <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.6rem', color: '#f8fafc' }}>
                            {lang === 'tr' ? 'Kasa Yönetimi & Kelly Kriteri Simülatörü' : (lang === 'de' ? 'Bankroll & Kelly-Kriterium Simulator' : 'Bankroll & Kelly Criterion Simulator')}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                            {lang === 'tr' 
                                ? 'Kombine kuponların matematiksel tuzaklarını görün. Sermayenizi, seçtiğiniz oranların olasılık değerine göre güvenle nasıl dağıtacağınızı anında simüle edin.'
                                : (lang === 'de'
                                    ? 'Erkennen Sie die mathematischen Tücken von Kombiwetten und optimieren Sie Ihre Kapitalallokation nach Wahrscheinlichkeitsvorteilen.'
                                    : 'Uncover why parlays mathematically fail. Simulate optimal stake distribution across your odds based on true implied probabilities.')}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCalculatorOpen(true)}
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff',
                            border: 'none',
                            padding: '1rem 2rem',
                            borderRadius: '12px',
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        📊 {lang === 'tr' ? 'Hesaplayıcıyı Başlat' : (lang === 'de' ? 'Rechner starten' : 'Launch Simulator')}
                    </button>
                </div>

                {/* Section 3: Semantic FAQ Accordion */}
                <div style={{ maxWidth: '850px', margin: '0 auto 4rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <div style={{ display: 'inline-block', padding: '0.35rem 0.9rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '20px', color: '#c084fc', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.8rem', letterSpacing: '1px' }}>
                            ❓ {lang === 'tr' ? 'SIKÇA SORULAN SORULAR' : (lang === 'de' ? 'HÄUFIG GESTELLTE FRAGEN' : 'FREQUENTLY ASKED QUESTIONS')}
                        </div>
                        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-1px' }}>
                            {lang === 'tr' ? 'Platform ve Metodoloji Hakkında Merak Edilenler' : (lang === 'de' ? 'Wissenswertes über Plattform & Methodik' : 'Everything You Need to Know About the Platform')}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            {
                                q: lang === 'tr' ? 'LiveBet Mentor tam olarak nedir ve nasıl çalışır?' : (lang === 'de' ? 'Was ist LiveBet Mentor und wie funktioniert es?' : 'What is LiveBet Mentor and how does it work?'),
                                a: lang === 'tr' 
                                    ? 'LiveBet Mentor, canlı futbol müsabakalarını saniye saniye izleyen, Poisson olasılık dağılımı, xG (beklenen gol) ve baskı dalgası telemetrisi kullanarak piyasadaki değer anomalilerini (Edge Score) tespit eden kantitatif bir spor veri terminalidir.'
                                    : (lang === 'de'
                                        ? 'LiveBet Mentor ist ein quantitatives Live-Fussball-Terminal, das Spieldaten mittels Poisson-Verteilung, Live-xG und Druckwellen-Telemetrie analysiert, um mathematische Werte (+EV) im Markt zu identifizieren.'
                                        : 'LiveBet Mentor is an institutional in-play football terminal that monitors live match telemetries using Poisson probability distribution, real-time xG, and momentum pressure waves to uncover positive expected value (+EV).')
                            },
                            {
                                q: lang === 'tr' ? 'DQS (Veri Kalitesi) ve Latans Kalkanı ne işe yarar?' : (lang === 'de' ? 'Was bewirken DQS und der Latenz-Schutz?' : 'What is DQS (Data Quality Score) and Latency Shield?'),
                                a: lang === 'tr'
                                    ? 'Canlı analizde saniyeler kaderi belirler. DQS motorumuz skor ve telemetri akışında 30 saniyeyi aşan gecikme veya veri tutarsızlığı algıladığında derhal "NO-BET" kalkanını kaldırır ve bayat veriyle karar verilmesini engeller.'
                                    : (lang === 'de'
                                        ? 'Live-Entscheidungen dulden keine Verzögerung. Übersteigt die Datenübertragung 30 Sekunden Latenz, schaltet das System sofort auf NO-BET, um Fehlschlüsse durch veraltete Daten auszuschließen.'
                                        : 'In-play analytics require ultra-low latency. If the data feed exhibits a delay exceeding 30 seconds or conflicting stats, the DQS engine immediately raises a NO-BET shield to protect your bankroll from stale data.')
                            },
                            {
                                q: lang === 'tr' ? '0-100 Isı Skoru (Heat Score) maçın hangi aşamasını gösterir?' : (lang === 'de' ? 'Was bedeuten die 0-100 Hitze-Werte (Heat Score)?' : 'What does the 0-100 Heat Score signify?'),
                                a: lang === 'tr'
                                    ? 'Saha içi şut trafiği, ceza sahası aksiyonları ve son 10 dakikalık ivmeyi ölçen dinamik algoritmadır. 85-100 (Alpha) tavan baskıyı, 70-84 (Alev) yoğun ablukayı simgelerken 55 altı maçlar sistem tarafından filtrelenir.'
                                    : (lang === 'de'
                                        ? 'Sie messen das reale Angriffsmomentum der letzten 10 Minuten. 85-100 (Alpha) markiert totale Felddominanz, während ineffektive Spiele unter 55 Punkten rigoros gefiltert werden.'
                                        : 'It measures genuine attacking momentum over 10-minute rolling windows. 85-100 (Alpha) indicates overwhelming siege, 70-84 (Flame) shows high-tempo danger, while matches below 55 are filtered out.')
                            },
                            {
                                q: lang === 'tr' ? 'Kelly Kriteri ile Kasa Yönetimi neden kombine kuponlardan üstündür?' : (lang === 'de' ? 'Warum ist das Kelly-Kriterium Kombiwetten überlegen?' : 'Why is Kelly Criterion staking superior to parlay bets?'),
                                a: lang === 'tr'
                                    ? 'Kombine kuponlar bahis bürolarının marjını katlar ve matematiksel iflas riskini %95\'e çıkarır. Kelly Kriteri ise sermayenizi değere (Edge) orantılı paylaştırarak uzun vadeli pozitif beklenen değer (+EV) sağlar.'
                                    : (lang === 'de'
                                        ? 'Kombiwetten maximieren die Buchmachermarge und führen statistisch fast unausweichlich zum Totalverlust. Das Kelly-Kriterium optimiert Einsätze proportional zum mathematischen Vorteil.'
                                        : 'Parlay bets multiply bookmaker vig and lead to a ~95% risk of eventual ruin. Kelly Criterion scientifically proportions stake sizes to positive mathematical edge, guaranteeing capital preservation.')
                            },
                            {
                                q: lang === 'tr' ? 'Platformda bahis oynanabilir mi veya kupon satışı var mı?' : (lang === 'de' ? 'Kann man auf der Plattform wetten?' : 'Can I place bets on this platform or buy picks?'),
                                a: lang === 'tr'
                                    ? 'HAYIR. Platformumuz 7258 sayılı kanun ve uluslararası mevzuatlara tam uyumlu bağımsız bir spor veri ve yazılım terminalidir. Bahis oynatmaz, aracılık etmez ve kesin kazanç vaat etmez. 18+ yaş sınırına tabidir.'
                                    : (lang === 'de'
                                        ? 'NEIN. LiveBet Mentor ist ein reines Analyse- und Software-Terminal. Es werden weder Wetten vermittelt noch platziert. Streng ab 18 Jahren und für verantwortungsvolle Datenanalyse.'
                                        : 'NO. LiveBet Mentor is an independent statistical intelligence software. It does not accept bets, broker wagers, or promise guaranteed returns. Strictly 18+ responsible analytics.')
                            }
                        ].map((item, idx) => {
                            const isOpen = activeFaqIndex === idx;
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        background: isOpen ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                                        border: isOpen ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <button
                                        onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                                        style={{
                                            width: '100%',
                                            padding: '1.4rem 1.6rem',
                                            background: 'transparent',
                                            border: 'none',
                                            color: isOpen ? '#38bdf8' : '#f8fafc',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            textAlign: 'left',
                                            fontWeight: 800,
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            gap: '1rem'
                                        }}
                                    >
                                        <span>{item.q}</span>
                                        <span style={{ fontSize: '1.2rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                            ▾
                                        </span>
                                    </button>
                                    {isOpen && (
                                        <div style={{
                                            padding: '0 1.6rem 1.4rem',
                                            color: '#94a3b8',
                                            fontSize: '0.9rem',
                                            lineHeight: 1.6,
                                            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                                            paddingTop: '1rem'
                                        }}>
                                            {item.a}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Institutional Legal Compliance Footer */}
            <footer style={{
                padding: '2.5rem 2rem',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(3, 7, 18, 0.95)',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.78rem',
                zIndex: 1,
                lineHeight: 1.6
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 900,
                        fontSize: '0.7rem'
                    }}>
                        {t.badge_18_plus || (lang === 'tr' ? '🔞 18+ Yasal Yaş Sınırı' : (lang === 'de' ? '🔞 18+ Gesetzliches Mindestalter' : '🔞 18+ Age Restriction'))}
                    </span>
                    <span style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.7rem'
                    }}>
                        {t.badge_responsible || (lang === 'tr' ? '🛡️ Sorumlu Analiz' : (lang === 'de' ? '🛡️ Verantwortungsbewusste Analyse' : '🛡️ Responsible Analytics'))}
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
                        {t.badge_statutory_compliance || (lang === 'tr' ? '⚖️ 7258 Sayılı Kanun Uyumlu' : (lang === 'de' ? '⚖️ Gesetzlich konform & reguliert' : '⚖️ Strict Regulatory Compliance'))}
                    </span>
                </div>

                <div style={{ maxWidth: '850px', margin: '0 auto 1.2rem', color: '#64748b' }}>
                    <strong style={{ color: '#94a3b8' }}>{t.legal_not_bookmaker}</strong>{' '}
                    {t.legal_disclaimer_text}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <a
                        href={`https://t.me/Livebetdeskbot?start=lang_${lang || 'tr'}`}
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
                        ✈️ {lang === 'tr' ? 'Telegram Canlı Destek' : (lang === 'de' ? 'Telegram Live-Support' : 'Telegram Live Support')}
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
                    <span style={{ opacity: 0.3 }}>|</span>
                    <span>{t.landing_footer_note}</span>
                </div>
            </footer>

            <LegalModal
                isOpen={isLegalModalOpen}
                onClose={() => setIsLegalModalOpen(false)}
                lang={lang}
            />

            {isCalculatorOpen && (
                <StakingCalculator
                    onClose={() => setIsCalculatorOpen(false)}
                    lang={lang}
                />
            )}

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(20px, -20px); }
                }
                button:hover { transform: translateY(-1px); filter: brightness(1.08); }
                button:active { transform: scale(0.98); }
                input:focus { border-color: #38bdf8 !important; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important; }

                /* Shimmer button animation */
                .landing-submit-btn:hover {
                    box-shadow: 0 10px 28px rgba(56, 189, 248, 0.45) !important;
                }

                /* Mobile Responsive Styles */
                @media (max-width: 768px) {
                    .landing-page main {
                        flex-direction: column !important;
                    }
                    .landing-nav {
                        padding: 0.75rem 1rem !important;
                    }
                    .landing-nav-brand span {
                        font-size: 0.95rem !important;
                    }
                    .landing-nav-desktop-buttons {
                        display: none !important;
                    }
                    .nav-tg-label {
                        display: none !important;
                    }
                    .landing-auth-container {
                        border-left: none !important;
                        border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                        padding: 5.5rem 1.25rem 2.5rem !important;
                        order: 1 !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .landing-auth-card {
                        padding: 1.75rem 1.35rem !important;
                        border-radius: 22px !important;
                        max-width: 100% !important;
                    }
                    .landing-page main > div:first-child {
                        padding: 3rem 1.25rem 2rem !important;
                        order: 2 !important;
                    }
                    .landing-page main > div:first-child > div {
                        max-width: 100% !important;
                    }
                    .landing-page main > div:first-child h1 {
                        font-size: 2.1rem !important;
                        letter-spacing: -1px !important;
                        line-height: 1.15 !important;
                    }
                    .landing-page main > div:first-child p {
                        font-size: 0.95rem !important;
                        margin-bottom: 2rem !important;
                    }
                    .landing-page main > div:first-child > div > div:last-child {
                        grid-template-columns: 1fr !important;
                        gap: 1.5rem !important;
                    }
                    .landing-page footer {
                        padding: 1.5rem 1rem !important;
                        font-size: 0.7rem !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .landing-nav {
                        padding: 0.65rem 0.85rem !important;
                    }
                    .landing-nav-brand div:first-child {
                        width: 28px !important;
                        height: 28px !important;
                        font-size: 0.75rem !important;
                    }
                    .landing-nav-brand span {
                        font-size: 0.86rem !important;
                    }
                    .live-badge {
                        display: none !important;
                    }
                    .landing-auth-container {
                        padding: 4.8rem 0.85rem 1.8rem !important;
                    }
                    .landing-auth-card {
                        padding: 1.35rem 1rem !important;
                        border-radius: 18px !important;
                    }
                    .landing-page main > div:first-child {
                        padding: 2.2rem 1rem 1.5rem !important;
                    }
                    .landing-page main > div:first-child h1 {
                        font-size: 1.6rem !important;
                    }
                }
            `}</style>
        </div>
    );
};
