import React, { useState, useRef } from 'react';
import { X, ShoppingBag, AlertCircle, ArrowRight } from 'lucide-react';
import type { PaymentAccount, SellerOrder } from './types';
import { createOrder } from './api';

interface CreateOrderModalProps {
  accounts: PaymentAccount[];
  token?: string;
  onClose: () => void;
  onOrderCreated: (order: SellerOrder) => void;
  onError: (msg: string) => void;
}

export function CreateOrderModal({
  accounts,
  token,
  onClose,
  onOrderCreated,
  onError,
}: CreateOrderModalProps): React.JSX.Element {
  const activeAccounts = accounts.filter((a) => a.is_active);

  const [productName, setProductName] = useState('');
  const [totalBdt, setTotalBdt] = useState('');
  const [advanceBdt, setAdvanceBdt] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(
    activeAccounts.length > 0 ? activeAccounts[0].id : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const totalNum = parseInt(totalBdt.trim(), 10) || 0;
  const advanceNum = parseInt(advanceBdt.trim(), 10) || 0;
  const expectedCod = totalNum > 0 && advanceNum >= 0 ? Math.max(0, totalNum - advanceNum) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedProduct = productName.trim();
    if (!trimmedProduct) {
      setValidationError('Product name is required');
      return;
    }
    if (totalNum <= 0) {
      setValidationError('Order total must be greater than BDT 0');
      return;
    }
    if (advanceNum <= 0) {
      setValidationError('Required delivery advance must be greater than BDT 0');
      return;
    }
    if (advanceNum > totalNum) {
      setValidationError('Required delivery advance cannot exceed order total');
      return;
    }
    if (!selectedAccountId) {
      setValidationError('Please select an active receiving payment account');
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder(
        {
          product_name: trimmedProduct,
          total_minor: totalNum * 100,
          required_advance_minor: advanceNum * 100,
          payment_account_id: selectedAccountId,
        },
        idempotencyKeyRef.current,
        token,
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      onOrderCreated(order);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create order';
      setValidationError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#0d131f',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="#6366f1" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>Create Order & Buyer Link</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {validationError && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{validationError}</span>
          </div>
        )}

        {activeAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <AlertCircle size={32} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
            <p style={{ color: '#cbd5e1', marginBottom: '16px' }}>
              No active payment accounts available. Please add or activate a bKash or Nagad receiving account first.
            </p>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Product Name / Agreed Items
              </label>
              <input
                type="text"
                name="productName"
                placeholder="e.g. Leather Laptop Bag (Black)"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Total Agreed Price (BDT)
                </label>
                <input
                  type="number"
                  name="totalBdt"
                  placeholder="e.g. 2500"
                  min="1"
                  step="1"
                  value={totalBdt}
                  onChange={(e) => setTotalBdt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Required Advance (BDT)
                </label>
                <input
                  type="number"
                  name="advanceBdt"
                  placeholder="e.g. 300"
                  min="1"
                  step="1"
                  value={advanceBdt}
                  onChange={(e) => setAdvanceBdt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                />
              </div>
            </div>

            <div
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Expected Remaining COD:</span>
              <span style={{ fontWeight: 600, color: '#a5b4fc', fontSize: '1rem' }}>
                BDT {expectedCod.toLocaleString()}
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Receiving Payment Account (Fixed Snapshot)
              </label>
              <select
                name="paymentAccountId"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} — {acc.provider.toUpperCase()} ({acc.receiving_number})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                This account destination will be permanently snapshotted to the buyer link.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating Link...' : 'Generate Buyer Link'} <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
