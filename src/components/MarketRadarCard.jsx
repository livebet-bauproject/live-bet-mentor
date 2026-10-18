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
        const text = `🎯 LiveBet Akıllı Para Radarı\n🏆 ${item.league}\n⏰ ${item.time} | ${item.home} vs ${item.away}\n👉 Tercih: ${item.tip} (Oran: ${item.odds})\n💎 Avantaj: ${item.advantage}\n⚡ Güven: %${item.confidence}`;
        navigator.clipboard?.writeText(text);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b101b] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xl shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                            📉
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-white tracking-wide">
                                    {lang === 'tr' ? 'Surebet & Piyasa Değer Radarı' : 'Surebet & Value Radar'}
                                </h2>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    4-Spor Canlı
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {lang === 'tr' 
                                    ? 'Global piyasada oranları çöken, büroların geride kaldığı Surebet & Değerli fırsatlar' 
                                    : 'Institutional smart money drops and lagging market value opportunities'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchRadar(true)}
                            disabled={refreshing}
                            className={`p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 transition-all border border-gray-700/50 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
                            title={lang === 'tr' ? 'Yenile' : 'Refresh'}
                        >
                            🔄
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-gray-800/60 hover:bg-red-500/20 hover:text-red-400 text-gray-400 transition-all border border-gray-700/50"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Filters & Sports Tabs */}
                <div className="px-5 py-3 border-b border-gray-800/60 bg-gray-900/40 flex flex-wrap items-center justify-between gap-3">
                    {/* Sport Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                            : 'bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-black/20 text-black font-bold' : 'bg-gray-700 text-gray-300'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-56">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={lang === 'tr' ? 'Takım veya Lig ara...' : 'Search match or league...'}
                            className="w-full px-3 py-1.5 bg-gray-950/80 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin scrollbar-thumb-gray-800">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-sm text-gray-400">Piyasa oran hareketleri taranıyor...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="text-4xl mb-3">🎯</div>
                            <h3 className="text-base font-semibold text-gray-200 mb-1">
                                {lang === 'tr' ? 'Seçili Filtrede Fırsat Bulunmuyor' : 'No opportunities in selected filter'}
                            </h3>
                            <p className="text-xs text-gray-400 max-w-md">
                                {lang === 'tr' 
                                    ? 'Sistem sadece matematiksel avantajı %12 üzerinde olan ve tatlı nokta oranlarındaki maçları listeler.' 
                                    : 'Only +EV opportunities with >12% market drop are surfaced to protect bankroll.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative flex flex-col justify-between p-4 rounded-xl bg-gradient-to-b from-gray-900/90 to-gray-950/90 border border-gray-800/90 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.12)] transition-all"
                                >
                                    {/* Top League & Time */}
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                <span className="text-base">{item.icon}</span>
                                                <span className="text-xs font-semibold text-gray-300 truncate" title={item.league}>
                                                    {item.league}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-gray-800/80 text-cyan-300 border border-gray-700/60 whitespace-nowrap">
                                                <span>⏰</span>
                                                <span>{item.time}</span>
                                            </div>
                                        </div>

                                        {/* Match Name */}
                                        <div className="mb-3">
                                            <h4 className="text-sm font-bold text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                                                {item.home} <span className="text-gray-500 font-normal">vs</span> {item.away}
                                            </h4>
                                        </div>

                                        {/* Target Pick Card */}
                                        <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 mb-3 flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-0.5">
                                                    🎯 Önerilen Tercih
                                                </div>
                                                <div className="text-xs font-bold text-white">
                                                    {item.tip}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-400 mb-0.5">Mevcut Oran</div>
                                                <div className="text-base font-extrabold text-cyan-300 font-mono">
                                                    {item.odds?.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Advantage Badge */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                                                <span>📉</span>
                                                <span className="truncate">{item.advantage}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer / Confidence & Action */}
                                    <div className="pt-2.5 border-t border-gray-800/60 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                                                    style={{ width: `${item.confidence}%` }}
                                                />
                                            </div>
                                            <span className="text-[11px] font-bold text-gray-300 font-mono">
                                                %{item.confidence} Güven
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleCopy(item)}
                                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60 transition-all flex items-center gap-1"
                                        >
                                            {copiedId === item.id ? (
                                                <>
                                                    <span className="text-emerald-400">✓</span>
                                                    <span className="text-emerald-400">Kopyalandı</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>📋</span>
                                                    <span>Kopyala</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info Banner */}
                <div className="px-5 py-2.5 bg-gray-950/90 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>7/24 Otonom Piyasa Tarayıcısı Aktif</span>
                    </div>
                    <div>
                        {data?.last_updated && (
                            <span>Son Güncelleme: {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
