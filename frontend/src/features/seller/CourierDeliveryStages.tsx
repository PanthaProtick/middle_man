import type { ReactNode } from 'react';
import type { CourierMessage } from '../locale/courierCopy';
import { useCourierText } from '../locale/courierCopy';
import type { Review } from './courierReviewTypes';
import './CourierWorkspace.css';

type StepState = 'complete' | 'current' | 'blocked' | 'waiting';
type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const blockerLabels: Record<string, CourierMessage> = {
  PARCEL_DETAILS_REQUIRED: 'Save explicit parcel weight and quantity above.',
  COURIER_CONNECTION_REQUIRED: 'Connect your merchant account in Pathao settings.',
  PICKUP_STORE_REQUIRED: 'Choose an active pickup store for this connection.',
  SERVICE_REQUIRED: 'Choose a supported delivery service.',
  LOCATION_METADATA_REQUIRED: 'Resolve the destination and supported delivery coverage.',
  LOCATION_CHOICES_INVALID: 'Choose destination IDs from their current city and zone.',
  METADATA_UNAVAILABLE: 'Metadata could not be validated. Retry after restoring the connection.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed.',
};

const stepLabels: CourierMessage[] = [
  'Parcel details', 'Local draft', 'Current review', 'Submit booking', 'Booking result',
];

const stateLabels: Record<StepState, CourierMessage> = {
  complete: 'Complete', current: 'In progress', blocked: 'Blocked', waiting: 'Waiting',
};

const targetLabel = (review: Review): CourierMessage => review.choices.environment === 'production'
  ? 'Pathao production'
  : review.choices.environment === 'sandbox' ? 'Pathao sandbox' : 'Pathao (simulated)';

function hasParcel(review: Review): boolean {
  return Boolean(review.draft) && review.draft.parcel_weight_grams !== null && review.draft.parcel_quantity !== null;
}

function hasDraftChoices(review: Review): boolean {
  if (!review.connection || !review.choices || !review.location) return false;
  return review.connection.status === 'connected' && review.choices.store_id !== null &&
    review.choices.delivery_type !== null && Boolean(review.location.city_name && review.location.zone_name);
}

function stepStates(review: Review | null | undefined): StepState[] {
  if (!review) return ['waiting', 'waiting', 'waiting', 'waiting', 'waiting'];
  const latest = review.latest_attempt;
  const blockers = review.blockers ?? [];
  const parcelDone = hasParcel(review);
  const draftDone = hasDraftChoices(review);
  const blocks = (codes: string[]) => codes.some(code => blockers.includes(code));
  const parcel: StepState = parcelDone ? 'complete'
    : blocks(['ORDER_NOT_CONFIRMED', 'PARCEL_DETAILS_REQUIRED']) ? 'blocked' : 'current';
  const draft: StepState = draftDone ? 'complete'
    : blocks(['COURIER_CONNECTION_REQUIRED', 'PICKUP_STORE_REQUIRED', 'SERVICE_REQUIRED',
      'LOCATION_METADATA_REQUIRED', 'LOCATION_CHOICES_INVALID']) ? 'blocked'
      : parcelDone ? 'current' : 'waiting';
  const reviewStep: StepState = review.reviewed ? 'complete'
    : blockers.length > 0 ? 'blocked' : draftDone ? 'current' : 'waiting';
  const submit: StepState = latest?.status === 'success' ? 'complete'
    : latest?.status === 'unknown' ? 'blocked'
      : latest?.status === 'failed' || latest?.status === 'submitting' ? 'current'
        : review.reviewed && review.submission_enabled ? 'current' : 'waiting';
  const result: StepState = latest?.status === 'success' ? 'complete'
    : latest?.status === 'unknown' ? 'blocked'
      : latest?.status === 'failed' ? 'current' : 'waiting';
  return [parcel, draft, reviewStep, submit, result];
}

function statusChip(review: Review | null | undefined): { label: CourierMessage; tone: StatusTone } {
  const latest = review?.latest_attempt;
  if (latest?.status === 'unknown') return { label: 'Outcome unknown', tone: 'warning' };
  if (latest?.status === 'success') return { label: 'Booked', tone: 'success' };
  if (latest?.status === 'failed') return { label: 'Rejected', tone: 'danger' };
  if (review?.blockers?.length) return { label: 'Needs review', tone: 'warning' };
  if (review?.reviewed) return { label: 'Draft ready', tone: 'neutral' };
  if (review && hasDraftChoices(review)) return { label: 'Draft ready', tone: 'neutral' };
  return { label: 'Waiting for details', tone: 'neutral' };
}

export function CourierDeliveryStages({ review }: { review?: Review | null }) {
  const t = useCourierText();
  const states = stepStates(review);
  const currentIndex = states.findIndex(state => state === 'current' || state === 'blocked');
  const status = statusChip(review);
  const latest = review?.latest_attempt;
  const blockers = review?.blockers ?? [];

  let nextAction: ReactNode;
  if (blockers.length) {
    nextAction = <>
      <p className="courier-next-action-title">{t('Next action blocked:')}</p>
      <ul>{blockers.map(code => <li key={code}>{
        t(blockerLabels[code] ?? 'Courier response could not be interpreted. Reload current details and check Pathao before taking further action.')
      }</li>)}</ul>
    </>;
  } else if (latest?.status === 'unknown') {
    nextAction = t('Resolve the unknown booking outcome before any new booking.');
  } else if (latest?.status === 'success') {
    nextAction = t('Booked');
  } else if (latest?.status === 'failed') {
    nextAction = t('You may review and try again.');
  } else if (review?.reviewed && review.submission_enabled) {
    nextAction = `${t('Ready to submit to')} ${t(targetLabel(review))}.`;
  } else if (review?.reviewed) {
    nextAction = t('Review complete. This remains a local draft; no Pathao booking exists.');
  } else if (review) {
    nextAction = <>{t('Ready to review.')} {t('All required delivery details are present.')}</>;
  } else {
    nextAction = t('Waiting for details');
  }

  return <header className="courier-workspace-heading">
    <p className="courier-workspace-eyebrow">{t('Delivery preparation')}</p>
    <div className="courier-workspace-title">
      <h3>{t('Prepare this delivery')}</h3>
      <span className="courier-status-chip" data-tone={status.tone}>{t(status.label)}</span>
    </div>
    <section className="courier-sequence-card" aria-label={t('Delivery sequence')}>
      <ol className="courier-sequence" data-courier-sequence>
        {states.map((state, index) => <li key={stepLabels[index]} data-state={state}
          aria-current={index === currentIndex ? 'step' : undefined}>
          <span className="courier-sequence-number" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
          <span className="courier-sequence-label">{t(stepLabels[index])}</span>
          <span className="courier-sequence-state">{t(stateLabels[state])}</span>
        </li>)}
      </ol>
      <div className="courier-next-action" data-next-action={blockers.length ? 'blocked' : 'ready'}>
        {nextAction}
      </div>
    </section>
  </header>;
}
