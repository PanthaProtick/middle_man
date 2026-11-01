import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { PaymentFailureMessage } from '../locale/guidedPaymentCopy';
import type {
  ManualReceiptInput,
  RecordedTransactionResult,
  TransactionSubmissionContext,
  TransactionSubmissionLookup,
} from './types';

type State = 'idle' | 'processing' | 'unknown' | 'retry' | 'failed' | 'reset' | 'unavailable' | 'conflict';
interface Attempt { key: string; payload: ManualReceiptInput }

function failureMessage(error: unknown): PaymentFailureMessage {
  const code = error instanceof SellerApiError ? error.code : 'UNKNOWN';
  if (code === 'IDEMPOTENCY_KEY_REUSED') return 'conflict';
  if (code === 'PAYMENT_ACCOUNT_INACTIVE' || code === 'NOT_FOUND') return 'inactive';
  if (code === 'UNAUTHORIZED' || code === 'AUTH_UNAVAILABLE') return 'session';
  if (code === 'DURABLE_STORAGE_UNAVAILABLE') return 'storage';
  if (code === 'VALIDATION_ERROR') return 'invalid';
  return 'failed';
}

/** Confirmed received-payment action with one recoverable submission identity. */
export function useGuidedPaymentSubmission(
  token: string | undefined,
  onSuccess: (result: RecordedTransactionResult) => void,
) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState<PaymentFailureMessage>('failed');
  const attempt = useRef<Attempt | null>(null);
  const running = useRef(false);
  const locked = state === 'processing' || state === 'unknown' || state === 'retry' || state === 'conflict';
  const frozen = locked || state === 'reset' || state === 'unavailable';
  const fail = (error: unknown, definitive = false) => {
    setMessage(failureMessage(error));
    if (error instanceof SellerApiError && error.code === 'SUBMISSION_STORAGE_RESET') setState('reset');
    else if (error instanceof SellerApiError && error.code === 'RECORD_UNAVAILABLE') setState('unavailable');
    else if (error instanceof SellerApiError && error.code === 'IDEMPOTENCY_KEY_REUSED') setState('conflict');
    else if (definitive && error instanceof SellerApiError && [400, 401, 403, 404, 422].includes(error.status)) setState('failed');
    else setState('unknown');
  };
  const finish = (result: RecordedTransactionResult) => {
    attempt.current = null; setState('idle'); onSuccess(result);
  };
  const write = async () => {
    const current = attempt.current;
    if (!current) return;
    const result = await requestJson<RecordedTransactionResult>(
      `/api/seller/transaction-submissions/${encodeURIComponent(current.key)}`,
      { method: 'POST', body: JSON.stringify(current.payload) }, token,
    );
    finish(result);
  };
  return {
    state, locked, frozen, failureMessage: message,
    reset: () => { if (!running.current) { attempt.current = null; setState('idle'); } },
    submit: async (payload: ManualReceiptInput) => {
      if (running.current || frozen) return;
      running.current = true; setState('processing');
      try {
        if (!attempt.current) {
          const context = await requestJson<TransactionSubmissionContext>(
            '/api/seller/transaction-submissions', {}, token);
          attempt.current = { key: `${context.storage_epoch}.${crypto.randomUUID()}`, payload };
        }
        await write();
      } catch (error) { if (attempt.current) fail(error, true); else setState('failed'); }
      finally { running.current = false; }
    },
    check: async () => {
      if (running.current || !attempt.current) return;
      running.current = true; setState('processing');
      try {
        const result = await requestJson<TransactionSubmissionLookup>(
          `/api/seller/transaction-submissions/${encodeURIComponent(attempt.current.key)}`, {}, token);
        if (result.state === 'succeeded' && result.result) finish(result.result);
        else setState('retry');
      } catch (error) { fail(error); }
      finally { running.current = false; }
    },
    retry: async () => {
      if (running.current || state !== 'retry') return;
      running.current = true; setState('processing');
      try { await write(); } catch (error) { fail(error); }
      finally { running.current = false; }
    },
  };
}
