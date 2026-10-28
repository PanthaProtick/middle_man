import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { TransactionInbox } from './TransactionInbox';
import { AddAccountForm } from './AddAccountForm';
import { AccountsSection } from './AccountsSection';
it('switches account drafts without changing opaque labels or submitting', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><AddAccountForm token="token" onAccountCreated={vi.fn()} onError={vi.fn()} /></LocaleProvider>));
  const field = host.querySelector<HTMLInputElement>('input[aria-label="Account label"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'Shop ১২'); field.dispatchEvent(new Event('input', {bubbles:true})); });
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(host.textContent).toContain('প্রাপক অ্যাকাউন্ট যোগ করুন'); expect(field.value).toBe('Shop ১২'); expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks();
});

it('retains an inbox filter and translates its empty guidance without requests', async () => {
  localStorage.setItem('middleman.locale', 'bn');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const changed = vi.fn(); const fetcher = vi.spyOn(globalThis, 'fetch');
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><TransactionInbox transactions={[]} filter="unmatched" onFilterChange={changed} /></LocaleProvider>));
  expect(host.textContent).toContain('এই ফিল্টারে কোনো লেনদেন নেই।');
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'English')!.click());
  expect(host.textContent).toContain('No received transactions match the selected filter.');
  expect(host.querySelector('select')!.value).toBe('unmatched'); expect(changed).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks();
});

it('localizes invalid account input and retains focus and the draft after switching', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><AddAccountForm token="token" onAccountCreated={vi.fn()} onError={vi.fn()} /></LocaleProvider>));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true})));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Account label cannot be blank');
  const field = host.querySelector<HTMLInputElement>('input[aria-label="Account label"]')!;
  expect(document.activeElement).toBe(field);
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('অ্যাকাউন্টের নাম দিন');
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks();
});

it('renders the courier integration heading and guidance in the selected language', async () => {
  localStorage.setItem('middleman.locale', 'bn');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({
    environment: 'offline', version: 1, status: 'disconnected', simulated: true,
    merchant_hint: null, default_store_id: null, default_delivery_type: null,
    production_booking_enabled: false,
  }));
  await act(async () => root.render(
    <LocaleProvider>
      <LocaleSwitch />
      <AccountsSection accounts={[]} token="token" onAccountUpdated={vi.fn()} onAccountCreated={vi.fn()}
        onError={vi.fn()} onReload={vi.fn()} />
    </LocaleProvider>,
  ));
  expect(host.textContent).toContain('কুরিয়ার লজিস্টিকস ইন্টিগ্রেশন');
  expect(host.textContent).toContain('পার্সেল পাঠানো ও ডেলিভারি ট্র্যাকিং স্বয়ংক্রিয় করতে আপনার কুরিয়ার অ্যাকাউন্ট সংযুক্ত করুন।');
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'English')!.click());
  expect(host.textContent).toContain('Courier Logistics Integration');
  expect(host.textContent).toContain('Connect your courier accounts to automate parcel dispatch and delivery tracking.');
  await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks();
});
