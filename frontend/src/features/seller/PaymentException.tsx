import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { fetchTransactions, SellerApiError } from './api';
import { useLocale } from '../locale/context';
import { formatBangladeshDateTime } from '../locale/format';
import { paymentExceptionCopy, paymentReason } from '../locale/paymentExceptionCopy';
import { acceptPayment, previewPayment } from './paymentDecisions';
import type { PaymentDecision, PaymentPreview } from './paymentDecisions';
import type { ReceiptView, SellerOrder } from './types';

const money = (minor: number) => `BDT ${(minor / 100).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function PaymentException({orderId, token, onAccepted}: {
  orderId: string; token: string; onAccepted: (order: SellerOrder) => void;
}) {
  const { locale } = useLocale();
  const text = paymentExceptionCopy[locale];
  const date = (value: string) => formatBangladeshDateTime(value, locale);
  const message = (error: unknown) => error instanceof SellerApiError && error.code === 'UNAUTHORIZED' ? 'unauthorized' : error instanceof SellerApiError && error.code === 'STALE_VERSION' ? 'stale' : 'unavailable';
  const [receipts,setReceipts] = useState<ReceiptView[]>([]);
  const [cursor,setCursor] = useState<string | null>(null);
  const [receiptId,setReceiptId] = useState('');
  const [preview,setPreview] = useState<PaymentPreview | null>(null);
  const [reason,setReason] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(false);
  const [stale,setStale] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const pending = useRef<{payload:PaymentDecision;key:string} | null>(null);
  const sequence = useRef({value:0});

  useEffect(() => {
    let active = true;
    const requests = sequence.current;
    fetchTransactions({},token).then(data => {if(active){setReceipts(data.items);setCursor(data.next_cursor ?? null);}})
      .catch(e => {if(active)setError(message(e));});
    return () => {active=false;requests.value++;};
  },[token]);

  async function loadPreview(id: string) {
    const request = ++sequence.current.value;
    setReceiptId(id);setPreview(null);setError('');setStale(false);
    if(!id)return;
    setBusy(true);
    try {const data = await previewPayment(orderId,id,token);if(request===sequence.current.value)setPreview(data);}
    catch(e){if(request===sequence.current.value)setError(message(e));}
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
    catch(e){setError(message(e));
      if(e instanceof SellerApiError && e.status>=400 && e.status<500){pending.current=null;setRetry(false);setStale(true);}
      else setRetry(true);}
    finally{setBusy(false);}
  }

  return <section className="buyer-correction" aria-label={text.title}>
    <h4>{text.title}</h4>
    <p>{text.intro}</p>
    {error && <p role="alert">{text[error as keyof Pick<typeof text, 'unauthorized' | 'stale' | 'unavailable'>]}</p>}
    <label>{text.receipt}
      <select value={receiptId} disabled={busy || retry} onChange={e => void loadPreview(e.target.value)}>
        <option value=""> {text.select}</option>
        {receipts.map(r => <option key={r.id} value={r.id}>{r.provider} · {r.trx_id} · {money(r.amount_minor)}</option>)}
      </select>
    </label>
    {cursor && <button type="button" disabled={busy || retry} onClick={async () => {
      setBusy(true);try{const data=await fetchTransactions({cursor},token);setReceipts(old=>[...old,...data.items]);setCursor(data.next_cursor ?? null);}
      catch(e){setError(message(e));}finally{setBusy(false);}
    }}> {text.more}</button>}
    {busy && <p role="status"> {text.loading}</p>}
    {receiptId && !retry && <button type="button" disabled={busy} onClick={()=>void loadPreview(receiptId)}> {text.refresh}</button>}
    {preview && <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
        <p style={{ margin: 0 }}>{text.total}: {money(preview.total_minor)} · {text.advance}: {money(preview.required_advance_minor)}</p>
        <button
          type="button"
          onClick={() => setShowTechnical(!showTechnical)}
          style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
          aria-expanded={showTechnical}
        >
          {showTechnical ? text.hide : text.show}
        </button>
      </div>
      <table><caption>{text.caption}</caption>
        <thead><tr><th>{text.field}</th><th>{text.claim}</th><th>{text.seller}</th></tr></thead>
        <tbody>
          <tr><th>{text.provider}</th><td>{preview.account_provider} / {preview.claim_provider}</td><td>{preview.receipt.provider}</td></tr>
          <tr style={{ display: showTechnical ? 'table-row' : 'none' }}><th>{text.account}</th><td>{preview.payment_account_id}</td><td>{preview.receipt.payment_account_id}</td></tr>
          <tr><th>TrxID</th><td>{preview.claim_trx_id}</td><td>{preview.receipt.trx_id}</td></tr>
          <tr><th>{text.sender}</th><td>{preview.claim_sender}</td><td>{preview.receipt.sender_number_canonical ?? text.unknown}</td></tr>
          <tr><th>{text.amount}</th><td>{money(preview.claim_amount_minor)}</td><td>{money(preview.accepted_amount_minor)}</td></tr>
          <tr><th>{text.time}</th><td>{date(preview.order_created_at)} {text.to} {date(preview.claim_submitted_at)}</td>
            <td>{preview.receipt.occurred_at ? date(preview.receipt.occurred_at) : text.unknown}</td></tr>
        </tbody>
      </table>
      <p>{text.exceptions}: {preview.exceptions.map(code => paymentReason(code, locale)).join(', ') || text.none}</p>
      {preview.blockers.length>0 ? <p role="alert">{text.blocked}: {preview.blockers.map(code => paymentReason(code, locale)).join(', ')}. {text.resolve}</p> :
        <p>{text.cod}: {money(preview.actual_cod_minor!)}</p>}
      <form onSubmit={submit}>
        <label>{text.reason}<textarea value={reason} maxLength={2000} required disabled={busy || retry || stale}
          onChange={e=>setReason(e.target.value)} /></label>
        <button type="submit" className="btn btn-primary" disabled={busy || stale || !reason.trim() || preview.blockers.length>0}>
          {retry ? text.retry : text.accept}
        </button>
      </form>
    </>}
  </section>;
}
