import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { TransactionInbox } from './TransactionInbox';
import { ManualTransactionModal } from './ManualTransactionModal';
import { fetchTransactions, recordManualTransaction } from './api';
import type { PaymentAccount, ReceiptView } from './types';

describe('Transaction API & Inbox UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchTransactions sends correct query parameters and authorization header', async () => {
    const mockRes = { items: [], next_cursor: null };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockRes), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await fetchTransactions({ review: 'conflicted', cursor: 'cur-1' }, 'mock-token');
    expect(res.items).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/seller/transactions?cursor=cur-1&review=conflicted'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });

  it('recordManualTransaction sends payload and Idempotency-Key', async () => {
    const mockTx: ReceiptView = {
      id: 'tx-1',
      shop_id: 's1',
      payment_account_id: 'acc-1',
      provider: 'bkash',
      trx_id: 'TRX123',
      amount_minor: 15000,
      sender_number_raw: '01711111111',
      sender_number_canonical: '01711111111',
      occurred_at: '2026-10-24T10:00:00Z',
      reconciliation_state: 'unmatched',
      has_conflict: false,
      version: 1,
      created_at: '2026-10-24T10:00:00Z',
      updated_at: '2026-10-24T10:00:00Z',
      observations: [],
      related_claims_count: 0,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockTx), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await recordManualTransaction(
      {
        payment_account_id: 'acc-1',
        provider: 'bkash',
        trx_id: 'TRX123',
        amount_minor: 15000,
        sender_number: '01711111111',
      },
      'key-abc',
      'mock-token'
    );

    expect(res.trx_id).toBe('TRX123');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seller\/transactions$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'key-abc',
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });

  it('renders TransactionInbox with status badges and expands observations on click', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mockTransactions: ReceiptView[] = [
      {
        id: 'tx-1',
        shop_id: 's1',
        payment_account_id: 'acc-1',
        provider: 'bkash',
        trx_id: 'TRX_COMPLETE',
        amount_minor: 25000,
        sender_number_raw: '01711111111',
        sender_number_canonical: '01711111111',
        occurred_at: '2026-10-24T10:00:00Z',
        reconciliation_state: 'unmatched',
        has_conflict: false,
        version: 1,
        created_at: '2026-10-24T10:00:00Z',
        updated_at: '2026-10-24T10:00:00Z',
        observations: [
          {
            id: 'obs-1',
            provider: 'bkash', trx_id: 'TRX_COMPLETE',
            transaction_id: 'tx-1',
            payment_account_id: 'acc-1',
            source: 'manual',
            actor: 'seller_1',
            amount_minor: 25000,
            sender_number_raw: '01711111111',
            sender_number_canonical: '01711111111',
            occurred_at: '2026-10-24T10:00:00Z',
            parse_state: 'valid',
            conflict_state: 'none',
            created_at: '2026-10-24T10:00:00Z',
          },
        ],
        related_claims_count: 0,
      },
      {
        id: 'tx-2',
        shop_id: 's1',
        payment_account_id: 'acc-1',
        provider: 'nagad',
        trx_id: 'TRX_CONFLICTED',
        amount_minor: 50000,
        sender_number_raw: null,
        sender_number_canonical: null,
        occurred_at: null,
        reconciliation_state: 'conflicted',
        has_conflict: true,
        version: 2,
        created_at: '2026-10-24T11:00:00Z',
        updated_at: '2026-10-24T11:05:00Z',
        observations: [
          {
            id: 'obs-2',
            provider: 'nagad', trx_id: 'TRX_CONFLICTED',
            transaction_id: 'tx-2',
            payment_account_id: 'acc-1',
            source: 'manual',
            actor: 'seller_1',
            amount_minor: 50000,
            sender_number_raw: null,
            sender_number_canonical: null,
            occurred_at: null,
            parse_state: 'incomplete',
            conflict_state: 'none',
            created_at: '2026-10-24T11:00:00Z',
          },
          {
            id: 'obs-3',
            provider: 'nagad', trx_id: 'TRX_CONFLICTED',
            transaction_id: 'tx-2',
            payment_account_id: 'acc-1',
            source: 'manual',
            actor: 'seller_1',
            amount_minor: 75000,
            sender_number_raw: null,
            sender_number_canonical: null,
            occurred_at: null,
            parse_state: 'incomplete',
            conflict_state: 'conflicting',
            created_at: '2026-10-24T11:05:00Z',
          },
        ],
        related_claims_count: 0,
      },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(TransactionInbox, {
          transactions: mockTransactions,
          filter: '',
          onFilterChange: vi.fn(),
        })
      );
    });

    expect(container.textContent).toContain('TRX_COMPLETE');
    expect(container.textContent).toContain('৳250.00');
    expect(container.textContent).toContain('TRX_CONFLICTED');
    expect(container.textContent).toContain('৳500.00');
    expect(container.textContent).toContain('Conflicting Observations');

    // Click to expand TRX_CONFLICTED observations
    const clickableRow = container.querySelector('[data-testid="tx-header-tx-2"]') as HTMLElement;
    expect(clickableRow).not.toBeNull();

    await act(async () => {
      clickableRow.click();
    });

    expect(container.textContent).toContain('Recorded Observations (2)');
    expect(container.textContent).toContain('Observation #2 (MANUAL)');
    expect(container.textContent).toContain('Status: conflicting');
  });

  it('renders ManualTransactionModal and validates inputs before submitting', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mockAccounts: PaymentAccount[] = [
      {
        id: 'acc-1',
        shop_id: 's1',
        provider: 'bkash',
        receiving_number: '01711111111',
        label: 'Main bKash',
        is_active: true,
        version: 1,
        created_at: '2026-10-24T00:00:00Z',
        updated_at: '2026-10-24T00:00:00Z',
      },
    ];

    const onClose = vi.fn();
    const onTransactionRecorded = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(ManualTransactionModal, {
          accounts: mockAccounts,
          onClose,
          onTransactionRecorded,
        })
      );
    });

    expect(container.textContent).toContain('Record Received Payment');

    // Submit without TrxID and Amount -> validation errors
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Record Payment')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('TrxID is required');
    expect(container.textContent).toContain('Actual received amount must be greater than 0');
  });
});
