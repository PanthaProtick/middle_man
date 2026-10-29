import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { BuyerSubmissionForm } from './BuyerSubmissionForm';
import type { BuyerFormDraft, PublicOrder } from './types';

/**
 * Retired-address-AI regression: legacy cached responses may still carry the
 * availability flag, and it must never bring the assistance control back.
 */
type LegacyPublicOrder = PublicOrder & { ai_assistance_available?: boolean };

const order: LegacyPublicOrder = {
  id: 'synthetic', shop_display_name: 'Shop', product_name: 'Item', total_minor: 20000,
  required_advance_minor: 10000, expected_cod_minor: 10000, actual_cod_minor: null,
  account_provider: 'bkash', account_receiving_number: '01712345678', account_label: 'Shop',
  lifecycle: 'awaiting_buyer', status_message: 'Enter details', submission_acknowledgement: null,
  created_at: '2026-10-24T00:00:00Z', expires_at: '2026-10-26T00:00:00Z', completed_at: null,
};
const draft: BuyerFormDraft = {
  buyer_name: 'Buyer', contact_number: '01712345678', address_raw: 'Dhaka',
  payment_provider: 'bkash', payment_sender: '01812345678', payment_trx_id: 'ABC123',
  claimed_advance_bdt: '100',
};

it.each([false, undefined, true])(
  'ignores legacy AI availability %s and preserves manual address and payment submission',
  async available => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const submit = vi.fn().mockResolvedValue(undefined);
    const legacyOrder: LegacyPublicOrder = { ...order, ai_assistance_available: available };
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ condition: 'disconnected', choices: [] })));
    try {
      await act(async () => root.render(<BuyerSubmissionForm portalToken="token"
        order={legacyOrder} draft={draft}
        onDraftChange={vi.fn()} onSubmit={submit} isSubmitting={false} submissionError={null} />));
      expect(container.querySelector('[aria-label*="address assistance" i]')).toBeNull();
      expect(container.textContent).not.toMatch(/AI assistance/i);
      expect(container.querySelector('input[type="file"]')).toBeNull();
      expect(container.textContent).not.toMatch(/screenshot/i);
      await act(async () => container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })));
      expect(submit).toHaveBeenCalledWith(expect.objectContaining({
        address: { raw_text: 'Dhaka' },
        payment_claim: { provider: 'bkash', trx_id: 'ABC123', sender_number: '01812345678', amount_minor: 10000 },
      }));
      // Only the Pathao catalog read remains; no extraction endpoint may be called.
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][0]).toBe('/api/public/orders/token/pathao-locations');
    } finally {
      await act(async () => root.unmount());
      container.remove();
      fetcher.mockRestore();
    }
  },
);
