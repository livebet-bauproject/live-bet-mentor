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
    },
    CUSTOM: {
        tr: { label: 'Özel Risk Modu', desc: 'Kendi kâr hedefinizi, stop-loss ve masa riski sınırlarınızı belirleyin.' },
        en: { label: 'Custom Risk Mode', desc: 'Define your own profit target, stop-loss limits, and table exposure.' },
        de: { label: 'Benutzerdefinierter Modus', desc: 'Individuelle Gewinnziele, Stop-Loss-Grenzen und Tischrisiko festlegen.' }
    }
};

const TEXTS = {
    tr: {
        title: 'Sanal Portföy & Risk Ayarları',
        subtitle: 'Başlangıç sermayenizi ve risk iştahı profilinizi belirleyin',
        capLabel: 'SANAL BAŞLANGIÇ SERMAYESİ',
        profileLabel: 'STRATEJİ & RİSK PROFİLİ SEÇİMİ',
        maxRisk: 'Max Risk',
        targetLabel: 'Hedef',
        disclaimer: 'Bu bakiye tamamen matematiksel bir simülasyondur. Gerçek para kabul edilmez. Amacımız cebinizi riske atmadan stratejileri test etmenizdir.',
        cancel: 'Vazgeç',
        save: 'Kaydet & Ayarları Uygula',
        customSettingsTitle: 'ÖZEL RİSK & DİSİPLİN KONTROLLERİ',
        customSettingsDesc: 'Günlük kâr kilidi, stop-loss, masa riski ve robot limitlerinizi kendiniz yönetin.',
        targetDailyTitle: 'Günlük Kâr Hedefi (+%)',
        targetDailySub: 'Hedefe ulaşıldığında kâr kilitlenir.',
        stopLossTitle: 'Günlük Stop-Loss Limiti (-%)',
        stopLossSub: 'Sermayeyi korumak için işlemler durdurulur.',
        maxConcurrentTitle: 'Masadaki Maksimum Açık Maç',
        maxConcurrentSub: 'Aynı anda kasanın girebileceği maç adedi.',
        maxStakeTitle: 'Tek Maç Tavan Mermisi (Max Stake)',
        maxStakeSub: 'En güvendiği elit maçta dahi atılacak max birim.',
        autoPilotMinConfTitle: 'Otonom Robot Güven Eşiği',
        autoPilotMinConfSub: 'Robotun otomatik gireceği minimum AI güven puanı.',
        matchesUnit: 'Maç',
        liveImpact: 'Canlı Kural Önizlemesi'
    },
    en: {
        title: 'Virtual Portfolio & Risk Setup',
        subtitle: 'Configure your starting capital and select your risk appetite profile',
        capLabel: 'STARTING VIRTUAL CAPITAL',
        profileLabel: 'STRATEGY & RISK PROFILE SELECTION',
        maxRisk: 'Max Risk',
        targetLabel: 'Target',
        disclaimer: 'This balance is strictly a mathematical paper trading simulation. No real money processed. Test strategies with zero risk.',
        cancel: 'Cancel',
        save: 'Save & Apply Settings',
        customSettingsTitle: 'CUSTOM RISK & DISCIPLINE CONTROLS',
        customSettingsDesc: 'Take full control of daily profit locks, stop-loss limits, table exposure and robot thresholds.',
        targetDailyTitle: 'Daily Profit Target (+%)',
        targetDailySub: 'System locks in profits upon reaching target.',
        stopLossTitle: 'Daily Stop-Loss Limit (-%)',
        stopLossSub: 'Halts betting to protect your remaining capital.',
        maxConcurrentTitle: 'Max Simultaneous Open Matches',
        maxConcurrentSub: 'Max active concurrent matches allowed.',
        maxStakeTitle: 'Single Match Max Stake Cap',
        maxStakeSub: 'Upper unit cap even on highest confidence picks.',
        autoPilotMinConfTitle: 'Autonomous Robot Confidence Gate',
        autoPilotMinConfSub: 'Minimum AI confidence for automated execution.',
        matchesUnit: 'Matches',
        liveImpact: 'Live Rule Preview'
    },
    de: {
        title: 'Virtuelles Portfolio & Risiko-Einstellungen',
        subtitle: 'Legen Sie Ihr Startkapital fest und wählen Sie Ihr Risikoprofil',
        capLabel: 'VIRTUELLES STARTKAPITAL',
        profileLabel: 'STRATEGIE- & RISIKOPROFIL WÄHLEN',
        maxRisk: 'Max. Risiko',
        targetLabel: 'Ziel',
        disclaimer: 'Dieses Guthaben ist eine reine mathematische Simulation (Paper Trading). Kein echtes Geld erforderlich. Testen Sie Strategien risikofrei.',
        cancel: 'Abbrechen',
        save: 'Speichern & Anwenden',
        customSettingsTitle: 'INDIVIDUELLE RISIKO- & DISZIPLIN-REGELN',
        customSettingsDesc: 'Verwalten Sie Tagesgewinnziele, Stop-Loss-Grenzen, Tischrisiko und Roboter-Limits selbst.',
        targetDailyTitle: 'Tägliches Gewinnziel (+%)',
        targetDailySub: 'Bei Zielerreichung wird das Tagesplus gesichert.',
        stopLossTitle: 'Tägliches Stop-Loss-Limit (-%)',
        stopLossSub: 'Stoppt weitere Wetten zum Schutz des Kapitals.',
        maxConcurrentTitle: 'Maximal gleichzeitige offene Spiele',
        maxConcurrentSub: 'Höchstzahl zeitgleich offener Positionen.',
        maxStakeTitle: 'Maximaler Einzeleinsatz (Max Unit)',
        maxStakeSub: 'Höchster Einsatz selbst bei Elite-Empfehlungen.',
        autoPilotMinConfTitle: 'Autonomer Roboter Konfidenz-Filter',
        autoPilotMinConfSub: 'Minimale KI-Konfidenz für automatische Ausführung.',
        matchesUnit: 'Spiele',
        liveImpact: 'Live-Regel-Vorschau'
    }
};

