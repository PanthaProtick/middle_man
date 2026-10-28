import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerPortal } from './BuyerPortal';
import type { PublicOrder } from './types';
import { awaitingOrder, findLanguageButton } from './buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';

const pending: PublicOrder = {
  ...awaitingOrder,
  lifecycle: 'pending',
  submission_acknowledgement: 'ACK-1',
};

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

async function render(locale: 'bn' | 'en', order: PublicOrder): Promise<void> {
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

async function renderFailure(locale: 'bn' | 'en', status: number, code: string): Promise<void> {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    error: { code, message: 'Raw English server detail' },
  }), { status }));
  await act(async () => root.render(
    <LocaleProvider><BuyerPortal portalToken="token" /></LocaleProvider>,
  ));
}

describe('Buyer lifecycle copy in Bengali', () => {
  it.each([
    ['pending', pending, 'বিক্রেতার পর্যালোচনা চলছে', 'আপনার দেওয়া পেমেন্টের তথ্য'],
    ['confirmed', { ...pending, lifecycle: 'confirmed', actual_cod_minor: 300000 }, 'অর্ডার নিশ্চিত করা হয়েছে', 'বিক্রেতা আপনার ডেলিভারির আগে অগ্রিম গ্রহণ করেছেন'],
    ['expired', { ...pending, lifecycle: 'expired' }, 'অর্ডার লিংকের মেয়াদ শেষ', '48 ঘণ্টার মধ্যে'],
    ['rejected', { ...pending, lifecycle: 'rejected' }, 'অর্ডার গ্রহণ করা হয়নি', 'বিক্রেতার সাথে যোগাযোগ করুন'],
    ['cancelled', { ...pending, lifecycle: 'cancelled' }, 'অর্ডার বাতিল করা হয়েছে', 'বিক্রেতার সাথে যোগাযোগ করুন'],
  ] as const)('renders %s state in Bengali', async (_name, order, title, body) => {
    await render('bn', order);

    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(body);
    expect(container.textContent).toContain('ACK-1');
    expect(container.querySelector('form')).toBeNull();
  });

  it('keeps remaining COD accurate for a confirmed order', async () => {
    await render('bn', { ...pending, lifecycle: 'confirmed', actual_cod_minor: 280000 });

    expect(container.textContent).toContain('ডেলিভারির সময় বাকি পরিশোধ');
    expect(container.textContent).toContain('৳2,800.00');
    expect(container.textContent).toContain('বিক্রেতার গ্রহণ করা অগ্রিম');
    expect(container.textContent).toContain('৳700.00');
  });
});

describe('Buyer loading and failure states in both languages', () => {
  it('translates the loading state in Bengali', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));
    await act(async () => root.render(
      <LocaleProvider><BuyerPortal portalToken="token" /></LocaleProvider>,
    ));

    expect(container.textContent).toContain('অর্ডার লোড হচ্ছে');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('renders a localized load failure with a retry control', async () => {
    await renderFailure('bn', 503, 'DATABASE_UNAVAILABLE');

    expect(container.textContent).toContain('অর্ডার লোড করা যায়নি। আবার চেষ্টা করুন।');
    expect(container.textContent).toContain('আবার চেষ্টা করুন');
    expect(container.textContent).not.toContain('Raw English server detail');
  });

  it('renders unavailable and expired states in English for English-preferring buyers', async () => {
    await renderFailure('en', 410, 'BUYER_LINK_REVOKED');
    expect(container.textContent).toContain('Order record unavailable. Please contact the seller.');
    expect(container.textContent).not.toContain('Raw English server detail');

    await act(async () => root.unmount());
    root = createRoot(container);
    await render('en', { ...pending, lifecycle: 'expired' });
    expect(container.textContent).toContain('Order Link Expired');
    expect(container.textContent).toContain('48-hour deadline');
  });

  it('renders an unavailable order link message instead of raw server text', async () => {
    await renderFailure('bn', 404, 'NOT_FOUND');

    expect(container.textContent).toContain('অর্ডারের তথ্য পাওয়া যাচ্ছে না। বিক্রেতার সাথে যোগাযোগ করুন।');
    expect(container.textContent).not.toContain('Raw English server detail');
  });

  it('renders the policy gate in Bengali without exposing the internal detail', async () => {
    await renderFailure('bn', 503, 'PUBLIC_ACCESS_POLICY_UNSETTLED');

    expect(container.textContent).toContain('পাবলিক অ্যাক্সেস বন্ধ আছে');
    expect(container.textContent).not.toContain('Raw English server detail');
  });

  it('shows offline guidance in Bengali without a request', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await act(async () => root.render(
      <LocaleProvider><BuyerPortal portalToken="token" /></LocaleProvider>,
    ));

    expect(container.textContent).toContain('আপনি অফলাইনে আছেন। শেষ সংরক্ষিত স্ট্যাটাস দেখানো হচ্ছে।');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('translates a refresh failure and lets the buyer switch language without another read', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(pending)))
      .mockRejectedValue(new TypeError('Synthetic outage'));
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
    await act(async () => root.render(
      <LocaleProvider>
        <LocaleSwitch />
        <BuyerPortal portalToken="token" />
      </LocaleProvider>,
    ));

    const refresh = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('স্ট্যাটাস রিফ্রেশ'));
    await act(async () => refresh?.click());

    expect(container.textContent).toContain('নতুন স্ট্যাটাস আনা যায়নি। শেষ সংরক্ষিত স্ট্যাটাস দেখানো হচ্ছে। আবার চেষ্টা করুন।');
    const orderReads = () => fetchMock.mock.calls
      .filter(([url]) => url === '/api/public/orders/token').length;
    expect(orderReads()).toBe(2);

    await act(async () => findLanguageButton(container, 'English').click());

    expect(container.textContent).toContain('Unable to refresh. Showing the last saved status. Please retry.');
    expect(orderReads()).toBe(2);
  });
});
