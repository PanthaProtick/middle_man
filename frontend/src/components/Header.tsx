import React from 'react';
import { Database, Sparkles, ShieldCheck, ShoppingBag } from 'lucide-react';
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
    <header className="navbar" role="banner">
      <div className="brand-section">
        <div className="brand-logo" aria-hidden="true">
          <ShoppingBag size={21} aria-hidden="true" />
        </div>
        <div className="brand-text">
          <h1>middleman<sup>®</sup></h1>
          <p>Order confirmation desk</p>
        </div>
      </div>

      <div className="status-badges" aria-label="System Integration Status">
        <div
          className={`badge ${isHealthy ? 'online' : 'offline'}`}
          title="Backend FastAPI Runtime Status"
        >
          <span className="badge-dot" aria-hidden="true"></span>
          <span>API: {isHealthy ? 'Live (8000)' : 'Offline'}</span>
        </div>

        <div
          className={`badge ${health?.database_configured ? 'online' : 'info'}`}
          title="Neon Serverless PostgreSQL Connectivity"
        >
          <Database size={12} aria-hidden="true" />
          <span>Neon: {health?.database_configured ? 'Connected' : 'Standby'}</span>
        </div>

        <div
          className={`badge ${isClerkReady ? 'online' : 'info'}`}
          title="Clerk Authentication Provider Status"
        >
          <ShieldCheck size={12} aria-hidden="true" />
          <span>Clerk: {isClerkReady ? 'Connected' : 'Standby'}</span>
        </div>

        <div
          className={`badge ${health?.gemini_configured ? 'online' : 'active'}`}
          title="Google Gemini AI Vision & Extraction Engine"
        >
          <Sparkles size={12} aria-hidden="true" />
          <span>Gemini: {health?.gemini_configured ? 'Ready' : 'Mock Mode'}</span>
        </div>
      </div>
    </header>
  );
}
