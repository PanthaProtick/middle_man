import { useEffect, useState } from 'react';
import { requestJson } from './api';
import { useLocale } from '../locale/context';
import { formatCount, formatBangladeshDateTime, formatBdt } from '../locale/format';
import { historyText, historyError } from '../locale/historyCopy';
import { paymentReason } from '../locale/paymentExceptionCopy';

interface DecisionEvent {
  transaction_id: string;
  accepted_amount_minor: number;
  actual_cod_minor: number;
  exceptions: string[];
  reason: string;
  actor: string;
  created_at: string;
}
interface Summary { confirmed_count: number; manual_count: number; exception_count: number }

export function PaymentHistory({orderId,token}:{orderId:string;token:string}) {
  const { locale } = useLocale();
  const tr = (text: string) => historyText(locale, text);
  const [events,setEvents]=useState<DecisionEvent[]>([]);
  const [summary,setSummary]=useState<Summary | null>(null);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    Promise.all([
      requestJson<DecisionEvent[]>(`/api/seller/orders/${orderId}/payment-decisions`,{},token),
      requestJson<Summary>('/api/seller/payment-summary',{},token),
    ]).then(([history,counts])=>{if(active){setEvents(history);setSummary(counts);}})
      .catch(e=>{if(active)setError(historyError(e, 'Payment history unavailable'));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[orderId,token,attempt]);
  return <section className="buyer-correction" lang={locale} aria-label={tr("Accepted payment history")}>
    <h4>{tr("Accepted payment history")}</h4>
    {loading && <p role="status">{tr("Loading decision history…")}</p>}
    {error && (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
        <span>{tr(error)}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setError(''); setLoading(true); setAttempt(a => a + 1); }}
        >
          {tr("Retry history")}
        </button>
      </div>
    )}
    {!loading && !error && events.length === 0 && <p>{tr("No accepted payment decisions yet.")}</p>}
    {events.map(event=><article key={event.created_at}>
      <p>{tr("Accepted advance")}: {formatBdt(event.accepted_amount_minor)} · {tr("Remaining COD")}: {formatBdt(event.actual_cod_minor)}</p>
      <p>{tr('Accepted exceptions')}: {event.exceptions.map(code => paymentReason(code, locale)).join(', ') || tr('None')}</p>
      <p>{tr("Reason")}: {event.reason}</p>
      <p>{tr("Seller")}: {event.actor} · {formatBangladeshDateTime(event.created_at, locale)}</p>
    </article>)}
    {summary && <p>{tr("Shop totals")}: {formatCount(summary.confirmed_count)} {tr("confirmed")} · {formatCount(summary.manual_count)} {tr("manual acceptances")} · {formatCount(summary.exception_count)} {tr("accepted exception orders")}</p>}
  </section>;
}
