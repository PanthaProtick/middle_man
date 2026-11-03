import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { PaymentsSection } from './PaymentsSection';

// Payments is the agreed UI boundary: the entry action stays available after retirement.
afterEach(() => { localStorage.clear(); document.body.innerHTML = ''; });

it.each([
  { locale: 'en', record: 'Record Payment', step: 'Step 1 · Add evidence', inbox: 'Transaction Ledger & Observations' },
  { locale: 'bn', record: 'পেমেন্ট রেকর্ড করুন', step: 'ধাপ ১ · প্রমাণ যোগ করুন', inbox: 'পেমেন্ট ও প্রাপ্ত তথ্যের তালিকা' },
])('offers manual payment entry and reconciliation without SMS tools in $locale', async ({ locale, record, step, inbox }) => {
  localStorage.setItem('middleman.locale', locale);
  const onRecord = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LocaleProvider><PaymentsSection
      accounts={[]} token="seller" transactions={[]} transactionsLoading={false}
      transactionsFilter="all" transactionsSearch="" transactionsNextCursor={null}
      onOpenRecordModal={onRecord} onRefreshTransactions={vi.fn()} onTransactionsChanged={vi.fn()}
      onFilterChange={vi.fn()} onSearchChange={vi.fn()} onLoadMore={vi.fn()}
    /></LocaleProvider>));
    expect(host.textContent).not.toMatch(/SMS|Previous import results|আগের ফলাফল/);
    expect(host.querySelector('textarea')).toBeNull();
    expect(host.textContent).toContain(inbox);
    const button = (text: string) => Array.from(host.querySelectorAll('button')).find(item => item.textContent?.includes(text))!;
    await act(async () => button(record).click());
    expect(onRecord).toHaveBeenCalledTimes(1);
    await act(async () => button(step).click());
    expect(onRecord).toHaveBeenCalledTimes(2);
    const review = host.querySelector<HTMLAnchorElement>('a[href="#payments-reconciliation"]')!;
    expect(host.querySelector(review.getAttribute('href')!)).not.toBeNull();
  } finally { await act(async () => root.unmount()); }
});
