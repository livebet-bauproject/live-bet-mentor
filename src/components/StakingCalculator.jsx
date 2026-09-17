import React, { useState, useMemo } from 'react';
import { translations } from '../locales/translations';
import { FAQ } from './FAQ';

export const StakingCalculator = ({ onClose, lang = 'tr' }) => {
    const t = translations[lang] || translations['tr'];

    // State
    const [bankroll, setBankroll] = useState(2000);
    const [riskLevel, setRiskLevel] = useState(30); // 30%, 50%, 100%
    const [matches, setMatches] = useState([
        { id: 1, name: '', odds: 1.50 },
        { id: 2, name: '', odds: 1.80 }
    ]);
    const [showResults, setShowResults] = useState(false);
    const [showFAQ, setShowFAQ] = useState(false);

    // Add new match
    const addMatch = () => {
        const newId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) + 1 : 1;
        setMatches([...matches, { id: newId, name: '', odds: 1.50 }]);
    };

    // Remove match
    const removeMatch = (id) => {
        if (matches.length > 1) {
            setMatches(matches.filter(m => m.id !== id));
        }
    };

    // Update match
    const updateMatch = (id, field, value) => {
        setMatches(matches.map(m =>
            m.id === id ? { ...m, [field]: field === 'odds' ? parseFloat(value) || 1.01 : value } : m
        ));
    };

    // Calculate stakes (Proportional to Probability method)
    const calculations = useMemo(() => {
        const riskAmount = (bankroll * riskLevel) / 100;

        // Calculate implied probability for each match
        const matchesWithProb = matches.map(m => ({
            ...m,
            impliedProb: 100 / m.odds,
            profitMultiplier: m.odds - 1
        }));

        // Total probability points
        const totalProb = matchesWithProb.reduce((sum, m) => sum + m.impliedProb, 0);

        // Calculate stake for each match
        const results = matchesWithProb.map(m => {
            const stake = (m.impliedProb / totalProb) * riskAmount;
            const potentialWin = stake * m.profitMultiplier;
            return {
                ...m,
                stake: stake,
                potentialWin: potentialWin,
                percentage: (stake / riskAmount) * 100
            };
        });

        // Calculate scenarios
        const scenarios = [];
        const n = results.length;

        // All win
        const allWin = results.reduce((sum, r) => sum + r.potentialWin, 0);
        scenarios.push({ hits: n, misses: 0, net: allWin });

        // X wins, sorted by stake (highest stake wins first for best case)
        const sortedByStake = [...results].sort((a, b) => b.stake - a.stake);

        for (let wins = n - 1; wins >= 0; wins--) {
            const winningMatches = sortedByStake.slice(0, wins);
            const losingMatches = sortedByStake.slice(wins);
            const profit = winningMatches.reduce((sum, r) => sum + r.potentialWin, 0);
            const loss = losingMatches.reduce((sum, r) => sum + r.stake, 0);
            scenarios.push({
                hits: wins,
                misses: n - wins,
                net: profit - loss
            });
        }

        return {
            riskAmount,
            results,
            scenarios,
            totalPotential: allWin
        };
    }, [matches, bankroll, riskLevel]);

    // Handle calculate
    const handleCalculate = () => {
        setShowResults(true);
    };

    // Format currency
    const formatTL = (amount) => {
        return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount) + (lang === 'tr' ? ' TL' : ' ₺');
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                background: 'rgba(3, 7, 18, 0.98)',
                zIndex: 4000,
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)'
            }}
        >
            <div
                className="glass-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    animation: 'modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    overflowY: 'auto',
                    maxWidth: '900px',
                    width: '95%',
                    maxHeight: '90vh',
                    padding: '2.5rem',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--accent-color) transparent'
                }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.5rem',
                        right: '1.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--danger-color)',
                        color: 'var(--danger-color)',
                        width: '3rem',
                        height: '3rem',
                        borderRadius: '50%',
                        fontSize: '1.8rem',
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

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 style={{
                        background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #f97316)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '2.2rem',
                        fontWeight: 900,
                        letterSpacing: '-1px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.8rem'
                    }}>
                        💰 {t.staking_title || (lang === 'tr' ? 'SMART STAKING HESAPLAYICI' : 'SMART STAKING CALCULATOR')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1rem' }}>
                        {t.staking_subtitle || (lang === 'tr' ? 'Oranlarınıza göre otomatik kasa dağılımı' : 'Automated bankroll distribution based on odds')}
                    </p>
                    <button
                        onClick={() => setShowFAQ(true)}
                        style={{
                            marginTop: '1rem',
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid var(--accent-color)',
                            color: 'var(--accent-color)',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.3s'
                        }}
                    >
                        ℹ️ {t.staking_faq_title || (lang === 'tr' ? 'NASIL ÇALIŞIR?' : 'HOW IT WORKS?')}
                    </button>
                </div>

                {showFAQ && <FAQ onClose={() => setShowFAQ(false)} lang={lang} mode="staking" />}

                {/* Input Section */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    {/* Bankroll Input */}
                    <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                        <label style={{ display: 'block', marginBottom: '0.8rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.95rem' }}>
                            {t.bankroll_label || (lang === 'tr' ? '💵 Ana Kasa (TL)' : '💵 Bankroll')}
                        </label>
                        <input
                            type="number"
                            value={bankroll}
                            onChange={(e) => setBankroll(parseFloat(e.target.value) || 0)}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(251, 191, 36, 0.3)',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fbbf24',
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                textAlign: 'center'
                            }}
                            min="0"
                        />
                    </div>

                    {/* Risk Level */}
                    <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                        <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.95rem' }}>
                            {t.risk_level || (lang === 'tr' ? '⚠️ Risk Seviyesi' : '⚠️ Risk Level')}
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {[
                                { value: 30, label: t.safe_mode_staking || t.safe_mode || (lang === 'tr' ? '🛡️ Güvenli (%30)' : '🛡️ Safe (30%)'), color: '#10b981' },
                                { value: 50, label: t.normal_mode_staking || t.normal_mode || (lang === 'tr' ? '⚖️ Normal (%50)' : '⚖️ Normal (50%)'), color: '#fbbf24' },
                                { value: 100, label: t.aggressive_mode_staking || t.aggressive_mode || (lang === 'tr' ? '🔥 Agresif (%100)' : '🔥 Aggressive (100%)'), color: '#ef4444' }
                            ].map(r => (
                                <button
                                    key={r.value}
                                    onClick={() => setRiskLevel(r.value)}
                                    style={{
                                        flex: '1 1 80px',
                                        minWidth: '80px',
                                        padding: '0.6rem 0.3rem',
                                        borderRadius: '8px',
                                        border: `2px solid ${riskLevel === r.value ? r.color : 'rgba(255,255,255,0.1)'}`,
                                        background: riskLevel === r.value ? `${r.color}22` : 'rgba(0,0,0,0.2)',
                                        color: riskLevel === r.value ? r.color : 'var(--text-secondary)',
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <div style={{
                            marginTop: '1rem',
                            textAlign: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: riskLevel === 30 ? '#10b981' : riskLevel === 50 ? '#fbbf24' : '#ef4444'
                        }}>
                            {t.risk_amount || (lang === 'tr' ? 'Risk Miktarı:' : 'Risk Amount:')} {formatTL((bankroll * riskLevel) / 100)}
                        </div>
                    </div>
                </div>

                {/* Matches Section */}
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                        <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.1rem' }}>
                            ⚽ {t.matches_label || (lang === 'tr' ? 'Maçlar' : 'Matches')}
                        </h3>
                        <button
                            onClick={addMatch}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '8px',
                                border: '1px solid var(--success-color)',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: 'var(--success-color)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            + {t.add_match || (lang === 'tr' ? 'Maç Ekle' : 'Add Match')}
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {matches.map((match, index) => (
                            <div
                                key={match.id}
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    alignItems: 'center',
                                    padding: '0.8rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}
                            >
                                <span style={{
                                    width: '2rem',
                                    height: '2rem',
                                    background: 'rgba(56, 189, 248, 0.2)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--accent-color)',
                                    fontWeight: 700,
                                    fontSize: '0.9rem'
                                }}>
                                    {index + 1}
                                </span>
                                <input
                                    type="text"
                                    placeholder={t.match_name_placeholder || (lang === 'tr' ? 'Maç adı (ör: Fenerbahçe - Galatasaray)' : 'Match name (e.g. Real Madrid - Barcelona)')}
                                    value={match.name}
                                    onChange={(e) => updateMatch(match.id, 'name', e.target.value)}
                                    style={{
                                        flex: '1 1 120px',
                                        minWidth: '100px',
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(0,0,0,0.3)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem'
                                    }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                        {t.odds_label || (lang === 'tr' ? 'Oran:' : 'Odds:')}
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="1.01"
                                        value={match.odds}
                                        onChange={(e) => updateMatch(match.id, 'odds', e.target.value)}
                                        style={{
                                            width: '60px',
                                            padding: '0.6rem',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            background: 'rgba(0,0,0,0.3)',
                                            color: '#fbbf24',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            textAlign: 'center'
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={() => removeMatch(match.id)}
                                    disabled={matches.length <= 1}
                                    style={{
                                        width: '2.5rem',
                                        height: '2.5rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--danger-color)',
                                        background: matches.length <= 1 ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                                        color: matches.length <= 1 ? 'var(--text-secondary)' : 'var(--danger-color)',
                                        cursor: matches.length <= 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '1.2rem',
                                        opacity: matches.length <= 1 ? 0.3 : 1
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Calculate Button */}
                <button
                    onClick={handleCalculate}
                    style={{
                        width: '100%',
                        padding: '1.2rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                        color: '#000',
                        fontSize: '1.2rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        marginBottom: '2rem',
                        transition: 'all 0.3s',
                        boxShadow: '0 4px 20px rgba(251, 191, 36, 0.3)'
                    }}
                >
                    🧮 {t.calculate_btn || (lang === 'tr' ? 'HESAPLA' : 'CALCULATE')}
                </button>

                {/* Results Section */}
                {showResults && (
                    <div style={{ animation: 'modalEnter 0.3s ease-out' }}>
                        {/* Stakes Table */}
                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <h3 style={{ color: 'var(--success-color)', fontWeight: 800, marginBottom: '1rem', fontSize: '1.1rem' }}>
                                📊 {t.results_title || (lang === 'tr' ? 'Bahis Dağılımı' : 'Stake Distribution')}
                            </h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <th style={{ padding: '0.8rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {t.match_col || (lang === 'tr' ? 'Maç' : 'Match')}
                                            </th>
                                            <th style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {t.odds_col || (lang === 'tr' ? 'Oran' : 'Odds')}
                                            </th>
                                            <th style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {t.prob_col || (lang === 'tr' ? 'İma. Olasılık' : 'Implied Prob.')}
                                            </th>
                                            <th style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {t.stake_col || (lang === 'tr' ? 'Bahis Miktarı' : 'Stake Amount')}
                                            </th>
                                            <th style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {t.profit_col || (lang === 'tr' ? 'Potansiyel Kâr' : 'Potential Profit')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calculations.results.map((r, i) => (
                                             <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                    {r.name || (lang === 'tr' ? `Maç ${i + 1}` : `Match ${i + 1}`)}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center', color: '#fbbf24', fontWeight: 700 }}>
                                                    {r.odds.toFixed(2)}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--accent-color)' }}>
                                                    %{r.impliedProb.toFixed(0)}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '6px',
                                                        color: 'var(--success-color)',
                                                        fontWeight: 700
                                                    }}>
                                                        {formatTL(r.stake)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--success-color)', fontWeight: 600 }}>
                                                    +{formatTL(r.potentialWin)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                            <td colSpan={3} style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                                                {t.total_label || (lang === 'tr' ? 'TOPLAM RİSK' : 'TOTAL RISK')}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center', color: '#fbbf24', fontWeight: 900, fontSize: '1.1rem' }}>
                                                {formatTL(calculations.riskAmount)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--success-color)', fontWeight: 900, fontSize: '1.1rem' }}>
                                                +{formatTL(calculations.totalPotential)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Scenarios Table */}
                        <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(167, 139, 250, 0.05)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                            <h3 style={{ color: '#a78bfa', fontWeight: 800, marginBottom: '1rem', fontSize: '1.1rem' }}>
                                🎯 {t.scenarios_title || (lang === 'tr' ? 'Olası Senaryolar' : 'Possible Scenarios')}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.8rem' }}>
                                {calculations.scenarios.map((s, i) => {
                                    const isProfit = s.net >= 0;
                                    const isAllWin = i === 0;
                                    const isAllLose = i === calculations.scenarios.length - 1;

                                    let bgColor = isProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                                    let borderColor = isProfit ? 'var(--success-color)' : 'var(--danger-color)';

                                    if (isAllWin) {
                                        bgColor = 'rgba(16, 185, 129, 0.2)';
                                    } else if (isAllLose) {
                                        bgColor = 'rgba(239, 68, 68, 0.2)';
                                    }

                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                padding: '1rem',
                                                background: bgColor,
                                                borderRadius: '10px',
                                                border: `1px solid ${borderColor}33`,
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                {s.hits}/{matches.length} {t.hits_label || (lang === 'tr' ? 'tuttu' : 'won')}
                                            </div>
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: 800,
                                                color: isProfit ? 'var(--success-color)' : 'var(--danger-color)'
                                            }}>
                                                {isProfit ? '+' : ''}{formatTL(s.net)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Warning Note */}
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: 'rgba(251, 191, 36, 0.1)',
                                borderRadius: '10px',
                                border: '1px solid rgba(251, 191, 36, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                    {t.staking_warning || (lang === 'tr' ? 'Düşük oranlı maçlara daha fazla para konulur çünkü olasılıkları yüksektir. En düşük oranlı maçın tutması kritik önemdedir!' : 'More capital is allocated to lower-odds matches due to higher probability. Winning the lowest-odds selection is critical!')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
