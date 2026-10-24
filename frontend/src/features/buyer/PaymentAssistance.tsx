import { useEffect, useRef, useState } from 'react';
import type { BuyerFormDraft } from './types';
import { parsePaymentSuggestions, reviewedPaymentPatch, type PaymentSuggestions } from './paymentSuggestions';
interface Props {
  portalToken: string;
  draft: BuyerFormDraft;
  onUse: (patch: Partial<BuyerFormDraft>) => void;
  disabled: boolean;
}
export function PaymentAssistance({ portalToken, draft, onUse, disabled }: Props) {
  const source = JSON.stringify([portalToken, draft.evidence_id, draft.payment_provider, draft.payment_trx_id, draft.payment_sender, draft.claimed_advance_bdt]);
  const [review, setReview] = useState<{ source: string; values: PaymentSuggestions } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef<{ token: string; evidence: string; key: string } | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, [source, disabled]);
  const visible = review?.source === source && !disabled ? review : null;
  async function extract() {
    const evidence = draft.evidence_id;
    if (!evidence) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    if (mutation.current?.evidence !== evidence || mutation.current.token !== portalToken) mutation.current = { token: portalToken, evidence, key: crypto.randomUUID() };
    const timer = window.setTimeout(() => request.abort(), 10000);
    setLoading(true); setError(''); setReview(null);
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(portalToken)}/payment-extraction`, {
        method: 'POST', signal: request.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': mutation.current.key },
        body: JSON.stringify({ evidence_id: evidence, ai_opt_in: true }),
      });
      if (!response.ok) throw new Error('Unavailable');
      const values = parsePaymentSuggestions(await response.json(), evidence);
      if (!request.signal.aborted) setReview({ source, values });
    } catch {
      if (controller.current === request) setError('Screenshot extraction unavailable. Enter payment details manually. Retry uses the same request key.');
    } finally {
      window.clearTimeout(timer);
      if (controller.current === request) setLoading(false);
    }
  }
  return <section aria-label="Optional screenshot extraction">
    <p>Optional: send your attached screenshot to Google Gemini to suggest payment fields. Our raw AI evidence shares the screenshot’s original 30-day deletion deadline. Google processes it under the configured service terms. Review all suggestions; they do not verify payment. Manual entry is always available.</p>
    <button type="button" disabled={disabled || loading || !draft.evidence_id} onClick={() => { void extract(); }}>{loading ? 'Reading screenshot…' : 'Send screenshot to Gemini (I agree)'}</button>
    {loading && <p role="status">You can keep editing or submit manually while extraction loads.</p>}
    {error && <p role="alert">{error}</p>}
    {visible && <fieldset>
      <legend>Review screenshot suggestions</legend>
      <p>Payment screenshot: {visible.values.is_payment_screenshot === null ? 'Unknown' : visible.values.is_payment_screenshot ? 'Suggested yes' : 'Suggested no'}</p>
      <p>Unreadable fields: {visible.values.unreadable_fields.join(', ') || 'None reported'}</p>
      <label>Suggested provider<select aria-label="Suggested provider" value={visible.values.provider ?? ''} onChange={event => setReview({ ...visible, values: { ...visible.values, provider: event.target.value === 'bkash' ? 'bkash' : event.target.value === 'nagad' ? 'nagad' : null } })}>
        <option value="">Unknown</option><option value="bkash">bKash</option><option value="nagad">Nagad</option>
      </select></label>
      {(['trx_id', 'sender_number'] as const).map(field => <label key={field}>{field}<input aria-label={`Suggested ${field}`} maxLength={field === 'trx_id' ? 128 : 32} value={visible.values[field] ?? ''} onChange={event => setReview({ ...visible, values: { ...visible.values, [field]: event.target.value || null } })} /></label>)}
      <p>Suggested advance: {visible.values.amount_minor === null ? 'Unknown' : `${(visible.values.amount_minor / 100).toFixed(2)} BDT`} (edit in payment form after use)</p>
      <p>Suggested receiver: {visible.values.receiver_number ?? 'Unknown'}; time: {visible.values.occurred_at ?? 'Unknown'}. These do not change the seller’s payment account.</p>
      <button type="button" disabled={visible.values.is_payment_screenshot !== true} onClick={() => { onUse(reviewedPaymentPatch(visible.values)); setReview(null); }}>Use reviewed payment suggestions</button>
      <button type="button" onClick={() => setReview(null)}>Keep manual payment details</button>
    </fieldset>}
  </section>;
}
