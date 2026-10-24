import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AddressAssistance } from './AddressAssistance';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

function Harness() {
  const [address, setAddress] = useState('Dhaka');
  return <><output>{address}</output><button onClick={() => setAddress('Reviewed manually')}>Manual edit</button>
    <AddressAssistance portalToken="token" address={address} onUse={setAddress} disabled={false} /></>;
}
function button(text: string): HTMLButtonElement {
  const result = [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text));
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}
const result = { available: true, review_required: true, message: 'Review', suggestions: {
  district: 'Dhaka', thana: null, area: 'Mirpur', street_line: null, landmark: null, needs_clarification: true, clarification_question: 'Which road?',
} };

it('keeps the manual address when all suggestions are unknown', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ...result, suggestions: {
    district: null, thana: null, area: null, street_line: null, landmark: null, needs_clarification: true, clarification_question: 'Please provide a readable address',
  } })));
  await act(async () => root.render(<Harness />));
  await act(async () => button('Send address').click());
  expect(container.textContent).toContain('Please provide a readable address');
  await act(async () => button('Use reviewed').click());
  expect(container.querySelector('output')?.textContent).toBe('Dhaka');
});

it('keeps manual input after an offline request', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
  await act(async () => root.render(<Harness />));
  await act(async () => button('Send address').click());
  expect(container.textContent).toContain('Enter your address manually');
  expect(container.querySelector('output')?.textContent).toBe('Dhaka');
});

it('discloses transfer before opt-in and applies only reviewed editable suggestions', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(result)));
  await act(async () => root.render(<Harness />));
  expect(container.textContent).toContain('Gemini');
  expect(container.textContent).toContain('30 days');
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => button('Send address').click());
  expect(container.querySelector('output')?.textContent).toBe('Dhaka');
  expect(container.textContent).toContain('Which road?');
  await act(async () => button('Use reviewed').click());
  expect(container.querySelector('output')?.textContent).toBe('Mirpur, Dhaka');
});

it('discards a late response after manual edits', async () => {
  let resolve!: (response: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(done => { resolve = done; }));
  await act(async () => root.render(<Harness />));
  await act(async () => button('Send address').click());
  await act(async () => button('Manual edit').click());
  await act(async () => resolve(new Response(JSON.stringify(result))));
  expect(container.querySelector('output')?.textContent).toBe('Reviewed manually');
  expect(container.textContent).not.toContain('Use reviewed');
});

it.each([{}, { ...result, suggestions: { district: 42 } }, { ...result, available: false, suggestions: null }])('keeps manual entry usable for invalid or unavailable output', async (body) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
  await act(async () => root.render(<Harness />));
  await act(async () => button('Send address').click());
  expect(container.textContent).toContain('Enter your address manually');
  await act(async () => button('Manual edit').click());
  expect(container.querySelector('output')?.textContent).toBe('Reviewed manually');
});

