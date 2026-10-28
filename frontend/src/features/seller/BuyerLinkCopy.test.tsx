import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { BuyerLinkCopy } from './BuyerLinkCopy';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });

it('retains the link and translates copy failure after a language switch, then copies the original URL', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const writeText = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><BuyerLinkCopy portalUrl="/orders/opaque" /></LocaleProvider>));
  const copy = () => Array.from(host.querySelectorAll('button')).find(button => button.title)!;
  await act(async () => copy().click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not copy');
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'বাংলা')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('কপি করা যায়নি');
  expect((host.querySelector('[role="alert"] input') as HTMLInputElement).value).toBe(`${window.location.origin}/orders/opaque`);
  expect(writeText).toHaveBeenCalledTimes(1);
  await act(async () => copy().click());
  expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/orders/opaque`);
  expect(host.textContent).toContain('কপি হয়েছে!');
  await act(async () => root.unmount());
});
