import './BuyerCorrection.css';
import { useEffect, useRef, useState } from 'react';
import { SellerApiError, canonicalizeBdPhone, parseBdtToMinor } from './api';
import { correctBuyer, fetchCorrectionOrder, fetchHistory, resolveCorrectionLink } from './corrections';
import type { CorrectionInput, History, Revision } from './corrections';
import type { CourierAttemptStatus } from './courierReviewTypes';
import type { SellerOrder } from './types';
import { useLocale } from '../locale/context';
import { correctionFieldLabel, correctionLocationCondition, correctionLocationEnvironment, correctionOutcomeCopy, correctionReview, correctionStatus } from '../locale/correctionOutcomeCopy';
import { formatBangladeshDateTime } from '../locale/format';

interface Props {
  orderId?: string;
  portalToken?: string;
  token: string;
  onCorrected?: (order: SellerOrder) => void;
  courierAttemptStatus?: CourierAttemptStatus | null;
}

export function BuyerCorrection({orderId, portalToken, token, onCorrected, courierAttemptStatus}: Props) {
  const {locale} = useLocale();
  const text = correctionOutcomeCopy[locale];
  const [order, setOrder] = useState<SellerOrder>();
  const [history, setHistory] = useState<History>();
  const [draft, setDraft] = useState<Revision>();
  const [reason, setReason] = useState('');
  const [amountBdt, setAmountBdt] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [showDevStatus, setShowDevStatus] = useState(false);
  const [pending, setPending] = useState<{key: string; input: CorrectionInput} | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
      } catch (err) { if (current) setError(err instanceof SellerApiError && err.status === 401 ? 'unauthorized' : 'unavailable'); }
    }
    void initial();
    return () => {current = false; alive.current = false;};
    // Each editor is keyed by order/link and seller session at its call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, portalToken, token, loadAttempt]);

  async function submit() {
    if (!order || !draft || busy || stale) return;
    setBusy(true); setError(''); setFieldErrors([]);
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
      try { await load(order.id); } catch { setError('unavailable'); }
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof SellerApiError && err.status === 401 ? 'unauthorized' : err instanceof SellerApiError ? err.code : err instanceof Error && err.message.startsWith('Invalid Bangladeshi phone') ? 'phone' : err instanceof Error && err.message.startsWith('Amount') ? 'amount' : 'unknown');
      if (err instanceof SellerApiError) setFieldErrors((err.fields ?? []).map(field => field.field ?? '').filter(field => correctionFieldLabel(field, locale) !== null));
      if (err instanceof SellerApiError && !err.code.startsWith('HTTP_5')) {
        setPending(null);
        if (['STALE_VERSION', 'PAYMENT_FIELDS_LOCKED'].includes(err.code)) setStale(true);
      }
    } finally {if (alive.current) setBusy(false);}
  }

  const isConfirmed = order?.lifecycle === 'confirmed';
  const buttonLabel = busy
    ? (isConfirmed ? text.savingDelivery : text.saving)
    : pending
      ? text.retry
      : isConfirmed
        ? text.saveDelivery
        : text.save;

  const errorText = error === 'unknown' ? text.unknownError : error === 'unavailable' ? text.unavailable
    : error === 'refreshed' ? text.refreshed : error === 'phone' ? text.phoneError
      : error === 'amount' ? text.amountError : error === 'STALE_VERSION' ? text.stale : error === 'unauthorized' ? (locale === 'bn' ? 'বিক্রেতা হিসেবে সাইন ইন করুন।' : 'Seller sign-in required.') : text.failed;

  return <section className="buyer-correction" lang={locale === 'bn' ? 'bn-BD' : 'en'} aria-label={text.correctionTitle}>
    <h3>{text.correctionTitle}</h3>
    {error && <p role="alert">{errorText}</p>}
    {fieldErrors.map(field => <p id={`correction-error-${field.replaceAll('.', '-')}`} role="alert" key={field}>
      {correctionFieldLabel(field, locale)}: {text.invalidField}
    </p>)}
    {!order && !error && <p role="status">{text.loading}</p>}
    {!order && error && <button type="button" onClick={() => {setError(''); setLoadAttempt(value => value + 1);}}>{text.refresh}</button>}
    {order && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <p role="status" style={{ margin: '4px 0' }}>
          {text.status} <strong>{correctionStatus(order.lifecycle, locale)}</strong>
          <span style={{ display: showDevStatus ? 'inline' : 'none' }}>
            {' '}— {order.review_reasons.map(code => correctionReview(code, locale)).join(', ') || text.noReasons}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setShowDevStatus((prev) => !prev)}
          style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', cursor: 'pointer', fontSize: '0.725rem', textDecoration: 'underline', padding: 0 }}
          aria-expanded={showDevStatus}
        >
          {showDevStatus ? text.hideDetails : text.showDetails}
        </button>
      </div>
    )}
    {isConfirmed && (
      <div className="courier-notice" role="note" style={{marginBottom: '12px', padding: '10px 12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', fontSize: '0.825rem', color: 'var(--amber-accent)'}}>
        {courierAttemptStatus === 'success'
          ? text.booked
          : courierAttemptStatus === 'submitting'
            ? text.submitting
            : courierAttemptStatus === 'unknown'
              ? text.unknownBooking
              : courierAttemptStatus === 'unsubmitted'
                ? text.unsubmitted
                : text.courier}
      </div>
    )}
    {stale && <button onClick={async () => {
      if (!order) return;
      try {await load(order.id, true); setStale(false); setPending(null); setError('refreshed');}
      catch {setError('unavailable');}
    }}>{text.refresh}</button>}
    {draft && order && ['pending', 'confirmed'].includes(order.lifecycle) && <form onSubmit={event => {event.preventDefault(); void submit();}}>
      <fieldset disabled={busy || !!pending || stale}>
        <label>{text.buyerName}<input required maxLength={200} aria-invalid={fieldErrors.includes('buyer_name')} aria-describedby={fieldErrors.includes('buyer_name') ? 'correction-error-buyer_name' : undefined} value={draft.buyer_name} onChange={e => setDraft({...draft, buyer_name: e.target.value})} /></label>
        <label>{text.contact}<input required maxLength={32} aria-invalid={fieldErrors.includes('contact_number')} aria-describedby={fieldErrors.includes('contact_number') ? 'correction-error-contact_number' : undefined} value={draft.contact_number} onChange={e => setDraft({...draft, contact_number: e.target.value})} /></label>
        <label>{text.address}<textarea required maxLength={2000} aria-invalid={fieldErrors.includes('address') || fieldErrors.includes('address.raw_text')} aria-describedby={fieldErrors.includes('address.raw_text') ? 'correction-error-address-raw_text' : fieldErrors.includes('address') ? 'correction-error-address' : undefined} value={draft.address.raw_text} onChange={e => setDraft({...draft, address: {...draft.address, raw_text: e.target.value}})} /></label>
        <fieldset disabled={isConfirmed} aria-describedby={fieldErrors.includes('payment_claim') ? 'correction-error-payment_claim' : undefined}><legend>{text.claim}</legend>
          {isConfirmed && (
            <p className="payment-locked-note" style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 8px'}}>
              {text.locked}
            </p>
          )}
          <label>{text.provider}<select aria-invalid={fieldErrors.includes('payment_claim.provider')} aria-describedby={fieldErrors.includes('payment_claim.provider') ? 'correction-error-payment_claim-provider' : undefined} value={draft.payment_claim.provider} onChange={e => setDraft({...draft, payment_claim: {...draft.payment_claim, provider: e.target.value === 'bkash' ? 'bkash' : 'nagad'}})}><option value="bkash">bKash</option><option value="nagad">Nagad</option></select></label>
          <label>{text.transaction}<input required maxLength={128} aria-invalid={fieldErrors.includes('payment_claim.trx_id')} aria-describedby={fieldErrors.includes('payment_claim.trx_id') ? 'correction-error-payment_claim-trx_id' : undefined} value={draft.payment_claim.trx_id} onChange={e => setDraft({...draft, payment_claim: {...draft.payment_claim, trx_id: e.target.value}})} /></label>
          <label>{text.sender}<input required maxLength={32} aria-invalid={fieldErrors.includes('payment_claim.sender_number')} aria-describedby={fieldErrors.includes('payment_claim.sender_number') ? 'correction-error-payment_claim-sender_number' : undefined} value={draft.payment_claim.sender_number} onChange={e => setDraft({...draft, payment_claim: {...draft.payment_claim, sender_number: e.target.value}})} /></label>
          <label>{text.advance}<input required inputMode="decimal" aria-invalid={fieldErrors.includes('payment_claim.amount_minor')} aria-describedby={fieldErrors.includes('payment_claim.amount_minor') ? 'correction-error-payment_claim-amount_minor' : undefined} value={amountBdt} onChange={e => setAmountBdt(e.target.value)} /></label>
        </fieldset>
        <label>{text.reason}<textarea required maxLength={1000} aria-invalid={fieldErrors.includes('reason')} aria-describedby={fieldErrors.includes('reason') ? 'correction-error-reason' : undefined} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      <button type="submit" disabled={busy || stale || (!pending && !reason.trim())}>
        {buttonLabel}
      </button>
    </form>}
    {history && <details><summary>{text.history} ({history.items.length})</summary>
      {history.items.map(item => <article key={item.id}>
        <p>{text.revision} {item.revision_number}: {item.buyer_name}, {item.contact_number}, {item.address.raw_text}</p>
        {item.address.pathao && <p>Pathao: {correctionLocationCondition(item.address.pathao.condition, locale)} · {correctionLocationEnvironment(item.address.pathao.environment, locale)} ·
          {item.address.pathao.city_name ?? text.city} ({item.address.pathao.city_id ?? '—'}) /{' '}
          {item.address.pathao.zone_name ?? text.zone} ({item.address.pathao.zone_id ?? '—'}) /{' '}
          {item.address.pathao.area_name ?? text.area} ({item.address.pathao.area_id ?? '—'}).
          {item.address.pathao.booking_blocked && text.bookingBlocked}</p>}
        <p>{item.payment_claim.provider} · {item.payment_claim.trx_id} · {item.payment_claim.sender_number} · BDT {(item.payment_claim.amount_minor / 100).toFixed(2)}</p>
        <p>{item.actor} · {item.reason ?? text.initial} · {formatBangladeshDateTime(item.created_at, locale)}</p>
        <p>{text.accepted} {formatBangladeshDateTime(item.claim_accepted_at, locale)}</p>
      </article>)}
    </details>}
  </section>;
}
