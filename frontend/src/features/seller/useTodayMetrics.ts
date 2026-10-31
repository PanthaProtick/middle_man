import { useEffect, useState } from 'react';
import { requestJson } from './api';
import type { ReceiptView, SellerOrder } from './types';

export interface TodayMetrics {
  date: string;
  timezone: 'Asia/Dhaka';
  orders: number;
  confirmed: number;
  awaiting: number;
  pending: number;
  payments: number;
}

export function useTodayMetrics(token: string | undefined, orders: SellerOrder[], receipts: ReceiptView[]) {
  const [result, setResult] = useState<{ token: string; metrics: TodayMetrics | null } | null>(null);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    if (!token) return;
    const load = async () => {
      const request = ++sequence;
      try {
        const metrics = await requestJson<TodayMetrics>('/api/seller/metrics/today', {}, token);
        if (active && request === sequence) setResult({ token, metrics });
      } catch {
        if (active && request === sequence) setResult({ token, metrics: null });
      }
    };
    void load();
    // Refresh across midnight and after activity in another tab.
    const timer = window.setInterval(() => void load(), 60_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, orders, receipts]);
  return result && result.token === token ? result.metrics : null;
}
