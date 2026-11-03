import { useEffect, useState } from 'react';
import { guidedOrderCopy } from '../locale/guidedOrderCopy';
import type { Locale } from '../locale/storage';
import type { SellerOrder } from './types';
import { fetchOrder } from './api';
import { AssistantResult } from './AssistantResult';
import { formatOrderAmount } from './orderNumbers';

interface Props { order: SellerOrder; locale: Locale; token?: string; onOpenOrder: (order: SellerOrder) => void }
export function GuidedOrderResult({ order, locale, token, onOpenOrder }: Props): React.JSX.Element {
  const text = guidedOrderCopy[locale];
  const [copy, setCopy] = useState<'copy' | 'copied' | 'copyFailed'>('copy');
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (copy !== 'copied') return;
    const timer = setTimeout(() => setCopy('copy'), 2500);
    return () => clearTimeout(timer);
  }, [copy]);
  const link = new URL(order.portal_url, window.location.origin).href;
  return <AssistantResult label={text.succeeded}>
    <h4>{text.succeeded}</h4><p>{order.product_name} · {order.id}</p>
    <p>{text.total}: <span className="assistant-numeric">BDT {formatOrderAmount(order.total_minor)}</span></p>
    <p>{text.advance}: <span className="assistant-numeric">BDT {formatOrderAmount(order.required_advance_minor)}</span></p>
    <p>{text.remainingCod}: <span className="assistant-numeric">BDT {formatOrderAmount(order.expected_cod_minor)}</span></p>
    <p>{text.account}: {order.account_label} · {order.account_provider} · <span className="assistant-numeric">{order.account_receiving_number}</span></p>
    <a href={link} target="_blank" rel="noreferrer">{link}</a>
    <button type="button" className="btn btn-secondary" onClick={() => {
      void (async () => {
        setCopy('copy');
        try { await navigator.clipboard.writeText(link); setCopy('copied'); }
        catch { setCopy('copyFailed'); }
      })();
    }}>{text.copy}</button>
    {copy !== 'copy' && <p role="status">{text[copy]}</p>}
    <button type="button" className="btn btn-primary" disabled={opening} onClick={() => {
      setOpening(true); setFailed(false);
      void fetchOrder(order.id, token).then(onOpenOrder, () => setFailed(true)).finally(() => setOpening(false));
    }}>{text.open}</button>
    {failed && <p role="alert">{text.failed}</p>}
  </AssistantResult>;
}
