import React, { useState } from 'react';
import { supabase } from '../backend/supabaseClient';
import { translations } from '../locales/translations';

export const RegisterPage = ({ onNavigate, lang = 'tr', setLang }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: '',
        acceptTerms: false
    });

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const t = translations[lang];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        if (formData.password !== formData.confirmPassword) {
            setStatus({ type: 'error', message: lang === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match' });
            setLoading(false);
            return;
        }

        if (!formData.acceptTerms) {
            setStatus({ type: 'error', message: lang === 'tr' ? 'Kullanım koşullarını kabul etmelisiniz' : 'You must accept the terms' });
            setLoading(false);
            return;
        }

        const proxyBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3001'
            : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

        try {
            // 1. Submit to Backend Members API (Stores to web_members.json & triggers Telegram alert)
            try {
                await fetch(`${proxyBase}/api/members/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: formData.email, 
                        password: formData.password,
                        fullName: formData.fullName, 
                        phone: formData.phone, 
                        plan: 'Trial' 
                    })
                });
            } catch (beErr) {
                console.warn('Backend register failed:', beErr);
            }

            // 2. Fallback Supabase signup if available
            try {
                const { data: authData } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                });

                if (authData?.user) {
                    await supabase
                        .from('profiles')
                        .insert([
                            {
                                id: authData.user.id,
                                email: formData.email,
                                full_name: formData.fullName,
                                phone: formData.phone,
                                status: 'pending',
                                created_at: new Date().toISOString()
                            }
                        ]);
                }
            } catch (supErr) {}

            setStatus({
                type: 'success',
                message: t.register_success_desc
            });
        } catch (err) {
            console.error('Registration error:', err);
            setStatus({ type: 'error', message: err.message || 'Registration failed' });
        } finally {
            setLoading(false);
        }
    };

    if (status.type === 'success') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #030712, #0f172a)',
                padding: '2rem'
            }}>
                <div className="glass-panel" style={{
                    padding: '3rem',
                    maxWidth: '500px',
                    textAlign: 'center',
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: '20px',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
                    <h2 style={{ color: '#10b981', marginBottom: '1rem' }}>{t.register_success}</h2>
                    <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{status.message}</p>
                    <button
                        onClick={() => onNavigate('landing')}
                        style={{
                            marginTop: '2rem',
                            padding: '0.8rem 2rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            borderRadius: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        {t.backToHome}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #030712 0%, #0f172a 50%, #030712 100%)',
            padding: '2rem'
        }}>
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <button
                        onClick={() => onNavigate('landing')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        ← {t.backToHome}
                    </button>

                    <button
                        onClick={() => setLang && setLang(lang === 'tr' ? 'en' : 'tr')}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <span>{lang === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}</span>
                    </button>
                </div>

                <div className="glass-panel" style={{
                    padding: '3rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <span style={{ fontSize: '2.5rem' }}>📈</span>
                        <h1 style={{
                            fontSize: '1.8rem',
                            fontWeight: 900,
                            background: 'linear-gradient(to right, #fff, #38bdf8)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginTop: '0.5rem'
                        }}>
                            {t.title}
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            {t.register_subtitle || t.subtitle}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                                {t.email} *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder={t.emailPlaceholder}
                                required
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                                {t.password} *
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder={t.passwordPlaceholder}
                                required
                                minLength={6}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                                {t.confirmPassword} *
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                placeholder={t.confirmPlaceholder}
                                required
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                                {t.fullName}
                            </label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                placeholder={t.namePlaceholder}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                                {t.phone}
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder={t.phonePlaceholder}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.acceptTerms}
                                    onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        marginTop: '2px',
                                        accentColor: '#38bdf8'
                                    }}
                                />
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                    {t.acceptTerms}
                                </span>
                            </label>
                        </div>

                        {status.message && status.type === 'error' && (
                            <div style={{
                                marginBottom: '1.5rem',
                                padding: '1rem',
                                borderRadius: '10px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                fontSize: '0.9rem'
                            }}>
                                {status.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: loading
                                    ? 'rgba(56, 189, 248, 0.3)'
                                    : 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                                border: 'none',
                                borderRadius: '10px',
                                color: loading ? '#94a3b8' : '#000',
                                fontSize: '1rem',
                                fontWeight: 900,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: loading ? 'none' : '0 4px 15px rgba(56, 189, 248, 0.3)'
                            }}
                        >
                            {loading ? '...' : t.register}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
                        {t.haveAccount}{' '}
                        <button
                            onClick={() => onNavigate('login')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            {t.login}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
