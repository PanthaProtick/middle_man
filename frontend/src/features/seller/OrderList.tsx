import React, { useState } from 'react';
import { Clock, AlertTriangle, Eye } from 'lucide-react';
import type { OrderLifecycle, SellerOrder } from './types';
import { formatBangladeshTime, formatRemainingCod } from './api';
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

const LIFECYCLE_BADGES: Record<OrderLifecycle, { label: string; bg: string; color: string }> = {
  awaiting_buyer: { label: 'Awaiting Buyer', bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber-accent)' },
  pending: { label: 'Pending Verification', bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-accent)' },
  confirmed: { label: 'Confirmed', bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald-accent)' },
  rejected: { label: 'Rejected', bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose-accent)' },
  cancelled: { label: 'Cancelled', bg: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-secondary)' },
  expired: { label: 'Expired', bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose-accent)' },
};

export function OrderList({
  token, onCorrected,
  orders,
  statusFilter,
  onFilterChange,
  nextCursor,
  onLoadMore,
}: OrderListProps): React.JSX.Element {
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);

  const confirmedCount = orders.filter((o) => o.lifecycle === 'confirmed').length;
  const exceptionCount = orders.filter((o) => o.lifecycle === 'pending' && o.review_reasons?.length > 0).length;

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ color: 'var(--primary-accent)', fontSize: '0.95rem', margin: 0 }}>
            Orders & Active Buyer Links ({orders.length})
          </h4>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', marginTop: '4px' }}>
            <span style={{ color: 'var(--emerald-accent)' }}>✓ Confirmed: {confirmedCount}</span>
            {exceptionCount > 0 && <span style={{ color: 'var(--rose-accent)' }}>⚠ Review Exceptions: {exceptionCount}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="order-status-filter" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Statuses</option>
            <option value="awaiting_buyer">Awaiting Buyer</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <OrderExport key={statusFilter} status={statusFilter} token={token} />
      {orders.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            No orders found. Click &quot;Create Order Link&quot; above to create an order and share its link with a buyer.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {orders.map((ord) => {
            const badge = LIFECYCLE_BADGES[ord.lifecycle] || { label: ord.lifecycle, bg: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' };
            const isAwaiting = ord.lifecycle === 'awaiting_buyer';
            const isExpired = ord.lifecycle === 'expired';

            return (
              <div
                key={ord.id}
                style={{
                  padding: '14px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginRight: '8px' }}>
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
                      {badge.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedOrder(ord)}
                      title="Inspect order details and snapshot"
                    >
                      <Eye size={13} />
                      <span>Inspect</span>
                    </button>
                    <BuyerLinkCopy key={ord.portal_url} portalUrl={ord.portal_url} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px', fontSize: '0.825rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Total: </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>BDT {(ord.total_minor / 100).toLocaleString()}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Advance: </span>
                    <span style={{ color: 'var(--cyan-accent)', fontWeight: 500 }}>BDT {(ord.required_advance_minor / 100).toLocaleString()}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {ord.lifecycle === 'confirmed' ? 'Actual COD: ' : 'Expected COD: '}
                    </span>
                    <span style={{ color: ord.lifecycle === 'confirmed' ? 'var(--emerald-accent)' : 'var(--primary-accent)', fontWeight: 600 }}>
                      {formatRemainingCod(ord)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Account: </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {ord.account_provider.toUpperCase()} ({ord.account_receiving_number})
                    </span>
                  </div>
                </div>

                {ord.lifecycle === 'pending' && ord.review_reasons && ord.review_reasons.length > 0 && (
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--rose-accent)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <AlertTriangle size={11} /> Review:
                    </span>
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
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                  <div>Created: {formatBangladeshTime(ord.created_at)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isExpired ? 'var(--rose-accent)' : isAwaiting ? 'var(--amber-accent)' : 'var(--text-secondary)' }}>
                    <Clock size={12} />
                    <span>
                      {isExpired ? 'Expired at: ' : 'Deadline (BST): '}
                      {formatBangladeshTime(ord.expires_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {nextCursor && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={onLoadMore}>
                Load More Orders
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
