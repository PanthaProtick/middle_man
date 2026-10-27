import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvidenceRetentionPanel } from './EvidenceRetentionPanel';
import * as retentionApi from './retentionApi';
import type { RetentionStatusResponse, RetentionCleanupResponse } from './types';

describe('EvidenceRetentionPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const mockCleanStatus: RetentionStatusResponse = {
    shop_id: 'shop-123',
    checked_at: '2026-10-24T12:00:00Z',
    counts: {
      sms_active: 2,
      sms_purged: 5,
      ai_extractions_active: 1,
      ai_extractions_purged: 4,
    },
    overdue_count: 0,
    failed_count: 0,
    last_cleanup_at: '2026-10-24T10:00:00Z',
    overdue_items: [],
  };

  const mockOverdueStatus: RetentionStatusResponse = {
    shop_id: 'shop-123',
    checked_at: '2026-10-24T12:00:00Z',
    counts: {
      sms_active: 3,
      sms_purged: 1,
      ai_extractions_active: 2,
      ai_extractions_purged: 0,
    },
    overdue_count: 2,
    failed_count: 1,
    last_cleanup_at: '2026-10-23T10:00:00Z',
    overdue_items: [
      {
        evidence_type: 'address_ai',
        evidence_id: 'ev-overdue-1',
        order_id: 'ord-101',
        delete_after: '2026-10-20T10:00:00Z',
        error: 'Cleanup overdue: retained beyond 30 days',
      },
      {
        evidence_type: 'sms',
        evidence_id: 'sms-overdue-2',
        delete_after: '2026-10-21T10:00:00Z',
        error: 'Cleanup overdue: raw SMS retained beyond 30 days',
      },
    ],
  };

  it('renders clean retention status when no items are overdue', async () => {
    vi.spyOn(retentionApi, 'fetchRetentionStatus').mockResolvedValue(mockCleanStatus);

    const root = createRoot(container);
    await act(async () => {
      root.render(<EvidenceRetentionPanel token="mock-token" />);
    });

    expect(container.textContent).toContain('30-Day Raw Evidence Retention');
    expect(container.textContent).toContain('Raw evidence clean');
    expect(container.textContent).toContain('2 retained / 5 purged');
  });

  it('displays warning and lists overdue items when cleanup is needed', async () => {
    vi.spyOn(retentionApi, 'fetchRetentionStatus').mockResolvedValue(mockOverdueStatus);

    const root = createRoot(container);
    await act(async () => {
      root.render(<EvidenceRetentionPanel token="mock-token" />);
    });

    expect(container.textContent).toContain('2 raw evidence items overdue');
    expect(container.textContent).toContain('ev-overdue-1');
    expect(container.textContent).toContain('sms-overdue-2');
  });

  it('triggers cleanup and refreshes retention status on button click', async () => {
    vi.spyOn(retentionApi, 'fetchRetentionStatus')
      .mockResolvedValueOnce(mockOverdueStatus)
      .mockResolvedValueOnce(mockCleanStatus);

    const cleanupMock = vi.spyOn(retentionApi, 'runRetentionCleanup').mockResolvedValue({
      shop_id: 'shop-123',
      ran_at: '2026-10-24T12:05:00Z',
      items_purged: 2,
      items_failed: 0,
      overdue_remaining: 0,
      status: 'clean',
      failures: [],
    } as RetentionCleanupResponse);

    const root = createRoot(container);
    await act(async () => {
      root.render(<EvidenceRetentionPanel token="mock-token" />);
    });

    const cleanupBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run Evidence Cleanup'),
    );
    expect(cleanupBtn).toBeDefined();

    await act(async () => {
      cleanupBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cleanupMock).toHaveBeenCalledWith('mock-token');
    expect(container.textContent).toContain('Purged 2 raw items');
  });

  it('displays failure alert when cleanup throws error and allows safe retry', async () => {
    vi.spyOn(retentionApi, 'fetchRetentionStatus')
      .mockResolvedValueOnce(mockOverdueStatus)
      .mockResolvedValueOnce(mockCleanStatus);

    const cleanupMock = vi
      .spyOn(retentionApi, 'runRetentionCleanup')
      .mockRejectedValueOnce(new Error('Storage service unavailable: failed to remove file'))
      .mockResolvedValueOnce({
        shop_id: 'shop-123',
        ran_at: '2026-10-24T12:05:00Z',
        items_purged: 2,
        items_failed: 0,
        overdue_remaining: 0,
        status: 'clean',
        failures: [],
      } as RetentionCleanupResponse);

    const root = createRoot(container);
    await act(async () => {
      root.render(<EvidenceRetentionPanel token="mock-token" />);
    });

    const cleanupBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run Evidence Cleanup'),
    );
    expect(cleanupBtn).toBeDefined();

    // First attempt fails with storage error
    await act(async () => {
      cleanupBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Storage service unavailable: failed to remove file');
    expect(cleanupBtn?.hasAttribute('disabled')).toBe(false);

    // Second attempt (retry) succeeds after recovery
    await act(async () => {
      cleanupBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cleanupMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Purged 2 raw items');
    expect(container.textContent).toContain('Raw evidence clean');
  });

  it('displays partial failure feedback and overdue items when some deletions fail', async () => {
    const mockPartialStatus: RetentionStatusResponse = {
      ...mockOverdueStatus,
      overdue_count: 1,
      failed_count: 1,
      overdue_items: [mockOverdueStatus.overdue_items[0]],
    };

    vi.spyOn(retentionApi, 'fetchRetentionStatus')
      .mockResolvedValueOnce(mockOverdueStatus)
      .mockResolvedValueOnce(mockPartialStatus);

    vi.spyOn(retentionApi, 'runRetentionCleanup').mockResolvedValue({
      shop_id: 'shop-123',
      ran_at: '2026-10-24T12:05:00Z',
      items_purged: 1,
      items_failed: 1,
      overdue_remaining: 1,
      status: 'partial_failure',
      failures: [
        {
          evidence_type: 'address_ai',
          evidence_id: 'ev-overdue-1',
          order_id: 'ord-101',
          delete_after: '2026-10-20T10:00:00Z',
          error: 'Storage service unavailable: failed to remove file',
        },
      ],
    } as RetentionCleanupResponse);

    const root = createRoot(container);
    await act(async () => {
      root.render(<EvidenceRetentionPanel token="mock-token" />);
    });

    const cleanupBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run Evidence Cleanup'),
    );

    await act(async () => {
      cleanupBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Purged 1 raw items (1 failed, 1 overdue remaining).');
    expect(container.textContent).toContain('1 raw evidence items overdue');
    expect(container.textContent).toContain('(1 storage failure)');
    expect(container.textContent).toContain('ev-overdue-1');
  });
});
