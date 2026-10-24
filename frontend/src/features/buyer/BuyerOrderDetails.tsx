import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Clock, Store } from 'lucide-react';
import type { PublicOrder } from './types';
import { formatBDT } from './api';
import { formatBangladeshTime } from '../seller/api';

interface BuyerOrderDetailsProps {
  order: PublicOrder;
}

export function BuyerOrderDetails({ order }: BuyerOrderDetailsProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(order.account_receiving_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
      {/* Shop & Product Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Store size={20} color="#6366f1" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>{order.shop_display_name}</h3>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#a5b4fc',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          Secure Order Portal
        </span>
      </div>

      <div className="buyer-order-item" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Item / পণ্য:</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
          {order.product_name}
        </div>
      </div>

      {/* Commercial Terms Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div className="buyer-order-item">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total / মোট মূল্য</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>
            {formatBDT(order.total_minor)}
          </div>
        </div>

        <div className="buyer-order-item" style={{ borderLeft: '3px solid #818cf8' }}>
          <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>Advance Due / অগ্রিম</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#c7d2fe', marginTop: '2px' }}>
            {formatBDT(order.required_advance_minor)}
          </div>
        </div>

        <div className="buyer-order-item">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Expected COD / বাকি COD</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>
            {formatBDT(order.expected_cod_minor)}
          </div>
        </div>
      </div>

      {/* Receiving Account Box */}
      <div className="buyer-payment-destination" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} />
            <span>Send Advance Money to Official Account / অগ্রিম পাঠানোর নাম্বার:</span>
          </div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#c7d2fe' }}>
            {order.account_provider}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px', color: '#ffffff' }}>
              {order.account_receiving_number}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {order.account_label} ({order.account_provider.toUpperCase()})
            </div>
          </div>

          <button
            type="button"
            data-testid="copy-receiving-btn"
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
          >
            {copied ? (
              <>
                <Check size={16} color="#10b981" />
                <span style={{ color: '#10b981' }}>Copied / কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy / কপি করুন</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expiry time notice */}
      {order.lifecycle === 'awaiting_buyer' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
        <Clock size={14} />
        <span>Valid until / মেয়াদ: {formatBangladeshTime(order.expires_at)}</span>
      </div>}
    </div>
  );
}
