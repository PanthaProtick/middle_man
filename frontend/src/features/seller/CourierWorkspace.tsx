import { useState } from 'react';
import { CourierDraft } from './CourierDraft';
import { CourierReview } from './CourierReview';
import type { CourierAttemptStatus, ParcelRevision } from './courierReviewTypes';

export function CourierWorkspace({ orderId, token, onAttemptStatusChanged }: {
  orderId: string;
  token: string;
  onAttemptStatusChanged?: (status: CourierAttemptStatus | null) => void;
}) {
  const [refresh, setRefresh] = useState(0);
  const [choicesSavedParcel, setChoicesSavedParcel] = useState<ParcelRevision>();
  return <>
    <CourierDraft orderId={orderId} token={token} reviewManaged choicesSavedParcel={choicesSavedParcel}
      onSaved={() => setRefresh(value => value + 1)} />
    <CourierReview orderId={orderId} token={token} refresh={refresh} onChoicesSaved={setChoicesSavedParcel}
      onAttemptStatusChanged={onAttemptStatusChanged} />
  </>;
}
