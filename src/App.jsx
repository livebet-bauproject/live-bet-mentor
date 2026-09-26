import React, { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { LandingPage } from './components/LandingPage'
import { LiveSupportChat } from './components/LiveSupportChat'
import { supabase } from './backend/supabaseClient'
import { translations } from './locales/translations'
import { CONFIG } from './config'
import { initAnalytics, trackPageView, updateAnalyticsUser, trackAnalyticsEvent } from './utils/analyticsTracker'
import './styles/global.css'

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.')
);

const proxyBase = isLocal ? 'http://localhost:3001' : ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'https://live-bet-mentor.onrender.com');


const resolveTelegramAdminQuickAuth = () => {
  if (typeof window === 'undefined') return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    if (!auth) return null;

    const parts = auth.trim().split('.');
    if (parts.length >= 2) {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) {
        b64 += '=';
      }
      const rawPayload = window.atob(b64);
      const jsonStr = decodeURIComponent(
        rawPayload.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      const payload = JSON.parse(jsonStr);

      if (
        (payload.role === 'admin' || payload.purpose === 'quick_support' || payload.email === 'admin@livebetmentor.com') &&
        (!payload.exp || Date.now() < (payload.exp > 10000000000 ? payload.exp : payload.exp * 1000))
      ) {
        const sessionPayload = {
          user: {
            id: payload.id || 'admin-super',
            email: payload.email || 'admin@livebetmentor.com',
            plan: 'admin',
            role: 'admin',
            display_name: 'LiveBet Admin',
            status: 'active',
            subscription_end: '2099-12-31T23:59:59.000Z'
          },
          token: auth
        };
        try {
          localStorage.setItem('lbm_admin_session', JSON.stringify(sessionPayload));
        } catch (e) {}
        return sessionPayload;
      }
    }
  } catch (e) {
    console.warn('[AUTH] Quick auth sync decoding error:', e);
  }
  return null;
};

