import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { OrderInput, SellerOrder } from './types';
import { orderCreationError } from './orderCreationError';
import type { CreationMessage } from '../locale/orderCreationCopy';

type State = 'idle' | 'processing' | 'unknown' | 'retry' | 'failed' | 'reset' | 'unavailable' | 'conflict';
interface Attempt { key: string; payload: OrderInput }
export function useGuidedOrderSubmission(token: string | undefined, onSuccess: (order: SellerOrder) => void) {
  const [state, setState] = useState<State>('idle');
  const [failureMessage, setFailureMessage] = useState<CreationMessage>('failed');
  const attempt = useRef<Attempt | null>(null);
  const running = useRef(false);
  const locked = state === 'processing' || state === 'unknown' || state === 'retry' || state === 'conflict';
  const frozen = locked || state === 'reset' || state === 'unavailable';
  const fail = (error: unknown, definitive = false) => {
    setFailureMessage(orderCreationError(error).message);
    if (error instanceof SellerApiError && error.code === 'SUBMISSION_STORAGE_RESET') setState('reset');
    else if (error instanceof SellerApiError && error.code === 'RECORD_UNAVAILABLE') setState('unavailable');
    else if (error instanceof SellerApiError && error.code === 'IDEMPOTENCY_KEY_REUSED') setState('conflict');
    else if (definitive && error instanceof SellerApiError && [400, 401, 403, 404, 422].includes(error.status)) setState('failed');
    else setState('unknown');
  };
  const finish = (order: SellerOrder) => { attempt.current = null; setState('idle'); onSuccess(order); };
  const write = async () => {
    const current = attempt.current;
    if (!current) return;
    const order = await requestJson<SellerOrder>(`/api/seller/order-submissions/${encodeURIComponent(current.key)}`,
      { method: 'POST', body: JSON.stringify(current.payload) }, token);
    finish(order);
  };
  return {
    state, locked, frozen, failureMessage,
    reset: () => { if (!running.current) { attempt.current = null; setState('idle'); } },
    submit: async (payload: OrderInput) => {
      if (running.current || frozen) return;
      running.current = true; setState('processing');
      try {
        if (!attempt.current) {
          const context = await requestJson<{ storage_epoch: string }>('/api/seller/order-submissions', {}, token);
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
        const result = await requestJson<{ state: 'succeeded' | 'not_found'; order: SellerOrder | null }>(
          `/api/seller/order-submissions/${encodeURIComponent(attempt.current.key)}`, {}, token);
        if (result.state === 'succeeded' && result.order) finish(result.order);
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
