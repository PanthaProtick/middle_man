import React, { useState } from 'react';
import { X, Clock, ShieldCheck, Package, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CourierAttemptStatus } from './courierReviewTypes';
import type { SellerOrder } from './types';
import { formatBangladeshTime, formatRemainingCod } from './api';
import { BuyerCorrection } from './BuyerCorrection';
import { PaymentException } from './PaymentException';
import { PaymentHistory } from './PaymentHistory';
import { CourierWorkspace } from './CourierWorkspace';
import { OrderOutcomes } from './OrderOutcomes';
import { EvidenceViewer } from './EvidenceViewer';
import { OrderExport } from './OrderExport';
import { BuyerLinkCopy } from './BuyerLinkCopy';
import { BuyerLinkAccess } from './BuyerLinkAccess';
import { DeveloperDetailsPanel } from './DeveloperDetailsPanel';

interface OrderDetailModalProps {
  order: SellerOrder;
  onClose: () => void;
  token?: string;
  onCorrected?: (order: SellerOrder) => void;
}

export function OrderDetailModal({ order: initialOrder, onClose, token, onCorrected }: OrderDetailModalProps): React.JSX.Element {
  const [order, setOrder] = useState(initialOrder);
  const [courierAttemptStatus, setCourierAttemptStatus] = useState<CourierAttemptStatus | null>(null);
  const [showReviewCodes, setShowReviewCodes] = useState(false);
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
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <OrderExport orderId={order.id} token={token} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} color="var(--primary-accent)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Order & Link Details</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          {order.predecessor_order_id && (
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-accent)', marginBottom: '4px' }}>
              Replaces predecessor order: #{order.predecessor_order_id.slice(0, 8)}
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Product Name</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{order.product_name}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Agreed</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              BDT {(order.total_minor / 100).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Required Advance</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--cyan-accent)' }}>
              BDT {(order.required_advance_minor / 100).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isConfirmed ? 'Actual Remaining COD' : 'Expected Remaining COD'}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: isConfirmed ? 'var(--emerald-accent)' : 'var(--primary-accent)' }}>
              {formatRemainingCod(order)}
            </div>
          </div>
        </div>

        {isConfirmed && (
          <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--emerald-accent)', marginBottom: '6px' }}>
              <CheckCircle2 size={14} /> Confirmed Payment Allocation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Basis: </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {order.allocation_basis ?? 'automatic'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Accepted Advance: </span>
                <span style={{ fontWeight: 600, color: 'var(--cyan-accent)' }}>
                  BDT {((order.total_minor - (order.actual_cod_minor ?? order.expected_cod_minor)) / 100).toLocaleString()}
                </span>
              </div>
              {order.completed_at && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Confirmed At: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatBangladeshTime(order.completed_at)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {hasReviewReasons && (
          <div style={{ marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--rose-accent)' }}>
                <AlertTriangle size={14} /> Review Required / অসঙ্গতি পাওয়া গেছে
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setShowReviewCodes((prev) => !prev)}
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                aria-expanded={showReviewCodes}
              >
                {showReviewCodes ? 'Hide error codes' : 'Show error codes (for dev)'}
              </button>
            </div>
            <div style={{ display: showReviewCodes ? 'flex' : 'none', flexWrap: 'wrap', gap: '6px' }}>
              {order.review_reasons.map((reason) => (
                <span
                  key={reason}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: 'var(--rose-accent)',
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

        <div style={{ marginBottom: '16px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--primary-accent)', marginBottom: '6px' }}>
            <ShieldCheck size={14} /> Fixed Receiving Account Snapshot
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {order.account_label} — {order.account_provider.toUpperCase()} ({order.account_receiving_number})
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Immutable destination for this order (deactivating or editing accounts later does not alter this).
          </div>
        </div>

        <div style={{ marginBottom: '16px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: isExpired ? 'var(--rose-accent)' : 'var(--amber-accent)', marginBottom: '6px' }}>
            <Clock size={14} /> Server Deadlines & Lifecycle (Bangladesh Time)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Status: </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {order.lifecycle.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Version: </span>
              <span style={{ color: 'var(--text-primary)' }}>v{order.version}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Created: </span>
              <span style={{ color: 'var(--text-primary)' }}>{formatBangladeshTime(order.created_at)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{isExpired ? 'Expired: ' : 'Deadline: '}</span>
              <span style={{ color: isExpired ? 'var(--rose-accent)' : 'var(--amber-accent)' }}>
                {formatBangladeshTime(order.expires_at)}
              </span>
            </div>
          </div>
        </div>

        <DeveloperDetailsPanel order={order} />

        {token && (isConfirmed || order.lifecycle === 'cancelled') && order.allocation_basis &&
          <CourierWorkspace key={`courier-${order.id}-${order.version}-${token}`} orderId={order.id} token={token} onAttemptStatusChanged={setCourierAttemptStatus} />}
        {token && order.allocation_basis === 'manual' && <PaymentHistory orderId={order.id} token={token} />}
        {token && order.lifecycle === 'pending' && <PaymentException key={`payment-${order.id}`} orderId={order.id} token={token}
          onAccepted={fresh => {setOrder(fresh); onCorrected?.(fresh);}} />}
        {token && order.buyer_revision && <EvidenceViewer key={`evidence-${order.id}`} orderId={order.id} token={token} buyerRevision={order.buyer_revision} />}
        {token && order.buyer_revision && <BuyerCorrection key={`${order.id}-${order.version}`} orderId={order.id} token={token} courierAttemptStatus={courierAttemptStatus} onCorrected={fresh => {setOrder(fresh); onCorrected?.(fresh);}} />}
        {token && (
          <OrderOutcomes
            key={`outcomes-${order.id}-${order.version}`}
            order={order}
            token={token}
            courierAttemptStatus={courierAttemptStatus}
            onUpdated={(fresh) => {
              setOrder(fresh);
              onCorrected?.(fresh);
            }}
            onReplaced={(newOrder) => {
              setOrder(newOrder);
              onCorrected?.(newOrder);
            }}
          />
        )}
        {token && <BuyerLinkAccess key={`access-${order.id}`} order={order} token={token}
          onUpdated={fresh => { setOrder(fresh); onCorrected?.(fresh); }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <BuyerLinkCopy key={order.portal_url} portalUrl={order.portal_url} detail />
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
