import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import type { PublicOrder } from './types';
import { formatBDT } from './api';
import { useLocale } from '../locale';

interface BuyerStatusViewProps {
  order: PublicOrder;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

const circleStyle = {
  width: '56px',
  height: '56px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 12px auto',
} as const;

const bodyStyle = {
  margin: '6px 0 0 0',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
} as const;

export function BuyerStatusView({ order, onRefresh, isRefreshing }: BuyerStatusViewProps): React.JSX.Element {
  const { t } = useLocale();
  const isPending = order.lifecycle === 'pending';
  const isConfirmed = order.lifecycle === 'confirmed';
  const isExpired = order.lifecycle === 'expired';
  const isRejected = order.lifecycle === 'rejected';
  const isCancelled = order.lifecycle === 'cancelled';

  return (
    <div className="card" style={{ border: '1px solid var(--border-subtle)', textAlign: 'center', padding: '24px 16px' }}>
      {/* Icon & Status Heading */}
      {isPending && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...circleStyle, background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
            <Clock size={28} color="var(--amber-accent)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--amber-accent)' }}>
            {t('buyer.status.pending.title')}
          </h3>
          <p style={bodyStyle}>{t('buyer.status.pending.body')}</p>
        </div>
      )}

      {isConfirmed && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...circleStyle, background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <CheckCircle2 size={28} color="var(--emerald-accent)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--emerald-accent)' }}>
            {t('buyer.status.confirmed.title')}
          </h3>
          <p style={bodyStyle}>{t('buyer.status.confirmed.body')}</p>
        </div>
      )}

      {isExpired && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...circleStyle, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertTriangle size={28} color="var(--rose-accent)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--rose-accent)' }}>
            {t('buyer.status.expired.title')}
          </h3>
          <p style={bodyStyle}>{t('buyer.status.expired.body')}</p>
        </div>
      )}

      {(isRejected || isCancelled) && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...circleStyle, background: 'rgba(148, 163, 184, 0.15)', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            <XCircle size={28} color="var(--text-secondary)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            {t(isRejected ? 'buyer.status.rejected.title' : 'buyer.status.cancelled.title')}
          </h3>
          <p style={bodyStyle}>
            {t(isRejected ? 'buyer.status.rejected.body' : 'buyer.status.cancelled.body')}
          </p>
        </div>
      )}

      {/* Acknowledgement Reference */}
      {order.submission_acknowledgement && (
        <div
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--primary-accent)',
            marginBottom: '18px',
          }}
        >
          {t('buyer.status.reference')}: <span style={{ fontWeight: 600 }}>{order.submission_acknowledgement}</span>
        </div>
      )}

      {/* COD Summary Box */}
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          textAlign: 'left',
        }}
      >
        {isConfirmed && order.actual_cod_minor !== null && (
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('buyer.status.acceptedAdvance')}:{' '}
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              {formatBDT(order.total_minor - order.actual_cod_minor)}
            </span>
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{t('buyer.status.product')}</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)', overflowWrap: 'anywhere', textAlign: 'right' }}>
            {order.product_name}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{t('buyer.status.total')}</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatBDT(order.total_minor)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            paddingTop: '8px',
            borderTop: '1px dashed var(--border-subtle)',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: isConfirmed ? 'var(--emerald-accent)' : 'var(--text-primary)',
          }}
        >
          <span>{t(isConfirmed ? 'buyer.status.remainingCod' : 'buyer.status.expectedCod')}</span>
          <span>{formatBDT(order.actual_cod_minor ?? order.expected_cod_minor)}</span>
        </div>
      </div>

      {/* Manual & Auto Polling Status */}
      {isPending && (
        <div style={{ marginTop: '14px' }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} aria-hidden="true" />
            <span>{t(isRefreshing ? 'buyer.status.checking' : 'buyer.status.refresh')}</span>
          </button>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            {t('buyer.status.pollingHelp')}
          </div>
        </div>
      )}
    </div>
  );
}
