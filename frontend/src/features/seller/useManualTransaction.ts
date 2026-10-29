import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { orderAmountMinor } from './orderNumbers';
import { receiptError } from '../locale/receiptCopy';
import { recordManualTransaction, SellerApiError } from './api';
import type { PaymentAccount, ReceiptView } from './types';

interface ManualTransactionOptions {
  accounts: PaymentAccount[];
  token?: string;
  initialAccountId?: string;
  onClose: () => void;
  onTransactionRecorded: (tx: ReceiptView) => void;
}

export function useManualTransaction({
  accounts, token, initialAccountId, onClose, onTransactionRecorded,
}: ManualTransactionOptions) {
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

  const handleSubmit = async (e: FormEvent) => {
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

  return {
    activeAccounts, selectedAccountId, setSelectedAccountId,
    trxId, setTrxId, amountBdt, setAmountBdt,
    senderNumber, setSenderNumber, occurredAt, setOccurredAt,
    submitting, localError, fieldErrors, handleSubmit,
  };
}
