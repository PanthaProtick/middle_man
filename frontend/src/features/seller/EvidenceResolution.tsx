import { formatBangladeshDateTime, formatBdt } from '../locale/format';
import { paymentReason } from '../locale/paymentExceptionCopy';
import { useLocale } from '../locale/context';
import { receiptText, receiptError, receiptCode } from '../locale/receiptCopy';
import './EvidenceResolution.css';
import { useEffect, useId, useRef, useState } from 'react';
import { SellerApiError } from './api';
import { compareReceipt, resolveReceipt } from './resolution';
import type { ReceiptComparison, ResolutionInput } from './resolution';
import type { PaymentAccount } from './types';
import { ReceiptCorrection } from './ReceiptCorrection';


interface Props { receiptId: string; token: string; onResolved: () => void; accounts?: PaymentAccount[] }

export function EvidenceResolution({receiptId, token, onResolved, accounts = []}: Props) {
  const { locale } = useLocale();
  const errorId = useId();
  const formatBangladeshTime = (value: string) => formatBangladeshDateTime(value, locale);
  const tr = (value: string) => receiptText(locale, value);
  const [comparison, setComparison] = useState<ReceiptComparison>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [observation, setObservation] = useState('');
  const [order, setOrder] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<{input: ResolutionInput; key: string} | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let current = true;
    compareReceipt(receiptId, token).then(data => { if (current) setComparison(data); })
      .catch(err => { if (current) setError(receiptError(err, 'Comparison unavailable')); });
    return () => { current = false; alive.current = false; };
  }, [receiptId, token]);

  async function refetch() {
    setBusy(true);
    try {
      const fresh = await compareReceipt(receiptId, token);
      if (alive.current) { setComparison(fresh); setObservation(''); setOrder(''); }
    } catch (err) { if (alive.current) setError(receiptError(err, 'Comparison unavailable')); }
    finally { if (alive.current) setBusy(false); }
  }

  async function submit() {
    if (!comparison || busy || correcting) return;
    const mutation = pending ?? {key: crypto.randomUUID(), input: {
      expected_version: comparison.receipt.version, selected_observation_id: observation,
      selected_order_id: order || null, reason: reason.trim(),
    }};
    setPending(mutation); setBusy(true); setError('');
    try {
      const result = await resolveReceipt(receiptId, mutation.input, mutation.key, token);
      if (alive.current) { setComparison(result); setPending(null); setObservation(''); setOrder(''); onResolved(); }
    } catch (err) {
      if (!alive.current) return;
      setError(receiptError(err, 'Outcome unknown; retry the same decision'));
      if (err instanceof SellerApiError && ['STALE_VERSION', 'CLAIM_CHANGED', 'PAYMENT_USED', 'INCOMPLETE_EVIDENCE', 'OBSERVATION_IDENTITY_CHANGED'].includes(err.code)) {
        setPending(null);
        await refetch();
      }
    } finally { if (alive.current) setBusy(false); }
  }

  if (!comparison) return <section lang={locale} aria-label={tr("Evidence resolution")}>
    {error ? (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
        <span>{tr(error)}</span>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void refetch()}>
          {tr("Retry comparison")}
        </button>
      </div>
    ) : <p role="status">{tr("Loading evidence comparison…")}</p>}
  </section>;
  const locked = Boolean(comparison.allocated_order_id) || comparison.receipt.reconciliation_state === 'used';
  return <section className="evidence-resolution" lang={locale} aria-label={tr("Evidence resolution")}>
    <h4>{tr("Compare and resolve / তুলনা ও সিদ্ধান্ত")}</h4>
    <p>{locked ? `${tr('Accepted allocation')}: ${comparison.allocated_order_id ?? tr('locked')}. ${tr('Later evidence cannot change accepted funds.')}`
      : tr("Select received evidence. Choosing a claim explicitly holds the other current claims; exact matching rules still apply.")}</p>
    {comparison.receipt.has_conflict && <p role="status">{tr("Conflicting observations require seller review.")}</p>}
    <ul>{comparison.claims.map(claim => <li key={claim.revision_id}>
      {claim.buyer_name} — {claim.order_id}: {receiptCode(locale, claim.lifecycle)}; {tr("Sender")} {claim.sender_number}; {formatBdt(claim.amount_minor)}.
      {' '}{claim.review_reasons.map(code => paymentReason(code, locale)).join(', ')} {claim.held_by_resolution && tr("Held by seller decision.")}
    </li>)}</ul>
    {error && <p id={errorId} role="alert">{tr(error)}</p>}
    {!locked && <ReceiptCorrection key={comparison.receipt.version} receipt={comparison.receipt} accounts={accounts}
      token={token} disabled={busy || Boolean(pending)} onPending={setCorrecting} onStale={refetch}
      onCorrected={result => { setComparison(result); setObservation(''); setOrder(''); onResolved(); }} />}
    {!locked && <form aria-label={tr("Resolve evidence")} aria-describedby={error ? errorId : undefined} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || Boolean(pending) || correcting}>
        <label>{tr("Received observation")}{!observation && <small>{tr(" — select complete evidence to continue.")}</small>}<select aria-label={tr("Received observation")} value={observation} onChange={e => setObservation(e.target.value)}>
          <option value="">{tr("Select complete observation")}</option>
          {comparison.receipt.observations.map(obs => <option key={obs.id} value={obs.id}
            disabled={obs.parse_state !== 'valid' || !obs.sender_number_canonical || !obs.occurred_at
              || (obs.trx_id !== undefined && (obs.provider !== comparison.receipt.provider || obs.trx_id !== comparison.receipt.trx_id))}>
            {receiptCode(locale, obs.source)}: {formatBdt(obs.amount_minor)}, {obs.sender_number_canonical ?? tr("Unknown sender")},
            {' '}{obs.occurred_at ? formatBangladeshTime(obs.occurred_at) : tr("Unknown time")}, {tr("Account")} {obs.payment_account_id}
          </option>)}
        </select></label>
        <label>{tr("Claim decision")}<select aria-label={tr("Claim decision")} value={order} onChange={e => setOrder(e.target.value)}>
          <option value="">{tr("Resolve observations only; keep competing claims held")}</option>
          {comparison.claims.filter(c => c.lifecycle === 'pending').map(c =>
            <option key={c.revision_id} value={c.order_id}>{c.buyer_name} — {c.order_id}</option>)}
        </select></label>
        <label>{tr("Decision reason")}{!reason.trim() && <small>{tr(" — a nonblank reason is required.")}</small>}<textarea aria-label={tr("Decision reason")} required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      <button className="btn btn-secondary btn-sm" disabled={busy || correcting || (!pending && (!observation || !reason.trim()))} type="submit">
        {busy ? tr("Recording…") : pending ? tr("Retry same decision") : tr("Record resolution")}
      </button>
    </form>}
    <button className="btn btn-secondary btn-sm" disabled={busy || correcting || Boolean(pending)} onClick={() => void refetch()}>{tr("Refresh comparison")}</button>
    <h5>{tr("Correction history")}</h5>
    <ul>{comparison.corrections?.map(edit => <li key={edit.observation_id}>
      {edit.actor}: {edit.reason} — {formatBangladeshTime(edit.created_at)}
      <p>{tr("Before")}: {edit.before.provider} / {edit.before.trx_id}; {formatBdt(edit.before.amount_minor)};
        {' '}{edit.before.sender_number ?? tr("Unknown sender")}; {edit.before.occurred_at ? formatBangladeshTime(edit.before.occurred_at) : tr("Unknown time")};
        {' '}{tr('Account')} {edit.before.payment_account_id}; {edit.before.has_conflict ? tr("conflicted") : tr("consistent")}.</p>
      <p>{tr("After")}: {edit.after.provider} / {edit.after.trx_id}; {formatBdt(edit.after.amount_minor)};
        {' '}{edit.after.sender_number ?? tr("Unknown sender")}; {edit.after.occurred_at ? formatBangladeshTime(edit.after.occurred_at) : tr("Unknown time")};
        {' '}{tr('Account')} {edit.after.payment_account_id}.</p>
    </li>)}</ul>
    <h5>{tr("Decision history")}</h5>
    <ul>{comparison.history.map((decision, index) => <li key={index}>
      {decision.actor}: {decision.reason} — {tr("Observation")} {decision.selected_observation_id};
      {' '}{tr('Claim')} {decision.selected_order_id ?? tr("no claim selected")}; {formatBangladeshTime(decision.created_at)}
    </li>)}</ul>
  </section>;
}
