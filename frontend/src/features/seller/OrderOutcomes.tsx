import React, { useState, useEffect, useRef } from 'react';
import { Ban, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import type { PaymentAccount, SellerOrder } from './types';
import { cancelOrder, rejectOrder, replaceOrder } from './paymentDecisions';
import { fetchPaymentAccounts } from './api';

interface OrderOutcomesProps {
  order: SellerOrder;
  token?: string;
  onUpdated: (order: SellerOrder) => void;
  onReplaced?: (newOrder: SellerOrder) => void;
}

export function OrderOutcomes({ order, token = '', onUpdated, onReplaced }: OrderOutcomesProps): React.JSX.Element {
  const [activeAction, setActiveAction] = useState<'none' | 'cancel' | 'reject' | 'replace'>('none');
  const [reason, setReason] = useState('');
  const [productName, setProductName] = useState(order.product_name);
  const [totalBdt, setTotalBdt] = useState(String(order.total_minor / 100));
  const [advanceBdt, setAdvanceBdt] = useState(String(order.required_advance_minor / 100));
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(order.payment_account_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!reason.trim()) {
      setError('Please provide a cancellation reason.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await cancelOrder(
        order.id,
        { action: 'cancel', expected_version: order.version, reason: reason.trim() },
        idempotencyKeyRef.current,
        token
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      setActiveAction('none');
      setReason('');
      onUpdated(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel order';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await rejectOrder(
        order.id,
        { action: 'reject', expected_version: order.version, reason: reason.trim() },
        idempotencyKeyRef.current,
        token
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      setActiveAction('none');
      setReason('');
      onUpdated(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject order';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a replacement reason.');
      return;
    }
    const totalNum = parseInt(totalBdt.trim(), 10) || 0;
    const advanceNum = parseInt(advanceBdt.trim(), 10) || 0;
    if (totalNum <= 0) {
      setError('Total amount must be greater than 0.');
      return;
    }
    if (advanceNum <= 0 || advanceNum > totalNum) {
      setError('Advance must be positive and not exceed total.');
      return;
    }
    if (!selectedAccountId) {
      setError('Please select an active payment account.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const newOrder = await replaceOrder(
        order.id,
        {
          expected_version: order.version,
          reason: reason.trim(),
          order: {
            product_name: productName.trim() || order.product_name,
            total_minor: totalNum * 100,
            required_advance_minor: advanceNum * 100,
            payment_account_id: selectedAccountId,
          },
        },
        idempotencyKeyRef.current,
        token
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      setActiveAction('none');
      setReason('');
      if (onReplaced) {
        onReplaced(newOrder);
      } else {
        onUpdated(newOrder);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to replace order';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '16px', background: 'rgba(10, 14, 23, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>Order Outcomes</span>
        {isReplaced && (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Replaced by <code style={{ color: '#818cf8' }}>{order.replaced_by_order_id?.slice(0, 8)}</code>
          </span>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {activeAction === 'none' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {!isTerminal && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }} onClick={() => { setError(null); setActiveAction('cancel'); }}>
              <Ban size={14} style={{ marginRight: '4px' }} /> Cancel Order
            </button>
          )}

          {order.lifecycle === 'pending' && !isAllocated && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#fb923c' }} onClick={() => { setError(null); setActiveAction('reject'); }}>
              <XCircle size={14} style={{ marginRight: '4px' }} /> Reject Submission
            </button>
          )}

          {!isReplaced && (
            isAllocated ? (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} color="#fbbf24" /> Allocated orders require payment resolution before replacement
              </span>
            ) : (
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#818cf8' }} onClick={() => { setError(null); setActiveAction('replace'); }}>
                <RefreshCw size={14} style={{ marginRight: '4px' }} /> Replace Order
              </button>
            )
          )}
        </div>
      )}

      {activeAction === 'cancel' && (
        <form onSubmit={handleCancel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600 }}>Cancel Order #{order.id.slice(0, 8)}</div>
          {isAllocated && (
            <div style={{ fontSize: '0.75rem', color: '#fcd34d', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
              Confirmed payment allocation is preserved and will not be refunded.
            </div>
          )}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation (required)..." rows={2} style={{ width: '100%', padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting}>Dismiss</button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#dc2626' }} disabled={isSubmitting}>{isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}</button>
          </div>
        </form>
      )}

      {activeAction === 'reject' && (
        <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#fb923c', fontWeight: 600 }}>Reject Order #{order.id.slice(0, 8)}</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection (required)..." rows={2} style={{ width: '100%', padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting}>Dismiss</button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#ea580c' }} disabled={isSubmitting}>{isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}</button>
          </div>
        </form>
      )}

      {activeAction === 'replace' && (
        <form onSubmit={handleReplace} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>Replace Order #{order.id.slice(0, 8)}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Predecessor will be cancelled. A new order with fresh link and terms will be created.
          </div>
          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product Name" style={{ padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input type="number" value={totalBdt} onChange={(e) => setTotalBdt(e.target.value)} placeholder="Total BDT" style={{ padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
            <input type="number" value={advanceBdt} onChange={(e) => setAdvanceBdt(e.target.value)} placeholder="Advance BDT" style={{ padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
          </div>
          {accounts.length > 0 && (
            <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label} ({a.provider.toUpperCase()} - {a.receiving_number})</option>
              ))}
            </select>
          )}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Replacement reason (required)..." rows={2} style={{ width: '100%', padding: '6px 8px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting}>Dismiss</button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px' }} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Replacement'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
