import { useCallback, useRef, useState } from 'react';
import { fetchOrders } from './api';
import {
  lastDaysRange,
  parseDayCount,
  validateCustomRange,
  validateDayCount,
  type OrderDateError,
  type OrderDateMode,
  type OrderDateRange,
} from './orderDateFilter';
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
  const [dateMode, setDateMode] = useState<OrderDateMode>('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastDays, setLastDays] = useState('');
  const [appliedDateRange, setAppliedDateRange] = useState<OrderDateRange | null>(null);
  const [dateError, setDateError] = useState<OrderDateError | null>(null);
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

  const clearActiveDateRange = useCallback(() => {
    if (queryRef.current.dateRange === null) return;
    queryRef.current = { ...queryRef.current, dateRange: null };
    setAppliedDateRange(null);
    void load();
  }, [load]);

  const changeDateMode = useCallback((mode: OrderDateMode) => {
    setDateMode(mode);
    setDateError(null);
    if (mode === 'any') {
      clearActiveDateRange();
    } else if (appliedDateRange !== null) {
      // A pending custom/relative selection must not stay active in another mode.
      clearActiveDateRange();
    }
  }, [appliedDateRange, clearActiveDateRange]);

  const changeDateFrom = useCallback((value: string) => {
    setDateFrom(value);
    setDateError(null);
  }, []);
  const changeDateTo = useCallback((value: string) => {
    setDateTo(value);
    setDateError(null);
  }, []);
  const changeLastDays = useCallback((value: string) => {
    setLastDays(value);
    setDateError(null);
  }, []);

  const applyRange = useCallback((range: OrderDateRange, mode: OrderDateMode) => {
    queryRef.current = { ...queryRef.current, dateRange: range };
    setAppliedDateRange(range);
    setDateMode(mode);
    setDateError(null);
    void load();
  }, [load]);

  const applyCustomDates = useCallback(() => {
    const error = validateCustomRange(dateFrom, dateTo);
    if (error) {
      setDateError(error);
      return;
    }
    applyRange({ from: dateFrom.trim(), to: dateTo.trim() }, 'custom');
  }, [applyRange, dateFrom, dateTo]);

  const applyRelativePreset = useCallback((days: number) => {
    setLastDays(String(days));
    applyRange(lastDaysRange(days), 'relative');
  }, [applyRange]);

  const applyLastDays = useCallback(() => {
    const error = validateDayCount(lastDays);
    if (error) {
      setDateError(error);
      return;
    }
    const days = parseDayCount(lastDays);
    if (days === null) return;
    applyRange(lastDaysRange(days), 'relative');
  }, [applyRange, lastDays]);

  const addOrder = useCallback((order: SellerOrder) => {
    setOrders((previous) => [order, ...previous]);
  }, []);

  return {
    orders,
    statusFilter,
    search,
    dateMode,
    dateFrom,
    dateTo,
    lastDays,
    appliedDateRange,
    dateError,
    nextCursor,
    loading,
    reload,
    changeStatus,
    changeSearch,
    changeDateMode,
    changeDateFrom,
    changeDateTo,
    changeLastDays,
    applyCustomDates,
    applyRelativePreset,
    applyLastDays,
    loadMore,
    addOrder,
  };
}
