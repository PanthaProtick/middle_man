import { useRef, useState } from 'react';
import { type ApiError, BuyerApiError, fetchPublicOrder, submitBuyerDetails } from './api';
import type { BuyerSubmissionInput, PublicOrder } from './types';
import { useLocale } from '../locale';
import { submissionMessage } from './submissionErrors';

interface Attempt {
  key: string;
  payload: BuyerSubmissionInput;
}

export function useBuyerSubmission(portalToken: string, onSaved: (order: PublicOrder) => void) {
  const { t } = useLocale();
  const attempt = useRef<Attempt | null>(null);
  const inFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [problem, setProblem] = useState<{ error?: BuyerApiError; uncertain: boolean } | null>(null);
  const [serverFields, setServerFields] = useState<ApiError['fields']>(undefined);

  const handleSubmit = async (payload: BuyerSubmissionInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setProblem(null);
    setServerFields(undefined);
    attempt.current ??= { key: crypto.randomUUID(), payload: structuredClone(payload) };
    try {
      const saved = await submitBuyerDetails(portalToken, attempt.current.payload, attempt.current.key);
      onSaved(saved);
      attempt.current = null;
      setIsLocked(false);
    } catch (error: unknown) {
      const definitive = error instanceof BuyerApiError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 408;
      // Admission rejects only this retry, not a previous request with unknown outcome.
      const admissionWhileUncertain = isLocked && error instanceof BuyerApiError && [413, 429].includes(error.statusCode);
      if (definitive && !admissionWhileUncertain && error.statusCode !== 409 && error.statusCode !== 410) {
        attempt.current = null;
        setIsLocked(false);
        setProblem({error, uncertain: false});
        setServerFields(error.fields);
      } else {
        // A transport failure can follow a commit. Reconcile before enabling edits.
        setIsLocked(true);
        setProblem({error: error instanceof BuyerApiError ? error : undefined, uncertain: true});
        try {
          const fresh = await fetchPublicOrder(portalToken);
          if (fresh.lifecycle !== 'awaiting_buyer') {
            onSaved(fresh);
            attempt.current = null;
            setIsLocked(false);
          }
        } catch {
          // Preserve the exact attempt while the server cannot establish the outcome.
        }
      }
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const submissionError = problem ? submissionMessage(t, problem.error, problem.uncertain) : null;
  return { handleSubmit, isSubmitting, isLocked, submissionError, serverFields };
}
