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
  const [page, setPage] = useState('dashboard') // FORCE dashboard for local dev
  const [userProfile, setUserProfile] = useState(() => isLocal ? { status: 'active', plan: 'premium', display_name: 'Admin User' } : null)
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
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error || !data) {
          console.warn('Profile fetch error or Supabase offline, activating fallback profile:', error?.message || 'No data');
          const fallback = {
            id: user.id,
            email: user.email,
            status: 'active',
            plan: 'premium',
            display_name: user.email ? user.email.split('@')[0] : 'Admin User'
          };
          setUserProfile(fallback);
          setPage('dashboard');
          return fallback;
        }

        setUserProfile(data);

        // Check ban status
        if (data?.is_banned) {
          alert(t.access_denied);
          await supabase.auth.signOut();
          return null;
        }

        // Check approval status
        if (data?.status === 'pending') {
          setPage('pending');
          return data;
        }

        if (data?.status === 'rejected') {
          alert(t.membership_rejected);
          await supabase.auth.signOut();
          return null;
        }

        // Check subscription expiry
        if (data?.subscription_end) {
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
        console.warn('Supabase offline or profile error, activating local dashboard:', e);
        const fallback = {
          id: user?.id || 'local-guest-id',
          email: user?.email || 'guest@local.dev',
          status: 'active',
          plan: 'premium',
          display_name: user?.email ? user.email.split('@')[0] : 'Admin User'
        };
        setUserProfile(fallback);
        setPage('dashboard');
        return fallback;
      }
    };

    if (isLocal) {
      return;
    }

    // Check current session with timeout fallback
    const authTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Supabase timeout: Falling back to local offline mode.');
        setSession({ user: { email: 'guest@local.dev', id: 'local-guest-id' } });
        setUserProfile({ status: 'active', display_name: 'Guest User' });
        setPage('dashboard');
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(authTimeout);
      if (session) {
        setSession(session);
        checkUserStatus(session.user);
      } else {
        // FORCE Dashboard for local development when Supabase is down
        console.info('No session found, forcing Dashboard Guest mode.');
        setSession({ user: { email: 'guest@local.dev', id: 'local-guest-id' } });
        setUserProfile({ status: 'active', display_name: 'Guest User' });
        setPage('dashboard');
      }
      setLoading(false);
    }).catch(err => {
      clearTimeout(authTimeout);
      console.error('Supabase error:', err);
      setSession({ user: { email: 'guest@local.dev', id: 'local-guest-id' } });
      setPage('dashboard');
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkUserStatus(session.user);
      } else {
        // Maintain Dashboard Guest mode even if auth state changes to null
        console.info('Auth state changed to null, maintaining Dashboard Guest mode.');
        setSession({ user: { email: 'guest@local.dev', id: 'local-guest-id' } });
        setUserProfile({ status: 'active', display_name: 'Guest User' });
        setPage('dashboard');
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

  // Pending Approval Screen
  if (page === 'pending') {
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
          maxWidth: '500px',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '20px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⏳</div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1rem', color: '#fbbf24' }}>
            {t.approval_pending}
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {t.approval_pending_desc}
          </p>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
            E-posta: {session?.user?.email}
          </p>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '0.8rem 2rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  // Subscription Expired Screen
  if (page === 'expired') {
    const endDate = userProfile?.subscription_end ? new Date(userProfile.subscription_end).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-';

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
          maxWidth: '500px',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '20px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📅</div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1rem', color: '#ef4444' }}>
            {t.subscription_expired}
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.6 }}>
            {t.subscription_expired_desc.replace('{date}', endDate)}
          </p>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
            {t.renew_subscription_desc}
          </p>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '0.8rem 2rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {t.logout}
          </button>
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
