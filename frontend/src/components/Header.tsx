import React from 'react';
import { Database, Sparkles, ShieldCheck } from 'lucide-react';
import type { HealthStatus } from '../services/api';

interface HeaderProps {
  health: HealthStatus | null;
}

export default function Header({ health }: HeaderProps): React.JSX.Element {
  const isHealthy = health?.status === 'healthy';
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isClerkFrontendReady = Boolean(
    clerkPublishableKey &&
    clerkPublishableKey.startsWith('pk_') &&
    !clerkPublishableKey.includes('your_clerk')
  );
  const isClerkReady = health?.clerk_configured || isClerkFrontendReady;

  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-logo">⚡</div>
        <div className="brand-text">
          <h1>Dev Template</h1>
          <p>React • FastAPI • Neon • Clerk • Gemini • uv</p>
        </div>
      </div>

      <div className="status-badges">
        <div className={`badge ${isHealthy ? 'online' : 'offline'}`}>
          <span className="badge-dot"></span>
          <span>API: {isHealthy ? 'Live (8000)' : 'Offline'}</span>
        </div>

        <div className={`badge ${health?.database_configured ? 'online' : 'info'}`}>
          <Database size={12} />
          <span>Neon: {health?.database_configured ? 'Connected' : 'Standby'}</span>
        </div>

        <div className={`badge ${isClerkReady ? 'online' : 'info'}`}>
          <ShieldCheck size={12} />
          <span>Clerk: {isClerkReady ? 'Connected' : 'Standby'}</span>
        </div>

        <div className={`badge ${health?.gemini_configured ? 'online' : 'active'}`}>
          <Sparkles size={12} />
          <span>Gemini: {health?.gemini_configured ? 'Ready' : 'Mock Mode'}</span>
        </div>
      </div>
    </header>
  );
}
