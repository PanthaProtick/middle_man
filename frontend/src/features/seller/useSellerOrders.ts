import { useCallback, useRef, useState } from 'react';
import { fetchOrders } from './api';
import type { OrderDateRange } from './orderDateFilter';
import { useDateSelection } from './useDateSelection';
import type { SellerOrder, WorkQuery } from './types';

interface OrderQuery {
  status: string;
  search: string;
  dateRange: OrderDateRange | null;
  workQuery: WorkQuery | '';
}

/**
 * Owns the Orders list query, paging and stale-response protection.
 * Search and dates stay in memory so they never appear in browser navigation.
 */
export function useSellerOrders(token: string | undefined, onError: (error: unknown) => void) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [workQuery, setWorkQuery] = useState<WorkQuery | ''>('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryRef = useRef<OrderQuery>({ status: '', search: '', dateRange: null, workQuery: '' });
  const requestRef = useRef(0);

  const load = useCallback(
    async (cursor?: string, clear: boolean = true) => {
      if (!token) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!cursor) {
        if (clear) {
          setOrders([]);
        }
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
          workQuery: query.workQuery || undefined,
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

  const reload = useCallback(() => load(undefined, false), [load]);
  const changeStatus = useCallback((status: string) => {
    queryRef.current = { ...queryRef.current, status, workQuery: '' };
    setWorkQuery('');
    setStatusFilter(status);
    void load();
  }, [load]);
  const changeSearch = useCallback((term: string) => {
    queryRef.current = { ...queryRef.current, search: term, workQuery: '' };
    setWorkQuery('');
    setSearch(term);
    void load();
  }, [load]);
  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor);
  }, [load, nextCursor]);

  const applyDates = useCallback((dateRange: OrderDateRange | null) => {
    queryRef.current = { ...queryRef.current, dateRange, workQuery: '' };
    setWorkQuery('');
    void load();
  }, [load]);
  const dates = useDateSelection(applyDates);
  const resetDates = dates.reset;
  const applyWorkQuery = useCallback((next: WorkQuery) => {
    queryRef.current = { status: '', search: '', dateRange: null, workQuery: next };
    setStatusFilter('');
    setSearch('');
    setWorkQuery(next);
    resetDates();
    void load();
  }, [load, resetDates]);
  const clearWorkQuery = useCallback(() => {
    queryRef.current = { ...queryRef.current, workQuery: '' };
    setWorkQuery('');
    void load();
  }, [load]);
  const addOrder = useCallback((order: SellerOrder) => {
    setOrders((previous) => [order, ...previous]);
  }, []);

  return {
    orders,
    statusFilter,
    search,
    workQuery,
    ...dates,
    nextCursor,
    loading,
    reload,
    changeStatus,
    changeSearch,
    loadMore,
    addOrder,
    applyWorkQuery,
    clearWorkQuery,
  };
}
