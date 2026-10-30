import { OrderOverview } from './OrderOverview';
import { OrderPaymentDetails } from './OrderPaymentDetails';
import React, { useEffect, useId, useRef, useState } from 'react';
import './OrderDetailModal.css';
import { X, Package, ExternalLink } from 'lucide-react';
import type { CourierAttemptStatus } from './courierReviewTypes';
import type { SellerOrder } from './types';
import { BuyerCorrection } from './BuyerCorrection';
import { CourierWorkspace } from './CourierWorkspace';
import { OrderOutcomes } from './OrderOutcomes';
import { OrderExport } from './OrderExport';
import { BuyerLinkCopy } from './BuyerLinkCopy';
import { BuyerLinkAccess } from './BuyerLinkAccess';
import { orderCopy, lifecycleLabel } from '../locale/orderCopy';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { useLocale } from '../locale/context';
import { buyerLinkCopy } from '../locale/buyerLinkCopy';

interface OrderDetailModalProps {
  order: SellerOrder;
  onClose: () => void;
  token?: string;
  initialTab?: number;
  onCheckTransactions?: () => void;
  onCorrected?: (order: SellerOrder) => void;
}

export function OrderDetailModal({ order: initialOrder, onClose, token, onCorrected, initialTab = 0, onCheckTransactions }: OrderDetailModalProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const [order, setOrder] = useState(initialOrder);
  const [courierAttemptStatus, setCourierAttemptStatus] = useState<CourierAttemptStatus | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
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
        <OrderOverview order={order} />
      </section>
      <section role="tabpanel" id={`${titleId}-payment-panel`} aria-labelledby={`${titleId}-payment-tab`} hidden={activeTab !== 1}>
        <OrderPaymentDetails order={order} token={token} onNavigateTab={selectTab}
          onCheckTransactions={() => { onClose(); onCheckTransactions?.(); }}
          onCorrected={fresh => { setOrder(fresh); onCorrected?.(fresh); }} />
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
