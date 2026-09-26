import React, { useState } from 'react';
import { RISK_PROFILES, BADGE_DEFINITIONS } from '../../logic/bankrollManager';
import { PortfolioGuideCard } from './PortfolioGuideCard';

const BADGE_TRANSLATIONS = {
    WELCOME_TRADER: {
        tr: { title: 'Analitik Başlangıç', desc: 'Sanal portföy laboratuvarını başlattı ve ilk stratejisini oluşturdu.' },
        en: { title: 'Analytic Starter', desc: 'Launched virtual portfolio lab and established initial strategy.' },
        de: { title: 'Analytischer Start', desc: 'Virtuelles Portfolio-Labor gestartet und erste Strategie erstellt.' }
    },
    IRON_WILL: {
        tr: { title: 'Çelik İrade', desc: 'Stop-loss veya temkinli mod sınırına saygı gösterip sermayesini korudu.' },
        en: { title: 'Iron Will', desc: 'Respected stop-loss or caution limits to safeguard overall capital.' },
        de: { title: 'Eiserner Wille', desc: 'Stop-Loss- oder Vorsichtsgrenzen beachtet und Kapital geschützt.' }
    },
    SNIPER: {
        tr: { title: 'Keskin Nişancı', desc: 'Art arda 4 veya daha fazla kazanan simülasyon işlemi gerçekleştirdi.' },
        en: { title: 'Sniper Strike', desc: 'Executed 4 or more consecutive winning simulation trades.' },
        de: { title: 'Scharfschütze', desc: '4 oder mehr aufeinanderfolgende Gewinnwetten in der Simulation erzielt.' }
    },
    COMPOUND_MASTER: {
        tr: { title: 'Bileşik Büyücü', desc: 'Portföyünü pozitif getiri eğrisinde istikrarlı şekilde büyüttü.' },
        en: { title: 'Compound Master', desc: 'Consistently compounded portfolio on a positive trajectory.' },
        de: { title: 'Zinseszins-Meister', desc: 'Portfolio kontinuierlich auf einer positiven Wachstumskurve gesteigert.' }
    },
    DISCIPLINE_LOCK: {
        tr: { title: 'Hedef Kilitleyici', desc: 'Günlük kâr hedefine ulaşıp kurala uyarak günü yeşil kapattı.' },
        en: { title: 'Discipline Lock', desc: 'Hit daily profit target and locked the day green with strict discipline.' },
        de: { title: 'Ziel-Sicherung', desc: 'Tagesziel erreicht und den Tag mit strikter Disziplin im Plus beendet.' }
    },
    QUANT_SCHOLAR: {
        tr: { title: 'Kuant Bilgini', desc: '10 veya daha fazla simülasyon işlemini detaylı inceledi.' },
        en: { title: 'Quant Scholar', desc: 'Analyzed and executed 10 or more simulation trades in depth.' },
        de: { title: 'Quant-Gelehrter', desc: '10 oder mehr Simulationswetten detailliert analysiert und abgeschlossen.' }
    },
    WHALE: {
        tr: { title: 'Portföy Mimarı', desc: 'Sanal sermayesini başlangıç bakiyesinden %25 veya daha fazla büyüttü.' },
        en: { title: 'Portfolio Architect', desc: 'Expanded virtual capital by +25% or more above starting balance.' },
        de: { title: 'Portfolio-Architekt', desc: 'Virtuelles Startkapital um +25% oder mehr gesteigert.' }
    }
};

