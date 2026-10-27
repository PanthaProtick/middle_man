import { useEffect, useRef, useState } from 'react';
import { requestJson } from './api';
import type { CourierAttemptStatus, ParcelRevision, Review, ReviewChoices } from './courierReviewTypes';
import { CourierReconciliation } from './CourierReconciliation';
import { CourierReviewLocations } from './CourierReviewLocations';

const blockerLabels: Record<string, string> = {
  PARCEL_DETAILS_REQUIRED: 'Save explicit parcel weight and quantity above.',
  COURIER_CONNECTION_REQUIRED: 'Connect your merchant account in Pathao settings.',
  PICKUP_STORE_REQUIRED: 'Choose an active pickup store for this connection.',
  SERVICE_REQUIRED: 'Choose a supported delivery service.',
  LOCATION_METADATA_REQUIRED: 'Resolve the destination and supported delivery coverage.',
  LOCATION_CHOICES_INVALID: 'Choose destination IDs from their current city and zone.',
  METADATA_UNAVAILABLE: 'Metadata could not be validated. Retry after restoring the connection.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed.',
};

export function CourierReview({ orderId, token, refresh = 0, onChoicesSaved, onReviewLoaded, onAttemptStatusChanged }: {
  orderId: string; token: string; refresh?: number; onChoicesSaved?: (parcel: ParcelRevision) => void;
  onReviewLoaded?: (review: Review) => void;
  onAttemptStatusChanged?: (status: CourierAttemptStatus | null) => void;
}) {
  const identity = `${orderId}:${token}:${refresh}`;
  const currentIdentity = useRef(identity);
  const onReviewLoadedRef = useRef(onReviewLoaded);
  useEffect(() => { onReviewLoadedRef.current = onReviewLoaded; }, [onReviewLoaded]);
  const statusCallback = useRef(onAttemptStatusChanged);
  useEffect(() => { statusCallback.current = onAttemptStatusChanged; }, [onAttemptStatusChanged]);
  const generation = useRef(0);
  useEffect(() => { currentIdentity.current = identity; generation.current += 1; }, [identity]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ identity: string; review?: Review; error?: string }>();
  const [editing, setEditing] = useState<{ identity: string; choices: ReviewChoices }>();
  const [busyIdentity, setBusy] = useState<string>();
  const busy = busyIdentity === identity;
  const path = `/api/seller/orders/${orderId}/courier-review`;
  useEffect(() => {
    let active = true;
    statusCallback.current?.(null);
    requestJson<Review>(path, {}, token).then(review => {
      if (active) {
        setState({ identity, review });
        setEditing({ identity, choices: review.choices });
        onReviewLoadedRef.current?.(review);
        statusCallback.current?.(review.latest_attempt?.status ?? 'unsubmitted');
      }
    }).catch(() => { if (active) setState({ identity, error: 'Review unavailable. Reload current details.' }); });
    return () => { active = false; generation.current += 1; };
  }, [path, token, identity, attempt]);
  const review = state?.identity === identity ? state.review : undefined;
  const choices = editing?.identity === identity ? editing.choices : undefined;
  const dirty = review && choices && JSON.stringify(review.choices) !== JSON.stringify(choices);
  const target = review?.choices?.environment === 'sandbox' ? 'Pathao sandbox' : 'Pathao (simulated)';

  const mutate = async (method: 'PUT' | 'POST') => {
    if (!review || !choices || busy) return;
    const requestGeneration = generation.current;
    setBusy(identity);
    try {
      const updated = await requestJson<Review>(path, { method, body: JSON.stringify({
        expected_token: review.token, ...(method === 'PUT' ? choices : {}),
      }) }, token);
      if (currentIdentity.current !== identity || generation.current !== requestGeneration) return;
      setState({ identity, review: updated }); setEditing({ identity, choices: updated.choices });
      onReviewLoadedRef.current?.(updated);
      statusCallback.current?.(updated.latest_attempt?.status ?? 'unsubmitted');
      if (method === 'PUT') onChoicesSaved?.(updated.draft);
    } catch {
      if (currentIdentity.current === identity && generation.current === requestGeneration) {
        setState({ identity, error: 'Details changed or could not be validated. Reload and review current details.' });
      }
    } finally {
      if (currentIdentity.current === identity && generation.current === requestGeneration) setBusy(undefined);
    }
  };

  const submitBooking = async () => {
    if (!review || busy || !review.submission_enabled) return;
    statusCallback.current?.('submitting');
    const requestGeneration = generation.current;
    setBusy(identity);
    try {
      const updated = await requestJson<Review>(
        `/api/seller/orders/${orderId}/courier-submission`,
        {
          method: 'POST',
          body: JSON.stringify({ expected_token: review.token }),
        },
        token,
        'submit-' + crypto.randomUUID(),
      );
      if (currentIdentity.current !== identity || generation.current !== requestGeneration) return;
      setState({ identity, review: updated });
      setEditing({ identity, choices: updated.choices });
      onReviewLoadedRef.current?.(updated);
      statusCallback.current?.(updated.latest_attempt?.status ?? 'unsubmitted');
    } catch (err: unknown) {
      if (currentIdentity.current === identity && generation.current === requestGeneration) {
        const errorObj = err as { message?: string };
        const msg = errorObj?.message || 'Submission could not be completed. Reload current details.';
        setState({ identity, error: msg });
        statusCallback.current?.('unknown');
        requestJson<Review>(path, {}, token).then(refreshed => {
          if (currentIdentity.current === identity && generation.current === requestGeneration) {
            setState({ identity, review: refreshed, error: msg });
            setEditing({ identity, choices: refreshed.choices });
            onReviewLoadedRef.current?.(refreshed);
            statusCallback.current?.(refreshed.latest_attempt?.status ?? 'unsubmitted');
          }
        }).catch(() => {});
      }
    } finally {
      if (currentIdentity.current === identity && generation.current === requestGeneration) setBusy(undefined);
    }
  };

  return <section className="buyer-correction" aria-label="Booking draft review" aria-busy={busy}>
    <h4>Review current delivery draft</h4>
    {!review?.submission_enabled && !review?.latest_attempt && (
      <p>External booking is unavailable until the review is complete.</p>
    )}
    <button type="button" disabled={busy} onClick={() => { setState(undefined); setAttempt(value => value + 1); }}>Reload current review</button>
    {state?.identity === identity && state.error && <p role="alert">{state.error}</p>}
    {!review && !state?.error && <p role="status">Loading review…</p>}
    {review && choices && <>
      <p>{review.draft.recipient_name} · {review.draft.contact_number}<br />{review.draft.address}</p>
      <p>Parcel: {review.draft.parcel_weight_grams ?? 'Missing'} grams · {review.draft.parcel_quantity ?? 'Missing'} items</p>
      <p>Collect on delivery: ৳{(review.draft.remaining_cod_minor / 100).toFixed(2)} (accepted advance applied)</p>
      <p>Account: {review.connection.status} · {review.connection.merchant_hint} · revision {review.connection.version}</p>
      {review.connection.simulated && <p>Simulated account and locations — offline only.</p>}
      <fieldset disabled={busy || review.blockers.includes('ORDER_NOT_CONFIRMED')}>
        <legend>Pickup and delivery choices</legend>
        <label>Environment<select value={choices.environment} onChange={event => {
          const environment = event.target.value;
          if (environment === 'offline' || environment === 'sandbox' || environment === 'production') {
            setEditing({ identity, choices: { environment, store_id: null, delivery_type: null, location: {} } });
          }
        }}>{['offline', 'sandbox', 'production'].map(env => <option key={env}>{env}</option>)}</select></label>
        <p>Save an environment change to load that account’s stores and location choices.</p>
        <label>Pickup store<select value={choices.store_id ?? ''} disabled={choices.environment !== review.choices.environment}
          onChange={event => setEditing({ identity, choices: { ...choices, store_id: Number(event.target.value) || null } })}>
          <option value="">Choose pickup store</option>
          {review.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select></label>
        <label>Delivery service<select value={choices.delivery_type ?? ''} onChange={event => {
          const service = Number(event.target.value);
          setEditing({ identity, choices: { ...choices, delivery_type: service === 48 || service === 12 ? service : null } });
        }}><option value="">Choose service</option><option value="48">Normal delivery</option><option value="12">On-demand delivery</option></select></label>
        <p>Destination: {[review.location.city_name, review.location.zone_name, review.location.area_name].filter(Boolean).join(' / ') || 'Unresolved'}</p>
        {review.connection.version > 0 && choices.environment === review.choices.environment &&
          <CourierReviewLocations key={`${identity}:${review.token}`} path={path} token={token} review={review} value={choices.location}
            onChange={location => setEditing({ identity, choices: { ...choices, location } })} />}
        <button type="button" disabled={!dirty} onClick={() => void mutate('PUT')}>Save delivery choices</button>
      </fieldset>
      <ul>{review.blockers.map(code => <li key={code}>{blockerLabels[code] ?? code}</li>)}</ul>
      {dirty && <p>Save changes before reviewing.</p>}
      <button type="button" data-review disabled={busy || dirty || review.blockers.length > 0 || review.reviewed}
        onClick={() => void mutate('POST')}>Confirm current review</button>
      {review.reviewed && !dirty && !review.latest_attempt && <p role="status">Review complete. This remains a local draft; no Pathao booking exists.</p>}
      {review.reviewed && !dirty && review.submission_enabled && (
        <button type="button" data-submit disabled={busy} onClick={() => void submitBooking()}>
          Submit booking to {target}
        </button>
      )}
      {busy && <p role="status">Submitting booking to {target}…</p>}
      {review.delivery_mismatch && (
        <div role="alert" className="delivery-mismatch-warning" style={{
          marginBottom: '12px', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.825rem', color: 'var(--rose-accent)',
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Action required in Pathao / পাঠাও-এ সমাধান প্রয়োজন</p>
          <p style={{ margin: '4px 0 0' }}>{review.delivery_mismatch.message}</p>
          {review.delivery_mismatch.booked_snapshot && (
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Original booked details: {review.delivery_mismatch.booked_snapshot.recipient_name} ·{' '}
              {review.delivery_mismatch.booked_snapshot.recipient_phone} ·{' '}
              {review.delivery_mismatch.booked_snapshot.recipient_address}
            </p>
          )}
        </div>
      )}
      {review.latest_attempt?.status === 'success' && (
        <div role="status" className="booking-result">
          <p><strong>{review.latest_attempt.resolution_action === 'attach_existing'
            ? `Existing booking attached (${review.latest_attempt.simulated ? 'simulated offline' : 'Pathao sandbox'}).`
            : review.latest_attempt.simulated
              ? 'Booking confirmed (simulated offline).'
              : 'Booking confirmed in Pathao sandbox.'}</strong></p>
          <p>{review.latest_attempt.simulated ? 'Simulated consignment' : 'Consignment'}: <code>{review.latest_attempt.consignment_id}</code></p>
          {review.latest_attempt.resolution_action === 'attach_existing' && (
            <p>The original unknown attempt and its reviewed snapshot are preserved.</p>
          )}
          {review.blockers.includes('ORDER_NOT_CONFIRMED') && (
            <p role="alert">Local cancellation does not cancel this existing Pathao booking.
              Resolve the booking in Pathao before dispatching or creating a replacement.</p>
          )}
        </div>
      )}
      {review.latest_attempt?.status === 'unknown' && (
        <div className="booking-unknown">
          <p role="alert"><strong>Booking outcome unknown.</strong> The submission was sent, but the courier
            response was interrupted or could not be verified. Further attempts are blocked to prevent duplicate booking.</p>
          <CourierReconciliation key={`${identity}:${review.latest_attempt.id}`}
            orderId={orderId} token={token} attempt={review.latest_attempt}
            onResolved={updated => {
              setState({ identity, review: updated });
              setEditing({ identity, choices: updated.choices });
              onReviewLoadedRef.current?.(updated);
              statusCallback.current?.(updated.latest_attempt?.status ?? 'unsubmitted');
            }} />
        </div>
      )}
      {review.latest_attempt?.status === 'failed' && (
        review.latest_attempt.error_code === 'CONFIRMED_NONCREATION'
          ? <div role="status" className="booking-noncreation">
            <p><strong>Confirmed noncreation recorded.</strong> Current lifecycle, connection, address, and parcel
              details are revalidated before another attempt. Review again if anything changed.</p>
          </div>
          : <div role="alert" className="booking-failed">
            <p>Previous submission rejected: {review.latest_attempt.error_message || 'Courier rejected booking'}.
              You may review and try again.</p>
          </div>
      )}
    </>}
  </section>;
}
