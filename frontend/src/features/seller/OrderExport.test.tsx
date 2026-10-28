import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderExport } from './OrderExport';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
});

interface SummaryOverrides {
  product?: string;
  buyer_name?: string;
  address?: string;
  accepted_advance_bdt?: string;
  actual_cod_bdt?: string;
}

function summary(overrides: SummaryOverrides = {}): Record<string, string> {
  return {
    order_id: 'order-1', product: 'Bag', lifecycle: 'confirmed', buyer_name: 'Buyer',
    contact_number: '01711111111', address: 'Dhaka', total_bdt: '100.00',
    required_advance_bdt: '20.00', accepted_advance_bdt: '30.00',
    expected_cod_bdt: '80.00', actual_cod_bdt: '70.00',
    purpose: 'Manual delivery aid only', ...overrides,
  };
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

function stubDownload() {
  const createObjectURL = vi.fn().mockReturnValue('blob:export');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL, click };
}

async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

function findButton(host: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

async function click(host: HTMLElement, label: string): Promise<HTMLButtonElement> {
  const button = findButton(host, label);
  await act(async () => button.click());
  return button;
}

const statusText = (host: HTMLElement): string | undefined =>
  host.querySelector('p[role="status"]')?.textContent ?? undefined;
const alertText = (host: HTMLElement): string | undefined =>
  host.querySelector('p[role="alert"]')?.textContent ?? undefined;

it('copies an authenticated summary with every label in English without decorative glyphs', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard(writeText);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(summary())));
  const { host, root } = await mount(<OrderExport orderId="order-1" token="seller-token" />);
  await click(host, 'Copy delivery summary');
  const copied = writeText.mock.calls[0][0] as string;
  expect(copied).toContain('Order: order-1');
  expect(copied).toContain('Product: Bag');
  expect(copied).toContain('Lifecycle: Confirmed');
  expect(copied).toContain('Buyer: Buyer');
  expect(copied).toContain('Contact: 01711111111');
  expect(copied).toContain('Address: Dhaka');
  expect(copied).toContain('Fixed total: BDT 100.00');
  expect(copied).toContain('Required advance: BDT 20.00');
  expect(copied).toContain('Accepted advance: BDT 30.00');
  expect(copied).toContain('Expected COD: BDT 80.00');
  expect(copied).toContain('Actual COD: BDT 70.00');
  expect(copied).toContain('Manual delivery aid only; no courier booking');
  expect(statusText(host)).toBe('Summary copied.');
  expect(statusText(host)).not.toContain('✓');
  expect(alertText(host)).toBeUndefined();
  expect(fetcher.mock.calls[0][0]).toBe('/api/seller/orders/order-1/summary');
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer seller-token' });
  await act(async () => root.unmount());
});

it('restores keyboard focus to the export button after the operation settles', async () => {
  let finish: (response: Response) => void = () => {};
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => new Promise(resolve => { finish = resolve; }),
  );
  stubDownload();
  const { host, root } = await mount(<OrderExport token="seller-token" />);
  const button = findButton(host, 'Download English CSV');
  button.focus();
  expect(document.activeElement).toBe(button);
  await act(async () => button.click());
  expect(button.disabled).toBe(true);
  await act(async () => finish(new Response('"order_id"\r\n"one"', { headers: { 'X-Export-Count': '1' } })));
  expect(button.disabled).toBe(false);
  expect(document.activeElement).toBe(button);
  await act(async () => root.unmount());
});

it('shows localized progress, downloads the English CSV blob, and reports 503 with secondary technical detail', async () => {
  const { createObjectURL, click: anchorClick } = stubDownload();
  let finish: (response: Response) => void = () => {};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => new Promise(resolve => { finish = resolve; }),
  );
  const { host, root } = await mount(<OrderExport token="seller-token" />);
  const button = findButton(host, 'Download English CSV');
  await act(async () => button.click());
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.textContent).toContain('Preparing');
  expect(button.getAttribute('aria-describedby')).toBeNull();
  await act(async () => finish(new Response('"order_id"\r\n"one"', { headers: { 'X-Export-Count': '1' } })));
  expect(statusText(host)).toBe('English CSV download started.');
  expect(button.getAttribute('aria-describedby')).toBe(host.querySelector('p[role="status"]')!.id);
  expect(anchorClick).toHaveBeenCalledOnce();
  expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);

  fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'db connection failure' } }), { status: 503 }));
  await act(async () => button.click());
  expect(alertText(host)).toBe('CSV download is unavailable right now. Please retry.');
  expect(alertText(host)).not.toContain('⚠');
  expect(alertText(host)).not.toContain('db connection failure');
  const details = host.querySelector('details');
  expect(details).toBeTruthy();
  expect(details?.querySelector('summary')?.textContent).toBe('View technical details');
  expect(details?.querySelector('pre')?.textContent).toContain('db connection failure');
  expect(anchorClick).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it('maps summary copy 503 failures to order summary unavailable rather than CSV download', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'EXPORT_UNAVAILABLE', message: 'timeout' } }), { status: 503 }),
  );
  const { host, root } = await mount(<OrderExport orderId="order-1" token="seller-token" />);
  await click(host, 'Copy delivery summary');
  expect(alertText(host)).toBe('Order summary is unavailable right now. Please retry.');
  expect(alertText(host)).not.toContain('CSV');
  const details = host.querySelector('details');
  expect(details?.querySelector('pre')?.textContent).toContain('timeout');
  await act(async () => root.unmount());
});

it('reports clipboard denial safely and retains technical trace under details', async () => {
  stubClipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError: permission denied')));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(summary())));
  const { host, root } = await mount(<OrderExport orderId="order-1" />);
  await click(host, 'Copy delivery summary');
  expect(alertText(host)).toBe('Could not copy the summary. Please retry.');
  expect(alertText(host)).not.toContain('NotAllowedError');
  expect(host.querySelector('details pre')?.textContent).toContain('NotAllowedError: permission denied');
  expect(statusText(host)).toBeUndefined();
  await act(async () => root.unmount());
});

it('identifies English CSV downloads and reports empty exports in English', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('header\r\n', {
    headers: { 'X-Export-Count': '0' },
  }));
  const { host, root } = await mount(<OrderExport status="confirmed" token="seller-token" />);
  const filtered = 'Download filtered English CSV';
  expect(findButton(host, filtered)).toBeTruthy();
  await click(host, filtered);
  expect(fetcher.mock.calls[0][0]).toBe('/api/seller/orders/export?status=confirmed');
  expect(statusText(host)).toBe('No orders match this filter.');
  await act(async () => root.unmount());
});
