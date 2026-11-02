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

const LIFECYCLE_BADGES: Record<OrderLifecycle, { bg: string; color: string; border: string }> = {
  awaiting_buyer: { bg: 'rgba(217, 119, 6, 0.12)', color: 'var(--amber-accent)', border: 'rgba(217, 119, 6, 0.3)' },
  pending: { bg: 'rgba(20, 102, 83, 0.12)', color: 'var(--primary-accent)', border: 'rgba(20, 102, 83, 0.3)' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald-accent)', border: 'rgba(16, 185, 129, 0.3)' },
  rejected: { bg: 'rgba(225, 29, 72, 0.12)', color: 'var(--rose-accent)', border: 'rgba(225, 29, 72, 0.3)' },
  cancelled: { bg: 'rgba(100, 116, 139, 0.12)', color: 'var(--text-secondary)', border: 'rgba(100, 116, 139, 0.3)' },
  expired: { bg: 'rgba(225, 29, 72, 0.12)', color: 'var(--rose-accent)', border: 'rgba(225, 29, 72, 0.3)' },
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
    : { bg: 'rgba(20, 102, 83, 0.1)', color: 'var(--text-primary)', border: 'var(--border-subtle)' };
  const stagingClass = `order-delivery-label order-delivery-label--${order.delivery_staged ? 'staged' : 'unstaged'}`;
  const stagingLabel = order.delivery_staged ? text.deliveryStaged : text.deliveryUnstaged;
  const isAwaiting = order.lifecycle === 'awaiting_buyer';
  const isExpired = order.lifecycle === 'expired';

  return (
    <article className="isolated-subcard order-card">
      <button
        type="button"
        className="order-card-mobile-summary"
        aria-expanded={mobileOpen}
        aria-controls={bodyId}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="order-card-mobile-name">{order.product_name}</span>
        <ChevronDown size={18} className={mobileOpen ? 'order-card-chevron-open' : ''} />
        <span className="order-card-mobile-status" style={{ background: badge.bg, color: badge.color }}>
          {lifecycleLabel(order.lifecycle, text)}
        </span>
        <span className={stagingClass}>{stagingLabel}</span>
        <span className="order-card-mobile-total">{text.total} BDT {formatOrderAmount(order.total_minor)}</span>
        <span className="order-card-mobile-inspect-hint">
          <Eye size={13} />
          <span>{text.details}</span>
        </span>
      </button>

      <div id={bodyId} className={`order-card-body${mobileOpen ? ' order-card-body-open' : ''}`}>
        <div className="order-card-header">
          <div className="order-card-identity">
            <span className="order-card-title">{order.product_name}</span>
            <span
              className="order-card-badge"
              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
            >
              {isExpired && <AlertTriangle size={11} />}
              {lifecycleLabel(order.lifecycle, text)}
            </span>
            <span className={stagingClass}>{stagingLabel}</span>

            {order.lifecycle === 'pending' && order.review_reasons && order.review_reasons.length > 0 && (
              <div className="order-card-review">
                <span className="order-card-review-label">
                  <AlertTriangle size={11} /> {text.review}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleReview(order.id)}
                  className="order-card-review-toggle"
                  aria-expanded={expanded}
                  title={text.toggleCodes}
                >
                  {expanded ? text.hideCodes : text.showCodes}
                </button>
                <span className="order-card-review-reasons">
                  {order.review_reasons.map((reason) => reviewLabel(reason, text)).join(' · ')}
                </span>
                <div style={{ display: expanded ? 'inline-flex' : 'none' }} className="order-card-review-codes">
                  {order.review_reasons.map((reason) => (
                    <span key={reason} className="order-card-code-pill">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="order-card-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm order-card-inspect-btn"
              onClick={() => onInspect(order)}
              title={text.inspectTitle}
            >
              <Eye size={14} />
              <span>{text.inspect}</span>
            </button>
            <BuyerLinkCopy key={order.portal_url} portalUrl={order.portal_url} />
            {order.lifecycle === 'pending' && (
              <ReviewAssistant
                order={order}
                token={token}
                onAction={(action) => onReviewAction?.(order, action)}
              />
            )}
          </div>
        </div>

        <div className="order-card-tally-box">
          <div className="order-card-facts">
            <div>
              <span className="order-card-fact-label">{text.total}</span>
              <span className="order-card-fact-val order-card-total-val">
                BDT {formatOrderAmount(order.total_minor)}
              </span>
            </div>
            <div>
              <span className="order-card-fact-label">{text.advance}</span>
              <span className="order-card-fact-val order-card-advance-val">
                BDT {formatOrderAmount(order.required_advance_minor)}
              </span>
            </div>
            <div>
              <span className="order-card-fact-label">
                {order.lifecycle === 'confirmed' ? text.actualCod : text.expectedCod}
              </span>
              <span className={`order-card-fact-val ${order.lifecycle === 'confirmed' ? 'order-card-cod-confirmed' : 'order-card-cod-pending'}`}>
                {formatRemainingCod(order)}
              </span>
            </div>
            <div>
              <span className="order-card-fact-label">{text.account}</span>
              <span className="order-card-fact-val order-card-account-val">
                {order.account_provider.toUpperCase()} ({order.account_receiving_number})
              </span>
            </div>
          </div>
        </div>

        <div className="order-card-timeline">
          <div>{text.created} {formatBangladeshDateTime(order.created_at, locale)}</div>
          <div className={`order-card-deadline ${isExpired ? 'is-expired' : isAwaiting ? 'is-awaiting' : ''}`}>
            <Clock size={12} />
            <span>
              {isExpired ? text.expiredAt : text.deadline}{' '}
              {formatBangladeshDateTime(order.expires_at, locale)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
