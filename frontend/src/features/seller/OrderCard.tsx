import { useId, useState } from 'react';
import { Clock, AlertTriangle, Eye, ChevronDown } from 'lucide-react';
import './OrderCard.css';
import type { OrderLifecycle, SellerOrder } from './types';
import { formatOrderAmount } from './orderNumbers';
import { formatRemainingCod } from './api';
import { formatBangladeshDateTime } from '../locale/format';
import { lifecycleLabel, reviewLabel, type OrderCopy } from '../locale/orderCopy';
import { BuyerLinkCopy } from './BuyerLinkCopy';
import { ReviewAssistant } from './ReviewAssistant';
import type { ReviewAction } from './reviewAssistanceApi';

const LIFECYCLE_BADGES: Record<OrderLifecycle, { bg: string; color: string }> = {
  awaiting_buyer: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber-accent)' },
  pending: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-accent)' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald-accent)' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose-accent)' },
  cancelled: { bg: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-secondary)' },
  expired: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose-accent)' },
};

interface OrderCardProps {
  order: SellerOrder;
  token?: string;
  onReviewAction?: (order: SellerOrder, action: ReviewAction) => void;
  text: OrderCopy;
  locale: 'en' | 'bn';
  expanded: boolean;
  onInspect: (order: SellerOrder) => void;
  onToggleReview: (id: string) => void;
}

export function OrderCard({
  order, token, text, locale, expanded, onInspect, onToggleReview, onReviewAction,
}: OrderCardProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const bodyId = useId();
  const badge = Object.hasOwn(LIFECYCLE_BADGES, order.lifecycle)
    ? LIFECYCLE_BADGES[order.lifecycle]
    : { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' };
  const stagingClass = `order-delivery-label order-delivery-label--${order.delivery_staged ? 'staged' : 'unstaged'}`;
  const stagingLabel = order.delivery_staged ? text.deliveryStaged : text.deliveryUnstaged;
  const isAwaiting = order.lifecycle === 'awaiting_buyer';
  const isExpired = order.lifecycle === 'expired';

  return (
    <div className="isolated-subcard order-card">
      <button type="button" className="order-card-mobile-summary"
        aria-expanded={mobileOpen} aria-controls={bodyId}
        onClick={() => setMobileOpen(open => !open)}>
        <span className="order-card-mobile-name">{order.product_name}</span>
        <ChevronDown size={18} className={mobileOpen ? 'order-card-chevron-open' : ''} />
        <span className="order-card-mobile-status" style={{ background: badge.bg, color: badge.color }}>
          {lifecycleLabel(order.lifecycle, text)}
        </span>
        <span className={stagingClass}>{stagingLabel}</span>
        <span className="order-card-mobile-total">{text.total} BDT {formatOrderAmount(order.total_minor)}</span>
      </button>
      <div id={bodyId} className={`order-card-body${mobileOpen ? ' order-card-body-open' : ''}`}>
      <div className="order-card-header">
        <div className="order-card-identity">
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginRight: '8px', wordBreak: 'break-word' }}>
            {order.product_name}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 600,
              background: badge.bg,
              color: badge.color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isExpired && <AlertTriangle size={11} />}
            {lifecycleLabel(order.lifecycle, text)}
          </span>
          <span className={stagingClass}>{stagingLabel}</span>
          {order.lifecycle === 'pending' && order.review_reasons && order.review_reasons.length > 0 && (
            <div className="order-card-review">
              <span style={{ fontSize: '0.725rem', color: 'var(--rose-accent)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <AlertTriangle size={11} /> {text.review}
              </span>
              <button
                type="button"
                onClick={() => onToggleReview(order.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-accent)',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  textDecoration: 'underline',
                  padding: '0 2px',
                }}
                aria-expanded={expanded}
                title={text.toggleCodes}
              >
                {expanded ? text.hideCodes : text.showCodes}
              </button>
              <span>{order.review_reasons.map((reason) => reviewLabel(reason, text)).join(' · ')}</span>
              <div style={{ display: expanded ? 'inline-flex' : 'none', gap: '4px', flexWrap: 'wrap' }}>
                {order.review_reasons.map((reason) => (
                  <span
                    key={reason}
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 6px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--rose-accent)',
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
        </div>

        <div className="order-card-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onInspect(order)}
            title={text.inspectTitle}
          >
            <Eye size={13} />
            <span>{text.inspect}</span>
          </button>
          <BuyerLinkCopy key={order.portal_url} portalUrl={order.portal_url} />
          {order.lifecycle === 'pending' && (
            <ReviewAssistant
              order={order}
              token={token}
              onAction={action => onReviewAction?.(order, action)}
            />
          )}
        </div>
      </div>

      <div className="order-card-facts">
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>{text.total}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>BDT {formatOrderAmount(order.total_minor)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>{text.advance}</span>
          <span style={{ color: 'var(--cyan-accent)', fontWeight: 500 }}>BDT {formatOrderAmount(order.required_advance_minor)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>
            {order.lifecycle === 'confirmed' ? text.actualCod : text.expectedCod}
          </span>
          <span style={{ color: order.lifecycle === 'confirmed' ? 'var(--emerald-accent)' : 'var(--primary-accent)', fontWeight: 600 }}>
            {formatRemainingCod(order)}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>{text.account}</span>
          <span style={{ color: 'var(--text-primary)' }}>
            {order.account_provider.toUpperCase()} ({order.account_receiving_number})
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
        <div>{text.created} {formatBangladeshDateTime(order.created_at, locale)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isExpired ? 'var(--rose-accent)' : isAwaiting ? 'var(--amber-accent)' : 'var(--text-secondary)' }}>
          <Clock size={12} />
          <span>
            {isExpired ? text.expiredAt : text.deadline}
            {formatBangladeshDateTime(order.expires_at, locale)}
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
