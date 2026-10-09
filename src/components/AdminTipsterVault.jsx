import React, { useState, useEffect } from 'react';

export const AdminTipsterVault = ({ lang = 'tr', proxyBase, getAdminHeaders }) => {
    const [data, setData] = useState({ tipsters: [], settings: { minStake: 8, vipThresholdStake: 9 }, activeCount: 0, totalPicksInCache: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshingFeed, setRefreshingFeed] = useState(false);
    const [editingState, setEditingState] = useState({});
    const [settingsState, setSettingsState] = useState({ minStake: 8, vipThresholdStake: 9 });
    const [statusMsg, setStatusMsg] = useState(null);

    const showMsg = (text, type = 'success') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 3500);
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${proxyBase}/api/admin/tipsters`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
                if (json.settings) {
                    setSettingsState(json.settings);
                }
                // Initialize local editing state
                const edits = {};
                (json.tipsters || []).forEach(t => {
                    const key = t.realUsername.toLowerCase();
                    edits[key] = {
                        maskedName: t.maskedName,
                        badge: t.badge,
                        specialty: t.specialty,
                        isActive: t.isActive
                    };
                });
                setEditingState(edits);
            }
        } catch (e) {
            console.error('[ADMIN_TIPSTERS] Fetch error:', e);
            showMsg('Tipster verisi yüklenemedi.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveTipster = async (realUsername) => {
        const key = realUsername.toLowerCase();
        const currentEdit = editingState[key];
        if (!currentEdit) return;

        try {
            setSaving(true);
            const res = await fetch(`${proxyBase}/api/admin/tipsters/update`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({
                    realUsername,
                    updates: currentEdit
                })
            });
            if (res.ok) {
                showMsg(`"${realUsername}" için maske güncellendi!`);
                await fetchData();
            } else {
                showMsg('Güncelleme başarısız.', 'error');
            }
        } catch (e) {
            showMsg('Sunucu hatası.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (realUsername, currentActive) => {
        try {
            setSaving(true);
            const res = await fetch(`${proxyBase}/api/admin/tipsters/update`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({
                    realUsername,
                    updates: { isActive: !currentActive }
                })
            });
            if (res.ok) {
                showMsg(!currentActive ? `"${realUsername}" sitede yayına alındı!` : `"${realUsername}" gizlendi.`);
                await fetchData();
            }
        } catch (e) {
            showMsg('Durum değiştirilemedi.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGlobalSettings = async () => {
        try {
            setSaving(true);
            const res = await fetch(`${proxyBase}/api/admin/tipsters/settings`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify(settingsState)
            });
            if (res.ok) {
                showMsg('Yayın filtre kuralları kaydedildi!');
                await fetchData();
            }
        } catch (e) {
            showMsg('Ayarlar kaydedilemedi.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTriggerManualScrape = async () => {
        try {
            setRefreshingFeed(true);
            const res = await fetch(`${proxyBase}/api/tipsters/feed?refresh=1`);
            if (res.ok) {
                showMsg('Blogabet canlı akışı başarıyla tarandı ve güncellendi!');
                await fetchData();
            }
        } catch (e) {
            showMsg('Yenileme sırasında hata oluştu.', 'error');
        } finally {
            setRefreshingFeed(false);
        }
    };

    return (
        <div style={{ maxWidth: '1280px', margin: '0 auto', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
            {/* Status Toast */}
            {statusMsg && (
                <div style={{
                    position: 'fixed',
                    top: '2rem',
                    right: '2rem',
                    background: statusMsg.type === 'error' ? '#ef4444' : '#10b981',
                    color: '#fff',
                    padding: '0.8rem 1.4rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 9999
                }}>
                    {statusMsg.text}
                </div>
            )}

            {/* Header Block */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>👑</span>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0 }}>
                            {lang === 'tr' ? 'Tipster Havuzu & Maskeleme Masası' : 'Tipster Vault & Persona Management'}
                        </h2>
                        <span style={{ background: '#38bdf8', color: '#000', fontSize: '0.65rem', fontWeight: 900, padding: '2px 8px', borderRadius: '12px' }}>
                            ADMIN ONLY
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                        {lang === 'tr' 
                            ? 'Orijinal kullanıcı adları sadece burada görüntülenir. Sitede ziyaretçilere sadece sizin belirlediğiniz maskeli isimler sunulur.' 
                            : 'Real identities are strictly visible to admins only. Visitors only see your assigned personas.'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                        onClick={handleTriggerManualScrape}
                        disabled={refreshingFeed}
                        style={{
                            background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                            color: '#fff',
                            border: 'none',
                            padding: '0.65rem 1.2rem',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <span>🔄</span>
                        <span>{refreshingFeed ? (lang === 'tr' ? 'Taranıyor...' : 'Scanning...') : (lang === 'tr' ? 'Akışı Canlı Tara' : 'Scan Feed Now')}</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '1.1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>TOPLAM KEŞFEDİLEN</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                        {(data.tipsters || []).length}
                    </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '14px', padding: '1.1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>YAYINDA OLAN AKTİF</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
                        {data.activeCount || 0}
                    </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '14px', padding: '1.1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>BELLEKTEKİ TAHMİNLER</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem' }}>
                        {data.totalPicksInCache || 0}
                    </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '14px', padding: '1.1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700 }}>GÜVEN FİLTRESİ</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.4rem' }}>
                        ≥ {settingsState.minStake}/10 Güven
                    </div>
                </div>
            </div>

            {/* Global Settings Strip */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>
                            {lang === 'tr' ? 'Yayınlanacak Min. Stake/Güven:' : 'Min. Published Stake:'}
                        </label>
                        <select
                            value={settingsState.minStake}
                            onChange={(e) => setSettingsState({ ...settingsState, minStake: parseInt(e.target.value, 10) })}
                            style={{
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                <option key={s} value={s}>{s}/10 Stake ve Üzeri {s >= 8 ? '(Yüksek Güven)' : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>
                            {lang === 'tr' ? 'VIP Kilit Eşiği:' : 'VIP Lock Threshold:'}
                        </label>
                        <select
                            value={settingsState.vipThresholdStake}
                            onChange={(e) => setSettingsState({ ...settingsState, vipThresholdStake: parseInt(e.target.value, 10) })}
                            style={{
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fbbf24',
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                            }}
                        >
                            {[7, 8, 9, 10].map(s => (
                                <option key={s} value={s}>{s}/10 ve Üzeri VIP Özel Kilitli</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleSaveGlobalSettings}
                    disabled={saving}
                    style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#000',
                        border: 'none',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '10px',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                    }}
                >
                    💾 {lang === 'tr' ? 'Filtre Ayarlarını Kaydet' : 'Save Filter Rules'}
                </button>
            </div>

            {/* Tipsters List Table */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>
                        {lang === 'tr' ? 'Keşfedilen Tipsterlar & Maske Eşlemeleri' : 'Discovered Tipsters & Mask Mappings'}
                    </h3>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        <div>🔄 Yükleniyor...</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '0.85rem 1.25rem' }}>GERÇEK KİMLİK (ADMIN)</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>SİTEDEKİ MASKE İSİM</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>FORM ROZETİ</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>UZMANLIK</th>
                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>ORİJİNAL YIELD</th>
                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>DURUM</th>
                                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>İŞLEM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.tipsters || []).map((t) => {
                                    const key = t.realUsername.toLowerCase();
                                    const edit = editingState[key] || {
                                        maskedName: t.maskedName,
                                        badge: t.badge,
                                        specialty: t.specialty,
                                        isActive: t.isActive
                                    };

                                    return (
                                        <tr
                                            key={t.realUsername}
                                            style={{
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                background: !t.isActive ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                                            }}
                                        >
                                            {/* Real Name */}
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ fontWeight: 800, color: '#f8fafc' }}>{t.realUsername}</div>
                                                <a
                                                    href={t.profileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ fontSize: '0.72rem', color: '#64748b', textDecoration: 'none' }}
                                                >
                                                    🔗 Profil linki ↗
                                                </a>
                                            </td>

                                            {/* Masked Name Input */}
                                            <td style={{ padding: '1rem 1rem' }}>
                                                <input
                                                    type="text"
                                                    value={edit.maskedName}
                                                    onChange={(e) => setEditingState({
                                                        ...editingState,
                                                        [key]: { ...edit, maskedName: e.target.value }
                                                    })}
                                                    style={{
                                                        background: '#0f172a',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        color: '#38bdf8',
                                                        padding: '0.45rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 700,
                                                        width: '160px'
                                                    }}
                                                />
                                            </td>

                                            {/* Badge Input */}
                                            <td style={{ padding: '1rem 1rem' }}>
                                                <input
                                                    type="text"
                                                    value={edit.badge}
                                                    onChange={(e) => setEditingState({
                                                        ...editingState,
                                                        [key]: { ...edit, badge: e.target.value }
                                                    })}
                                                    style={{
                                                        background: '#0f172a',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        color: '#e2e8f0',
                                                        padding: '0.45rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.82rem',
                                                        width: '140px'
                                                    }}
                                                />
                                            </td>

                                            {/* Specialty Input */}
                                            <td style={{ padding: '1rem 1rem' }}>
                                                <input
                                                    type="text"
                                                    value={edit.specialty}
                                                    onChange={(e) => setEditingState({
                                                        ...editingState,
                                                        [key]: { ...edit, specialty: e.target.value }
                                                    })}
                                                    style={{
                                                        background: '#0f172a',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        color: '#94a3b8',
                                                        padding: '0.45rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.82rem',
                                                        width: '150px'
                                                    }}
                                                />
                                            </td>

                                            {/* Real Yield & Count */}
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                                                <div style={{ fontWeight: 800, color: t.realYield?.includes('-') ? '#ef4444' : '#10b981' }}>
                                                    {t.realYield || 'N/A'}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                    ({t.realPicksCount || 0} Kupon)
                                                </div>
                                            </td>

                                            {/* Toggle Active Switch */}
                                            <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleToggleActive(t.realUsername, t.isActive)}
                                                    style={{
                                                        background: t.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                        color: t.isActive ? '#10b981' : '#ef4444',
                                                        border: `1px solid ${t.isActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                                        padding: '0.35rem 0.8rem',
                                                        borderRadius: '20px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {t.isActive ? '🟢 YAYINDA' : '🔴 GİZLİ'}
                                                </button>
                                            </td>

                                            {/* Save Action */}
                                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleSaveTipster(t.realUsername)}
                                                    disabled={saving}
                                                    style={{
                                                        background: 'rgba(56, 189, 248, 0.15)',
                                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                                        color: '#38bdf8',
                                                        padding: '0.45rem 0.9rem',
                                                        borderRadius: '8px',
                                                        fontWeight: 800,
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Kaydet
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
