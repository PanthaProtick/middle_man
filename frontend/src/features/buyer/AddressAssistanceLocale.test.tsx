import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LocaleProvider, LocaleSwitch, LOCALE_STORAGE_KEY } from '../locale';
import { AddressAssistance } from './AddressAssistance';

it('keeps reviewed address and makes the original explanation optional when language changes', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ available: true, review_required: true, explanation_language: 'en', suggestions: { district: 'Dhaka', thana: null, area: null, street_line: null, landmark: null, needs_clarification: true, clarification_question: 'Which thana?' } })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><AddressAssistance portalToken="token" address="Dhaka" onUse={vi.fn()} disabled={false} /></LocaleProvider>));
    const request = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send address'));
    await act(async () => request?.click());
    expect(container.textContent).toContain('Which thana?');
    const bengali = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('বাংলা'));
    await act(async () => bengali?.click());
    expect(container.textContent).not.toContain('Which thana?');
    expect(container.textContent).toContain('মূল ভাষায় দেখুন');
    expect(container.querySelector('input')?.value).toBe('Dhaka');
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('মূল ভাষায় দেখুন'))?.click());
    expect(container.textContent).toContain('Which thana?');
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it('translates a saved limit error on switch without requesting assistance again', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'ADDRESS_ASSISTANCE_LIMIT', message: 'private evidence' } }), { status: 429 }));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><AddressAssistance portalToken="token" address="Dhaka" onUse={vi.fn()} disabled={false} /></LocaleProvider>));
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send address'))?.click());
    expect(container.querySelector('[role=alert]')?.textContent).toContain('limit reached');
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('বাংলা'))?.click());
    expect(container.querySelector('[role=alert]')?.textContent).toContain('সীমা শেষ');
    expect(container.textContent).not.toContain('private evidence');
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it('preserves an in-flight request across language changes', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  let resolve!: (response: Response) => void;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(done => { resolve = done; }));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><AddressAssistance portalToken="token" address="Dhaka" onUse={vi.fn()} disabled={false} /></LocaleProvider>));
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send address'))?.click());
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('বাংলা'))?.click());
    expect(container.querySelector('section [role=status]')?.textContent).toContain('অপেক্ষার সময়');
    await act(async () => resolve(new Response(JSON.stringify({ available: true, review_required: true, explanation_language: 'en', suggestions: { district: 'Dhaka', thana: null, area: null, street_line: null, landmark: null, needs_clarification: true, clarification_question: 'Which thana?' } }))));
    expect(container.querySelector('input')?.value).toBe('Dhaka');
    expect(container.textContent).toContain('মূল ভাষায় দেখুন');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).language).toBe('en');
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});


it('handles older saved explanations without language metadata and retains the review control', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ available: true, review_required: true, suggestions: { district: 'ঢাকা', thana: null, area: null, street_line: null, landmark: null, needs_clarification: true, clarification_question: 'Which thana?' } })));
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><AddressAssistance portalToken="token" address="ঢাকা" onUse={vi.fn()} disabled={false} /></LocaleProvider>));
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Gemini-তে'))?.click());
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).language).toBe('bn');
    expect(container.textContent).not.toContain('Which thana?');
    const toggle = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('মূল ভাষায় দেখুন'))!;
    toggle.focus();
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'English')?.click());
    expect(document.activeElement).toBe(toggle);
    await act(async () => toggle.click());
    expect(container.textContent).toContain('Which thana?');
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it.each(['EXPIRED_SUBMISSION', 'BUYER_LINK_REVOKED', 'RECORD_UNAVAILABLE', 'ORDER_ALREADY_SUBMITTED'])('shows terminal guidance for %s', async code => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code, message: 'internal' } }), { status: 410 }));
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><AddressAssistance portalToken="token" address="Dhaka" onUse={vi.fn()} disabled={false} /></LocaleProvider>));
    await act(async () => container.querySelector('button')?.click());
    expect(container.querySelector('[role=alert]')?.textContent).toMatch(code === 'ORDER_ALREADY_SUBMITTED' ? /already been submitted/ : /Contact the seller/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});
