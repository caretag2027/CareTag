import React, { useEffect, useState } from 'react';
import auth, { DEDICATED_ACCOUNTS } from './auth';
import LandingPage from './components/LandingPage';
import TaggyChatbot from './components/TaggyChatbot';
import CookieBanner from './components/CookieBanner';
import AuthPage from './components/AuthPage';
import SimpleDashboard from './components/SimpleDashboard';

function App() {
  const [session, setSession] = useState(() => auth.getSession());
  const [view, setView] = useState('landing');

  // Enforce private dashboard isolation: redirect to auth if attempting to access dashboard unauthenticated
  useEffect(() => {
    if (view === 'dashboard' && !session) {
      setView('auth');
    }
  }, [view, session]);

  // Ensure window scroll is always reset to the top when navigating to dashboard
  useEffect(() => {
    if (view === 'dashboard' && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [view]);

  const handleLaunchDashboard = () => {
    if (session) {
      setView('dashboard');
    } else {
      setView('auth');
    }
  };

  const handleOpenInspector = () => {
    // If not authenticated, automatically authenticate as primary demo evaluator so the visitor can immediately experience live telemetry without a login wall
    if (!session) {
      const demoAccount = DEDICATED_ACCOUNTS && DEDICATED_ACCOUNTS.length > 0
        ? DEDICATED_ACCOUNTS[0]
        : {
            id: 'usr_singla_be23',
            name: 'Bhavishya Singla',
            email: 'singla_be23@thapar.edu',
            role: 'admin',
            deviceKey: 'CARE-TAG-01'
          };
      const demoSession = {
        userId: demoAccount.id,
        name: demoAccount.name,
        email: demoAccount.email,
        role: demoAccount.role || 'admin',
        deviceKey: demoAccount.deviceKey || 'CARE-TAG-01',
        department: demoAccount.department || 'Computer Engineering (BE23)',
        institution: demoAccount.institution || 'Thapar Institute of Engineering & Technology',
        backend: 'demo-evaluator',
      };
      localStorage.setItem('caretag.session', JSON.stringify(demoSession));
      setSession(demoSession);
    }
    setView('dashboard');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('caretag:navigate-tab', { detail: 'inspector' }));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('caretag:navigate-tab', { detail: 'inspector' }));
        const pane = document.querySelector('.caretag-content-pane');
        if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
    }
  };

  return (
    <>
      {view === 'landing' && (
        <>
          <LandingPage
            onLaunchDashboard={handleLaunchDashboard}
            onOpenAuth={() => setView('auth')}
            onOpenInspector={handleOpenInspector}
            session={session}
            onLogout={() => {
              auth.logout();
              setSession(null);
              setView('landing');
            }}
          />
          <TaggyChatbot
            currentView="landing"
            onLaunchDashboard={handleLaunchDashboard}
            onOpenAuth={() => setView('auth')}
            onOpenInspector={handleOpenInspector}
          />
        </>
      )}

      {view === 'auth' && (
        <AuthPage
          onLogin={(s) => {
            setSession(s);
            setView('dashboard');
          }}
          onBackToLanding={() => setView('landing')}
        />
      )}

      {view === 'dashboard' && session && (
        <SimpleDashboard
          session={session}
          onLogout={() => {
            auth.logout();
            setSession(null);
            setView('landing');
          }}
          onGoToLanding={() => {
            setView('landing');
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
      )}

      {view === 'landing' && <CookieBanner />}
    </>
  );
}

export default App;