const RISK_PROFILE_TRANSLATIONS = {
    CONSERVATIVE: {
        tr: { label: 'Muhafazakar Fon', desc: 'Sermaye koruma odaklı, düşük dalgalanmalı kurumsal fon disiplini.' },
        en: { label: 'Conservative Fund', desc: 'Preservation-focused, low-volatility institutional discipline.' },
        de: { label: 'Konservativer Fonds', desc: 'Fokus auf Kapitalschutz und minimale Schwankungen.' }
    },
    BALANCED: {
        tr: { label: 'Dengeli Radar', desc: 'Değerli oran ve standart fraksiyonel Kelly dengesi.' },
        en: { label: 'Balanced Radar', desc: 'Value odds and balanced fractional Kelly stake modeling.' },
        de: { label: 'Ausgewogener Radar', desc: 'Ausgewogene Balance aus Value-Quoten und fraktionalem Kelly.' }
    },
    DYNAMIC: {
        tr: { label: 'Dinamik Fırsat', desc: 'Yüksek xG ve momentum fırsatlarına odaklı dinamik simülasyon.' },
        en: { label: 'Dynamic Opportunity', desc: 'Momentum and high-xG offensive trading simulation.' },
        de: { label: 'Dynamische Chance', desc: 'Fokus auf hohes xG-Momentum und offensive Chancen.' }
    }
};

const BANKROLL_IQ_LABELS = {
    'Elit Fon Mimarı': { tr: 'Elit Fon Mimarı', en: 'Elite Fund Architect', de: 'Elite-Fonds-Architekt' },
    'Disiplinli Kuant Analist': { tr: 'Disiplinli Kuant Analist', en: 'Disciplined Quant Analyst', de: 'Disziplinierter Quant-Analyst' },
    'Dengeli Analist': { tr: 'Dengeli Analist', en: 'Balanced Analyst', de: 'Ausgewogener Analyst' },
    'Risk Eğitimi Önerilir': { tr: 'Risk Eğitimi Önerilir', en: 'Risk Training Recommended', de: 'Risikotraining empfohlen' },
    'Gelişen Stratejist': { tr: 'Gelişen Stratejist', en: 'Emerging Strategist', de: 'Aufstrebender Stratege' }
};

