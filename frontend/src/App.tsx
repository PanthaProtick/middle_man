import React, { useState, useEffect } from 'react';
import { Sparkles, Database, BookOpen, Terminal, CheckCircle2, Store } from 'lucide-react';
import Header from './components/Header';
import TechStackBar from './components/TechStackBar';
import { GeminiPlayground } from './features/gemini';
import { DataExplorer } from './features/items';
import { SellerWorkspace } from './features/seller';
import { fetchHealth, type HealthStatus } from './services/api';

type TabType = 'seller' | 'gemini' | 'database' | 'setup';

export default function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('seller');
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth);
    const interval = setInterval(() => {
      fetchHealth().then(setHealth);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      {/* Navbar with Live Badges */}
      <Header health={health} />

      {/* Hero Header */}
      <section className="hero">
        <div className="hero-pill">
          <span>🚀 Start Building with Dev Template</span>
        </div>
        <h2>
          Build Faster with <span className="gradient-text">Gemini & Full-Stack Speed</span>
        </h2>
        <p>
          Instant development scaffolding equipped with React, FastAPI async endpoints, Neon Serverless PostgreSQL, Google Gemini AI integration, and uv package management.
        </p>
      </section>

      {/* Tech Stack Chip Bar */}
      <TechStackBar />

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'seller' ? 'active' : ''}`}
          onClick={() => setActiveTab('seller')}
        >
          <Store size={16} />
          <span>Seller Workspace</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'gemini' ? 'active' : ''}`}
          onClick={() => setActiveTab('gemini')}
        >
          <Sparkles size={16} />
          <span>Gemini Playground</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          <Database size={16} />
          <span>Data & Storage</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          <BookOpen size={16} />
          <span>Stack Runbook</span>
        </button>
      </nav>

      {/* Tab Panels */}
      <main>
        {activeTab === 'seller' && <SellerWorkspace />}
        {activeTab === 'gemini' && <GeminiPlayground />}
        {activeTab === 'database' && <DataExplorer />}
        {activeTab === 'setup' && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Terminal size={18} color="#6366f1" />
                  <span>Developer Quickstart & Runbook</span>
                </div>
                <p className="card-subtitle">Commands to boot backend, frontend, and connect credentials</p>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: '16px' }}>
              <div style={{ background: 'rgba(10, 14, 23, 0.6)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: '#c7d2fe', marginBottom: '8px' }}>1. Backend (FastAPI + uv)</h4>
                <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#94a3b8', overflowX: 'auto', background: '#05070a', padding: '12px', borderRadius: '6px' }}>
cd backend&#10;uv run uvicorn app.main:app --reload --port 8000
                </pre>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Interactive Swagger docs available at: <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>http://localhost:8000/docs</a>
                </p>
              </div>

              <div style={{ background: 'rgba(10, 14, 23, 0.6)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: '#c7d2fe', marginBottom: '8px' }}>2. Frontend (React + Vite)</h4>
                <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#94a3b8', overflowX: 'auto', background: '#05070a', padding: '12px', borderRadius: '6px' }}>
cd frontend&#10;npm run dev
                </pre>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Vite client available at: <a href="http://localhost:5173" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>http://localhost:5173</a>
                </p>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <h4 style={{ color: '#e0e7ff', fontSize: '0.9rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Environment Configuration (.env)</span>
              </h4>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                To connect live services, configure your <code style={{ color: '#c7d2fe' }}>backend/.env</code> with your <strong>DATABASE_URL</strong> from Neon, <strong>CLERK_SECRET_KEY</strong> from Clerk, and <strong>GEMINI_API_KEY</strong> from Google AI Studio. Also set <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> in <code style={{ color: '#c7d2fe' }}>frontend/.env</code>. The starter runs seamlessly in standby mode until credentials are provided!
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>Dev Template • Built with React, FastAPI, Neon, Google Gemini, and uv</p>
      </footer>
    </div>
  );
}
