import React, { useState } from 'react';
import { X, Copy, Check, Clock, ShieldCheck, Package, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { SellerOrder } from './types';
import { formatBangladeshTime, formatRemainingCod } from './api';
import { BuyerCorrection } from './BuyerCorrection';

interface OrderDetailModalProps {
  order: SellerOrder;
  onClose: () => void;
  token?: string;
  onCorrected?: (order: SellerOrder) => void;
}

export function OrderDetailModal({ order: initialOrder, onClose, token, onCorrected }: OrderDetailModalProps): React.JSX.Element {
  const [order, setOrder] = useState(initialOrder);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullUrl = `${window.location.origin}${order.portal_url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isExpired = order.lifecycle === 'expired';
  const isConfirmed = order.lifecycle === 'confirmed';
  const hasReviewReasons = order.lifecycle === 'pending' && order.review_reasons && order.review_reasons.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0d131f',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} color="#6366f1" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>Order & Link Details</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Product Name</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>{order.product_name}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px', background: 'rgba(10, 14, 23, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Agreed</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
              BDT {(order.total_minor / 100).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Required Advance</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8' }}>
              BDT {(order.required_advance_minor / 100).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isConfirmed ? 'Actual Remaining COD' : 'Expected Remaining COD'}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: isConfirmed ? '#34d399' : '#a5b4fc' }}>
              {formatRemainingCod(order)}
            </div>
          </div>
        </div>

        {isConfirmed && (
          <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#86efac', marginBottom: '6px' }}>
              <CheckCircle2 size={14} /> Confirmed Payment Allocation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Basis: </span>
                <span style={{ fontWeight: 600, color: '#f1f5f9', textTransform: 'capitalize' }}>
                  {order.allocation_basis ?? 'automatic'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Accepted Advance: </span>
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                  BDT {((order.total_minor - (order.actual_cod_minor ?? order.expected_cod_minor)) / 100).toLocaleString()}
                </span>
              </div>
              {order.completed_at && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Confirmed At: </span>
                  <span style={{ color: '#cbd5e1' }}>{formatBangladeshTime(order.completed_at)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {hasReviewReasons && (
          <div style={{ marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#fca5a5', marginBottom: '6px' }}>
              <AlertTriangle size={14} /> Review Required / অসঙ্গতি পাওয়া গেছে
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {order.review_reasons.map((reason) => (
                <span
                  key={reason}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fecaca',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px', background: 'rgba(10, 14, 23, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#c7d2fe', marginBottom: '6px' }}>
            <ShieldCheck size={14} /> Fixed Receiving Account Snapshot
          </div>
          <div style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
            {order.account_label} — {order.account_provider.toUpperCase()} ({order.account_receiving_number})
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            Immutable destination for this order (deactivating or editing accounts later does not alter this).
          </div>
        </div>

        <div style={{ marginBottom: '16px', background: 'rgba(10, 14, 23, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: isExpired ? '#fca5a5' : '#fbbf24', marginBottom: '6px' }}>
            <Clock size={14} /> Server Deadlines & Lifecycle (Bangladesh Time)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Status: </span>
              <span style={{ fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>
                {order.lifecycle.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Version: </span>
              <span style={{ color: '#fff' }}>v{order.version}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Created: </span>
              <span style={{ color: '#cbd5e1' }}>{formatBangladeshTime(order.created_at)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{isExpired ? 'Expired: ' : 'Deadline: '}</span>
              <span style={{ color: isExpired ? '#fca5a5' : '#fbbf24' }}>
                {formatBangladeshTime(order.expires_at)}
              </span>
            </div>
          </div>
        </div>

        {token && order.buyer_revision && <BuyerCorrection key={order.id} orderId={order.id} token={token} onCorrected={fresh => {setOrder(fresh); onCorrected?.(fresh);}} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check size={14} color="#34d399" />
                  <span style={{ color: '#34d399' }}>Copied Buyer Link</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Buyer Link</span>
                </>
              )}
            </button>
            <a
              href={order.portal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              <ExternalLink size={14} />
              <span>Open Portal</span>
            </a>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
