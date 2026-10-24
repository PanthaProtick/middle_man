import React, { useState } from 'react';
import {
  Sparkles,
  Database,
  ShieldCheck,
  Terminal,
  CheckCircle2,
  Cpu,
  Layers,
  Flame,
} from 'lucide-react';
import { GeminiPlayground } from '../gemini';
import { DataExplorer } from '../items';
import { EvidenceRetentionPanel } from '../seller/EvidenceRetentionPanel';
import { StructuredRetentionPanel } from '../seller/StructuredRetentionPanel';
import type { HealthStatus } from '../../services/api';

type DemoSection = 'gemini' | 'database' | 'retention' | 'health' | 'runbook';

interface DemoToolsProps {
  health: HealthStatus | null;
}

export function DemoTools({ health }: DemoToolsProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<DemoSection>('gemini');

  const isHealthy = health?.status === 'healthy';
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isClerkFrontendReady = Boolean(
    clerkPublishableKey &&
    clerkPublishableKey.startsWith('pk_') &&
    !clerkPublishableKey.includes('your_clerk')
  );
  const isClerkReady = health?.clerk_configured || isClerkFrontendReady;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Sparkles size={20} color="var(--primary-accent)" />
            <span>Demo Sandbox & Technical Tools</span>
          </div>
          <p className="card-subtitle">
            Diagnostic tools, AI vision sandboxes, database views, and automated retention policies preserved for demonstration and technical evaluation.
          </p>
        </div>
      </div>

      <nav className="tabs-nav" style={{ marginTop: '16px', marginBottom: '20px' }} role="tablist" aria-label="Demo Sub-navigation">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'gemini'}
          className={`tab-btn ${activeSection === 'gemini' ? 'active' : ''}`}
          onClick={() => setActiveSection('gemini')}
        >
          <Sparkles size={14} />
          <span>Gemini AI Sandbox</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'database'}
          className={`tab-btn ${activeSection === 'database' ? 'active' : ''}`}
          onClick={() => setActiveSection('database')}
        >
          <Database size={14} />
          <span>Data Explorer</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'retention'}
          className={`tab-btn ${activeSection === 'retention' ? 'active' : ''}`}
          onClick={() => setActiveSection('retention')}
        >
          <ShieldCheck size={14} />
          <span>Retention & Purge</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'health'}
          className={`tab-btn ${activeSection === 'health' ? 'active' : ''}`}
          onClick={() => setActiveSection('health')}
        >
          <Cpu size={14} />
          <span>System Readiness</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'runbook'}
          className={`tab-btn ${activeSection === 'runbook' ? 'active' : ''}`}
          onClick={() => setActiveSection('runbook')}
        >
          <Terminal size={14} />
          <span>Stack Runbook</span>
        </button>
      </nav>

      {activeSection === 'gemini' && (
        <section aria-labelledby="demo-gemini-title">
          <div style={{ marginBottom: '14px', padding: '12px 16px', background: 'rgba(255, 71, 126, 0.08)', border: '1px solid rgba(255, 71, 126, 0.2)', borderRadius: 'var(--radius-sm)' }}>
            <h4 id="demo-gemini-title" style={{ fontSize: '0.88rem', color: 'var(--primary-accent)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={14} /> AI OCR & Text Extraction Capabilities
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Test Gemini 1.5/2.0 multimodal reasoning for automated extraction of TrxIDs, amounts, and sender accounts from buyer screenshot uploads and raw SMS alerts.
            </p>
          </div>
          <GeminiPlayground />
        </section>
      )}

      {activeSection === 'database' && (
        <section aria-labelledby="demo-database-title">
          <div style={{ marginBottom: '14px', padding: '12px 16px', background: 'rgba(97, 214, 207, 0.08)', border: '1px solid rgba(97, 214, 207, 0.2)', borderRadius: 'var(--radius-sm)' }}>
            <h4 id="demo-database-title" style={{ fontSize: '0.88rem', color: 'var(--cyan-accent)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} /> Raw Database Storage & Entity Inspection
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Inspect and verify raw storage persistence in Neon PostgreSQL, demonstrating schema models, JSON metadata storage, and CRUD operations.
            </p>
          </div>
          <DataExplorer />
        </section>
      )}

      {activeSection === 'retention' && (
        <section aria-labelledby="demo-retention-title">
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(183, 227, 92, 0.08)', border: '1px solid rgba(183, 227, 92, 0.2)', borderRadius: 'var(--radius-sm)' }}>
            <h4 id="demo-retention-title" style={{ fontSize: '0.88rem', color: 'var(--emerald-accent)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} /> Data Compliance & Automated Retention
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Inspect statutory compliance tools: 90-day automatic raw payment receipt purge policy and dry-run cleanup of obsolete operational records.
            </p>
          </div>
          <EvidenceRetentionPanel token="mock-seller-token" />
          <StructuredRetentionPanel token="mock-seller-token" />
        </section>
      )}

      {activeSection === 'health' && (
        <section aria-labelledby="demo-health-title">
          <div className="grid-2" style={{ gap: '14px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>FastAPI Runtime</span>
                <span className={`badge ${isHealthy ? 'online' : 'offline'}`}>
                  <span className="badge-dot" /> {isHealthy ? 'Live (Port 8000)' : 'Offline'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                High-performance Python backend serving idempotent order state machine, Bangladesh MFS SMS parsers, and public buyer verification tokens.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Neon Serverless PostgreSQL</span>
                <span className={`badge ${health?.database_configured ? 'online' : 'info'}`}>
                  <Database size={11} /> {health?.database_configured ? 'Connected' : 'Standby Mode'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Branching serverless Postgres persistence with transactional row locks for concurrent MFS transaction matching and tamper-evident audit logs.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Clerk Authentication</span>
                <span className={`badge ${isClerkReady ? 'online' : 'info'}`}>
                  <ShieldCheck size={11} /> {isClerkReady ? 'Configured' : 'Standby (Mock)'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                JWT session verification and organization-scoped identity for multi-tenant seller merchant desks.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Google Gemini Vision</span>
                <span className={`badge ${health?.gemini_configured ? 'online' : 'active'}`}>
                  <Sparkles size={11} /> {health?.gemini_configured ? 'Ready' : 'Mock Mode'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Structured vision prompt inference for reading bKash/Nagad app screenshot evidence uploaded by buyers.
              </p>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'runbook' && (
        <section aria-labelledby="demo-runbook-title">
          <div className="grid-2">
            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ color: 'var(--primary-accent)', marginBottom: '8px', fontSize: '0.9rem' }}>1. Backend (FastAPI + uv)</h4>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', overflowX: 'auto', background: '#05070a', padding: '12px', borderRadius: '6px' }}>
cd backend&#10;uv run uvicorn app.main:app --reload --port 8000
              </pre>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Interactive Swagger docs: <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-accent)' }}>http://localhost:8000/docs</a>
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ color: 'var(--primary-accent)', marginBottom: '8px', fontSize: '0.9rem' }}>2. Frontend (React + Vite)</h4>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', overflowX: 'auto', background: '#05070a', padding: '12px', borderRadius: '6px' }}>
cd frontend&#10;npm run dev
              </pre>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Vite client: <a href="http://localhost:5173" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-accent)' }}>http://localhost:5173</a>
              </p>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <h4 style={{ color: 'var(--primary-accent)', fontSize: '0.88rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} color="var(--emerald-accent)" />
              <span>Environment Configuration (.env)</span>
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              To connect live production services, configure <code style={{ color: 'var(--primary-accent)' }}>backend/.env</code> with <strong>DATABASE_URL</strong> (Neon), <strong>CLERK_SECRET_KEY</strong>, and <strong>GEMINI_API_KEY</strong>. Set <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> in <code style={{ color: 'var(--primary-accent)' }}>frontend/.env</code>. The starter runs seamlessly in offline standby mode until live credentials are provided.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
