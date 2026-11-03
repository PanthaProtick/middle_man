import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState, useRef } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { updatePaymentAccount, SellerApiError } from './api';
import type { PaymentAccount } from './types';
import './PaymentAccounts.css';

interface PaymentAccountListProps {
  accounts: PaymentAccount[];
  token: string;
  onAccountUpdated: (account: PaymentAccount) => void;
  onError: (msg: string | null) => void;
  onReload: () => void;
}

export function PaymentAccountList({
  accounts,
  token,
  onAccountUpdated,
  onError,
  onReload,
}: PaymentAccountListProps): React.JSX.Element {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const c = usePaymentInboxCopy();
  const [error, setError] = useState<string | null>(null);
  const fail = (key: string) => {
    setError(key);
    onError(null);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string>('');

  const handleStartEdit = (account: PaymentAccount) => {
    setEditingId(account.id);
    setEditLabel(account.label);
    onError(null);
  };

  const handleSaveLabel = async (account: PaymentAccount) => {
    if (pending.current) return;
    if (!editLabel.trim()) {
      fail("Account label cannot be blank");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    onError(null);
    try {
      const updated = await updatePaymentAccount(
        account.id,
        { expected_version: account.version, label: editLabel.trim() },
        token,
      );
      onAccountUpdated(updated);
      setEditingId(null);
    } catch (err) {
      if (err instanceof SellerApiError && err.code === 'STALE_VERSION') {
        fail("Account was modified by another session. Refetching latest version...");
        onReload();
      } else {
        fail("Failed to update label");
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const handleToggleActive = async (account: PaymentAccount) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    onError(null);
    try {
      const updated = await updatePaymentAccount(
        account.id,
        { expected_version: account.version, is_active: !account.is_active },
        token,
      );
      onAccountUpdated(updated);
    } catch (err) {
      if (err instanceof SellerApiError && err.code === 'STALE_VERSION') {
        fail("Account was modified in another session. Refetching latest state...");
        onReload();
      } else {
        fail("Failed to update account");
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="payment-accounts-empty">
        <p>{c("No receiving accounts configured. Add a bKash or Nagad receiving account below.")}</p>
      </div>
    );
  }

  return (
    <div className="payment-accounts-list">
      {error && <p role="alert" className="inline-alert inline-alert--error">{c(error)}</p>}
      {accounts.map((acc) => {
        const providerLower = acc.provider.toLowerCase();
        const badgeClass =
          providerLower === 'bkash'
            ? 'payment-provider-badge payment-provider-badge--bkash'
            : providerLower === 'nagad'
              ? 'payment-provider-badge payment-provider-badge--nagad'
              : 'payment-provider-badge payment-provider-badge--rocket';

        return (
          <div
            key={acc.id}
            className={`payment-account-card ${!acc.is_active ? 'payment-account-card--inactive' : ''}`}
          >
            <div className="payment-account-main">
              <span className={badgeClass}>{acc.provider.toUpperCase()}</span>
              <div className="payment-account-details">
                {editingId === acc.id ? (
                  <div className="payment-account-edit-form">
                    <input
                      aria-label={c("Account label")}
                      disabled={busy}
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="payment-account-edit-input"
                    />
                    <button
                      disabled={busy}
                      className="btn btn-primary btn-sm payment-account-icon-btn"
                      onClick={() => handleSaveLabel(acc)}
                      title={c("Save label")}
                    >
                      <span className="sr-only">{c("Save label")}</span>
                      <Check size={14} />
                    </button>
                    <button
                      disabled={busy}
                      className="btn btn-secondary btn-sm payment-account-icon-btn"
                      onClick={() => setEditingId(null)}
                      title={c("Cancel editing")}
                    >
                      <span className="sr-only">{c("Cancel editing")}</span>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="payment-account-label-row">
                    <span className="payment-account-label">{acc.label}</span>
                    <button
                      className="btn btn-secondary btn-sm payment-account-icon-btn"
                      onClick={() => handleStartEdit(acc)}
                      title={c("Edit Label")}
                      aria-label={c("Edit Label")}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                )}
                <div className="payment-account-number">{acc.receiving_number}</div>
              </div>
            </div>

            <div className="payment-account-actions">
              <span
                className={`payment-account-status ${
                  acc.is_active ? 'payment-account-status--active' : 'payment-account-status--inactive'
                }`}
              >
                <span className="payment-account-status-dot" aria-hidden="true" />
                {acc.is_active ? c("Active") : c("Inactive")}
              </span>
              <button
                disabled={busy}
                className="btn btn-secondary btn-sm payment-account-btn"
                onClick={() => handleToggleActive(acc)}
              >
                {acc.is_active ? c("Deactivate") : c("Activate")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
