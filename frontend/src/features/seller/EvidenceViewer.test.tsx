import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvidenceViewer } from './EvidenceViewer';
import * as correctionsApi from './corrections';

describe('EvidenceViewer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders explicit notice when no evidence was attached to the order', async () => {
    vi.spyOn(correctionsApi, 'fetchHistory').mockResolvedValueOnce({
      items: [
        {
          id: 'rev-1',
          revision_number: 1,
          actor: 'buyer',
          reason: null,
          created_at: '2026-10-24T12:00:00Z',
          claim_accepted_at: '2026-10-24T12:00:00Z',
          buyer_name: 'Manual Buyer',
          contact_number: '01711111111',
          address: { raw_text: 'Dhaka' },
          payment_claim: {
            provider: 'bkash',
            trx_id: 'MANUAL123',
            sender_number: '01722222222',
            amount_minor: 50000,
            evidence_id: null,
          },
        },
      ],
      next_cursor: null,
    });

    await act(async () => {
      root.render(<EvidenceViewer orderId="order-1" token="mock-token" />);
    });

    expect(container.textContent).toContain('No screenshot attached (buyer submitted manually)');
  });

  it('renders explicit unavailable state when evidence was deleted or expired (410)', async () => {
    vi.spyOn(correctionsApi, 'fetchHistory').mockResolvedValueOnce({
      items: [
        {
          id: 'rev-1',
          revision_number: 1,
          actor: 'buyer',
          reason: null,
          created_at: '2026-10-24T12:00:00Z',
          claim_accepted_at: '2026-10-24T12:00:00Z',
          buyer_name: 'Buyer',
          contact_number: '01711111111',
          address: { raw_text: 'Dhaka' },
          payment_claim: {
            provider: 'bkash',
            trx_id: 'TRX123',
            sender_number: '01722222222',
            amount_minor: 50000,
            evidence_id: 'ev-deleted-123',
          },
        },
      ],
      next_cursor: null,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'EVIDENCE_UNAVAILABLE' } }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await act(async () => {
      root.render(<EvidenceViewer orderId="order-1" token="mock-token" />);
    });

    expect(container.textContent).toContain(
      'Evidence unavailable: raw copy was deleted or expired after 30 days',
    );
  });

  it('renders image preview when evidence is successfully retrieved', async () => {
    vi.spyOn(correctionsApi, 'fetchHistory').mockResolvedValueOnce({
      items: [
        {
          id: 'rev-1',
          revision_number: 1,
          actor: 'buyer',
          reason: null,
          created_at: '2026-10-24T12:00:00Z',
          claim_accepted_at: '2026-10-24T12:00:00Z',
          buyer_name: 'Buyer',
          contact_number: '01711111111',
          address: { raw_text: 'Dhaka' },
          payment_claim: {
            provider: 'bkash',
            trx_id: 'TRX123',
            sender_number: '01722222222',
            amount_minor: 50000,
            evidence_id: 'ev-active-123',
          },
        },
      ],
      next_cursor: null,
    });

    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob');
    window.URL.revokeObjectURL = vi.fn();

    await act(async () => {
      root.render(<EvidenceViewer orderId="order-1" token="mock-token" />);
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:http://localhost/mock-blob');
    expect(container.textContent).toContain('Open Full Size');
  });
});
