import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchPreparationPreview } from './workQueryApi';
import type { PreparationPreviewItem } from './types';

export interface PreparationState {
  items: PreparationPreviewItem[];
  total: number;
  retrievedAt: string | null;
  calendarDate: string | null;
  nextCursor: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: 'unauthorized' | 'failed' | null;
}

const EMPTY: PreparationState = {
  items: [],
  total: 0,
  retrievedAt: null,
  calendarDate: null,
  nextCursor: null,
  status: 'idle',
  error: null,
};

/** Server-authoritative preview of confirmed orders with no courier attempt. */
export function usePreparationQuery(token?: string, initialState?: PreparationState) {
  const [state, setState] = useState<PreparationState>(initialState ?? EMPTY);
  const [authorization, setAuthorization] = useState(token);
  const requestRef = useRef(0);
  const mounted = useRef(true);

  if (authorization !== token) {
    setAuthorization(token);
    setState(EMPTY);
  }

  // Invalidate the previous authorization context before displaying its results.
  useLayoutEffect(() => {
    requestRef.current += 1;
  }, [token]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestRef.current += 1;
    };
  }, []);

  const load = useCallback(async (cursor?: string) => {
    if (!token) {
      setState(current => ({
        ...current,
        items: cursor ? current.items : [],
        status: 'error',
        error: 'unauthorized',
      }));
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState(current => ({
      ...current,
      items: cursor ? current.items : [],
      total: cursor ? current.total : 0,
      retrievedAt: cursor ? current.retrievedAt : null,
      calendarDate: cursor ? current.calendarDate : null,
      nextCursor: cursor ? current.nextCursor : null,
      status: 'loading',
      error: null,
    }));
    try {
      const page = await fetchPreparationPreview({ cursor, limit: 10 }, token);
      if (!mounted.current || requestId !== requestRef.current) return;
      setState(current => ({
        items: cursor ? [...current.items, ...page.items] : page.items,
        total: page.total,
        retrievedAt: page.retrieved_at,
        calendarDate: page.calendar_date,
        nextCursor: page.next_cursor,
        status: 'ready',
        error: null,
      }));
    } catch (error) {
      if (!mounted.current || requestId !== requestRef.current) return;
      const status = error instanceof Error && 'status' in error
        ? Number((error as Error & { status?: number }).status)
        : 0;
      setState(current => ({
        ...current,
        status: 'error',
        error: status === 401 ? 'unauthorized' : 'failed',
      }));
    }
  }, [token]);

  const refresh = useCallback(() => load(), [load]);
  const loadMore = useCallback(() => {
    if (state.nextCursor && state.status !== 'loading') void load(state.nextCursor);
  }, [load, state.nextCursor, state.status]);
  const reset = useCallback(() => {
    requestRef.current += 1;
    setState(EMPTY);
  }, []);

  return { ...state, refresh, loadMore, reset };
}

export type PreparationQuery = ReturnType<typeof usePreparationQuery>;
