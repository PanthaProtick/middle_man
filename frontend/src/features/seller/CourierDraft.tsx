import { useEffect, useState } from 'react';
import { requestJson, SellerApiError } from './api';

const blockerLabels = {
  PARCEL_DETAILS_REQUIRED: 'Add parcel type, weight, quantity and description before booking.',
  COURIER_CONNECTION_REQUIRED: 'Connect your Pathao merchant account and choose a pickup store.',
  LOCATION_METADATA_REQUIRED: 'Select Pathao city, zone and area for this address.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed. Review its status before dispatch.',
};

interface Proposal {
  order_id: string;
  status: 'local_proposal';
  recipient_name: string;
  contact_number: string;
  address: string;
  remaining_cod_minor: number;
  blockers: (keyof typeof blockerLabels)[];
}

export function CourierDraft({ orderId, token }: { orderId: string; token: string }) {
  // Key the private state to its request identity so even the render before
  // effect cleanup cannot show the previous shop's proposal.
  const identity = `${token}:${orderId}`;
  const [state, setState] = useState<{ identity: string; proposal?: Proposal; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    requestJson<Proposal>(`/api/seller/orders/${orderId}/courier-draft`, {}, token)
      .then(proposal => { if (active) setState({ identity, proposal }); })
      .catch((cause: unknown) => {
        if (active) setState({ identity, error: cause instanceof SellerApiError && [401, 403].includes(cause.status)
          ? 'Courier proposal access denied. Sign in with the owning seller account.'
          : 'Courier proposal unavailable. Retry or reopen the order.' });
      });
    return () => { active = false; };
  }, [orderId, token, identity, attempt]);
  const current = state?.identity === identity ? state : undefined;
  return <section className="buyer-correction" aria-label="Courier proposal">
    <h4>Local courier proposal</h4>
    <p>This is a local proposal awaiting seller review, not an accepted Pathao booking.
      Payment acceptance does not independently verify receipt with the payment provider.</p>
    {!current && <p role="status">Loading courier proposal…</p>}
    {current?.error && <p role="alert">{current.error} <button type="button" onClick={() => {
      setState(undefined); setAttempt(value => value + 1);
    }}>Retry proposal</button></p>}
    {current?.proposal && <>
      <p>{current.proposal.recipient_name} · {current.proposal.contact_number}</p>
      <p>{current.proposal.address}</p>
      <p>Remaining COD: BDT {(current.proposal.remaining_cod_minor / 100).toFixed(2)}</p>
      <ul>{current.proposal.blockers.map(blocker => <li key={blocker}>{blockerLabels[blocker]}</li>)}</ul>
    </>}
  </section>;
}
