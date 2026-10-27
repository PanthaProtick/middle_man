interface Props {
  recipient_name: string;
  contact_number: string;
  address: string;
  remaining_cod_minor: number;
}

export function DeliverySummary({ recipient_name, contact_number, address, remaining_cod_minor }: Props) {
  return <dl className="delivery-summary">
    <div><dt>Recipient</dt><dd>{recipient_name}<span>{contact_number}</span></dd></div>
    <div className="delivery-summary-address"><dt>Delivery address</dt><dd>{address}</dd></div>
    <div><dt>Collect on delivery</dt><dd className="delivery-summary-amount">BDT {(remaining_cod_minor / 100).toFixed(2)}</dd></div>
  </dl>;
}
