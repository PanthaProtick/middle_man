import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState, useRef } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { updatePaymentAccount, SellerApiError } from './api';
import type { PaymentAccount } from './types';

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
  const fail = (key: string) => { setError(key); onError(null); };
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
    pending.current = true; setBusy(true);
    setError(null); onError(null);
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
    } finally { pending.current = false; setBusy(false); }
  };

  const handleToggleActive = async (account: PaymentAccount) => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    setError(null); onError(null);
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
    } finally { pending.current = false; setBusy(false); }
  };

  if (accounts.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
        {c("No receiving accounts configured. Add a bKash or Nagad receiving account below.")}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
      {error && <p role="alert">{c(error)}</p>}
      {accounts.map((acc) => (
        <div
          key={acc.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: acc.provider === 'bkash' ? 'rgba(216, 27, 96, 0.2)' : 'rgba(245, 124, 0, 0.2)',
                color: acc.provider === 'bkash' ? 'var(--rose-accent)' : 'var(--amber-accent)',
              }}
            >
              {acc.provider.toUpperCase()}
            </span>
            <div>
              {editingId === acc.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    aria-label={c("Account label")} disabled={busy} type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button disabled={busy} className="btn btn-primary btn-sm" onClick={() => handleSaveLabel(acc)}>
                    <span className="sr-only">{c("Save label")}</span><Check size={12} />
                  </button>
                  <button disabled={busy} className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                    <span className="sr-only">{c("Cancel editing")}</span><X size={12} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 500, color: 'var(--primary-accent)', fontSize: '0.9rem' }}>{acc.label}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 4px' }}
                    onClick={() => handleStartEdit(acc)}
                    title={c("Edit Label")}
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {acc.receiving_number}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: acc.is_active ? 'var(--emerald-accent)' : 'var(--text-secondary)' }}>
              {acc.is_active ? c("Active") : c("Inactive")}
            </span>
            <button disabled={busy} className="btn btn-secondary btn-sm" onClick={() => handleToggleActive(acc)}>
              {acc.is_active ? c("Deactivate") : c("Activate")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
