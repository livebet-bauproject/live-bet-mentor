import React, { useState, useEffect, useCallback } from 'react';

export function TradingDesk({ lang = 'tr' }) {
    const [opportunities, setOpportunities] = useState([]);
    const [quarantined, setQuarantined] = useState([]);
    const [deskSummary, setDeskSummary] = useState({
        totalScanned: 0,
        alphaCount: 0,
        alevCount: 0,
        valueCount: 0,
        deadMatchShieldCount: 0,
        avgEV: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Filters
    const [minEV, setMinEV] = useState(5.0);
    const [minConfidence, setMinConfidence] = useState(65);
    const [minMinute, setMinMinute] = useState(15);
    const [maxMinute, setMaxMinute] = useState(82);
    const [deadMatchShield, setDeadMatchShield] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('ALL'); // 'ALL', 'NEXT_GOAL', 'OVER_UNDER', 'BTTS', '1X2'

    // Gemini Integration State
    const [geminiStatus, setGeminiStatus] = useState({ hasKey: false, keyPrefix: null });
    const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [keyTesting, setKeyTesting] = useState(false);
    const [keyTestResult, setKeyTestResult] = useState(null);

    // Gemini Briefing State
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [briefingData, setBriefingData] = useState(null);
    const [copiedBriefing, setCopiedBriefing] = useState(false);

    // Bet Slip / Ticket Builder State
    const [selectedSlipIds, setSelectedSlipIds] = useState([]);
    const [calculatedSlip, setCalculatedSlip] = useState(null);
    const [bankrollAmount, setBankrollAmount] = useState(5000); // Default 5,000 TL/USD bankroll
    const [copiedSlip, setCopiedSlip] = useState(false);

    const getProxyBase = () => (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3001'
        : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

    const getAdminHeaders = () => {
        let token = '';
        try {
            const adminStored = localStorage.getItem('lbm_admin_session');
            if (adminStored) {
                const parsed = JSON.parse(adminStored);
                token = parsed.token || parsed.access_token || '';
            }
            if (!token) {
                const memberStored = localStorage.getItem('lbm_member_session');
                if (memberStored) {
                    const parsed = JSON.parse(memberStored);
                    token = parsed.token || parsed.access_token || '';
                }
            }
        } catch (e) {}

        const headers = {
            'Content-Type': 'application/json',
            'x-admin-sender': 'admin@livebetmentor.com'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['x-admin-token'] = token;
        }
        return headers;
    };

    // Load desk config & Gemini status
    const fetchDeskConfig = useCallback(async () => {
        try {
            const base = getProxyBase();
            const res = await fetch(`${base}/api/admin/trading-desk/config`, {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                if (data.geminiStatus) setGeminiStatus(data.geminiStatus);
                if (data.config) {
                    if (data.config.minEV !== undefined) setMinEV(data.config.minEV);
                    if (data.config.minConfidence !== undefined) setMinConfidence(data.config.minConfidence);
                }
            }
        } catch (e) {
            console.error('[TRADING_DESK] Config fetch error:', e);
        }
    }, []);

    // Fetch opportunities from Quant Engine
    const fetchOpportunities = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const base = getProxyBase();
            const query = new URLSearchParams({
                minEV: minEV.toString(),
                minConfidence: minConfidence.toString(),
                minMinute: minMinute.toString(),
                maxMinute: maxMinute.toString(),
                deadMatchShield: deadMatchShield.toString()
            });

            const res = await fetch(`${base}/api/admin/trading-desk/opportunities?${query.toString()}`, {
                headers: getAdminHeaders()
            });

            const data = await res.json();
            if (data.success) {
                setOpportunities(data.filteredOpportunities || []);
                setQuarantined(data.quarantinedMatches || []);
                if (data.deskSummary) setDeskSummary(data.deskSummary);
                setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
            } else {
                setError(data.error || 'Veri yüklenemedi.');
            }
        } catch (err) {
            setError(`Sunucu bağlantı hatası: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [minEV, minConfidence, minMinute, maxMinute, deadMatchShield]);

    useEffect(() => {
        fetchDeskConfig();
        fetchOpportunities();

        // 30s auto-refresh pulse
        const interval = setInterval(fetchOpportunities, 30000);
        return () => clearInterval(interval);
    }, [fetchDeskConfig, fetchOpportunities]);

    // Recalculate slip when selected opportunities change
    useEffect(() => {
        if (selectedSlipIds.length === 0) {
            setCalculatedSlip(null);
            return;
        }

        const selectedOpps = opportunities.filter(o => selectedSlipIds.includes(o.oppId));
        if (selectedOpps.length === 0) return;

        let combinedOdds = 1.0;
        let combinedTrueProb = 1.0;

        selectedOpps.forEach(o => {
            combinedOdds *= o.marketOdds;
            combinedTrueProb *= (o.trueProb / 100);
        });

        combinedOdds = Math.round(combinedOdds * 100) / 100;
        const compositeProb = Math.round(combinedTrueProb * 100);
        const compositeEV = Math.round(((combinedTrueProb * combinedOdds) - 1) * 1000) / 10;
        const kellyStakePercent = Math.max(0.8, Math.min(3.5, Math.round((compositeEV * 0.12) * 10) / 10));

        setCalculatedSlip({
            items: selectedOpps,
            combinedOdds,
            compositeProb,
            compositeEV,
            kellyStakePercent
        });
    }, [selectedSlipIds, opportunities]);

    // Test Gemini Key
    const handleTestKey = async () => {
        setKeyTesting(true);
        setKeyTestResult(null);
        try {
            const base = getProxyBase();
            const res = await fetch(`${base}/api/admin/trading-desk/test-gemini-key`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ apiKey: geminiApiKeyInput })
            });
            const data = await res.json();
            setKeyTestResult(data);

            if (data.connected) {
                // Also save it automatically on success
                await fetch(`${base}/api/admin/trading-desk/save-gemini-key`, {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ apiKey: geminiApiKeyInput })
                });
                setGeminiStatus({
                    hasKey: true,
                    keyPrefix: data.keyPrefix
                });
            }
        } catch (e) {
            setKeyTestResult({ connected: false, error: e.message });
        } finally {
            setKeyTesting(false);
        }
    };

    // Trigger Gemini Committee Briefing
    const handleGenerateBriefing = async () => {
        setBriefingLoading(true);
        try {
            const base = getProxyBase();
            const res = await fetch(`${base}/api/admin/trading-desk/gemini-briefing`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({
                    opportunities,
                    deskSummary
                })
            });
            const data = await res.json();
            if (data.success && data.briefing) {
                setBriefingData(data.briefing);
            } else {
                alert(`Brifing hatası: ${data.error || 'Bilinmeyen hata'}`);
            }
        } catch (e) {
            alert(`Bağlantı hatası: ${e.message}`);
        } finally {
            setBriefingLoading(false);
        }
    };

    const toggleSlipSelection = (oppId) => {
        setSelectedSlipIds(prev =>
            prev.includes(oppId) ? prev.filter(id => id !== oppId) : [...prev, oppId]
        );
    };

    const copyToClipboard = (text, type = 'briefing') => {
        navigator.clipboard.writeText(text);
        if (type === 'briefing') {
            setCopiedBriefing(true);
            setTimeout(() => setCopiedBriefing(false), 2500);
        } else {
            setCopiedSlip(true);
            setTimeout(() => setCopiedSlip(false), 2500);
        }
    };

    const filteredOpps = opportunities.filter(o => {
        if (selectedCategory === 'ALL') return true;
        return o.category === selectedCategory;
    });

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
            {/* Top Institutional Header */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <span style={{ fontSize: '1.8rem' }}>🏦</span>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
                                    {lang === 'tr' ? 'BAHİS OFİSİ & KUANT TRADING DESK' : 'SPORTSBOOK QUANT TRADING DESK'}
                                </h2>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                    {lang === 'tr'
                                        ? '5 Aşamalı Kurumsal Filtreleme: Dixon-Coles, xG Momentum, +EV Arbitraj & Kelly Kasa Yönetimi'
                                        : '5-Stage Institutional Filters: Dixon-Coles, xG Momentum, +EV Arbitrage & Kelly Bankroll'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                        {/* Gemini Key Status Button */}
                        <button
                            onClick={() => setShowKeyModal(!showKeyModal)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.55rem 1rem',
                                borderRadius: '10px',
                                background: geminiStatus.hasKey ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                border: `1px solid ${geminiStatus.hasKey ? '#10b981' : '#fbbf24'}`,
                                color: geminiStatus.hasKey ? '#10b981' : '#fbbf24',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            <span>🤖</span>
                            <span>
                                {geminiStatus.hasKey
                                    ? `Gemini API: Aktif (${geminiStatus.keyPrefix})`
                                    : 'Gemini API: Beklemede (Bağla)'}
                            </span>
                            <span style={{ opacity: 0.7 }}>⚙️</span>
                        </button>

                        {/* Gemini Strategic Briefing Button */}
                        <button
                            onClick={handleGenerateBriefing}
                            disabled={briefingLoading || opportunities.length === 0}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.55rem 1.2rem',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                                border: 'none',
                                color: '#fff',
                                fontSize: '0.82rem',
                                fontWeight: 900,
                                cursor: (briefingLoading || opportunities.length === 0) ? 'not-allowed' : 'pointer',
                                opacity: (briefingLoading || opportunities.length === 0) ? 0.6 : 1,
                                boxShadow: '0 4px 15px rgba(56, 189, 248, 0.35)'
                            }}
                        >
                            {briefingLoading ? (
                                <>
                                    <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                    <span>{lang === 'tr' ? 'Komite Brifingi Hazırlanıyor...' : 'Synthesizing Committee Briefing...'}</span>
                                </>
                            ) : (
                                <>
                                    <span>⚡</span>
                                    <span>{lang === 'tr' ? 'Gemini Kuant Brifingi Al' : 'Get Gemini Quant Briefing'}</span>
                                </>
                            )}
                        </button>

                        {/* Manual Refresh Button */}
                        <button
                            onClick={fetchOpportunities}
                            disabled={loading}
                            style={{
                                padding: '0.55rem 0.9rem',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#e2e8f0',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            🔄 {lastUpdated ? `${lastUpdated}` : 'Yenile'}
                        </button>
                    </div>
                </div>

                {/* KPI Metrics Dashboard */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '0.8rem',
                    marginTop: '1.2rem',
                    paddingTop: '1.2rem',
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>TÜM CANLI MAÇLAR</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                            {deskSummary.totalScanned} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Maç</span>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800 }}>FİLTREYİ GEÇEN (+EV)</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem' }}>
                            {opportunities.length} <span style={{ fontSize: '0.75rem' }}>Pozisyon</span>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 800 }}>💎 ALPHA SİNYALLER</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#c084fc', marginTop: '0.2rem' }}>
                            {deskSummary.alphaCount} <span style={{ fontSize: '0.75rem' }}>Elit Kurumsal</span>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800 }}>🔥 ALEV İVMELİ</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f87171', marginTop: '0.2rem' }}>
                            {deskSummary.alevCount} <span style={{ fontSize: '0.75rem' }}>Baskılı</span>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800 }}>ORTALAMA BEKLENEN DEĞER</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399', marginTop: '0.2rem' }}>
                            +{deskSummary.avgEV}% <span style={{ fontSize: '0.75rem' }}>EV</span>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 800 }}>🛡️ ÖLÜ MAÇ KALKANI</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.2rem' }}>
                            {deskSummary.deadMatchShieldCount} <span style={{ fontSize: '0.75rem' }}>Karantina</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gemini API Key Configuration Modal / Dropdown */}
            {showKeyModal && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.98)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🔑</span> {lang === 'tr' ? 'Google Gemini API Anahtarı Bağlantı Masası' : 'Google Gemini API Connection Vault'}
                        </h3>
                        <button
                            onClick={() => setShowKeyModal(false)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                        >
                            ✕
                        </button>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1rem' }}>
                        {lang === 'tr'
                            ? 'Gemini API anahtarınızı aşağıdaki alana girerek test edebilir ve doğrudan bağlayabilirsiniz. Anahtar sadece sunucunuzda şifreli saklanır ve sadece bu Admin Kokpitine özel Kuant Komitesi analizleri için kullanılır.'
                            : 'Enter your Google AI Studio Gemini API key below to test and connect. Your key is stored securely on the server and is strictly accessible to this Admin Cockpit.'}
                    </p>

                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <input
                            type="password"
                            placeholder="AIzaSy..."
                            value={geminiApiKeyInput}
                            onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                            style={{
                                flex: 1,
                                minWidth: '280px',
                                padding: '0.75rem 1rem',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '10px',
                                color: '#fff',
                                fontSize: '0.85rem'
                            }}
                        />
                        <button
                            onClick={handleTestKey}
                            disabled={keyTesting || !geminiApiKeyInput.trim()}
                            style={{
                                padding: '0.75rem 1.4rem',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                borderRadius: '10px',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: (keyTesting || !geminiApiKeyInput.trim()) ? 'not-allowed' : 'pointer',
                                opacity: (keyTesting || !geminiApiKeyInput.trim()) ? 0.6 : 1
                            }}
                        >
                            {keyTesting ? 'Doğrulanıyor...' : 'Test Et & Kaydet'}
                        </button>
                    </div>

                    {keyTestResult && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.8rem 1rem',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            background: keyTestResult.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${keyTestResult.connected ? '#10b981' : '#ef4444'}`,
                            color: keyTestResult.connected ? '#34d399' : '#f87171'
                        }}>
                            {keyTestResult.connected ? (
                                <div>
                                    <div style={{ fontWeight: 800 }}>✅ {keyTestResult.message}</div>
                                    <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', opacity: 0.9 }}>
                                        Kullanılabilir Modeller: {keyTestResult.models?.join(', ')}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontWeight: 800 }}>❌ Bağlantı Başarısız</div>
                                    <div style={{ marginTop: '0.2rem', fontSize: '0.72rem' }}>{keyTestResult.error}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Strategic Gemini Briefing Display Card */}
            {briefingData && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(24, 24, 27, 0.95))',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: '16px',
                    padding: '1.8rem',
                    marginBottom: '2rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.6rem' }}>🤖</span>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f3e8ff', margin: 0 }}>
                                    {briefingData.mode === 'GEMINI_AI'
                                        ? `BAHİS OFİSİ RİSK KOMİTESİ BRİFİNGİ (Gemini Neural Engine)`
                                        : `BAHİS OFİSİ RİSK KOMİTESİ BRİFİNGİ (Yerel Kuant Motoru)`}
                                </h3>
                                <div style={{ fontSize: '0.72rem', color: '#c084fc', marginTop: '0.1rem' }}>
                                    {briefingData.notice || `Sentez Modeli: ${briefingData.model || 'Dixon-Coles & Poisson Hybrid'}`}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <button
                                onClick={() => copyToClipboard(briefingData.markdown, 'briefing')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#e2e8f0',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {copiedBriefing ? '✓ Kopyalandı!' : '📋 Raporu Kopyala'}
                            </button>
                            <button
                                onClick={() => setBriefingData(null)}
                                style={{
                                    padding: '0.5rem 0.8rem',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        color: '#cbd5e1',
                        fontSize: '0.88rem',
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                        fontFamily: "'Inter', sans-serif"
                    }}>
                        {briefingData.markdown}
                    </div>
                </div>
            )}

            {/* Filter Matrix & Interactive Sliders */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '1.4rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🎛️</span> {lang === 'tr' ? 'CANLI KUANT FİLTRELEME MASASI' : 'QUANTITATIVE GATEKEEPER MATRIX'}
                    </div>

                    {/* Market Category Filter Tabs */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'ALL', label: 'Tümü' },
                            { id: 'NEXT_GOAL', label: '🎯 Sıradaki Gol' },
                            { id: 'OVER_UNDER', label: '📊 Üst/Alt' },
                            { id: 'BTTS', label: '🔥 KG Var/Yok' },
                            { id: '1X2', label: '🏆 Çifte Şans / 1X2' }
                        ].map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    background: selectedCategory === cat.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${selectedCategory === cat.id ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                                    color: selectedCategory === cat.id ? '#38bdf8' : '#94a3b8'
                                }}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' }}>
                    {/* Min EV Slider */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>Min. Beklenen Değer (+EV)</span>
                            <span style={{ color: '#38bdf8', fontWeight: 900 }}>+{minEV}% EV</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={minEV}
                            onChange={(e) => setMinEV(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Min Confidence Slider */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>Min. Model Güven Skoru</span>
                            <span style={{ color: '#10b981', fontWeight: 900 }}>%{minConfidence}</span>
                        </div>
                        <input
                            type="range"
                            min="50"
                            max="85"
                            step="5"
                            value={minConfidence}
                            onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
                            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Minute Window Selector */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>Dakika Aralığı</span>
                            <span style={{ color: '#fbbf24', fontWeight: 900 }}>{minMinute}' - {maxMinute}'</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="number"
                                min="10"
                                max="70"
                                value={minMinute}
                                onChange={(e) => setMinMinute(parseInt(e.target.value, 10) || 15)}
                                style={{ width: '50%', padding: '0.4rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', textAlign: 'center' }}
                            />
                            <input
                                type="number"
                                min="60"
                                max="90"
                                value={maxMinute}
                                onChange={(e) => setMaxMinute(parseInt(e.target.value, 10) || 82)}
                                style={{ width: '50%', padding: '0.4rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', textAlign: 'center' }}
                            />
                        </div>
                    </div>

                    {/* Dead Match Shield Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc' }}>🛡️ Ölü Maç Kalkanı</div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>75'+ ve 2+ farkta NO-BET</div>
                        </div>
                        <button
                            onClick={() => setDeadMatchShield(!deadMatchShield)}
                            style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 900,
                                border: 'none',
                                cursor: 'pointer',
                                background: deadMatchShield ? '#10b981' : '#475569',
                                color: '#fff'
                            }}
                        >
                            {deadMatchShield ? 'AÇIK' : 'KAPALI'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bet Slip / Accumulator Cockpit Bar (Sticky if items selected) */}
            {calculatedSlip && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.98))',
                    border: '2px solid #a855f7',
                    borderRadius: '16px',
                    padding: '1.4rem',
                    marginBottom: '1.5rem',
                    boxShadow: '0 15px 35px rgba(168, 85, 247, 0.25)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                🎟️ {calculatedSlip.items.length === 1 ? 'TEKLİ DEĞER BAHİSİ' : `STRATEJİK KOMBİNE (${calculatedSlip.items.length} MAÇ)`}
                            </div>
                            <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Toplam Oran: </span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>@{calculatedSlip.combinedOdds.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Bileşik Olasılık: </span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8' }}>%{calculatedSlip.compositeProb}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Bileşik EV: </span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>+{calculatedSlip.compositeEV}%</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Önerilen Kelly Kasa: </span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#c084fc' }}>%{calculatedSlip.kellyStakePercent}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Kasa:</span>
                                <input
                                    type="number"
                                    value={bankrollAmount}
                                    onChange={(e) => setBankrollAmount(parseFloat(e.target.value) || 0)}
                                    style={{ width: '80px', background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 800, textAlign: 'right' }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>TL</span>
                            </div>

                            <div style={{ fontSize: '0.8rem', color: '#e2e8f0', background: 'rgba(16, 185, 129, 0.2)', padding: '0.45rem 0.8rem', borderRadius: '8px', border: '1px solid #10b981' }}>
                                Bahis: <strong>{Math.round(bankrollAmount * (calculatedSlip.kellyStakePercent / 100))} TL</strong>
                            </div>

                            <button
                                onClick={() => {
                                    const slipText = calculatedSlip.items.map((it, idx) =>
                                        `${idx + 1}. ${it.homeTeam} vs ${it.awayTeam} (Dk ${it.minute}') ➔ ${it.marketLabel} (@${it.marketOdds}) [Model: %${it.trueProb}]`
                                    ).join('\n') + `\n\nToplam Oran: @${calculatedSlip.combinedOdds.toFixed(2)} | Bileşik EV: +%${calculatedSlip.compositeEV} | Önerilen Kasa: %${calculatedSlip.kellyStakePercent}`;
                                    copyToClipboard(slipText, 'slip');
                                }}
                                style={{
                                    padding: '0.6rem 1.1rem',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {copiedSlip ? '✓ Kopyalandı!' : '📋 Kuponu Kopyala'}
                            </button>

                            <button
                                onClick={() => setSelectedSlipIds([])}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                Temizle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Opportunities List */}
            {loading && opportunities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                    <div className="spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }}></div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>Canlı maçlar ve kuant telemetrisi analiz ediliyor...</div>
                </div>
            ) : error ? (
                <div style={{ padding: '2rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', textAlign: 'center' }}>
                    {error}
                </div>
            ) : filteredOpps.length === 0 ? (
                <div style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '16px',
                    border: '1px dashed rgba(255,255,255,0.1)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🛡️</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
                        {lang === 'tr' ? 'Seçili Kriterlere Uyan +EV Fırsat Bulunmadı' : 'No Value Opportunities Found with Current Filters'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '500px', margin: '0 auto 1.2rem' }}>
                        {lang === 'tr'
                            ? 'Şu anda taranan canlı maçlarda belirlenen +EV veya güven eşiğini geçen matematiksel fırsat bulunmuyor. Filtre sürgülerini esnetebilir veya bir sonraki canlı periyodu bekleyebilirsiniz.'
                            : 'Currently no matches pass the gatekeeper thresholds. Try lowering the Min EV or Confidence slider.'}
                    </p>
                    <button
                        onClick={() => { setMinEV(2.0); setMinConfidence(60); }}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '8px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                        }}
                    >
                        Filtreleri Genişlet (+2% EV, %60 Güven)
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.2rem' }}>
                    {filteredOpps.map((opp) => {
                        const isSelected = selectedSlipIds.includes(opp.oppId);
                        const isAlpha = opp.level === 'ALPHA';
                        const isAlev = opp.level === 'ALEV';

                        return (
                            <div
                                key={opp.oppId}
                                style={{
                                    background: isAlpha
                                        ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.95))'
                                        : 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.8))',
                                    border: isSelected
                                        ? '2px solid #a855f7'
                                        : isAlpha
                                            ? '1px solid rgba(168, 85, 247, 0.4)'
                                            : isAlev
                                                ? '1px solid rgba(239, 68, 68, 0.35)'
                                                : '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '16px',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: isAlpha ? '0 10px 25px rgba(168, 85, 247, 0.15)' : '0 8px 20px rgba(0,0,0,0.4)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Header: Teams, League, Score & Minute */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                                        <div>
                                            <span style={{
                                                fontSize: '0.68rem',
                                                color: isAlpha ? '#c084fc' : isAlev ? '#f87171' : '#38bdf8',
                                                fontWeight: 900,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}>
                                                {opp.badge} • {opp.league}
                                            </span>
                                            <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc', margin: '0.2rem 0' }}>
                                                {opp.homeTeam} <span style={{ color: '#64748b', fontWeight: 500 }}>vs</span> {opp.awayTeam}
                                            </h4>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '20px',
                                                background: 'rgba(239, 68, 68, 0.2)',
                                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                                color: '#f87171',
                                                fontSize: '0.72rem',
                                                fontWeight: 900
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }}></span>
                                                <span>{opp.minute}'</span>
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.2rem' }}>
                                                {opp.score}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Market & Odds Value Strip */}
                                    <div style={{
                                        background: 'rgba(0,0,0,0.35)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '12px',
                                        padding: '0.8rem 1rem',
                                        marginBottom: '0.9rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>HEDEF MARKET TAHMİNİ</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.1rem' }}>
                                                {opp.marketLabel}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '0.15rem' }}>
                                                Model Olasılığı: <strong>%{opp.trueProb}</strong> (Adil Oran: @{opp.fairOdds})
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fbbf24' }}>
                                                @{opp.marketOdds}
                                            </div>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '6px',
                                                background: 'rgba(16, 185, 129, 0.2)',
                                                color: '#34d399',
                                                fontSize: '0.75rem',
                                                fontWeight: 900,
                                                marginTop: '0.1rem'
                                            }}>
                                                +{opp.evPercent}% EV
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pitch Telemetry Matrix */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: '0.5rem',
                                        marginBottom: '0.8rem',
                                        textAlign: 'center',
                                        fontSize: '0.72rem'
                                    }}>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '6px' }}>
                                            <div style={{ color: '#64748b' }}>Şut / İsabet</div>
                                            <div style={{ fontWeight: 800, color: '#f8fafc', marginTop: '0.1rem' }}>{opp.stats.sot}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '6px' }}>
                                            <div style={{ color: '#64748b' }}>Ceza Sahası</div>
                                            <div style={{ fontWeight: 800, color: '#f8fafc', marginTop: '0.1rem' }}>{opp.stats.box}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '6px' }}>
                                            <div style={{ color: '#64748b' }}>xG Üretimi</div>
                                            <div style={{ fontWeight: 800, color: '#38bdf8', marginTop: '0.1rem' }}>
                                                {opp.xg.home.toFixed(2)} - {opp.xg.away.toFixed(2)}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '6px' }}>
                                            <div style={{ color: '#64748b' }}>Dominans</div>
                                            <div style={{ fontWeight: 800, color: opp.dominanceIndex >= 0 ? '#10b981' : '#f87171', marginTop: '0.1rem' }}>
                                                {opp.dominanceIndex >= 0 ? `+${opp.dominanceIndex}` : opp.dominanceIndex}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rationale Bullet Points */}
                                    {opp.rationale && opp.rationale.length > 0 && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            {opp.rationale.map((rat, rIdx) => (
                                                <div key={rIdx} style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.2rem' }}>
                                                    <span style={{ color: '#38bdf8' }}>•</span>
                                                    <span>{rat}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer: Kelly Stake & Action Buttons */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingTop: '0.8rem',
                                    borderTop: '1px solid rgba(255,255,255,0.06)'
                                }}>
                                    <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                                        Kasa Payı: <strong style={{ color: '#c084fc' }}>%{opp.recommendedStakePercent} (Kelly)</strong>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => toggleSlipSelection(opp.oppId)}
                                            style={{
                                                padding: '0.45rem 0.9rem',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                background: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.06)',
                                                border: `1px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.15)'}`,
                                                color: isSelected ? '#c084fc' : '#fff'
                                            }}
                                        >
                                            {isSelected ? '✓ Kuponda' : '+ Kupona Ekle'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quarantined Dead Matches Section */}
            {quarantined.length > 0 && (
                <div style={{
                    marginTop: '2rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '16px',
                    padding: '1.2rem'
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f87171', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🛡️</span> ÖLÜ MAÇ VE RÖLANTİ KALKANI İLE ENGELLENENLER ({quarantined.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.6rem' }}>
                        {quarantined.map((q, idx) => (
                            <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                                <div style={{ fontWeight: 800, color: '#e2e8f0' }}>{q.match} ({q.minute}' | Skor: {q.score})</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.15rem' }}>{q.reason}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
