import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Clock, Store } from 'lucide-react';
import type { PublicOrder } from './types';
import { formatBDT } from './api';
import { formatBangladeshDateTime, useLocale } from '../locale';

interface BuyerOrderDetailsProps {
  order: PublicOrder;
}

export function BuyerOrderDetails({ order }: BuyerOrderDetailsProps): React.JSX.Element {
  const { locale, t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const actualCod = order.actual_cod_minor;
  const advanceMinor = actualCod !== null ? order.total_minor - actualCod : order.required_advance_minor;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(order.account_receiving_number);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="card" style={{ border: '1px solid var(--border-subtle)' }}>
      {/* Shop & Product Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Store size={20} color="var(--primary-accent)" aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
            {order.shop_display_name}
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--primary-accent)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          {t('buyer.order.badge')}
        </span>
      </div>

      <div className="buyer-order-item" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('buyer.order.item')}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
          {order.product_name}
        </div>
      </div>

      {/* Commercial Terms Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div className="buyer-order-item">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('buyer.order.total')}</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
            {formatBDT(order.total_minor)}
          </div>
        </div>

        <div className="buyer-order-item" style={{ borderLeft: '3px solid var(--primary-accent)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-accent)' }}>
            {actualCod !== null ? t('buyer.order.advanceAccepted') : t('buyer.order.advance')}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-accent)', marginTop: '2px' }}>
            {formatBDT(advanceMinor)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {actualCod !== null ? t('buyer.order.advanceAcceptedHelp') : t('buyer.order.advanceHelp')}
          </div>
        </div>

        <div className="buyer-order-item">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {order.actual_cod_minor !== null ? t('buyer.order.cod') : t('buyer.order.codExpected')}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
            {formatBDT(order.actual_cod_minor ?? order.expected_cod_minor)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {order.actual_cod_minor !== null ? t('buyer.order.codHelp') : t('buyer.order.codExpectedHelp')}
          </div>
        </div>
      </div>

      {/* Receiving Account Box */}
      <div className="buyer-payment-destination" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{t('buyer.order.sendAdvance')}</span>
          </div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--primary-accent)' }}>
            {order.account_provider}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
              {order.account_receiving_number}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              {order.account_label} ({order.account_provider.toUpperCase()})
            </div>
          </div>

          <button
            type="button"
            data-testid="copy-receiving-btn"
            onClick={handleCopy}
            aria-describedby={copyFailed ? 'copy-receiving-error' : undefined}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
          >
            {copied ? (
              <>
                <Check size={16} color="var(--emerald-accent)" aria-hidden="true" />
                <span role="status" style={{ color: 'var(--emerald-accent)' }}>{t('buyer.order.copied')}</span>
              </>
            ) : (
              <>
                <Copy size={16} aria-hidden="true" />
                <span>{t('buyer.order.copy')}</span>
              </>
            )}
          </button>
        </div>
        {copyFailed && (
          <p id="copy-receiving-error" role="alert" style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--rose-accent)' }}>
            {t('buyer.order.copyFailed')}
          </p>
        )}
      </div>

      {/* Expiry time notice */}
      {order.lifecycle === 'awaiting_buyer' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Clock size={14} aria-hidden="true" />
          <span>{t('buyer.order.validUntil')}: {formatBangladeshDateTime(order.expires_at, locale)}</span>
        </div>
      )}
    </div>
  );
}
