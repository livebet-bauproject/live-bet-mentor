import React, { useRef } from 'react';

export const ShareCardModal = ({
    isOpen,
    onClose,
    bankrollState,
    dailyProgress,
    bankrollIQ,
    lang = 'tr'
}) => {
    if (!isOpen) return null;

    const cardRef = useRef(null);

    const startBal = bankrollState.starting_balance || 2000;
    const curBal = bankrollState.current_balance || 2000;
    const realizedProfit = curBal - startBal;
    const roi = startBal > 0 ? (realizedProfit / startBal) * 100 : 0;

    const settled = (bankrollState.ledger || []).filter(l => l.is_settled);
    const wins = settled.filter(l => l.status === 'WIN' || l.outcome === 'WON').length;
    const losses = settled.filter(l => l.status === 'LOSS' || l.outcome === 'LOST').length;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

    const handleCopyOrDownload = () => {
        // Simple clipboard alert or toast
        alert(lang === 'tr' 
            ? 'Ekran görüntüsü alabilir veya bu kartı Instagram / Telegram gruplarınızda başarı raporu olarak paylaşabilirsiniz! 📸' 
            : 'You can take a screenshot or share this report with your community! 📸');
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
        }}>
            <div style={{
                maxWidth: '420px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
            }}>
                {/* Story / Post Brag Card (9:16 Aspect Ratio) */}
                <div
                    ref={cardRef}
                    style={{
                        width: '100%',
                        background: 'linear-gradient(165deg, #090e1f 0%, #030712 100%)',
                        border: '2px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: '24px',
                        padding: '2rem 1.75rem',
                        boxShadow: '0 25px 60px -15px rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '480px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Background glow orbs */}
                    <div style={{
                        position: 'absolute',
                        top: '-40px',
                        right: '-40px',
                        width: '160px',
                        height: '160px',
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(0,0,0,0) 70%)',
                        borderRadius: '50%'
                    }} />

                    {/* 1. Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.4rem' }}>⚡</span>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.5px' }}>
                                    LIVE BET MENTOR
                                </div>
                                <div style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 800 }}>
                                    ALGORİTMİK PORTFÖY LABORATUVARI
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981',
                            fontSize: '0.65rem',
                            fontWeight: 900
                        }}>
                            VERIFIED ALGO
                        </div>
                    </div>

                    {/* 2. Centerpiece: Daily Lock or ROI Badge */}
                    <div style={{ textAlign: 'center', margin: '1.5rem 0', zIndex: 1 }}>
                        <div style={{
                            display: 'inline-block',
                            background: dailyProgress.isTargetReached ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                            border: `1px solid ${dailyProgress.isTargetReached ? '#10b981' : '#38bdf8'}`,
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            color: dailyProgress.isTargetReached ? '#10b981' : '#38bdf8',
                            marginBottom: '0.85rem',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)'
                        }}>
                            {dailyProgress.isTargetReached ? '🔒 GÜNLÜK HEDEF KİLİTLENDİ' : '📈 PORTFÖY PERFORMANSI'}
                        </div>

                        <div style={{ fontSize: '3rem', fontWeight: 900, color: roi >= 0 ? '#10b981' : '#ef4444', lineHeight: 1 }}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', marginTop: '0.35rem' }}>
                            {lang === 'tr' ? 'Bileşik Portföy Getirisi (ROI)' : 'Compound Portfolio ROI'}
                        </div>
                    </div>

                    {/* 3. Stat Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '1rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        zIndex: 1
                    }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>BANKROLL IQ</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: bankrollIQ.color }}>
                                {bankrollIQ.score} <span style={{ fontSize: '0.75rem' }}>({bankrollIQ.grade})</span>
                            </div>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{bankrollIQ.label}</div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>İSABET ORANI</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8' }}>
                                %{winRate.toFixed(1)}
                            </div>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{wins}W - {losses}L</div>
                        </div>
                    </div>

                    {/* 4. Footer & Compliance Note */}
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', zIndex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#94a3b8' }}>
                            <span style={{ fontWeight: 800, color: '#f8fafc' }}>@{bankrollState.nickname || 'KuantAnalist'}</span>
                            <span>{new Date().toLocaleDateString('tr-TR')}</span>
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#64748b', textAlign: 'center', marginTop: '0.5rem' }}>
                            🛡️ 7258 Sayılı Kanuna Uyumlu Risksiz Sanal Simülasyon • livebetmentor.com
                        </div>
                    </div>
                </div>

                {/* Modal Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#94a3b8',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                        }}
                    >
                        {lang === 'tr' ? 'Kapat' : 'Close'}
                    </button>
                    <button
                        onClick={handleCopyOrDownload}
                        style={{
                            flex: 2,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: '#fff',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                        }}
                    >
                        📸 {lang === 'tr' ? 'Paylaş / Ekranı Kaydet' : 'Share / Save Card'}
                    </button>
                </div>
            </div>
        </div>
    );
};
