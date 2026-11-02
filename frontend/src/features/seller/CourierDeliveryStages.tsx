import type { ReactNode } from 'react';
import type { CourierMessage } from '../locale/courierCopy';
import { useCourierText } from '../locale/courierCopy';
import type { Review } from './courierReviewTypes';
import './CourierWorkspace.css';
import { courierBlockerMessage } from './courierBlockerMessage';
import { CourierError } from './CourierError';

type StepState = 'complete' | 'current' | 'blocked' | 'waiting';
type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

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

function stepStates(review: Review | null | undefined, dirty = false): StepState[] {
  if (!review) return ['waiting', 'waiting', 'waiting', 'waiting', 'waiting'];
  const latest = review.latest_attempt;
  const blockers = review.blockers ?? [];
  const parcelDone = hasParcel(review);
  const draftDone = hasDraftChoices(review);
  const blocks = (codes: string[]) => codes.some(code => blockers.includes(code));
  // Dirty choices leave the loaded facts intact but make every readiness claim stale.
  const parcel: StepState = parcelDone ? 'complete'
    : blocks(['ORDER_NOT_CONFIRMED', 'PARCEL_DETAILS_REQUIRED']) ? 'blocked' : 'current';
  const draft: StepState = dirty ? 'current' : draftDone ? 'complete'
    : blocks(['COURIER_CONNECTION_REQUIRED', 'PICKUP_STORE_REQUIRED', 'SERVICE_REQUIRED',
      'LOCATION_METADATA_REQUIRED', 'LOCATION_CHOICES_INVALID']) ? 'blocked'
      : parcelDone ? 'current' : 'waiting';
  const reviewStep: StepState = dirty ? 'waiting' : review.reviewed ? 'complete'
    : blockers.length > 0 ? 'blocked' : draftDone ? 'current' : 'waiting';
  const submit: StepState = dirty ? 'waiting' : latest?.status === 'success' ? 'complete'
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
  if (latest?.status === 'failed') return latest.error_code === 'CONFIRMED_NONCREATION'
    ? { label: 'Confirmed noncreation recorded.', tone: 'neutral' }
    : { label: 'Rejected', tone: 'danger' };
  if (latest?.status === 'submitting') return { label: 'In progress', tone: 'neutral' };
  if (review?.blockers?.length) return { label: 'Needs review', tone: 'warning' };
  if (review?.reviewed) return { label: 'Draft ready', tone: 'neutral' };
  if (review && hasDraftChoices(review)) return { label: 'Draft ready', tone: 'neutral' };
  return { label: 'Waiting for details', tone: 'neutral' };
}

export function CourierDeliveryStages({ review, dirty = false, pending = false, error }: {
  review?: Review | null; dirty?: boolean; pending?: boolean; error?: CourierMessage | Error | null;
}) {
  const t = useCourierText();
  const actionableReview = pending || error ? undefined : review;
  const states = stepStates(actionableReview, dirty);
  const currentIndex = states.findIndex(state => state === 'current' || state === 'blocked');
  const status = pending ? { label: 'In progress' as const, tone: 'neutral' as const }
    : dirty || error ? { label: 'Needs review' as const, tone: 'warning' as const }
      : statusChip(actionableReview);
  const latest = review?.latest_attempt;
  const blockers = review?.blockers ?? [];

  let nextAction: ReactNode;
  if (latest?.status === 'unknown') {
    nextAction = t('Resolve the unknown booking outcome before any new booking.');
  } else if (latest?.status === 'success') {
    nextAction = t('Booked');
  } else if (pending || latest?.status === 'submitting') {
    nextAction = t('Delivery operation in progress. Wait for the current result.');
  } else if (error) {
    nextAction = typeof error === 'string' ? t(error) : <CourierError error={error} />;
  } else if (dirty) {
    nextAction = t('Save changes before reviewing.');
  } else if (blockers.length) {
    nextAction = <p className="courier-next-action-title">{t('Next action blocked:')}</p>;
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

  const blocked = blockers.length > 0 || dirty || error || latest?.status === 'unknown';
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
      <div className="courier-next-action" data-next-action={blocked ? 'blocked' : pending ? 'pending' : 'ready'}>
        {nextAction}
        {blockers.length > 0 && <ul>{blockers.map(code => <li key={code}>{t(courierBlockerMessage(code))}</li>)}</ul>}
      </div>
    </section>
  </header>;
}
