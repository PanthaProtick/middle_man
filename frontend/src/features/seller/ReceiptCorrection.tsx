import { formatBangladeshDateTime, formatBdt } from '../locale/format';
import { orderAmountMinor } from './orderNumbers';
import { useLocale } from '../locale/context';
import { receiptText, receiptError } from '../locale/receiptCopy';
import { useId, useRef, useState } from 'react';
import { canonicalizeBdPhone, SellerApiError } from './api';
import { correctReceipt } from './resolution';
import type { ReceiptComparison, ReceiptCorrectionInput } from './resolution';
import type { PaymentAccount, ReceiptView } from './types';

interface Props {
  receipt: ReceiptView; accounts: PaymentAccount[]; token: string; disabled: boolean;
  onPending: (pending: boolean) => void;
  onCorrected: (result: ReceiptComparison) => void;
  onStale: () => Promise<void>;
}

export function ReceiptCorrection({receipt, accounts, token, disabled, onPending, onCorrected, onStale}: Props) {
  const { locale } = useLocale();
  const errorId = useId();
  const tr = (value: string) => receiptText(locale, value);
  const [account, setAccount] = useState(receipt.payment_account_id);
  const [trxId, setTrxId] = useState(receipt.trx_id);
  const [amount, setAmount] = useState((receipt.amount_minor / 100).toFixed(2));
  const [sender, setSender] = useState(receipt.sender_number_raw ?? '');
  const [time, setTime] = useState(receipt.occurred_at ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState<{input: ReceiptCorrectionInput; key: string} | null>(null);
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current || disabled || blocked) return;
    let mutation = pending;
    if (!mutation) {
      try {
        const amountMinor = orderAmountMinor(amount) ?? 0;
        if (amountMinor <= 0 || !Number.isSafeInteger(amountMinor) || amountMinor > 100_000_000_000) throw new Error('Enter a valid receipt amount up to BDT 1,000,000,000.');
        if (!trxId.trim() || !reason.trim()) throw new Error('TrxID and correction reason are required.');
        if (sender.trim()) {
          try { canonicalizeBdPhone(sender); } catch { throw new Error('Invalid Bangladeshi phone number'); }
        }
        if (time && (!/(Z|[+-]\d{2}:\d{2})$/i.test(time) || Number.isNaN(Date.parse(time)))) throw new Error('Use a valid ISO time with Z or a timezone offset, or leave it unknown.');
        mutation = {key: crypto.randomUUID(), input: {
          expected_version: receipt.version, reason: reason.trim(), payment_account_id: account,
          provider: accounts.find(a => a.id === account)?.provider ?? receipt.provider,
          trx_id: trxId.trim(), amount_minor: amountMinor, sender_number: sender.trim() || null, occurred_at: time || null,
        }};
      } catch (err) { setError(err instanceof Error ? err.message : 'Check corrected fields'); return; }
    }
    submitting.current = true;
    setPending(mutation); onPending(true); setBusy(true); setError('');
    try {
      const result = await correctReceipt(receipt.id, mutation.input, mutation.key, token);
      setPending(null); onPending(false); onCorrected(result);
    } catch (err) {
      setError(receiptError(err, 'Outcome unknown; retry the same correction'));
      if (err instanceof SellerApiError && err.status >= 400 && err.status < 500) {
        setPending(null); onPending(false);
        if (['STALE_VERSION', 'PAYMENT_USED'].includes(err.code)) {
          setBlocked(true);
          await onStale();
        }
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section lang={locale} aria-label={tr("Receipt correction")}>
    <h5>{tr("Correct unallocated receipt")}</h5>
    <p>{tr("Before")}: {receipt.provider} / {receipt.trx_id}; {formatBdt(receipt.amount_minor)};
      {' '}{receipt.sender_number_canonical ?? tr("Unknown sender")}; {receipt.occurred_at ? formatBangladeshDateTime(receipt.occurred_at, locale) : tr("Unknown time")}; {tr("Account")} {receipt.payment_account_id}.</p>
    <form aria-label={tr("Correct receipt")} aria-describedby={error ? errorId : undefined} onSubmit={e => { e.preventDefault(); void submit(); }}>
      <fieldset disabled={disabled || busy || Boolean(pending) || blocked}>
        <label>{tr("Receiving account")}<select aria-label={tr("Correction account")} value={account} onChange={e => setAccount(e.target.value)}>
          {!accounts.some(a => a.id === account) && <option value={account}>{account} ({receipt.provider})</option>}
          {accounts.map(a => <option key={a.id} value={a.id}>{a.label} ({a.provider})</option>)}
        </select></label>
        <label>TrxID<input aria-label={tr("Correction TrxID")} required maxLength={128} value={trxId} onChange={e => setTrxId(e.target.value)} /></label>
        <label>{tr("Received amount (BDT)")}<input aria-label={tr("Correction amount")} required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label>{tr("Payment sender (blank if unknown)")}<input aria-label={tr("Correction sender")} maxLength={32} value={sender} onChange={e => setSender(e.target.value)} /></label>
        <label>{tr("Receipt time (ISO with timezone, blank if unknown)")}<input aria-label={tr("Correction time")} placeholder="2026-10-24T12:00:00+06:00" value={time} onChange={e => setTime(e.target.value)} /></label>
        <label>{tr("Correction reason — required")}<textarea aria-label={tr("Correction reason")} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      {error && <p id={errorId} role="alert">{tr(error)}</p>}
      <button className="btn btn-secondary btn-sm" type="submit" disabled={disabled || busy || blocked || (!pending && !reason.trim())}>
        {busy ? tr("Saving correction…") : pending ? tr("Retry same correction") : tr("Save correction and check claims")}
      </button>
    </form>
  </section>;
}
