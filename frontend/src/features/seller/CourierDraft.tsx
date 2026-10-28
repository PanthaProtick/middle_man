import { useLocale } from '../locale/context';
import { orderCreationCopy } from '../locale/orderCreationCopy';
import type { ParcelErrorCode } from './parcel';
import type { CourierMessage } from '../locale/courierCopy';
import { useCourierText } from '../locale/courierCopy';
import { useEffect, useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import { ParcelValidationError, MAX_PARCEL_QUANTITY, MAX_PARCEL_WEIGHT_GRAMS, parseParcelQuantity, parseParcelWeightKg } from './parcel';
import type { ParcelRevision } from './courierReviewTypes';
import { DeliverySummary } from './DeliverySummary';
import './DeliveryDetails.css';

const blockerLabels = {
  PARCEL_DETAILS_REQUIRED: 'Add parcel weight and quantity before booking.',
  COURIER_CONNECTION_REQUIRED: 'Connect your Pathao merchant account and choose a pickup store.',
  LOCATION_METADATA_REQUIRED: 'Select Pathao city, zone and area for this address.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed. Review its status before dispatch.',
} as const;

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

const fieldNames: Record<ParcelField, CourierMessage> = { weight: 'Weight', quantity: 'Quantity' };

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
  const t = useCourierText();
  const { locale } = useLocale();
  // Key the private state to its request identity so even the render before
  // effect cleanup cannot show the previous shop's proposal.
  const identity = `${token}:${orderId}`;
  const [state, setState] = useState<{ identity: string; proposal?: Proposal; error?: CourierMessage }>();
  const [inputs, setInputs] = useState<ParcelInputs>();
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<{ identity: string; message: CourierMessage | ParcelErrorCode; field: ParcelField | false }>();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (saveFailure?.identity === identity && saveFailure.field) {
      formRef.current?.querySelector<HTMLInputElement>(`#courier-${saveFailure.field}`)?.focus();
    }
  }, [saveFailure, identity]);
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
  const reportSaveError = (message: CourierMessage | ParcelErrorCode, field: ParcelField | false = false) => setSaveFailure({ identity, message, field });

  const save = async () => {
    if (!proposal || !parcelInputs || !editable) return;
    const body: { expected_version: number; parcel_weight_grams?: number; parcel_quantity?: number } = {
      // Only advance over selection-only writes; concurrent parcel changes must still conflict.
      expected_version: choicesSavedParcel?.parcel_weight_grams === proposal.parcel_weight_grams &&
        choicesSavedParcel?.parcel_quantity === proposal.parcel_quantity
        ? Math.max(proposal.version, choicesSavedParcel.version) : proposal.version,
    };
    let validatingField: ParcelField = 'weight';
    try {
      if (parcelInputs.weight.trim()) body.parcel_weight_grams = parseParcelWeightKg(parcelInputs.weight);
      validatingField = 'quantity';
      if (parcelInputs.quantity.trim()) body.parcel_quantity = parseParcelQuantity(parcelInputs.quantity);
    } catch (cause) {
      reportSaveError(cause instanceof ParcelValidationError ? cause.code : 'Parcel details could not be saved.', validatingField);
      return;
    }
    if (body.parcel_weight_grams === undefined && body.parcel_quantity === undefined) {
      reportSaveError('Enter a parcel weight or quantity to save.', 'weight');
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
        reportSaveError('Parcel details could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  return <section className="buyer-correction delivery-details" aria-label={t("Courier proposal")}>
    <h4>{t(reviewManaged ? 'Parcel details' : 'Local courier proposal')}</h4>
    {!reviewManaged && <p className="delivery-note">{t("Draft only. Review and submit to book with Pathao.")}</p>}
    {!current && <p role="status">{t("Loading courier proposal…")}</p>}
    {current?.error && (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
        <span>{t(current.error)}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setState(undefined); setSaveFailure(undefined); setAttempt(value => value + 1);
          }}
        >
          {t('Retry proposal')}
        </button>
      </div>
    )}
    {proposal && <>
      {!reviewManaged && <><DeliverySummary {...proposal} />
        <p className="delivery-note">{t("Payment acceptance does not independently verify receipt with the payment provider.")}</p></>}
      <p className="delivery-note">{t("Optional when creating the buyer link; both parcel fields are required before booking.")}</p>
      {proposal.missing_parcel_fields.length > 0
        ? <p id="courier-missing-parcel">{t("Missing parcel fields:")} {proposal.missing_parcel_fields.map(field => t(fieldNames[field])).join(', ')}</p>
        : <p id="courier-missing-parcel">{t("Parcel details complete for booking.")}</p>}
      {editable && parcelInputs && <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="parcel-fields">
          <div>
            <label htmlFor="courier-weight">{t("Parcel weight (kg)")}</label>
            <input
              id="courier-weight"
              name="parcelWeightKg"
              inputMode="decimal"
              type="text"
              min="0.001"
              max={MAX_PARCEL_WEIGHT_GRAMS / 1000}
              step="0.001"
              value={parcelInputs.weight}
              onChange={(event) => setInputs({ ...parcelInputs, weight: event.target.value })}
              disabled={saving}
              aria-invalid={saveError?.field === 'weight'}
              aria-describedby={`courier-missing-parcel${saveError?.field === 'weight' ? ' courier-parcel-error' : ''}`}
            />
          </div>
          <div>
            <label htmlFor="courier-quantity">{t("Parcel quantity")}</label>
            <input
              id="courier-quantity"
              name="parcelQuantity"
              inputMode="numeric"
              type="text"
              min="1"
              max={MAX_PARCEL_QUANTITY}
              step="1"
              value={parcelInputs.quantity}
              onChange={(event) => setInputs({ ...parcelInputs, quantity: event.target.value })}
              disabled={saving}
              aria-invalid={saveError?.field === 'quantity'}
              aria-describedby={`courier-missing-parcel${saveError?.field === 'quantity' ? ' courier-parcel-error' : ''}`}
            />
          </div>
        </div>
        {saveError && (
          <div
            id="courier-parcel-error"
            role="alert"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}
          >
            <span>{saveError.message in orderCreationCopy.en ? orderCreationCopy[locale][saveError.message as ParcelErrorCode] : t(saveError.message as CourierMessage)}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setState(undefined); setInputs(undefined); setSaveFailure(undefined);
                saveKeyRef.current = null; setAttempt(value => value + 1);
              }}
            >
              {t('Reload current details')}
            </button>
          </div>
        )}
        <button className="btn btn-secondary" type="submit" disabled={saving}>{t(saving ? 'Saving…' : 'Save parcel details')}</button>
      </form>}
      <ul>{proposal.blockers.filter(blocker => !reviewManaged ||
        blocker === 'PARCEL_DETAILS_REQUIRED' || blocker === 'ORDER_NOT_CONFIRMED')
        .map(blocker => <li key={blocker}>{t(blockerLabels[blocker])}</li>)}</ul>
    </>}
  </section>;
}
