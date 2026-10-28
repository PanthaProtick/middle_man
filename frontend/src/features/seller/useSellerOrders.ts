import { useCallback, useRef, useState } from 'react';
import { fetchOrders } from './api';
import type { SellerOrder } from './types';

interface OrderQuery {
  status: string;
  search: string;
}

/**
 * Owns the Orders list query, paging and stale-response protection.
 * Search stays in memory so it never appears in browser navigation.
 */
export function useSellerOrders(token: string | undefined, onError: (error: unknown) => void) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryRef = useRef<OrderQuery>({ status: '', search: '' });
  const requestRef = useRef(0);

  const load = useCallback(
    async (status?: string, cursor?: string, term?: string) => {
      if (!token) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!cursor) {
        setOrders([]);
        setNextCursor(null);
        setLoading(true);
      }
      try {
        const res = await fetchOrders({ status: status || undefined, search: term, cursor }, token);
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

  const reload = useCallback(
    () => load(queryRef.current.status, undefined, queryRef.current.search),
    [load],
  );
  const changeStatus = useCallback((status: string) => {
    queryRef.current = { ...queryRef.current, status };
    setStatusFilter(status);
    void load(status, undefined, queryRef.current.search);
  }, [load]);
  const changeSearch = useCallback((term: string) => {
    queryRef.current = { ...queryRef.current, search: term };
    setSearch(term);
    void load(queryRef.current.status, undefined, term);
  }, [load]);
  const loadMore = useCallback(() => {
    if (nextCursor) void load(queryRef.current.status, nextCursor, queryRef.current.search);
  }, [load, nextCursor]);
  const addOrder = useCallback((order: SellerOrder) => {
    setOrders((previous) => [order, ...previous]);
  }, []);

  return {
    orders,
    statusFilter,
    search,
    nextCursor,
    loading,
    reload,
    changeStatus,
    changeSearch,
    loadMore,
    addOrder,
  };
}
