import { useLocale } from '../locale/context';
import { formatBangladeshDateTime } from '../locale/format';
import { paymentExceptionCopy } from '../locale/paymentExceptionCopy';
import type { PaymentPreview } from './paymentDecisions';

const money = (minor: number) => `BDT ${(minor / 100).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function PaymentComparison({ preview, showTechnical }: {
  preview: PaymentPreview; showTechnical: boolean;
}) {
  const { locale } = useLocale();
  const text = paymentExceptionCopy[locale];
  const date = (value: string) => formatBangladeshDateTime(value, locale);
  const rows = [
    { field: text.provider, claim: `${preview.account_provider} / ${preview.claim_provider}`, seller: preview.receipt.provider },
    ...(showTechnical ? [{ field: text.account, claim: preview.payment_account_id, seller: preview.receipt.payment_account_id }] : []),
    { field: 'TrxID', claim: preview.claim_trx_id, seller: preview.receipt.trx_id },
    { field: text.sender, claim: preview.claim_sender, seller: preview.receipt.sender_number_canonical ?? text.unknown },
    { field: text.amount, claim: money(preview.claim_amount_minor), seller: money(preview.accepted_amount_minor) },
    { field: text.time, claim: `${date(preview.order_created_at)} ${text.to} ${date(preview.claim_submitted_at)}`,
      seller: preview.receipt.occurred_at ? date(preview.receipt.occurred_at) : text.unknown },
  ];

  return <div className="payment-table-wrap">
    <table className="payment-comparison-table" role="table">
      <caption>{text.caption}</caption>
      <thead><tr><th scope="col">{text.field}</th><th scope="col">{text.claim}</th><th scope="col">{text.seller}</th></tr></thead>
      <tbody>
        {rows.map(row => <tr key={row.field}>
          <th scope="row">{row.field}</th>
          <td><span className="payment-comparison-label" aria-hidden="true">{text.claim}</span>{row.claim}</td>
          <td><span className="payment-comparison-label" aria-hidden="true">{text.seller}</span>{row.seller}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
