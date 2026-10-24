import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { canonicalizeBdPhone, createPaymentAccount } from './api';
import type { PaymentAccount } from './types';

interface AddAccountFormProps {
  token: string;
  onAccountCreated: (account: PaymentAccount) => void;
  onError: (msg: string | null) => void;
}

export function AddAccountForm({
  token,
  onAccountCreated,
  onError,
}: AddAccountFormProps): React.JSX.Element {
  const [provider, setProvider] = useState<'bkash' | 'nagad'>('bkash');
  const [receivingNumber, setReceivingNumber] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      onError('Account label cannot be blank');
      return;
    }
    try {
      canonicalizeBdPhone(receivingNumber);
    } catch (valErr) {
      onError(valErr instanceof Error ? valErr.message : 'Invalid receiving number');
      return;
    }

    setSubmitting(true);
    onError(null);
    try {
      const created = await createPaymentAccount(
        { provider, receiving_number: receivingNumber, label: label.trim() },
        idempotencyKeyRef.current,
        token,
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      onAccountCreated(created);
      setReceivingNumber('');
      setLabel('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add receiving account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
      <h5 style={{ color: 'var(--primary-accent)', marginBottom: '12px', fontSize: '0.88rem' }}>Add Receiving Account</h5>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'bkash' | 'nagad')}
            style={{ padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
          </select>
          <input
            type="text"
            placeholder="Receiving Number (e.g. 01712345678 or ০১৭...)"
            value={receivingNumber}
            onChange={(e) => setReceivingNumber(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Label (e.g. Personal bKash, Shop Nagad)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            <Plus size={14} /> {submitting ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
