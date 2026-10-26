import { useEffect, useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import { MAX_PARCEL_QUANTITY, MAX_PARCEL_WEIGHT_GRAMS, parseParcelQuantity, parseParcelWeightKg } from './parcel';
import type { ParcelRevision } from './courierReviewTypes';

const blockerLabels = {
  PARCEL_DETAILS_REQUIRED: 'Add parcel weight and quantity before booking.',
  COURIER_CONNECTION_REQUIRED: 'Connect your Pathao merchant account and choose a pickup store.',
  LOCATION_METADATA_REQUIRED: 'Select Pathao city, zone and area for this address.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed. Review its status before dispatch.',
};

type ParcelField = 'weight' | 'quantity';
type Blocker = keyof typeof blockerLabels;

interface Proposal {
  order_id: string;
  status: 'local_proposal';
  version: number;
  recipient_name: string;
  contact_number: string;
  address: string;
  remaining_cod_minor: number;
  parcel_weight_grams: number | null;
  parcel_quantity: number | null;
  missing_parcel_fields: ParcelField[];
  blockers: Blocker[];
}

interface ParcelInputs {
  identity: string;
  version: number;
  weight: string;
  quantity: string;
}

const fieldNames: Record<ParcelField, string> = { weight: 'Weight', quantity: 'Quantity' };

function accessDenied(cause: unknown): boolean {
  return cause instanceof SellerApiError && [401, 403].includes(cause.status);
}

function inputsFrom(identity: string, proposal: Proposal): ParcelInputs {
  return {
    identity,
    version: proposal.version,
    weight: proposal.parcel_weight_grams === null ? '' : String(proposal.parcel_weight_grams / 1000),
    quantity: proposal.parcel_quantity === null ? '' : String(proposal.parcel_quantity),
  };
}

export function CourierDraft({ orderId, token, onSaved, reviewManaged = false, choicesSavedParcel }: {
  orderId: string; token: string; onSaved?: () => void; reviewManaged?: boolean; choicesSavedParcel?: ParcelRevision;
}) {
  // Key the private state to its request identity so even the render before
  // effect cleanup cannot show the previous shop's proposal.
  const identity = `${token}:${orderId}`;
  const [state, setState] = useState<{ identity: string; proposal?: Proposal; error?: string }>();
  const [inputs, setInputs] = useState<ParcelInputs>();
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<{ identity: string; message: string; field: boolean }>();
  const saveKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    requestJson<Proposal>(`/api/seller/orders/${orderId}/courier-draft`, {}, token)
      .then(proposal => {
        if (!active) return;
        setState({ identity, proposal });
        setInputs(current => current?.identity === identity && current.version === proposal.version
          ? current : inputsFrom(identity, proposal));
      })
      .catch((cause: unknown) => {
        if (active) setState({ identity, error: accessDenied(cause)
          ? 'Courier proposal access denied. Sign in with the owning seller account.'
          : 'Courier proposal unavailable. Retry or reopen the order.' });
      });
    return () => { active = false; };
  }, [orderId, token, identity, attempt]);
  const current = state?.identity === identity ? state : undefined;
  const proposal = current?.proposal;
  const parcelInputs = inputs?.identity === identity && inputs.version === proposal?.version ? inputs : undefined;
  const editable = proposal !== undefined && !proposal.blockers.includes('ORDER_NOT_CONFIRMED');
  const saveError = saveFailure?.identity === identity ? saveFailure : undefined;
  const reportSaveError = (message: string, field = false) => setSaveFailure({ identity, message, field });

  const save = async () => {
    if (!proposal || !parcelInputs || !editable) return;
    const body: { expected_version: number; parcel_weight_grams?: number; parcel_quantity?: number } = {
      // Only advance over selection-only writes; concurrent parcel changes must still conflict.
      expected_version: choicesSavedParcel?.parcel_weight_grams === proposal.parcel_weight_grams &&
        choicesSavedParcel?.parcel_quantity === proposal.parcel_quantity
        ? Math.max(proposal.version, choicesSavedParcel.version) : proposal.version,
    };
    try {
      if (parcelInputs.weight.trim()) body.parcel_weight_grams = parseParcelWeightKg(parcelInputs.weight);
      if (parcelInputs.quantity.trim()) body.parcel_quantity = parseParcelQuantity(parcelInputs.quantity);
    } catch (cause) {
      reportSaveError(cause instanceof Error ? cause.message : 'Parcel details are invalid', true);
      return;
    }
    if (body.parcel_weight_grams === undefined && body.parcel_quantity === undefined) {
      reportSaveError('Enter a parcel weight or quantity to save.', true);
      return;
    }
    setSaving(true);
    setSaveFailure(undefined);
    const fingerprint = JSON.stringify({ identity, version: proposal.version, body });
    if (saveKeyRef.current?.fingerprint !== fingerprint) {
      saveKeyRef.current = { fingerprint, key: crypto.randomUUID() };
    }
    try {
      const updated = await requestJson<Proposal>(
        `/api/seller/orders/${orderId}/courier-draft`,
        { method: 'PATCH', body: JSON.stringify(body) },
        token,
        saveKeyRef.current.key,
      );
      saveKeyRef.current = null;
      setState({ identity, proposal: updated });
      setInputs(inputsFrom(identity, updated));
      onSaved?.();
    } catch (cause) {
      if (cause instanceof SellerApiError && cause.code === 'STALE_VERSION') {
        reportSaveError('Courier details changed. Reload the current values before saving again.');
      } else if (accessDenied(cause)) {
        reportSaveError('Parcel update denied. Sign in with the owning seller account.');
      } else {
        reportSaveError(cause instanceof Error ? cause.message : 'Parcel details could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  return <section className="buyer-correction" aria-label="Courier proposal">
    <h4>Local courier proposal</h4>
    <p>This is a local proposal awaiting seller review, not an accepted Pathao booking.
      Payment acceptance does not independently verify receipt with the payment provider.</p>
    {!current && <p role="status">Loading courier proposal…</p>}
    {current?.error && <p role="alert">{current.error} <button type="button" onClick={() => {
      setState(undefined); setSaveFailure(undefined); setAttempt(value => value + 1);
    }}>Retry proposal</button></p>}
    {proposal && <>
      <p>{proposal.recipient_name} · {proposal.contact_number}</p>
      <p>{proposal.address}</p>
      <p>Remaining COD: BDT {(proposal.remaining_cod_minor / 100).toFixed(2)}</p>
      <p>Optional when creating the buyer link; both parcel fields are required before booking.</p>
      {proposal.missing_parcel_fields.length > 0
        ? <p id="courier-missing-parcel">Missing parcel fields: {proposal.missing_parcel_fields.map(field => fieldNames[field]).join(', ')}</p>
        : <p id="courier-missing-parcel">Parcel details complete for booking.</p>}
      {editable && parcelInputs && <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
          <div>
            <label htmlFor="courier-weight">Parcel weight (kg)</label>
            <input
              id="courier-weight"
              name="parcelWeightKg"
              type="number"
              min="0.001"
              max={MAX_PARCEL_WEIGHT_GRAMS / 1000}
              step="0.001"
              value={parcelInputs.weight}
              onChange={(event) => setInputs({ ...parcelInputs, weight: event.target.value })}
              disabled={saving}
              aria-invalid={saveError?.field === true}
              aria-describedby={`courier-missing-parcel${saveError?.field ? ' courier-parcel-error' : ''}`}
            />
          </div>
          <div>
            <label htmlFor="courier-quantity">Parcel quantity</label>
            <input
              id="courier-quantity"
              name="parcelQuantity"
              type="number"
              min="1"
              max={MAX_PARCEL_QUANTITY}
              step="1"
              value={parcelInputs.quantity}
              onChange={(event) => setInputs({ ...parcelInputs, quantity: event.target.value })}
              disabled={saving}
              aria-invalid={saveError?.field === true}
              aria-describedby={`courier-missing-parcel${saveError?.field ? ' courier-parcel-error' : ''}`}
            />
          </div>
        </div>
        {saveError && <p id="courier-parcel-error" role="alert">{saveError.message} <button type="button" onClick={() => {
          setState(undefined); setInputs(undefined); setSaveFailure(undefined);
          saveKeyRef.current = null; setAttempt(value => value + 1);
        }}>Reload current details</button></p>}
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save parcel details'}</button>
      </form>}
      <ul>{proposal.blockers.filter(blocker => !reviewManaged ||
        blocker === 'PARCEL_DETAILS_REQUIRED' || blocker === 'ORDER_NOT_CONFIRMED')
        .map(blocker => <li key={blocker}>{blockerLabels[blocker]}</li>)}</ul>
    </>}
  </section>;
}
