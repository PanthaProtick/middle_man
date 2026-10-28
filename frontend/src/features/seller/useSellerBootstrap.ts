import { useCallback, useEffect, useRef, useState } from 'react';
import { createShop, fetchPaymentAccounts, fetchShop, SellerApiError } from './api';
import type { PaymentAccount, Shop } from './types';

type WorkspaceError = string | { code: string } | null;

interface SellerBootstrapOptions {
  token?: string;
  errorCode: string | null;
  setError: (error: WorkspaceError) => void;
  captureError: (error: unknown) => void;
  reloadLists: () => Promise<void>;
}

/**
 * Owns shop bootstrap, setup/recovery submission, and account loading for the
 * seller workspace so the screen component stays a presentation boundary.
 */
export function useSellerBootstrap({
  token,
  errorCode,
  setError,
  captureError,
  reloadLists,
}: SellerBootstrapOptions) {
  const [loading, setLoading] = useState<boolean>(() => Boolean(token));
  const [shop, setShop] = useState<Shop | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [shopName, setShopName] = useState<string>('');
  const [setupSubmitting, setSetupSubmitting] = useState<boolean>(false);
  const shopIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const loadData = useCallback(() => {
    if (!token) return;
    fetchShop(token)
      .then(async (status) => {
        setSetupNeeded(status.setup_needed);
        setShop(status.shop);
        setError(null);
        if (status.shop) {
          setAccounts(await fetchPaymentAccounts(token));
          await reloadLists();
        }
      })
      .catch((err: unknown) => captureError(err))
      .finally(() => setLoading(false));
  }, [token, reloadLists, setError, captureError]);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token, loadData]);

  const refresh = useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const retry = useCallback(() => {
    setError(null);
    refresh();
  }, [setError, refresh]);

  const createShopFromName = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return setError({ code: 'UNKNOWN' });
    if (errorCode === 'IDEMPOTENCY_KEY_REUSED' || errorCode === 'RECOVERY_FAILED') return;
    if (!shopName.trim()) return setError({ code: 'INVALID_NAME' });
    if (shopName.trim().length > 200) return setError({ code: 'NAME_LIMIT' });
    setSetupSubmitting(true);
    setError(null);
    try {
      const result = await createShop(shopName.trim(), shopIdempotencyKeyRef.current, token);
      shopIdempotencyKeyRef.current = crypto.randomUUID();
      setShop(result.shop);
      setSetupNeeded(false);
      setShopName('');
      loadData();
    } catch (err) {
      if (err instanceof SellerApiError && err.code === 'VALIDATION_ERROR') setError({ code: 'NAME_LIMIT' });
      else captureError(err);
    } finally {
      setSetupSubmitting(false);
    }
  }, [token, errorCode, shopName, setError, captureError, loadData]);

  const recoverSetup = useCallback(async () => {
    if (!token) return;
    setSetupSubmitting(true);
    try {
      const status = await fetchShop(token);
      if (status.shop) { setShop(status.shop); setSetupNeeded(false); loadData(); }
      else if (status.setup_needed) shopIdempotencyKeyRef.current = crypto.randomUUID();
      else throw new Error('Invalid shop status');
      setError(null);
    } catch { setError({ code: 'RECOVERY_FAILED' }); }
    finally { setSetupSubmitting(false); }
  }, [token, setError, loadData]);

  return {
    loading,
    shop,
    setupNeeded,
    accounts,
    setAccounts,
    shopName,
    setShopName,
    setupSubmitting,
    createShopFromName,
    recoverSetup,
    refresh,
    retry,
  };
}
