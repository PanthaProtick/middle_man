import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchAttentionPreview } from './workQueryApi';
import type { AttentionPreviewItem } from './types';

export interface AttentionState {
  items: AttentionPreviewItem[];
  total: number;
  retrievedAt: string | null;
  calendarDate: string | null;
  nextCursor: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: 'unauthorized' | 'failed' | null;
}

const EMPTY: AttentionState = {
  items: [],
  total: 0,
  retrievedAt: null,
  calendarDate: null,
  nextCursor: null,
  status: 'idle',
  error: null,
};

/** Server-authoritative preview of orders needing seller attention. */
export function useAttentionQuery(token?: string) {
  const [state, setState] = useState<AttentionState>(EMPTY);
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
      const page = await fetchAttentionPreview({ cursor, limit: 10 }, token);
      if (!Array.isArray(page.items)) throw new Error('Malformed attention preview');
      if (!mounted.current || requestId !== requestRef.current) return;
      setState(current => ({
        // Live orders can move past the cursor after changing priority. Keep
        // each identity once and replace its previously retrieved facts.
        items: [...new Map(
          (cursor ? [...current.items, ...page.items] : page.items)
            .map(item => [item.order.id, item]),
        ).values()],
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

export type AttentionQuery = ReturnType<typeof useAttentionQuery>;
