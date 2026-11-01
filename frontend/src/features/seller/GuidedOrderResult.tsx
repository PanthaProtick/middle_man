import { useState } from 'react';
import { guidedOrderCopy } from '../locale/guidedOrderCopy';
import type { Locale } from '../locale/storage';
import type { SellerOrder } from './types';
import { fetchOrder } from './api';

interface Props { order: SellerOrder; locale: Locale; token?: string; onOpenOrder: (order: SellerOrder) => void }
export function GuidedOrderResult({ order, locale, token, onOpenOrder }: Props): React.JSX.Element {
  const text = guidedOrderCopy[locale];
  const [copy, setCopy] = useState<'copy' | 'copied' | 'copyFailed'>('copy');
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const link = new URL(order.portal_url, window.location.origin).href;
  return <section aria-label={text.succeeded}>
    <h4>{text.succeeded}</h4><p>{order.product_name} · {order.id}</p>
    <a href={link} target="_blank" rel="noreferrer">{link}</a>
    <button type="button" className="btn btn-secondary" onClick={() => {
      void (async () => {
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
  </section>;
}
