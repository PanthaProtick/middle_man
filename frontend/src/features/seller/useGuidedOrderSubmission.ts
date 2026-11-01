import { useConfirmedSubmission } from './useConfirmedSubmission';
import type { OrderInput, SellerOrder } from './types';
import { orderCreationError } from './orderCreationError';
import type { CreationMessage } from '../locale/orderCreationCopy';

type OrderLookup = { state: 'succeeded' | 'not_found'; order: SellerOrder | null };

export function useGuidedOrderSubmission(token: string | undefined, onSuccess: (order: SellerOrder) => void) {
  return useConfirmedSubmission<OrderInput, SellerOrder, OrderLookup, CreationMessage>({
    endpoint: '/api/seller/order-submissions', token, onSuccess,
    initialMessage: 'failed', describeError: error => orderCreationError(error).message,
    recoverResult: lookup => lookup.state === 'succeeded' ? lookup.order : null,
  });
}
