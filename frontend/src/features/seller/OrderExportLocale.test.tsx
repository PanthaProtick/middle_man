import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { OrderExport } from './OrderExport';
import { OrderList } from './OrderList';

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

async function switchTo(host: HTMLElement, label: 'বাংলা' | 'English'): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === label);
  if (!button) throw new Error(`Missing locale button: ${label}`);
  await act(async () => button.click());
}

const statusText = (host: HTMLElement): string | undefined =>
  host.querySelector('p[role="status"]')?.textContent ?? undefined;
const alertText = (host: HTMLElement): string | undefined =>
  host.querySelector('p[role="alert"]')?.textContent ?? undefined;

it('renders a Bengali summary with verbatim Unicode data, localized lifecycle and purpose', async () => {
  localStorage.setItem('middleman.locale', 'bn');
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard(writeText);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(summary({
    product: 'ব্যাগ ১২', buyer_name: 'রহিম উদ্দিন', address: 'ঢাকা, মিরপুর ১০',
    accepted_advance_bdt: '', actual_cod_bdt: '',
  }))));
  const { host, root } = await mount(<LocaleProvider><OrderExport orderId="order-1" /></LocaleProvider>);
  await click(host, 'ডেলিভারির সারসংক্ষেপ কপি করুন');
  const copied = writeText.mock.calls[0][0] as string;
  expect(copied).toContain('অর্ডার: order-1');
  expect(copied).toContain('পণ্য: ব্যাগ ১২');
  expect(copied).toContain('অবস্থা: নিশ্চিত করা');
  expect(copied).toContain('ক্রেতা: রহিম উদ্দিন');
  expect(copied).toContain('যোগাযোগ: 01711111111');
  expect(copied).toContain('ঠিকানা: ঢাকা, মিরপুর ১০');
  expect(copied).toContain('সম্মত মোট মূল্য: BDT 100.00');
  expect(copied).toContain('ডেলিভারির আগে প্রয়োজনীয় অগ্রিম: BDT 20.00');
  expect(copied).toContain('গৃহীত ডেলিভারির আগে অগ্রিম: গ্রহণ করা হয়নি');
  expect(copied).toContain('ডেলিভারির সময় সম্ভাব্য বাকি পরিশোধ: BDT 80.00');
  expect(copied).toContain('ডেলিভারির সময় বাকি পরিশোধ: গ্রহণ করা হয়নি');
  expect(copied).toContain('ম্যানুয়াল ডেলিভারির সহায়তার জন্য');
  expect(copied).not.toContain('Manual delivery aid');
  expect(host.textContent).toContain('ম্যানুয়াল ডেলিভারির সহায়তার জন্য');
  expect(statusText(host)).toBe('সারসংক্ষেপ কপি হয়েছে।');
  await act(async () => root.unmount());
});

it.each(['en', 'bn'] as const)('shows unaccepted advance and COD without inventing amounts in %s', async locale => {
  localStorage.setItem('middleman.locale', locale);
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard(writeText);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(summary({
    accepted_advance_bdt: '', actual_cod_bdt: '',
  }))));
  const { host, root } = await mount(<LocaleProvider><OrderExport orderId="order-1" /></LocaleProvider>);
  await click(host, locale === 'bn' ? 'ডেলিভারির সারসংক্ষেপ কপি করুন' : 'Copy delivery summary');
  const copied = writeText.mock.calls[0][0] as string;
  const notAccepted = locale === 'bn' ? 'গ্রহণ করা হয়নি' : 'Not accepted';
  expect(copied).toContain(`${locale === 'bn' ? 'গৃহীত ডেলিভারির আগে অগ্রিম' : 'Accepted advance'}: ${notAccepted}`);
  expect(copied).toContain(`${locale === 'bn' ? 'ডেলিভারির সময় বাকি পরিশোধ' : 'Actual COD'}: ${notAccepted}`);
  expect(copied).not.toContain('BDT undefined');
  await act(async () => root.unmount());
});

