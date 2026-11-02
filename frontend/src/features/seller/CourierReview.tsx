import { CourierError } from './CourierError';
import type { CourierMessage } from '../locale/courierCopy';
import { useCourierText } from '../locale/courierCopy';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from './api';
import type { CourierAttemptStatus, ParcelRevision, Review, ReviewChoices } from './courierReviewTypes';
import { CourierCopyField } from './CourierCopyField';
import { CourierOutcomes } from './CourierOutcomes';
import { CourierReviewChoices } from './CourierReviewChoices';
import { DeliverySummary } from './DeliverySummary';
import './DeliveryDetails.css';
import './CourierResults.css';

const blockerLabels: Record<string, CourierMessage> = {
  PARCEL_DETAILS_REQUIRED: 'Save explicit parcel weight and quantity above.',
  COURIER_CONNECTION_REQUIRED: 'Connect your merchant account in Pathao settings.',
  PICKUP_STORE_REQUIRED: 'Choose an active pickup store for this connection.',
  SERVICE_REQUIRED: 'Choose a supported delivery service.',
  LOCATION_METADATA_REQUIRED: 'Resolve the destination and supported delivery coverage.',
  LOCATION_CHOICES_INVALID: 'Choose destination IDs from their current city and zone.',
  METADATA_UNAVAILABLE: 'Metadata could not be validated. Retry after restoring the connection.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed.',
} as const;

