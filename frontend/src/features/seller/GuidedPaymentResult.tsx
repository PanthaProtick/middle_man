import { useState } from 'react';
import { guidedPaymentCopy } from '../locale/guidedPaymentCopy';
import type { Locale } from '../locale/storage';
import { fetchOrder } from './api';
import { formatOrderAmount } from './orderNumbers';
import type { RecordedTransactionResult, SellerOrder } from './types';

interface Props {
  result: RecordedTransactionResult;
  locale: Locale;
  token?: string;
  onOpenOrder: (order: SellerOrder) => void;
  onOpenPayment: (receiptId: string) => void;
}

export function GuidedPaymentResult({ result, locale, token, onOpenOrder, onOpenPayment }: Props): React.JSX.Element {
  const text = guidedPaymentCopy[locale];
  const { receipt, allocated_order_ids: orderIds } = result;
  const latest = receipt.observations[receipt.observations.length - 1];
  const duplicate = !receipt.has_conflict && latest?.conflict_state === 'identical';
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return <section aria-label={text.recorded}>
    <h4>{text.recorded}</h4>
    <p>{text.receiptId}: {receipt.id}</p>
    <p>{text.receipt}: {receipt.trx_id}</p>
    <p>{text.provider}: {receipt.provider.toUpperCase()}</p>
    <p>{text.amountLine}: BDT {formatOrderAmount(receipt.amount_minor)}</p>
    {receipt.has_conflict ? <p role="alert">{text.conflicted}</p>
      : orderIds.length > 0 ? <>
        <p>{text.confirmedOrder}</p>
        {orderIds.map(orderId => <button key={orderId} type="button" className="btn btn-primary"
          disabled={opening === orderId} onClick={() => {
            setOpening(orderId); setFailed(false);
            void fetchOrder(orderId, token).then(onOpenOrder, () => setFailed(true)).finally(() => setOpening(null));
          }}>{text.openOrder}</button>)}
      </>
      : duplicate ? <p role="status">{text.duplicate}</p>
      : receipt.reconciliation_state === 'used' ? <p>{text.used}</p>
      : <p>{text.unmatched}</p>}
    <p>{text.notVerified}</p>
    <button type="button" className="btn btn-secondary"
      onClick={() => onOpenPayment(receipt.id)}>{text.openPayment}</button>
    {failed && <p role="alert">{text.openFailed}</p>}
  </section>;
}