it.each([
  ['en', 429, 'Too many export requests'],
  ['en', 422, 'Too many orders to export'],
  ['en', 503, 'CSV download is unavailable'],
  ['en', 500, 'Copy or CSV download is unavailable'],
  ['bn', 429, 'অনেকবার ডাউনলোডের অনুরোধ'],
  ['bn', 422, 'অর্ডারের সংখ্যা বেশি'],
  ['bn', 503, 'CSV ডাউনলোড করা যাচ্ছে না'],
  ['bn', 500, 'কপি বা CSV ডাউনলোড'],
] as const)('maps %s HTTP %i export failures to safe localized guidance', async (locale, httpStatus, expected) => {
  localStorage.setItem('middleman.locale', locale);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { message: 'raw provider trace' } }), { status: httpStatus }),
  );
  const { host, root } = await mount(<LocaleProvider><OrderExport token="seller-token" /></LocaleProvider>);
  await click(host, locale === 'bn' ? 'ইংরেজি CSV ডাউনলোড করুন' : 'Download English CSV');
  expect(alertText(host)).toContain(expected);
  expect(alertText(host)).not.toContain('raw provider trace');
  expect(statusText(host)).toBeUndefined();
  await act(async () => root.unmount());
});

it('re-renders a pending export in the new language without a second request or download', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const { createObjectURL, click: anchorClick } = stubDownload();
  let finish: (response: Response) => void = () => {};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => new Promise(resolve => { finish = resolve; }),
  );
  const { host, root } = await mount(<LocaleProvider><LocaleSwitch /><OrderExport token="seller-token" /></LocaleProvider>);
  const button = findButton(host, 'Download English CSV');
  await act(async () => button.click());
  expect(button.disabled).toBe(true);
  await switchTo(host, 'বাংলা');
  expect(button.textContent).toContain('প্রস্তুত করা হচ্ছে');
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.disabled).toBe(true);
  await act(async () => finish(new Response('"order_id"\r\n"one"', { headers: { 'X-Export-Count': '1' } })));
  expect(fetcher).toHaveBeenCalledOnce();
  expect(anchorClick).toHaveBeenCalledOnce();
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(statusText(host)).toBe('ইংরেজি CSV ডাউনলোড শুরু হয়েছে।');
  await act(async () => root.unmount());
});

it('renders copied feedback in the new language without copying again', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard(writeText);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(summary())));
  const { host, root } = await mount(<LocaleProvider><LocaleSwitch /><OrderExport orderId="order-1" /></LocaleProvider>);
  await click(host, 'Copy delivery summary');
  expect(statusText(host)).toBe('Summary copied.');
  const firstCopy = writeText.mock.calls[0][0] as string;
  await switchTo(host, 'বাংলা');
  expect(statusText(host)).toBe('সারসংক্ষেপ কপি হয়েছে।');
  expect(writeText).toHaveBeenCalledOnce();
  expect(writeText.mock.calls[0][0]).toBe(firstCopy);
  expect(fetcher).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it('renders empty-export feedback in the new language without another request', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('header\r\n', {
    headers: { 'X-Export-Count': '0' },
  }));
  const { host, root } = await mount(
    <LocaleProvider><LocaleSwitch /><OrderExport status="confirmed" /></LocaleProvider>,
  );
  await click(host, 'Download filtered English CSV');
  expect(statusText(host)).toBe('No orders match this filter.');
  await switchTo(host, 'বাংলা');
  expect(statusText(host)).toBe('এই ফিল্টারে কোনো অর্ডার নেই।');
  expect(fetcher).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it('renders export error feedback in the new language without retrying', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { message: 'raw provider trace' } }), { status: 429 }),
  );
  const { host, root } = await mount(<LocaleProvider><LocaleSwitch /><OrderExport token="seller-token" /></LocaleProvider>);
  await click(host, 'Download English CSV');
  expect(alertText(host)).toContain('Too many export requests');
  await switchTo(host, 'বাংলা');
  expect(alertText(host)).toContain('অনেকবার ডাউনলোডের অনুরোধ');
  expect(alertText(host)).not.toContain('raw provider trace');
  expect(fetcher).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it('clears stale empty-export feedback when the order lifecycle filter changes', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('header\r\n', {
    headers: { 'X-Export-Count': '0' },
  }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (status: string) => root.render(<OrderList orders={[]} statusFilter={status}
    onFilterChange={() => {}} nextCursor={null} onLoadMore={() => {}} />);
  await act(async () => render('pending'));
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('No orders match this filter');
  await act(async () => render('confirmed'));
  expect(host.textContent).not.toContain('No orders match this filter');
  await act(async () => root.unmount());
});
