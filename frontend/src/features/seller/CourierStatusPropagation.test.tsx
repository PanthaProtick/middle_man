import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderDetailModal } from './OrderDetailModal';
import { baseReview, mockOrder } from './courierPostSubmissionTestData';
import type { CourierAttemptStatus, Review } from './courierReviewTypes';

vi.mock('./CourierDraft', () => ({ CourierDraft: () => null }));
vi.mock('./OrderExport', () => ({ OrderExport: () => null }));
vi.mock('./EvidenceViewer', () => ({ EvidenceViewer: () => null }));
vi.mock('./BuyerLinkAccess', () => ({ BuyerLinkAccess: () => null }));
vi.mock('./BuyerCorrection', () => ({ BuyerCorrection: ({ courierAttemptStatus }: {
  courierAttemptStatus: CourierAttemptStatus | null;
}) => <p>Correction status: {courierAttemptStatus ?? 'unverified'}</p> }));

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

function deferredResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = (data: unknown) => new Response(JSON.stringify(data));
function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(label));
  expect(button).toBeDefined(); button!.click();
}

it.each(['delayed', 'failed'] as const)('keeps cancellation conservative when initial review is %s', async mode => {
  const review = deferredResponse();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input =>
    String(input).endsWith('courier-review') ? review.promise : response([]));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<OrderDetailModal order={mockOrder} token="seller" onClose={vi.fn()} />));
  if (mode === 'failed') await act(async () => review.reject(new Error('Offline')));
  await act(async () => click(container, 'Cancel Order'));
  expect(container.textContent).toContain('Courier booking status is unavailable');
  expect(container.textContent).toContain('Correction status: unverified');
  expect(container.textContent).not.toContain('Unsubmitted courier draft');
  expect(container.textContent).not.toContain('No local courier attempt is recorded');
  await act(async () => root.unmount());
});

it.each(['success', 'unknown', 'unavailable'] as const)('propagates submission and %s recovery to sibling warnings', async outcome => {
  const submission = deferredResponse();
  const ready: Review = { ...baseReview, latest_attempt: null, delivery_mismatch: null, submission_enabled: true };
  let reads = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    if (url.includes('/locations?')) return response({ choices: [] });
    if (url.includes('/locations?')) return response({ choices: [] });
    if (url.includes('courier-submission')) return submission.promise;
    if (url.endsWith('courier-review')) {
      if (reads++ === 0) return response(ready);
      if (outcome === 'unavailable') throw new Error('Review offline');
      return response({ ...baseReview, latest_attempt: { ...baseReview.latest_attempt, status: outcome } });
    }
    return response([]);
  });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<OrderDetailModal order={mockOrder} token="seller" onClose={vi.fn()} />));
  await act(async () => click(container, 'Cancel Order'));
  expect(container.textContent).toContain('No local courier attempt is recorded');
  await act(async () => click(container, 'Submit booking'));
  expect(container.textContent).toContain('Correction status: submitting');
  expect(container.textContent).toContain('Local cancellation does not cancel the courier booking in Pathao');
  expect(container.textContent).not.toContain('No local courier attempt is recorded');
  await act(async () => submission.reject(new Error('Response interrupted')));
  expect(container.textContent).toContain(`Correction status: ${outcome === 'unavailable' ? 'unknown' : outcome}`);
  expect(container.textContent).not.toContain('No local courier attempt is recorded');
  await act(async () => root.unmount());
});

