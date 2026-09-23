import React, { useState, useEffect } from 'react';

export const SharpPicksCard = ({ lang = 'tr', t = {}, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('today'); // 'today' | 'yesterday'
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'WON' | 'PENDING'

    useEffect(() => {
        let isMounted = true;
        const fetchPicks = async () => {
            try {
                const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                const proxyBase = import.meta.env?.VITE_API_BASE_URL || (isLocal ? 'http://localhost:3001' : 'https://live-bet-mentor.onrender.com');
                const res = await fetch(`${proxyBase}/api/sharp-picks`);
                if (res.ok) {
                    const json = await res.json();
                    if (isMounted) setData(json);
                }
            } catch (err) {
                console.error('[SHARP_PICKS] Fetch error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchPicks();
        const interval = setInterval(fetchPicks, 60000); // 1 min auto-refresh
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const formatTip = (tipRaw) => {
        const raw = (tipRaw || '').toUpperCase().trim();
        if (lang === 'tr') {
            if (raw === '1X') return '1X (Ev Sahibi Yenilmez)';
            if (raw === 'X2') return 'X2 (Deplasman Yenilmez)';
            if (raw === '1') return 'MS 1 (Ev Sahibi Kazanır)';
            if (raw === '2') return 'MS 2 (Deplasman Kazanır)';
            if (raw === 'X') return 'MS X (Beraberlik)';
            if (raw === 'HT 1') return 'İlk Yarı 1 (Ev Sahibi)';
            if (raw === 'HT 2') return 'İlk Yarı 2 (Deplasman)';
            if (raw === 'OVER 1.5') return '1.5 Gol Üstü';
            if (raw === 'OVER 2.5') return '2.5 Gol Üstü';
            if (raw === 'UNDER 2.5') return '2.5 Gol Altı';
        } else if (lang === 'de') {
            if (raw === '1X') return '1X (Doppelte Chance: Heim/Remis)';
            if (raw === 'X2') return 'X2 (Doppelte Chance: Remis/Auswärts)';
            if (raw === '1') return 'Heimsieg (1)';
            if (raw === '2') return 'Auswärtssieg (2)';
            if (raw === 'X') return 'Unentschieden (X)';
            if (raw === 'HT 1') return 'Halbzeit 1 (Heim)';
            if (raw === 'HT 2') return 'Halbzeit 2 (Auswärts)';
        } else {
            if (raw === '1X') return '1X (Double Chance: Home/Draw)';
            if (raw === 'X2') return 'X2 (Double Chance: Draw/Away)';
            if (raw === '1') return 'Home Win (1)';
            if (raw === '2') return 'Away Win (2)';
            if (raw === 'X') return 'Draw (X)';
            if (raw === 'HT 1') return 'Half-Time 1 (Home)';
            if (raw === 'HT 2') return 'Half-Time 2 (Away)';
        }
        return raw;
    };

    const formatStatus = (status) => {
        if (status === 'WON') {
            return {
                label: lang === 'tr' ? 'KAZANDI' : (lang === 'de' ? 'GEWONNEN' : 'WON'),
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.15)',
                border: 'rgba(16, 185, 129, 0.4)',
                icon: '🟢'
            };
        }
        if (status === 'LOST') {
            return {
                label: lang === 'tr' ? 'KAYBETTİ' : (lang === 'de' ? 'VERLOREN' : 'LOST'),
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.15)',
                border: 'rgba(239, 68, 68, 0.4)',
                icon: '🔴'
            };
        }
        return {
            label: lang === 'tr' ? 'BAŞLAMADI' : (lang === 'de' ? 'AUSSTEHEND' : 'UPCOMING'),
            color: '#94a3b8',
            bg: 'rgba(148, 163, 184, 0.1)',
            border: 'rgba(148, 163, 184, 0.25)',
            icon: '⏳'
        };
    };

    const todayPicks = data?.today_picks || [];
    const yesterdaySummary = data?.yesterday_summary || {};
    const yesterdayPicks = yesterdaySummary?.picks || [];

    const activeList = activeTab === 'today' ? todayPicks : yesterdayPicks;
    const filteredList = activeList.filter(item => {
        if (filterStatus === 'WON') return item.status === 'WON';
        if (filterStatus === 'PENDING') return item.status === 'PENDING';
        return true;
    });

    const wonTodayCount = todayPicks.filter(m => m.status === 'WON').length;
    const pendingTodayCount = todayPicks.filter(m => m.status === 'PENDING').length;

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '20px',
            color: '#f8fafc',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.1)',
            backdropFilter: 'blur(16px)',
            maxWidth: '920px',
            margin: '0 auto',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                            color: '#0f172a',
                            padding: '3px 8px',
                            borderRadius: '6px'
                        }}>
                            {t.sharp_model_tag || 'Mentor Alpha Quant'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {data?.last_updated ? new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                    </div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>
                        {t.sharp_picks_title || 'Günün Keskin Seçimleri'}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                        {t.sharp_picks_subtitle || 'Kasa katlamaya uygun, riski en düşük sağlam maç tercihleri.'}
                    </p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#94a3b8',
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            transition: 'all 0.15s'
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Yesterday Verified Trophy Banner */}
            {yesterdaySummary?.total > 0 && (
                <div style={{
                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🏆</span>
                        <div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', textTransform: 'uppercase' }}>
                                {t.sharp_picks_yesterday_success || 'Dünkü Başarı:'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff', marginLeft: '6px' }}>
                                {yesterdaySummary.total} {lang === 'tr' ? 'Maçın' : 'Picks,'} <span style={{ color: '#10b981' }}>{yesterdaySummary.won} {t.sharp_picks_matches_won || "Tuttu"}</span>
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <span style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700'
                        }}>
                            %{yesterdaySummary.win_rate} {t.sharp_picks_win_rate || "Başarı"}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {t.sharp_picks_avg_odds || "Ort. Oran"}: <strong style={{ color: '#f8fafc' }}>{yesterdaySummary.avg_odds}</strong>
                        </span>
                    </div>
                </div>
            )}

            {/* Sub-Tabs (Today vs Yesterday) & Filter Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '12px'
            }}>
                {/* Mode Tabs */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setActiveTab('today')}
                        style={{
                            background: activeTab === 'today' ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === 'today' ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        {t.sharp_picks_tab_today || "Günün Seçimleri"} ({todayPicks.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('yesterday')}
                        style={{
                            background: activeTab === 'yesterday' ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === 'yesterday' ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        {t.sharp_picks_tab_yesterday || "Dünün Sonuçları"} ({yesterdayPicks.length})
                    </button>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        style={{
                            background: filterStatus === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                            color: filterStatus === 'ALL' ? '#38bdf8' : '#64748b',
                            border: filterStatus === 'ALL' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {t.sharp_filter_all || "Tümü"}
                    </button>
                    <button
                        onClick={() => setFilterStatus('WON')}
                        style={{
                            background: filterStatus === 'WON' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            color: filterStatus === 'WON' ? '#10b981' : '#64748b',
                            border: filterStatus === 'WON' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        🟢 {t.sharp_filter_won || "Kazananlar"} ({activeList.filter(m => m.status === 'WON').length})
                    </button>
                    {activeTab === 'today' && (
                        <button
                            onClick={() => setFilterStatus('PENDING')}
                            style={{
                                background: filterStatus === 'PENDING' ? 'rgba(148, 163, 184, 0.2)' : 'transparent',
                                color: filterStatus === 'PENDING' ? '#cbd5e1' : '#64748b',
                                border: filterStatus === 'PENDING' ? '1px solid rgba(148, 163, 184, 0.4)' : '1px solid transparent',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            ⏳ {t.sharp_filter_pending || "Bekleyenler"} ({pendingTodayCount})
                        </button>
                    )}
                </div>
            </div>

            {/* Matches List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '14px' }}>
                    Seçimler ve sonuçlar taranıyor...
                </div>
            ) : filteredList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '14px' }}>
                    Bu filtreye uygun maç bulunamadı.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredList.map((match, idx) => {
                        const statusObj = formatStatus(match.status);
                        const tipDisplay = formatTip(match.tip);

                        return (
                            <div
                                key={match.id || idx}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${match.status === 'WON' ? 'rgba(16, 185, 129, 0.3)' : (match.status === 'LOST' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)')}`,
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    transition: 'transform 0.15s, border-color 0.15s'
                                }}
                            >
                                {/* Top Line: League & Time */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
                                        {match.league}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {match.time && (
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                ⏰ {match.time}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            color: statusObj.color,
                                            background: statusObj.bg,
                                            border: `1px solid ${statusObj.border}`,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {statusObj.icon} {statusObj.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Middle Line: Teams & Score */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                                        <span>{match.home}</span>
                                        <span style={{ color: '#64748b', margin: '0 8px', fontWeight: '400' }}>vs</span>
                                        <span>{match.away}</span>
                                    </div>
                                    {match.score && match.score !== '-' && (
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '800',
                                            color: match.status === 'WON' ? '#10b981' : (match.status === 'LOST' ? '#ef4444' : '#f8fafc'),
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255, 255, 255, 0.05)'
                                        }}>
                                            {match.score}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Line: Tip Pill, Odds & Confidence Badge */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                    paddingTop: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)',
                                            border: '1px solid rgba(56, 189, 248, 0.4)',
                                            color: '#e0f2fe',
                                            fontSize: '13px',
                                            fontWeight: '800',
                                            padding: '4px 10px',
                                            borderRadius: '6px'
                                        }}>
                                            🎯 {tipDisplay}
                                        </span>
                                        <span style={{
                                            background: 'rgba(250, 204, 21, 0.15)',
                                            border: '1px solid rgba(250, 204, 21, 0.35)',
                                            color: '#facc15',
                                            fontSize: '13px',
                                            fontWeight: '800',
                                            padding: '4px 8px',
                                            borderRadius: '6px'
                                        }}>
                                            {match.odds ? match.odds.toFixed(2) : '1.30'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {t.sharp_confidence || "Model Güveni"}: <strong style={{ color: '#38bdf8' }}>%{match.confidence || 85}</strong>
                                        </span>
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            color: '#10b981',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                        }}>
                                            🛡️ {t.sharp_rollover_suitable || "Kasa Katlama"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SharpPicksCard;
