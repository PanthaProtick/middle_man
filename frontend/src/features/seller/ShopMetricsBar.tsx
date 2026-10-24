import React from 'react';
import { ShoppingBag, CheckCircle2, Clock, AlertTriangle, Smartphone } from 'lucide-react';
import type { SellerOrder } from './types';

interface ShopMetricsBarProps {
  orders: SellerOrder[];
  transactionsCount: number;
}

export function ShopMetricsBar({ orders, transactionsCount }: ShopMetricsBarProps): React.JSX.Element {
  const confirmedCount = orders.filter((o) => o.lifecycle === 'confirmed').length;
  const awaitingCount = orders.filter((o) => o.lifecycle === 'awaiting_buyer').length;
  const pendingCount = orders.filter((o) => o.lifecycle === 'pending').length;

  return (
    <div className="metrics-ribbon" role="region" aria-label="Loaded order and payment overview">
      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-accent)' }}>
          <ShoppingBag size={18} />
        </div>
        <div>
          <div className="metric-val">{orders.length}</div>
          <div className="metric-lbl">Loaded Orders</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald-accent)' }}>
          <CheckCircle2 size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--emerald-accent)' }}>{confirmedCount}</div>
          <div className="metric-lbl">Confirmed</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber-accent)' }}>
          <Clock size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--amber-accent)' }}>{awaitingCount}</div>
          <div className="metric-lbl">Awaiting Buyer</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--rose-accent)' }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--rose-accent)' }}>{pendingCount}</div>
          <div className="metric-lbl">Pending Review</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--primary-accent)' }}>
          <Smartphone size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--primary-accent)' }}>{transactionsCount}</div>
          <div className="metric-lbl">Loaded Payments</div>
        </div>
      </div>
    </div>
  );
}
