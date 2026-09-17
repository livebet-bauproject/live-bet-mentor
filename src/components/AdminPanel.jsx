import React, { useState, useEffect } from 'react';
import { supabase } from '../backend/supabaseClient';
import { bankrollManager } from '../logic/bankrollManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { TradingDesk } from './TradingDesk';

export const AdminPanel = ({ lang = 'tr' }) => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subscriptionDays, setSubscriptionDays] = useState(3);
    const [selectedPlan, setSelectedPlan] = useState('trial');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'active', 'all', 'upgrades'
    const [upgradeRequests, setUpgradeRequests] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [systemSettings, setSystemSettings] = useState({});
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [supabaseOffline, setSupabaseOffline] = useState(false);
    const [officeStatus, setOfficeStatus] = useState(null);
    const [officeLoading, setOfficeLoading] = useState(false);
    const [officeActionLoading, setOfficeActionLoading] = useState(false);

    const PLANS = {
        trial: { label: 'Trial', color: '#10b981' },
        pro: { label: 'Pro', color: '#38bdf8' },
        premium: { label: 'Premium', color: '#a78bfa' },
        admin: { label: 'Admin', color: '#f59e0b' }
    };

    const t = lang === 'tr' ? {
        title: '🛡️ YÖNETİCİ KONTROL MERKEZİ',
        addMember: 'YENİ ÜYE EKLE',
        email: 'E-POSTA',
        tempPass: 'GEÇİCİ ŞİFRE',
        duration: 'SÜRE',
        plan: 'PLAN',
        days: 'gün',
        tabPending: 'ONAY BEKLİYOR',
        tabActive: 'AKTİF ÜYELER',
        tabAll: 'TÜM ÜYELER',
        memberList: 'Üye Listesi',
        emailCol: 'E-POSTA',
        dateCol: 'KAYIT TARİHİ',
        statusCol: 'DURUM',
        planCol: 'PLAN',
        expiryCol: 'BİTİŞ TARİHİ',
        remainingCol: 'KALAN',
        actionsCol: 'İŞLEM',
        statusPending: 'ONAY BEKLİYOR',
        statusApproved: 'AKTİF',
        statusRejected: 'REDDEDİLDİ',
        statusExpired: 'SÜRESİ DOLDU',
        statusBanned: 'YASAKLI',
        approve: 'ONAYLA',
        reject: 'REDDET',
        extend: 'UZAT',
        ban: 'YASAKLA',
        unban: 'YASAĞI KALDIR',
        delete: 'SİL',
        save: 'KAYDET',
        cancel: 'İPTAL',
        confirmDelete: 'Bu kullanıcıyı tamamen silmek istediğine emin misin?',
        confirmReject: 'Bu üyelik başvurusunu reddetmek istediğine emin misin?',
        userCreated: 'Kullanıcı başarıyla eklendi!',
        userApproved: 'Üyelik onaylandı!',
        userRejected: 'Başvuru reddedildi.',
        userDeleted: 'Kullanıcı silindi.',
        subscriptionUpdated: 'Üyelik süresi güncellendi!',
        loading: 'Yükleniyor...',
        noUsers: 'Kullanıcı bulunamadı.',
        quickDurations: 'Hızlı:',
        requestedPlan: 'TALEP EDİLEN',
        currentPlan: 'MEVCUT PLAN',
        tabSettings: 'SİSTEM AYARLARI',
        saveSettings: 'AYARLARI KAYDET',
        telegramSupport: 'Telegram Kullanıcı Adı',
        proPrice: 'Pro Plan Fiyatı',
        premiumPrice: 'Premium Plan Fiyatı',
        currency: 'Para Birimi',
        supportEmail: 'Destek E-postası',
        settingsUpdated: 'Sistem ayarları güncellendi!',
        tabTelegram: 'TELEGRAM BOT',
        botStatus: 'BOT DURUMU',
        botActive: 'AKTİF',
        botInactive: 'DEVRE DIŞI',
        botError: 'HATA',
        sendTestReport: 'GÜNLÜK RAPOR GÖNDER',
        signalsToday: 'Bugünkü Sinyal Sayısı',
        vipGroupId: 'VIP Grup ID',
        publicChannel: 'Halka Açık Kanal',
        minLevel: 'Min. Sinyal Seviyesi',
        refreshStatus: 'DURUMU GÜNCELLE',
        strategyTitle: '📊 BAHİS STRATEJİLERİ',
        strategyDesc: 'Hangi algoritmaların sinyal üreteceğini seçin.',
        onlyXG: 'Sadece xG Verisi Olanlar',
        stratPress: 'Baskı Dominasyonu',
        stratMomentum: 'Son 15dk İvmesi',
        stratFHG: 'İY 0.5 Üst',
        stratComeback: 'Geri Dönüş',
        stratStats: 'Stat Dominasyonu',
        stratCorners: 'Korner Baskısı',
        stratBTTS: 'KG Var',
        stratRedCard: 'Sayısal Üstünlük (Kırmızı Kart)',
        tabWebAnalytics: 'ZİYARETÇİ & SİTE ANALİTİĞİ',
        tabAnalytics: 'STRATEJİ KARNESİ (ROI)',
        strategyScorecardTitle: '🎯 STRATEJİ BAŞARI & ROI KARNESİ',
        strategyScorecardDesc: 'Sistemin kullandığı algoritmaların canlı bahis performansı, kazanma oranları ve getiri (ROI) karnesi.',
        stratCol: 'STRATEJİ',
        betsCol: 'TOPLAM BAHİS',
        winLossCol: 'K / K',
        stakedCol: 'YATIRILAN',
        profitCol: 'NET KÂR/ZARAR',
        winRateCol: 'BAŞARI ORANI',
        roiCol: 'ROI (%)',
        badgeCol: 'DERECELENDİRME',
        totalStaked: 'Toplam Yatırılan',
        totalProfit: 'Kümülatif Net Kâr',
        avgRoi: 'Ortalama ROI',
        topStrategy: 'En Başarılı Algoritma',
        clvTitle: 'Kapanış Oranı (CLV)',
        clvBeat: 'Piyasayı Yenme Gücü',
        resetStats: 'İSTATİSTİKLERİ SIFIRLA',
        resetConfirm: 'Tüm strateji performans verilerini sıfırlamak istediğinize emin misiniz?',
        tabOffice: 'OTONOM KOMUTA (3 GÖREVLİ)'
    } : {
        title: '🛡️ ADMIN CONTROL CENTER',
        addMember: 'ADD NEW MEMBER',
        email: 'EMAIL',
        tempPass: 'TEMP PASSWORD',
        duration: 'DURATION',
        plan: 'PLAN',
        days: 'days',
        tabPending: 'PENDING',
        tabActive: 'ACTIVE',
        tabAll: 'ALL MEMBERS',
        memberList: 'Member List',
        emailCol: 'EMAIL',
        dateCol: 'REGISTERED',
        statusCol: 'STATUS',
        planCol: 'PLAN',
        expiryCol: 'EXPIRY',
        remainingCol: 'REMAINING',
        actionsCol: 'ACTIONS',
        statusPending: 'PENDING',
        statusApproved: 'ACTIVE',
        statusRejected: 'REJECTED',
        statusExpired: 'EXPIRED',
        statusBanned: 'BANNED',
        approve: 'APPROVE',
        reject: 'REJECT',
        extend: 'EXTEND',
        ban: 'BAN',
        unban: 'UNBAN',
        delete: 'DELETE',
        save: 'SAVE',
        cancel: 'CANCEL',
        confirmDelete: 'Are you sure you want to completely delete this user?',
        confirmReject: 'Are you sure you want to reject this membership application?',
        userCreated: 'User created successfully!',
        userApproved: 'Membership approved!',
        userRejected: 'Application rejected.',
        userDeleted: 'User deleted.',
        subscriptionUpdated: 'Subscription updated!',
        loading: 'Loading...',
        noUsers: 'No users found.',
        quickDurations: 'Quick:',
        tabUpgrades: 'UPGRADE REQUESTS',
        requestedPlan: 'REQUESTED',
        currentPlan: 'CURRENT',
        tabSettings: 'SYSTEM SETTINGS',
        saveSettings: 'SAVE SETTINGS',
        telegramSupport: 'Telegram Username',
        proPrice: 'Pro Plan Price',
        premiumPrice: 'Premium Plan Price',
        currency: 'Currency Symbol',
        supportEmail: 'Support Email',
        settingsUpdated: 'System settings updated!',
        tabTelegram: 'TELEGRAM BOT',
        botStatus: 'BOT STATUS',
        botActive: 'ACTIVE',
        botInactive: 'INACTIVE',
        botError: 'ERROR',
        sendTestReport: 'SEND DAILY REPORT',
        signalsToday: 'Signals Today',
        vipGroupId: 'VIP Group ID',
        publicChannel: 'Public Channel',
        minLevel: 'Min. Signal Level',
        refreshStatus: 'REFRESH STATUS',
        strategyTitle: '📊 BETTING STRATEGIES',
        strategyDesc: 'Select which algorithms generate signals.',
        onlyXG: 'xG Data Available Only',
        stratPress: 'Pressure Dominance',
        stratMomentum: 'Last 15m Momentum',
        stratFHG: '1st Half Over 0.5',
        stratComeback: 'Comeback Surge',
        stratStats: 'Stat Dominance',
        stratCorners: 'Corner Pressure',
        stratBTTS: 'BTTS Dynamic',
        stratRedCard: 'Numerical Advantage (Red Card)',
        tabWebAnalytics: 'VISITOR & WEB ANALYTICS',
        tabAnalytics: 'STRATEGY SCORECARD (ROI)',
        strategyScorecardTitle: '🎯 STRATEGY PERFORMANCE & ROI SCORECARD',
        strategyScorecardDesc: 'Live betting algorithm performance, win rates, and return on investment (ROI) breakdown.',
        stratCol: 'STRATEGY',
        betsCol: 'TOTAL BETS',
        winLossCol: 'W / L',
        stakedCol: 'STAKED',
        profitCol: 'NET P/L',
        winRateCol: 'WIN RATE',
        roiCol: 'ROI (%)',
        badgeCol: 'TIER GRADE',
        totalStaked: 'Total Staked',
        totalProfit: 'Cumulative Net P/L',
        avgRoi: 'Average ROI',
        topStrategy: 'Top Algorithm',
        clvTitle: 'Closing Line Value (CLV)',
        clvBeat: 'Beating The Market',
        resetStats: 'RESET STATS',
        resetConfirm: 'Are you sure you want to reset all strategy performance analytics?',
        tabOffice: 'AUTONOMOUS COMMAND (3 AGENTS)'
    };

    const [strategySettings, setStrategySettings] = useState({});
    const [strategyAnalytics, setStrategyAnalytics] = useState([]);

    const loadStrategyAnalytics = () => {
        try {
            setStrategyAnalytics(bankrollManager.getStrategyAnalytics());
        } catch (e) {
            console.error('Error loading strategy analytics:', e);
        }
    };

    const handleResetStrategyStats = () => {
        if (window.confirm(t.resetConfirm)) {
            if (bankrollManager.state) {
                bankrollManager.state.strategyStats = {};
                bankrollManager.saveState();
            }
            loadStrategyAnalytics();
            setStatus({ type: 'success', message: 'Strateji istatistikleri sıfırlandı.' });
        }
    };

    useEffect(() => {
        fetchProfiles();
        fetchUpgradeRequests();
        fetchSystemSettings();
        fetchTelegramStatus();
        fetchOfficeStatus();
        loadStrategyAnalytics();
        
        // Load strategy settings from localStorage
        let savedStrats = {};
        try {
            const raw = localStorage.getItem('lbm_strategy_settings');
            if (raw && raw !== 'undefined' && raw !== 'null') savedStrats = JSON.parse(raw);
        } catch {
            savedStrats = {};
        }
        setStrategySettings({
            ONLY_XG: true,
            PRESS: true,
            MOMENTUM: true,
            FHG: true,
            COMEBACK: true,
            STATS: true,
            CORNERS: true,
            BTTS: true,
            RED_CARD_ADV: true,
            ...savedStrats
        });
    }, []);

    const handleToggleStrategy = (key) => {
        const newSettings = { ...strategySettings, [key]: !strategySettings[key] };
        setStrategySettings(newSettings);
        localStorage.setItem('lbm_strategy_settings', JSON.stringify(newSettings));
    };

    const [telegramStatus, setTelegramStatus] = useState(null);
    const [telegramLoading, setTelegramLoading] = useState(false);

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

    const fetchTelegramStatus = async () => {
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/telegram/status`, {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            setTelegramStatus(data);
        } catch (e) {
            console.error('Error fetching telegram status:', e);
        }
    };

    const handleSendTelegramReport = async () => {
        setTelegramLoading(true);
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/telegram/send-report`, { 
                method: 'POST',
                headers: getAdminHeaders()
            });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Rapor başarıyla gönderildi!' });
                fetchTelegramStatus();
            }
        } catch (e) {
            setStatus({ type: 'error', message: 'Rapor gönderilirken hata oluştu.' });
        }
        setTelegramLoading(false);
    };

    const handleUpdateTelegramLang = async (newLang) => {
        try {
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/telegram/config`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ lang: newLang })
            });
            const data = await res.json();
            if (data.success && data.status) {
                setTelegramStatus(data.status);
                const msg = newLang === 'tr' 
                    ? 'Telegram dili Türkçe yapıldı! 🇹🇷' 
                    : newLang === 'de' 
                    ? 'Telegram-Sprache auf Deutsch gesetzt! 🇩🇪' 
                    : 'Telegram language set to English! 🇬🇧';
                setStatus({ type: 'success', message: msg });
            }
        } catch (e) {
            console.error('Error updating telegram language:', e);
            setStatus({ type: 'error', message: 'Dil güncellenirken hata oluştu.' });
        }
    };

    const fetchOfficeStatus = async () => {
        try {
            setOfficeLoading(true);
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/autonomous-office/status`, {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setOfficeStatus(data);
            }
        } catch (e) {
            console.error('Error fetching office status:', e);
        } finally {
            setOfficeLoading(false);
        }
    };

    const handleOfficeAction = async (action, payload = {}) => {
        try {
            setOfficeActionLoading(true);
            const proxyBase = getProxyBase();
            const res = await fetch(`${proxyBase}/api/autonomous-office/trigger-action`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ action, payload })
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'Otonom işlem başarıyla gerçekleştirildi!' });
                fetchOfficeStatus();
            } else {
                setStatus({ type: 'error', message: data.error || 'İşlem başarısız' });
            }
        } catch (e) {
            console.error('Error triggering office action:', e);
            setStatus({ type: 'error', message: 'Bağlantı hatası' });
        } finally {
            setOfficeActionLoading(false);
        }
    };

    const fetchProfiles = async () => {
        setLoading(true);
        const proxyBase = getProxyBase();
        const merged = [];
        const seen = new Set();

        // 1. Fetch from Supabase
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                data.forEach(p => {
                    const normEmail = (p.email || '').toLowerCase().trim();
                    if (normEmail && !seen.has(normEmail)) {
                        seen.add(normEmail);
                        merged.push(p);
                    }
                });
                setSupabaseOffline(false);
            } else if (error) {
                console.warn('Supabase profiles warning:', error.message);
            }
        } catch (sbErr) {
            console.warn('Supabase connection warning:', sbErr);
        }

        // 2. Fetch from Backend proxy and merge any missing
        try {
            const res = await fetch(`${proxyBase}/api/members`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.members)) {
                    data.members.forEach(m => {
                        const normEmail = (m.email || '').toLowerCase().trim();
                        if (normEmail && !seen.has(normEmail)) {
                            seen.add(normEmail);
                            merged.push(m);
                        }
                    });
                }
            }
        } catch (beErr) {
            console.warn('Backend members fetch failed:', beErr);
        }

        setProfiles(merged);
        setLoading(false);
    };

    const fetchUpgradeRequests = async () => {
        const mergedRequests = [];
        const seen = new Set();

        // 1. Fetch from Backend Proxy
        try {
            const res = await fetch(`${proxyBase}/api/members/upgrade-requests`, {
                headers: getAdminHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.requests && Array.isArray(data.requests)) {
                    data.requests.filter(r => r.status === 'pending').forEach(r => {
                        seen.add(r.id);
                        mergedRequests.push(r);
                    });
                }
            }
        } catch (beErr) {
            console.warn('Backend upgrade requests fetch warning:', beErr);
        }

        // 2. Fetch from Supabase (if table exists)
        try {
            const { data, error } = await supabase
                .from('membership_requests')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                data.forEach(r => {
                    if (!seen.has(r.id)) {
                        seen.add(r.id);
                        mergedRequests.push(r);
                    }
                });
            }
        } catch (e) {
            console.warn('Error fetching upgrade requests from Supabase:', e);
        }

        setUpgradeRequests(mergedRequests);
    };

    const approveUpgrade = async (request) => {
        try {
            // 1. Resolve in Backend Proxy
            try {
                await fetch(`${proxyBase}/api/members/resolve-upgrade`, {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ id: request.id, action: 'approved' })
                });
            } catch (beErr) {
                console.warn('Backend resolve-upgrade error:', beErr);
            }

            // 2. Update Supabase Profile (if present)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // Default 30 days for upgrades

            try {
                await supabase
                    .from('profiles')
                    .update({
                        plan: request.requested_plan,
                        status: 'approved',
                        subscription_start: new Date().toISOString(),
                        subscription_end: expiryDate.toISOString()
                    })
                    .eq('id', request.user_id);
            } catch (sbErr) {}

            // 3. Update Supabase Request Status (if table exists)
            try {
                await supabase
                    .from('membership_requests')
                    .update({
                        status: 'approved',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', request.id);
            } catch (sbErr) {}

            setStatus({ type: 'success', message: t.userApproved });
            fetchProfiles();
            fetchUpgradeRequests();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Hata oluştu' });
        }
    };

    const rejectUpgrade = async (requestId) => {
        if (!window.confirm(t.confirmReject)) return;
        try {
            // 1. Resolve in Backend Proxy
            try {
                await fetch(`${proxyBase}/api/members/resolve-upgrade`, {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ id: requestId, action: 'rejected' })
                });
            } catch (beErr) {
                console.warn('Backend resolve-upgrade reject error:', beErr);
            }

            // 2. Update Supabase (if table exists)
            try {
                await supabase
                    .from('membership_requests')
                    .update({
                        status: 'rejected',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', requestId);
            } catch (sbErr) {}

            setStatus({ type: 'success', message: t.userRejected });
            fetchUpgradeRequests();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Hata oluştu' });
        }
    };

    const fetchSystemSettings = async () => {
        setSettingsLoading(true);
        try {
            const { data, error } = await supabase.from('system_settings').select('*');
            if (!error && data) {
                const settingsObj = {};
                data.forEach(item => {
                    settingsObj[item.key] = item.value;
                });
                setSystemSettings(settingsObj);
            }
        } catch (e) {
            console.warn('Error fetching system settings:', e);
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            const updates = Object.entries(systemSettings).map(([key, value]) => ({
                key, value, updated_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('system_settings')
                .upsert(updates);

            if (error) throw error;
            setStatus({ type: 'success', message: t.settingsUpdated });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Ayarlar güncellenirken hata oluştu' });
        }
        setSettingsLoading(false);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setStatus({ type: 'info', message: lang === 'tr' ? 'Kullanıcı oluşturuluyor...' : 'Creating user...' });
        const proxyBase = getProxyBase();

        // 1. Create in Backend API
        try {
            await fetch(`${proxyBase}/api/members/create`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ email, password, plan: selectedPlan, days: subscriptionDays })
            });
        } catch (e) {}

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + subscriptionDays);

        // 2. Also create in Supabase Auth & Profiles
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: 'user'
                    }
                }
            });

            if (data?.user) {
                await supabase
                    .from('profiles')
                    .update({
                        status: 'approved',
                        subscription_start: startDate.toISOString(),
                        subscription_end: endDate.toISOString(),
                        approved_at: new Date().toISOString(),
                        plan: selectedPlan
                    })
                    .eq('id', data.user.id);
            }
        } catch (sbErr) {
            console.warn('Supabase create user error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userCreated });
        setEmail('');
        setPassword('');
        fetchProfiles();
    };

    const approveUser = async (profile, days = subscriptionDays, plan = selectedPlan) => {
        const proxyBase = getProxyBase();
        const effectivePlan = plan || profile.plan || 'trial';
        const effectiveDays = (effectivePlan === 'trial' && days === subscriptionDays) ? 3 : days;
        
        // 1. Update backend proxy
        try {
            await fetch(`${proxyBase}/api/members/approve`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ id: profile.id, email: profile.email, days: effectiveDays, plan: effectivePlan })
            });
        } catch (e) {}

        // 2. Update Supabase profiles
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + effectiveDays);

        try {
            const updates = {
                status: 'approved',
                subscription_start: startDate.toISOString(),
                subscription_end: endDate.toISOString(),
                approved_at: new Date().toISOString(),
                plan: effectivePlan
            };
            let query = supabase.from('profiles').update(updates);
            if (profile.id && profile.email) {
                query = query.or(`id.eq.${profile.id},email.eq.${profile.email}`);
            } else if (profile.id) {
                query = query.eq('id', profile.id);
            } else if (profile.email) {
                query = query.eq('email', profile.email);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase approve error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userApproved });
        fetchProfiles();
    };

    const rejectUser = async (profileOrId) => {
        if (!confirm(t.confirmReject)) return;
        const id = typeof profileOrId === 'object' ? profileOrId.id : profileOrId;
        const email = typeof profileOrId === 'object' ? profileOrId.email : null;
        const proxyBase = getProxyBase();

        // 1. Update backend proxy
        try {
            await fetch(`${proxyBase}/api/members/reject`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ id, email })
            });
        } catch (e) {}

        // 2. Update Supabase
        try {
            let query = supabase.from('profiles').update({ status: 'rejected' });
            if (id && email) {
                query = query.or(`id.eq.${id},email.eq.${email}`);
            } else if (id) {
                query = query.eq('id', id);
            } else if (email) {
                query = query.eq('email', email);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase reject error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userRejected });
        fetchProfiles();
    };

    const toggleBan = async (id, isBanned) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_banned: !isBanned })
            .eq('id', id);

        if (error) {
            setStatus({ type: 'error', message: error.message });
        } else {
            fetchProfiles();
        }
    };

    const deleteUser = async (profileOrId) => {
        if (!confirm(t.confirmDelete)) return;
        const id = typeof profileOrId === 'object' ? profileOrId.id : profileOrId;
        const email = typeof profileOrId === 'object' ? profileOrId.email : null;
        const proxyBase = getProxyBase();

        // 1. Delete from backend proxy
        try {
            await fetch(`${proxyBase}/api/members/delete`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ id, email })
            });
        } catch (e) {}

        // 2. Delete from Supabase
        try {
            let query = supabase.from('profiles').delete();
            if (id && email) {
                query = query.or(`id.eq.${id},email.eq.${email}`);
            } else if (id) {
                query = query.eq('id', id);
            } else if (email) {
                query = query.eq('email', email);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase delete error:', sbErr);
        }

        setStatus({ type: 'success', message: t.userDeleted });
        fetchProfiles();
    };

    const updateSubscription = async (profileId, days, plan, userEmail = null, resetExactDays = null) => {
        const proxyBase = getProxyBase();
        
        // 1. Update backend proxy
        try {
            await fetch(`${proxyBase}/api/members/extend`, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ 
                    id: profileId, 
                    email: userEmail,
                    days: days !== undefined && days !== null ? days : null,
                    plan: plan || null,
                    resetDays: resetExactDays || null
                })
            });
        } catch (e) {}

        // 2. Update Supabase
        const updates = {};
        if (resetExactDays) {
            const endDate = new Date(Date.now() + resetExactDays * 24 * 60 * 60 * 1000);
            updates.subscription_end = endDate.toISOString();
        } else if (days !== undefined && days !== null && Number(days) !== 0) {
            const currentProfile = profiles.find(p => p.id === profileId || (userEmail && (p.email || '').toLowerCase() === userEmail.toLowerCase()));
            let baseDate = currentProfile?.subscription_end ? new Date(currentProfile.subscription_end) : new Date();
            if (baseDate < new Date()) baseDate = new Date();
            const endDate = new Date(baseDate.getTime() + Number(days) * 24 * 60 * 60 * 1000);
            updates.subscription_end = endDate.toISOString();
        }
        if (plan) {
            updates.plan = plan;
        }
        updates.status = 'approved';

        try {
            let query = supabase.from('profiles').update(updates);
            if (profileId && userEmail) {
                query = query.or(`id.eq.${profileId},email.eq.${userEmail}`);
            } else if (profileId) {
                query = query.eq('id', profileId);
            } else if (userEmail) {
                query = query.eq('email', userEmail);
            }
            await query;
        } catch (sbErr) {
            console.warn('Supabase update subscription error:', sbErr);
        }

        setStatus({ type: 'success', message: t.subscriptionUpdated });
        setEditingUser(null);
        fetchProfiles();
    };

    const getStatusInfo = (profile) => {
        if (profile.is_banned) {
            return { label: t.statusBanned, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
        }
        if (profile.status === 'rejected') {
            return { label: t.statusRejected, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
        }
        if (profile.status === 'pending' || !profile.status) {
            return { label: t.statusPending, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' };
        }
        if (profile.subscription_end) {
            const endDate = new Date(profile.subscription_end);
            if (endDate < new Date()) {
                return { label: t.statusExpired, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' };
            }
        }
        return { label: t.statusApproved, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    };

    const getRemainingDays = (endDate) => {
        if (!endDate) return '-';
        const end = new Date(endDate);
        const now = new Date();
        const diffMs = end - now;
        if (diffMs <= 0) return lang === 'tr' ? 'Doldu' : 'Expired';
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        if (diffHours <= 24) return `${diffHours} ${lang === 'tr' ? 'saat' : 'hours'}`;
        const diffDays = Math.ceil(diffHours / 24);
        return `${diffDays} ${t.days}`;
    };

    const filteredProfiles = profiles.filter(p => {
        if (activeTab === 'pending') return p.status === 'pending' || (!p.status && !p.is_banned);
        if (activeTab === 'active') {
            const statusInfo = getStatusInfo(p);
            return statusInfo.label === t.statusApproved;
        }
        return true;
    });

    const pendingCount = profiles.filter(p => p.status === 'pending' || (!p.status && !p.is_banned)).length;

    return (
        <div className="admin-container" style={{ color: '#fff' }}>
            {/* Add New Member Form */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--warning-color)' }}>
                <h2 style={{ color: 'var(--warning-color)', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                    {t.title}
                </h2>

                <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(150px, 1fr) 100px 120px 100px', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.email}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="musteri@mail.com"
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.tempPass}</label>
                        <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="sifre123"
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.duration}</label>
                        <select
                            value={subscriptionDays}
                            onChange={(e) => setSubscriptionDays(parseInt(e.target.value))}
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                        >
                            <option value={3}>3 {lang === 'tr' ? 'gün (3 Günlük Deneme / 72s)' : 'days (3-Day Trial / 72h)'}</option>
                            <option value={7}>7 {lang === 'tr' ? 'gün (1 Hafta)' : 'days (1 Week)'}</option>
                            <option value={30}>30 {lang === 'tr' ? 'gün (1 Ay)' : 'days (1 Month)'}</option>
                            <option value={90}>90 {lang === 'tr' ? 'gün (3 Ay)' : 'days (3 Months)'}</option>
                            <option value={180}>180 {lang === 'tr' ? 'gün (6 Ay)' : 'days (6 Months)'}</option>
                            <option value={365}>365 {lang === 'tr' ? 'gün (1 Yıl)' : 'days (1 Year)'}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>{t.plan}</label>
                        <select
                            value={selectedPlan}
                            onChange={(e) => {
                                const p = e.target.value;
                                setSelectedPlan(p);
                                if (p === 'trial') setSubscriptionDays(3);
                                else if (subscriptionDays === 3) setSubscriptionDays(30);
                            }}
                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                        >
                            <option value="trial">Trial (Deneme)</option>
                            <option value="pro">Pro</option>
                            <option value="premium">Premium</option>
                        </select>
                    </div>
                    <button type="submit" style={{ padding: '0.8rem', background: 'var(--warning-color)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
                        {t.addMember}
                    </button>
                </form>

                {status.message && (
                    <div style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '8px', background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)', color: status.type === 'error' ? '#ef4444' : status.type === 'success' ? '#10b981' : '#38bdf8', fontSize: '0.85rem', border: '1px solid currentColor' }}>
                        {status.message}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setActiveTab('pending')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'pending' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'pending' ? '#fbbf24' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'pending' ? '#fbbf24' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {t.tabPending}
                    {pendingCount > 0 && (
                        <span style={{
                            background: '#fbbf24',
                            color: '#000',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 900
                        }}>
                            {pendingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('active')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'active' ? '#10b981' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'active' ? '#10b981' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                    }}
                >
                    {t.tabActive}
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'all' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'all' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                    }}
                >
                    {t.tabAll} ({profiles.length})
                </button>
                <button
                    onClick={() => setActiveTab('upgrades')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'upgrades' ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'upgrades' ? '#a78bfa' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'upgrades' ? '#a78bfa' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {t.tabUpgrades}
                    {upgradeRequests.length > 0 && (
                        <span style={{
                            background: '#a78bfa',
                            color: '#000',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 900
                        }}>
                            {upgradeRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'settings' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'settings' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'settings' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    ⚙️ {t.tabSettings}
                </button>
                <button
                    onClick={() => setActiveTab('telegram')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'telegram' ? 'rgba(37, 211, 102, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'telegram' ? '#25D366' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'telegram' ? '#25D366' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    📱 {t.tabTelegram}
                </button>
                <button
                    onClick={() => { setActiveTab('office'); fetchOfficeStatus(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'office' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(56, 189, 248, 0.2))' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'office' ? '#10b981' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'office' ? '#10b981' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'office' ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                >
                    🤖 {t.tabOffice}
                </button>
                <button
                    onClick={() => setActiveTab('trading_desk')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'trading_desk' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(168, 85, 247, 0.25))' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'trading_desk' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'trading_desk' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: activeTab === 'trading_desk' ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none'
                    }}
                >
                    <span>🏦</span>
                    <span>{lang === 'tr' ? 'BAHİS OFİSİ (KUANT DESK)' : 'SPORTSBOOK DESK'}</span>
                    <span style={{
                        background: '#38bdf8',
                        color: '#000',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '8px',
                        fontSize: '0.65rem',
                        fontWeight: 900
                    }}>
                        PRO
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('web_analytics')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'web_analytics' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'web_analytics' ? '#38bdf8' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'web_analytics' ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    📊 {t.tabWebAnalytics}
                </button>
                <button
                    onClick={() => { setActiveTab('analytics'); loadStrategyAnalytics(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: activeTab === 'analytics' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${activeTab === 'analytics' ? '#eab308' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        color: activeTab === 'analytics' ? '#eab308' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    🎯 {t.tabAnalytics}
                </button>
            </div>

            {/* Content Section */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                {supabaseOffline && profiles.length === 0 && (
                    <div style={{
                        padding: '0.8rem 1.2rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                    }}>
                        <span>💾</span>
                        <span>
                            {lang === 'tr'
                                ? 'Bulut veritabanı beklemede. Sistem yerel/backend depolama modunda sorunsuz çalışmaktadır.'
                                : 'Cloud database is in standby. System running in backend storage mode.'}
                        </span>
                    </div>
                )}
                {activeTab !== 'web_analytics' && activeTab !== 'trading_desk' && (
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 800 }}>
                        {activeTab === 'upgrades' ? t.tabUpgrades : activeTab === 'settings' ? t.tabSettings : activeTab === 'analytics' ? t.strategyScorecardTitle : activeTab === 'office' ? t.tabOffice : t.memberList}
                    </h3>
                )}

                {activeTab === 'web_analytics' ? (
                    <AnalyticsDashboard lang={lang} />
                ) : activeTab === 'trading_desk' ? (
                    <TradingDesk lang={lang} />
                ) : activeTab === 'office' ? (
                    <div style={{ maxWidth: '1100px' }}>
                        {/* Header Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            padding: '1.2rem',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(56, 189, 248, 0.05))',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            marginBottom: '2rem'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⚡</span>
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                                        {lang === 'tr' ? '7/24 OTONOM NÖBET DURUMU' : '24/7 AUTONOMOUS SHIFT STATUS'}
                                    </span>
                                    <span style={{
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '20px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        background: officeStatus?.autoModeEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: officeStatus?.autoModeEnabled ? '#10b981' : '#ef4444',
                                        border: `1px solid ${officeStatus?.autoModeEnabled ? '#10b981' : '#ef4444'}`
                                    }}>
                                        {officeStatus?.autoModeEnabled ? (lang === 'tr' ? 'OTONOM MOD: AKTİF' : 'AUTONOMOUS: ACTIVE') : (lang === 'tr' ? 'OTONOM MOD: DEVRE DIŞI' : 'AUTONOMOUS: DISABLED')}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.3rem' }}>
                                    {lang === 'tr'
                                        ? '3 Görevli (Nöbetçi, Tahsildar, Pazarlamacı) arka planda 60 saniyede bir otonom döngü yürütür.'
                                        : '3 Agents (Sentinel, Cashier, Marketing) run background autonomous cycle every 60s.'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button
                                    onClick={() => handleOfficeAction('toggle_auto_mode')}
                                    disabled={officeActionLoading}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        background: officeStatus?.autoModeEnabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.2)',
                                        color: officeStatus?.autoModeEnabled ? '#ef4444' : '#10b981',
                                        border: `1px solid ${officeStatus?.autoModeEnabled ? '#ef4444' : '#10b981'}`
                                    }}
                                >
                                    {officeStatus?.autoModeEnabled ? (lang === 'tr' ? '⏸️ Otonomu Durdur' : '⏸️ Pause Auto') : (lang === 'tr' ? '▶️ Otonomu Başlat' : '▶️ Resume Auto')}
                                </button>
                                <button
                                    onClick={fetchOfficeStatus}
                                    disabled={officeLoading}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#38bdf8',
                                        border: '1px solid #38bdf8'
                                    }}
                                >
                                    {officeLoading ? '...' : (lang === 'tr' ? '🔄 Yenile' : '🔄 Refresh')}
                                </button>
                            </div>
                        </div>

                        {/* 3 Agents Mission Deck */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            
                            {/* 1. NÖBETÇİ CARD */}
                            <div className="glass-panel" style={{
                                padding: '1.5rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                🛡️ {lang === 'tr' ? 'NÖBETÇİ' : 'SENTINEL'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang === 'tr' ? 'Sistem & Risk Bekçisi' : 'System & Risk Guardian'}</div>
                                        </div>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            background: officeStatus?.sentinel?.status === 'HEALTHY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                            color: officeStatus?.sentinel?.status === 'HEALTHY' ? '#10b981' : '#f59e0b',
                                            border: `1px solid ${officeStatus?.sentinel?.status === 'HEALTHY' ? '#10b981' : '#f59e0b'}`
                                        }}>
                                            {officeStatus?.sentinel?.status || 'HEALTHY'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Canlı Maç Havuzu:' : 'Live Matches:'}</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>{officeStatus?.sentinel?.liveMatchCount || 0} maç</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Veri Tazeliği (Gecikme):' : 'Data Freshness:'}</span>
                                            <span style={{ fontWeight: 800, color: (officeStatus?.sentinel?.sofascoreAgeSec > 180 ? '#f59e0b' : '#10b981') }}>
                                                {officeStatus?.sentinel?.sofascoreAgeSec !== null ? `${officeStatus?.sentinel?.sofascoreAgeSec}s` : 'Beklemede'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Karantinadaki Ligler:' : 'Quarantined Leagues:'}</span>
                                            <span style={{ fontWeight: 800, color: (officeStatus?.sentinel?.quarantinedLeagues?.length > 0 ? '#ef4444' : '#10b981') }}>
                                                {officeStatus?.sentinel?.quarantinedLeagues?.length || 0} lig
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleOfficeAction('sentinel_scan_now')}
                                        disabled={officeActionLoading}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            background: 'rgba(56, 189, 248, 0.15)',
                                            color: '#38bdf8',
                                            border: '1px solid rgba(56, 189, 248, 0.3)',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🔍 {lang === 'tr' ? 'Şimdi Tara' : 'Scan Now'}
                                    </button>
                                    <button
                                        onClick={() => handleOfficeAction('sentinel_heal_locks')}
                                        disabled={officeActionLoading}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🧹 {lang === 'tr' ? 'Kilit Sıfırla' : 'Clear Locks'}
                                    </button>
                                </div>
                            </div>

                            {/* 2. TAHSİLDAR CARD */}
                            <div className="glass-panel" style={{
                                padding: '1.5rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                💰 {lang === 'tr' ? 'TAHSİLDAR' : 'CASHIER'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang === 'tr' ? 'Kasa & Satış Yöneticisi' : 'Sales & Access Bot'}</div>
                                        </div>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#10b981',
                                            border: '1px solid #10b981'
                                        }}>
                                            {lang === 'tr' ? 'NÖBETTE' : 'ACTIVE'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Aktif VIP Üye Sayısı:' : 'Active VIP Members:'}</span>
                                            <span style={{ fontWeight: 800, color: '#10b981' }}>{officeStatus?.cashier?.activeVipCount || 0} üye</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? '3 Günlük Deneme (Aktif / Bitiyor):' : '3-Day Trials (Active/Soon):'}</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>
                                                {officeStatus?.cashier?.activeTrialCount || 0} / <span style={{ color: '#f59e0b' }}>{officeStatus?.cashier?.expiringSoonCount || 0}</span>
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Tahmini MRR (Aylık Gelir):' : 'Estimated MRR:'}</span>
                                            <span style={{ fontWeight: 800, color: '#38bdf8' }}>{officeStatus?.cashier?.estimatedMrr || '€0.00'}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOfficeAction('cashier_send_campaign')}
                                    disabled={officeActionLoading}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: '6px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🚀 {lang === 'tr' ? 'Biten Denemelere Kampanya At' : 'Offer Expired Trials'}
                                </button>
                            </div>

                            {/* 3. PAZARLAMACI CARD */}
                            <div className="glass-panel" style={{
                                padding: '1.5rem',
                                borderRadius: '14px',
                                border: '1px solid rgba(167, 139, 250, 0.25)',
                                background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                📢 {lang === 'tr' ? 'PAZARLAMACI' : 'MARKETING'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang === 'tr' ? 'FOMO & Sosyal Kanıt Botu' : 'FOMO & Social Proof Bot'}</div>
                                        </div>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            background: 'rgba(167, 139, 250, 0.2)',
                                            color: '#a78bfa',
                                            border: '1px solid #a78bfa'
                                        }}>
                                            {lang === 'tr' ? 'HAZIR' : 'READY'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Bugünkü Skor (K/K):' : 'Today W/L:'}</span>
                                            <span style={{ fontWeight: 800, color: '#10b981' }}>
                                                {officeStatus?.marketing?.todayWon || 0}W / {officeStatus?.marketing?.todayLost || 0}L (%{officeStatus?.marketing?.winRate || '0.0'})
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Basılan FOMO Afişi:' : 'FOMO Cards Sent:'}</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>{officeStatus?.marketing?.fomoCardsDispatched || 0} adet</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                                            <span style={{ opacity: 0.7 }}>{lang === 'tr' ? 'Son Sinyal:' : 'Last Signal:'}</span>
                                            <span style={{ fontWeight: 800, color: '#38bdf8', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {officeStatus?.marketing?.lastSignal || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOfficeAction('marketing_daily_recap')}
                                    disabled={officeActionLoading}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: '6px',
                                        background: 'rgba(167, 139, 250, 0.15)',
                                        color: '#a78bfa',
                                        border: '1px solid rgba(167, 139, 250, 0.3)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    📢 {lang === 'tr' ? 'Günün ROI Raporunu Kanala Fırlat' : 'Broadcast Daily ROI Recap'}
                                </button>
                            </div>
                        </div>

                        {/* LIVE ACTION FEED (Console Log) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>📜</span>
                                    <span>{lang === 'tr' ? 'OTONOM OLAY VE KARAR AKIŞI' : 'AUTONOMOUS DECISION & ACTION FEED'}</span>
                                </div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{lang === 'tr' ? 'Son 30 Aksiyon' : 'Last 30 Actions'}</span>
                            </div>

                            <div style={{
                                background: '#0a0f1d',
                                borderRadius: '10px',
                                padding: '1rem',
                                maxHeight: '320px',
                                overflowY: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                {(!officeStatus?.recentLogs || officeStatus.recentLogs.length === 0) ? (
                                    <div style={{ opacity: 0.4, textAlign: 'center', padding: '1rem' }}>
                                        {lang === 'tr' ? 'Henüz kaydedilmiş otonom işlem bulunmuyor.' : 'No recorded autonomous actions yet.'}
                                    </div>
                                ) : (
                                    officeStatus.recentLogs.map((log) => {
                                        const agentColors = {
                                            SENTINEL: '#38bdf8',
                                            CASHIER: '#10b981',
                                            MARKETING: '#a78bfa',
                                            OFFICE: '#f59e0b'
                                        };
                                        const color = agentColors[log.agent] || '#94a3b8';
                                        const time = new Date(log.timestamp).toLocaleTimeString('tr-TR');

                                        return (
                                            <div key={log.id} style={{
                                                display: 'flex',
                                                gap: '0.8rem',
                                                padding: '0.4rem 0',
                                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                                alignItems: 'flex-start'
                                            }}>
                                                <span style={{ color: '#64748b', flexShrink: 0 }}>[{time}]</span>
                                                <span style={{
                                                    color,
                                                    fontWeight: 700,
                                                    flexShrink: 0,
                                                    padding: '0 4px',
                                                    background: `${color}15`,
                                                    borderRadius: '4px'
                                                }}>
                                                    {log.agent}
                                                </span>
                                                <span style={{ color: '#e2e8f0', flex: 1 }}>{log.message}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : loading ? (
                    <p>{t.loading}</p>
                ) : activeTab === 'upgrades' ? (
                    upgradeRequests.length === 0 ? (
                        <p style={{ color: '#64748b' }}>{t.noUsers}</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                        <th style={{ padding: '1rem' }}>{t.emailCol}</th>
                                        <th style={{ padding: '1rem' }}>{t.currentPlan}</th>
                                        <th style={{ padding: '1rem' }}>{t.requestedPlan}</th>
                                        <th style={{ padding: '1rem' }}>{t.dateCol}</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>{t.actionsCol}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upgradeRequests.map(req => (
                                        <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{req.email}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                                                    {(req.current_plan || 'trial').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                                                    {(req.requested_plan || '').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(req.created_at).toLocaleDateString('tr-TR')}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => approveUpgrade(req)}
                                                        style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                    >
                                                        {t.approve}
                                                    </button>
                                                    <button
                                                        onClick={() => rejectUpgrade(req.id)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                    >
                                                        {t.reject}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : activeTab === 'settings' ? (
                    <div style={{ maxWidth: '800px' }}>
                        {/* MODULAR STRATEGY GRID (v2.1) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {t.strategyTitle}
                            </h3>
                            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '1.5rem' }}>{t.strategyDesc}</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                <StrategyToggle label={t.onlyXG} active={strategySettings.ONLY_XG} onToggle={() => handleToggleStrategy('ONLY_XG')} highlight />
                                <StrategyToggle label={t.stratPress} active={strategySettings.PRESS} onToggle={() => handleToggleStrategy('PRESS')} />
                                <StrategyToggle label={t.stratMomentum} active={strategySettings.MOMENTUM} onToggle={() => handleToggleStrategy('MOMENTUM')} />
                                <StrategyToggle label={t.stratFHG} active={strategySettings.FHG} onToggle={() => handleToggleStrategy('FHG')} />
                                <StrategyToggle label={t.stratComeback} active={strategySettings.COMEBACK} onToggle={() => handleToggleStrategy('COMEBACK')} />
                                <StrategyToggle label={t.stratStats} active={strategySettings.STATS} onToggle={() => handleToggleStrategy('STATS')} />
                                <StrategyToggle label={t.stratCorners} active={strategySettings.CORNERS} onToggle={() => handleToggleStrategy('CORNERS')} />
                                <StrategyToggle label={t.stratBTTS} active={strategySettings.BTTS} onToggle={() => handleToggleStrategy('BTTS')} />
                                <StrategyToggle label={t.stratRedCard} active={strategySettings.RED_CARD_ADV !== false} onToggle={() => handleToggleStrategy('RED_CARD_ADV')} />
                            </div>
                        </div>

                        <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.telegramSupport}</label>
                                    <input
                                        type="text"
                                        placeholder="@Livebetdeskbot"
                                        value={systemSettings.telegram_support || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, telegram_support: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.supportEmail}</label>
                                    <input
                                        type="email"
                                        value={systemSettings.support_email || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, support_email: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                                    💳 {lang === 'tr' ? 'Shopier Kredi Kartı Ödeme / Mağaza Linki' : 'Shopier Payment / Store Link'}
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://www.shopier.com/QuantDataLabs"
                                    value={systemSettings.shopier_link || ''}
                                    onChange={(e) => setSystemSettings({ ...systemSettings, shopier_link: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                />
                                <span style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '0.3rem', display: 'block' }}>
                                    {lang === 'tr' ? 'Kullanıcılar web panelinde veya Telegram botunda kredi kartı ile öde butonuna bastığında bu linke yönlendirilir.' : 'Users will be redirected to this URL when clicking Pay with Card.'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.proPrice}</label>
                                    <input
                                        type="text"
                                        value={systemSettings.price_pro || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, price_pro: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.premiumPrice}</label>
                                    <input
                                        type="text"
                                        value={systemSettings.price_premium || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, price_premium: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{t.currency}</label>
                                    <input
                                        type="text"
                                        value={systemSettings.price_currency || ''}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, price_currency: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={settingsLoading}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--accent-color)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    cursor: settingsLoading ? 'not-allowed' : 'pointer',
                                    marginTop: '1rem',
                                    opacity: settingsLoading ? 0.7 : 1
                                }}
                            >
                                {settingsLoading ? t.loading : t.saveSettings}
                            </button>
                        </form>
                    </div>
                ) : activeTab === 'telegram' ? (
                    <div style={{ maxWidth: '800px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div className="stats-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t.botStatus}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: telegramStatus?.enabled ? '#10b981' : '#ef4444', boxShadow: telegramStatus?.enabled ? '0 0 10px #10b981' : 'none' }}></div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: telegramStatus?.enabled ? '#10b981' : '#ef4444' }}>
                                        {telegramStatus?.enabled ? t.botActive : t.botInactive}
                                    </div>
                                </div>
                            </div>
                            <div className="stats-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t.signalsToday}</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-color)' }}>{telegramStatus?.todaySignals || 0}</div>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '1.2rem', opacity: 0.8 }}>Bot Konfigürasyonu</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>{t.vipGroupId} (TR / EN / DE)</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                            🇹🇷 {telegramStatus?.vipChannels?.tr || telegramStatus?.vipGroup || '-'}
                                        </div>
                                        {telegramStatus?.vipChannels?.en && (
                                            <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                                                🇬🇧 {telegramStatus.vipChannels.en}
                                            </div>
                                        )}
                                        {telegramStatus?.vipChannels?.de && (
                                            <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '2px' }}>
                                                🇩🇪 {telegramStatus.vipChannels.de}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>{t.publicChannel}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{telegramStatus?.publicChannel || 'Ayarlanmadı'}</div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>{t.minLevel}</div>
                                        <div style={{ display: 'inline-block', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900 }}>
                                            {telegramStatus?.minLevel || 'SICAK'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.4rem' }}>
                                            {lang === 'tr' ? 'Telegram Yayın Dili' : lang === 'de' ? 'Telegram Übertragungssprache' : 'Telegram Broadcast Language'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateTelegramLang('tr')}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    border: (telegramStatus?.lang === 'tr' || !telegramStatus?.lang) ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                                    background: (telegramStatus?.lang === 'tr' || !telegramStatus?.lang) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                                                    color: (telegramStatus?.lang === 'tr' || !telegramStatus?.lang) ? '#10b981' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🇹🇷 Türkçe
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateTelegramLang('en')}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    border: telegramStatus?.lang === 'en' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                                                    background: telegramStatus?.lang === 'en' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.02)',
                                                    color: telegramStatus?.lang === 'en' ? '#38bdf8' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🇬🇧 English
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateTelegramLang('de')}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    border: telegramStatus?.lang === 'de' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                                                    background: telegramStatus?.lang === 'de' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.02)',
                                                    color: telegramStatus?.lang === 'de' ? '#f59e0b' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🇩🇪 Deutsch
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleSendTelegramReport}
                                disabled={telegramLoading || !telegramStatus?.enabled}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: '#25D366',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 900,
                                    fontSize: '0.85rem',
                                    cursor: (telegramLoading || !telegramStatus?.enabled) ? 'not-allowed' : 'pointer',
                                    opacity: (telegramLoading || !telegramStatus?.enabled) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.6rem'
                                }}
                            >
                                📊 {telegramLoading ? t.loading : t.sendTestReport}
                            </button>
                            <button
                                onClick={fetchTelegramStatus}
                                style={{
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 {t.refreshStatus}
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'analytics' ? (
                    <div>
                        {(() => {
                            const totalBets = strategyAnalytics.reduce((acc, s) => acc + (s.totalBets || 0), 0);
                            const totalStaked = strategyAnalytics.reduce((acc, s) => acc + (s.staked || 0), 0);
                            const totalProfit = strategyAnalytics.reduce((acc, s) => acc + (s.profit || 0), 0);
                            const avgRoi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : '0.0';
                            const topStrat = strategyAnalytics.filter(s => s.totalBets > 0).sort((a, b) => b.roi - a.roi)[0];
                            const clv = bankrollManager.getCLVAnalytics();

                            return (
                                <>
                                    {/* KPI Summary Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem', marginBottom: '2rem' }}>
                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.totalStaked}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>₺{totalStaked.toLocaleString('tr-TR')}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>{totalBets} {t.betsCol.toLowerCase()}</div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.totalProfit}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                                {totalProfit >= 0 ? `+₺${totalProfit.toLocaleString('tr-TR')}` : `-₺${Math.abs(totalProfit).toLocaleString('tr-TR')}`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: totalProfit >= 0 ? '#10b981' : '#ef4444', marginTop: '0.2rem' }}>
                                                {totalProfit >= 0 ? '▲ Kârda' : '▼ Zararda'}
                                            </div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.avgRoi}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: parseFloat(avgRoi) >= 0 ? '#38bdf8' : '#ef4444' }}>
                                                %{avgRoi}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Kümülatif Getiri</div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.clvTitle}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: clv.avgCLV >= 0 ? '#10b981' : '#ef4444' }}>
                                                {clv.avgCLV >= 0 ? `+${clv.avgCLV}%` : `${clv.avgCLV}%`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                %{clv.beatMarketPct} {t.clvBeat}
                                            </div>
                                        </div>

                                        <div className="stats-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{t.topStrategy}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span>{topStrat ? topStrat.icon : '🎯'}</span>
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topStrat ? topStrat.label : 'Veri Bekleniyor'}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                {topStrat ? `%${topStrat.roi} ROI (${topStrat.totalBets} bahis)` : 'Sinyal bekleniyor'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                                            {t.strategyScorecardDesc}
                                        </p>
                                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                                            <button
                                                onClick={loadStrategyAnalytics}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: 'rgba(56, 189, 248, 0.1)',
                                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                                    borderRadius: '8px',
                                                    color: '#38bdf8',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🔄 Yenile
                                            </button>
                                            <button
                                                onClick={handleResetStrategyStats}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    borderRadius: '8px',
                                                    color: '#ef4444',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️ {t.resetStats}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scorecard Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '0.9rem' }}>{t.stratCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.betsCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.winLossCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'right' }}>{t.stakedCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'right' }}>{t.profitCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.winRateCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'right' }}>{t.roiCol}</th>
                                                    <th style={{ padding: '0.9rem', textAlign: 'center' }}>{t.badgeCol}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {strategyAnalytics.map(strat => {
                                                    const badgeBg = strat.badge === 'A+' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 179, 8, 0.15))'
                                                        : strat.badge === 'A' ? 'rgba(16, 185, 129, 0.2)'
                                                        : strat.badge === 'B' ? 'rgba(56, 189, 248, 0.15)'
                                                        : 'rgba(255, 255, 255, 0.05)';
                                                    const badgeColor = strat.badge === 'A+' ? '#fbbf24'
                                                        : strat.badge === 'A' ? '#10b981'
                                                        : strat.badge === 'B' ? '#38bdf8'
                                                        : '#64748b';
                                                    const badgeBorder = strat.badge === 'A+' ? '1px solid rgba(251, 191, 36, 0.4)'
                                                        : strat.badge === 'A' ? '1px solid rgba(16, 185, 129, 0.3)'
                                                        : strat.badge === 'B' ? '1px solid rgba(56, 189, 248, 0.2)'
                                                        : '1px solid rgba(255, 255, 255, 0.1)';

                                                    return (
                                                        <tr key={strat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                                                            <td style={{ padding: '1rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                    <span style={{ fontSize: '1.2rem' }}>{strat.icon}</span>
                                                                    <div>
                                                                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>{strat.label}</div>
                                                                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace' }}>ID: {strat.id}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: strat.totalBets > 0 ? '#fff' : '#64748b' }}>
                                                                {strat.totalBets}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem' }}>
                                                                <span style={{ color: '#10b981', fontWeight: 700 }}>{strat.wins || 0}W</span>
                                                                <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                                                                <span style={{ color: '#ef4444', fontWeight: 700 }}>{strat.losses || 0}L</span>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                                                ₺{(strat.staked || 0).toLocaleString('tr-TR')}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: (strat.profit || 0) > 0 ? '#10b981' : (strat.profit || 0) < 0 ? '#ef4444' : '#94a3b8' }}>
                                                                {(strat.profit || 0) > 0 ? `+₺${strat.profit.toLocaleString('tr-TR')}` : (strat.profit || 0) < 0 ? `-₺${Math.abs(strat.profit).toLocaleString('tr-TR')}` : '₺0'}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: '70px' }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: strat.winRate >= 60 ? '#10b981' : strat.winRate >= 40 ? '#38bdf8' : strat.totalBets === 0 ? '#64748b' : '#ef4444' }}>
                                                                        %{strat.winRate}
                                                                    </span>
                                                                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                        <div style={{ width: `${strat.winRate}%`, height: '100%', background: strat.winRate >= 60 ? '#10b981' : '#38bdf8' }}></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem', color: strat.roi > 0 ? '#10b981' : strat.roi < 0 ? '#ef4444' : '#64748b' }}>
                                                                {strat.roi > 0 ? `+${strat.roi}%` : `${strat.roi}%`}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '0.25rem 0.65rem',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 900,
                                                                    background: badgeBg,
                                                                    color: badgeColor,
                                                                    border: badgeBorder,
                                                                    display: 'inline-block',
                                                                    minWidth: '38px'
                                                                }}>
                                                                    {strat.badge}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ) : filteredProfiles.length === 0 ? (
                    <p style={{ color: '#64748b' }}>{t.noUsers}</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>
                                    <th style={{ padding: '1rem' }}>{t.emailCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.dateCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.statusCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.planCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.expiryCol}</th>
                                    <th style={{ padding: '1rem' }}>{t.remainingCol}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>{t.actionsCol}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProfiles.map(profile => {
                                    const statusInfo = getStatusInfo(profile);
                                    const isEditing = editingUser === profile.id;
                                    const planInfo = PLANS[profile.plan] || PLANS.trial;

                                    return (
                                        <tr key={profile.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{profile.email}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(profile.created_at).toLocaleDateString('tr-TR')}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.8rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    background: statusInfo.bg,
                                                    color: statusInfo.color
                                                }}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 900,
                                                    background: planInfo.color + '15',
                                                    color: planInfo.color,
                                                    border: `1px solid ${planInfo.color}30`
                                                }}>
                                                    {planInfo.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                                {profile.subscription_end ? new Date(profile.subscription_end).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                                {getRemainingDays(profile.subscription_end)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', position: 'relative' }}>
                                                    {(profile.status === 'pending' || !profile.status) && !profile.is_banned && (
                                                        <>
                                                            <button
                                                                onClick={() => approveUser(profile, profile.plan === 'trial' ? 3 : subscriptionDays, profile.plan || selectedPlan)}
                                                                title={t.approve}
                                                                style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#10b981', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                                                            >
                                                                {t.approve}
                                                            </button>
                                                            <button
                                                                onClick={() => rejectUser(profile.id)}
                                                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                                                            >
                                                                {t.reject}
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* Edit Mode */}
                                                    {profile.status === 'approved' && !profile.is_banned && (
                                                        isEditing ? (
                                                            <div style={{
                                                                position: 'absolute',
                                                                right: 0,
                                                                top: 'calc(100% + 6px)',
                                                                background: 'rgba(15, 23, 42, 0.98)',
                                                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                                                borderRadius: '12px',
                                                                padding: '1rem',
                                                                zIndex: 100,
                                                                boxShadow: '0 20px 40px rgba(0,0,0,0.85), 0 0 25px rgba(56, 189, 248, 0.2)',
                                                                minWidth: '340px',
                                                                textAlign: 'left',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '0.75rem',
                                                                backdropFilter: 'blur(16px)'
                                                            }}>
                                                                {/* Header info */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>
                                                                        ⚙️ {lang === 'tr' ? 'Üyelik & Süre Yönetimi' : 'Manage Subscription'}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                                                        {getRemainingDays(profile.subscription_end)} {lang === 'tr' ? 'kaldı' : 'left'}
                                                                    </div>
                                                                </div>

                                                                {/* 1. Hızlı 1-Tık Presetler (Paket + Süre Birlikte) */}
                                                                <div>
                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.5px' }}>
                                                                        ⚡ {lang === 'tr' ? 'Hızlı Paket Tanımla (Paket + Süre)' : 'Quick Presets (Plan + Days)'}
                                                                    </div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateSubscription(profile.id, null, 'trial', profile.email, 3)}
                                                                            title={lang === 'tr' ? '3 Günlük Deneme başlatır' : 'Start 3-day trial'}
                                                                            style={{
                                                                                background: profile.plan === 'trial' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.1)',
                                                                                border: `1px solid ${profile.plan === 'trial' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}`,
                                                                                color: '#10b981',
                                                                                padding: '0.45rem 0.3rem',
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.62rem',
                                                                                fontWeight: 800,
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                alignItems: 'center',
                                                                                gap: '2px'
                                                                            }}
                                                                        >
                                                                            <span>⚡ {lang === 'tr' ? '3G Deneme' : '3D Trial'}</span>
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.8 }}>(72 Saat)</span>
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateSubscription(profile.id, null, 'pro', profile.email, 30)}
                                                                            title={lang === 'tr' ? '1 Aylık PRO tanımlar' : 'Assign 1-Month Pro'}
                                                                            style={{
                                                                                background: profile.plan === 'pro' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.1)',
                                                                                border: `1px solid ${profile.plan === 'pro' ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}`,
                                                                                color: '#38bdf8',
                                                                                padding: '0.45rem 0.3rem',
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.62rem',
                                                                                fontWeight: 800,
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                alignItems: 'center',
                                                                                gap: '2px'
                                                                            }}
                                                                        >
                                                                            <span>👑 {lang === 'tr' ? '1 Ay PRO' : '1 Mo PRO'}</span>
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.8 }}>(30 Gün)</span>
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateSubscription(profile.id, null, 'premium', profile.email, 30)}
                                                                            title={lang === 'tr' ? '1 Aylık PREMIUM tanımlar' : 'Assign 1-Month Premium'}
                                                                            style={{
                                                                                background: profile.plan === 'premium' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.1)',
                                                                                border: `1px solid ${profile.plan === 'premium' ? '#a855f7' : 'rgba(168, 85, 247, 0.3)'}`,
                                                                                color: '#c084fc',
                                                                                padding: '0.45rem 0.3rem',
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.62rem',
                                                                                fontWeight: 800,
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                alignItems: 'center',
                                                                                gap: '2px'
                                                                            }}
                                                                        >
                                                                            <span>💎 {lang === 'tr' ? '1 Ay VIP' : '1 Mo VIP'}</span>
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.8 }}>(30 Gün)</span>
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* 2. Mevcut Bitiş Tarihine Gün Ekle */}
                                                                <div>
                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.5px' }}>
                                                                        ⏳ {lang === 'tr' ? 'Mevcut Süreye Gün Ekle (+ Gün)' : 'Extend Current Duration (+ Days)'}
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                                        {[
                                                                            { d: 1, label: '+1g' },
                                                                            { d: 3, label: lang === 'tr' ? '+3g (Deneme)' : '+3d (Trial)' },
                                                                            { d: 7, label: lang === 'tr' ? '+7g (1 Hf)' : '+7d (1 Wk)' },
                                                                            { d: 30, label: lang === 'tr' ? '+30g (1 Ay)' : '+30d (1 Mo)' },
                                                                            { d: 90, label: lang === 'tr' ? '+90g (3 Ay)' : '+90d (3 Mo)' },
                                                                            { d: 365, label: lang === 'tr' ? '+365g (1 Yıl)' : '+365d (1 Yr)' }
                                                                        ].map(item => (
                                                                            <button
                                                                                key={item.d}
                                                                                type="button"
                                                                                onClick={() => updateSubscription(profile.id, item.d, null, profile.email)}
                                                                                style={{
                                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                                    padding: '0.35rem 0.55rem',
                                                                                    borderRadius: '5px',
                                                                                    color: '#e2e8f0',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '0.62rem',
                                                                                    fontWeight: 700,
                                                                                    transition: 'all 0.15s'
                                                                                }}
                                                                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.color = '#38bdf8'; }}
                                                                                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#e2e8f0'; }}
                                                                            >
                                                                                {item.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* 3. Sadece Plan Değiştir */}
                                                                <div>
                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.5px' }}>
                                                                        🏷️ {lang === 'tr' ? 'Sadece Paketi Değiştir (Süreyi Koru)' : 'Change Plan Only (Keep Days)'}
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                                        {Object.keys(PLANS).filter(k => k !== 'admin').map(p => {
                                                                            const isCurrent = profile.plan === p;
                                                                            return (
                                                                                <button
                                                                                    key={p}
                                                                                    type="button"
                                                                                    onClick={() => updateSubscription(profile.id, null, p, profile.email)}
                                                                                    style={{
                                                                                        flex: 1,
                                                                                        background: isCurrent ? PLANS[p].color : 'transparent',
                                                                                        color: isCurrent ? '#000' : PLANS[p].color,
                                                                                        border: `1px solid ${PLANS[p].color}`,
                                                                                        padding: '0.35rem 0.5rem',
                                                                                        borderRadius: '5px',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '0.62rem',
                                                                                        fontWeight: 800,
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        gap: '3px'
                                                                                    }}
                                                                                >
                                                                                    {isCurrent && <span>✓</span>}
                                                                                    <span>{PLANS[p].label}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                {/* Kapat / Vazgeç */}
                                                                <div style={{ textAlign: 'right', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingUser(null)}
                                                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}
                                                                    >
                                                                        ✕ {lang === 'tr' ? 'Kapat / Vazgeç' : 'Close'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setEditingUser(profile.id)}
                                                                style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                                                            >
                                                                {t.extend} / {t.plan}
                                                            </button>
                                                        )
                                                    )}

                                                    {!isEditing && (
                                                        <>
                                                            {/* Ban/Unban */}
                                                            <button
                                                                onClick={() => toggleBan(profile.id, profile.is_banned)}
                                                                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.65rem' }}
                                                            >
                                                                {profile.is_banned ? t.unban : t.ban}
                                                            </button>

                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => deleteUser(profile.id)}
                                                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem' }}
                                                            >
                                                                {t.delete}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div >
    );
};

const StrategyToggle = ({ label, active, onToggle, highlight = false }) => (
    <div 
        onClick={onToggle}
        style={{ 
            padding: '1rem', 
            background: active ? (highlight ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.1)') : 'rgba(0,0,0,0.2)',
            border: `1px solid ${active ? (highlight ? '#a78bfa' : '#38bdf8') : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            boxShadow: active ? `0 4px 15px ${highlight ? 'rgba(167, 139, 250, 0.1)' : 'rgba(56, 189, 248, 0.1)'}` : 'none'
        }}
    >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: active ? '#fff' : '#64748b' }}>{label}</span>
        <div style={{ 
            width: '36px', 
            height: '20px', 
            background: active ? (highlight ? '#a78bfa' : '#38bdf8') : '#334155',
            borderRadius: '10px',
            position: 'relative',
            transition: 'background 0.2s'
        }}>
            <div style={{ 
                width: '14px', 
                height: '14px', 
                background: '#fff', 
                borderRadius: '50%',
                position: 'absolute',
                top: '3px',
                left: active ? '19px' : '3px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}></div>
        </div>
    </div>
);

export default AdminPanel;
