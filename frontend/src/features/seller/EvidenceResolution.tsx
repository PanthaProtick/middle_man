import { formatBangladeshDateTime, formatBdt } from '../locale/format';
import { paymentReason } from '../locale/paymentExceptionCopy';
import { useLocale } from '../locale/context';
import { receiptText, receiptError, receiptCode } from '../locale/receiptCopy';
import './EvidenceResolution.css';
import './EvidenceForms.css';
import './EvidenceHistory.css';
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

  if (!comparison) return <section className="evidence-resolution evidence-loading" lang={locale} aria-label={tr("Evidence resolution")}>
    {error ? (
      <div role="alert" className="evidence-alert">
        <span>{tr(error)}</span>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void refetch()}>
          {tr("Retry comparison")}
        </button>
      </div>
    ) : <p role="status" className="evidence-loading-text">{tr("Loading evidence comparison…")}</p>}
  </section>;
  const locked = Boolean(comparison.allocated_order_id) || comparison.receipt.reconciliation_state === 'used';
  return <section className="evidence-resolution" lang={locale} aria-label={tr("Evidence resolution")}>
    <div className="evidence-head">
      <h4 className="evidence-title">{tr("Compare and resolve")}</h4>
      <span className="evidence-state" data-tone={comparison.receipt.has_conflict ? 'rose' : locked ? 'emerald' : 'cyan'}>
        {comparison.receipt.has_conflict ? tr("conflicted") : receiptCode(locale, comparison.receipt.reconciliation_state)}
      </span>
    </div>

    <div className="evidence-receipt-summary" aria-label={tr("Receipt identity")}>
      <div className="evidence-receipt-identity">
        <span className="evidence-provider" data-provider={comparison.receipt.provider}>
          {comparison.receipt.provider ?? '—'}
        </span>
        <span className="evidence-trx">{comparison.receipt.trx_id ?? '—'}</span>
      </div>
      <dl className="evidence-receipt-facts">
        <div>
          <dt>{tr("Amount")}</dt>
          <dd>{formatBdt(comparison.receipt.amount_minor ?? 0)}</dd>
        </div>
        <div>
          <dt>{tr("Status")}</dt>
          <dd>{receiptCode(locale, comparison.receipt.reconciliation_state)}</dd>
        </div>
      </dl>
    </div>

    <p className="evidence-guidance">{locked ? `${tr('Accepted allocation')}: ${comparison.allocated_order_id ?? tr('locked')}. ${tr('Later evidence cannot change accepted funds.')}`
      : tr("Select received evidence. Choosing a claim explicitly holds the other current claims; exact matching rules still apply.")}</p>
    {comparison.receipt.has_conflict && <p role="status" className="evidence-conflict-note">{tr("Conflicting observations require seller review.")}</p>}

    <ul className="evidence-claims">{comparison.claims.map(claim => <li key={claim.revision_id} className="evidence-claim">
      <div className="evidence-claim-head">
        <span className="evidence-claim-buyer">{claim.buyer_name}</span>
        <span className="evidence-claim-order">{claim.order_id}</span>
        <span className="evidence-claim-lifecycle">{receiptCode(locale, claim.lifecycle)}</span>
      </div>
      <dl className="evidence-claim-facts">
        <div><dt>{tr("Sender")}</dt><dd>{claim.sender_number}</dd></div>
        <div><dt>{tr("Amount")}</dt><dd>{formatBdt(claim.amount_minor)}</dd></div>
      </dl>
      {claim.review_reasons.length > 0 && <p className="evidence-claim-reasons">{claim.review_reasons.map(code => paymentReason(code, locale)).join(', ')}</p>}
      {claim.held_by_resolution && <p className="evidence-claim-held">{tr("Held by seller decision.")}</p>}
    </li>)}</ul>

    {error && <p id={errorId} role="alert" className="evidence-alert">{tr(error)}</p>}
    {!locked && <ReceiptCorrection key={comparison.receipt.version} receipt={comparison.receipt} accounts={accounts}
      token={token} disabled={busy || Boolean(pending)} onPending={setCorrecting} onStale={refetch}
      onCorrected={result => { setComparison(result); setObservation(''); setOrder(''); onResolved(); }} />}
    {!locked && <form className="evidence-form" aria-label={tr("Resolve evidence")} aria-describedby={error ? errorId : undefined} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || Boolean(pending) || correcting}>
        <legend className="evidence-form-title">{tr("Resolve evidence")}</legend>
        <label className="evidence-field">{tr("Received observation")}{!observation && <small>{tr(" — select complete evidence to continue.")}</small>}<select aria-label={tr("Received observation")} value={observation} onChange={e => setObservation(e.target.value)}>
          <option value="">{tr("Select complete observation")}</option>
          {comparison.receipt.observations.map(obs => <option key={obs.id} value={obs.id}
            disabled={obs.parse_state !== 'valid' || !obs.sender_number_canonical || !obs.occurred_at
              || (obs.trx_id !== undefined && (obs.provider !== comparison.receipt.provider || obs.trx_id !== comparison.receipt.trx_id))}>
            {receiptCode(locale, obs.source)}: {formatBdt(obs.amount_minor)}, {obs.sender_number_canonical ?? tr("Unknown sender")},
            {' '}{obs.occurred_at ? formatBangladeshTime(obs.occurred_at) : tr("Unknown time")}, {tr("Account")} {obs.payment_account_id}
          </option>)}
        </select></label>
        <label className="evidence-field">{tr("Claim decision")}<select aria-label={tr("Claim decision")} value={order} onChange={e => setOrder(e.target.value)}>
          <option value="">{tr("Resolve observations only; keep competing claims held")}</option>
          {comparison.claims.filter(c => c.lifecycle === 'pending').map(c =>
            <option key={c.revision_id} value={c.order_id}>{c.buyer_name} — {c.order_id}</option>)}
        </select></label>
        <label className="evidence-field">{tr("Decision reason")}{!reason.trim() && <small>{tr(" — a nonblank reason is required.")}</small>}<textarea aria-label={tr("Decision reason")} required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      <button className="btn btn-secondary btn-sm evidence-submit" disabled={busy || correcting || (!pending && (!observation || !reason.trim()))} type="submit">
        {busy ? tr("Recording…") : pending ? tr("Retry same decision") : tr("Record resolution")}
      </button>
    </form>}
    <button className="btn btn-secondary btn-sm evidence-refresh" disabled={busy || correcting || Boolean(pending)} onClick={() => void refetch()}>{tr("Refresh comparison")}</button>

    <section className="evidence-history" aria-label={tr("Correction history")}>
      <h5 className="evidence-history-title">{tr("Correction history")}</h5>
      {comparison.corrections?.length ? <ul className="evidence-history-list">{comparison.corrections.map(edit => <li key={edit.observation_id} className="evidence-history-item">
        <div className="evidence-history-head">
          <span className="evidence-history-actor">{edit.actor}</span>
          <span className="evidence-history-time">{formatBangladeshTime(edit.created_at)}</span>
        </div>
        <p className="evidence-history-reason">{edit.reason}</p>
        <p className="evidence-history-before">{tr("Before")}: {edit.before.provider} / {edit.before.trx_id}; {formatBdt(edit.before.amount_minor)};
          {' '}{edit.before.sender_number ?? tr("Unknown sender")}; {edit.before.occurred_at ? formatBangladeshTime(edit.before.occurred_at) : tr("Unknown time")};
          {' '}{tr('Account')} {edit.before.payment_account_id}; {edit.before.has_conflict ? tr("conflicted") : tr("consistent")}.</p>
        <p className="evidence-history-after">{tr("After")}: {edit.after.provider} / {edit.after.trx_id}; {formatBdt(edit.after.amount_minor)};
          {' '}{edit.after.sender_number ?? tr("Unknown sender")}; {edit.after.occurred_at ? formatBangladeshTime(edit.after.occurred_at) : tr("Unknown time")};
          {' '}{tr('Account')} {edit.after.payment_account_id}.</p>
      </li>)}</ul> : <p className="evidence-history-empty">{tr("No corrections recorded.")}</p>}
    </section>

    <section className="evidence-history" aria-label={tr("Decision history")}>
      <h5 className="evidence-history-title">{tr("Decision history")}</h5>
      {comparison.history.length > 0 ? <ul className="evidence-history-list">{comparison.history.map((decision, index) => <li key={index} className="evidence-history-item">
        <div className="evidence-history-head">
          <span className="evidence-history-actor">{decision.actor}</span>
          <span className="evidence-history-time">{formatBangladeshTime(decision.created_at)}</span>
        </div>
        <p className="evidence-history-reason">{decision.reason}</p>
        <p className="evidence-history-decision">{tr("Observation")} {decision.selected_observation_id};
          {' '}{tr('Claim')} {decision.selected_order_id ?? tr("no claim selected")}</p>
      </li>)}</ul> : <p className="evidence-history-empty">{tr("No decisions recorded.")}</p>}
    </section>
  </section>;
}
