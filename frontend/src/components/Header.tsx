import React from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import type { HealthStatus } from '../services/api';

interface HeaderProps {
  health: HealthStatus | null;
  onOpenDemo?: () => void;
  isDemoActive?: boolean;
}

export default function Header({ health, onOpenDemo, isDemoActive }: HeaderProps): React.JSX.Element {
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

      <div className="status-badges" aria-label="System Integration Status">
        <div
          className={`badge ${isHealthy ? 'online' : 'offline'}`}
          title={isHealthy ? 'Core commerce API operational' : 'Attempting connection to backend service'}
        >
          <span className="badge-dot" aria-hidden="true"></span>
          <span>{isHealthy ? 'Connected' : 'Connecting'}</span>
        </div>

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