export function CourierReview({ orderId, token, refresh = 0, onChoicesSaved, onReviewLoaded, onAttemptStatusChanged }: {
  orderId: string; token: string; refresh?: number; onChoicesSaved?: (parcel: ParcelRevision) => void;
  onReviewLoaded?: (review: Review) => void;
  onAttemptStatusChanged?: (status: CourierAttemptStatus | null) => void;
}) {
  const t = useCourierText();
  const identity = `${orderId}:${token}:${refresh}`;
  const currentIdentity = useRef(identity);
  const onReviewLoadedRef = useRef(onReviewLoaded);
  useEffect(() => { onReviewLoadedRef.current = onReviewLoaded; }, [onReviewLoaded]);
  const statusCallback = useRef(onAttemptStatusChanged);
  useEffect(() => { statusCallback.current = onAttemptStatusChanged; }, [onAttemptStatusChanged]);
  const generation = useRef(0);
  useEffect(() => { currentIdentity.current = identity; generation.current += 1; }, [identity]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ identity: string; review?: Review; error?: CourierMessage | Error }>();
  const [editing, setEditing] = useState<{ identity: string; choices: ReviewChoices }>();
  const [operation, setBusy] = useState<{ identity: string; kind: 'PUT' | 'POST' | 'submit' }>();
  const busy = operation?.identity === identity;
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
  const target = review?.choices?.environment === 'production' ? 'Pathao production'
    : review?.choices?.environment === 'sandbox' ? 'Pathao sandbox' : 'Pathao (simulated)';

  const mutate = async (method: 'PUT' | 'POST') => {
    if (!review || !choices || busy) return;
    const requestGeneration = generation.current;
    setBusy({ identity, kind: method });
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
    setBusy({ identity, kind: 'submit' });
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
        const msg = err instanceof Error ? err : new Error('Submission could not be completed. Reload current details.');
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

  const deliveryText = review?.draft ? [
    review.draft.recipient_name,
    review.draft.contact_number,
    review.draft.address,
    `COD: BDT ${(review.draft.remaining_cod_minor / 100).toFixed(2)}`,
  ].join('\n') : '';

  return <section className="buyer-correction delivery-details courier-review" aria-label={t("Booking draft review")} aria-busy={busy}>
    <h4>{t("Review current delivery draft")}</h4>
    {!review?.submission_enabled && !review?.latest_attempt && (
      <p className="delivery-note">{t("External booking is unavailable until the review is complete.")}</p>
    )}
    <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => { setState(undefined); setAttempt(value => value + 1); }}>{t("Reload current review")}</button>
    {state?.identity === identity && state.error && <div role="alert">{typeof state.error === 'string' ? t(state.error) : <CourierError error={state.error} />}</div>}
    {!review && !state?.error && <p role="status">{t("Loading review…")}</p>}
    {review && choices && <>
      <div className="courier-stage" data-stage="local-draft">
        <h5 className="courier-stage-title"><span aria-hidden="true">2</span> {t('Local delivery draft')}</h5>
        <DeliverySummary {...review.draft} />
        <CourierCopyField label="Copy delivery details" fallbackLabel="Manual delivery details"
          value={deliveryText} copiedLabel="Delivery details copied." />
        <p className="delivery-note">{t("Accepted advance deducted. Payment acceptance does not verify receipt with the payment provider.")}</p>
        <dl className="delivery-summary">
          <div><dt>{t("Parcel")}</dt><dd>{review.draft.parcel_weight_grams === null ? t('Weight missing') : `${review.draft.parcel_weight_grams} ${t('g')}`}
            {' · '}{review.draft.parcel_quantity === null ? t('Quantity missing') : `${review.draft.parcel_quantity} ${t(review.draft.parcel_quantity === 1 ? 'item' : 'items')}`}</dd></div>
          <div><dt>{t("Pathao account")}</dt><dd>{t(review.connection.status)}<span>{review.connection.merchant_hint}</span></dd></div>
        </dl>
        {review.connection.simulated && <p className="delivery-note">{t("Simulated account and locations — offline only.")}</p>}
        <CourierReviewChoices review={review} choices={choices} busy={Boolean(busy)} dirty={Boolean(dirty)}
          path={path} token={token} identity={identity}
          onChange={next => setEditing({ identity, choices: next })}
          onSave={() => void mutate('PUT')} />
      </div>
      <div className="courier-stage" data-stage="review">
        <h5 className="courier-stage-title"><span aria-hidden="true">3</span> {t('Current review')}</h5>
        <ul>{review.blockers.map(code => <li key={code}>{t(blockerLabels[code as keyof typeof blockerLabels] ?? 'Courier response could not be interpreted. Reload current details and check Pathao before taking further action.')}</li>)}</ul>
        {dirty && <p>{t("Save changes before reviewing.")}</p>}
        <button className="btn btn-primary" type="button" data-review disabled={busy || dirty || review.blockers.length > 0 || review.reviewed}
          onClick={() => void mutate('POST')}>{t("Confirm current review")}</button>
        {review.reviewed && !dirty && !review.latest_attempt && <p role="status">{t("Review complete. This remains a local draft; no Pathao booking exists.")}</p>}
      </div>
      <div className="courier-stage" data-stage="submit">
        <h5 className="courier-stage-title"><span aria-hidden="true">4</span> {t('Submit booking')}</h5>
        <p className="delivery-note">{t('Booking target:')} {t(target)}</p>
        {review.latest_attempt?.status === 'unknown' && <p className="delivery-note">{t('Resolve the unknown booking outcome before any new booking.')}</p>}
        {review.reviewed && !dirty && review.submission_enabled && (
          <button type="button" data-submit disabled={busy} onClick={() => void submitBooking()}>
            {t('Submit booking to')} {t(target)}
          </button>
        )}
        {busy && <p role="status">{operation.kind === 'submit'
          ? <>{t('Submitting booking to')} {t(target)}…</>
          : t(operation.kind === 'PUT' ? 'Saving delivery choices…' : 'Confirming current review…')}</p>}
      </div>
      <div className="courier-stage courier-result-stage" data-stage="result">
        <h5 className="courier-stage-title"><span aria-hidden="true">5</span> {t('Booking result')}</h5>
        {!review.latest_attempt && <p className="delivery-note">{t('No booking submitted. This remains a local draft.')}</p>}
        <CourierOutcomes review={review} orderId={orderId} token={token} onResolved={updated => {
          setState({ identity, review: updated });
          setEditing({ identity, choices: updated.choices });
          onReviewLoadedRef.current?.(updated);
          statusCallback.current?.(updated.latest_attempt?.status ?? 'unsubmitted');
        }} />
      </div>
    </>}
  </section>;
}
