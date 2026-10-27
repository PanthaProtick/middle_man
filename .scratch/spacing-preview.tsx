import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/index.css';
import '/src/features/seller/BuyerCorrection.css';
const pills = ['Orders', 'Payments', 'Accounts'];
createRoot(document.getElementById('root')).render(<main className="app-container">
  <div className="status-badges">{pills.map(p=><span className="badge" key={p}>{p}</span>)}</div>
  <nav className="workspace-section-tabs">{pills.map(p=><button className="workspace-section-tab" key={p}>{p}</button>)}</nav>
  <div className="summary-pills">{pills.map(p=><span className="summary-account-pill" key={p}>{p}</span>)}</div>
  <div className="metrics-ribbon">{pills.map(p=><div className="metric-chip" key={p}>{p}</div>)}</div>
  <div className="grid-2">{pills.map(p=><section className="card" key={p}>{p}</section>)}</div>
  <section className="isolated-section">Receiving accounts</section><section className="isolated-section">Courier settings</section>
  <section className="buyer-correction">Parcel details</section><section className="buyer-correction">Delivery review</section>
  <div className="portal-main"><section className="card">Buyer order</section><section className="card">Buyer payment</section></div>
  <nav className="tabs-nav">{pills.map(p=><button className="tab-btn" key={p}>{p}</button>)}</nav>
  <div className="tech-strip">{pills.map(p=><span className="tech-chip" key={p}>{p}</span>)}</div>
  <div className="tag-list">{pills.map(p=><span className="tag" key={p}>{p}</span>)}</div>
</main>);
