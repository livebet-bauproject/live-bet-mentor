import React, { useState } from 'react';

export const AnalystLeaderboard = ({
    leaderboardData,
    currentNickname,
    onSaveNickname,
    lang = 'tr'
}) => {
    const [isEditingNick, setIsEditingNick] = useState(false);
    const [nicknameInput, setNicknameInput] = useState(currentNickname || '');

    const handleSaveNick = () => {
        if (nicknameInput.trim().length > 0) {
            onSaveNickname(nicknameInput.trim());
            setIsEditingNick(false);
        }
    };

    return (
        <div className="analyst-leaderboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Header & Rules Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 179, 8, 0.1))',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem'
                        }}>
                            🏆
                        </div>
                        <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{lang === 'tr' ? 'Haftalık Kuant Analist Ligi' : 'Weekly Quant Analyst League'}</span>
                                <span style={{
                                    fontSize: '0.65rem',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                    fontWeight: 900
                                }}>
                                    HAFTALIK SEZON #12
                                </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                {lang === 'tr' 
                                    ? 'Sıralama para miktarına göre değil; % ROI (Büyüme) ve Bankroll IQ Disiplin Skoru bileşkesine göredir.' 
                                    : 'Rankings are based strictly on % ROI growth and Bankroll IQ discipline score, ensuring fair equality.'}
                            </div>
                        </div>
                    </div>

                    {/* Nickname Editor */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{lang === 'tr' ? 'Ligdeki Adın:' : 'League Nick:'}</span>
                        {isEditingNick ? (
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={nicknameInput}
                                    onChange={(e) => setNicknameInput(e.target.value)}
                                    maxLength={20}
                                    style={{
                                        background: '#0f172a',
                                        border: '1px solid #38bdf8',
                                        color: '#f8fafc',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '5px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        width: '120px'
                                    }}
                                />
                                <button
                                    onClick={handleSaveNick}
                                    style={{
                                        background: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✓
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#38bdf8' }}>{currentNickname || 'Analist'}</span>
                                <button
                                    onClick={() => { setNicknameInput(currentNickname); setIsEditingNick(true); }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem'
                                    }}
                                    title={lang === 'tr' ? 'Takma adı düzenle' : 'Edit nickname'}
                                >
                                    ✏️
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fair Play & Reward Pills */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.75rem',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.04)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚖️</span>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>EŞİT & ADİL YARIŞMA</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>500 ₺ ile 10.000 ₺ aynı oranda yarışır.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>DİSİPLİN KORUYUCU</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Stop-loss'a uyan ekstra puan kazanır.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>👑</span>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b' }}>PRESTİJ ÖDÜLÜ</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Haftanın 1.'sine VIP Şampiyon Tacı verilir.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Leaderboard Table */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 1.5fr 1fr 1fr 1fr 100px',
                    padding: '0.85rem 1.25rem',
                    background: 'rgba(0,0,0,0.35)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    color: '#94a3b8',
                    letterSpacing: '0.5px'
                }}>
                    <span>#</span>
                    <span>{lang === 'tr' ? 'ANALİST & RÜTBE' : 'ANALYST & BADGE'}</span>
                    <span style={{ textAlign: 'right' }}>{lang === 'tr' ? 'HAFTALIK ROI' : 'WEEKLY ROI'}</span>
                    <span style={{ textAlign: 'right' }}>{lang === 'tr' ? 'BAŞARI ORANI' : 'WIN RATE'}</span>
                    <span style={{ textAlign: 'right' }}>BANKROLL IQ</span>
                    <span style={{ textAlign: 'center' }}>{lang === 'tr' ? 'DURUM' : 'STATUS'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {leaderboardData.map((item) => {
                        const isUser = item.isCurrentUser;
                        const rankMedal = item.rank === 1 ? '🥇' : (item.rank === 2 ? '🥈' : (item.rank === 3 ? '🥉' : `#${item.rank}`));

                        return (
                            <div
                                key={item.id || item.rank}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '50px 1.5fr 1fr 1fr 1fr 100px',
                                    padding: '0.9rem 1.25rem',
                                    alignItems: 'center',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                    background: isUser 
                                        ? 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)' 
                                        : 'transparent',
                                    borderLeft: isUser ? '3px solid #38bdf8' : '3px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Rank */}
                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: item.rank <= 3 ? '#f59e0b' : '#94a3b8' }}>
                                    {rankMedal}
                                </div>

                                {/* Analyst & Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: isUser ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)',
                                        border: `1px solid ${isUser ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem'
                                    }}>
                                        {item.avatar || '👤'}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isUser ? '#38bdf8' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span>{item.nickname}</span>
                                            {isUser && (
                                                <span style={{
                                                    fontSize: '0.58rem',
                                                    padding: '1px 5px',
                                                    borderRadius: '4px',
                                                    background: '#38bdf8',
                                                    color: '#0f172a',
                                                    fontWeight: 900
                                                }}>
                                                    SEN
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '1px' }}>
                                            {item.badge}
                                        </div>
                                    </div>
                                </div>

                                {/* Weekly ROI */}
                                <div style={{ textAlign: 'right', fontSize: '0.88rem', fontWeight: 900, color: item.roi >= 0 ? '#10b981' : '#ef4444' }}>
                                    {item.roi >= 0 ? '+' : ''}{item.roi}%
                                </div>

                                {/* Win Rate */}
                                <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                                    %{item.winRate}
                                </div>

                                {/* Bankroll IQ */}
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 900,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: item.bankrollIQ >= 90 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                        color: item.bankrollIQ >= 90 ? '#10b981' : '#38bdf8',
                                        border: `1px solid ${item.bankrollIQ >= 90 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`
                                    }}>
                                        {item.bankrollIQ} IQ
                                    </span>
                                </div>

                                {/* Status */}
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: item.tier === 'PRO' ? 'rgba(245, 158, 11, 0.2)' : (item.tier === 'VIP' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.06)'),
                                        color: item.tier === 'PRO' ? '#f59e0b' : (item.tier === 'VIP' ? '#c084fc' : '#94a3b8')
                                    }}>
                                        {item.tier}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};
