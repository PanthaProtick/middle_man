import './EvidenceResolution.css';
import { useEffect, useRef, useState } from 'react';
import { formatBangladeshTime, SellerApiError } from './api';
import { compareReceipt, resolveReceipt } from './resolution';
import type { ReceiptComparison, ResolutionInput } from './resolution';

const formatBdt = (minor: number) => `BDT ${(minor / 100).toFixed(2)}`;

interface Props { receiptId: string; token: string; onResolved: () => void }

export function EvidenceResolution({receiptId, token, onResolved}: Props) {
  const [comparison, setComparison] = useState<ReceiptComparison>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [observation, setObservation] = useState('');
  const [order, setOrder] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<{input: ResolutionInput; key: string} | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let current = true;
    compareReceipt(receiptId, token).then(data => { if (current) setComparison(data); })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : 'Comparison unavailable'); });
    return () => { current = false; alive.current = false; };
  }, [receiptId, token]);

  async function refetch() {
    setBusy(true);
    try {
      const fresh = await compareReceipt(receiptId, token);
      if (alive.current) { setComparison(fresh); setObservation(''); setOrder(''); }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Comparison unavailable'); }
    finally { if (alive.current) setBusy(false); }
  }

  async function submit() {
    if (!comparison || busy) return;
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
      setError(err instanceof Error ? err.message : 'Outcome unknown; retry the same decision');
      if (err instanceof SellerApiError && ['STALE_VERSION', 'CLAIM_CHANGED', 'PAYMENT_USED', 'INCOMPLETE_EVIDENCE'].includes(err.code)) {
        setPending(null);
        await refetch();
      }
    } finally { if (alive.current) setBusy(false); }
  }

  if (!comparison) return <section aria-label="Evidence resolution">
    {error ? <><p role="alert">{error}</p><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void refetch()}>Retry comparison</button></>
      : <p role="status">Loading evidence comparison…</p>}
  </section>;
  const locked = Boolean(comparison.allocated_order_id) || comparison.receipt.reconciliation_state === 'used';
  return <section className="evidence-resolution" aria-label="Evidence resolution">
    <h4>Compare and resolve / তুলনা ও সিদ্ধান্ত</h4>
    <p>{locked ? `Accepted allocation: ${comparison.allocated_order_id ?? 'locked'}. Later evidence cannot change accepted funds.`
      : 'Select received evidence. Choosing a claim explicitly holds the other current claims; exact matching rules still apply.'}</p>
    {comparison.receipt.has_conflict && <p role="status">Conflicting observations require seller review.</p>}
    <ul>{comparison.claims.map(claim => <li key={claim.revision_id}>
      {claim.buyer_name} — {claim.order_id}: {claim.lifecycle}; sender {claim.sender_number}; {formatBdt(claim.amount_minor)}.
      {' '}{claim.review_reasons.join(', ')} {claim.held_by_resolution && 'Held by seller decision.'}
    </li>)}</ul>
    {error && <p role="alert">{error}</p>}
    {!locked && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || Boolean(pending)}>
        <label>Received observation{!observation && <small> — select complete evidence to continue.</small>}<select aria-label="Received observation" value={observation} onChange={e => setObservation(e.target.value)}>
          <option value="">Select complete observation</option>
          {comparison.receipt.observations.map(obs => <option key={obs.id} value={obs.id}
            disabled={obs.parse_state !== 'valid' || !obs.sender_number_canonical || !obs.occurred_at}>
            {obs.source}: {formatBdt(obs.amount_minor)}, {obs.sender_number_canonical ?? 'Unknown sender'},
            {' '}{obs.occurred_at ? formatBangladeshTime(obs.occurred_at) : 'Unknown time'}, account {obs.payment_account_id}
          </option>)}
        </select></label>
        <label>Claim decision<select aria-label="Claim decision" value={order} onChange={e => setOrder(e.target.value)}>
          <option value="">Resolve observations only; keep competing claims held</option>
          {comparison.claims.filter(c => c.lifecycle === 'pending').map(c =>
            <option key={c.revision_id} value={c.order_id}>{c.buyer_name} — {c.order_id}</option>)}
        </select></label>
        <label>Decision reason{!reason.trim() && <small> — a nonblank reason is required.</small>}<textarea aria-label="Decision reason" required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      <button className="btn btn-secondary btn-sm" disabled={busy || (!pending && (!observation || !reason.trim()))} type="submit">
        {busy ? 'Recording…' : pending ? 'Retry same decision' : 'Record resolution'}
      </button>
    </form>}
    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void refetch()}>Refresh comparison</button>
    <h5>Decision history</h5>
    <ul>{comparison.history.map((decision, index) => <li key={index}>
      {decision.actor}: {decision.reason} — observation {decision.selected_observation_id};
      {' '}claim {decision.selected_order_id ?? 'no claim selected'}; {formatBangladeshTime(decision.created_at)}
    </li>)}</ul>
  </section>;
}