export const PortfolioCockpit = ({
    bankrollState,
    dailyProgress,
    bankrollIQ,
    onOpenCapitalModal,
    onSelectProfile,
    onResetBankroll,
    onSyncRemoteResults,
    isSyncingResults,
    settlementMessage,
    onOpenShareModal,
    lang = 'tr',
    onSelectTab
}) => {
    const startBal = bankrollState.starting_balance || 2000;
    const curBal = bankrollState.current_balance || 2000;
    const realizedProfit = curBal - startBal;
    const roi = startBal > 0 ? (realizedProfit / startBal) * 100 : 0;

    const settled = (bankrollState.ledger || []).filter(l => l.is_settled);
    const wins = settled.filter(l => l.status === 'WIN' || l.outcome === 'WON').length;
    const losses = settled.filter(l => l.status === 'LOSS' || l.outcome === 'LOST').length;
    const totalFinished = wins + losses;
    const winRate = totalFinished > 0 ? (wins / totalFinished) * 100 : 0;

    const openBets = (bankrollState.ledger || []).filter(l => !l.is_settled && (l.status === 'OPEN' || l.type === 'BET_OPEN'));
    const activeExposure = openBets.reduce((acc, b) => acc + Number(b.stake || b.stake_amount || 0), 0);

    const profileKey = bankrollState.risk_profile || 'BALANCED';
    const activeProfile = RISK_PROFILES[profileKey] || RISK_PROFILES.BALANCED;
    const profileTrans = (RISK_PROFILE_TRANSLATIONS[profileKey] && RISK_PROFILE_TRANSLATIONS[profileKey][lang]) 
        || (RISK_PROFILE_TRANSLATIONS[profileKey] && RISK_PROFILE_TRANSLATIONS[profileKey].tr) 
        || { label: activeProfile.label, desc: activeProfile.description };

    // SVG Growth Chart points
    const rawPoints = [startBal];
    let running = startBal;
    (bankrollState.ledger || []).forEach(entry => {
        if (entry.is_settled && entry.profit !== undefined) {
            running += Number(entry.profit);
            rawPoints.push(running);
        }
    });
    if (rawPoints.length === 1) rawPoints.push(curBal);

    const min = Math.min(...rawPoints);
    const max = Math.max(...rawPoints);
    const range = (max - min) === 0 ? 1 : (max - min);
    const svgPoints = rawPoints.map((p, i) => {
        const x = rawPoints.length > 1 ? (i / (rawPoints.length - 1)) * 100 : 50;
        const y = 100 - ((p - min) / range) * 85 - 8;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const unlockedBadgeIds = new Set(bankrollState.badges || ['WELCOME_TRADER']);

    const iqLabel = (BANKROLL_IQ_LABELS[bankrollIQ.label] && BANKROLL_IQ_LABELS[bankrollIQ.label][lang]) || bankrollIQ.label;

    return (
        <div className="portfolio-cockpit-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* 0. Educational User Guide (Collapsible 3-Language Onboarding Banner) */}
            <PortfolioGuideCard
                lang={lang}
                onOpenCapitalModal={onOpenCapitalModal}
                onSelectTab={onSelectTab}
            />

            {/* 1. Hukuki & Simülasyon Bilgilendirme Rozeti (Compliance Ribbon) */}
            <div style={{
                background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '14px',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                    }}>
                        ⚖️
                    </div>
                    <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span>
                                {lang === 'tr' ? 'Algoritmik Strateji & Portföy Laboratuvarı (Paper Trading)' : (lang === 'de' ? 'Algorithmisches Strategie- & Portfolio-Labor (Paper Trading)' : 'Algorithmic Strategy & Portfolio Lab (Paper Trading)')}
                            </span>
                            <span style={{
                                fontSize: '0.62rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                fontWeight: 800
                            }}>
                                {lang === 'tr' ? '100% YASAL SİMÜLASYON' : (lang === 'de' ? '100% LEGALE SIMULATION' : '100% LEGAL SIMULATION')}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                            {lang === 'tr' 
                                ? '7258 sayılı kanuna tam uyumlu, gerçek para kabul edilmeyen karar destek ve matematiksel sermaye koruma ortamı.' 
                                : (lang === 'de' 
                                    ? 'Reines Simulations-Labor für Risikomodellierung und Disziplin. Keine Echtgeldeinsätze.' 
                                    : 'Strictly educational paper trading lab for risk modeling and discipline. No real money betting processed.')}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={onOpenCapitalModal}
                        style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#38bdf8',
                            padding: '0.45rem 0.9rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>⚙️</span>
                        <span>{lang === 'tr' ? 'Sermaye & Modu Ayarla' : (lang === 'de' ? 'Kapital & Modus einstellen' : 'Configure Capital')}</span>
                    </button>

                    <button
                        onClick={onOpenShareModal}
                        style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(56, 189, 248, 0.2))',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981',
                            padding: '0.45rem 0.9rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>📸</span>
                        <span>{lang === 'tr' ? 'Başarı Kartı Çıkar' : (lang === 'de' ? 'Erfolgs-Karte erstellen' : 'Export Brag Card')}</span>
                    </button>
                </div>
            </div>

            {/* 2. Günlük Hedef Kilit & Stop-Loss Canlı Çubuğu */}
            <div style={{
                background: dailyProgress.isTargetReached 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(15, 23, 42, 0.9))' 
                    : (dailyProgress.isStopLossReached 
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(15, 23, 42, 0.9))' 
                        : 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))'),
                border: `1px solid ${dailyProgress.isTargetReached ? 'rgba(16, 185, 129, 0.5)' : (dailyProgress.isStopLossReached ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.08)')}`,
                borderRadius: '16px',
                padding: '1.2rem 1.5rem',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>
                            {dailyProgress.isTargetReached ? '🔒' : (dailyProgress.isStopLossReached ? '🛑' : '🎯')}
                        </span>
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.2px' }}>
                                {dailyProgress.isTargetReached 
                                    ? (lang === 'tr' ? 'GÜNLÜK HEDEF KİLİTLENDİ (KASA KORUMA AKTİF)' : (lang === 'de' ? 'TAGESZIEL GESICHERT (KAPITALSCHUTZ AKTIV)' : 'DAILY TARGET LOCKED (CAPITAL SECURED)'))
                                    : (dailyProgress.isStopLossReached 
                                        ? (lang === 'tr' ? 'STOP-LOSS DİSİPLİN MOLASI (İŞLEM DURDURULDU)' : (lang === 'de' ? 'STOP-LOSS DISZIPLIN-PAUSE (HANDEL GESTOPPT)' : 'STOP-LOSS DISCIPLINE HALT'))
                                        : (lang === 'tr' 
                                            ? `GÜNLÜK HEDEF & SERMAYE KORUMA KOKPİTİ (%${dailyProgress.targetPct} Hedef)` 
                                            : (lang === 'de' 
                                                ? `TAGESZIEL & KAPITALSCHUTZ-COCKPIT (%${dailyProgress.targetPct} Ziel)` 
                                                : `DAILY CAPITAL DISCIPLINE COCKPIT (%${dailyProgress.targetPct} Target)`)))}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                {lang === 'tr'
                                    ? `Aktif Profil: ${activeProfile.icon} ${profileTrans.label} • Hedef: +%${dailyProgress.targetPct} • Stop-Loss: -%${dailyProgress.stopLossPct}`
                                    : (lang === 'de' 
                                        ? `Aktives Profil: ${activeProfile.icon} ${profileTrans.label} • Ziel: +%${dailyProgress.targetPct} • Stop-Loss: -%${dailyProgress.stopLossPct}`
                                        : `Active Profile: ${activeProfile.icon} ${profileTrans.label} • Target: +%${dailyProgress.targetPct} • Stop-Loss: -%${dailyProgress.stopLossPct}`)}
                            </div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            color: dailyProgress.dailyPL >= 0 ? '#10b981' : '#ef4444'
                        }}>
                            {dailyProgress.dailyPL >= 0 ? '+' : ''}{dailyProgress.dailyPL.toFixed(2)} ₺ ({dailyProgress.dailyPLPct >= 0 ? '+' : ''}{dailyProgress.dailyPLPct}%)
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            {lang === 'tr' ? 'Bugünkü Net Simülasyon Hareketi' : (lang === 'de' ? 'Heutige Netto-Entwicklung' : 'Today Net Simulation P/L')}
                        </div>
                    </div>
                </div>

                {/* Progress Track */}
                <div style={{ position: 'relative', width: '100%', height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, dailyProgress.progressPct))}%`,
                        background: dailyProgress.isTargetReached 
                            ? 'linear-gradient(90deg, #10b981, #34d399)' 
                            : 'linear-gradient(90deg, #38bdf8, #10b981)',
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)'
                    }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                    <span>0%</span>
                    <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                        {dailyProgress.isTargetReached 
                            ? (lang === 'tr' ? '🏆 100% Tamamlandı' : (lang === 'de' ? '🏆 100% Erreicht' : '🏆 100% Completed')) 
                            : (lang === 'tr' 
                                ? `%${dailyProgress.progressPct} Hedefe Yaklaşıldı` 
                                : (lang === 'de' ? `%${dailyProgress.progressPct} Ziel erreicht` : `%${dailyProgress.progressPct} Target Progress`))}
                    </span>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>
                        +{dailyProgress.targetPct}% {lang === 'tr' ? 'Kilit' : (lang === 'de' ? 'Sperre' : 'Lock')}
                    </span>
                </div>
            </div>

            {/* 3. Dört Temel Metrik Kartı + Bankroll IQ */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1rem'
            }}>
                {/* 1. Toplam Kâr */}
                <div className="portfolio-card glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800 }}>
                        {lang === 'tr' ? 'TOPLAM KÂR / ZARAR (P/L)' : (lang === 'de' ? 'GESAMT GEWINN/VERLUST (G/V)' : 'NET REALIZED P/L')}
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: realizedProfit >= 0 ? '#10b981' : '#ef4444', margin: '0.4rem 0' }}>
                        {realizedProfit >= 0 ? '+' : ''}{realizedProfit.toFixed(2)} ₺
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: realizedProfit >= 0 ? '#10b981' : '#ef4444' }}>
                        {realizedProfit >= 0 ? '↑' : '↓'} {roi.toFixed(1)}% ROI ({settled.length} {lang === 'tr' ? 'İşlem' : (lang === 'de' ? 'Wetten' : 'Bets')})
                    </div>
                </div>

                {/* 2. Başarı Oranı */}
                <div className="portfolio-card glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800 }}>
                        {lang === 'tr' ? 'İSABET & BAŞARI ORANI' : (lang === 'de' ? 'TREFFERQUOTE & ERFOLG' : 'WIN RATE')}
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#38bdf8', margin: '0.4rem 0' }}>
                        %{winRate.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>
                        <span style={{ color: '#10b981' }}>{wins} {lang === 'tr' ? 'Kazan' : (lang === 'de' ? 'Siege' : 'Wins')}</span> • <span style={{ color: '#ef4444' }}>{losses} {lang === 'tr' ? 'Kaybet' : (lang === 'de' ? 'Niederlagen' : 'Losses')}</span>
                    </div>
                </div>

                {/* 3. Güncel Bakiye & Sermaye */}
                <div className="portfolio-card glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800 }}>
                        {lang === 'tr' ? 'GÜNCEL SANAL BAKİYE' : (lang === 'de' ? 'AKTUELLES VIRTUELLES KAPITAL' : 'VIRTUAL CAPITAL')}
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f8fafc', margin: '0.4rem 0' }}>
                        {curBal.toFixed(2)} ₺
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {lang === 'tr' ? 'Başlangıç' : (lang === 'de' ? 'Startkapital' : 'Initial')}: {startBal.toLocaleString()} ₺ {activeExposure > 0 ? `(${activeExposure.toFixed(0)} ₺ ${lang === 'tr' ? 'Riskte' : (lang === 'de' ? 'im Risiko' : 'at Risk')})` : ''}
                    </div>
                </div>

                {/* 4. Bankroll IQ (Disiplin Skoru) */}
                <div className="portfolio-card glass-panel" style={{
                    padding: '1.2rem',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(15, 23, 42, 0.7))',
                    border: `1px solid ${bankrollIQ.color}55`
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800 }}>
                            {lang === 'tr' ? 'BANKROLL IQ (DİSİPLİN)' : (lang === 'de' ? 'BANKROLL IQ (DISZIPLIN)' : 'BANKROLL IQ (DISCIPLINE)')}
                        </div>
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: `${bankrollIQ.color}25`,
                            color: bankrollIQ.color
                        }}>
                            {bankrollIQ.grade}
                        </span>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: bankrollIQ.color, margin: '0.4rem 0' }}>
                        {bankrollIQ.score} <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>/ 100</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: bankrollIQ.color, fontWeight: 800 }}>
                        {iqLabel}
                    </div>
                </div>
            </div>

            {/* 4. Başarı Rozetleri (Badges Gallery) */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                padding: '1.1rem 1.4rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>🏅</span>
                        <span>{lang === 'tr' ? 'Disiplin & Başarı Rozetleri' : (lang === 'de' ? 'Disziplin- & Erfolgs-Abzeichen' : 'Discipline & Achievement Badges')}</span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>
                            ({unlockedBadgeIds.size} / {BADGE_DEFINITIONS.length} {lang === 'tr' ? 'Açıldı' : (lang === 'de' ? 'Freigeschaltet' : 'Unlocked')})
                        </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>
                        {lang === 'tr' ? 'Disiplinli kaldıkça Bankroll IQ yükselir' : (lang === 'de' ? 'Diszipliniertes Handeln steigert Ihren Bankroll IQ' : 'Consistent discipline boosts your Bankroll IQ')}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.7rem' }}>
                    {BADGE_DEFINITIONS.map(b => {
                        const isUnlocked = unlockedBadgeIds.has(b.id);
                        const trans = (BADGE_TRANSLATIONS[b.id] && BADGE_TRANSLATIONS[b.id][lang]) || (BADGE_TRANSLATIONS[b.id] && BADGE_TRANSLATIONS[b.id].tr) || { title: b.title, desc: b.description };

                        return (
                            <div
                                key={b.id}
                                title={trans.desc}
                                style={{
                                    background: isUnlocked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                    border: `1px solid ${isUnlocked ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.04)'}`,
                                    borderRadius: '10px',
                                    padding: '0.7rem',
                                    textAlign: 'center',
                                    opacity: isUnlocked ? 1 : 0.45,
                                    transition: 'all 0.2s',
                                    cursor: 'help'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{b.icon}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: isUnlocked ? '#f8fafc' : '#64748b' }}>
                                    {trans.title}
                                </div>
                                <div style={{ fontSize: '0.62rem', color: isUnlocked ? '#38bdf8' : '#475569', marginTop: '2px' }}>
                                    {isUnlocked ? (lang === 'tr' ? 'Kazanıldı' : (lang === 'de' ? 'Erreicht' : 'Earned')) : (lang === 'tr' ? 'Kilitli' : (lang === 'de' ? 'Gesperrt' : 'Locked'))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 5. İnteraktif Büyüme Grafiği */}
            <div className="chart-panel glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📈</span>
                        <span>{lang === 'tr' ? 'Portföy Gelişim Eğrisi' : (lang === 'de' ? 'Portfolio-Wachstumskurve' : 'Portfolio Growth Curve')}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {lang === 'tr' ? 'Başlangıçtan bugüne sermaye serüveni' : (lang === 'de' ? 'Historische Entwicklung Ihres Kapitals' : 'Historical capital growth curve')}
                    </div>
                </div>

                <div className="svg-chart-container" style={{ width: '100%', height: '140px' }}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>
                        {rawPoints.length > 1 && (
                            <>
                                <path
                                    d={`M 0,100 L ${svgPoints} L 100,100 Z`}
                                    fill="url(#growthGradient)"
                                />
                                <polyline
                                    fill="none"
                                    stroke="#38bdf8"
                                    strokeWidth="1.2"
                                    points={svgPoints}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </>
                        )}
                        {rawPoints.map((p, i) => {
                            const x = rawPoints.length > 1 ? (i / (rawPoints.length - 1)) * 100 : 50;
                            const y = 100 - ((p - min) / range) * 85 - 8;
                            return (
                                <circle key={i} cx={x} cy={y} r="1.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="0.5" />
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* 6. Kontrol Araç Çubuğu (Toolbar) */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.8rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '0.85rem 1.2rem',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={onSyncRemoteResults}
                        disabled={isSyncingResults}
                        style={{
                            background: isSyncingResults ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.16)',
                            border: '1px solid rgba(56, 189, 248, 0.45)',
                            color: '#38bdf8',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: isSyncingResults ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: isSyncingResults ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
                        <span>
                            {isSyncingResults 
                                ? (lang === 'tr' ? 'Sonuçlar Sorgulanıyor...' : (lang === 'de' ? 'Ergebnisse werden geprüft...' : 'Scanning Results...')) 
                                : (lang === 'tr' ? 'Biten Maçları Otomatik Sonuçlandır' : (lang === 'de' ? 'Beendete Spiele automatisch abrechnen' : 'Auto-Settle Finished Matches'))}
                        </span>
                    </button>

                    <button
                        onClick={onResetBankroll}
                        style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#ef4444',
                            padding: '0.5rem 0.95rem',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>🗑️</span>
                        <span>{lang === 'tr' ? 'Portföyü Sıfırla' : (lang === 'de' ? 'Portfolio zurücksetzen' : 'Reset Portfolio')}</span>
                    </button>
                </div>

                {settlementMessage && (
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.35rem 0.8rem',
                        borderRadius: '6px',
                        background: settlementMessage.includes('❌') || settlementMessage.includes('⚠️') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: settlementMessage.includes('❌') || settlementMessage.includes('⚠️') ? '#ef4444' : '#10b981',
                        border: `1px solid ${settlementMessage.includes('❌') || settlementMessage.includes('⚠️') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                    }}>
                        {settlementMessage}
                    </div>
                )}
            </div>

        </div>
    );
};
