import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { fetchTransactions, SellerApiError } from './api';
import { useLocale } from '../locale/context';
import { formatBangladeshDateTime } from '../locale/format';
import { paymentExceptionCopy, paymentReason } from '../locale/paymentExceptionCopy';
import { acceptPayment, previewPayment } from './paymentDecisions';
import type { PaymentDecision, PaymentPreview } from './paymentDecisions';
import type { ReceiptView, SellerOrder } from './types';
import './PaymentReview.css';
import './PaymentException.css';

const money = (minor: number) => `BDT ${(minor / 100).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function PaymentException({orderId, token, onAccepted, onPreviewChange}: {
  orderId: string; token: string; onAccepted: (order: SellerOrder) => void;
  onPreviewChange?: (receiptId: string, preview: PaymentPreview | null) => void;
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
    onPreviewChange?.(id, null);
    if(!id)return;
    setBusy(true);
    try {const data = await previewPayment(orderId,id,token);if(request===sequence.current.value){
      setPreview(data);onPreviewChange?.(id, data);
    }}
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
      if(e instanceof SellerApiError && e.status>=400 && e.status<500){pending.current=null;setRetry(false);setStale(true);onPreviewChange?.(receiptId, null);}
      else setRetry(true);}
    finally{setBusy(false);}
  }

  return <section className="payment-exception" lang={locale} aria-label={text.title}>
    <div className="payment-review-head">
      <h4 className="payment-review-title">{text.title}</h4>
      <span className="payment-review-badge">{text.receipt}</span>
    </div>
    <p className="payment-review-intro">{text.intro}</p>
    {error && <p role="alert" className="payment-review-alert">{text[error as keyof Pick<typeof text, 'unauthorized' | 'stale' | 'unavailable'>]}</p>}

    <div className="payment-receipt-picker">
      <label className="payment-review-field">{text.receipt}
        <select value={receiptId} disabled={busy || retry} onChange={e => void loadPreview(e.target.value)}>
          <option value=""> {text.select}</option>
          {receipts.map(r => <option key={r.id} value={r.id}>{r.provider} · {r.trx_id} · {money(r.amount_minor)}</option>)}
        </select>
      </label>
      {cursor && <button type="button" className="btn btn-secondary btn-sm" disabled={busy || retry} onClick={async () => {
        setBusy(true);try{const data=await fetchTransactions({cursor},token);setReceipts(old=>[...old,...data.items]);setCursor(data.next_cursor ?? null);}
        catch(e){setError(message(e));}finally{setBusy(false);}
      }}> {text.more}</button>}
    </div>

    {(busy || (receiptId && !retry)) && <div className="payment-review-actions">
      {busy && <p role="status" className="payment-review-status"> {text.loading}</p>}
      {receiptId && !retry && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>void loadPreview(receiptId)}> {text.refresh}</button>}
    </div>}

    {preview && <>
      <div className="payment-preview-summary">
        <p className="payment-preview-totals">
          <span>{text.total}</span> <strong>{money(preview.total_minor)}</strong>
          <span className="payment-preview-separator">·</span>
          <span>{text.advance}</span> <strong>{money(preview.required_advance_minor)}</strong>
        </p>
        <button
          type="button"
          className="payment-technical-toggle"
          onClick={() => setShowTechnical(!showTechnical)}
          aria-expanded={showTechnical}
        >
          {showTechnical ? text.hide : text.show}
        </button>
      </div>

      <div className="payment-table-wrap">
        <table className="payment-comparison-table">
          <caption>{text.caption}</caption>
          <thead><tr><th scope="col">{text.field}</th><th scope="col">{text.claim}</th><th scope="col">{text.seller}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{text.provider}</th><td>{preview.account_provider} / {preview.claim_provider}</td><td>{preview.receipt.provider}</td></tr>
            {showTechnical && <tr><th scope="row">{text.account}</th><td>{preview.payment_account_id}</td><td>{preview.receipt.payment_account_id}</td></tr>}
            <tr><th scope="row">TrxID</th><td>{preview.claim_trx_id}</td><td>{preview.receipt.trx_id}</td></tr>
            <tr><th scope="row">{text.sender}</th><td>{preview.claim_sender}</td><td>{preview.receipt.sender_number_canonical ?? text.unknown}</td></tr>
            <tr><th scope="row">{text.amount}</th><td>{money(preview.claim_amount_minor)}</td><td>{money(preview.accepted_amount_minor)}</td></tr>
            <tr><th scope="row">{text.time}</th><td>{date(preview.order_created_at)} {text.to} {date(preview.claim_submitted_at)}</td>
              <td>{preview.receipt.occurred_at ? date(preview.receipt.occurred_at) : text.unknown}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="payment-exception-block">
        <h5 className="payment-exception-title">{text.exceptions}</h5>
        {preview.exceptions.length > 0
          ? <ul className="payment-chip-list">{preview.exceptions.map(code => <li key={code} className="payment-chip" data-tone="amber">{paymentReason(code, locale)}</li>)}</ul>
          : <p className="payment-none">{text.none}</p>}
      </div>

      {preview.blockers.length>0 ? <p role="alert" className="payment-blocked">{text.blocked}: {preview.blockers.map(code => paymentReason(code, locale)).join(', ')}. {text.resolve}</p> :
        <p className="payment-cod">{text.cod}: {money(preview.actual_cod_minor!)}</p>}

      <form className="payment-decision-form" onSubmit={submit}>
        <label className="payment-review-field">{text.reason}<textarea value={reason} maxLength={2000} required disabled={busy || retry || stale}
          onChange={e=>setReason(e.target.value)} /></label>
        <button type="submit" className="btn btn-primary payment-accept" disabled={busy || stale || !reason.trim() || preview.blockers.length>0}>
          {retry ? text.retry : text.accept}
        </button>
      </form>
    </>}
  </section>;
}
