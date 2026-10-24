import { useCallback, useEffect, useRef, useState } from 'react';
import { BuyerApiError, fetchPublicOrder } from './api';
import type { PublicOrder } from './types';

const RETRY_MESSAGE = 'Unable to refresh. Showing the last saved status. Please retry. / নতুন স্ট্যাটাস পাওয়া যায়নি। আবার চেষ্টা করুন।';
const OFFLINE_MESSAGE = 'You are offline. Showing the last saved status. / ইন্টারনেট সংযোগ নেই।';

interface Controller {
  refresh: () => Promise<void>;
  save: (order: PublicOrder) => void;
}

export function usePublicOrder(portalToken: string) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateDisabledMessage, setGate] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const controller = useRef<Controller | null>(null);

  useEffect(() => {
    let active = true;
    let current: PublicOrder | null = null;
    let stopped = false;
    let accessDenied = false;
    let failures = 0;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;
    const visible = () => document.visibilityState !== 'hidden';
    const cancel = () => {
      generation += 1;
      clearTimeout(timer);
      clearTimeout(deadline);
      request?.abort();
      request = null;
    };
    const schedule = () => {
      clearTimeout(timer);
      if (active && !stopped && current?.lifecycle === 'pending' && visible() && navigator.onLine) {
        timer = setTimeout(() => { void refresh(); }, Math.min(30000 * 2 ** failures, 300000));
      }
    };
    const save = (fresh: PublicOrder) => {
      // A completed/submitted view must never regress to a stale earlier lifecycle.
      if (current && current.lifecycle !== 'awaiting_buyer' && fresh.lifecycle === 'awaiting_buyer') return;
      if (current && current.lifecycle !== 'pending' && current.lifecycle !== 'awaiting_buyer'
        && fresh.lifecycle === 'pending') return;
      current = fresh;
      stopped = fresh.lifecycle !== 'pending' && fresh.lifecycle !== 'awaiting_buyer';
      setOrder(fresh);
      setError(null);
      setGate(null);
      setRefreshError(null);
    };
    async function refresh() {
      if (!active || !visible() || request || stopped) return;
      clearTimeout(timer);
      if (!navigator.onLine) {
        setLoading(false);
        if (current) setRefreshError(OFFLINE_MESSAGE);
        else setError(OFFLINE_MESSAGE);
        return;
      }
      const version = ++generation;
      const abort = new AbortController();
      request = abort;
      setRefreshing(true);
      deadline = setTimeout(() => abort.abort(), 15000);
      try {
        const fresh = await fetchPublicOrder(portalToken, abort.signal);
        if (!active || version !== generation) return;
        failures = 0;
        accessDenied = false;
        save(fresh);
      } catch (failure: unknown) {
        if (!active || version !== generation) return;
        failures = Math.min(failures + 1, 4);
        const apiError = failure instanceof BuyerApiError ? failure : null;
        if (apiError?.code === 'PUBLIC_ACCESS_POLICY_UNSETTLED') {
          accessDenied = true;
          stopped = true;
          current = null;
          setOrder(null);
          setGate('Public buyer access is disabled until access/projection policy is settled');
        } else if (apiError && apiError.statusCode >= 400 && apiError.statusCode < 500
          && apiError.statusCode !== 408 && apiError.statusCode !== 429) {
          accessDenied = true;
          stopped = true;
          current = null;
          setOrder(null);
          setError('Order record unavailable. Please contact the seller. / অর্ডার পাওয়া যাচ্ছে না। বিক্রেতার সাথে যোগাযোগ করুন।');
        } else if (current) {
          setRefreshError(RETRY_MESSAGE);
        } else {
          setError('Unable to load order. Please retry.');
        }
      } finally {
        if (active && version === generation) {
          clearTimeout(deadline);
          request = null;
          setLoading(false);
          setRefreshing(false);
          schedule();
        }
      }
    }
    const pauseOrResume = () => {
      cancel();
      setRefreshing(false);
      if (!navigator.onLine) {
        setLoading(false);
        if (current) setRefreshError(OFFLINE_MESSAGE);
        else setError(OFFLINE_MESSAGE);
      } else if (visible() && !stopped) void refresh();
    };
    controller.current = {
      refresh: async () => {
        if (request) return;
        // Explicit retry can recheck an unavailable record or a policy gate.
        stopped = false;
        await refresh();
      },
      save: (fresh) => {
        // Submission responses cannot override a newer public access denial.
        if (accessDenied) return;
        cancel();
        save(fresh);
        setLoading(false);
        setRefreshing(false);
        failures = 0;
        schedule();
      },
    };
    document.addEventListener('visibilitychange', pauseOrResume);
    window.addEventListener('offline', pauseOrResume);
    window.addEventListener('online', pauseOrResume);
    void refresh();
    return () => {
      active = false;
      cancel();
      controller.current = null;
      document.removeEventListener('visibilitychange', pauseOrResume);
      window.removeEventListener('offline', pauseOrResume);
      window.removeEventListener('online', pauseOrResume);
    };
  }, [portalToken]);

  const refresh = useCallback(async () => { await controller.current?.refresh(); }, []);
  const save = useCallback((fresh: PublicOrder) => controller.current?.save(fresh), []);
  return { order, loading, error, gateDisabledMessage, isRefreshing, refreshError, refresh, save };
}
