import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { BuyerSubmissionForm } from './BuyerSubmissionForm';
import { awaitingOrder } from './buyerLocaleFixtures';
import type { BuyerFormDraft } from './types';

it.each(['bkash', 'nagad'] as const)(
  'fixes the displayed and submitted method to the %s account despite a conflicting draft',
  async provider => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const submit = vi.fn().mockResolvedValue(undefined);
    const draft: BuyerFormDraft = {
      buyer_name: 'Buyer', contact_number: '01712345678', address_raw: 'Dhaka',
      payment_provider: provider === 'bkash' ? 'nagad' : 'bkash',
      payment_sender: '01812345678', payment_trx_id: 'ABC123', claimed_advance_bdt: '100',
    };
    try {
      await act(async () => root.render(<BuyerSubmissionForm
        order={{ ...awaitingOrder, account_provider: provider }} draft={draft}
        onDraftChange={vi.fn()} onSubmit={submit} isSubmitting={false} submissionError={null} />));
      expect(container.querySelector('select[name="payment_provider"]')).toBeNull();
      const method = container.querySelector<HTMLInputElement>('input[name="payment_provider"]')!;
      expect(method.readOnly).toBe(true);
      expect(method.value).toBe(provider === 'nagad' ? 'Nagad' : 'bKash');
      expect(container.querySelector('label[for="payment_provider"]')).not.toBeNull();
      await act(async () => container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })));
      expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        payment_claim: { provider, trx_id: 'ABC123', sender_number: '01812345678', amount_minor: 10000 },
      }));
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  },
);
