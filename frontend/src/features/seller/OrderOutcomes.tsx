import './BuyerCorrection.css';
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
    try { totalNum = parseBdtToMinor(totalBdt); }
    catch { setError('invalidTotal'); return; }
    try { advanceNum = parseBdtToMinor(advanceBdt); }
    catch { setError('invalidAdvance'); return; }
    if (totalNum <= 0) {
      setError('invalidTotal');
      return;
    }
    if (advanceNum <= 0 || advanceNum > totalNum) {
      setError('invalidAdvance');
      return;
    }
    if (!selectedAccountId) {
      setError('needAccount');
      return;
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
        <div role="alert" style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--rose-accent)', borderRadius: '6px', color: 'var(--rose-accent)', fontSize: '0.8rem' }}>
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

            {!isReplaced && !isAllocated && (
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

      {activeAction === 'cancel' && (
        <form onSubmit={handleCancel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--rose-accent)', fontWeight: 600 }}>{text.cancelTitle} #{order.id}</div>
          {isAllocated && (
            <div style={{ fontSize: '0.75rem', color: 'var(--amber-accent)', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
              {text.allocationWarning}
            </div>
          )}
          {['submitting', 'unknown', 'success'].includes(courierAttemptStatus ?? '') && (
            <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--rose-accent)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 8px', borderRadius: '4px' }}>
              {text.courierWarning}
            </div>
          )}
          {isAllocated && courierAttemptStatus == null && <p role="alert">
            {text.courierUnavailable}
          </p>}
          {courierAttemptStatus === 'unsubmitted' && (
            <div role="note" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '6px 8px', borderRadius: '4px' }}>
              {text.draftWarning}
            </div>
          )}
          <label>{text.cancelReason}<textarea required disabled={!!pending} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }} /></label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting || !!pending}>{text.dismiss}</button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#dc2626' }} disabled={isSubmitting}>{isSubmitting ? text.cancelling : pending ? text.retry : text.confirmCancel}</button>
          </div>
        </form>
      )}

      {activeAction === 'reject' && (
        <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--amber-accent)', fontWeight: 600 }}>{text.rejectTitle} #{order.id}</div>
          <label>{text.rejectReason}<textarea required disabled={!!pending} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }} /></label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting || !!pending}>{text.dismiss}</button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#ea580c' }} disabled={isSubmitting}>{isSubmitting ? text.rejecting : pending ? text.retry : text.confirmReject}</button>
          </div>
        </form>
      )}

      {activeAction === 'replace' && (
        <form onSubmit={handleReplace} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--primary-accent)', fontWeight: 600 }}>{text.replaceTitle} #{order.id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {text.predecessor}
          </div>
          {['submitting', 'unknown', 'success'].includes(courierAttemptStatus ?? '') && (
            <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--rose-accent)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 8px', borderRadius: '4px' }}>
              {text.courierWarning}
            </div>
          )}
          <label>{text.product}<input type="text" disabled={!!pending} value={productName} onChange={(e) => setProductName(e.target.value)} style={{ padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }} /></label>
          <div className="order-outcomes-amounts" style={{ display: 'grid', gap: '8px' }}>
            <label>{text.total}<input type="text" inputMode="decimal" disabled={!!pending} value={totalBdt} onChange={(e) => setTotalBdt(e.target.value)} style={{ padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }} /></label>
            <label>{text.requiredAdvance}<input type="text" inputMode="decimal" disabled={!!pending} value={advanceBdt} onChange={(e) => setAdvanceBdt(e.target.value)} style={{ padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }} /></label>
          </div>
          {accounts.length > 0 && (
            <select aria-label={text.account} disabled={!!pending} value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label} ({a.provider.toUpperCase()} - {a.receiving_number})</option>
              ))}
            </select>
          )}
          <label>{text.replaceReason}<textarea required disabled={!!pending} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }} /></label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting || !!pending}>{text.dismiss}</button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px' }} disabled={isSubmitting}>{isSubmitting ? text.creating : pending ? text.retry : text.createReplacement}</button>
          </div>
        </form>
      )}
    </div>
  );
}
