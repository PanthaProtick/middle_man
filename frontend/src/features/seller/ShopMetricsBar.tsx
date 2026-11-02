import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { ShoppingBag, CheckCircle2, Clock, Truck, AlertTriangle, Smartphone } from 'lucide-react';
import type { TodayMetrics } from './useTodayMetrics';
import './ShopMetricsBar.css';

interface ShopMetricsBarProps {
  metrics: TodayMetrics | null;
}

export function ShopMetricsBar({ metrics }: ShopMetricsBarProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];

  return (
    <div className="metrics-ribbon" role="region" aria-label={text.overview}>
      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(20, 102, 83, 0.12)', color: 'var(--primary-accent)' }}>
          <ShoppingBag size={18} />
        </div>
        <div>
          <div className="metric-val">{metrics?.orders ?? '—'}</div>
          <div className="metric-lbl">{text.loadedOrders}</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald-accent)' }}>
          <CheckCircle2 size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--emerald-accent)' }}>{metrics?.confirmed ?? '—'}</div>
          <div className="metric-lbl">{text.confirmed}</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(217, 119, 6, 0.12)', color: 'var(--amber-accent)' }}>
          <Clock size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--amber-accent)' }}>{metrics?.awaiting ?? '—'}</div>
          <div className="metric-lbl">{text.awaiting}</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(225, 29, 72, 0.12)', color: 'var(--rose-accent)' }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--rose-accent)' }}>{metrics?.pending ?? '—'}</div>
          <div className="metric-lbl">{text.pending}</div>
        </div>
      </div>

      <div className="metric-chip">
        <div className="metric-icon-wrap" style={{ background: 'rgba(20, 102, 83, 0.12)', color: 'var(--primary-accent)' }}>
          <Smartphone size={18} />
        </div>
        <div>
          <div className="metric-val" style={{ color: 'var(--primary-accent)' }}>{metrics?.payments ?? '—'}</div>
          <div className="metric-lbl">{text.loadedPayments}</div>
        </div>
      </div>

      <div className="metric-chip" title={text.stagedHelp}>
        <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald-accent)' }}>
          <Truck size={18} />
        </div>
        <div>
          <div className="metric-val">{metrics?.staged_for_delivery ?? '—'}</div>
          <div className="metric-lbl">{text.staged}</div>
        </div>
      </div>

      <p className="metric-lbl metrics-explanation">{text.stagedHelp}</p>
      <p className="metric-lbl metrics-explanation">{text.metricsHelp}</p>
    </div>
  );
}
