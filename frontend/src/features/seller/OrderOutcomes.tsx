import './BuyerCorrection.css';
import { OrderOutcomeForms } from './OrderOutcomeForms';
import React, { useState, useEffect, useRef } from 'react';
import { Ban, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import type { CourierAttemptStatus } from './courierReviewTypes';
import type { PaymentAccount, SellerOrder } from './types';
import { cancelOrder, rejectOrder, replaceOrder } from './paymentDecisions';
import type { CancelDecision, RejectDecision, OrderReplacementInput } from './paymentDecisions';
import { fetchPaymentAccounts, parseBdtToMinor, SellerApiError } from './api';
import { useLocale } from '../locale/context';
import { correctionOutcomeCopy } from '../locale/correctionOutcomeCopy';

interface OrderOutcomesProps {
  order: SellerOrder;
  token?: string;
  onUpdated: (order: SellerOrder) => void;
  onReplaced?: (newOrder: SellerOrder) => void;
  courierAttemptStatus?: CourierAttemptStatus | null;
}

export function OrderOutcomes({ order, token = '', onUpdated, onReplaced, courierAttemptStatus }: OrderOutcomesProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = correctionOutcomeCopy[locale];
  const [activeAction, setActiveAction] = useState<'none' | 'cancel' | 'reject' | 'replace'>('none');
  const [reason, setReason] = useState('');
  const [productName, setProductName] = useState(order.product_name);
  const [totalBdt, setTotalBdt] = useState(String(order.total_minor / 100));
  const [advanceBdt, setAdvanceBdt] = useState(String(order.required_advance_minor / 100));
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(order.payment_account_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<keyof typeof text | 'unknown' | null>(null);
  const [pending, setPending] = useState<{ action: 'cancel' | 'reject' | 'replace'; key: string; payload: CancelDecision | RejectDecision | OrderReplacementInput } | null>(null);

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (token) {
      fetchPaymentAccounts(token)
        .then((accs) => {
          const active = accs.filter((a) => a.is_active);
          setAccounts(active);
          if (!active.some((a) => a.id === selectedAccountId) && active.length > 0) {
            setSelectedAccountId(active[0].id);
          }
        })
        .catch(() => {});
    }
  }, [token, selectedAccountId]);

  const isTerminal = ['cancelled', 'rejected', 'expired'].includes(order.lifecycle);
  const isAllocated = order.lifecycle === 'confirmed' || !!order.allocation_basis;
  const isReplaced = !!order.replaced_by_order_id;

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!pending && !reason.trim()) {
      setError('needCancelReason');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const attempt = pending ?? { action: 'cancel' as const, key: idempotencyKeyRef.current, payload: { action: 'cancel' as const, expected_version: order.version, reason: reason.trim() } };
      setPending(attempt);
      const updated = await cancelOrder(
        order.id,
        attempt.payload as CancelDecision,
        attempt.key,
        token
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      setPending(null);
      setActiveAction('none');
      setReason('');
      onUpdated(updated);
    } catch (err: unknown) {
      if (err instanceof SellerApiError && err.status < 500) { setPending(null); idempotencyKeyRef.current = crypto.randomUUID(); }
      setError(err instanceof SellerApiError && err.status < 500 ? err.code === 'STALE_VERSION' ? 'stale' : 'failed' : 'unknown');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!pending && !reason.trim()) {
      setError('needRejectReason');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const attempt = pending ?? { action: 'reject' as const, key: idempotencyKeyRef.current, payload: { action: 'reject' as const, expected_version: order.version, reason: reason.trim() } };
      setPending(attempt);
      const updated = await rejectOrder(
        order.id,
        attempt.payload as RejectDecision,
        attempt.key,
        token
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      setPending(null);
      setActiveAction('none');
      setReason('');
      onUpdated(updated);
    } catch (err: unknown) {
      if (err instanceof SellerApiError && err.status < 500) { setPending(null); idempotencyKeyRef.current = crypto.randomUUID(); }
      setError(err instanceof SellerApiError && err.status < 500 ? err.code === 'STALE_VERSION' ? 'stale' : 'failed' : 'unknown');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!pending && !reason.trim()) {
      setError('needReplaceReason');
      return;
    }
    let totalNum = 0;
    let advanceNum = 0;
    if (!pending) {
      try { totalNum = parseBdtToMinor(totalBdt); }
      catch { setError('invalidTotal'); return; }
      try { advanceNum = parseBdtToMinor(advanceBdt); }
      catch { setError('invalidAdvance'); return; }
      if (advanceNum > totalNum) { setError('invalidAdvance'); return; }
      if (!selectedAccountId) { setError('needAccount'); return; }
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const attempt = pending ?? { action: 'replace' as const, key: idempotencyKeyRef.current, payload: {
        expected_version: order.version, reason: reason.trim(), order: {
          product_name: productName.trim() || order.product_name, total_minor: totalNum,
          required_advance_minor: advanceNum, payment_account_id: selectedAccountId,
        },
      } };
      setPending(attempt);
      const newOrder = await replaceOrder(
        order.id,
        attempt.payload as OrderReplacementInput,
        attempt.key,
        token
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      setPending(null);
      setActiveAction('none');
      setReason('');
      if (onReplaced) {
        onReplaced(newOrder);
      } else {
        onUpdated(newOrder);
      }
    } catch (err: unknown) {
      if (err instanceof SellerApiError && err.status < 500) { setPending(null); idempotencyKeyRef.current = crypto.randomUUID(); }
      setError(err instanceof SellerApiError && err.status < 500 ? err.code === 'STALE_VERSION' ? 'stale' : 'failed' : 'unknown');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="order-outcomes" lang={locale === 'bn' ? 'bn-BD' : 'en'} style={{ marginTop: '16px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{text.outcomes}</span>
        {isReplaced && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {text.replacedBy} <code style={{ color: 'var(--primary-accent)' }}>{order.replaced_by_order_id}</code>
          </span>
        )}
      </div>

      {error && (
        <div id="order-outcome-error" role="alert" style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--rose-accent)', borderRadius: '6px', color: 'var(--rose-accent)', fontSize: '0.8rem' }}>
          {error === 'unknown' ? text.unknownError : text[error]}
        </div>
      )}

      {activeAction === 'none' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {!isTerminal && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', color: 'var(--rose-accent)' }} onClick={() => { setError(null); setActiveAction('cancel'); }}>
                <Ban size={14} style={{ marginRight: '4px' }} /> {text.cancel}
              </button>
            )}

            {order.lifecycle === 'pending' && !isAllocated && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', color: 'var(--amber-accent)' }} onClick={() => { setError(null); setActiveAction('reject'); }}>
                <XCircle size={14} style={{ marginRight: '4px' }} /> {text.reject}
              </button>
            )}

            {!isReplaced && !isAllocated && ['awaiting_buyer', 'pending', 'expired'].includes(order.lifecycle) && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', color: 'var(--primary-accent)' }} onClick={() => { setError(null); setActiveAction('replace'); }}>
                <RefreshCw size={14} style={{ marginRight: '4px' }} /> {text.replace}
              </button>
            )}
          </div>

          {!isReplaced && isAllocated && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} color="var(--amber-accent)" /> {text.allocated}
            </div>
          )}
        </div>
      )}

      <OrderOutcomeForms
        activeAction={activeAction} order={order} isAllocated={isAllocated} courierAttemptStatus={courierAttemptStatus}
        reason={reason} setReason={setReason} productName={productName} setProductName={setProductName}
        totalBdt={totalBdt} setTotalBdt={setTotalBdt} advanceBdt={advanceBdt} setAdvanceBdt={setAdvanceBdt}
        accounts={accounts} selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
        isSubmitting={isSubmitting} pending={!!pending} error={error} text={text} setError={setError} setActiveAction={setActiveAction}
        handleCancel={handleCancel} handleReject={handleReject} handleReplace={handleReplace}
      />
    </div>
  );
}
