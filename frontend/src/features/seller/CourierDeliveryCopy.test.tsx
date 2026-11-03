import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierCopyField } from './CourierCopyField';
import { CourierReview } from './CourierReview';
import { baseReview } from './courierPostSubmissionTestData';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  document.body.innerHTML = '';
});

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

it('copies the recipient, phone, address and COD from the current review', async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  setClipboard(writeText);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(
    String(url).includes('/locations?') ? { choices: [] } : baseReview,
  )));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierReview orderId="order-1" token="seller" />));

  const copy = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Copy delivery details')!;
  await act(async () => copy.click());

  expect(writeText).toHaveBeenCalledWith('Updated Buyer\n01922222222\nUpdated Address 789\nCOD: BDT 5000.00');
  expect(host.textContent).toContain('Delivery details copied.');
  await act(async () => root.unmount());
});

it('shows a readonly manual copy field when the clipboard is unavailable', async () => {
  setClipboard(vi.fn().mockRejectedValue(new Error('Clipboard blocked')));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierCopyField label="Copy delivery details"
    fallbackLabel="Manual delivery details" value={'Recipient\n01711111111\nDhaka'} />));

  await act(async () => host.querySelector('button')!.click());

  expect(host.textContent).toContain('Copy failed. Select and copy manually.');
  expect(host.textContent).toContain('Manual delivery details');
  const manual = host.querySelector<HTMLTextAreaElement>('textarea')!;
  expect(manual.readOnly).toBe(true);
  expect(manual.value).toBe('Recipient\n01711111111\nDhaka');
  await act(async () => root.unmount());
});
