import { courierErrorText } from './courierErrorText';
import { useCourierText } from '../locale/courierCopy';
import { CourierReconciliation } from './CourierReconciliation';
import { OriginalCourierEvidence } from './CourierError';
import type { Review } from './courierReviewTypes';

export function CourierOutcomes({ review, orderId, token, onResolved }: {
  review: Review; orderId: string; token: string; onResolved: (review: Review) => void;
}) {
  const t = useCourierText();
  return <>
      {review.delivery_mismatch && (
        <div role="alert" className="delivery-mismatch-warning" style={{
          marginBottom: '12px', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.825rem', color: 'var(--rose-accent)',
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{t("Action required in Pathao")}</p>
          <div style={{ margin: '4px 0 0' }}>
            {review.delivery_mismatch.cancelled && <p>{t('Local cancellation does not cancel the Pathao booking.')}</p>}
            {(review.delivery_mismatch.recipient_name_changed || review.delivery_mismatch.contact_number_changed || review.delivery_mismatch.address_changed) &&
              <p>{t('Local delivery changes do not update the Pathao booking. Resolve or update the booking directly in Pathao.')}</p>}
            <OriginalCourierEvidence text={review.delivery_mismatch.message} />
          </div>
          {review.delivery_mismatch.booked_snapshot && (
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {t("Original booked details:")} {review.delivery_mismatch.booked_snapshot.recipient_name} ·{' '}
              {review.delivery_mismatch.booked_snapshot.recipient_phone} ·{' '}
              {review.delivery_mismatch.booked_snapshot.recipient_address}
            </p>
          )}
        </div>
      )}
      {review.latest_attempt?.status === 'success' && (
        <div role="status" className="booking-result">
          <p><strong>{review.latest_attempt.resolution_action === 'attach_existing'
            ? `${t('Existing booking attached')} (${review.latest_attempt.simulated ? t('simulated offline') : t('Pathao sandbox')}).`
            : review.latest_attempt.simulated
              ? t('Booking confirmed (simulated offline).')
              : t('Booking confirmed in Pathao sandbox.')}</strong></p>
          <p>{t(review.latest_attempt.simulated ? 'Simulated consignment' : 'Consignment')}: <code>{review.latest_attempt.consignment_id}</code></p>
          {review.latest_attempt.resolution_action === 'attach_existing' && (
            <p>{t("The original unknown attempt and its reviewed snapshot are preserved.")}</p>
          )}
          {review.blockers.includes('ORDER_NOT_CONFIRMED') && (
            <p role="alert">{t('Local cancellation does not cancel this existing Pathao booking. Resolve the booking in Pathao before dispatching or creating a replacement.')}</p>
          )}
        </div>
      )}
      {review.latest_attempt?.status === 'unknown' && (
        <div className="booking-unknown">
          <OriginalCourierEvidence text={review.latest_attempt.error_message} />
          <p role="alert"><strong>{t("Booking outcome unknown.")}</strong> {t('The submission was sent, but the courier response was interrupted or could not be verified. Further attempts are blocked to prevent duplicate booking.')}</p>
          <CourierReconciliation key={review.latest_attempt.id}
            orderId={orderId} token={token} attempt={review.latest_attempt}
            onResolved={onResolved} />
        </div>
      )}
      {review.latest_attempt?.status === 'failed' && (
        review.latest_attempt.error_code === 'CONFIRMED_NONCREATION'
          ? <div role="status" className="booking-noncreation">
            <p><strong>{t("Confirmed noncreation recorded.")}</strong> {t('Current lifecycle, connection, address, and parcel details are revalidated before another attempt. Review again if anything changed.')}</p>
          </div>
          : <div role="alert" className="booking-failed">
            <p>{t("Previous submission rejected:")} {courierErrorText(review.latest_attempt.error_code, t)}.
              {t('You may review and try again.')}</p>
            <OriginalCourierEvidence text={review.latest_attempt.error_message} />
          </div>
      )}
  </>;
}



