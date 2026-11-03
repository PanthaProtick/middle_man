import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSellerOrders } from './useSellerOrders';
import { useTransactionInbox } from './useTransactionInbox';

const onError = vi.fn();
const hooks = {
  orders: function useOrders(token?: string) {
    const api = useSellerOrders(token, onError);
    return { ...api, dates: api, items: api.orders };
  },
  transactions: function useTransactions(token?: string) {
    const api = useTransactionInbox(token, onError);
    return { ...api, items: api.transactions };
  },
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  onError.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

for (const [name, useList] of Object.entries(hooks)) {
  describe(`${name} session boundaries`, () => {
    for (const nextToken of [undefined, 'token-b']) {
      for (const outcome of ['success', 'failure']) {
        it(`ignores pending ${outcome} after switching to ${nextToken ?? 'signed-out'}`, async () => {
          let api!: ReturnType<typeof useList>;
          function Harness({ token }: { token?: string }) {
            const result = useList(token);
            useEffect(() => { api = result; });
            return null;
          }
          let resolve!: (response: Response) => void;
          let reject!: (error: Error) => void;
          vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((done, fail) => {
            resolve = done;
            reject = fail;
          }));
          await act(async () => root.render(<Harness token="token-a" />));
          let pending!: Promise<void>;
          await act(async () => { pending = api.reload(); });
          expect(api.loading).toBe(true);
          await act(async () => root.render(<Harness token={nextToken} />));
          await act(async () => {
            if (outcome === 'success') {
              resolve(new Response(JSON.stringify({ items: [{ id: 'old-session' }], next_cursor: 'old-cursor' })));
            } else {
              reject(new Error('old session failed'));
            }
            await pending;
          });
          expect(api.items).toEqual([]);
          expect(api.nextCursor).toBeNull();
          expect(api.loading).toBe(false);
          expect(onError).not.toHaveBeenCalled();
        });
      }
    }

    it('resets applied dates, drafts and errors with the request query', async () => {
      let api!: ReturnType<typeof useList>;
      function Harness({ token }: { token?: string }) {
        const result = useList(token);
        useEffect(() => { api = result; });
        return null;
      }
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ items: [], next_cursor: null })));
      await act(async () => root.render(<Harness token="token-a" />));
      await act(async () => api.dates.applyRelativePreset(7));
      await act(async () => {
        api.dates.changeDateFrom('invalid');
        api.dates.changeDateTo('2026-11-01');
      });
      await act(async () => api.dates.applyCustomDates());
      expect(api.dates.appliedDateRange).not.toBeNull();
      expect(api.dates.dateError).not.toBeNull();
      await act(async () => root.render(<Harness token="token-b" />));
      expect(api.dates.dateMode).toBe('any');
      expect(api.dates.appliedDateRange).toBeNull();
      expect(api.dates.dateFrom).toBe('');
      expect(api.dates.dateTo).toBe('');
      expect(api.dates.lastDays).toBe('');
      expect(api.dates.dateError).toBeNull();
      await act(async () => api.reload());
      const url = String(fetchMock.mock.calls.at(-1)![0]);
      expect(url).not.toContain('from_date');
      expect(url).not.toContain('to_date');
    });
  });
}