export const CapitalConfigModal = ({
    isOpen,
    onClose,
    currentCapital,
    currentProfile,
    currentCurrency,
    currentCustomRules,
    onSave,
    lang = 'tr'
}) => {
    if (!isOpen) return null;

    const defaultCurrency = currentCurrency || (lang === 'de' ? '€' : lang === 'en' ? '$' : '₺');
    const [currency, setCurrencyState] = useState(defaultCurrency);
    const [amount, setAmount] = useState(() => {
        if (currentCapital) return currentCapital;
        return (defaultCurrency === '€' || defaultCurrency === '$' || defaultCurrency === '£') ? 500 : 2000;
    });
    const [selectedProfile, setSelectedProfile] = useState(currentProfile || 'BALANCED');

    const [customRules, setCustomRules] = useState(() => ({
        target_daily_pct: currentCustomRules?.target_daily_pct || 5,
        stop_loss_pct: currentCustomRules?.stop_loss_pct || 3,
        max_concurrent: currentCustomRules?.max_concurrent || 2,
        max_stake_units: currentCustomRules?.max_stake_units || 2.5,
        auto_pilot_min_conf: currentCustomRules?.auto_pilot_min_conf || 80
    }));

    const [isCustomExpanded, setIsCustomExpanded] = useState(selectedProfile === 'CUSTOM');

    const handleSelectProfile = (pId) => {
        setSelectedProfile(pId);
        if (pId === 'CUSTOM') {
            setIsCustomExpanded(true);
        } else if (pId === 'CONSERVATIVE') {
            setCustomRules(prev => ({ ...prev, target_daily_pct: 3, stop_loss_pct: 2, max_stake_units: 1.5, max_concurrent: 2 }));
        } else if (pId === 'BALANCED') {
            setCustomRules(prev => ({ ...prev, target_daily_pct: 5, stop_loss_pct: 3, max_stake_units: 2.5, max_concurrent: 2 }));
        } else if (pId === 'DYNAMIC') {
            setCustomRules(prev => ({ ...prev, target_daily_pct: 8, stop_loss_pct: 4, max_stake_units: 3.5, max_concurrent: 3 }));
        }
    };

    const handleSave = () => {
        onSave(amount, selectedProfile, currency, customRules);
        onClose();
    };

    const loc = TEXTS[lang] || TEXTS.tr;
    const isWesternCurrency = currency === '€' || currency === '$' || currency === '£';
    const presets = isWesternCurrency ? [50, 100, 250, 500, 1000, 2500] : [500, 1000, 2000, 5000, 10000, 25000];

    const unitSize = Math.max(1, Math.round(amount / 100));
    const activeTargetPct = selectedProfile === 'CUSTOM' ? customRules.target_daily_pct : (selectedProfile === 'CONSERVATIVE' ? 3 : (selectedProfile === 'DYNAMIC' ? 8 : 5));
    const activeStopLossPct = selectedProfile === 'CUSTOM' ? customRules.stop_loss_pct : (selectedProfile === 'CONSERVATIVE' ? 2 : (selectedProfile === 'DYNAMIC' ? 4 : 3));
    const activeMaxConcurrent = selectedProfile === 'CUSTOM' ? customRules.max_concurrent : (selectedProfile === 'DYNAMIC' ? 3 : 2);
    const activeMaxUnits = selectedProfile === 'CUSTOM' ? customRules.max_stake_units : (selectedProfile === 'CONSERVATIVE' ? 1.5 : (selectedProfile === 'DYNAMIC' ? 3.5 : 2.5));

    const targetCash = Math.round(amount * (activeTargetPct / 100));
    const stopLossCash = Math.round(amount * (activeStopLossPct / 100));

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #0b1329 0%, #030712 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '20px',
                maxWidth: '560px',
                width: '100%',
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: '1.75rem',
                color: '#f8fafc',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
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

                {/* Currency Selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '0.45rem' }}>
                        {lang === 'tr' ? 'PARA BİRİMİ SEÇİMİ' : (lang === 'de' ? 'WÄHRUNG WÄHLEN' : 'SELECT CURRENCY')}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[
                            { id: '₺', label: '₺ TRY' },
                            { id: '€', label: '€ EUR' },
                            { id: '$', label: '$ USD' },
                            { id: '£', label: '£ GBP' }
                        ].map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    setCurrencyState(c.id);
                                    if (c.id === '€' || c.id === '$' || c.id === '£') {
                                        if (amount > 5000) setAmount(1000);
                                        else if (amount >= 2000) setAmount(500);
                                    } else if (c.id === '₺' && amount < 500) {
                                        setAmount(2000);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    background: currency === c.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                    border: `1px solid ${currency === c.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                                    color: currency === c.id ? '#38bdf8' : '#cbd5e1',
                                    padding: '0.45rem 0.25rem',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Capital Input & Presets */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '0.45rem' }}>
                        {loc.capLabel} ({currency})
                    </label>
                    <input
                        type="number"
                        min={10}
                        max={500000}
                        step={isWesternCurrency ? 10 : 100}
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
                        {presets.map(val => (
                            <button
                                key={val}
                                type="button"
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
                                {val.toLocaleString()} {currency}
                            </button>
                        ))}
                    </div>

                    {/* Live Unit & Discipline Preview */}
                    <div style={{
                        marginTop: '0.75rem',
                        padding: '0.6rem 0.8rem',
                        background: 'rgba(56, 189, 248, 0.06)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        fontSize: '0.72rem'
                    }}>
                        <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                            🎯 1 Birim (1U): <strong style={{ color: '#fff' }}>{unitSize} {currency}</strong>
                        </span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>
                            Hedef (+%{activeTargetPct}): +{targetCash.toLocaleString()} {currency}
                        </span>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            Stop-Loss (-%{activeStopLossPct}): -{stopLossCash.toLocaleString()} {currency}
                        </span>
                        <span style={{ color: '#a855f7', fontWeight: 700 }}>
                            Masa: Max {activeMaxConcurrent} {loc.matchesUnit} ({activeMaxUnits}U)
                        </span>
                    </div>
                </div>

                {/* Risk Profile Selection */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8' }}>
                            {loc.profileLabel}
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#a855f7',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            {isCustomExpanded ? '▲ ' + (lang === 'tr' ? 'Detayları Gizle' : (lang === 'de' ? 'Details ausblenden' : 'Hide Details')) : '▼ ' + (lang === 'tr' ? 'Detaylı Risk Ayarla' : (lang === 'de' ? 'Risiko anpassen' : 'Customize Risk'))}
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {Object.values(RISK_PROFILES).map(p => {
                            const isSelected = selectedProfile === p.id;
                            const pTrans = (PROFILE_LOCALES[p.id] && PROFILE_LOCALES[p.id][lang]) || (PROFILE_LOCALES[p.id] && PROFILE_LOCALES[p.id].tr) || { label: p.label, desc: p.description };

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => handleSelectProfile(p.id)}
                                    style={{
                                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                        border: `1px solid ${isSelected ? p.color : 'rgba(255, 255, 255, 0.06)'}`,
                                        borderRadius: '12px',
                                        padding: '0.65rem 0.95rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>{p.icon}</span>
                                        <div>
                                            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f8fafc' }}>{pTrans.label}</div>
                                            <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '2px' }}>{pTrans.desc}</div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: p.color }}>
                                            {p.id === 'CUSTOM' ? `Max ${customRules.max_stake_units}U` : `${loc.maxRisk} %${(p.maxStakePct * 100).toFixed(1)}`}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                            {loc.targetLabel}: +%{p.id === 'CUSTOM' ? customRules.target_daily_pct : (p.targetDailyPct * 100).toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Custom Risk Controls Panel (Accordion) */}
                {isCustomExpanded && (
                    <div style={{
                        background: 'rgba(168, 85, 247, 0.05)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        borderRadius: '14px',
                        padding: '1rem',
                        marginBottom: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>🛠️</span>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#c084fc' }}>
                                    {loc.customSettingsTitle}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                                    {loc.customSettingsDesc}
                                </div>
                            </div>
                        </div>

                        {/* 1. Daily Profit Target */}
                        <div style={{ marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                                    {loc.targetDailyTitle}: <strong>+%{customRules.target_daily_pct} (+{Math.round(amount * (customRules.target_daily_pct / 100))} {currency})</strong>
                                </span>
                                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{loc.targetDailySub}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {[2, 3, 5, 8, 10, 15].map(pct => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfile('CUSTOM');
                                            setCustomRules(prev => ({ ...prev, target_daily_pct: pct }));
                                        }}
                                        style={{
                                            flex: 1,
                                            background: customRules.target_daily_pct === pct ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${customRules.target_daily_pct === pct ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                                            color: customRules.target_daily_pct === pct ? '#10b981' : '#cbd5e1',
                                            padding: '0.35rem 0.2rem',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        +%{pct}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Daily Stop-Loss */}
                        <div style={{ marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444' }}>
                                    {loc.stopLossTitle}: <strong>-%{customRules.stop_loss_pct} (-{Math.round(amount * (customRules.stop_loss_pct / 100))} {currency})</strong>
                                </span>
                                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{loc.stopLossSub}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {[1, 2, 3, 5, 8, 10].map(pct => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfile('CUSTOM');
                                            setCustomRules(prev => ({ ...prev, stop_loss_pct: pct }));
                                        }}
                                        style={{
                                            flex: 1,
                                            background: customRules.stop_loss_pct === pct ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${customRules.stop_loss_pct === pct ? '#ef4444' : 'rgba(255, 255, 255, 0.08)'}`,
                                            color: customRules.stop_loss_pct === pct ? '#ef4444' : '#cbd5e1',
                                            padding: '0.35rem 0.2rem',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        -%{pct}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Max Concurrent Matches */}
                        <div style={{ marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b' }}>
                                    {loc.maxConcurrentTitle}: <strong>{customRules.max_concurrent} {loc.matchesUnit}</strong>
                                </span>
                                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{loc.maxConcurrentSub}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[1, 2, 3, 4].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfile('CUSTOM');
                                            setCustomRules(prev => ({ ...prev, max_concurrent: num }));
                                        }}
                                        style={{
                                            flex: 1,
                                            background: customRules.max_concurrent === num ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${customRules.max_concurrent === num ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)'}`,
                                            color: customRules.max_concurrent === num ? '#f59e0b' : '#cbd5e1',
                                            padding: '0.35rem 0.2rem',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {num} {loc.matchesUnit}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Single Match Max Stake Cap */}
                        <div style={{ marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>
                                    {loc.maxStakeTitle}: <strong>{customRules.max_stake_units}U ({Math.round(customRules.max_stake_units * unitSize)} {currency})</strong>
                                </span>
                                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{loc.maxStakeSub}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[1.5, 2.0, 2.5, 3.0, 3.5].map(u => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfile('CUSTOM');
                                            setCustomRules(prev => ({ ...prev, max_stake_units: u }));
                                        }}
                                        style={{
                                            flex: 1,
                                            background: customRules.max_stake_units === u ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${customRules.max_stake_units === u ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                                            color: customRules.max_stake_units === u ? '#38bdf8' : '#cbd5e1',
                                            padding: '0.35rem 0.2rem',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {u}U
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 5. Auto-Pilot Minimum Confidence */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                                    {loc.autoPilotMinConfTitle}: <strong>%{customRules.auto_pilot_min_conf}+</strong>
                                </span>
                                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{loc.autoPilotMinConfSub}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[
                                    { val: 75, label: '%75+ (Geniş)' },
                                    { val: 80, label: '%80+ (Önerilen)' },
                                    { val: 85, label: '%85+ (Elit Kuant)' }
                                ].map(cf => (
                                    <button
                                        key={cf.val}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProfile('CUSTOM');
                                            setCustomRules(prev => ({ ...prev, auto_pilot_min_conf: cf.val }));
                                        }}
                                        style={{
                                            flex: 1,
                                            background: customRules.auto_pilot_min_conf === cf.val ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${customRules.auto_pilot_min_conf === cf.val ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                                            color: customRules.auto_pilot_min_conf === cf.val ? '#10b981' : '#cbd5e1',
                                            padding: '0.35rem 0.2rem',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {cf.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Educational Disclaimer */}
                <div style={{
                    background: 'rgba(0,0,0,0.35)',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    lineHeight: '1.4',
                    marginBottom: '1.25rem'
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
