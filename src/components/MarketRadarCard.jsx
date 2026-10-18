import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, initBackendDiscovery } from '../config.js';

export const MarketRadarCard = ({ lang = 'tr', onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSport, setSelectedSport] = useState('ALL'); // 'ALL' | 'soccer' | 'basketball' | 'tennis' | 'handball'
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    const fetchRadar = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const proxyBase = await initBackendDiscovery() || getApiBaseUrl();
            const url = `${proxyBase}/api/market-radar${forceRefresh ? '?t=' + Date.now() : ''}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                if (json && json.opportunities) {
                    setData(json);
                }
            }
        } catch (err) {
            console.error('[MARKET_RADAR] Fetch error:', err);
        } finally {
            setLoading(false);
            if (forceRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRadar();
        const interval = setInterval(() => {
            fetchRadar();
        }, 60000); // 1 min auto-refresh
        return () => clearInterval(interval);
    }, []);

    const opportunities = data?.opportunities || [];

    // Filter by sport & search
    const filtered = opportunities.filter((item) => {
        if (selectedSport !== 'ALL' && item.sport !== selectedSport) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchText = `${item.home} ${item.away} ${item.league} ${item.sport_name}`.toLowerCase();
            if (!matchText.includes(q)) return false;
        }
        return true;
    });

    const handleCopy = (item) => {
        const text = `🎯 LiveBet Surebet & Değer Radarı\n🏆 ${item.league}\n⏰ ${item.time} | ${item.home} vs ${item.away}\n👉 Tercih: ${item.tip} (Oran: ${item.odds})\n💎 Avantaj: ${item.advantage}\n⚡ Güven: %${item.confidence}`;
        navigator.clipboard?.writeText(text);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div style={{
            background: 'linear-gradient(180deg, #0b101b 0%, #070a12 100%)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '20px',
            boxShadow: '0 0 60px rgba(6, 182, 212, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            color: '#f8fafc',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '88vh'
        }}>
            {/* Header */}
            <div style={{
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.05) 50%, transparent 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(6, 182, 212, 0.15)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem'
                    }}>
                        💎
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                                {lang === 'tr' ? 'Surebet & Piyasa Değer Radarı' : 'Surebet & Value Radar'}
                            </h2>
                            <span style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                borderRadius: '999px',
                                background: '#06b6d4',
                                color: '#000',
                                letterSpacing: '0.5px'
                            }}>
                                4-SPOR CANLI
                            </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                            {lang === 'tr' 
                                ? 'Piyasada oranları çöken, büroların geride kaldığı matematiksel +EV fırsatları' 
                                : 'Institutional smart money drops and lagging market value opportunities'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={() => fetchRadar(true)}
                        disabled={refreshing}
                        style={{
                            padding: '0.5rem 0.9rem',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: refreshing ? '#06b6d4' : '#cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
                        <span>{lang === 'tr' ? 'Yenile' : 'Refresh'}</span>
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#94a3b8',
                                fontSize: '1rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Sport Tabs & Search Bar */}
            <div style={{
                padding: '0.8rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
                    {[
                        { key: 'ALL', label: lang === 'tr' ? 'Tümü' : 'All', icon: '🌐' },
                        { key: 'soccer', label: lang === 'tr' ? 'Futbol' : 'Football', icon: '⚽' },
                        { key: 'basketball', label: lang === 'tr' ? 'Basketbol' : 'Basketball', icon: '🏀' },
                        { key: 'tennis', label: lang === 'tr' ? 'Tenis' : 'Tennis', icon: '🎾' },
                        { key: 'handball', label: lang === 'tr' ? 'Hentbol' : 'Handball', icon: '🤾' },
                    ].map((tab) => {
                        const count = tab.key === 'ALL' 
                            ? opportunities.length 
                            : opportunities.filter(o => o.sport === tab.key).length;
                        const isActive = selectedSport === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setSelectedSport(tab.key)}
                                style={{
                                    padding: '0.45rem 0.85rem',
                                    borderRadius: '10px',
                                    border: isActive ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(8, 145, 178, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                                    color: isActive ? '#06b6d4' : '#94a3b8',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                                <span style={{
                                    padding: '1px 5px',
                                    borderRadius: '999px',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    background: isActive ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                                    color: isActive ? '#000' : '#cbd5e1'
                                }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={lang === 'tr' ? 'Maç veya Lig ara...' : 'Search match or league...'}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '0.45rem 1.8rem 0.45rem 0.75rem',
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            fontSize: '0.8rem',
                            outline: 'none'
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Content List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.2rem 1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '1rem',
                minHeight: '260px'
            }}>
                {loading ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 1rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🔄</div>
                        <div style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
                            {lang === 'tr' ? '4 Spor dalı için canlı oran hareketleri taranıyor...' : 'Scanning 4-sport dropping odds feeds...'}
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 1rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>💎</div>
                        <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: '#e2e8f0' }}>
                            {lang === 'tr' ? 'Seçili Filtrede Fırsat Bulunmuyor' : 'No opportunities in selected filter'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                            {lang === 'tr' 
                                ? 'Sistem sadece matematiksel avantajı %12 üzerinde olan ve 1.35-2.50 tatlı noktasındaki maçları listeler.' 
                                : 'Only +EV opportunities with >12% market drop are surfaced to protect bankroll.'}
                        </p>
                    </div>
                ) : (
                    filtered.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '16px',
                                padding: '1.1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                            }}
                        >
                            {/* League & Time */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', maxWidth: '75%', overflow: 'hidden' }}>
                                        <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.league}>
                                            {item.league}
                                        </span>
                                    </div>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontFamily: 'monospace',
                                        fontWeight: 800,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: 'rgba(6, 182, 212, 0.1)',
                                        border: '1px solid rgba(6, 182, 212, 0.3)',
                                        color: '#38bdf8'
                                    }}>
                                        ⏰ {item.time}
                                    </span>
                                </div>

                                {/* Teams */}
                                <div style={{ margin: '0.4rem 0 0.8rem', fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                                    {item.home} <span style={{ color: '#64748b', fontWeight: 400 }}>vs</span> {item.away}
                                </div>

                                {/* Target Pick Box */}
                                <div style={{
                                    padding: '0.75rem 0.9rem',
                                    borderRadius: '12px',
                                    background: 'rgba(6, 182, 212, 0.08)',
                                    border: '1px solid rgba(6, 182, 212, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                            🎯 Önerilen Tercih
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                                            {item.tip}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '2px' }}>
                                            Mevcut Oran
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                                            {Number(item.odds || 0).toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Advantage Badge */}
                                <div style={{
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: '8px',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    color: '#34d399',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    marginBottom: '0.75rem'
                                }}>
                                    <span>📉</span>
                                    <span>{item.advantage}</span>
                                </div>
                            </div>

                            {/* Footer / Confidence & Copy */}
                            <div style={{
                                paddingTop: '0.6rem',
                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '60px', height: '6px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                                        <div style={{ width: `${item.confidence}%`, height: '100%', background: 'linear-gradient(90deg, #06b6d4, #10b981)', borderRadius: '999px' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e1', fontFamily: 'monospace' }}>
                                        %{item.confidence} Güven
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleCopy(item)}
                                    style={{
                                        padding: '0.35rem 0.7rem',
                                        borderRadius: '8px',
                                        background: copiedId === item.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                        border: copiedId === item.id ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: copiedId === item.id ? '#34d399' : '#94a3b8',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span>{copiedId === item.id ? '✓' : '📋'}</span>
                                    <span>{copiedId === item.id ? 'Kopyalandı' : 'Kopyala'}</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Footer Info */}
            <div style={{
                padding: '0.75rem 1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#64748b'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    <span style={{ color: '#94a3b8' }}>7/24 Otonom Surebet & Değer Motoru Aktif</span>
                </div>
                {data?.last_updated && (
                    <span>Son Tarama: {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
            </div>
        </div>
    );
};
