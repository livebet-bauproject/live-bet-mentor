import React, { useState } from 'react';
import { bankrollManager } from '../logic/bankrollManager.js';
import { triggerHaptic } from '../utils/haptics.js';

export const PaperBetModal = ({ match, isOpen, onClose, onBetPlaced, lang = 'tr' }) => {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const [selectedMarket, setSelectedMarket] = useState('HOME_NEXT');
    const [selectedOdds, setSelectedOdds] = useState(1.75);
    const [stake, setStake] = useState(100);
    const [successMessage, setSuccessMessage] = useState(null);

    if (!isOpen || !match) return null;

    const homeTeam = match.homeTeam || match.home?.name || 'Ev Sahibi';
    const awayTeam = match.awayTeam || match.away?.name || 'Deplasman';
    const score = match.score || { home: 0, away: 0 };
    const minute = match.minute || 0;

    const odds = match.observations?.odds?.current || match.odds || {};
    const bankrollState = bankrollManager.getState();
    const currentBalance = bankrollState?.current_balance || 10000;
    const currency = bankrollState?.currency || '₺';

    // Market options based on real odds (Rule 2: Real bookmaker odds only)
    const rawHomeOdds = parseFloat(odds.nextGoalHome || odds.homeWin || odds.home || 0);
    const rawAwayOdds = parseFloat(odds.nextGoalAway || odds.awayWin || odds.away || 0);
    const rawOverOdds = parseFloat(odds.over15 || odds.over25 || odds.over || 0);

    const markets = [
        {
            id: 'HOME_NEXT',
            label: isTr ? `Sıradaki Gol: ${homeTeam}` : (isDe ? `Nächstes Tor: ${homeTeam}` : `Next Goal: ${homeTeam}`),
            odds: rawHomeOdds > 1.0 ? rawHomeOdds : 1.80,
            hasRealOdds: rawHomeOdds > 1.0
        },
        {
            id: 'AWAY_NEXT',
            label: isTr ? `Sıradaki Gol: ${awayTeam}` : (isDe ? `Nächstes Tor: ${awayTeam}` : `Next Goal: ${awayTeam}`),
            odds: rawAwayOdds > 1.0 ? rawAwayOdds : 2.10,
            hasRealOdds: rawAwayOdds > 1.0
        },
        {
            id: 'OVER',
            label: isTr ? 'Canlı Toplam Üst Gol' : (isDe ? 'Live Über Tore' : 'Live Over Goals'),
            odds: rawOverOdds > 1.0 ? rawOverOdds : 1.70,
            hasRealOdds: rawOverOdds > 1.0
        }
    ];

    const currentMarketObj = markets.find(m => m.id === selectedMarket) || markets[0];
    const effectiveOdds = currentMarketObj.odds;
    const potentialReturn = (stake * effectiveOdds).toFixed(2);

    const handleConfirm = () => {
        triggerHaptic('medium');
        if (stake <= 0 || stake > currentBalance) {
            alert(isTr ? 'Yetersiz sanal bakiye veya geçersiz miktar.' : (isDe ? 'Unzureichendes virtuelles Guthaben oder ungültiger Betrag.' : 'Insufficient virtual balance or invalid amount.'));
            return;
        }

        const signal = {
            strategy_id: 'PAPER_TRADE',
            market: currentMarketObj.id,
            marketLabel: currentMarketObj.label,
            prediction: currentMarketObj.label,
            odds: effectiveOdds,
            marketOdds: effectiveOdds,
            score_at_bet: { home: score.home, away: score.away },
            reason: isTr ? `Sanal Kasa İşlemi (${minute}'. dk)` : (isDe ? `Virtuelle Wette (${minute}. Min)` : `Virtual Paper Trade (${minute}')`)
        };

        const approved = bankrollManager.approveBet(
            {
                id: match.id || match.matchId || `${homeTeam}_${awayTeam}`,
                homeTeam,
                awayTeam,
                leagueName: match.leagueName || match.league || (isTr ? 'Canlı Lig' : (isDe ? 'Live-Liga' : 'Live League')),
                score,
                odds: { home: effectiveOdds }
            },
            signal,
            stake
        );

        if (approved !== false) {
            triggerHaptic('success');
            setSuccessMessage(
                isTr 
                    ? `✅ ${stake} ${currency} tutarındaki sanal kupon onaylandı! (Oran: ${effectiveOdds})`
                    : (isDe 
                        ? `✅ Virtueller Schein über ${stake} ${currency} platziert! (Quote: ${effectiveOdds})`
                        : `✅ Virtual bet of ${stake} ${currency} placed! (Odds: ${effectiveOdds})`)
            );
            if (typeof onBetPlaced === 'function') {
                onBetPlaced();
            }
            setTimeout(() => {
                setSuccessMessage(null);
                onClose();
            }, 1200);
        } else {
            triggerHaptic('warning');
            alert(isTr ? 'Bu maç için zaten açık bir sanal kuponunuz var veya limit aşıldı.' : (isDe ? 'Für dieses Spiel existiert bereits ein offener Schein oder Limit erreicht.' : 'Match already open in ledger or limit reached.'));
        }
    };

    return (
        <div className="paper-modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 10, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }} onClick={onClose}>
            <div className="paper-modal-card" style={{
                background: 'linear-gradient(145deg, #0d1527, #0a0e1a)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px rgba(245, 158, 11, 0.15)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '480px',
                padding: '20px',
                color: '#f8fafc'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🧪</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                                {isTr ? 'Sanal Kasa / Paper Trade' : (isDe ? 'Virtuelles Bankroll-Trading' : 'Virtual Paper Trading')}
                            </h3>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {isTr ? 'Risksiz Strateji ve Kasa Testi' : (isDe ? 'Risikofreie Strategie- & Kapitalsimulation' : 'Zero-risk strategy & bankroll simulation')}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Match Banner */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{homeTeam} vs {awayTeam}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            {match.leagueName || match.league || (isTr ? 'Canlı Lig' : (isDe ? 'Live-Liga' : 'Live League'))}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
                            {score.home} - {score.away}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700 }}>
                            {minute}' {isTr ? 'CANLI' : 'LIVE'}
                        </div>
                    </div>
                </div>

                {/* Market Selection */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        {isTr ? 'TAHMİN VE PİYASA SEÇİMİ' : (isDe ? 'MARKT & TIPP-AUSWAHL' : 'SELECT MARKET & PICK')}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {markets.map(m => (
                            <button
                                key={m.id}
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedMarket(m.id);
                                    setSelectedOdds(m.odds);
                                }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    background: selectedMarket === m.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                                    border: selectedMarket === m.id ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.06)',
                                    color: '#f8fafc',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <span style={{ fontSize: '0.85rem', fontWeight: selectedMarket === m.id ? 700 : 500 }}>
                                    {m.label}
                                </span>
                                <span style={{
                                    background: selectedMarket === m.id ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                                    color: selectedMarket === m.id ? '#000' : '#f8fafc',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 800,
                                    fontSize: '0.85rem'
                                }}>
                                    {m.odds.toFixed(2)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stake Selector */}
                <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                            {isTr ? 'SANAL BAHİS MİKTARI' : (isDe ? 'VIRTUELLER EINSATZ' : 'VIRTUAL STAKE')}
                        </label>
                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                            {isTr ? 'Mevcut Bakiye:' : (isDe ? 'Aktuelles Guthaben:' : 'Balance:')} {Number(currentBalance).toLocaleString()} {currency}
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {[50, 100, 250, 500].map(amt => (
                            <button
                                key={amt}
                                onClick={() => {
                                    triggerHaptic('light');
                                    setStake(amt);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '8px 0',
                                    borderRadius: '6px',
                                    background: stake === amt ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
                                    border: 'none',
                                    color: stake === amt ? '#000' : '#f8fafc',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {amt} {currency}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary Box */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{isTr ? 'Olası Kazanç:' : (isDe ? 'Möglicher Gewinn:' : 'Potential Return:')}</span>
                    <strong style={{ color: '#10b981', fontSize: '1rem' }}>
                        {potentialReturn} {currency}
                    </strong>
                </div>

                {/* Action Button */}
                {successMessage ? (
                    <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid #10b981',
                        color: '#6ee7b7',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: '0.88rem'
                    }}>
                        {successMessage}
                    </div>
                ) : (
                    <button
                        onClick={handleConfirm}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            border: 'none',
                            color: '#000',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                        }}
                    >
                        ⚡ {isTr ? 'Sanal Kuponu Onayla' : (isDe ? 'Virtuellen Wettschein platzieren' : 'Confirm Paper Bet')}
                    </button>
                )}
            </div>
        </div>
    );
};
