import './BuyerCorrection.css';
import { useEffect, useRef, useState } from 'react';
import { SellerApiError, canonicalizeBdPhone, parseBdtToMinor } from './api';
import { correctBuyer, fetchCorrectionOrder, fetchHistory, resolveCorrectionLink } from './corrections';
import type { CorrectionInput, History, Revision } from './corrections';
import type { SellerOrder } from './types';

interface Props {orderId?: string; portalToken?: string; token: string; onCorrected?: (order: SellerOrder) => void}

export function BuyerCorrection({orderId, portalToken, token, onCorrected}: Props) {
  const [order, setOrder] = useState<SellerOrder>();
  const [history, setHistory] = useState<History>();
  const [draft, setDraft] = useState<Revision>();
  const [reason, setReason] = useState('');
  const [amountBdt, setAmountBdt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState<{key: string; input: CorrectionInput} | null>(null);
  const alive = useRef(true);

  async function load(id: string, keepDraft = false) {
    const fresh = await fetchCorrectionOrder(id, token);
    let revisions = await fetchHistory(id, token);
    // Load every page so the editable draft always comes from the active revision.
    while (revisions.next_cursor) {
      const page = await fetchHistory(id, token, revisions.next_cursor);
      revisions = {items: [...revisions.items, ...page.items], next_cursor: page.next_cursor};
    }
    if (!alive.current) return;
    setOrder(fresh); setHistory(revisions);
    if (!keepDraft) {
      setDraft(revisions.items.at(-1));
      setAmountBdt(((revisions.items.at(-1)?.payment_claim.amount_minor ?? 0) / 100).toFixed(2));
    }
  }

  useEffect(() => {
    alive.current = true;
    let current = true;
    async function initial() {
      try {
        const id = orderId ?? (await resolveCorrectionLink(portalToken ?? '', token)).order_id;
        if (current) await load(id);
      } catch (err) { if (current) setError(err instanceof Error ? err.message : 'Correction unavailable'); }
    }
    void initial();
    return () => {current = false; alive.current = false;};
    // Each editor is keyed by order/link and seller session at its call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, portalToken, token]);

  async function submit() {
    if (!order || !draft || busy || stale) return;
    setBusy(true); setError('');
    try {
      canonicalizeBdPhone(draft.contact_number);
      canonicalizeBdPhone(draft.payment_claim.sender_number);
      const payment = {...draft.payment_claim, amount_minor: parseBdtToMinor(amountBdt)};
      const prior = history?.items.at(-1);
      const input: CorrectionInput = {expected_version: order.version, reason,
        buyer_name: draft.buyer_name, contact_number: draft.contact_number, address: draft.address};
      if (order.lifecycle !== 'confirmed' && JSON.stringify(payment) !== JSON.stringify(prior?.payment_claim)) input.payment_claim = payment;
      const mutation = pending ?? {key: crypto.randomUUID(), input};
      setPending(mutation);
      const result = await correctBuyer(order.id, mutation.input, mutation.key, token);
      if (!alive.current) return;
      setPending(null); setReason(''); setOrder(result); onCorrected?.(result);
      await load(order.id);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : 'Correction unavailable');
      if (err instanceof SellerApiError && !err.code.startsWith('HTTP_5')) {
        setPending(null);
        if (['STALE_VERSION', 'PAYMENT_FIELDS_LOCKED'].includes(err.code)) setStale(true);
      }
    } finally {if (alive.current) setBusy(false);}
  }

  const isConfirmed = order?.lifecycle === 'confirmed';
  const buttonLabel = busy
    ? (isConfirmed ? 'Saving delivery correction…' : 'Saving…')
    : pending
      ? 'Retry same correction'
      : isConfirmed
        ? 'Save delivery correction'
        : 'Save correction and check again';

  return <section className="buyer-correction" aria-label="Seller buyer corrections">
    <h3>Correct buyer information / ক্রেতার তথ্য সংশোধন</h3>
    {error && <p role="alert">{error}</p>}
    {!order && !error && <p role="status">Loading buyer information…</p>}
    {order && <p role="status">{order.lifecycle} — {order.review_reasons.join(', ') || 'No private review reasons'}</p>}
    {isConfirmed && (
      <div className="courier-notice" role="note" style={{marginBottom: '12px', padding: '10px 12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', fontSize: '0.825rem', color: 'var(--amber-accent)'}}>
        Portal corrections do not update courier bookings. Update courier parcels separately if already booked. / পোর্টালের তথ্য পরিবর্তনে কুরিয়ার বুকিং আপডেট হয় না। কুরিয়ারে বুকিং করা থাকলে আলাদাভাবে আপডেট করুন।
      </div>
    )}
    {stale && <button onClick={async () => {
      if (!order) return;
      try {await load(order.id, true); setStale(false); setPending(null); setError('Review your retained inputs against the refreshed order before saving.');}
      catch (err) {setError(err instanceof Error ? err.message : 'Refresh unavailable');}
    }}>Refresh order and retain inputs</button>}
    {draft && order && ['pending', 'confirmed'].includes(order.lifecycle) && <form onSubmit={event => {event.preventDefault(); void submit();}}>
      <fieldset disabled={busy || !!pending || stale}>
        <label>Buyer name<input required maxLength={200} value={draft.buyer_name} onChange={e => setDraft({...draft, buyer_name: e.target.value})} /></label>
        <label>Contact number<input required maxLength={32} value={draft.contact_number} onChange={e => setDraft({...draft, contact_number: e.target.value})} /></label>
        <label>Delivery address<textarea required maxLength={2000} value={draft.address.raw_text} onChange={e => setDraft({...draft, address: {...draft.address, raw_text: e.target.value}})} /></label>
        <fieldset disabled={isConfirmed}><legend>Payment claim</legend>
          {isConfirmed && (
            <p className="payment-locked-note" style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 8px'}}>
              Payment terms and accepted advance are locked on confirmed orders. / কনফার্মড অর্ডারে পেমেন্ট ও অগ্রিমের তথ্য অপরিবর্তনশীল।
            </p>
          )}
          <label>Provider<select value={draft.payment_claim.provider} onChange={e => setDraft({...draft, payment_claim: {...draft.payment_claim, provider: e.target.value === 'bkash' ? 'bkash' : 'nagad'}})}><option value="bkash">bKash</option><option value="nagad">Nagad</option></select></label>
          <label>Transaction ID<input required maxLength={128} value={draft.payment_claim.trx_id} onChange={e => setDraft({...draft, payment_claim: {...draft.payment_claim, trx_id: e.target.value}})} /></label>
          <label>Payment sender<input required maxLength={32} value={draft.payment_claim.sender_number} onChange={e => setDraft({...draft, payment_claim: {...draft.payment_claim, sender_number: e.target.value}})} /></label>
          <label>Claimed advance (BDT)<input required inputMode="decimal" value={amountBdt} onChange={e => setAmountBdt(e.target.value)} /></label>
        </fieldset>
        <label>Correction reason<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      <button type="submit" disabled={busy || stale || (!pending && !reason.trim())}>
        {buttonLabel}
      </button>
    </form>}
    {history && <details><summary>Buyer revision history ({history.items.length})</summary>
      {history.items.map(item => <article key={item.id}>
        <p>Revision {item.revision_number}: {item.buyer_name}, {item.contact_number}, {item.address.raw_text}</p>
        <p>{item.payment_claim.provider} · {item.payment_claim.trx_id} · {item.payment_claim.sender_number} · BDT {(item.payment_claim.amount_minor / 100).toFixed(2)}</p>
        <p>{item.actor} · {item.reason ?? 'Initial submission'} · {item.created_at}</p>
        <p>Payment claim accepted: {item.claim_accepted_at}</p>
      </article>)}
    </details>}
  </section>;
}
