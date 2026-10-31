import React from 'react';
import { ShoppingBag, LogOut } from 'lucide-react';
import type { HealthStatus } from '../services/api';
import { sellerCopy } from '../features/locale/sellerCopy';
import { LocaleSwitch, useLocale } from '../features/locale';

interface HeaderProps {
  health: HealthStatus | null;
  isAuthenticated?: boolean;
  onSignOut?: () => void;
}

export default function Header({
  health,
  isAuthenticated,
  onSignOut,
}: HeaderProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="navbar" role="banner">
      <div className="brand-section">
        <div className="brand-logo" aria-hidden="true">
          <ShoppingBag size={21} aria-hidden="true" />
        </div>
        <div className="brand-text">
          <h1>middleman</h1>
          <p>{text.tagline}</p>
        </div>
      </div>

      <div className="status-badges" role="group" aria-label={text.status}>
        <LocaleSwitch />
        <div
          className={`badge ${isHealthy ? 'online' : 'offline'}`}
          title={isHealthy ? text.onlineTitle : text.offlineTitle}
        >
          <span className="badge-dot" aria-hidden="true"></span>
          <span>{isHealthy ? text.connected : text.connecting}</span>
        </div>

        {isAuthenticated && onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="header-action-btn"
            title={text.signOutTitle}
          >
            <LogOut size={13} color="var(--rose-accent)" aria-hidden="true" />
            <span>{text.signOut}</span>
          </button>
        )}

      </div>
    </header>
  );
}
