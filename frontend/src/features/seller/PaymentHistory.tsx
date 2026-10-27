import { useEffect, useState } from 'react';
import { requestJson, formatBangladeshTime } from './api';

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
      .catch(e=>{if(active)setError(e instanceof Error ? e.message : 'Payment history unavailable');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[orderId,token,attempt]);
  return <section className="buyer-correction" aria-label="Accepted payment history">
    <h4>Accepted payment history</h4>
    {loading && <p role="status">Loading decision history…</p>}
    {error && (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
        <span>{error}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setError(''); setLoading(true); setAttempt(a => a + 1); }}
        >
          Retry history
        </button>
      </div>
    )}
    {events.map(event=><article key={event.created_at}>
      <p>Accepted advance: BDT {(event.accepted_amount_minor/100).toFixed(2)} · Remaining COD: BDT {(event.actual_cod_minor/100).toFixed(2)}</p>
      <p>Accepted exceptions: {event.exceptions.join(', ') || 'None'}</p>
      <p>Reason: {event.reason}</p>
      <p>Seller: {event.actor} · {formatBangladeshTime(event.created_at)}</p>
    </article>)}
    {summary && <p>Shop totals: {summary.confirmed_count} confirmed · {summary.manual_count} manual acceptances · {summary.exception_count} accepted exception orders</p>}
  </section>;
}
