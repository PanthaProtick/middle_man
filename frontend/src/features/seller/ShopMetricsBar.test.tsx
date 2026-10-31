import { it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ShopMetricsBar } from './ShopMetricsBar';

it('renders daily counts and distinguishes unavailable values from zero', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const values = () => Array.from(host.querySelectorAll('.metric-val'), el => el.textContent);
  await act(async () => root.render(<ShopMetricsBar metrics={{ date: '2026-10-31',
    timezone: 'Asia/Dhaka', staged_for_delivery: 7, orders: 30, confirmed: 12, awaiting: 0, pending: 8, payments: 40 }} />));
  expect(values()).toEqual(['30', '12', '0', '8', '40', '7']);
  expect(host.textContent).toContain("Today's Orders");
  expect(host.textContent).toContain('Independent of list filters');
  await act(async () => root.render(<ShopMetricsBar metrics={null} />));
  expect(values()).toEqual(['—', '—', '—', '—', '—', '—']);
  await act(async () => root.unmount()); host.remove(); localStorage.clear();
});
