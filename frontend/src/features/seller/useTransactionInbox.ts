import { useCallback, useRef, useState } from 'react';
import { fetchTransactions } from './api';
import type { ReceiptView } from './types';
import type { OrderDateRange } from './orderDateFilter';
import { useDateSelection } from './useDateSelection';

interface InboxQuery {
  filter: string;
  search: string;
  dateRange: OrderDateRange | null;
}

function reconciliationParams(filter: string): {
  review?: string;
  parse?: string;
  used?: string;
} {
  return {
    review: filter === 'conflicted' ? 'conflicted' : undefined,
    parse: filter === 'incomplete' ? 'incomplete' : undefined,
    used: filter === 'unmatched' || filter === 'used' ? filter : undefined,
  };
}

/**
 * Owns the Received Payments Inbox query, paging and stale-response protection.
 * Search stays in memory so it never appears in browser navigation.
 */
export function useTransactionInbox(token: string | undefined, onError: (error: unknown) => void) {
  const [transactions, setTransactions] = useState<ReceiptView[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryRef = useRef<InboxQuery>({ filter: '', search: '', dateRange: null });
  const requestRef = useRef(0);

  const load = useCallback(
    async (cursor?: string) => {
      if (!token) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!cursor) {
        setTransactions([]);
        setNextCursor(null);
      }
      setLoading(true);
      const query = queryRef.current;
      try {
        const res = await fetchTransactions({
          ...reconciliationParams(query.filter),
          search: query.search,
          fromDate: query.dateRange?.from,
          toDate: query.dateRange?.to,
          cursor,
        }, token);
        if (requestId !== requestRef.current) return;
        setTransactions((previous) => (cursor ? [...previous, ...res.items] : res.items));
        setNextCursor(res.next_cursor || null);
        setLoading(false);
      } catch (error) {
        if (requestId !== requestRef.current) return;
        setLoading(false);
        onError(error);
      }
    },
    [token, onError],
  );

  const reload = useCallback(() => load(), [load]);
  const applyDates = useCallback((dateRange: OrderDateRange | null) => {
    queryRef.current = { ...queryRef.current, dateRange };
    void load();
  }, [load]);
  const dates = useDateSelection(applyDates);
  const changeFilter = useCallback((value: string) => {
    queryRef.current = { ...queryRef.current, filter: value };
    setFilter(value);
    void load();
  }, [load]);
  const changeSearch = useCallback((term: string) => {
    queryRef.current = { ...queryRef.current, search: term };
    setSearch(term);
    void load();
  }, [load]);
  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor);
  }, [load, nextCursor]);
  const upsert = useCallback((receipt: ReceiptView) => {
    // A filtered inbox must re-query, otherwise the new row could violate the filter.
    if (queryRef.current.search.trim() || queryRef.current.filter || queryRef.current.dateRange) {
      void load();
      return;
    }
    setTransactions((previous) =>
      previous.some((item) => item.id === receipt.id)
        ? previous.map((item) => (item.id === receipt.id ? receipt : item))
        : [receipt, ...previous],
    );
  }, [load]);

  return {
    dates,
    transactions,
    filter,
    search,
    nextCursor,
    loading,
    reload,
    changeFilter,
    changeSearch,
    loadMore,
    upsert,
  };
}
