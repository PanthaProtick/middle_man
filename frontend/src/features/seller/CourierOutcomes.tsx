import { courierErrorText } from './courierErrorText';
import { useCourierText } from '../locale/courierCopy';
import { CourierCopyField } from './CourierCopyField';
import { CourierReconciliation } from './CourierReconciliation';
import { OriginalCourierEvidence } from './CourierError';
import type { Review } from './courierReviewTypes';

export function CourierOutcomes({ review, orderId, token, onResolved }: {
  review: Review; orderId: string; token: string; onResolved: (review: Review) => void;
}) {
  const t = useCourierText();
  return <>
      {review.delivery_mismatch && (
        <div role="alert" className="delivery-mismatch-warning">
          <p className="courier-result-title">{t("Action required in Pathao")}</p>
          <div className="delivery-mismatch-body">
            {review.delivery_mismatch.cancelled && <p>{t('Local cancellation does not cancel the Pathao booking.')}</p>}
            {(review.delivery_mismatch.recipient_name_changed || review.delivery_mismatch.contact_number_changed || review.delivery_mismatch.address_changed) &&
              <p>{t('Local delivery changes do not update the Pathao booking. Resolve or update the booking directly in Pathao.')}</p>}
            <OriginalCourierEvidence text={review.delivery_mismatch.message} />
          </div>
          {review.delivery_mismatch.booked_snapshot && (
            <p className="delivery-mismatch-snapshot">
              {t("Original booked details:")} {review.delivery_mismatch.booked_snapshot.recipient_name} ·{' '}
              {review.delivery_mismatch.booked_snapshot.recipient_phone} ·{' '}
              {review.delivery_mismatch.booked_snapshot.recipient_address}
            </p>
          )}
        </div>
      )}
      {review.latest_attempt?.status === 'success' && (
        <div role="status" className="booking-result courier-result-card">
          <h6 className="courier-result-title">{t('Booked')}</h6>
          <p><strong>{review.latest_attempt.resolution_action === 'attach_existing'
            ? `${t('Existing booking attached')} (${review.latest_attempt.simulated ? t('simulated offline') : t(review.latest_attempt.environment === 'production' ? 'Pathao production' : 'Pathao sandbox')}).`
            : review.latest_attempt.simulated
              ? t('Booking confirmed (simulated offline).')
              : t(review.latest_attempt.environment === 'production'
                ? 'Booking confirmed in Pathao production.' : 'Booking confirmed in Pathao sandbox.')}</strong></p>
          <p>{t(review.latest_attempt.simulated ? 'Simulated consignment' : 'Consignment')}: <code>{review.latest_attempt.consignment_id}</code></p>
          {review.latest_attempt.consignment_id && <CourierCopyField label="Copy consignment ID"
            fallbackLabel="Manual consignment ID" value={review.latest_attempt.consignment_id} />}
          {review.latest_attempt.resolution_action === 'attach_existing' && (
            <p>{t("The original unknown attempt and its reviewed snapshot are preserved.")}</p>
          )}
          {review.blockers.includes('ORDER_NOT_CONFIRMED') && (
            <p role="alert">{t('Local cancellation does not cancel this existing Pathao booking. Resolve the booking in Pathao before dispatching or creating a replacement.')}</p>
          )}
        </div>
      )}
      {review.latest_attempt?.status === 'unknown' && (
        <div className="booking-unknown courier-result-card">
          <h6 className="courier-result-title">{t('Booking outcome unknown')}</h6>
          <p role="alert"><strong>{t("Booking outcome unknown.")}</strong> {t('The submission was sent, but the courier response was interrupted or could not be verified. Further attempts are blocked to prevent duplicate booking.')}</p>
          <OriginalCourierEvidence text={review.latest_attempt.error_message} />
          <h6 className="courier-result-subtitle">{t('Resolve unknown outcome')}</h6>
          <CourierReconciliation key={review.latest_attempt.id}
            orderId={orderId} token={token} attempt={review.latest_attempt}
            onResolved={onResolved} />
        </div>
      )}
      {review.latest_attempt?.status === 'failed' && (
        review.latest_attempt.error_code === 'CONFIRMED_NONCREATION'
          ? <div role="status" className="booking-noncreation courier-result-card">
            <p><strong>{t("Confirmed noncreation recorded.")}</strong> {t('Current lifecycle, connection, address, and parcel details are revalidated before another attempt. Review again if anything changed.')}</p>
          </div>
          : <div role="alert" className="booking-failed courier-result-card">
            <p>{t("Previous submission rejected:")} {courierErrorText(review.latest_attempt.error_code, t)}.
              {t('You may review and try again.')}</p>
            <OriginalCourierEvidence text={review.latest_attempt.error_message} />
          </div>
      )}
  </>;
}