function App() {
  const [session, setSession] = useState(() => {
    try {
      const quickSession = resolveTelegramAdminQuickAuth();
      if (quickSession) return quickSession;

      const savedAdmin = localStorage.getItem('lbm_admin_session');
      if (savedAdmin) {
        const parsed = JSON.parse(savedAdmin);
        if (parsed?.user?.email === 'admin@livebetmentor.com' || parsed?.user?.plan === 'admin' || parsed?.user?.id?.startsWith('admin-')) {
          return parsed;
        }
      }
      const savedMember = localStorage.getItem('lbm_member_session');
      if (savedMember) {
        const parsed = JSON.parse(savedMember);
        if (parsed?.user) return parsed;
      }
    } catch (e) {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('auth')) return false;
    }
    return !localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session');
  });
  const [page, setPage] = useState(() => {
    try {
      const quickSession = resolveTelegramAdminQuickAuth();
      if (quickSession) return 'dashboard';

      const savedAdmin = localStorage.getItem('lbm_admin_session');
      if (savedAdmin) return 'dashboard';
      const savedMember = localStorage.getItem('lbm_member_session');
      if (savedMember) {
        const parsed = JSON.parse(savedMember);
        const prof = parsed.memberProfile || parsed.user;
        if (prof?.status === 'pending') return 'pending';
        if (prof?.subscription_end && new Date(prof.subscription_end) < new Date()) return 'expired';
        return 'dashboard';
      }
    } catch (e) {}
    return 'landing';
  });
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const quickSession = resolveTelegramAdminQuickAuth();
      if (quickSession) return quickSession.user;

      const savedAdmin = localStorage.getItem('lbm_admin_session');
      if (savedAdmin) {
        return {
          id: 'admin-super',
          email: 'admin@livebetmentor.com',
          status: 'active',
          plan: 'admin',
          display_name: 'LiveBet Admin',
          subscription_end: '2099-12-31T23:59:59.000Z'
        };
      }
      const savedMember = localStorage.getItem('lbm_member_session');
      if (savedMember) {
        const parsed = JSON.parse(savedMember);
        const prof = parsed.memberProfile || parsed.user;
        return {
          id: parsed.user?.id,
          email: parsed.user?.email,
          status: prof?.status || 'approved',
          plan: prof?.plan || 'trial',
          display_name: parsed.user?.user_metadata?.display_name || prof?.full_name || parsed.user?.email?.split('@')[0],
          subscription_end: prof?.subscription_end
        };
      }
    } catch (e) {}
    return null;
  });
  const [systemSettings, setSystemSettings] = useState({})
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false)
  const [lang, setLang] = useState(() => {
    try {
      // 1. Check URL Search Param (?lang=tr|en|de) for Search Engine Crawlers & Direct Links
      if (typeof window !== 'undefined' && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const paramLang = urlParams.get('lang')?.toLowerCase();
        if (paramLang && (paramLang === 'tr' || paramLang === 'en' || paramLang === 'de')) {
          return paramLang;
        }
      }
      // 2. Check localStorage
      const saved = localStorage.getItem('app_lang');
      if (saved && (saved === 'tr' || saved === 'en' || saved === 'de')) {
        return saved;
      }
      // 3. Detect browser / device primary language
      const browserLang = (typeof navigator !== 'undefined' && (
        (navigator.languages && navigator.languages[0]) || navigator.language || ''
      )) || '';
      const lower = browserLang.toLowerCase();
      if (lower.startsWith('tr')) return 'tr';
      if (lower.startsWith('de')) return 'de';
      return 'en';
    } catch {
      return 'en';
    }
  });

  // Dynamic SEO Synchronization Hook (Title, Description, Canonical, OG tags, Hreflang)
  useEffect(() => {
    try {
      localStorage.setItem('app_lang', lang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;

        const metaConfigs = {
          tr: {
            title: 'LiveBet Mentor | Canlı Maç İstatistikleri, xG & AI Analiz Terminali',
            desc: 'Yapay zeka ve Poisson modelleriyle desteklenen canlı maç analiz terminali. Canlı xG gol beklentisi, anlık atak momentumu, Kelly kriteri kasa yönetimi ve kantitatif spor istatistikleri.',
            locale: 'tr_TR'
          },
          en: {
            title: 'LiveBet Mentor | In-Play Football Stats, xG & AI Quant Terminal',
            desc: 'Quantitative in-play football terminal powered by Poisson models, real-time xG goal telemetry, live momentum waves, and Kelly Criterion bankroll discipline.',
            locale: 'en_US'
          },
          de: {
            title: 'LiveBet Mentor | Live In-Play Statistiken, xG & KI-Quant-Terminal',
            desc: 'Quantitatives Live-Fussball-Terminal mit Poisson-Modellen, Echtzeit-xG-Telemetrie, Live-Druckwellen und Kelly-Kriterium-Bankroll-Disziplin.',
            locale: 'de_DE'
          }
        };

        const currentMeta = metaConfigs[lang] || metaConfigs['en'];
        document.title = currentMeta.title;

        // Sync Meta Description
        const descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.setAttribute('content', currentMeta.desc);

        // Sync Open Graph & Twitter Titles
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', currentMeta.title);
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', currentMeta.desc);
        const ogLocale = document.querySelector('meta[property="og:locale"]');
        if (ogLocale) ogLocale.setAttribute('content', currentMeta.locale);
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.setAttribute('content', currentMeta.title);
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.setAttribute('content', currentMeta.desc);

        // Sync Canonical Link
        const canonicalUrl = `https://livebetmentor.com/${lang === 'tr' ? '' : '?lang=' + lang}`;
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        if (canonicalEl) canonicalEl.setAttribute('href', canonicalUrl);

        // Sync URL param without full page reload if user toggled
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          const url = new URL(window.location.href);
          if (lang === 'tr') {
            url.searchParams.delete('lang');
          } else {
            url.searchParams.set('lang', lang);
          }
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (e) {
      console.warn('SEO & Lang sync error:', e);
    }
  }, [lang]);

  // One-Click Telegram-to-Web Admin Quick-Auth & Deep-Link Handler
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const auth = urlParams.get('auth');
      const tab = urlParams.get('tab');
      
      const quick = resolveTelegramAdminQuickAuth();
      if (quick) {
        setSession(quick);
        setUserProfile(quick.user);
        setPage('dashboard');
        setLoading(false);
      } else if (auth) {
        fetch(`${proxyBase}/api/admin/quick-auth?token=${encodeURIComponent(auth)}`)
          .then(res => res.json())
          .then(data => {
            if (data?.success && data?.user && data?.token) {
              const sessionPayload = { user: data.user, token: data.token };
              localStorage.setItem('lbm_admin_session', JSON.stringify(sessionPayload));
              setSession(sessionPayload);
              setUserProfile({
                id: data.user.id || 'admin-super',
                email: data.user.email,
                status: 'active',
                plan: 'admin',
                display_name: data.user.display_name || 'LiveBet Admin',
                subscription_end: '2099-12-31T23:59:59.000Z'
              });
              setPage('dashboard');
            }
          })
          .catch(err => {
            console.error('[AUTH] Quick auth verification failed:', err);
          });
      } else if (tab === 'support_staff' || tab === 'support') {
        const savedAdmin = localStorage.getItem('lbm_admin_session');
        if (savedAdmin) {
          setPage('dashboard');
        }
      }
    } catch (e) {}
  }, []);

  // Initialize in-house cookieless analytics tracker
  useEffect(() => {
    initAnalytics({ userProfile });
  }, []);

  // Synchronize user profile updates with analytics context
  useEffect(() => {
    if (userProfile) {
      updateAnalyticsUser(userProfile);
    }
  }, [userProfile]);

  // Track pageview on page transitions (landing, dashboard, pending, expired)
  useEffect(() => {
    const titles = {
      landing: 'LiveBet Mentor | Canlı İstatistik & AI Terminali',
      dashboard: 'LiveBet Mentor | Canlı Maç Terminali',
      pending: 'LiveBet Mentor | Onay Bekleniyor',
      expired: 'LiveBet Mentor | Abonelik Süresi Doldu'
    };
    const path = '/' + (page === 'landing' ? '' : page);
    trackPageView(path, titles[page] || document.title, { page });
  }, [page]);

  const t = translations[lang] || translations['en'];

  useEffect(() => {
    const checkUserStatus = async (user) => {
      if (!user) {
        setPage('landing');
        return null;
      }

      const isAdminEmail = user.email === 'admin@livebetmentor.com' || user.id?.startsWith('admin-') || user.plan === 'admin';

      // If user is a web member with a saved session, restore member profile without querying Supabase
      const savedMember = localStorage.getItem('lbm_member_session');
      if (savedMember) {
        try {
          const parsed = JSON.parse(savedMember);
          if (parsed?.user?.email === user.email || parsed?.user?.id === user.id) {
            const prof = parsed.memberProfile || parsed.user;
            const isApproved = prof?.status === 'approved' || prof?.status === 'active';
            const isExpired = prof?.subscription_end && new Date(prof.subscription_end) < new Date();
            const memProfile = {
              id: parsed.user.id,
              email: parsed.user.email,
              status: prof?.status || 'approved',
              plan: prof?.plan || 'trial',
              display_name: parsed.user.user_metadata?.display_name || prof?.full_name || parsed.user.email?.split('@')[0],
              subscription_end: prof?.subscription_end
            };
            setUserProfile(memProfile);
            if (!isApproved) {
              setPage('pending');
            } else if (isExpired) {
              setPage('expired');
            } else {
              setPage('dashboard');
            }
            return memProfile;
          }
        } catch (e) {}
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error || !data) {
          if (isAdminEmail) {
            const adminProfile = {
              id: user.id,
              email: user.email,
              status: 'active',
              plan: 'admin',
              display_name: 'LiveBet Admin',
              subscription_end: '2099-12-31T23:59:59.000Z'
            };
            setUserProfile(adminProfile);
            setPage('dashboard');
            return adminProfile;
          }

          // New user profile
          const pendingProfile = {
            id: user.id,
            email: user.email,
            status: 'pending',
            plan: 'trial',
            display_name: user.email ? user.email.split('@')[0] : 'Kullanıcı'
          };
          setUserProfile(pendingProfile);
          setPage('pending');
          return pendingProfile;
        }

        // If super admin, guarantee admin plan and active status
        if (isAdminEmail) {
          data.status = 'active';
          data.plan = 'admin';
        }

        setUserProfile(data);

        // Check ban status
        if (data?.is_banned) {
          alert(t.access_denied);
          await supabase.auth.signOut();
          setPage('landing');
          return null;
        }

        // Check approval status (Super admin bypasses)
        if (!isAdminEmail && data?.status === 'pending') {
          setPage('pending');
          return data;
        }

        if (!isAdminEmail && data?.status === 'rejected') {
          alert(t.membership_rejected);
          await supabase.auth.signOut();
          setPage('landing');
          return null;
        }

        // Check subscription expiry (Super admin bypasses)
        if (!isAdminEmail && data?.subscription_end) {
          const endDate = new Date(data.subscription_end);
          if (endDate < new Date()) {
            setPage('expired');
            return data;
          }
        }

        // All checks passed - show dashboard
        setPage('dashboard');
        return data;
      } catch (e) {
        if (isAdminEmail) {
          const adminProfile = {
            id: user.id,
            email: user.email,
            status: 'active',
            plan: 'admin',
            display_name: 'LiveBet Admin',
            subscription_end: '2099-12-31T23:59:59.000Z'
          };
          setUserProfile(adminProfile);
          setPage('dashboard');
          return adminProfile;
        }
        setPage('landing');
        return null;
      }
    };

    // Check if super admin master session exists
    const savedAdmin = localStorage.getItem('lbm_admin_session');
    if (savedAdmin) {
      try {
        const parsed = JSON.parse(savedAdmin);
        if (parsed?.user?.email === 'admin@livebetmentor.com' || parsed?.user?.plan === 'admin' || parsed?.user?.id?.startsWith('admin-')) {
          if (parsed.user) {
            parsed.user.email = 'admin@livebetmentor.com';
            if (parsed.user.user_metadata) parsed.user.user_metadata.display_name = 'LiveBet Admin';
            try { localStorage.setItem('lbm_admin_session', JSON.stringify(parsed)); } catch (err) {}
          }
          setSession(parsed);
          setUserProfile({
            id: 'admin-super',
            email: 'admin@livebetmentor.com',
            status: 'active',
            plan: 'admin',
            display_name: 'LiveBet Admin',
            subscription_end: '2099-12-31T23:59:59.000Z'
          });
          setPage('dashboard');
          setLoading(false);
          return;
        }
      } catch (e) {}
    }

    // Check if web member session exists
    const savedMember = localStorage.getItem('lbm_member_session');
    if (savedMember) {
      try {
        const parsed = JSON.parse(savedMember);
        if (parsed?.user) {
          const prof = parsed.memberProfile || parsed.user;
          const isExpired = prof.subscription_end && new Date(prof.subscription_end) < new Date();
          const isApproved = prof.status === 'approved' || prof.status === 'active';

          setSession(parsed);
          setUserProfile({
            id: parsed.user.id,
            email: parsed.user.email,
            status: prof.status || 'approved',
            plan: prof.plan || 'trial',
            display_name: parsed.user.user_metadata?.display_name || prof.full_name || parsed.user.email?.split('@')[0],
            subscription_end: prof.subscription_end
          });

          if (!isApproved) {
            setPage('pending');
          } else if (isExpired) {
            setPage('expired');
          } else {
            setPage('dashboard');
          }
          setLoading(false);
          return;
        }
      } catch (e) {}
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        checkUserStatus(session.user);
      } else {
        if (!localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session') && !resolveTelegramAdminQuickAuth()) {
          setSession(null);
          setUserProfile(null);
          setPage('landing');
        }
      }
      setLoading(false);
    }).catch(err => {
      console.warn('Supabase getSession error (offline/bypassed):', err?.message || err);
      if (!localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session') && !resolveTelegramAdminQuickAuth()) {
        setSession(null);
        setUserProfile(null);
        setPage('landing');
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        checkUserStatus(session.user);
      } else if (!localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session') && !resolveTelegramAdminQuickAuth()) {
        setSession(null);
        setUserProfile(null);
        setPage('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, [lang, t]); // Add lang/t dependency for alerts

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (!error && data) {
          const settingsObj = {};
          data.forEach(item => {
            settingsObj[item.key] = item.value;
          });
          setSystemSettings(settingsObj);
        }
      } catch (err) {
        console.warn('Could not fetch system settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleNavigate = (targetPage) => {
    setPage(targetPage);
  };

  const handleLogout = async () => {
    localStorage.removeItem('lbm_admin_session');
    localStorage.removeItem('lbm_member_session');
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setSession(null);
    setUserProfile(null);
    setPage('landing');
  };

  const handleLoginSuccess = (sess) => {
    setSession(sess);
    if (sess?.user?.email === 'admin@livebetmentor.com' || sess?.user?.plan === 'admin' || sess?.user?.id?.startsWith('admin-')) {
      const adminProfile = {
        id: sess.user.id || 'admin-super',
        email: 'admin@livebetmentor.com',
        status: 'active',
        plan: 'admin',
        display_name: 'LiveBet Admin',
        subscription_end: '2099-12-31T23:59:59.000Z'
      };
      setUserProfile(adminProfile);
      setPage('dashboard');
    } else if (sess?.access_token?.startsWith('member-token-') || sess?.memberProfile) {
      const prof = sess.memberProfile || sess.user;
      const memProfile = {
        id: sess.user.id,
        email: sess.user.email,
        status: prof.status || 'approved',
        plan: prof.plan || 'trial',
        display_name: sess.user.user_metadata?.display_name || prof.full_name || sess.user.email?.split('@')[0],
        subscription_end: prof.subscription_end
      };
      setUserProfile(memProfile);
      if (prof.status === 'pending') {
        setPage('pending');
      } else if (prof.subscription_end && new Date(prof.subscription_end) < new Date()) {
        setPage('expired');
      } else {
        setPage('dashboard');
      }
    } else if (sess?.user) {
      checkUserStatus(sess.user);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #030712, #0f172a)',
        color: '#38bdf8'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>LIVE BET MENTOR</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>{t.loading}</div>
        </div>
      </div>
    );
  }

  // Pending Approval Screen
  if (page === 'pending') {
    const userEmail = session?.user?.email || '';

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #030712, #0f172a)',
        padding: '2rem',
        position: 'relative'
      }}>
        {/* Language Switcher */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          {['tr', 'en', 'de'].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                background: lang === l ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                border: 'none',
                color: lang === l ? '#38bdf8' : '#94a3b8',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.75rem'
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="glass-panel" style={{
          padding: '3rem',
          maxWidth: '520px',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(251, 191, 36, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.2rem' }}>⏳</div>
          <h2 style={{ fontSize: '1.7rem', fontWeight: 900, marginBottom: '0.8rem', color: '#fbbf24' }}>
            {t.approval_pending || (lang === 'tr' ? 'Üyeliğiniz Onay Bekliyor' : (lang === 'de' ? 'Ihre Mitgliedschaft wartet auf Bestätigung' : 'Membership Approval Pending'))}
          </h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1.2rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {t.approval_pending_desc || (lang === 'tr' 
              ? 'Hesap kaydınız başarıyla alındı. Canlı radar paneline erişiminiz yönetici onayından sonra aktifleşecektir.' 
              : (lang === 'de'
                ? 'Ihre Registrierung wurde erfolgreich empfangen. Der Zugang zum Live-Radar wird nach der Administrator-Bestätigung aktiviert.'
                : 'Your registration was successful. Access to the live radar will be activated after administrator approval.'))}
          </p>
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.8rem', borderRadius: '8px', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.8rem' }}>
            📧 <strong>{userEmail}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setIsSupportChatOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.9rem 1.5rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)'
                }}
              >
                <span>💬</span>
                <span>{lang === 'tr' ? '7/24 Canlı Destek Masası (Aktivasyon)' : (lang === 'de' ? '24/7 Live-Support Desk (Aktivierung)' : '24/7 Live Support Desk (Activation)')}</span>
              </button>

            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8',
                padding: '0.7rem 1.5rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Native 100% Anonymous Live Support Chatbot & Operator Desk */}
        <LiveSupportChat
          isOpen={isSupportChatOpen}
          onOpen={() => setIsSupportChatOpen(true)}
          onClose={() => setIsSupportChatOpen(false)}
          lang={lang}
          userProfile={userProfile}
          apiBase={proxyBase}
        />
      </div>
    );
  }

  // Subscription Expired / Trial Converted Screen
  if (page === 'expired') {
    const shopierUrl = systemSettings?.shopier_link || 'https://www.shopier.com/QuantDataLabs';
    const endDate = userProfile?.subscription_end 
      ? new Date(userProfile.subscription_end).toLocaleDateString(lang === 'tr' ? 'tr-TR' : (lang === 'de' ? 'de-DE' : 'en-US'), { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const isTrialExpiry = userProfile?.plan === 'trial';

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #0f172a 0%, #030712 100%)',
        padding: '1.5rem',
        fontFamily: "'Inter', sans-serif",
        position: 'relative'
      }}>
        {/* Language Switcher */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          {['tr', 'en', 'de'].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                background: lang === l ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
                border: 'none',
                color: lang === l ? '#c084fc' : '#94a3b8',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.75rem'
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="glass-panel" style={{
          padding: '2.5rem',
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 30px rgba(168, 85, 247, 0.15)'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.8rem' }}>
            {isTrialExpiry ? '⏳' : '📅'}
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', color: '#f3e8ff' }}>
            {isTrialExpiry 
              ? (lang === 'tr' ? '3 Günlük Ücretsiz Denemeniz Sona Erdi' : (lang === 'de' ? 'Ihre 3-tägige kostenlose Testphase ist beendet' : 'Your 3-Day Free Trial Has Ended'))
              : (lang === 'tr' ? 'Abonelik Süreniz Doldu' : (t.subscription_expired || (lang === 'de' ? 'Ihr Abonnement ist abgelaufen' : 'Subscription Expired')))}
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.4rem', lineHeight: 1.5, fontSize: '0.9rem' }}>
            {lang === 'tr' 
              ? `Canlı radar ve VIP sinyal erişim süreniz ${endDate ? `${endDate} tarihinde ` : ''}tamamlanmıştır. Yapay zeka değer sinyallerini kaçırmamak için VIP üyeliğinizi hemen aktifleştirin.` 
              : (lang === 'de'
                ? `Ihr Zugang zum Live-Radar und den VIP-Signalen ist ${endDate ? `am ${endDate} ` : ''}abgelaufen. Aktivieren Sie Ihre VIP-Mitgliedschaft jetzt, um keine KI-Value-Signale zu verpassen.`
                : (t.subscription_expired_desc ? t.subscription_expired_desc.replace('{date}', endDate) : `Your access expired ${endDate ? `on ${endDate}` : ''}. Upgrade now to keep receiving VIP signals.`))}
          </p>

          {/* Social Proof & Performance Widget */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.8))',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '16px',
            padding: '1rem',
            marginBottom: '1.8rem',
            textAlign: 'left'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>
              🤖 {lang === 'tr' ? 'SON 24 SAATTE ALGORİTMA PERFORMANSI' : (lang === 'de' ? 'QUANT-PERFORMANCE DER LETZTEN 24 STD.' : 'PAST 24H QUANT PERFORMANCE')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.4rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>%82.4</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lang === 'tr' ? 'İsabet Oranı' : (lang === 'de' ? 'Trefferquote' : 'Win Rate')}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.4rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8' }}>18/22</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lang === 'tr' ? 'Kazanan Sinyal' : (lang === 'de' ? 'Gewonnene Signale' : 'Signals Won')}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.4rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24' }}>@1.76</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lang === 'tr' ? 'Ortalama Oran' : (lang === 'de' ? 'Durchschn. Quote' : 'Avg Odds')}</div>
              </div>
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#cbd5e1', opacity: 0.85, textAlign: 'center' }}>
              🔒 {lang === 'tr' ? 'VIP Alevli Maçlar, Poisson ve xG Radarı artık kilitlidir.' : (lang === 'de' ? 'VIP-Spiele, Poisson- & xG-Radar sind derzeit gesperrt.' : 'VIP Flame Matches, Poisson & xG Radar are currently locked.')}
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a
              href={shopierUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                padding: '0.9rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.95rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
              }}
            >
              <span>💳</span>
              <span>{lang === 'tr' ? 'Kredi Kartı ile VIP Satın Al (Anında Açılır)' : (lang === 'de' ? 'Sofortige Kartenzahlung (Shopier)' : 'Instant Card Checkout (Shopier)')}</span>
            </a>

            <button
              type="button"
              onClick={() => setIsSupportChatOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                padding: '0.85rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)'
              }}
            >
              <span>💬</span>
              <span>{lang === 'tr' ? '7/24 Canlı Destek Masası (VIP & Kripto Talebi)' : (lang === 'de' ? '24/7 Live-Support Desk (VIP & Krypto)' : '24/7 Live Support Desk (VIP & Crypto)')}</span>
            </button>


            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                marginTop: '0.3rem'
              }}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Native 100% Anonymous Live Support Chatbot & Operator Desk */}
        <LiveSupportChat
          isOpen={isSupportChatOpen}
          onOpen={() => setIsSupportChatOpen(true)}
          onClose={() => setIsSupportChatOpen(false)}
          lang={lang}
          userProfile={userProfile}
          apiBase={proxyBase}
        />
      </div>
    );
  }

  return (
    <div className="App">
      {(page === 'landing' || page === 'login' || page === 'register') && (
        <LandingPage
          onLoginSuccess={handleLoginSuccess}
          onNavigate={handleNavigate}
          lang={lang}
          setLang={setLang}
          settings={systemSettings}
        />
      )}

      {page === 'dashboard' && session && (
        <Dashboard
          user={session.user}
          userProfile={userProfile}
          onLogout={handleLogout}
          onExpire={() => setPage('expired')}
          lang={lang}
          setLang={setLang}
          settings={systemSettings}
        />
      )}
    </div>
  );
}

export default App
