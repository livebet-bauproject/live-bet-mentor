import React, { useState, useMemo } from 'react';

const LOCALES = {
    tr: {
        title: 'Bileşik Büyüme & Gelecek Projeksiyon Simülatörü',
        subtitle: 'Hırsla değil; küçük, istikrarlı kâr hedefleri ve bileşik faiz ile sermayenin nasıl büyüdüğünü canlı test edin.',
        paramsTitle: 'SİMÜLASYON PARAMETRELERİ',
        capLabel: 'Başlangıç Sermayesi:',
        dailyGainLabel: 'Günlük Ortalama Disiplin Hedefi:',
        horizonLabel: 'Projeksiyon Vadesi:',
        daysUnit: 'Gün',
        finalCapTitle: (days) => `${days}. GÜN NİHAİ SANAL PORTFÖY`,
        totalNetGrowth: 'Toplam Net Büyüme:',
        netCapitalGain: 'Net Katma Değer:',
        powerTitle: 'Matematiğin ve Disiplinin Gücü',
        powerDesc: (dailyPct, days, growthPct) => `Günde yalnızca %${dailyPct.toFixed(1)} hedef koyup kasayı kilitlediğinizde; ${days} gün sonunda sermayeniz hırsa ve kumara gerek kalmadan %${growthPct} büyür. Profesyonel fon yöneticilerinin sırrı işte bu bileşik sabırdır.`,
        chartTitle: (days) => `${days} Günlük Bileşik Eğri (Üstel Büyüme)`,
        legendCompound: 'Bileşik Büyüme',
        legendLinear: 'Düz Doğrusal Getiri',
        day0: '0. Gün (Başlangıç)',
        dayN: (days) => `${days}. Gün`
    },
    en: {
        title: 'Compound Growth & Future Projection Simulator',
        subtitle: 'Simulate the exponential power of disciplined, daily compound growth over time without gambling.',
        paramsTitle: 'SIMULATION PARAMETERS',
        capLabel: 'Starting Capital:',
        dailyGainLabel: 'Daily Target Gain:',
        horizonLabel: 'Time Horizon:',
        daysUnit: 'Days',
        finalCapTitle: (days) => `DAY ${days} FINAL VIRTUAL CAPITAL`,
        totalNetGrowth: 'Total Net Growth:',
        netCapitalGain: 'Net Capital Gain:',
        powerTitle: 'The Power of Compounding & Discipline',
        powerDesc: (dailyPct, days, growthPct) => `By locking in just %${dailyPct.toFixed(1)} daily, your capital compounds by %${growthPct} in ${days} days without emotional gambling. This disciplined compound patience is the institutional fund secret.`,
        chartTitle: (days) => `${days} Day Exponential Compound Curve`,
        legendCompound: 'Compound Growth',
        legendLinear: 'Linear Return',
        day0: 'Day 0 (Start)',
        dayN: (days) => `Day ${days}`
    },
    de: {
        title: 'Zinseszins-Wachstum & Zukunftsprojektions-Simulator',
        subtitle: 'Erleben Sie, wie kleine, beständige Gewinne durch den Zinseszinseffekt über die Zeit exponentiell wachsen.',
        paramsTitle: 'SIMULATIONSPARAMETER',
        capLabel: 'Startkapital:',
        dailyGainLabel: 'Tägliches Ziel-Wachstum:',
        horizonLabel: 'Projektions-Zeithorizont:',
        daysUnit: 'Tage',
        finalCapTitle: (days) => `TAG ${days} FINALES VIRTUELLES KAPITAL`,
        totalNetGrowth: 'Gesamtes Netto-Wachstum:',
        netCapitalGain: 'Netto-Kapitalzuwachs:',
        powerTitle: 'Die mathematische Kraft des Zinseszinses',
        powerDesc: (dailyPct, days, growthPct) => `Indem Sie täglich nur %${dailyPct.toFixed(1)} sichern, wächst Ihr Kapital in ${days} Tagen um %${growthPct} – ganz ohne emotionales Zocken. Diese Zinseszins-Geduld ist das Fundament professioneller Fonds.`,
        chartTitle: (days) => `${days}-Tage exponentielle Zinseszins-Kurve`,
        legendCompound: 'Zinseszins-Wachstum',
        legendLinear: 'Lineare Rendite',
        day0: 'Tag 0 (Start)',
        dayN: (days) => `Tag ${days}`
    }
};

