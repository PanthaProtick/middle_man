import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import type { PublicOrder } from './types';
import { formatBDT } from './api';

interface BuyerStatusViewProps {
  order: PublicOrder;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function BuyerStatusView({ order, onRefresh, isRefreshing }: BuyerStatusViewProps): React.JSX.Element {
  const isPending = order.lifecycle === 'pending';
  const isConfirmed = order.lifecycle === 'confirmed';
  const isExpired = order.lifecycle === 'expired';
  const isRejected = order.lifecycle === 'rejected';
  const isCancelled = order.lifecycle === 'cancelled';

  return (
    <div className="card" style={{ border: '1px solid var(--border-subtle)', textAlign: 'center', padding: '24px 16px' }}>
      {/* Icon & Status Heading */}
      {isPending && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <Clock size={28} color="#eab308" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fef08a' }}>
            Pending Seller Review / তথ্য জমা হয়েছে
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Your details and payment claim have been recorded. The seller will verify your payment shortly.
          </p>
        </div>
      )}

      {isConfirmed && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <CheckCircle2 size={28} color="#22c55e" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#86efac' }}>
            Order Confirmed / অর্ডার নিশ্চিত হয়েছে!
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            The seller has confirmed your advance payment and your order is in progress.
          </p>
        </div>
      )}

      {isExpired && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <AlertTriangle size={28} color="#ef4444" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fca5a5' }}>
            Order Link Expired / অর্ডারের মেয়াদ শেষ
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            This link was not completed before the 48-hour deadline. Please contact the seller for a new link.
          </p>
        </div>
      )}

      {(isRejected || isCancelled) && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(148, 163, 184, 0.15)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <XCircle size={28} color="#94a3b8" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#cbd5e1' }}>
            {isRejected ? 'Order Declined / অর্ডার গ্রহণ করা হয়নি' : 'Order Cancelled / অর্ডার বাতিল করা হয়েছে'}
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Please contact the seller on Facebook/Messenger for further details.
          </p>
        </div>
      )}

      {/* Acknowledgement Reference */}
      {order.submission_acknowledgement && (
        <div
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: '#c7d2fe',
            marginBottom: '18px',
          }}
        >
          Reference: <span style={{ fontWeight: 600 }}>{order.submission_acknowledgement}</span>
        </div>
      )}

      {/* COD Summary Box */}
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          background: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
          <span>Product / পণ্য:</span>
          <span style={{ fontWeight: 500, color: '#f1f5f9' }}>{order.product_name}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
          <span>Total / মোট মূল্য:</span>
          <span style={{ fontWeight: 500, color: '#f1f5f9' }}>{formatBDT(order.total_minor)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px dashed var(--border-subtle)',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: isConfirmed ? '#86efac' : '#cbd5e1',
          }}
        >
          <span>{isConfirmed ? 'Remaining COD / ডেলিভারির সময় প্রদেয়:' : 'Expected COD / আনুমানিক প্রদেয়:'}</span>
          <span>{formatBDT(order.actual_cod_minor ?? order.expected_cod_minor)}</span>
        </div>
      </div>

      {/* Manual & Auto Polling Status */}
      {isPending && (
        <div style={{ marginTop: '14px' }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Checking / চেক করা হচ্ছে...' : 'Refresh Status / স্ট্যাটাস রিফ্রেশ'}</span>
          </button>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
            Auto-checking every 30 seconds (স্বয়ংক্রিয়ভাবে প্রতি ৩০ সেকেন্ডে চেক করা হচ্ছে)
          </div>
        </div>
      )}
    </div>
  );
}
