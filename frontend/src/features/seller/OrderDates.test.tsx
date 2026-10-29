import { act } from 'react';
import { expect, it } from 'vitest';
import { SellerWorkspace } from './SellerWorkspace';
import { lastDaysRange } from './orderDateFilter';
import { setupFetch, mount, listUrls, selectMode, setInput, input, button, alertText } from './orderDatesTestSupport';

it('applies an inclusive custom range to the list query without URL state', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  const initialRequests = listUrls(urls).length;

  await selectMode(host, 'custom');
  expect(listUrls(urls)).toHaveLength(initialRequests);
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());

  const applied = listUrls(urls).at(-1)!;
  expect(applied).toContain('from_date=2026-10-01');
  expect(applied).toContain('to_date=2026-10-28');
  expect(window.location.search).toBe('');
  expect(host.textContent).toContain('Showing 2026-10-01 to 2026-10-28 (Bangladesh dates).');
  await act(async () => root.unmount());
});

it('keeps input values and focus without a request when the range is invalid', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  const from = input(host, 'order-date-from');
  await setInput(from, '2026-10-29');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  const before = listUrls(urls).length;

  from.focus();
  await act(async () => button(host, 'Apply dates').click());

  expect(listUrls(urls)).toHaveLength(before);
  expect(alertText(host)).toBe('The start date must be on or before the end date.');
  expect(from.value).toBe('2026-10-29');
  expect(input(host, 'order-date-to').value).toBe('2026-10-28');
  expect(document.activeElement).toBe(from);
  expect(from.getAttribute('aria-invalid')).toBe('true');
  await act(async () => root.unmount());
});

it('rejects a blank custom range with a localized inline error and no request', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  const before = listUrls(urls).length;

  await act(async () => button(host, 'Apply dates').click());

  expect(listUrls(urls)).toHaveLength(before);
  expect(alertText(host)).toBe('Choose both a start date and an end date.');
  await act(async () => root.unmount());
});

it('rejects an invalid custom day count without a request', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'relative');
  const before = listUrls(urls).length;
  const days = input(host, 'order-date-days');
  await setInput(days, '3651');

  await act(async () => button(host, 'Apply last days').click());

  expect(listUrls(urls)).toHaveLength(before);
  expect(alertText(host)).toBe('Enter a whole number of days from 1 to 3650.');
  expect(days.value).toBe('3651');
  expect(days.getAttribute('aria-invalid')).toBe('true');
  await act(async () => root.unmount());
});

it('clears the active range when switching modes so only one selection is live', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());
  expect(listUrls(urls).at(-1)).toContain('from_date=2026-10-01');

  await selectMode(host, 'relative');
  const afterModeChange = listUrls(urls).at(-1)!;
  expect(afterModeChange).not.toContain('from_date');
  expect(afterModeChange).not.toContain('to_date');
  expect(host.textContent).not.toContain('Showing 2026-10-01');

  await act(async () => button(host, 'Last 7 days').click());
  const expected = lastDaysRange(7);
  expect(listUrls(urls).at(-1)).toContain(`from_date=${expected.from}`);
  expect(listUrls(urls).at(-1)).toContain(`to_date=${expected.to}`);

  await selectMode(host, 'any');
  const anyTime = listUrls(urls).at(-1)!;
  expect(anyTime).not.toContain('from_date');
  expect(anyTime).not.toContain('to_date');
  await act(async () => root.unmount());
});
