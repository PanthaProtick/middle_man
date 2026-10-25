import { useRef, useState } from 'react';
import { BuyerApiError, fetchPublicOrder, submitBuyerDetails } from './api';
import type { BuyerSubmissionInput, PublicOrder } from './types';

interface Attempt {
  key: string;
  payload: BuyerSubmissionInput;
}

export function useBuyerSubmission(portalToken: string, onSaved: (order: PublicOrder) => void) {
  const attempt = useRef<Attempt | null>(null);
  const inFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});

  const handleSubmit = async (payload: BuyerSubmissionInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    setServerFields({});
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
        setSubmissionError(error.message);
        const names: Record<string, string> = {
          buyer_name: 'buyer_name', contact_number: 'contact_number', 'address.raw_text': 'address_raw',
          'payment_claim.sender_number': 'payment_sender', 'payment_claim.trx_id': 'payment_trx_id',
          'payment_claim.amount_minor': 'claimed_advance_bdt', 'payment_claim.provider': 'payment_provider',
        };
        setServerFields(Object.fromEntries((error.fields ?? []).map((field) => [names[field.field] ?? field.field, field.message])));
      } else {
        // A transport failure can follow a commit. Reconcile before enabling edits.
        setIsLocked(true);
        const unknownMessage = 'Submission outcome unknown. Retry the same details below. / জমা হয়েছে কি না জানা যায়নি। একই তথ্য দিয়ে আবার চেষ্টা করুন।';
        setSubmissionError(admissionWhileUncertain ? `${error.message} ${unknownMessage}` : unknownMessage);
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

  return { handleSubmit, isSubmitting, isLocked, submissionError, serverFields };
}
