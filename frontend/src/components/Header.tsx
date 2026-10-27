import React from 'react';
import { Sparkles, ShoppingBag, LogOut } from 'lucide-react';
import type { HealthStatus } from '../services/api';
import { LocaleSwitch } from '../features/locale';

interface HeaderProps {
  health: HealthStatus | null;
  onOpenDemo?: () => void;
  isDemoActive?: boolean;
  isAuthenticated?: boolean;
  onSignOut?: () => void;
}

export default function Header({
  health,
  onOpenDemo,
  isDemoActive,
  isAuthenticated,
  onSignOut,
}: HeaderProps): React.JSX.Element {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="navbar" role="banner">
      <div className="brand-section">
        <div className="brand-logo" aria-hidden="true">
          <ShoppingBag size={21} aria-hidden="true" />
        </div>
        <div className="brand-text">
          <h1>middleman</h1>
          <p>Your everyday order desk</p>
        </div>
      </div>

      <div className="status-badges">
        <LocaleSwitch />
        <div
          className={`badge ${isHealthy ? 'online' : 'offline'}`}
          title={isHealthy ? 'Core commerce API operational' : 'Attempting connection to backend service'}
        >
          <span className="badge-dot" aria-hidden="true"></span>
          <span>{isHealthy ? 'Connected' : 'Connecting'}</span>
        </div>

        {isAuthenticated && onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="demo-pill-btn"
            title="Sign out of seller account"
          >
            <LogOut size={13} color="var(--rose-accent)" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenDemo}
          className={`demo-pill-btn ${isDemoActive ? 'active' : ''}`}
          title="Open interactive Gemini AI playground, database explorer, and diagnostic tools"
        >
          <Sparkles size={13} color="var(--primary-accent)" aria-hidden="true" />
          <span>{isDemoActive ? 'Back to shop' : 'Demo & tools'}</span>
        </button>
      </div>
    </header>
  );
}
