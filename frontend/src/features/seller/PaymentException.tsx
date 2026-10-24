import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { fetchTransactions, formatBangladeshTime, SellerApiError } from './api';
import { acceptPayment, previewPayment } from './paymentDecisions';
import type { PaymentDecision, PaymentPreview } from './paymentDecisions';
import type { ReceiptView, SellerOrder } from './types';

const money = (minor: number) => `BDT ${(minor / 100).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function PaymentException({orderId, token, onAccepted}: {
  orderId: string; token: string; onAccepted: (order: SellerOrder) => void;
}) {
  const [receipts,setReceipts] = useState<ReceiptView[]>([]);
  const [cursor,setCursor] = useState<string | null>(null);
  const [receiptId,setReceiptId] = useState('');
  const [preview,setPreview] = useState<PaymentPreview | null>(null);
  const [reason,setReason] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(false);
  const [stale,setStale] = useState(false);
  const pending = useRef<{payload:PaymentDecision;key:string} | null>(null);
  const sequence = useRef({value:0});

  useEffect(() => {
    let active = true;
    const requests = sequence.current;
    fetchTransactions({},token).then(data => {if(active){setReceipts(data.items);setCursor(data.next_cursor ?? null);}})
      .catch(e => {if(active)setError(e instanceof Error ? e.message : 'Receipts unavailable');});
    return () => {active=false;requests.value++;};
  },[token]);

  async function loadPreview(id: string) {
    const request = ++sequence.current.value;
    setReceiptId(id);setPreview(null);setError('');setStale(false);
    if(!id)return;
    setBusy(true);
    try {const data = await previewPayment(orderId,id,token);if(request===sequence.current.value)setPreview(data);}
    catch(e){if(request===sequence.current.value)setError(e instanceof Error ? e.message : 'Preview unavailable');}
    finally{if(request===sequence.current.value)setBusy(false);}
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if(busy || stale || !preview || preview.blockers.length || !reason.trim())return;
    pending.current ??= {key:crypto.randomUUID(),payload:{action:'confirm',expected_version:preview.expected_version,
      expected_transaction_version:preview.expected_transaction_version,transaction_id:preview.receipt.id,
      accepted_amount_minor:preview.accepted_amount_minor,reason:reason.trim()}};
    setBusy(true);setError('');
    try {const result=await acceptPayment(orderId,pending.current.payload,pending.current.key,token);
      pending.current=null;setRetry(false);onAccepted(result);}
    catch(e){setError(e instanceof Error ? e.message : 'Approval unavailable');
      if(e instanceof SellerApiError && e.status>=400 && e.status<500){pending.current=null;setRetry(false);setStale(true);}
      else setRetry(true);}
    finally{setBusy(false);}
  }

  return <section className="buyer-correction" aria-label="Manual payment acceptance">
    <h4>Accept payment exception</h4>
    <p>Confirmation records seller acceptance of a received payment.</p>
    {error && <p role="alert">{error}</p>}
    <label>Existing seller receipt
      <select value={receiptId} disabled={busy || retry} onChange={e => void loadPreview(e.target.value)}>
        <option value="">Select a receipt</option>
        {receipts.map(r => <option key={r.id} value={r.id}>{r.provider} · {r.trx_id} · {money(r.amount_minor)}</option>)}
      </select>
    </label>
    {cursor && <button type="button" disabled={busy || retry} onClick={async () => {
      setBusy(true);try{const data=await fetchTransactions({cursor},token);setReceipts(old=>[...old,...data.items]);setCursor(data.next_cursor ?? null);}
      catch(e){setError(e instanceof Error ? e.message : 'Receipts unavailable');}finally{setBusy(false);}
    }}>Load more receipts</button>}
    {busy && <p role="status">Loading payment…</p>}
    {receiptId && !retry && <button type="button" disabled={busy} onClick={()=>void loadPreview(receiptId)}>Refresh payment preview</button>}
    {preview && <>
      <p>Order total: {money(preview.total_minor)} · Required advance: {money(preview.required_advance_minor)}</p>
      <table><caption>Payment claim compared with seller receipt</caption>
        <thead><tr><th>Field</th><th>Order / buyer claim</th><th>Seller receipt</th></tr></thead>
        <tbody>
          <tr><th>Provider</th><td>{preview.account_provider} / {preview.claim_provider}</td><td>{preview.receipt.provider}</td></tr>
          <tr><th>Receiving account ID</th><td>{preview.payment_account_id}</td><td>{preview.receipt.payment_account_id}</td></tr>
          <tr><th>TrxID</th><td>{preview.claim_trx_id}</td><td>{preview.receipt.trx_id}</td></tr>
          <tr><th>Sender</th><td>{preview.claim_sender}</td><td>{preview.receipt.sender_number_canonical ?? 'Unknown'}</td></tr>
          <tr><th>Amount</th><td>{money(preview.claim_amount_minor)}</td><td>{money(preview.accepted_amount_minor)}</td></tr>
          <tr><th>Time</th><td>{formatBangladeshTime(preview.order_created_at)} to {formatBangladeshTime(preview.claim_submitted_at)}</td>
            <td>{preview.receipt.occurred_at ? formatBangladeshTime(preview.receipt.occurred_at) : 'Unknown'}</td></tr>
        </tbody>
      </table>
      <p>Exceptions to accept: {preview.exceptions.join(', ') || 'None'}</p>
      {preview.blockers.length>0 ? <p role="alert">Cannot accept: {preview.blockers.join(', ')}. Resolve evidence or handle externally; receipts cannot be split.</p> :
        <p>Remaining COD after acceptance: {money(preview.actual_cod_minor!)}</p>}
      <form onSubmit={submit}>
        <label>Decision reason<textarea value={reason} maxLength={2000} required disabled={busy || retry || stale}
          onChange={e=>setReason(e.target.value)} /></label>
        <button type="submit" className="btn btn-primary" disabled={busy || stale || !reason.trim() || preview.blockers.length>0}>
          {retry ? 'Retry same approval' : 'Accept full receipt and confirm'}
        </button>
      </form>
    </>}
  </section>;
}
