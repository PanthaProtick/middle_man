import { useState } from 'react';
import { CourierDraft } from './CourierDraft';
import { CourierReview } from './CourierReview';
import type { ParcelRevision, Review } from './courierReviewTypes';

export function CourierWorkspace({ orderId, token, onReviewLoaded }: {
  orderId: string;
  token: string;
  onReviewLoaded?: (review: Review) => void;
}) {
  const [refresh, setRefresh] = useState(0);
  const [choicesSavedParcel, setChoicesSavedParcel] = useState<ParcelRevision>();
  return <>
    <CourierDraft orderId={orderId} token={token} reviewManaged choicesSavedParcel={choicesSavedParcel}
      onSaved={() => setRefresh(value => value + 1)} />
    <CourierReview orderId={orderId} token={token} refresh={refresh} onChoicesSaved={setChoicesSavedParcel}
      onReviewLoaded={onReviewLoaded} />
  </>;
}
