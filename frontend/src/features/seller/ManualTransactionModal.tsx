import { inputStyle, labelStyle } from './manualPaymentStyles';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { orderAmountMinor } from './orderNumbers';
import { useLocale } from '../locale/context';
import { receiptText, receiptError } from '../locale/receiptCopy';
import React, { useState, useRef } from 'react';
import { X, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import type { PaymentAccount, ReceiptView } from './types';
import { recordManualTransaction, SellerApiError } from './api';

interface ManualTransactionModalProps {
  accounts: PaymentAccount[];
  token?: string;
  initialAccountId?: string;
  onClose: () => void;
  onTransactionRecorded: (tx: ReceiptView) => void;
  onError?: (msg: string) => void;
}

export function ManualTransactionModal({
  accounts,
  token,
  initialAccountId,
  onClose,
  onTransactionRecorded,
}: ManualTransactionModalProps): React.JSX.Element {
  const { locale } = useLocale();
  const tr = (value: string) => receiptText(locale, value);
  const activeAccounts = accounts.filter((a) => a.is_active);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccountId || activeAccounts[0]?.id || ''
  );
  const [trxId, setTrxId] = useState<string>('');
  const [amountBdt, setAmountBdt] = useState<string>('');
  const [senderNumber, setSenderNumber] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLocalError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!selectedAccountId) errors.accountId = 'Please select a receiving account';
    if (!trxId.trim()) errors.trxId = 'TrxID is required';
    let amountMinor = 0;
    if (!amountBdt.trim()) {
      errors.amount = 'Actual received amount must be greater than 0';
    } else {
      try {
        amountMinor = orderAmountMinor(amountBdt) ?? 0;
        if (!amountMinor || amountMinor > 100_000_000_000) throw new Error('Invalid amount');
      } catch {
        errors.amount = 'Invalid amount';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      document.getElementById(`manual-${first}`)?.focus();
      return;
    }

    if (!selectedAccount) {
      setLocalError('Selected receiving account is invalid or inactive');
      return;
    }

    if (occurredAt && Number.isNaN(Date.parse(occurredAt))) { setLocalError('Check corrected fields'); return; }
    const occurredAtIso = occurredAt ? new Date(occurredAt).toISOString() : null;

    setSubmitting(true);
    try {
      const receipt = await recordManualTransaction(
        {
          payment_account_id: selectedAccountId,
          provider: selectedAccount.provider,
          trx_id: trxId.trim(),
          amount_minor: amountMinor,
          sender_number: senderNumber.trim() || null,
          occurred_at: occurredAtIso,
        },
        idempotencyKeyRef.current,
        token
      );
      onTransactionRecorded(receipt);
      onClose();
    } catch (err) {
      if (err instanceof SellerApiError && err.fields) {
        const mapped: Record<string, string> = {};
        for (const f of err.fields) {
          if (f.field) mapped[({payment_account_id:'accountId',trx_id:'trxId',amount_minor:'amount'} as Record<string,string>)[f.field] ?? f.field] = 'Check corrected fields';
        }
        setFieldErrors(mapped);
      }
      const msg = receiptError(err, 'Failed to record transaction');
      setLocalError(msg);

    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={tr("Record Received Payment")} lang={locale} className="card"
        style={{
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={20} /> {tr("Record Received Payment")}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            aria-label={tr("Close")}
          >
            <X size={20} />
          </button>
        </div>

        {localError && (
          <div role="alert"
            style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: 'var(--rose-accent)',
              fontSize: '0.85rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{tr(localError)}</span>
          </div>
        )}

        <LocaleSwitch />
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="manual-accountId" style={labelStyle}>{tr("Receiving Account *")}</label>
            <select
              id="manual-accountId" aria-invalid={Boolean(fieldErrors.accountId)} aria-describedby={fieldErrors.accountId ? "manual-accountId-error" : undefined} value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={submitting || activeAccounts.length === 0}
              style={{ ...inputStyle, border: fieldErrors.accountId ? '1px solid var(--rose-accent)' : inputStyle.border }}
            >
              {activeAccounts.length === 0 ? (
                <option value="">{tr("No active receiving accounts available")}</option>
              ) : (
                activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.provider.toUpperCase()} - {a.label} ({a.receiving_number})
                  </option>
                ))
              )}
            </select>
            {fieldErrors.accountId && (
              <span style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                <span id="manual-accountId-error">{tr(fieldErrors.accountId)}</span>
              </span>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="manual-trxId" style={labelStyle}>{tr("Transaction ID (TrxID) *")}</label>
            <input
              type="text"
              placeholder={tr("e.g. 9K72LKQW1")}
              id="manual-trxId" aria-invalid={Boolean(fieldErrors.trxId)} aria-describedby={fieldErrors.trxId ? "manual-trxId-error" : undefined} value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              disabled={submitting}
              style={{
                ...inputStyle,
                border: fieldErrors.trxId ? '1px solid var(--rose-accent)' : inputStyle.border,
                fontFamily: 'monospace',
              }}
            />
            {fieldErrors.trxId && (
              <span style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                <span id="manual-trxId-error">{tr(fieldErrors.trxId)}</span>
              </span>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="manual-amount" style={labelStyle}>{tr("Actual Received Amount (BDT) *")}</label>
            <input
              type="text" inputMode="decimal"
              step="any"
              min="0.01"
              placeholder={tr("e.g. 150")}
              id="manual-amount" aria-invalid={Boolean(fieldErrors.amount)} aria-describedby={fieldErrors.amount ? "manual-amount-error" : undefined} value={amountBdt}
              onChange={(e) => setAmountBdt(e.target.value)}
              disabled={submitting}
              style={{
                ...inputStyle,
                border: fieldErrors.amount ? '1px solid var(--rose-accent)' : inputStyle.border,
              }}
            />
            {fieldErrors.amount && (
              <span style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                <span id="manual-amount-error">{tr(fieldErrors.amount)}</span>
              </span>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="manual-sender" style={labelStyle}>
              {tr("Sender Number ")}<span style={{ color: 'var(--text-muted)' }}>{tr("(Optional - incomplete if omitted)")}</span>
            </label>
            <input
              type="text"
              placeholder={tr("e.g. 01700000000")}
              id="manual-sender" value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              disabled={submitting}
              style={{
                ...inputStyle,
                border: fieldErrors.sender_number ? '1px solid var(--rose-accent)' : inputStyle.border,
              }}
            />
            {fieldErrors.sender_number && (
              <span style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                {tr(fieldErrors.sender_number)}
              </span>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="manual-time" style={labelStyle}>
              {tr("Payment Occurrence Time ")}<span style={{ color: 'var(--text-muted)' }}>{tr("(Optional - incomplete if omitted)")}</span>
            </label>
            <input
              type="datetime-local"
              id="manual-time" value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={submitting}
            >
              {tr("Cancel")}
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || activeAccounts.length === 0}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="spin" /> {tr("Recording...")}
                </>
              ) : (
                tr("Record Payment")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
