import { useEffect, useRef, useState } from 'react';
import { sellerFetch } from './sessionRequest';
import type { WorkspaceSection } from './SellerWorkspace';

const sections = ['orders', 'payments', 'accounts'] as const;
type EntrySection = typeof sections[number];
type SeenTimes = Partial<Record<EntrySection, string>>;
type Counts = Record<EntrySection, number>;
const empty: Counts = { orders: 0, payments: 0, accounts: 0 };

function readSeen(key: string): SeenTimes {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const result: SeenTimes = {};
    for (const section of sections) {
      const time: unknown = Reflect.get(value, section);
      if (typeof time === 'string' && Number.isFinite(Date.parse(time))) result[section] = time;
    }
    return result;
  } catch { return {}; }
}

function validCounts(value: unknown): value is Counts & { captured_at: string } {
  return !!value && typeof value === 'object'
    && typeof Reflect.get(value, 'captured_at') === 'string'
    && Number.isFinite(Date.parse(Reflect.get(value, 'captured_at')))
    && sections.every(section => {
      const count: unknown = Reflect.get(value, section);
      return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
    });
}

/** Browser-local acknowledgements; counts always come from unfiltered server aggregates. */
export function useUnseenEntries(
  token: string | undefined, shopId: string | undefined, current: WorkspaceSection,
  orders: unknown, payments: unknown, accounts: unknown, ready: boolean,
): Counts {
  const [result, setResult] = useState<{ key: string; section: WorkspaceSection; counts: Counts }>();
  const memory = useRef<{ key: string; seen: SeenTimes; captured?: string }>({ key: '', seen: {} });
  const key = shopId ? `seller-unseen-v1:${shopId}` : '';
  useEffect(() => {
    if (!token || !key || !ready) return;
    let cancelled = false;
    let request = 0;
    if (memory.current.key !== key) memory.current = { key, seen: readSeen(key) };
    const state = memory.current;
    const seen = state.seen;
    if (current !== 'retention') {
      if (state.captured) seen[current] = state.captured;
      try { localStorage.setItem(key, JSON.stringify(seen)); } catch { /* Memory fallback. */ }
    }
    async function reload() {
      const id = ++request;
      const params = new URLSearchParams();
      for (const section of sections) {
        if (section !== current && seen[section]) params.set(`${section}_since`, seen[section]);
      }
      try {
        const response = await sellerFetch(`/api/seller/unseen-entries?${params}`, {}, token);
        if (!response.ok) throw new Error('Unseen counts unavailable');
        const data: unknown = await response.json();
        if (!validCounts(data)) throw new Error('Invalid unseen counts');
        if (cancelled || id !== request) return;
        const stored = readSeen(key);
        for (const section of sections) {
          if (stored[section] && (!seen[section] || Date.parse(stored[section]) > Date.parse(seen[section]))) {
            seen[section] = stored[section];
          }
          if (section === current || !seen[section]) seen[section] = data.captured_at;
        }
        state.captured = data.captured_at;
        try { localStorage.setItem(key, JSON.stringify(seen)); } catch { /* Memory fallback. */ }
        setResult({ key, section: current,
          counts: { orders: data.orders, payments: data.payments, accounts: data.accounts } });
      } catch {
        if (!cancelled && id === request) setResult({ key, section: current, counts: empty });
      }
    }
    void reload();
    const interval = window.setInterval(() => { void reload(); }, 60_000);
    window.addEventListener('focus', reload);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', reload);
    };
  }, [token, key, current, orders, payments, accounts, ready]);
  const counts = result?.key === key && result.section === current && ready ? result.counts : empty;
  return { ...counts, ...(current !== 'retention' ? { [current]: 0 } : {}) };
}
