import { Clock } from 'lucide-react';
import { formatOrderAmount } from './orderNumbers';
import { formatRemainingCod } from './api';
import { formatBangladeshDateTime } from '../locale/format';
import { orderCopy, lifecycleLabel } from '../locale/orderCopy';
import { DeveloperDetailsPanel } from './DeveloperDetailsPanel';
import type { SellerOrder } from './types';
import { useLocale } from '../locale/context';

interface OrderOverviewProps {
  order: SellerOrder;
}

export function OrderOverview({ order }: OrderOverviewProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const isExpired = order.lifecycle === 'expired';
  const isConfirmed = order.lifecycle === 'confirmed';
  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        {order.predecessor_order_id && (
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-accent)', marginBottom: '4px' }}>
            {text.predecessor} #{order.predecessor_order_id.slice(0, 8)}
          </div>
        )}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{text.product}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{order.product_name}</div>
      </div>

      <div className="modal-terms-grid">
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{text.agreed}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            BDT {formatOrderAmount(order.total_minor)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{text.required}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--cyan-accent)' }}>
            BDT {formatOrderAmount(order.required_advance_minor)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {isConfirmed ? text.actualRemaining : text.expectedRemaining}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: isConfirmed ? 'var(--emerald-accent)' : 'var(--primary-accent)' }}>
            {formatRemainingCod(order)}
          </div>
        </div>
      </div>

      <div className="detail-section-card">
        <div className="detail-section-header">
          <div className="detail-section-title" style={{ color: isExpired ? 'var(--rose-accent)' : 'var(--amber-accent)' }}>
            <Clock size={14} /> {text.deadlines}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '8px', fontSize: '0.8rem' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{text.status}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {lifecycleLabel(order.lifecycle, text)}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{text.version}</span>
            <span style={{ color: 'var(--text-primary)' }}>v{order.version}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{text.created}</span>
            <span style={{ color: 'var(--text-primary)' }}>{formatBangladeshDateTime(order.created_at, locale)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{isExpired ? text.expiredShort : text.deadlineShort}</span>
            <span style={{ color: isExpired ? 'var(--rose-accent)' : 'var(--amber-accent)' }}>
              {formatBangladeshDateTime(order.expires_at, locale)}
            </span>
          </div>
        </div>
      </div>

      <DeveloperDetailsPanel order={order} />
    </>
  );
}
