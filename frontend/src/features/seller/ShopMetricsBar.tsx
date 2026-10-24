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
    <div className="metrics-ribbon" role="region" aria-label="Shop Performance Overview">
      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
          <ShoppingBag size={18} />
        </div>
        <div>
          <div className="metric-val">{orders.length}</div>
          <div className="metric-lbl">Total Orders</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          <CheckCircle2 size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: '#34d399' }}>{confirmedCount}</div>
          <div className="metric-lbl">Confirmed</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
          <Clock size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: '#fbbf24' }}>{awaitingCount}</div>
          <div className="metric-lbl">Awaiting Buyer</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fca5a5' }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: '#fca5a5' }}>{pendingCount}</div>
          <div className="metric-lbl">Pending Review</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#67e8f9' }}>
          <Smartphone size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: '#67e8f9' }}>{transactionsCount}</div>
          <div className="metric-lbl">Received Payments</div>
        </div>
      </div>
    </div>
  );
}
