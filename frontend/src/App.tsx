import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowLeft,
} from 'lucide-react';
import Header from './components/Header';
import { SellerWorkspace } from './features/seller';
import { BuyerPortal } from './features/buyer';
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
    fetchHealth().then(setHealth);
    const interval = setInterval(() => {
      fetchHealth().then(setHealth);
    }, 10000);
    return () => clearInterval(interval);
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
            <a
              href="/"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <ArrowLeft size={13} aria-hidden="true" /> {t('portal.backHome')}
            </a>
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

      <section className="app-masthead" aria-labelledby="workspace-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2 id="workspace-heading">{text.heading} <em>{text.headingEm}</em></h2>
          <p className="masthead-copy">
            {text.intro}
          </p>
        </div>
        <ol className="workflow-guide" aria-label={text.guide}>
          <li><span>01</span> {text.step1}</li>
          <li><span>02</span> {text.step2}</li>
          <li><span>03</span> {text.step3}</li>
        </ol>
      </section>

      {/* Main View Area */}
      <main id="workspace" tabIndex={-1}>
        {sessionNotice ?? <SellerWorkspace key={sessionId ?? 'signed-out'} token={token} onSignIn={onSignIn} />}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>{text.footer}</p>
      </footer>
    </div>
  );
}
