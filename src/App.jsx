import React, { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'
import { LandingPage } from './components/LandingPage'
import { RegisterPage } from './components/RegisterPage'
import { supabase } from './backend/supabaseClient'
import { translations } from './locales/translations'
import './styles/global.css'

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.')
);

function App() {
  const [session, setSession] = useState(() => isLocal ? { user: { email: 'admin@local.dev', id: 'local-admin-id' } } : null)
  const [loading, setLoading] = useState(() => !isLocal)
  const [page, setPage] = useState(() => isLocal ? 'dashboard' : 'landing')
  const [userProfile, setUserProfile] = useState(() => isLocal ? { status: 'active', plan: 'admin', display_name: 'Admin User' } : null)
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

      const isAdminEmail = user.email === 'karabulut.hamza@gmail.com';

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
              display_name: 'Hamza Karabulut (Admin)'
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
            display_name: 'Hamza Karabulut (Admin)'
          };
          setUserProfile(adminProfile);
          setPage('dashboard');
          return adminProfile;
        }
        setPage('landing');
        return null;
      }
    };

    if (isLocal) {
      return;
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        checkUserStatus(session.user);
      } else {
        setSession(null);
        setUserProfile(null);
        setPage('landing');
      }
      setLoading(false);
    }).catch(err => {
      console.error('Supabase getSession error:', err);
      setSession(null);
      setUserProfile(null);
      setPage('landing');
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkUserStatus(session.user);
      } else {
        setSession(null);
        setUserProfile(null);
        setPage('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, [lang, t]); // Add lang/t dependency for alerts

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (!error && data) {
        const settingsObj = {};
        data.forEach(item => {
          settingsObj[item.key] = item.value;
        });
        setSystemSettings(settingsObj);
      }
    };
    fetchSettings();
  }, []);

  const handleNavigate = (targetPage) => {
    setPage(targetPage);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
    setPage('landing');
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

  const rawWhatsapp = systemSettings.whatsapp_support || systemSettings.whatsapp || '';
  const cleanWhatsapp = rawWhatsapp.replace(/[^0-9]/g, '');

  // Pending Approval Screen
  if (page === 'pending') {
    const userEmail = session?.user?.email || '';
    const whatsappMsg = encodeURIComponent(`Merhaba, LiveBet Mentor sistemine üye oldum (E-posta: ${userEmail}). Üyeliğimin aktif edilmesi / ödeme dekontum için yazıyorum.`);
    const whatsappUrl = cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}?text=${whatsappMsg}` : null;

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
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
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
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                }}
              >
                <span>💬</span>
                <span>{lang === 'tr' ? 'WhatsApp ile Onaylat / Dekont İlet' : 'Contact via WhatsApp'}</span>
              </a>
            )}

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

  // Subscription Expired Screen
  if (page === 'expired') {
    const userEmail = session?.user?.email || '';
    const endDate = userProfile?.subscription_end ? new Date(userProfile.subscription_end).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-';
    const whatsappMsg = encodeURIComponent(`Merhaba, LiveBet Mentor aboneliğimi yenilemek istiyorum (E-posta: ${userEmail}).`);
    const whatsappUrl = cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}?text=${whatsappMsg}` : null;

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
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.2rem' }}>📅</div>
          <h2 style={{ fontSize: '1.7rem', fontWeight: 900, marginBottom: '0.8rem', color: '#ef4444' }}>
            {lang === 'tr' ? 'Abonelik Süreniz Doldu' : t.subscription_expired}
          </h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {lang === 'tr' 
              ? `Canlı radar abonelik süreniz ${endDate} tarihinde sona ermiştir. VIP fırsatları kaçırmamak için üyeliğinizi hemen yenileyebilirsiniz.` 
              : t.subscription_expired_desc.replace('{date}', endDate)}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.5rem' }}>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                  color: '#000',
                  padding: '0.9rem 1.5rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)'
                }}
              >
                <span>💬</span>
                <span>{lang === 'tr' ? 'Aboneliği Yenile (WhatsApp)' : 'Renew Subscription'}</span>
              </a>
            )}

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

  return (
    <div className="App">
      {(page === 'landing' || page === 'login' || page === 'register') && (
        <LandingPage
          onLoginSuccess={(sess) => {
            setSession(sess);
          }}
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
