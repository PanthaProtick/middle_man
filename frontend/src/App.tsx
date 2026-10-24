import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowLeft,
} from 'lucide-react';
import Header from './components/Header';
import { SellerWorkspace } from './features/seller';
import { BuyerPortal } from './features/buyer';
import { DemoTools } from './features/demo';
import { fetchHealth, type HealthStatus } from './services/api';


export default function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'orders' | 'demo'>('orders');
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isOrderPortal = pathname.startsWith('/orders/');
  const portalToken = isOrderPortal ? pathname.replace('/orders/', '').trim() : '';

  useEffect(() => {
    if (isOrderPortal) return;
    fetchHealth().then(setHealth);
    const interval = setInterval(() => {
      fetchHealth().then(setHealth);
    }, 10000);
    return () => clearInterval(interval);
  }, [isOrderPortal]);

  if (isOrderPortal && portalToken) {
    return (
      <div className="portal-shell">
        <header className="portal-header">
          <div className="portal-brand">
            <Store size={18} color="var(--primary-accent)" />
            <span>Order confirmation / অর্ডার নিশ্চিতকরণ</span>
          </div>
          <a
            href="/"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <ArrowLeft size={13} /> Back to Home
          </a>
        </header>
        <BuyerPortal portalToken={portalToken} />
        <div className="portal-footer-action">
          <p>Never share your PIN or OTP. Your seller reviews the order and payment details.</p>
          <a
            href={`/?order-link=${encodeURIComponent(portalToken)}`}
            referrerPolicy="no-referrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', color: 'var(--primary-accent)', fontSize: '0.8rem' }}
          >
            <Store size={13} /> Seller Access: Correct Buyer Information
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <a href="#workspace" className="skip-link">Skip to workspace</a>
      {/* Navbar with Clean Store Status & Demo Trigger */}
      <Header
        health={health}
        onOpenDemo={() => setActiveTab(activeTab === 'demo' ? 'orders' : 'demo')}
        isDemoActive={activeTab === 'demo'}
      />

      <section className="app-masthead" aria-labelledby="workspace-heading">
        <div>
          <p className="eyebrow">A little order. A lot less back-and-forth.</p>
          <h2 id="workspace-heading">Your shop, <em>in good order.</em></h2>
          <p className="masthead-copy">
            From a conversation to a confirmed order. Collect buyer details, check advances, and get ready to deliver.
          </p>
        </div>
        <ol className="workflow-guide" aria-label="How order confirmation works">
          <li><span>01</span> Share an order link</li>
          <li><span>02</span> Buyer adds details &amp; payment</li>
          <li><span>03</span> Review, confirm &amp; deliver</li>
        </ol>
      </section>

      {/* Main View Area */}
      <main id="workspace" tabIndex={-1}>
        {activeTab === 'demo' ? (
          <DemoTools health={health} />
        ) : (
          <SellerWorkspace />
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>middleman · Made for the way you sell. Seller confirmation does not imply payment-provider verification.</p>
      </footer>
    </div>
  );
}
