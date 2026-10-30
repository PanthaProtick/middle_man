import { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatOrderAmount } from './orderNumbers';
import { formatBangladeshDateTime } from '../locale/format';
import { orderCopy, reviewLabel, allocationLabel } from '../locale/orderCopy';
import { PaymentHistory } from './PaymentHistory';
import { PaymentException } from './PaymentException';
import { ReviewAssistant } from './ReviewAssistant';
import type { SellerOrder } from './types';
import { useLocale } from '../locale/context';

interface OrderPaymentDetailsProps {
  order: SellerOrder;
  token?: string;
  onCorrected: (order: SellerOrder) => void;
  onNavigateTab?: (tabIndex: number) => void;
  onCheckTransactions?: () => void;
}

export function OrderPaymentDetails({ order, token, onCorrected, onNavigateTab, onCheckTransactions }: OrderPaymentDetailsProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const [showReviewCodes, setShowReviewCodes] = useState(false);
  const isConfirmed = order.lifecycle === 'confirmed';
  const hasReviewReasons = order.lifecycle === 'pending' && order.review_reasons && order.review_reasons.length > 0;
  return (
    <>
      {isConfirmed && (
        <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--emerald-accent)', marginBottom: '6px' }}>
            <CheckCircle2 size={14} /> {text.allocation}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '8px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{text.basis}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {allocationLabel(order.allocation_basis, text)}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{text.accepted}</span>
              <span style={{ fontWeight: 600, color: 'var(--cyan-accent)' }}>
                BDT {formatOrderAmount(order.total_minor - (order.actual_cod_minor ?? order.expected_cod_minor))}
              </span>
            </div>
            {order.completed_at && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{text.confirmedAt}</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatBangladeshDateTime(order.completed_at, locale)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {isConfirmed && <p>{text.confirmationHelp}</p>}

      {hasReviewReasons && (
        <div style={{ marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--rose-accent)' }}>
              <AlertTriangle size={14} /> {text.reviewRequired}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setShowReviewCodes((prev) => !prev)}
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              aria-expanded={showReviewCodes}
            >
              {showReviewCodes ? text.hideErrors : text.showErrors}
            </button>
          </div>
          <p>{order.review_reasons.map(reason => reviewLabel(reason, text)).join(" · ")}</p>
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

      <div className="detail-section-card">
        <div className="detail-section-header">
          <div className="detail-section-title">
            <ShieldCheck size={14} /> {text.snapshot}
          </div>
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
          {order.account_label} — {order.account_provider.toUpperCase()} ({order.account_receiving_number})
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {text.immutable}
        </div>
      </div>

      {token && order.allocation_basis === 'manual' && <PaymentHistory orderId={order.id} token={token} />}
      {token && order.lifecycle === 'pending' && (
        <ReviewAssistant
          key={`assistance-${order.id}`}
          order={order}
          token={token}
          onAction={actionId => {
            if (actionId === 'CHECK_TRANSACTIONS') onCheckTransactions?.();
            if (actionId === 'CORRECT_BUYER_DETAILS' && onNavigateTab) {
              onNavigateTab(3);
            }
          }}
        />
      )}
      {token && order.lifecycle === 'pending' && <PaymentException key={`payment-${order.id}`} orderId={order.id} token={token}
        onAccepted={onCorrected} />}
    </>
  );
}
