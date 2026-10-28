import { formatOrderAmount } from './orderNumbers';
import React, { useEffect, useId, useRef, useState } from 'react';
import './OrderDetailModal.css';
import { X, Clock, ShieldCheck, Package, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CourierAttemptStatus } from './courierReviewTypes';
import type { SellerOrder } from './types';
import { formatRemainingCod } from './api';
import { BuyerCorrection } from './BuyerCorrection';
import { PaymentException } from './PaymentException';
import { PaymentHistory } from './PaymentHistory';
import { CourierWorkspace } from './CourierWorkspace';
import { OrderOutcomes } from './OrderOutcomes';
import { OrderExport } from './OrderExport';
import { BuyerLinkCopy } from './BuyerLinkCopy';
import { BuyerLinkAccess } from './BuyerLinkAccess';
import { formatBangladeshDateTime } from '../locale/format';
import { orderCopy, lifecycleLabel, reviewLabel, allocationLabel } from '../locale/orderCopy';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { useLocale } from '../locale/context';
import { buyerLinkCopy } from '../locale/buyerLinkCopy';
import { DeveloperDetailsPanel } from './DeveloperDetailsPanel';

interface OrderDetailModalProps {
  order: SellerOrder;
  onClose: () => void;
  token?: string;
  onCorrected?: (order: SellerOrder) => void;
}

