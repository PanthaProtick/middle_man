import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
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
  const c = usePaymentInboxCopy();
  const [error, setError] = useState<string | null>(null);
  const fail = (key: string) => { setError(key); onError(null); };
  const [provider, setProvider] = useState<'bkash' | 'nagad'>('bkash');
  const [receivingNumber, setReceivingNumber] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!label.trim()) {
      fail("Account label cannot be blank");
      document.getElementById("account-label")?.focus();
      return;
    }
    try {
      canonicalizeBdPhone(receivingNumber);
    } catch {
      fail("Invalid receiving number");
      document.getElementById("account-number")?.focus();
      return;
    }

    setSubmitting(true);
    setError(null); onError(null);
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
    } catch {
      fail("Failed to add receiving account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="isolated-subcard">
      {error && <p id="account-create-error" role="alert">{c(error)}</p>}
      <div className="isolated-subcard-header">
        <h5 className="isolated-subcard-title">
          <Plus size={15} color="var(--primary-accent)" />
          <span>{c("Add Receiving Account")}</span>
        </h5>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '520px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select
            aria-label={c("Payment provider")}
            disabled={submitting}
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'bkash' | 'nagad')}
            style={{ width: '120px', flexShrink: 0, padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
          </select>
          <input
            type="text"
            id="account-number" aria-invalid={error === "Invalid receiving number"} aria-label={c("Receiving number")}
            placeholder={c("Receiving Number (e.g. 01712345678 or ০১৭...)")}
            aria-describedby={error ? "account-create-error" : undefined}
            disabled={submitting}
            value={receivingNumber}
            onChange={(e) => setReceivingNumber(e.target.value)}
            style={{ flex: 1, flexGrow: 1, minWidth: '160px', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            id="account-label" aria-invalid={error === "Account label cannot be blank"} aria-describedby={error ? "account-create-error" : undefined} aria-label={c("Account label")}
            placeholder={c("Label (e.g. Personal bKash, Shop Nagad)")}
            disabled={submitting}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ flex: 1, minWidth: '160px', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            <Plus size={14} /> {submitting ? c("Adding...") : c("Add Account")}
          </button>
        </div>
      </form>
    </div>
  );
}
