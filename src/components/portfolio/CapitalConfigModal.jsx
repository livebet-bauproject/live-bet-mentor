import React, { useState } from 'react';
import { RISK_PROFILES } from '../../logic/bankrollManager';

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
                            {lang === 'tr' ? 'Sanal Portföy & Risk Ayarları' : 'Virtual Portfolio & Risk Setup'}
                        </h3>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
                            {lang === 'tr' ? 'Başlangıç sermayenizi ve risk iştahı profilinizi belirleyin' : 'Set your starting capital and risk profile'}
                        </div>
                    </div>
                </div>

                {/* Capital Input & Presets */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '0.45rem' }}>
                        {lang === 'tr' ? 'SANAL BAŞLANGIÇ SERMAYESİ (₺)' : 'STARTING VIRTUAL CAPITAL (₺)'}
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
                        {lang === 'tr' ? 'STRATEJİ & RİSK PROFİLİ SEÇİMİ' : 'SELECT RISK PROFILE'}
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {Object.values(RISK_PROFILES).map(p => {
                            const isSelected = selectedProfile === p.id;
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
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>{p.label}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>{p.description}</div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: p.color }}>
                                            Max %{(p.maxStakePct * 100).toFixed(1)} Risk
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                            Hedef: +%{(p.targetDailyPct * 100).toFixed(0)}
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
                    ℹ️ {lang === 'tr' 
                        ? 'Bu bakiye tamamen matematiksel bir simülasyondur. Gerçek para kabul edilmez. Amacımız cebinizi riske atmadan stratejileri test etmenizdir.' 
                        : 'This is purely an educational paper trading simulator. No real funds involved.'}
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
                        {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
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
                        {lang === 'tr' ? 'Kaydet & Simülasyonu Başlat' : 'Save & Launch'}
                    </button>
                </div>
            </div>
        </div>
    );
};
