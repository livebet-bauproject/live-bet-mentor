import React, { useState } from 'react';
import { RISK_PROFILES } from '../../logic/bankrollManager';

const PROFILE_LOCALES = {
    CONSERVATIVE: {
        tr: { label: 'Muhafazakar Fon', desc: 'Sermaye koruma odaklı, düşük dalgalanmalı kurumsal fon disiplini.' },
        en: { label: 'Conservative Fund', desc: 'Capital preservation-focused, low-volatility institutional discipline.' },
        de: { label: 'Konservativer Fonds', desc: 'Fokus auf Kapitalschutz und minimale Schwankungen (institutionell).' }
    },
    BALANCED: {
        tr: { label: 'Dengeli Radar', desc: 'Değerli oran ve standart fraksiyonel Kelly dengesi.' },
        en: { label: 'Balanced Radar', desc: 'Optimal balance of value odds and fractional Kelly staking.' },
        de: { label: 'Ausgewogener Radar', desc: 'Ideale Balance aus Value-Quoten und fraktionalem Kelly-Einsatz.' }
    },
    DYNAMIC: {
        tr: { label: 'Dinamik Fırsat', desc: 'Yüksek xG ve momentum fırsatlarına odaklı dinamik simülasyon.' },
        en: { label: 'Dynamic Opportunity', desc: 'High-xG momentum and aggressive value opportunity simulation.' },
        de: { label: 'Dynamische Chance', desc: 'Fokus auf hohes xG-Momentum und dynamische Spielsituationen.' }
    }
};

const TEXTS = {
    tr: {
        title: 'Sanal Portföy & Risk Ayarları',
        subtitle: 'Başlangıç sermayenizi ve risk iştahı profilinizi belirleyin',
        capLabel: 'SANAL BAŞLANGIÇ SERMAYESİ (₺)',
        profileLabel: 'STRATEJİ & RİSK PROFİLİ SEÇİMİ',
        maxRisk: 'Max Risk',
        targetLabel: 'Hedef',
        disclaimer: 'Bu bakiye tamamen matematiksel bir simülasyondur. Gerçek para kabul edilmez. Amacımız cebinizi riske atmadan stratejileri test etmenizdir.',
        cancel: 'Vazgeç',
        save: 'Kaydet & Simülasyonu Başlat'
    },
    en: {
        title: 'Virtual Portfolio & Risk Setup',
        subtitle: 'Configure your starting capital and select your risk appetite profile',
        capLabel: 'STARTING VIRTUAL CAPITAL (₺ / € / $)',
        profileLabel: 'STRATEGY & RISK PROFILE SELECTION',
        maxRisk: 'Max Risk',
        targetLabel: 'Target',
        disclaimer: 'This balance is strictly a mathematical paper trading simulation. No real money processed. Test strategies with zero risk.',
        cancel: 'Cancel',
        save: 'Save & Launch Simulation'
    },
    de: {
        title: 'Virtuelles Portfolio & Risiko-Einstellungen',
        subtitle: 'Legen Sie Ihr Startkapital fest und wählen Sie Ihr Risikoprofil',
        capLabel: 'VIRTUELLES STARTKAPITAL (₺ / €)',
        profileLabel: 'STRATEGIE- & RISIKOPROFIL WÄHLEN',
        maxRisk: 'Max. Risiko',
        targetLabel: 'Ziel',
        disclaimer: 'Dieses Guthaben ist eine reine mathematische Simulation (Paper Trading). Kein echtes Geld erforderlich. Testen Sie Strategien risikofrei.',
        cancel: 'Abbrechen',
        save: 'Speichern & Simulation starten'
    }
};

export const CapitalConfigModal = ({
    isOpen,
    onClose,
    currentCapital,
    currentProfile,
    onSave,
    lang = 'tr'
}) => {
    if (!isOpen) return null;

    const [amount, setAmount] = useState(currentCapital || 2000);
    const [selectedProfile, setSelectedProfile] = useState(currentProfile || 'BALANCED');

    const handleSave = () => {
        onSave(amount, selectedProfile);
        onClose();
    };

    const loc = TEXTS[lang] || TEXTS.tr;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #0b1329 0%, #030712 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '20px',
                maxWidth: '520px',
                width: '100%',
                padding: '2rem',
                color: '#f8fafc',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                position: 'relative'
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: '#94a3b8',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ✕
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1.8rem' }}>⚙️</span>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: '#f8fafc' }}>
                            {loc.title}
                        </h3>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
                            {loc.subtitle}
                        </div>
                    </div>
                </div>

                {/* Capital Input & Presets */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '0.45rem' }}>
                        {loc.capLabel}
                    </label>
                    <input
                        type="number"
                        min={100}
                        max={100000}
                        step={100}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        style={{
                            width: '100%',
                            background: '#0f172a',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            color: '#f8fafc',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />

                    <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        {[1000, 2000, 5000, 10000, 25000].map(val => (
                            <button
                                key={val}
                                onClick={() => setAmount(val)}
                                style={{
                                    background: amount === val ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                    border: `1px solid ${amount === val ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                                    color: amount === val ? '#38bdf8' : '#94a3b8',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                {val.toLocaleString()} ₺
                            </button>
                        ))}
                    </div>
                </div>

                {/* Risk Profile Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '0.6rem' }}>
                        {loc.profileLabel}
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {Object.values(RISK_PROFILES).map(p => {
                            const isSelected = selectedProfile === p.id;
                            const pTrans = (PROFILE_LOCALES[p.id] && PROFILE_LOCALES[p.id][lang]) || (PROFILE_LOCALES[p.id] && PROFILE_LOCALES[p.id].tr) || { label: p.label, desc: p.description };

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedProfile(p.id)}
                                    style={{
                                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                        border: `1px solid ${isSelected ? p.color : 'rgba(255, 255, 255, 0.06)'}`,
                                        borderRadius: '12px',
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ fontSize: '1.3rem' }}>{p.icon}</span>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>{pTrans.label}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>{pTrans.desc}</div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: p.color }}>
                                            {loc.maxRisk} %{(p.maxStakePct * 100).toFixed(1)}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                            {loc.targetLabel}: +%{(p.targetDailyPct * 100).toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Educational Disclaimer */}
                <div style={{
                    background: 'rgba(0,0,0,0.35)',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    lineHeight: '1.4',
                    marginBottom: '1.5rem'
                }}>
                    ℹ️ {loc.disclaimer}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#94a3b8',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        {loc.cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: '#fff',
                            padding: '0.6rem 1.4rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                        }}
                    >
                        {loc.save}
                    </button>
                </div>
            </div>
        </div>
    );
};
