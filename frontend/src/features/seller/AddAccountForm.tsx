import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { canonicalizeBdPhone, createPaymentAccount } from './api';
import type { PaymentAccount } from './types';
import './PaymentAccounts.css';

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
  const fail = (key: string) => {
    setError(key);
    onError(null);
  };
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
    setError(null);
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
    } catch {
      fail("Failed to add receiving account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="isolated-subcard">
      {error && (
        <p id="account-create-error" role="alert" className="inline-alert inline-alert--error">
          {c(error)}
        </p>
      )}
      <div className="isolated-subcard-header">
        <h5 className="isolated-subcard-title">
          <Plus size={16} color="var(--primary-accent)" aria-hidden="true" />
          <span>{c("Add Receiving Account")}</span>
        </h5>
      </div>
      <form onSubmit={handleSubmit} className="add-account-form">
        <div className="add-account-row">
          <select
            aria-label={c("Payment provider")}
            disabled={submitting}
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'bkash' | 'nagad')}
            className="add-account-select"
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
          </select>
          <input
            type="tel"
            id="account-number"
            aria-invalid={error === "Invalid receiving number"}
            aria-label={c("Receiving number")}
            placeholder={c("Receiving Number (e.g. 01712345678 or ০১৭...)")}
            aria-describedby={error ? "account-create-error" : undefined}
            disabled={submitting}
            value={receivingNumber}
            onChange={(e) => setReceivingNumber(e.target.value)}
            className="add-account-input"
            autoComplete="tel"
          />
        </div>
        <div className="add-account-row">
          <input
            type="text"
            id="account-label"
            aria-invalid={error === "Account label cannot be blank"}
            aria-describedby={error ? "account-create-error" : undefined}
            aria-label={c("Account label")}
            placeholder={c("Label (e.g. Personal bKash, Shop Nagad)")}
            disabled={submitting}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="add-account-input"
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm add-account-submit-btn"
            disabled={submitting}
          >
            <Plus size={15} aria-hidden="true" />
            <span>{submitting ? c("Adding...") : c("Add Account")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
