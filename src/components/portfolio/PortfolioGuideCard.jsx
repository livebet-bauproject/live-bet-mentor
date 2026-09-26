import React, { useState, useEffect } from 'react';

export const PortfolioGuideCard = ({ lang = 'tr', onOpenCapitalModal, onSelectTab }) => {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem('lbm_portfolio_guide_collapsed') === 'true';
        }
        return false;
    });

    const [activeStep, setActiveStep] = useState(0);

    const toggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('lbm_portfolio_guide_collapsed', String(next));
            }
            return next;
        });
    };

    const t = {
        tr: {
            title: 'Kasa & Portföy Disiplini Kullanım Rehberi',
            subtitle: 'Algoritmik kasanızı profesyonel fon standartlarında nasıl büyüteceğinizi ve koruyacağınızı öğrenin',
            toggleShow: 'Rehberi Göster',
            toggleHide: 'Rehberi Gizle',
            pipelineTitle: '4 ADIMDA PORTFÖY DÖNGÜSÜ',
            steps: [
                {
                    icon: '💰',
                    tag: '1. ADIM',
                    title: 'Sanal Kasa & Risk Profilini Belirle',
                    summary: 'Başlangıç sermayenizi girin ve yatırım iştahınıza uygun fon modunu seçin.',
                    details: [
                        '🛡️ **Muhafazakar Fon:** İşlem başı max %1 risk, günlük +%3 kâr hedefi, -%2 stop-loss. En yüksek sermaye koruması.',
                        '⚖️ **Dengeli Radar (Önerilen):** İşlem başı max %2.5 risk, günlük +%5 kâr hedefi, -%3 stop-loss. İdeal büyüme ve güvenlik dengesi.',
                        '⚡ **Dinamik Fırsat:** İşlem başı max %3.5 risk, günlük +%8 kâr hedefi, -%4 stop-loss. Yüksek xG momentum odaklı.'
                    ],
                    actionText: '⚙️ Sermaye & Risk Profilini Ayarla',
                    actionType: 'capital'
                },
                {
                    icon: '📐',
                    tag: '2. ADIM',
                    title: 'Kelly Kriteri & Akıllı Pozisyon Boyutlandırma',
                    summary: 'Rastgele veya duygusal bahis miktarı basmaya son verin.',
                    details: [
                        '🎯 **Fraksiyonel Kelly:** Sistem, modelin olasılığı ve xG üstünlüğüne göre kasanızın tam gereken yüzdesini hesaplar.',
                        '🛡️ **Bakiye Koruma:** Kasanız büyüdükçe işlem tutarları güvenle artar; düşüş serilerinde ise risk otomatik küçülür.',
                        '⚡ **Tek Tıkla İşlem:** Canlı Radar terminalindeki sinyalleri onayladığınız anda işlem simülasyon defterine işlenir.'
                    ],
                    actionText: '📜 Simülasyon Defterine Git',
                    actionType: 'journal'
                },
                {
                    icon: '🔒',
                    tag: '3. ADIM',
                    title: '+%5 Günlük Hedef Kilit & Stop-Loss',
                    summary: 'Profesyonelleri kumarcılardan ayıran en kritik sermaye kuralı.',
                    details: [
                        '🔒 **Günlük Hedef Kilidi:** Günlük hedefinize (+%3 / +%5 / +%8) ulaştığınızda sistem günü yeşil kilitler ve over-betting yapmanızı önler.',
                        '🛑 **Stop-Loss Disiplin Molası:** Şanssız serilerde stop-loss sınırına (%2 - %4) ulaşıldığında sistem dinlenme molası verir.',
                        '🧠 **Bankroll IQ:** Disiplin kurallarına uydukça puanınız ve ligdeki sıralamanız yükselir.'
                    ],
                    actionText: '🏆 Analist Ligini Gör',
                    actionType: 'leaderboard'
                },
                {
                    icon: '🔮',
                    tag: '4. ADIM',
                    title: 'Bileşik Büyüme & Gelecek Projeksiyonu',
                    summary: 'Hırsla değil; küçük, istikrarlı adımların üstel katlanma gücüyle büyüyün.',
                    details: [
                        '📈 **Zinseszins (Bileşik) Etkisi:** Günde sadece %2 büyüme, 30 günde sermayenizi neredeyse ikiye katlar (%81 getiri).',
                        '🚀 **90 Günlük Projeksiyon:** 2.000 ₺ gibi küçük bir kasa disiplinle yönetildiğinde aylar içinde üstel fona dönüşür.',
                        '📊 **Gelecek Simülatörü:** Kendi kasanızı ve hedef yüzdenizi girerek 15, 30, 60 ve 90 günlük potansiyelinizi test edin.'
                    ],
                    actionText: '🔮 Gelecek Simülatörünü Aç',
                    actionType: 'simulator'
                }
            ],
            flow: [
                { num: '1', label: 'Radar Sinyali' },
                { num: '2', label: 'Kelly Boyutu' },
                { num: '3', label: 'FT Otomatik Sonuç' },
                { num: '4', label: '+%5 Hedef Kilidi' }
            ]
        },
        en: {
            title: 'Portfolio & Bankroll Discipline User Guide',
            subtitle: 'Learn how to manage, protect, and exponentially compound your algorithmic capital like institutional fund managers',
            toggleShow: 'Show Guide',
            toggleHide: 'Hide Guide',
            pipelineTitle: '4-STEP PORTFOLIO CYCLE',
            steps: [
                {
                    icon: '💰',
                    tag: 'STEP 1',
                    title: 'Set Virtual Capital & Risk Profile',
                    summary: 'Define your starting bankroll and choose a profile matching your risk appetite.',
                    details: [
                        '🛡️ **Conservative Fund:** Max 1% stake per bet, +3% daily target, -2% stop-loss. Maximum capital safety.',
                        '⚖️ **Balanced Radar (Recommended):** Max 2.5% stake per bet, +5% daily target, -3% stop-loss. Optimal growth & safety balance.',
                        '⚡ **Dynamic Opportunity:** Max 3.5% stake per bet, +8% daily target, -4% stop-loss. Focused on high-xG momentum opportunities.'
                    ],
                    actionText: '⚙️ Configure Capital & Risk Profile',
                    actionType: 'capital'
                },
                {
                    icon: '📐',
                    tag: 'STEP 2',
                    title: 'Kelly Criterion & Smart Position Sizing',
                    summary: 'Never place random or emotional bet amounts again.',
                    details: [
                        '🎯 **Fractional Kelly:** The algorithm calculates the precise stake percentage based on statistical win probability and xG edge.',
                        '🛡️ **Capital Preservation:** As bankroll grows, stakes scale safely; during drawdowns, risk exposure automatically contracts.',
                        '⚡ **One-Click Execution:** Approving Live Radar signals immediately registers the trade in your simulation ledger.'
                    ],
                    actionText: '📜 Open Simulation Journal',
                    actionType: 'journal'
                },
                {
                    icon: '🔒',
                    tag: 'STEP 3',
                    title: '+5% Daily Target Lock & Stop-Loss Discipline',
                    summary: 'The golden rule separating quantitative traders from emotional gamblers.',
                    details: [
                        '🔒 **Daily Profit Lock:** Once your daily target (+3% / +5% / +8%) is reached, the day is locked green to eliminate greed and over-betting.',
                        '🛑 **Stop-Loss Cooling Halt:** If drawdown reaches the threshold (2% - 4%), the engine halts trades to enforce emotional reset.',
                        '🧠 **Bankroll IQ:** Sticking to discipline rules elevates your Bankroll IQ score and leaderboard rank.'
                    ],
                    actionText: '🏆 View Analyst League',
                    actionType: 'leaderboard'
                },
                {
                    icon: '🔮',
                    tag: 'STEP 4',
                    title: 'Compound Growth & Future Projection',
                    summary: 'Grow capital not through high-risk gambles, but through the exponential mathematics of compounding.',
                    details: [
                        '📈 **The Compounding Effect:** Locking in just 2% gain daily compounds your capital by over +81% in 30 days.',
                        '🚀 **90-Day Exponential Horizon:** A 2,000 ₺ bankroll systematically compounds into a substantial fund over months.',
                        '📊 **Future Simulator:** Experiment with starting balance and daily targets across 15, 30, 60, and 90-day time horizons.'
                    ],
                    actionText: '🔮 Launch Future Simulator',
                    actionType: 'simulator'
                }
            ],
            flow: [
                { num: '1', label: 'Radar Signal' },
                { num: '2', label: 'Kelly Size' },
                { num: '3', label: 'Auto-Settle at FT' },
                { num: '4', label: '+5% Profit Lock' }
            ]
        },
        de: {
            title: 'Portfolio & Kassa-Disziplin Benutzer-Leitfaden',
            subtitle: 'Erfahren Sie, wie Sie Ihr algorithmisches Kapital wie professionelle Fondsmanager systematisch absichern und vermehren',
            toggleShow: 'Leitfaden anzeigen',
            toggleHide: 'Leitfaden ausblenden',
            pipelineTitle: '4-SCHRITTE-PORTFOLIO-KREISLAUF',
            steps: [
                {
                    icon: '💰',
                    tag: 'SCHRITT 1',
                    title: 'Virtuelles Kapital & Risikoprofil festlegen',
                    summary: 'Geben Sie Ihr Startkapital ein und wählen Sie ein Profil passend zu Ihrer Risikotoleranz.',
                    details: [
                        '🛡️ **Konservativer Fonds:** Max. 1% Einsatz pro Wette, +3% Tagesziel, -2% Stop-Loss. Höchster Kapitalschutz.',
                        '⚖️ **Ausgewogener Radar (Empfohlen):** Max. 2,5% Einsatz, +5% Tagesziel, -3% Stop-Loss. Ideale Balance aus Wachstum und Sicherheit.',
                        '⚡ **Dynamische Chance:** Max. 3,5% Einsatz, +8% Tagesziel, -4% Stop-Loss. Fokus auf hohe xG-Momentum-Chancen.'
                    ],
                    actionText: '⚙️ Kapital & Risikoprofil konfigurieren',
                    actionType: 'capital'
                },
                {
                    icon: '📐',
                    tag: 'SCHRITT 2',
                    title: 'Kelly-Kriterium & Intelligente Einsatzgröße',
                    summary: 'Schluss mit willkürlichen oder emotionalen Wetteinsätzen.',
                    details: [
                        '🎯 **Fraktionales Kelly:** Das System berechnet den exakten Einsatz-Prozentsatz basierend auf mathematischem Vorteil und xG-Edge.',
                        '🛡️ **Kapitalerhalt:** Bei wachsender Kassa steigen Einsätze sicher; in Verlustphasen schrumpft das Risiko automatisch.',
                        '⚡ **1-Klick-Übernahme:** Live-Radar-Signale werden per Bestätigung sofort im Simulations-Journal verbucht.'
                    ],
                    actionText: '📜 Zum Simulations-Journal',
                    actionType: 'journal'
                },
                {
                    icon: '🔒',
                    tag: 'SCHRITT 3',
                    title: '+5% Tagesziel-Sperre & Stop-Loss-Disziplin',
                    summary: 'Die goldene Regel, die professionelle Kuant-Analysten von Glücksspielern unterscheidet.',
                    details: [
                        '🔒 **Tagesziel-Sperre:** Nach Erreichen des Tagesziels (+3% / +5% / +8%) wird das Portfolio grün gesperrt, um Gier zu verhindern.',
                        '🛑 **Stop-Loss-Disziplinpause:** Bei Erreichen des Verlustlimits (2% - 4%) pausiert das System, um das Gesamtkapital zu schützen.',
                        '🧠 **Bankroll IQ:** Diszipliniertes Handeln steigert Ihren Bankroll IQ Score und Ihren Liga-Rang.'
                    ],
                    actionText: '🏆 Analysten-Liga ansehen',
                    actionType: 'leaderboard'
                },
                {
                    icon: '🔮',
                    tag: 'SCHRITT 4',
                    title: 'Zinseszins-Wachstum & Zukunftsprojektion',
                    summary: 'Kapital wächst nicht durch blindes Risiko, sondern durch die exponentielle Mathematik des Zinseszinses.',
                    details: [
                        '📈 **Zinseszinseffekt:** Nur 2% Tagesgewinn führt in 30 Tagen zu einer Steigerung von über +81% auf das Gesamtkapital.',
                        '🚀 **90-Tage-Horizont:** Ein Startkapital von 2.000 ₺/€ wächst mit Geduld zu einem beachtlichen Fonds heran.',
                        '📊 **Zukunft-Simulator:** Testen Sie verschiedene Startbeträge und Tagesziele für 15, 30, 60 und 90 Tage.'
                    ],
                    actionText: '🔮 Zukunft-Simulator starten',
                    actionType: 'simulator'
                }
            ],
            flow: [
                { num: '1', label: 'Radar-Signal' },
                { num: '2', label: 'Kelly-Einsatz' },
                { num: '3', label: 'Auto-Abrechnung FT' },
                { num: '4', label: '+5% Ziel-Sperre' }
            ]
        }
    };

    const currentT = t[lang] || t.tr;
    const activeData = currentT.steps[activeStep] || currentT.steps[0];

    const handleActionClick = (actionType) => {
        if (actionType === 'capital' && onOpenCapitalModal) {
            onOpenCapitalModal();
        } else if (actionType === 'journal' && onSelectTab) {
            onSelectTab('journal');
        } else if (actionType === 'leaderboard' && onSelectTab) {
            onSelectTab('leaderboard');
        } else if (actionType === 'simulator' && onSelectTab) {
            onSelectTab('simulator');
        }
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '16px',
            padding: '1.25rem 1.4rem',
            marginBottom: '1.5rem',
            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.1)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Top decorative gradient glow */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                right: '20%',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.8), rgba(16, 185, 129, 0.8), transparent)'
            }} />

            {/* Header Row */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.8rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(16, 185, 129, 0.2))',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                        boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)'
                    }}>
                        📘
                    </div>
                    <div>
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.05rem',
                            fontWeight: 900,
                            color: '#f8fafc',
                            letterSpacing: '-0.3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                        }}>
                            <span>{currentT.title}</span>
                            <span style={{
                                fontSize: '0.62rem',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                fontWeight: 800,
                                textTransform: 'uppercase'
                            }}>
                                100% REHBER
                            </span>
                        </h3>
                        <p style={{
                            margin: '3px 0 0 0',
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            lineHeight: '1.3'
                        }}>
                            {currentT.subtitle}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                        onClick={toggleCollapse}
                        style={{
                            background: isCollapsed ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isCollapsed ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: isCollapsed ? '#38bdf8' : '#cbd5e1',
                            padding: '0.4rem 0.85rem',
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
                        <span>{isCollapsed ? '👁️' : '🔽'}</span>
                        <span>{isCollapsed ? currentT.toggleShow : currentT.toggleHide}</span>
                    </button>
                </div>
            </div>

            {/* Collapsible Content */}
            {!isCollapsed && (
                <div style={{ marginTop: '1.25rem' }}>
                    {/* Visual 4-Step Flow Line */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        marginBottom: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.6rem'
                    }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.5px' }}>
                            ⚡ {currentT.pipelineTitle}:
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                        }}>
                            {currentT.flow.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        background: activeStep === idx ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                        border: `1px solid ${activeStep === idx ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        color: activeStep === idx ? '#38bdf8' : '#94a3b8',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setActiveStep(idx)}
                                    >
                                        <span style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            background: activeStep === idx ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                                            color: activeStep === idx ? '#0f172a' : '#94a3b8',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.6rem',
                                            fontWeight: 900
                                        }}>
                                            {item.num}
                                        </span>
                                        <span>{item.label}</span>
                                    </div>
                                    {idx < currentT.flow.length - 1 && (
                                        <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 900 }}>→</span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Step Cards Selector */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        marginBottom: '1rem'
                    }}>
                        {currentT.steps.map((st, i) => {
                            const isCurrent = activeStep === i;
                            return (
                                <div
                                    key={i}
                                    onClick={() => setActiveStep(i)}
                                    style={{
                                        background: isCurrent 
                                            ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(16, 185, 129, 0.1) 100%)' 
                                            : 'rgba(255, 255, 255, 0.02)',
                                        border: `1px solid ${isCurrent ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)'}`,
                                        borderRadius: '12px',
                                        padding: '0.85rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        transform: isCurrent ? 'translateY(-2px)' : 'none',
                                        boxShadow: isCurrent ? '0 4px 15px rgba(56, 189, 248, 0.15)' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <span style={{ fontSize: '1.3rem' }}>{st.icon}</span>
                                        <span style={{
                                            fontSize: '0.62rem',
                                            fontWeight: 900,
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            background: isCurrent ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                            color: isCurrent ? '#38bdf8' : '#64748b'
                                        }}>
                                            {st.tag}
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: '0.82rem',
                                        fontWeight: 800,
                                        color: isCurrent ? '#f8fafc' : '#cbd5e1',
                                        lineHeight: '1.25'
                                    }}>
                                        {st.title}
                                    </div>
                                    <div style={{
                                        fontSize: '0.68rem',
                                        color: isCurrent ? '#94a3b8' : '#64748b',
                                        marginTop: '0.35rem',
                                        lineHeight: '1.3'
                                    }}>
                                        {st.summary}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Step Detail & Call to Action Box */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '14px',
                        padding: '1.2rem 1.4rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <div style={{
                                fontSize: '0.92rem',
                                fontWeight: 900,
                                color: '#f8fafc',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.6rem'
                            }}>
                                <span>{activeData.icon}</span>
                                <span>{activeData.title}</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                {activeData.details.map((bullet, bIdx) => {
                                    // Parse basic markdown bolding
                                    const parts = bullet.split('**');
                                    return (
                                        <div key={bIdx} style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                                            {parts.map((p, pIdx) => (
                                                pIdx % 2 === 1 ? <strong key={pIdx} style={{ color: '#38bdf8' }}>{p}</strong> : p
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <button
                                onClick={() => handleActionClick(activeData.actionType)}
                                style={{
                                    background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                                    border: 'none',
                                    color: '#fff',
                                    padding: '0.65rem 1.25rem',
                                    borderRadius: '10px',
                                    fontSize: '0.8rem',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(56, 189, 248, 0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <span>{activeData.actionText}</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
