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
  margin: '0 auto 14px auto',
} as const;

const bodyStyle = {
  margin: '6px 0 0 0',
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
} as const;

export function BuyerStatusView({ order, onRefresh, isRefreshing }: BuyerStatusViewProps): React.JSX.Element {
  const { t } = useLocale();
  const isPending = order.lifecycle === 'pending';
  const isConfirmed = order.lifecycle === 'confirmed';
  const isExpired = order.lifecycle === 'expired';
  const isRejected = order.lifecycle === 'rejected';
  const isCancelled = order.lifecycle === 'cancelled';

  return (
    <div className="card" style={{ border: '1px solid var(--border-subtle)', textAlign: 'center', padding: '28px 20px' }}>
      {/* Icon & Status Heading */}
      {isPending && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ ...circleStyle, background: 'rgba(138, 87, 11, 0.12)', border: '1px solid rgba(138, 87, 11, 0.28)' }}>
            <Clock size={28} color="var(--amber-accent)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--amber-accent)', fontFamily: 'var(--font-heading)' }}>
            {t('buyer.status.pending.title')}
          </h3>
          <p style={bodyStyle}>{t('buyer.status.pending.body')}</p>
        </div>
      )}

      {isConfirmed && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ ...circleStyle, background: 'rgba(25, 112, 71, 0.12)', border: '1px solid rgba(25, 112, 71, 0.28)' }}>
            <CheckCircle2 size={28} color="var(--emerald-accent)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--emerald-accent)', fontFamily: 'var(--font-heading)' }}>
            {t('buyer.status.confirmed.title')}
          </h3>
          <p style={bodyStyle}>{t('buyer.status.confirmed.body')}</p>
        </div>
      )}

      {isExpired && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ ...circleStyle, background: 'rgba(179, 52, 72, 0.12)', border: '1px solid rgba(179, 52, 72, 0.28)' }}>
            <AlertTriangle size={28} color="var(--rose-accent)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--rose-accent)', fontFamily: 'var(--font-heading)' }}>
            {t('buyer.status.expired.title')}
          </h3>
          <p style={bodyStyle}>{t('buyer.status.expired.body')}</p>
        </div>
      )}

      {(isRejected || isCancelled) && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ ...circleStyle, background: 'rgba(78, 101, 92, 0.12)', border: '1px solid rgba(78, 101, 92, 0.25)' }}>
            <XCircle size={28} color="var(--text-secondary)" aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
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
            background: '#eaf4ee',
            border: '1px solid #b8d5c5',
            fontSize: '0.825rem',
            color: 'var(--primary-accent)',
            marginBottom: '20px',
          }}
        >
          {t('buyer.status.reference')}:{' '}
          <span className="buyer-mono-num" style={{ fontWeight: 700 }}>
            {order.submission_acknowledgement}
          </span>
        </div>
      )}

      {/* COD Summary Box */}
      <div
        style={{
          padding: '16px',
          borderRadius: '10px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          textAlign: 'left',
        }}
      >
        {isConfirmed && order.actual_cod_minor !== null && (
          <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('buyer.status.acceptedAdvance')}:{' '}
            <span className="buyer-tabular" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatBDT(order.total_minor - order.actual_cod_minor)}
            </span>
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{t('buyer.status.product')}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere', textAlign: 'right' }}>
            {order.product_name}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{t('buyer.status.total')}</span>
          <span className="buyer-tabular" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatBDT(order.total_minor)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--border-subtle)',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: isConfirmed ? 'var(--emerald-accent)' : 'var(--text-primary)',
          }}
        >
          <span>{t(isConfirmed ? 'buyer.status.remainingCod' : 'buyer.status.expectedCod')}</span>
          <span className="buyer-tabular">{formatBDT(order.actual_cod_minor ?? order.expected_cod_minor)}</span>
        </div>
      </div>

      {/* Manual & Auto Polling Status */}
      {isPending && (
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', minHeight: '44px', padding: '8px 18px' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} aria-hidden="true" />
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
