import React, { useState, useEffect } from 'react';
import { supabase } from '../backend/supabaseClient';
import { translations } from '../locales/translations';
import '../styles/global.css';

export const LandingPage = ({ onLoginSuccess, onNavigate, lang, setLang }) => {
    const [view, setView] = useState('login'); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scrollY, setScrollY] = useState(0);

    const t = translations[lang] || translations['tr'];

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const cleanEmail = (email || '').trim().toLowerCase();
        const isAdmin = cleanEmail === 'karabulut.hamza@gmail.com';

        // Super Admin Master Login (Hamza123!, admin123, Hamza2026!, admin)
        if (isAdmin && (password === 'Hamza123!' || password === 'admin123' || password === 'Hamza2026!' || password === 'admin')) {
            const adminSession = {
                user: {
                    id: 'admin-super-hamza',
                    email: 'karabulut.hamza@gmail.com',
                    user_metadata: { display_name: 'Hamza Karabulut (Admin)' }
                },
                access_token: 'master-admin-token',
                expires_at: 9999999999
            };
            localStorage.setItem('lbm_admin_session', JSON.stringify(adminSession));
            onLoginSuccess(adminSession);
            setLoading(false);
            return;
        }

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
                        if (resData.status === 'pending') {
                            setError(lang === 'tr' 
                                ? '⏳ Üyeliğiniz onay beklemektedir. Yönetici onayından sonra giriş yapabilirsiniz.' 
                                : 'Your account is pending admin approval.');
                            setLoading(false);
                            return;
                        }
                        if (resData.status === 'expired') {
                            setError(lang === 'tr' 
                                ? '📅 Abonelik süreniz dolmuştur. Lütfen üyeliğinizi yenileyin.' 
                                : 'Subscription has expired.');
                            setLoading(false);
                            return;
                        }
                        const userSession = {
                            user: {
                                id: resData.user.id,
                                email: resData.user.email,
                                user_metadata: { display_name: resData.user.full_name || resData.user.email.split('@')[0] }
                            },
                            access_token: 'member-token-' + resData.user.id
                        };
                        onLoginSuccess(userSession);
                        return;
                    } else if (resData.error) {
                        setError(resData.error);
                        setLoading(false);
                        return;
                    }
                } catch (beErr) {
                    console.warn('Backend login fallback to Supabase:', beErr);
                }

                // Fallback Supabase
                const { data, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
                if (authError) throw authError;
                onLoginSuccess(data.session);
            } else {
                // REGISTER
                // 1. Submit to Backend Members API
                try {
                    await fetch(`${proxyBase}/api/members/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: cleanEmail, password, plan: 'trial' })
                    });
                } catch (beErr) {
                    console.warn('Backend register failed:', beErr);
                }

                // 2. Also attempt Supabase if available
                try {
                    await supabase.auth.signUp({ email: cleanEmail, password });
                } catch (supErr) {}

                setError(lang === 'tr' 
                    ? '✅ Kayıt başvurunuz alındı! Yönetici onayı sonrası hesabınız aktifleşecektir. Lütfen WhatsApp üzerinden iletişime geçin.' 
                    : '✅ Registration received! Your account will be activated after admin approval.');
                setView('login');
            }
        } catch (err) {
            if (isAdmin) {
                setError(lang === 'tr' ? '❌ Hatalı yönetici şifresi. Belirlenen admin şifresi: Hamza123!' : '❌ Invalid admin password.');
            } else {
                setError(err.message || (lang === 'tr' ? 'Giriş yapılamadı.' : 'Login failed.'));
            }
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
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                padding: '1.5rem 2rem',
                background: scrollY > 50 ? 'rgba(3, 7, 18, 0.8)' : 'transparent',
                backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
                transition: 'all 0.3s ease',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000' }}>LM</div>
                    <span style={{ fontWeight: 900, letterSpacing: '-1px', fontSize: '1.2rem' }}>LIVE BET MENTOR</span>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <button onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                        {lang === 'tr' ? 'EN' : 'TR'}
                    </button>
                    <button onClick={() => setView('login')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t.landing_cta_login}</button>
                    <button onClick={() => setView('register')} style={{ background: '#fff', color: '#000', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,255,255,0.2)' }}>{t.landing_cta_main}</button>
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
                <div style={{ flex: 0.8, background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(40px)', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '3rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', textAlign: 'center' }}>
                            {view === 'login' ? t.landing_cta_login : t.landing_cta_main}
                        </h2>
                        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
                            {view === 'login' ? t.login_to_panel : t.step1Desc}
                        </p>

                        <form onSubmit={handleAuth} style={{ display: 'grid', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>{t.email}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="name@example.com"
                                    style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>{t.password}</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none' }}
                                />
                            </div>

                            {error && (
                                <div style={{ padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading} style={{
                                width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.3s',
                                boxShadow: '0 8px 24px rgba(56, 189, 248, 0.2)', opacity: loading ? 0.7 : 1
                            }}>
                                {loading ? '...' : (view === 'login' ? t.landing_cta_login : t.landing_cta_main)}
                            </button>
                        </form>

                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button
                                onClick={() => setView(view === 'login' ? 'register' : 'login')}
                                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                {view === 'login' ? t.register : t.cta2}
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Simple Security Footer */}
            <footer style={{ padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: '#475569', fontSize: '0.8rem', zIndex: 1 }}>
                {t.landing_footer_note}
            </footer>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(20px, -20px); }
                }
                button:hover { transform: translateY(-2px); filter: brightness(1.1); }
                input:focus { border-color: #38bdf8 !important; }
                
                /* Mobile Responsive Styles */
                @media (max-width: 768px) {
                    .landing-page main {
                        flex-direction: column !important;
                    }
                    .landing-page main > div:first-child {
                        padding: 6rem 1.5rem 2rem !important;
                        order: 2;
                    }
                    .landing-page main > div:first-child > div {
                        max-width: 100% !important;
                    }
                    .landing-page main > div:first-child h1 {
                        font-size: 2rem !important;
                        letter-spacing: -1px !important;
                    }
                    .landing-page main > div:first-child p {
                        font-size: 1rem !important;
                        margin-bottom: 2rem !important;
                    }
                    .landing-page main > div:last-child {
                        border-left: none !important;
                        border-bottom: 1px solid rgba(255,255,255,0.05) !important;
                        padding: 5rem 1.5rem 2rem !important;
                        order: 1;
                    }
                    .landing-page main > div:last-child > div {
                        padding: 2rem !important;
                        max-width: 100% !important;
                    }
                    .landing-page nav {
                        padding: 1rem !important;
                    }
                    .landing-page nav > div:first-child span {
                        font-size: 0.9rem !important;
                    }
                    .landing-page nav > div:last-child {
                        gap: 0.5rem !important;
                    }
                    .landing-page nav > div:last-child button {
                        padding: 0.4rem 0.6rem !important;
                        font-size: 0.7rem !important;
                    }
                    .glass-panel h2 {
                        font-size: 1.5rem !important;
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
                    .landing-page main > div:first-child {
                        padding: 5rem 1rem 1.5rem !important;
                    }
                    .landing-page main > div:first-child h1 {
                        font-size: 1.6rem !important;
                    }
                    .landing-page main > div:last-child {
                        padding: 4.5rem 1rem 1.5rem !important;
                    }
                    .landing-page main > div:last-child > div {
                        padding: 1.5rem !important;
                        border-radius: 20px !important;
                    }
                    .landing-page nav > div:first-child > div:first-child {
                        width: 28px !important;
                        height: 28px !important;
                        font-size: 0.7rem !important;
                    }
                    .landing-page nav > div:first-child span {
                        font-size: 0.75rem !important;
                    }
                }
            `}</style>
        </div>
    );
};
