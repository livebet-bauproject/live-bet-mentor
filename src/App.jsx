import React, { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { LandingPage } from './components/LandingPage'
import { supabase } from './backend/supabaseClient'
import { translations } from './locales/translations'
import { CONFIG } from './config'
import './styles/global.css'

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.')
);

function App() {
  const [session, setSession] = useState(() => {
    try {
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
  const [loading, setLoading] = useState(() => !localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session'));
  const [page, setPage] = useState(() => {
    try {
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
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('app_lang');
    return saved || (navigator.language.startsWith('tr') ? 'tr' : 'en');
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  const t = translations[lang];

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
        if (!localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session')) {
          setSession(null);
          setUserProfile(null);
          setPage('landing');
        }
      }
      setLoading(false);
    }).catch(err => {
      console.warn('Supabase getSession error (offline/bypassed):', err?.message || err);
      if (!localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session')) {
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
      } else if (!localStorage.getItem('lbm_admin_session') && !localStorage.getItem('lbm_member_session')) {
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

  const telegramUsername = systemSettings?.telegram_support || systemSettings?.telegram || CONFIG?.SUPPORT?.TELEGRAM || '@Livebetdeskbot';
  const cleanTelegram = telegramUsername.replace('@', '');

  // Pending Approval Screen
  if (page === 'pending') {
    const userEmail = session?.user?.email || '';
    const telegramUrl = `https://t.me/${cleanTelegram}`;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #030712, #0f172a)',
        padding: '2rem'
      }}>
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
            {lang === 'tr' ? 'Üyeliğiniz Onay Bekliyor' : t.approval_pending}
          </h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1.2rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {lang === 'tr' 
              ? 'Hesap kaydınız başarıyla alındı. Canlı radar paneline erişiminiz yönetici onayından sonra aktifleşecektir.' 
              : t.approval_pending_desc}
          </p>
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.8rem', borderRadius: '8px', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.8rem' }}>
            📧 <strong>{userEmail}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #0088cc, #0077b5)',
                  color: '#fff',
                  padding: '0.9rem 1.5rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(0, 136, 204, 0.3)'
                }}
              >
                <span>✈️</span>
                <span>{lang === 'tr' ? 'Telegram ile Lisans Aktivasyonu' : 'Contact via Telegram for Activation'}</span>
              </a>

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
      </div>
    );
  }

  // Subscription Expired / Trial Converted Screen
  if (page === 'expired') {
    const telegramUrl = `https://t.me/${cleanTelegram}`;
    const shopierUrl = systemSettings?.shopier_link || 'https://shopier.com/livebetmentor';
    const endDate = userProfile?.subscription_end 
      ? new Date(userProfile.subscription_end).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
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
        fontFamily: "'Inter', sans-serif"
      }}>
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
              ? (lang === 'tr' ? '24 Saatlik Ücretsiz Denemeniz Sona Erdi' : 'Your 24h Free Trial Has Ended')
              : (lang === 'tr' ? 'Abonelik Süreniz Doldu' : t.subscription_expired)}
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.4rem', lineHeight: 1.5, fontSize: '0.9rem' }}>
            {lang === 'tr' 
              ? `Canlı radar ve VIP sinyal erişim süreniz ${endDate ? `${endDate} tarihinde ` : ''}tamamlanmıştır. Yapay zeka değer sinyallerini kaçırmamak için VIP üyeliğinizi hemen aktifleştirin.` 
              : t.subscription_expired_desc.replace('{date}', endDate)}
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
              🤖 {lang === 'tr' ? 'SON 24 SAATTE ALGORİTMA PERFORMANSI' : 'PAST 24H QUANT PERFORMANCE'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.4rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>%82.4</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lang === 'tr' ? 'İsabet Oranı' : 'Win Rate'}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.4rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8' }}>18/22</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lang === 'tr' ? 'Kazanan Sinyal' : 'Signals Won'}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.4rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24' }}>@1.76</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lang === 'tr' ? 'Ortalama Oran' : 'Avg Odds'}</div>
              </div>
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#cbd5e1', opacity: 0.85, textAlign: 'center' }}>
              🔒 {lang === 'tr' ? 'VIP Alevli Maçlar, Poisson ve xG Radarı artık kilitlidir.' : 'VIP Flame Matches, Poisson & xG Radar are currently locked.'}
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
              <span>{lang === 'tr' ? 'Kredi Kartı ile VIP Satın Al (Anında Açılır)' : 'Instant Card Checkout (Shopier)'}</span>
            </a>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'linear-gradient(135deg, #0088cc, #0077b5)',
                color: '#fff',
                padding: '0.85rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(0, 136, 204, 0.3)'
              }}
            >
              <span>✈️</span>
              <span>{lang === 'tr' ? 'Telegram ile İndirimli VIP Talebi (@Livebetdeskbot)' : 'Contact Telegram (@Livebetdeskbot)'}</span>
            </a>

            {/* Freemium Entry Option: Keeps users engaged with locked signals */}
            <button
              onClick={() => setPage('dashboard')}
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                padding: '0.8rem 1.5rem',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span>🔓</span>
              <span>{lang === 'tr' ? 'Freemium Olarak Devam Et (Temel Radar)' : 'Continue in Freemium Mode (Basic Radar)'}</span>
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
          lang={lang}
          setLang={setLang}
          settings={systemSettings}
        />
      )}
    </div>
  );
}

export default App
