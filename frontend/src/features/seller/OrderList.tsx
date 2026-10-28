import { formatOrderAmount } from './orderNumbers';
import React, { useState } from 'react';
import { Clock, AlertTriangle, Eye, ShoppingBag } from 'lucide-react';
import type { OrderLifecycle, SellerOrder } from './types';
import { formatRemainingCod } from './api';
import { formatBangladeshDateTime } from '../locale/format';
import { useLocale } from '../locale/context';
import { orderCopy, lifecycleLabel, reviewLabel } from '../locale/orderCopy';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderExport } from './OrderExport';
import { BuyerLinkCopy } from './BuyerLinkCopy';

interface OrderListProps {
  token?: string;
  onCorrected?: (order: SellerOrder) => void;
  orders: SellerOrder[];
  statusFilter: string;
  onFilterChange: (status: string) => void;
  nextCursor: string | null;
  onLoadMore: () => void;
}

const LIFECYCLE_BADGES: Record<OrderLifecycle, { bg: string; color: string }> = {
  awaiting_buyer: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber-accent)' },
  pending: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-accent)' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald-accent)' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose-accent)' },
  cancelled: { bg: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-secondary)' },
  expired: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose-accent)' },
};

export function OrderList({
  token, onCorrected,
  orders,
  statusFilter,
  onFilterChange,
  nextCursor,
  onLoadMore,
}: OrderListProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});

  const toggleReviewCodes = (id: string) => {
    setExpandedReviewIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const confirmedCount = orders.filter((o) => o.lifecycle === 'confirmed').length;
  const exceptionCount = orders.filter((o) => o.lifecycle === 'pending' && o.review_reasons?.length > 0).length;

  return (
    <div className="isolated-section" style={{ marginTop: '20px' }}>
      <div className="isolated-section-header">
        <div>
          <h4 className="isolated-section-title">
            <ShoppingBag size={18} /> {text.list} ({orders.length})
          </h4>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--emerald-accent)' }}>✓ {text.confirmed}: {confirmedCount}</span>
            {exceptionCount > 0 && <span style={{ color: 'var(--rose-accent)' }}>⚠ {text.exceptions} {exceptionCount}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label htmlFor="order-status-filter" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{text.status}</label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="form-control"
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              minHeight: '36px',
              width: 'auto',
            }}
          >
            <option value="">{text.all}</option>
            <option value="awaiting_buyer">{lifecycleLabel("awaiting_buyer", text)}</option>
            <option value="pending">{lifecycleLabel("pending", text)}</option>
            <option value="confirmed">{lifecycleLabel("confirmed", text)}</option>
            <option value="rejected">{lifecycleLabel("rejected", text)}</option>
            <option value="expired">{lifecycleLabel("expired", text)}</option>
            <option value="cancelled">{lifecycleLabel("cancelled", text)}</option>
          </select>
        </div>
      </div>

      <OrderExport key={statusFilter} status={statusFilter} token={token} />
      {orders.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            {text.empty}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((ord) => {
            const badge = Object.hasOwn(LIFECYCLE_BADGES, ord.lifecycle) ? LIFECYCLE_BADGES[ord.lifecycle] : { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' };
            const isAwaiting = ord.lifecycle === 'awaiting_buyer';
            const isExpired = ord.lifecycle === 'expired';

            return (
              <div key={ord.id} className="isolated-subcard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ minWidth: 0, maxWidth: '100%' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginRight: '8px', wordBreak: 'break-word' }}>
                      {ord.product_name}
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
                      {lifecycleLabel(ord.lifecycle, text)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedOrder(ord)}
                      title={text.inspectTitle}
                    >
                      <Eye size={13} />
                      <span>{text.inspect}</span>
                    </button>
                    <BuyerLinkCopy key={ord.portal_url} portalUrl={ord.portal_url} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '8px', marginBottom: '10px', fontSize: '0.825rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>{text.total}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>BDT {formatOrderAmount(ord.total_minor)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>{text.advance}</span>
                    <span style={{ color: 'var(--cyan-accent)', fontWeight: 500 }}>BDT {formatOrderAmount(ord.required_advance_minor)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {ord.lifecycle === 'confirmed' ? text.actualCod : text.expectedCod}
                    </span>
                    <span style={{ color: ord.lifecycle === 'confirmed' ? 'var(--emerald-accent)' : 'var(--primary-accent)', fontWeight: 600 }}>
                      {formatRemainingCod(ord)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>{text.account}</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {ord.account_provider.toUpperCase()} ({ord.account_receiving_number})
                    </span>
                  </div>
                </div>

                {ord.lifecycle === 'pending' && ord.review_reasons && ord.review_reasons.length > 0 && (
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--rose-accent)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <AlertTriangle size={11} /> {text.review}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleReviewCodes(ord.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-accent)',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        textDecoration: 'underline',
                        padding: '0 2px',
                      }}
                      aria-expanded={Boolean(expandedReviewIds[ord.id])}
                      title={text.toggleCodes}
                    >
                      {expandedReviewIds[ord.id] ? text.hideCodes : text.showCodes}
                    </button>
                    <span>{ord.review_reasons.map(reason => reviewLabel(reason, text)).join(" · ")}</span>
                    <div style={{ display: expandedReviewIds[ord.id] ? 'inline-flex' : 'none', gap: '4px', flexWrap: 'wrap' }}>
                      {ord.review_reasons.map((r) => (
                        <span
                          key={r}
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
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                  <div>{text.created} {formatBangladeshDateTime(ord.created_at, locale)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isExpired ? 'var(--rose-accent)' : isAwaiting ? 'var(--amber-accent)' : 'var(--text-secondary)' }}>
                    <Clock size={12} />
                    <span>
                      {isExpired ? text.expiredAt : text.deadline}
                      {formatBangladeshDateTime(ord.expires_at, locale)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {nextCursor && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={onLoadMore}>
                {text.more}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          token={token}
          onCorrected={fresh => {setSelectedOrder(fresh); onCorrected?.(fresh);}}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
