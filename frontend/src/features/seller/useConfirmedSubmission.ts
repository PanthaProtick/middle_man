import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';

type State = 'idle' | 'processing' | 'unknown' | 'retry' | 'failed' | 'reset' | 'unavailable' | 'conflict';
interface SubmissionOptions<Result, Lookup, Message> {
  endpoint: string;
  token: string | undefined;
  onSuccess: (result: Result) => void;
  initialMessage: Message;
  describeError: (error: unknown) => Message;
  recoverResult: (lookup: Lookup) => Result | null;
}

/** Owns the identity and immutable payload through confirmation and recovery. */
export function useConfirmedSubmission<Payload, Result, Lookup, Message>({
  endpoint, token, onSuccess, initialMessage, describeError, recoverResult,
}: SubmissionOptions<Result, Lookup, Message>) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState<Message>(initialMessage);
  const attempt = useRef<{ key: string; payload: Payload } | null>(null);
  const running = useRef(false);
  const locked = state === 'processing' || state === 'unknown' || state === 'retry' || state === 'conflict';
  const frozen = locked || state === 'reset' || state === 'unavailable';
  const fail = (error: unknown, definitive = false) => {
    setMessage(describeError(error));
    if (error instanceof SellerApiError && error.code === 'SUBMISSION_STORAGE_RESET') setState('reset');
    else if (error instanceof SellerApiError && error.code === 'RECORD_UNAVAILABLE') setState('unavailable');
    else if (error instanceof SellerApiError && error.code === 'IDEMPOTENCY_KEY_REUSED') setState('conflict');
    else if (definitive && error instanceof SellerApiError && [400, 401, 403, 404, 422].includes(error.status)) setState('failed');
    else setState('unknown');
  };
  const finish = (result: Result) => {
    attempt.current = null; setState('idle'); onSuccess(result);
  };
  const write = async () => {
    const current = attempt.current;
    if (!current) return;
    const result = await requestJson<Result>(
      `${endpoint}/${encodeURIComponent(current.key)}`,
      { method: 'POST', body: JSON.stringify(current.payload) }, token,
    );
    finish(result);
  };
  return {
    state, locked, frozen, failureMessage: message,
    reset: () => { if (!running.current) { attempt.current = null; setState('idle'); } },
    submit: async (payload: Payload) => {
      if (running.current || frozen) return;
      running.current = true; setState('processing');
      try {
        if (!attempt.current) {
          const context = await requestJson<{ storage_epoch: string }>(
            endpoint, {}, token);
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
        const result = await requestJson<Lookup>(
          `${endpoint}/${encodeURIComponent(attempt.current.key)}`, {}, token);
        const recovered = recoverResult(result);
        if (recovered !== null) finish(recovered);
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