export const CompoundSimulator = ({ currentStartingBalance = 2000, lang = 'tr' }) => {
    const [capital, setCapital] = useState(currentStartingBalance || 2000);
    const [dailyPct, setDailyPct] = useState(2.0); // 2.0%
    const [days, setDays] = useState(30); // 15, 30, 60, 90

    const loc = LOCALES[lang] || LOCALES.tr;

    const projection = useMemo(() => {
        const points = [];
        const linearPoints = [];
        const rate = dailyPct / 100;
        let current = capital;
        let linearCurrent = capital;
        const linearStep = capital * rate;

        for (let day = 0; day <= days; day++) {
            points.push({
                day,
                balance: Math.round(current * 100) / 100,
                growthPct: Math.round(((current - capital) / capital) * 1000) / 10
            });
            linearPoints.push({
                day,
                balance: Math.round(linearCurrent * 100) / 100
            });
            current = current * (1 + rate);
            linearCurrent = linearCurrent + linearStep;
        }

        const finalBalance = points[points.length - 1].balance;
        const totalGrowthPct = points[points.length - 1].growthPct;
        const netGain = Math.round((finalBalance - capital) * 100) / 100;

        return { points, linearPoints, finalBalance, totalGrowthPct, netGain };
    }, [capital, dailyPct, days]);

    // SVG graph generation
    const min = capital;
    const max = projection.finalBalance;
    const range = (max - min) === 0 ? 1 : (max - min);

    const svgPoints = projection.points.map((p, i) => {
        const x = (i / days) * 100;
        const y = 100 - ((p.balance - min) / range) * 85 - 8;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const linearSvgPoints = projection.linearPoints.map((p, i) => {
        const x = (i / days) * 100;
        const y = 100 - ((p.balance - min) / range) * 85 - 8;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
        <div className="compound-simulator-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem'
                    }}>
                        🔮
                    </div>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{loc.title}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                            {loc.subtitle}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls & Metrics Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem'
            }}>
                {/* 1. Controller Inputs */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.2rem'
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#38bdf8' }}>
                        ⚙️ {loc.paramsTitle}
                    </div>

                    {/* Capital Slider */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                                {loc.capLabel}
                            </span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#f8fafc' }}>
                                {capital.toLocaleString()} ₺
                            </span>
                        </div>
                        <input
                            type="range"
                            min={500}
                            max={30000}
                            step={500}
                            value={capital}
                            onChange={(e) => setCapital(Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                            {[1000, 2500, 5000, 10000].map(val => (
                                <button
                                    key={val}
                                    onClick={() => setCapital(val)}
                                    style={{
                                        background: capital === val ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${capital === val ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                                        color: capital === val ? '#38bdf8' : '#94a3b8',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '6px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {val.toLocaleString()} ₺
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Daily Target Slider */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                                {loc.dailyGainLabel}
                            </span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#10b981' }}>
                                %{dailyPct.toFixed(1)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0.5}
                            max={6.0}
                            step={0.5}
                            value={dailyPct}
                            onChange={(e) => setDailyPct(Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                            {[1.0, 2.0, 3.0, 5.0].map(val => (
                                <button
                                    key={val}
                                    onClick={() => setDailyPct(val)}
                                    style={{
                                        background: dailyPct === val ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${dailyPct === val ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                                        color: dailyPct === val ? '#10b981' : '#94a3b8',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '6px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    %{val.toFixed(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Horizon Pills */}
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.4rem' }}>
                            {loc.horizonLabel}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                            {[15, 30, 60, 90].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    style={{
                                        background: days === d ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${days === d ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                                        color: days === d ? '#f8fafc' : '#94a3b8',
                                        padding: '0.45rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        textAlign: 'center'
                                    }}
                                >
                                    {d} {loc.daysUnit}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Calculated Outcomes */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.8))',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>🚀</span>
                            <span>{loc.finalCapTitle(days)}</span>
                        </div>
                        <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#10b981', margin: '0.5rem 0' }}>
                            {projection.finalBalance.toLocaleString()} ₺
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 800 }}>
                            {loc.totalNetGrowth} <span style={{ color: '#10b981' }}>+{projection.totalGrowthPct}%</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                            {loc.netCapitalGain} +{projection.netGain.toLocaleString()} ₺
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0,0,0,0.35)',
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        marginTop: '1rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#f8fafc', marginBottom: '0.3rem' }}>
                            💡 {loc.powerTitle}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: '1.5' }}>
                            {loc.powerDesc(dailyPct, days, projection.totalGrowthPct)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exponential Curve Graph */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📊</span>
                        <span>{loc.chartTitle(days)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.68rem' }}>
                        <span style={{ color: '#10b981', fontWeight: 800 }}>● {loc.legendCompound}</span>
                        <span style={{ color: '#64748b', fontWeight: 700 }}>● {loc.legendLinear}</span>
                    </div>
                </div>

                <div style={{ width: '100%', height: '160px' }}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                            <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>
                        {/* Linear reference line */}
                        <polyline
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="0.8"
                            strokeDasharray="2,2"
                            points={linearSvgPoints}
                        />
                        {/* Exponential compound filled curve */}
                        <path
                            d={`M 0,100 L ${svgPoints} L 100,100 Z`}
                            fill="url(#simGradient)"
                        />
                        <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.5"
                            points={svgPoints}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    <span>{loc.day0}: {capital.toLocaleString()} ₺</span>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>{loc.dayN(days)}: {projection.finalBalance.toLocaleString()} ₺</span>
                </div>
            </div>

        </div>
    );
};
