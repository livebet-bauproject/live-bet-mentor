import React, { useState } from 'react';
import { translations } from '../locales/translations';

export const FAQ = ({ onClose, lang = 'tr', mode = 'live' }) => {
    const t = translations[lang] || translations['tr'];
    const [currentMode, setCurrentMode] = useState(mode || 'live');

    const safeSplit = (str, idx = 1) => {
        if (!str) return '';
        const parts = str.split(':');
        if (idx === 0) return parts[0] || '';
        return parts.slice(1).join(':').trim();
    };

    const isLive = currentMode === 'live';
    const isRadar = currentMode === 'radar';
    const isStaking = currentMode === 'staking';
    const isAI = currentMode === 'ai';

    const getHeaderTitle = () => {
        if (isAI) return t.faq_ai_title;
        if (isStaking) return t.staking_faq_title;
        if (isRadar) return t.faq_radar_title;
        return t.faq_live_title;
    };

    const getHeaderSubtitle = () => {
        if (isAI) return t.faq_ai_subtitle;
        if (isStaking) return t.staking_faq_subtitle || 'Bileşik Kelly Modeli, Kombine Kupon Tuzağı ve Otomatik Kasa Koruma Kilitleri';
        if (isRadar) return t.faq_radar_subtitle;
        return t.faq_live_subtitle;
    };

    const getHeaderGradient = () => {
        if (isAI) return 'linear-gradient(to right, #a78bfa, #818cf8)';
        if (isStaking) return 'linear-gradient(to right, #fbbf24, #f59e0b)';
        if (isRadar) return 'linear-gradient(to right, #00f2fe, #34d399)';
        return 'linear-gradient(to right, var(--text-primary), var(--accent-color))';
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                background: 'rgba(3, 7, 18, 0.98)',
                zIndex: 5000,
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)'
            }}
        >
            <div
                className="glass-panel faq-modal-content"
                onClick={e => e.stopPropagation()}
                style={{
                    animation: 'modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--accent-color) transparent',
                    maxWidth: '1200px',
                    width: '92%',
                    maxHeight: '92vh',
                    padding: '2.5rem 2rem'
                }}
            >
                <button
                    onClick={onClose}
                    className="close-btn-enhanced"
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--danger-color)',
                        color: 'var(--danger-color)',
                        width: '2.8rem',
                        height: '2.8rem',
                        borderRadius: '50%',
                        fontSize: '1.6rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s',
                        zIndex: 100
                    }}
                >
                    ×
                </button>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{
                        background: getHeaderGradient(),
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '2.2rem',
                        fontWeight: 900,
                        letterSpacing: '-0.5px',
                        marginBottom: '0.6rem'
                    }}>
                        {getHeaderTitle()}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.5' }}>
                        {getHeaderSubtitle()}
                    </p>
                </div>

                {/* 4-Tab Navigation Bar */}
                <div className="faq-tabs-nav" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                    marginBottom: '2.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '1.2rem'
                }}>
                    <button
                        onClick={() => setCurrentMode('live')}
                        className={`faq-tab-btn ${isLive ? 'active' : ''}`}
                        style={{
                            background: isLive ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.3))' : 'rgba(255, 255, 255, 0.03)',
                            border: isLive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: isLive ? '#38bdf8' : 'var(--text-secondary)',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            letterSpacing: '0.5px',
                            transition: 'all 0.2s',
                            boxShadow: isLive ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none'
                        }}
                    >
                        {t.faq_tab_live || '🔥 CANLI RADAR & FIRSATLAR'}
                    </button>
                    <button
                        onClick={() => setCurrentMode('radar')}
                        className={`faq-tab-btn ${isRadar ? 'active' : ''}`}
                        style={{
                            background: isRadar ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(52, 211, 153, 0.3))' : 'rgba(255, 255, 255, 0.03)',
                            border: isRadar ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: isRadar ? '#00f2fe' : 'var(--text-secondary)',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            letterSpacing: '0.5px',
                            transition: 'all 0.2s',
                            boxShadow: isRadar ? '0 0 15px rgba(0, 242, 254, 0.25)' : 'none'
                        }}
                    >
                        {t.faq_tab_radar || '🌍 KONSENSÜS & PİYASA'}
                    </button>
                    <button
                        onClick={() => setCurrentMode('staking')}
                        className={`faq-tab-btn ${isStaking ? 'active' : ''}`}
                        style={{
                            background: isStaking ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.3))' : 'rgba(255, 255, 255, 0.03)',
                            border: isStaking ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: isStaking ? '#fbbf24' : 'var(--text-secondary)',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            letterSpacing: '0.5px',
                            transition: 'all 0.2s',
                            boxShadow: isStaking ? '0 0 15px rgba(251, 191, 36, 0.25)' : 'none'
                        }}
                    >
                        {t.faq_tab_staking || '💰 KASA & DİSİPLİN'}
                    </button>
                    <button
                        onClick={() => setCurrentMode('ai')}
                        className={`faq-tab-btn ${isAI ? 'active' : ''}`}
                        style={{
                            background: isAI ? 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(129, 140, 248, 0.3))' : 'rgba(255, 255, 255, 0.03)',
                            border: isAI ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: isAI ? '#a78bfa' : 'var(--text-secondary)',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            letterSpacing: '0.5px',
                            transition: 'all 0.2s',
                            boxShadow: isAI ? '0 0 15px rgba(167, 139, 250, 0.25)' : 'none'
                        }}
                    >
                        {t.faq_tab_ai || '🤖 YAPAY ZEKA & MOTORLAR'}
                    </button>
                </div>

                <div className="faq-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* Live Specific Sections */}
                    {isLive && (
                        <>
                            {/* Card 1: DQS */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--accent-color)' }}>
                                <h2 style={{ color: 'var(--accent-color)', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: 'var(--accent-color)', borderRadius: '4px' }}></span>
                                    {t.faq_q1_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_q1_desc}
                                </p>
                                <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '1.2rem', borderRadius: '12px', marginTop: '1.2rem', fontSize: '0.92rem', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                                    <b style={{ color: 'var(--accent-color)' }}>{safeSplit(t.faq_q1_example, 0)}:</b> {safeSplit(t.faq_q1_example, 1)}
                                </div>
                            </section>

                            {/* Card 2: 0-100 Isı Skoru (ALPHA, ALEV, SICAK, SOĞUK) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #f59e0b' }}>
                                <h2 style={{ color: '#f59e0b', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#f59e0b', borderRadius: '4px' }}></span>
                                    {t.faq_heat_score_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.faq_heat_score_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        <b style={{ color: '#ef4444', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>{t.faq_heat_alpha_title}</b>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.faq_heat_alpha_desc}</span>
                                    </div>
                                    <div style={{ background: 'rgba(249, 115, 22, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                                        <b style={{ color: '#f97316', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>{t.faq_heat_alev_title}</b>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.faq_heat_alev_desc}</span>
                                    </div>
                                    <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                        <b style={{ color: '#38bdf8', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>{t.faq_heat_sicak_title}</b>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.faq_heat_sicak_desc}</span>
                                    </div>
                                    <div style={{ background: 'rgba(148, 163, 184, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                                        <b style={{ color: '#94a3b8', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>{t.faq_heat_soguk_title}</b>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.faq_heat_soguk_desc}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Card 3: Günün Canlı Altın İkilisi (Combo Wizard v4.0) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #34d399' }}>
                                <h2 style={{ color: '#34d399', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#34d399', borderRadius: '4px' }}></span>
                                    {t.faq_combo_wizard_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_combo_wizard_desc}
                                </p>
                                <div style={{ background: 'rgba(52, 211, 153, 0.06)', padding: '1.2rem', borderRadius: '12px', marginTop: '1.2rem', fontSize: '0.92rem', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                    <b style={{ color: '#34d399' }}>{safeSplit(t.faq_combo_wizard_example, 0)}:</b> {safeSplit(t.faq_combo_wizard_example, 1)}
                                </div>
                            </section>

                            {/* Card 4: Baskı Grafiği (Pressure Wave) & Akın Yönü */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #38bdf8' }}>
                                <h2 style={{ color: '#38bdf8', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#38bdf8', borderRadius: '4px' }}></span>
                                    {t.faq_pressure_wave_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_pressure_wave_desc}
                                </p>
                                <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '1.2rem', borderRadius: '12px', marginTop: '1.2rem', fontSize: '0.92rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                    <b style={{ color: '#38bdf8' }}>{safeSplit(t.faq_pressure_wave_example, 0)}:</b> {safeSplit(t.faq_pressure_wave_example, 1)}
                                </div>
                            </section>

                            {/* Card 5: Risk Guard (Momentum & Ölü Maç) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--warning-color)' }}>
                                <h2 style={{ color: 'var(--warning-color)', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: 'var(--warning-color)', borderRadius: '4px' }}></span>
                                    {t.faq_q2_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.faq_q2_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
                                    <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.6rem', color: 'var(--warning-color)', fontWeight: 800 }}>{t.faq_momentum_title}</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', lineHeight: '1.6' }}>{t.faq_momentum_desc}</p>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', background: 'rgba(56, 189, 248, 0.06)', padding: '0.7rem', borderRadius: '8px' }}>
                                            <b>{safeSplit(t.faq_momentum_scenario, 0)}:</b> {safeSplit(t.faq_momentum_scenario, 1)}
                                        </div>
                                    </div>
                                    <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.6rem', color: 'var(--warning-color)', fontWeight: 800 }}>{t.faq_deadmatch_title}</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', lineHeight: '1.6' }}>{t.faq_deadmatch_desc}</p>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', background: 'rgba(56, 189, 248, 0.06)', padding: '0.7rem', borderRadius: '8px' }}>
                                            <b>{safeSplit(t.faq_deadmatch_scenario, 0)}:</b> {safeSplit(t.faq_deadmatch_scenario, 1)}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Card 6: Lig Kademeleri */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #10b981' }}>
                                <h2 style={{ color: '#10b981', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#10b981', borderRadius: '4px' }}></span>
                                    {t.faq_q10_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.2rem' }}>
                                    {t.faq_q10_desc}
                                </p>
                                <div style={{ display: 'grid', gap: '0.8rem' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem 1.2rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                        <b style={{ color: '#10b981', display: 'block', marginBottom: '0.3rem', fontSize: '0.95rem' }}>{t.faq_tier1_title}</b>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.faq_tier1_desc}</span>
                                    </div>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1rem 1.2rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                                        <b style={{ color: '#f59e0b', display: 'block', marginBottom: '0.3rem', fontSize: '0.95rem' }}>{t.faq_tier2_title}</b>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.faq_tier2_desc}</span>
                                    </div>
                                    <div style={{ background: 'rgba(148, 163, 184, 0.05)', padding: '1rem 1.2rem', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                                        <b style={{ color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontSize: '0.95rem' }}>{t.faq_tier3_title}</b>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.faq_tier3_desc}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Card 7: xG & Big Chances */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #a78bfa' }}>
                                <h2 style={{ color: '#a78bfa', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#a78bfa', borderRadius: '4px' }}></span>
                                    {t.faq_q8_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1rem' }}>
                                    {t.faq_q8_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(167, 139, 250, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(167, 139, 250, 0.15)' }}>
                                        <b style={{ color: '#a78bfa', display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem' }}>{safeSplit(t.faq_q8_purpose, 0)}</b>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{safeSplit(t.faq_q8_purpose, 1)}</span>
                                    </div>
                                    <div style={{ background: 'rgba(167, 139, 250, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(167, 139, 250, 0.15)' }}>
                                        <b style={{ color: '#a78bfa', display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem' }}>{safeSplit(t.faq_q8_feature, 0)}</b>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{safeSplit(t.faq_q8_feature, 1)}</span>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 2: KONSENSÜS & PİYASA RADARI */}
                    {/* ========================================================= */}
                    {isRadar && (
                        <>
                            {/* Card 1: Konsensüs Motoru */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #00f2fe' }}>
                                <h2 style={{ color: '#00f2fe', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#00f2fe', borderRadius: '4px' }}></span>
                                    {t.radar_faq_q1_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.radar_faq_q1_desc}
                                </p>
                            </section>

                            {/* Card 2: Tam Uyumluluk (8/8) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #34d399' }}>
                                <h2 style={{ color: '#34d399', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#34d399', borderRadius: '4px' }}></span>
                                    {t.radar_faq_q2_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.2rem' }}>
                                    {t.radar_faq_q2_desc}
                                </p>
                                <div style={{ background: 'rgba(52, 211, 153, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                    <b style={{ color: '#34d399', display: 'block', marginBottom: '0.4rem' }}>{t.radar_faq_q3_title}</b>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.radar_faq_q3_desc}</span>
                                </div>
                            </section>

                            {/* Card 3: Avrupa Piyasa Akışı (Onaylı Trend vs Tuzak) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #f43f5e' }}>
                                <h2 style={{ color: '#f43f5e', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#f43f5e', borderRadius: '4px' }}></span>
                                    {t.radar_market_flow_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.radar_market_flow_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                        <b style={{ color: '#10b981', display: 'block', marginBottom: '0.5rem', fontSize: '1rem' }}>{t.radar_market_approved_title}</b>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.radar_market_approved_desc}</p>
                                    </div>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                        <b style={{ color: '#ef4444', display: 'block', marginBottom: '0.5rem', fontSize: '1rem' }}>{t.radar_market_trap_title}</b>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.radar_market_trap_desc}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Card 4: Aykırılık & Safe Mode */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #fbbf24' }}>
                                <h2 style={{ color: '#fbbf24', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#fbbf24', borderRadius: '4px' }}></span>
                                    {t.radar_faq_q5_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.radar_faq_q5_desc}
                                </p>
                            </section>

                            {/* Card 5: Value Edge */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #38bdf8' }}>
                                <h2 style={{ color: '#38bdf8', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#38bdf8', borderRadius: '4px' }}></span>
                                    {t.radar_faq_q4_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1rem' }}>
                                    {t.radar_faq_q4_desc}
                                </p>
                                <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                                    <b style={{ color: '#38bdf8', display: 'block', marginBottom: '0.3rem' }}>{t.radar_faq_q8_title}</b>
                                    <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{t.radar_faq_q8_desc}</span>
                                </div>
                            </section>

                            {/* Card 6: IQ Kaynak Rozetleri */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #a78bfa' }}>
                                <h2 style={{ color: '#a78bfa', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#a78bfa', borderRadius: '4px' }}></span>
                                    {t.radar_faq_q6_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.radar_faq_q6_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    <div style={{ padding: '1rem', background: 'rgba(52, 211, 153, 0.05)', borderRadius: '10px', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
                                        <b style={{ color: '#34d399', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>Forebet (AI / Stat)</b>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.source_forebet_desc}</p>
                                    </div>
                                    <div style={{ padding: '1rem', background: 'rgba(251, 146, 60, 0.05)', borderRadius: '10px', border: '1px solid rgba(251, 146, 60, 0.15)' }}>
                                        <b style={{ color: '#fb923c', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>PredictZ / Vitibet</b>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.source_soccervista_desc}</p>
                                    </div>
                                    <div style={{ padding: '1rem', background: 'rgba(0, 242, 254, 0.05)', borderRadius: '10px', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
                                        <b style={{ color: '#00f2fe', display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem' }}>OLBG / Community</b>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.source_olbg_desc}</p>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 3: KASA YÖNETİMİ & BAHİS DİSİPLİNİ */}
                    {/* ========================================================= */}
                    {isStaking && (
                        <>
                            {/* Card 1: Kelly Modeli */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #fbbf24' }}>
                                <h2 style={{ color: '#fbbf24', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#fbbf24', borderRadius: '4px' }}></span>
                                    {t.staking_faq_q1_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.2rem' }}>
                                    {t.staking_faq_q1_desc}
                                </p>
                                <div style={{ background: 'rgba(251, 191, 36, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                                    <b style={{ color: '#fbbf24', display: 'block', marginBottom: '0.3rem' }}>{t.staking_faq_q2_title}</b>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{t.staking_faq_q2_desc}</span>
                                </div>
                            </section>

                            {/* Card 2: Otomatik Kasa Koruma Kilitleri */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #ef4444' }}>
                                <h2 style={{ color: '#ef4444', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#ef4444', borderRadius: '4px' }}></span>
                                    {t.staking_locks_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.2rem' }}>
                                    {t.staking_locks_desc}
                                </p>
                                <div style={{ display: 'grid', gap: '0.8rem' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{t.staking_mode_normal}</span>
                                    </div>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                        <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{t.staking_mode_caution}</span>
                                    </div>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{t.staking_mode_nobet}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Card 3: Günlük Disiplin Kilitleri (%5 Kar / %3 Zarar) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #38bdf8' }}>
                                <h2 style={{ color: '#38bdf8', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#38bdf8', borderRadius: '4px' }}></span>
                                    {t.staking_daily_limits_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.staking_daily_limits_desc}
                                </p>
                            </section>

                            {/* Card 4: Kombine Kupon Tuzağı Matematiksel Kanıtı */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #f43f5e' }}>
                                <h2 style={{ color: '#f43f5e', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#f43f5e', borderRadius: '4px' }}></span>
                                    {t.staking_faq_q5_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.staking_faq_q5_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                        <b style={{ color: '#ef4444', display: 'block', marginBottom: '0.5rem', fontSize: '1rem' }}>{t.staking_faq_q6_title}</b>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.staking_faq_q6_desc}</p>
                                    </div>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                        <b style={{ color: '#10b981', display: 'block', marginBottom: '0.5rem', fontSize: '1rem' }}>{t.staking_faq_q7_title}</b>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.staking_faq_q7_desc}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Card 5: Ledger */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #a78bfa' }}>
                                <h2 style={{ color: '#a78bfa', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#a78bfa', borderRadius: '4px' }}></span>
                                    {t.faq_bankroll_q4_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_bankroll_q4_desc}
                                </p>
                            </section>

                            {/* Critical Warning Callout */}
                            <div style={{
                                padding: '1.5rem 2rem',
                                background: 'rgba(239, 68, 68, 0.08)',
                                borderRadius: '15px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.2rem'
                            }}>
                                <span style={{ fontSize: '2.2rem' }}>⚠️</span>
                                <div style={{ textAlign: 'left' }}>
                                    <h4 style={{ color: '#ef4444', marginBottom: '0.3rem', fontWeight: 800, fontSize: '1.1rem' }}>KRİTİK SERMAYE KURALI</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
                                        {t.staking_warning}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 4: YAPAY ZEKA & OTONOM MOTORLAR */}
                    {/* ========================================================= */}
                    {isAI && (
                        <>
                            {/* Card 1: Google Gemini */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #a78bfa' }}>
                                <h2 style={{ color: '#a78bfa', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#a78bfa', borderRadius: '4px' }}></span>
                                    {t.faq_gemini_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.faq_gemini_desc}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    {[1, 2, 3, 4].map(num => (
                                        <div key={num} style={{ background: 'rgba(167, 139, 250, 0.05)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(167, 139, 250, 0.15)' }}>
                                            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5', display: 'block' }}>
                                                {t[`faq_ai_data_l${num}`]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ background: 'rgba(167, 139, 250, 0.08)', padding: '1.2rem', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #a78bfa' }}>
                                    <b style={{ color: '#a78bfa', fontSize: '0.95rem' }}>{t.faq_ai_logic_summary}</b>
                                </div>
                            </section>

                            {/* Card 2: AI Safety Guard (DQS < 0.40) */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #f43f5e' }}>
                                <h2 style={{ color: '#f43f5e', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#f43f5e', borderRadius: '4px' }}></span>
                                    {t.faq_q16_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_q16_desc}
                                </p>
                            </section>

                            {/* Card 3: AI Scenario Intel */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #38bdf8' }}>
                                <h2 style={{ color: '#38bdf8', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#38bdf8', borderRadius: '4px' }}></span>
                                    {t.faq_q17_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_q17_desc}
                                </p>
                                <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '1rem', borderRadius: '10px', marginTop: '1rem', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                                    <b style={{ color: '#38bdf8' }}>{safeSplit(t.faq_q17_example, 0)}:</b> {safeSplit(t.faq_q17_example, 1)}
                                </div>
                            </section>

                            {/* Card 4: Telegram VIP Bot & Cashout Kalkanı */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #00f2fe' }}>
                                <h2 style={{ color: '#00f2fe', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#00f2fe', borderRadius: '4px' }}></span>
                                    {t.faq_telegram_bot_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.5rem' }}>
                                    {t.faq_telegram_bot_desc}
                                </p>
                                <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                    <b style={{ color: '#ef4444', display: 'block', marginBottom: '0.4rem' }}>{t.faq_cashout_shield_title}</b>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.faq_cashout_shield_desc}</span>
                                </div>
                            </section>

                            {/* Card 5: Self-Learning Makine Öğrenimi */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #34d399' }}>
                                <h2 style={{ color: '#34d399', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#34d399', borderRadius: '4px' }}></span>
                                    {t.faq_learning_engine_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                                    {t.faq_learning_engine_desc}
                                </p>
                            </section>

                            {/* Card 6: Bayesian Modeli */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #fbbf24' }}>
                                <h2 style={{ color: '#fbbf24', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#fbbf24', borderRadius: '4px' }}></span>
                                    {t.faq_q9_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1rem' }}>
                                    {t.faq_q9_desc}
                                </p>
                                <div style={{ background: 'rgba(251, 191, 36, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.15)' }}>
                                    <b style={{ color: '#fbbf24', display: 'block', marginBottom: '0.3rem' }}>{safeSplit(t.faq_q9_feature, 0)}</b>
                                    <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{safeSplit(t.faq_q9_feature, 1)}</span>
                                </div>
                            </section>

                            {/* Card 7: Smart Alert & Accuracy */}
                            <section className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #10b981' }}>
                                <h2 style={{ color: '#10b981', fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ width: '8px', height: '22px', background: '#10b981', borderRadius: '4px' }}></span>
                                    {t.faq_alert_title}
                                </h2>
                                <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '0.98rem', marginBottom: '1.2rem' }}>
                                    {t.faq_alert_desc}
                                </p>
                                <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                    <b style={{ color: '#10b981', display: 'block', marginBottom: '0.3rem' }}>{t.faq_tracking_title}</b>
                                    <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{t.faq_tracking_desc}</span>
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Institutional Footer Banner */}
                <div style={{
                    marginTop: '3.5rem',
                    padding: '2rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '16px',
                    textAlign: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <p style={{ fontWeight: 800, color: 'var(--accent-color)', fontSize: '1.1rem', letterSpacing: '0.5px' }}>
                        {t.faq_footer_main}
                    </p>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
                        {t.faq_footer_sub}
                    </p>
                </div>
            </div>
        </div>
    );
};
