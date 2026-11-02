import { useState } from 'react';
import { CourierDeliveryStages } from './CourierDeliveryStages';
import { CourierDraft } from './CourierDraft';
import { CourierReview } from './CourierReview';
import type { CourierAttemptStatus, ParcelRevision, Review } from './courierReviewTypes';

export function CourierWorkspace({ orderId, token, onAttemptStatusChanged }: {
  orderId: string;
  token: string;
  onAttemptStatusChanged?: (status: CourierAttemptStatus | null) => void;
}) {
  const [refresh, setRefresh] = useState(0);
  const [choicesSavedParcel, setChoicesSavedParcel] = useState<ParcelRevision>();
  const [review, setReview] = useState<Review | null>(null);
  return <div className="courier-workspace">
    <CourierDeliveryStages review={review} />
    <CourierDraft orderId={orderId} token={token} reviewManaged choicesSavedParcel={choicesSavedParcel}
      onSaved={() => setRefresh(value => value + 1)} />
    <CourierReview orderId={orderId} token={token} refresh={refresh} onChoicesSaved={setChoicesSavedParcel}
      onReviewLoaded={setReview} onAttemptStatusChanged={onAttemptStatusChanged} />
  </div>;
}
