import React, { useState, useEffect } from 'react';
import { Store } from 'lucide-react';
import Header from './components/Header';
import { SellerWorkspace } from './features/seller';
import { BuyerPortal } from './features/buyer';
import { LandingPage } from './features/landing';
import { LocaleProvider, LocaleSwitch, useLocale } from './features/locale';
import { sellerCopy } from './features/locale/sellerCopy';
import { fetchHealth, type HealthStatus } from './services/api';

interface AppProps {
  token?: string;
  sessionId?: string;
  sessionNotice?: React.ReactNode;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export default function App(props: AppProps = {}): React.JSX.Element {
  return (
    <LocaleProvider>
      <AppShell {...props} />
    </LocaleProvider>
  );
}

export function AppShell({ token, sessionId, sessionNotice, onSignIn, onSignOut }: AppProps): React.JSX.Element {
  const { t, locale } = useLocale();
  const text = sellerCopy[locale];
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isOrderPortal = pathname.startsWith('/orders/');
  const portalToken = isOrderPortal ? pathname.replace('/orders/', '').trim() : '';
  const showingPortal = isOrderPortal && Boolean(portalToken);

  useEffect(() => {
    document.title = t(showingPortal ? 'document.title.buyer' : 'document.title.seller');
  }, [showingPortal, t]);

  useEffect(() => {
    if (isOrderPortal) return;
    let active = true;
    const check = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchHealth().then((h) => {
        if (active) setHealth(h);
      });
    };
    check();
    const interval = setInterval(check, 10000);
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isOrderPortal]);

  if (showingPortal) {
    return (
      <div className="portal-shell">
        <header className="portal-header">
          <div className="portal-brand">
            <Store size={18} color="var(--primary-accent)" aria-hidden="true" />
            <span>{t('portal.brand')}</span>
          </div>
          <div className="portal-actions">
            <LocaleSwitch />
          </div>
        </header>
        <BuyerPortal portalToken={portalToken} />
        <div className="portal-footer-action">
          <p>{t('portal.footerNotice')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <a href="#workspace" className="skip-link">{text.skip}</a>
      {/* Shop navigation and connection status */}
      <Header
        health={health}
        isAuthenticated={Boolean(token)}
        onSignOut={onSignOut}
      />

      {token || sessionNotice ? (
        <main id="workspace" tabIndex={-1}>
          {sessionNotice ?? <SellerWorkspace key={sessionId ?? 'signed-out'} token={token} onSignIn={onSignIn} />}
        </main>
      ) : (
        <LandingPage onSignIn={onSignIn}>
          <SellerWorkspace key={sessionId ?? 'signed-out'} token={token} onSignIn={onSignIn} />
        </LandingPage>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>{text.footer}</p>
      </footer>
    </div>
  );
}
