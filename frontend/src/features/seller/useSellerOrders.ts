import { useCallback, useRef, useState } from 'react';
import { fetchOrders } from './api';
import type { OrderDateRange } from './orderDateFilter';
import { useDateSelection } from './useDateSelection';
import type { SellerOrder } from './types';

interface OrderQuery {
  status: string;
  search: string;
  dateRange: OrderDateRange | null;
}

/**
 * Owns the Orders list query, paging and stale-response protection.
 * Search and dates stay in memory so they never appear in browser navigation.
 */
export function useSellerOrders(token: string | undefined, onError: (error: unknown) => void) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryRef = useRef<OrderQuery>({ status: '', search: '', dateRange: null });
  const requestRef = useRef(0);

  const load = useCallback(
    async (cursor?: string) => {
      if (!token) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!cursor) {
        setOrders([]);
        setNextCursor(null);
        setLoading(true);
      }
      const query = queryRef.current;
      try {
        const res = await fetchOrders({
          status: query.status || undefined,
          search: query.search,
          fromDate: query.dateRange?.from,
          toDate: query.dateRange?.to,
          cursor,
        }, token);
        if (requestId !== requestRef.current) return;
        setOrders((previous) => (cursor ? [...previous, ...res.items] : res.items));
        setNextCursor(res.next_cursor);
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
  const changeStatus = useCallback((status: string) => {
    queryRef.current = { ...queryRef.current, status };
    setStatusFilter(status);
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

  const applyDates = useCallback((dateRange: OrderDateRange | null) => {
    queryRef.current = { ...queryRef.current, dateRange };
    void load();
  }, [load]);
  const dates = useDateSelection(applyDates);
  const addOrder = useCallback((order: SellerOrder) => {
    setOrders((previous) => [order, ...previous]);
  }, []);

  return {
    orders,
    statusFilter,
    search,
    ...dates,
    nextCursor,
    loading,
    reload,
    changeStatus,
    changeSearch,
    loadMore,
    addOrder,
  };
}
