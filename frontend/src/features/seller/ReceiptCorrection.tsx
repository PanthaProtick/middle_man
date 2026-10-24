import { useRef, useState } from 'react';
import { canonicalizeBdPhone, parseBdtToMinor, SellerApiError } from './api';
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
        const amountMinor = parseBdtToMinor(amount);
        if (!Number.isSafeInteger(amountMinor) || amountMinor > 100_000_000_000) throw new Error('Enter a valid receipt amount up to BDT 1,000,000,000.');
        if (!trxId.trim() || !reason.trim()) throw new Error('TrxID and correction reason are required.');
        if (sender.trim()) canonicalizeBdPhone(sender);
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
      setError(err instanceof Error ? err.message : 'Outcome unknown; retry the same correction');
      if (err instanceof SellerApiError && err.status >= 400 && err.status < 500) {
        setPending(null); onPending(false);
        if (['STALE_VERSION', 'PAYMENT_USED'].includes(err.code)) {
          setBlocked(true);
          await onStale();
        }
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section aria-label="Receipt correction">
    <h5>Correct unallocated receipt</h5>
    <p>Before: {receipt.provider} / {receipt.trx_id}; BDT {(receipt.amount_minor / 100).toFixed(2)};
      {' '}{receipt.sender_number_canonical ?? 'Unknown sender'}; {receipt.occurred_at ?? 'Unknown time'}; account {receipt.payment_account_id}.</p>
    <form aria-label="Correct receipt" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <fieldset disabled={disabled || busy || Boolean(pending) || blocked}>
        <label>Receiving account<select aria-label="Correction account" value={account} onChange={e => setAccount(e.target.value)}>
          {!accounts.some(a => a.id === account) && <option value={account}>{account} ({receipt.provider})</option>}
          {accounts.map(a => <option key={a.id} value={a.id}>{a.label} ({a.provider})</option>)}
        </select></label>
        <label>TrxID<input aria-label="Correction TrxID" required maxLength={128} value={trxId} onChange={e => setTrxId(e.target.value)} /></label>
        <label>Received amount (BDT)<input aria-label="Correction amount" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label>Payment sender (blank if unknown)<input aria-label="Correction sender" maxLength={32} value={sender} onChange={e => setSender(e.target.value)} /></label>
        <label>Receipt time (ISO with timezone, blank if unknown)<input aria-label="Correction time" placeholder="2026-10-24T12:00:00+06:00" value={time} onChange={e => setTime(e.target.value)} /></label>
        <label>Correction reason — required<textarea aria-label="Correction reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-secondary btn-sm" type="submit" disabled={disabled || busy || blocked || (!pending && !reason.trim())}>
        {busy ? 'Saving correction…' : pending ? 'Retry same correction' : 'Save correction and check claims'}
      </button>
    </form>
  </section>;
}
