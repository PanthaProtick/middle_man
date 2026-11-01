import { SellerApiError } from './api';
import { useConfirmedSubmission } from './useConfirmedSubmission';
import type { PaymentFailureMessage } from '../locale/guidedPaymentCopy';
import type { ManualReceiptInput, RecordedTransactionResult, TransactionSubmissionLookup } from './types';

function failureMessage(error: unknown): PaymentFailureMessage {
  const code = error instanceof SellerApiError ? error.code : 'UNKNOWN';
  if (code === 'IDEMPOTENCY_KEY_REUSED') return 'conflict';
  if (code === 'PAYMENT_ACCOUNT_INACTIVE' || code === 'NOT_FOUND') return 'inactive';
  if (code === 'UNAUTHORIZED' || code === 'AUTH_UNAVAILABLE') return 'session';
  if (code === 'DURABLE_STORAGE_UNAVAILABLE') return 'storage';
  if (code === 'VALIDATION_ERROR') return 'invalid';
  return 'failed';
}

/** Payment policy stays local; recovery is shared with guided orders. */
export function useGuidedPaymentSubmission(
  token: string | undefined,
  onSuccess: (result: RecordedTransactionResult) => void,
) {
  return useConfirmedSubmission<ManualReceiptInput, RecordedTransactionResult, TransactionSubmissionLookup, PaymentFailureMessage>({
    endpoint: '/api/seller/transaction-submissions', token, onSuccess,
    initialMessage: 'failed', describeError: failureMessage,
    recoverResult: lookup => lookup.state === 'succeeded' ? lookup.result : null,
  });
}
