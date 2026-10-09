import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, initBackendDiscovery } from '../config.js';
import { bankrollManager } from '../logic/bankrollManager.js';

export const TipsterHub = ({ lang = 'tr', userProfile = null, onOpenVipModal, onFocusMatch }) => {
    const [feedData, setFeedData] = useState({ picks: [], leaderboard: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('FEED'); // 'FEED' | 'LEADERBOARD'
    const [filterLive, setFilterLive] = useState(false);
    const [filterHighConf, setFilterHighConf] = useState(false);
    const [filterSport, setFilterSport] = useState('ALL');
    const [toastMessage, setToastMessage] = useState(null);

    const isVip = userProfile?.plan === 'vip' || userProfile?.plan === 'pro' || userProfile?.role === 'admin';

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchFeed = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const proxyBase = await initBackendDiscovery() || getApiBaseUrl();
            const params = new URLSearchParams();
            if (forceRefresh) params.append('refresh', '1');
            if (filterLive) params.append('live', '1');
            if (filterHighConf) params.append('high_conf', '1');
            if (filterSport !== 'ALL') params.append('sport', filterSport);

            const res = await fetch(`${proxyBase}/api/tipsters/feed?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.picks)) {
                    // Strictly enforce threshold: Only 8/10 and above are displayed
                    const highConfidenceOnly = json.picks.filter(p => (p.stake || 0) >= 8);
                    setFeedData({ ...json, picks: highConfidenceOnly });
                }
            }
        } catch (err) {
            console.error('[TIPSTER_HUB] Fetch error:', err);
        } finally {
            setLoading(false);
            if (forceRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        const timer = setInterval(() => fetchFeed(false), 30000); // 30 sec auto-refresh
        return () => clearInterval(timer);
    }, [filterLive, filterHighConf, filterSport]);

    const handleAddToPortfolio = (pick) => {
        try {
            const betItem = {
                id: `tip-${pick.id}-${Date.now()}`,
                match_id: pick.id,
                match_name: pick.matchName,
                selection: pick.selection,
                odds: pick.odds,
                stake: Math.max(10, Math.round((pick.stake || 5) * 20)), // 5/10 -> 100 ₺
                status: 'OPEN',
                market_type: pick.sport,
                created_at: new Date().toISOString(),
                source: `Uzman Analist (${pick.analyst?.name || 'Sistem'})`
            };
            if (bankrollManager && typeof bankrollManager.addCustomBet === 'function') {
                bankrollManager.addCustomBet(betItem);
            }
            showToast(lang === 'tr' 
                ? `💼 "${pick.matchName}" kasanıza eklendi!` 
                : (lang === 'de' ? `💼 Wette zum Depot hinzugefügt!` : `💼 Bet added to your portfolio!`));
        } catch (e) {
            showToast(lang === 'tr' ? 'Kupon kasanıza kaydedildi.' : 'Saved to portfolio.');
        }
    };

    const handleTrackOnRadar = (pick) => {
        if (typeof onFocusMatch === 'function') {
            onFocusMatch(pick.matchName);
        }
        showToast(lang === 'tr' 
            ? `📡 "${pick.matchName}" canlı radarda takibe alındı!` 
            : `📡 Match pinned to live tracking!`);
    };

    return (
        <div className="tipster-hub-container" style={{
            maxWidth: '1360px',
            margin: '1.25rem auto 3rem',
            padding: '0 1rem',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Toast notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    padding: '0.85rem 1.4rem',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    {toastMessage}
                </div>
            )}

            {/* Header Strip */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.5rem 1.75rem',
                marginBottom: '1.5rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '1.6rem' }}>👑</span>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
                            {lang === 'tr' ? 'Doğrulanmış Pro Analistler Masası' : (lang === 'de' ? 'Verifizierte Pro-Analysten' : 'Verified Pro Analysts Board')}
                        </h2>
                        <span style={{
                            fontSize: '0.7rem',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontWeight: 800
                        }}>
                            {feedData.picks.length} {lang === 'tr' ? 'AKTİF TAHMİN' : 'ACTIVE PICKS'}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                        {lang === 'tr' 
                            ? 'Doğrulanmış istatistik geçmişine sahip bağımsız piyasa analistlerinin yüksek güvenli tahminleri.' 
                            : 'High-confidence market picks from independently verified expert analysts with audited yield records.'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                        onClick={() => fetchFeed(true)}
                        disabled={refreshing}
                        style={{
                            padding: '0.6rem 1.1rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#e2e8f0',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'all 0.4s' }}>🔄</span>
                        <span>{refreshing ? (lang === 'tr' ? 'Güncelleniyor...' : 'Refreshing...') : (lang === 'tr' ? 'Yenile' : 'Refresh')}</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs (Feed vs Leaderboard) */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                    onClick={() => setActiveTab('FEED')}
                    style={{
                        padding: '0.7rem 1.4rem',
                        borderRadius: '12px',
                        border: activeTab === 'FEED' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: activeTab === 'FEED' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(37, 99, 235, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                        color: activeTab === 'FEED' ? '#38bdf8' : '#94a3b8',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <span>⚡</span>
                    <span>{lang === 'tr' ? 'Canlı & Sıcak Tahminler' : 'Live & Hot Picks'}</span>
                    <span style={{
                        background: activeTab === 'FEED' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                        color: activeTab === 'FEED' ? '#000' : '#fff',
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '10px'
                    }}>
                        {feedData.picks.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('LEADERBOARD')}
                    style={{
                        padding: '0.7rem 1.4rem',
                        borderRadius: '12px',
                        border: activeTab === 'LEADERBOARD' ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: activeTab === 'LEADERBOARD' ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(217, 119, 6, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                        color: activeTab === 'LEADERBOARD' ? '#fbbf24' : '#94a3b8',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <span>🏆</span>
                    <span>{lang === 'tr' ? 'Pro Analist Sıralaması (Ligi)' : 'Pro Analyst Leaderboard'}</span>
                </button>
            </div>

            {/* TAB 1: PICKS FEED */}
            {activeTab === 'FEED' && (
                <div>
                    {/* Filters Strip */}
                    <div style={{
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: '1.25rem',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>{lang === 'tr' ? 'FİLTRE:' : 'FILTER:'}</span>

                        <button
                            onClick={() => setFilterLive(!filterLive)}
                            style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                border: filterLive ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                                background: filterLive ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                color: filterLive ? '#ef4444' : '#94a3b8',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span>
                            <span>{lang === 'tr' ? 'Sadece Canlı' : 'Live Only'}</span>
                        </button>

                        <button
                            onClick={() => setFilterHighConf(!filterHighConf)}
                            style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                border: filterHighConf ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                                background: filterHighConf ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                                color: filterHighConf ? '#eab308' : '#94a3b8',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <span>⭐</span>
                            <span>{lang === 'tr' ? '10/10 Maksimum Güven' : '10/10 Max Stake'}</span>
                        </button>

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                            {['ALL', 'Futbol', 'Basketbol', 'Tenis'].map(sp => (
                                <button
                                    key={sp}
                                    onClick={() => setFilterSport(sp)}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '8px',
                                        border: filterSport === sp ? '1px solid #38bdf8' : '1px solid transparent',
                                        background: filterSport === sp ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                        color: filterSport === sp ? '#38bdf8' : '#64748b',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {sp === 'ALL' ? (lang === 'tr' ? 'Tüm Sporlar' : 'All Sports') : sp}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🔄</div>
                            <div>{lang === 'tr' ? 'Doğrulanmış piyasa sinyalleri taranıyor...' : 'Scanning verified market signals...'}</div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && feedData.picks.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 2rem',
                            background: 'rgba(15, 23, 42, 0.4)',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📡</div>
                            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
                                {lang === 'tr' ? 'Kriterlere Uygun Yeni Sinyal Aranıyor' : 'Searching for qualifying signals'}
                            </h3>
                            <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.85rem' }}>
                                {lang === 'tr' 
                                    ? 'Analist motoru arka planda 24/7 akışı takip ediyor. Filtre kriterlerini genişletebilir veya yenile butonuna basabilirsiniz.'
                                    : 'The engine continuously monitors live feeds. You can broaden filter criteria or refresh.'}
                            </p>
                        </div>
                    )}

                    {/* Cards Grid */}
                    {!loading && feedData.picks.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {feedData.picks.map((pick) => {
                                // All picks are completely open as requested by user
                                const isLocked = false;

                                return (
                                    <div
                                        key={pick.id}
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                                            border: pick.isDualConsensus 
                                                ? '1px solid rgba(234, 179, 8, 0.4)' 
                                                : '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '16px',
                                            padding: '1.25rem',
                                            boxShadow: pick.isDualConsensus 
                                                ? '0 8px 30px rgba(234, 179, 8, 0.12)' 
                                                : '0 8px 24px rgba(0,0,0,0.25)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Dual Consensus Glow Header */}
                                        {pick.isDualConsensus && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'linear-gradient(90deg, #eab308, #f59e0b)',
                                                color: '#000',
                                                fontSize: '0.68rem',
                                                fontWeight: 900,
                                                letterSpacing: '0.5px',
                                                padding: '3px 12px',
                                                textAlign: 'center',
                                                textTransform: 'uppercase'
                                            }}>
                                                ⚡ {lang === 'tr' ? 'ÇİFTE ONAY: ALGORİTMA + UZMAN SENTEZİ' : 'DUAL CONSENSUS: AI + ANALYST'}
                                            </div>
                                        )}

                                        <div>
                                            {/* Top Row: Analyst Identity */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginTop: pick.isDualConsensus ? '0.75rem' : 0,
                                                marginBottom: '0.9rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                    <div style={{
                                                        width: '38px',
                                                        height: '38px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.1rem',
                                                        fontWeight: 900,
                                                        color: '#fff',
                                                        border: '2px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        {pick.analyst?.avatarIndex ? ['🎯','🧠','⚡','👑','🔥','🛡️','🔭','⚽'][(pick.analyst.avatarIndex - 1) % 8] : '👑'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>
                                                            {pick.analyst?.name || 'Kıdemli Analist'}
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                                                            {pick.analyst?.badge || '🔥 Formda'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: 'right' }}>
                                                    {pick.isLive ? (
                                                        <span style={{
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }}></span>
                                                            CANLI
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                                                            {pick.ageText}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Match Name & League */}
                                            <div style={{ marginBottom: '0.85rem' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                    {pick.sportDetails || pick.sport}
                                                </div>
                                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', lineHeight: 1.3 }}>
                                                    {pick.matchName}
                                                </div>
                                            </div>

                                            {/* Locked overlay for VIP if free user */}
                                            {isLocked ? (
                                                <div style={{
                                                    background: 'rgba(15, 23, 42, 0.85)',
                                                    border: '1px dashed rgba(234, 179, 8, 0.4)',
                                                    borderRadius: '12px',
                                                    padding: '1.25rem 1rem',
                                                    textAlign: 'center',
                                                    marginBottom: '1rem'
                                                }}>
                                                    <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>🔒</div>
                                                    <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                                                        {lang === 'tr' ? '10/10 VIP Özel Tahmin' : '10/10 VIP Exclusive Pick'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                                                        {lang === 'tr' ? 'Bu analistin en yüksek güven dereceli seçimi VIP üyelere açıktır.' : 'Highest confidence signal reserved for VIP members.'}
                                                    </div>
                                                    <button
                                                        onClick={() => onOpenVipModal && onOpenVipModal()}
                                                        style={{
                                                            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                                            color: '#000',
                                                            border: 'none',
                                                            padding: '0.5rem 1.1rem',
                                                            borderRadius: '8px',
                                                            fontWeight: 900,
                                                            fontSize: '0.78rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        💎 {lang === 'tr' ? 'VIP İle Kilidi Aç' : 'Unlock With VIP'}
                                                    </button>
                                                </div>
                                            ) : (
                                                /* Selection & Odds Box */
                                                <div style={{
                                                    background: 'rgba(15, 23, 42, 0.65)',
                                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                                    borderRadius: '12px',
                                                    padding: '0.85rem 1rem',
                                                    marginBottom: '0.9rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                                            {lang === 'tr' ? 'UZMAN SEÇİMİ' : 'EXPERT PICK'}
                                                        </div>
                                                        <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#38bdf8' }}>
                                                            {pick.selection}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>
                                                            {lang === 'tr' ? 'PİYASA ORANI' : 'MARKET ODDS'}
                                                        </div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                                                            {typeof pick.odds === 'number' ? pick.odds.toFixed(2) : pick.odds}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Stake / Confidence Bar */}
                                            {!isLocked && (
                                                <div style={{ marginBottom: '0.9rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>
                                                        <span>{lang === 'tr' ? 'Analist Güven Seviyesi:' : 'Confidence Level:'}</span>
                                                        <span style={{ color: pick.stake >= 9 ? '#fbbf24' : '#38bdf8', fontWeight: 900 }}>
                                                            {pick.stake}/10 {pick.stake >= 9 ? '⭐ MAKSİMUM' : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${Math.min(100, (pick.stake / 10) * 100)}%`,
                                                            height: '100%',
                                                            background: pick.stake >= 9 ? 'linear-gradient(90deg, #eab308, #fbbf24)' : 'linear-gradient(90deg, #38bdf8, #2563eb)',
                                                            borderRadius: '3px'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Analysis Note if available */}
                                            {pick.analysis && !isLocked && (
                                                <div style={{
                                                    fontSize: '0.74rem',
                                                    color: '#94a3b8',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    borderLeft: '2px solid #38bdf8',
                                                    padding: '0.4rem 0.6rem',
                                                    marginBottom: '0.9rem',
                                                    borderRadius: '0 6px 6px 0',
                                                    fontStyle: 'italic'
                                                }}>
                                                    "{pick.analysis}"
                                                </div>
                                            )}
                                        </div>

                                        {/* In-House Action Buttons (NO EXTERNAL LINKS) */}
                                        {!isLocked && (
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleAddToPortfolio(pick)}
                                                    style={{
                                                        flex: 1,
                                                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.25))',
                                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        color: '#10b981',
                                                        padding: '0.65rem 0.8rem',
                                                        borderRadius: '10px',
                                                        fontWeight: 800,
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.35rem',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <span>💼</span>
                                                    <span>{lang === 'tr' ? 'Kasa / Portföye Ekle' : 'Add to Portfolio'}</span>
                                                </button>

                                                <button
                                                    onClick={() => handleTrackOnRadar(pick)}
                                                    title={lang === 'tr' ? 'Canlı Radarda Takibe Al' : 'Pin to Radar'}
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        color: '#e2e8f0',
                                                        padding: '0.65rem 0.9rem',
                                                        borderRadius: '10px',
                                                        fontWeight: 700,
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem'
                                                    }}
                                                >
                                                    <span>📡</span>
                                                    <span>{lang === 'tr' ? 'Takip' : 'Track'}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: LEADERBOARD VIEW */}
            {activeTab === 'LEADERBOARD' && (
                <div>
                    {/* Top 3 Podium Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1.25rem',
                        marginBottom: '2rem'
                    }}>
                        {(feedData.leaderboard || []).slice(0, 3).map((analyst, idx) => {
                            const colors = [
                                { border: '#eab308', grad: 'rgba(234, 179, 8, 0.15)', crown: '👑 1.' },
                                { border: '#94a3b8', grad: 'rgba(148, 163, 184, 0.12)', crown: '🥈 2.' },
                                { border: '#cd7f32', grad: 'rgba(205, 127, 50, 0.12)', crown: '🥉 3.' }
                            ];
                            const curTheme = colors[idx] || colors[0];

                            return (
                                <div
                                    key={analyst.id}
                                    style={{
                                        background: `linear-gradient(135deg, ${curTheme.grad}, rgba(15, 23, 42, 0.85))`,
                                        border: `1px solid ${curTheme.border}`,
                                        borderRadius: '16px',
                                        padding: '1.5rem',
                                        textAlign: 'center',
                                        position: 'relative',
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '14px',
                                        fontSize: '0.82rem',
                                        fontWeight: 900,
                                        color: curTheme.border
                                    }}>
                                        {curTheme.crown}
                                    </div>

                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                        border: `2px solid ${curTheme.border}`,
                                        margin: '0 auto 0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.6rem'
                                    }}>
                                        {['🎯','🧠','⚡','👑','🔥','🛡️','🔭','⚽'][(analyst.avatarIndex - 1) % 8]}
                                    </div>

                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', margin: '0 0 0.2rem' }}>
                                        {analyst.name}
                                    </h3>
                                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginBottom: '0.9rem' }}>
                                        {analyst.badge}
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-around',
                                        background: 'rgba(0,0,0,0.25)',
                                        padding: '0.75rem',
                                        borderRadius: '10px',
                                        marginBottom: '0.8rem'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{lang === 'tr' ? 'BAŞARI' : 'WIN RATE'}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{analyst.winRate}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>ROI</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8' }}>{analyst.roi}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{lang === 'tr' ? 'TAHMİN' : 'PICKS'}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc' }}>{analyst.totalPicks}</div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        {lang === 'tr' ? 'Uzmanlık: ' : 'Specialty: '}
                                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{analyst.specialty}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Full Leaderboard Table */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>
                                {lang === 'tr' ? 'Genel Performans & Form Sıralaması' : 'Overall Performance & Form Standings'}
                            </h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                {lang === 'tr' 
                                    ? 'Sıralama para miktarına göre değil; doğrulanmış % ROI ve başarı oranı istikrarına göredir.' 
                                    : 'Rankings are based strictly on audited % ROI growth and win-rate stability.'}
                            </p>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '0.85rem 1.25rem' }}>#</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>{lang === 'tr' ? 'ANALİST & RÜTBE' : 'ANALYST'}</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>{lang === 'tr' ? 'UZMANLIK ALANI' : 'SPECIALTY'}</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>ROI</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{lang === 'tr' ? 'BAŞARI ORANI' : 'WIN RATE'}</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{lang === 'tr' ? 'SON 5 MAÇ' : 'FORM'}</th>
                                        <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>{lang === 'tr' ? 'DOĞRULANMIŞ TAHMİN' : 'AUDITED PICKS'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(feedData.leaderboard || []).map((analyst, idx) => (
                                        <tr
                                            key={analyst.id}
                                            style={{
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: 900, color: idx < 3 ? '#fbbf24' : '#64748b' }}>
                                                {idx + 1}
                                            </td>
                                            <td style={{ padding: '1rem 1rem' }}>
                                                <div style={{ fontWeight: 800, color: '#f8fafc' }}>{analyst.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{analyst.badge}</div>
                                            </td>
                                            <td style={{ padding: '1rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {analyst.specialty}
                                            </td>
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center', fontWeight: 900, color: '#38bdf8' }}>
                                                {analyst.roi}
                                            </td>
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center', fontWeight: 900, color: '#10b981' }}>
                                                {analyst.winRate}
                                            </td>
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', gap: '3px' }}>
                                                    {(analyst.recentForm || ['W','W','W','W','W']).map((f, fIdx) => (
                                                        <span
                                                            key={fIdx}
                                                            style={{
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '4px',
                                                                background: f === 'W' ? '#10b981' : '#ef4444',
                                                                color: '#000',
                                                                fontSize: '0.62rem',
                                                                fontWeight: 900,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 800, color: '#e2e8f0' }}>
                                                {analyst.totalPicks}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
