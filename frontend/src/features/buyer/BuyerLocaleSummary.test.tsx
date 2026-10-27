import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerPortal } from './BuyerPortal';
import type { PublicOrder } from './types';
import { awaitingOrder, buyerSummaryCard, findLanguageButton } from './buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

async function renderPortal(locale: 'bn' | 'en', order: PublicOrder = awaitingOrder): Promise<void> {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(order)));
  await act(async () => {
    root.render(
      <LocaleProvider>
        <LocaleSwitch />
        <BuyerPortal portalToken="token" />
      </LocaleProvider>,
    );
  });
}

describe('Buyer order summary in Bengali', () => {
  it('translates terms and payment instructions while preserving shop, product, and account data', async () => {
    await renderPortal('bn');
    const text = buyerSummaryCard(container).textContent ?? '';

    expect(text).toContain('আপনার অর্ডার');
    expect(text).toContain('পণ্য');
    expect(text).toContain('মোট মূল্য');
    expect(text).toContain('ডেলিভারির আগে অগ্রিম');
    expect(text).toContain('ডেলিভারির সময় আনুমানিক বাকি পরিশোধ');
    expect(text).toContain('অগ্রিম পাঠানোর নাম্বার');
    expect(text).toContain('মেয়াদ শেষ হবে');

    // Shop, product, provider label and the receiving number are unchanged.
    expect(text).toContain('Smart Gadget Shop');
    expect(text).toContain('Wireless Bluetooth Earbuds');
    expect(text).toContain('Shop Official bKash');
    expect(text).toContain('01712345678');

    // Money uses 0-9 digits with unchanged precision.
    expect(text).toContain('৳3,500.00');
    expect(text).toContain('৳500.00');
    expect(text).toContain('৳3,000.00');
    expect(text).not.toMatch(/[০-৯]/);

    // Dates use a Bengali Gregorian month name and Bangladesh time.
    expect(text).toContain('25 অক্টোবর 2026');
    expect(document.documentElement.lang).toBe('bn-BD');

    // Paired bilingual labels are gone in the selected language.
    expect(text).not.toContain('Total / মোট মূল্য');
    expect(text).not.toContain('Your order / আপনার অর্ডার');
  });

  it('renders an English-only summary when English is selected', async () => {
    await renderPortal('en');
    const text = buyerSummaryCard(container).textContent ?? '';

    expect(text).toContain('Your order');
    expect(text).toContain('Delivery advance');
    expect(text).toContain('Expected remaining COD');
    expect(text).toContain('Valid until');
    expect(text).toContain('25 Oct 2026');
    expect(text).not.toContain('মোট মূল্য');
    expect(text).not.toContain('ডেলিভারির আগে অগ্রিম');
  });

  it('uses the accepted advance to explain the remaining balance after confirmation', async () => {
    await renderPortal('bn', { ...awaitingOrder, lifecycle: 'confirmed', actual_cod_minor: 280000 });
    const text = buyerSummaryCard(container).textContent ?? '';

    expect(text).toContain('ডেলিভারির সময় বাকি পরিশোধ');
    expect(text).toContain('৳2,800.00');
    expect(text).toContain('বিক্রেতার গ্রহণ করা অগ্রিম');
    expect(text).toContain('৳700.00');
    expect(text).not.toContain('ডেলিভারির সময় আনুমানিক বাকি পরিশোধ');
    expect(text).toContain('অর্ডার ডেলিভারির সময় এই টাকা পরিশোধ করুন।');
  });

  it('translates copy feedback and preserves the copied number', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    await renderPortal('bn');

    const copyButton = container.querySelector<HTMLButtonElement>('[data-testid="copy-receiving-btn"]');
    expect(copyButton).not.toBeNull();
    await act(async () => copyButton?.click());

    expect(writeText).toHaveBeenCalledWith('01712345678');
    expect(copyButton?.textContent).toContain('কপি হয়েছে');
    expect(copyButton?.textContent).not.toContain('Copied');
  });

  it('explains an unavailable copy action in Bengali', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
      writable: true,
    });
    await renderPortal('bn');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="copy-receiving-btn"]')?.click();
    });

    expect(container.textContent).toContain('কপি করা যায়নি। নাম্বারটি নিজে নির্বাচন করে কপি করুন।');
  });
});

describe('Switching buyer language', () => {
  it('preserves form values and makes no extra requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(awaitingOrder)));
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
    await act(async () => root.render(
      <LocaleProvider>
        <LocaleSwitch />
        <BuyerPortal portalToken="token" />
      </LocaleProvider>,
    ));

    const nameInput = container.querySelector<HTMLInputElement>('input[name="buyer_name"]');
    if (!nameInput) throw new Error('Missing buyer name input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(nameInput, 'রহিম উদ্দিন');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const orderReads = () => fetchMock.mock.calls
      .filter(([url]) => url === '/api/public/orders/token').length;
    expect(orderReads()).toBe(1);

    await act(async () => findLanguageButton(container, 'English').click());

    expect(container.querySelector<HTMLInputElement>('input[name="buyer_name"]')?.value).toBe('রহিম উদ্দিন');
    expect(buyerSummaryCard(container).textContent).toContain('Delivery advance');
    expect(document.documentElement.lang).toBe('en');
    expect(orderReads()).toBe(1);

    await act(async () => findLanguageButton(container, 'বাংলা').click());

    expect(container.querySelector<HTMLInputElement>('input[name="buyer_name"]')?.value).toBe('রহিম উদ্দিন');
    expect(buyerSummaryCard(container).textContent).toContain('ডেলিভারির আগে অগ্রিম');
    expect(orderReads()).toBe(1);
  });
});