export function OrderDetailModal({ order: initialOrder, onClose, token, onCorrected }: OrderDetailModalProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const [order, setOrder] = useState(initialOrder);
  const [courierAttemptStatus, setCourierAttemptStatus] = useState<CourierAttemptStatus | null>(null);
  const [showReviewCodes, setShowReviewCodes] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const tabs = [text.overviewTab, text.paymentTab, text.deliveryTab, text.buyerTab];
  const tabKeys = ['overview', 'payment', 'delivery', 'buyer'];
  const selectTab = (index: number) => {
    setActiveTab(index);
    dialogRef.current?.scrollTo?.({ top: 0 });
  };
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    selectTab(next);
    dialogRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current!;
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const isExpired = order.lifecycle === 'expired';
  const isConfirmed = order.lifecycle === 'confirmed';
  const hasReviewReasons = order.lifecycle === 'pending' && order.review_reasons && order.review_reasons.length > 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="card order-detail-dialog"
    >
      <LocaleSwitch />
      <OrderExport orderId={order.id} token={token} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={20} color="var(--primary-accent)" />
          <h3 id={titleId} style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{text.details}</h3>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label={text.closeDetails}
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="order-detail-context">
        <strong>{order.product_name}</strong>
        <span>{lifecycleLabel(order.lifecycle, text)}</span>
      </div>
      {hasReviewReasons && <button type="button" className="order-detail-alert" onClick={() => selectTab(1)}>{text.reviewPayment}</button>}
      {(courierAttemptStatus === 'failed' || courierAttemptStatus === 'unknown') &&
        <button type="button" className="order-detail-alert" onClick={() => selectTab(2)}>{text.reviewDelivery}</button>}
      <div className="order-detail-tabs" role="tablist" aria-label={text.details}>
        {tabs.map((label, index) => <button key={tabKeys[index]} type="button" role="tab"
          id={`${titleId}-${tabKeys[index]}-tab`} aria-controls={`${titleId}-${tabKeys[index]}-panel`}
          aria-selected={activeTab === index} tabIndex={activeTab === index ? 0 : -1}
          onClick={() => selectTab(index)} onKeyDown={event => onTabKeyDown(event, index)}>{label}</button>)}
      </div>

      <section role="tabpanel" id={`${titleId}-overview-panel`} aria-labelledby={`${titleId}-overview-tab`} hidden={activeTab !== 0}>
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

      </section>
      <section role="tabpanel" id={`${titleId}-payment-panel`} aria-labelledby={`${titleId}-payment-tab`} hidden={activeTab !== 1}>
      {isConfirmed && (
        <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--emerald-accent)', marginBottom: '6px' }}>
            <CheckCircle2 size={14} /> {text.allocation}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '8px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{text.basis}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {allocationLabel(order.allocation_basis, text)}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{text.accepted}</span>
              <span style={{ fontWeight: 600, color: 'var(--cyan-accent)' }}>
                BDT {formatOrderAmount(order.total_minor - (order.actual_cod_minor ?? order.expected_cod_minor))}
              </span>
            </div>
            {order.completed_at && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{text.confirmedAt}</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatBangladeshDateTime(order.completed_at, locale)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {isConfirmed && <p>{text.confirmationHelp}</p>}

      {hasReviewReasons && (
        <div style={{ marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--rose-accent)' }}>
              <AlertTriangle size={14} /> {text.reviewRequired}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setShowReviewCodes((prev) => !prev)}
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              aria-expanded={showReviewCodes}
            >
              {showReviewCodes ? text.hideErrors : text.showErrors}
            </button>
          </div>
          <p>{order.review_reasons.map(reason => reviewLabel(reason, text)).join(" · ")}</p>
          <div style={{ display: showReviewCodes ? 'flex' : 'none', flexWrap: 'wrap', gap: '6px' }}>
            {order.review_reasons.map((reason) => (
              <span
                key={reason}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: 'var(--rose-accent)',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section-card">
        <div className="detail-section-header">
          <div className="detail-section-title">
            <ShieldCheck size={14} /> {text.snapshot}
          </div>
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
          {order.account_label} — {order.account_provider.toUpperCase()} ({order.account_receiving_number})
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {text.immutable}
        </div>
      </div>

      {token && order.allocation_basis === 'manual' && <PaymentHistory orderId={order.id} token={token} />}
      {token && order.lifecycle === 'pending' && <PaymentException key={`payment-${order.id}`} orderId={order.id} token={token}
        onAccepted={fresh => {setOrder(fresh); onCorrected?.(fresh);}} />}
      </section>
      <section role="tabpanel" id={`${titleId}-delivery-panel`} aria-labelledby={`${titleId}-delivery-tab`} hidden={activeTab !== 2}>
      <section className="detail-section-card" aria-label={text.parcel}>
        <h4>{text.parcel}</h4>
        <p>{text.weight}: {order.parcel_weight_grams == null ? text.notProvided : order.parcel_weight_grams / 1000}</p>
        <p>{text.quantity}: {order.parcel_quantity ?? text.notProvided}</p>
      </section>
      {token && (isConfirmed || order.lifecycle === 'cancelled') && order.allocation_basis &&
        <CourierWorkspace key={`courier-${order.id}-${order.version}-${token}`} orderId={order.id} token={token} onAttemptStatusChanged={setCourierAttemptStatus} />}
      </section>
      <section role="tabpanel" id={`${titleId}-buyer-panel`} aria-labelledby={`${titleId}-buyer-tab`} hidden={activeTab !== 3}>
      {token && order.buyer_revision && <BuyerCorrection key={`${order.id}-${order.version}`} orderId={order.id} token={token} courierAttemptStatus={courierAttemptStatus} onCorrected={fresh => {setOrder(fresh); onCorrected?.(fresh);}} />}
      {token && (
        <OrderOutcomes
          key={`outcomes-${order.id}-${order.version}`}
          order={order}
          token={token}
          courierAttemptStatus={courierAttemptStatus}
          onUpdated={(fresh) => {
            setOrder(fresh);
            onCorrected?.(fresh);
          }}
          onReplaced={(newOrder) => {
            setOrder(newOrder);
            onCorrected?.(newOrder);
          }}
        />
      )}
      {token && <BuyerLinkAccess key={`access-${order.id}`} order={order} token={token}
        onUpdated={fresh => { setOrder(fresh); onCorrected?.(fresh); }} />}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <BuyerLinkCopy key={order.portal_url} portalUrl={order.portal_url} detail />
          <a
            href={order.portal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
          >
            <ExternalLink size={14} />
            <span>{buyerLinkCopy[locale].open}</span>
          </a>
        </div>
      </section>
      <div className="order-detail-footer">
        <div className="order-detail-navigation">
          <button type="button" className="btn btn-secondary" disabled={activeTab === 0} onClick={() => selectTab(activeTab - 1)}>{text.backTab}</button>
          <button type="button" className="btn btn-secondary" disabled={activeTab === tabs.length - 1} onClick={() => selectTab(activeTab + 1)}>{text.nextTab}</button>
        </div>
        <button className="btn btn-secondary" onClick={onClose}>
          {text.close}
        </button>
      </div>
    </dialog>
  );
}
