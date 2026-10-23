import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Store, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import type { PaymentAccount, Shop } from './types';
import { fetchShop, createShop, fetchPaymentAccounts } from './api';
import { PaymentAccountList } from './PaymentAccountList';
import { AddAccountForm } from './AddAccountForm';

interface SellerWorkspaceProps {
  token?: string;
}

export function SellerWorkspace({ token = 'mock-seller-token' }: SellerWorkspaceProps): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Shop setup state
  const [shopName, setShopName] = useState<string>('');
  const [setupSubmitting, setSetupSubmitting] = useState<boolean>(false);
  const shopIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const loadData = useCallback(() => {
    fetchShop(token)
      .then(async (status) => {
        setSetupNeeded(status.setup_needed);
        setShop(status.shop);
        if (status.shop) {
          const accs = await fetchPaymentAccounts(token);
          setAccounts(accs);
        }
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load shop workspace');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('Shop display name cannot be blank');
      return;
    }
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
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setSetupSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <RefreshCw size={24} className="spin" style={{ color: '#6366f1', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading shop workspace...</p>
      </div>
    );
  }

  if (error && !shop && !setupNeeded) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <AlertCircle size={28} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
        <h4 style={{ color: '#fca5a5', marginBottom: '8px' }}>Workspace Error</h4>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { setLoading(true); loadData(); }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Store size={20} color="#6366f1" />
            <span>{setupNeeded ? 'Shop Setup' : (shop?.display_name || 'Seller Workspace')}</span>
          </div>
          <p className="card-subtitle">
            {setupNeeded
              ? 'Create an isolated pilot shop workspace to manage chat-negotiated orders and delivery advances.'
              : 'Isolated shop workspace and designated bKash / Nagad receiving accounts.'}
          </p>
        </div>
        {!setupNeeded && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); loadData(); }}>
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>

      {error && (
        <div style={{ margin: '16px 0', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {setupNeeded ? (
        <form onSubmit={handleCreateShop} style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Shop Display Name
          </label>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '500px' }}>
            <input
              type="text"
              name="displayName"
              placeholder="e.g. Dhaka Gadget Hub"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', background: 'rgba(10, 14, 23, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
              disabled={setupSubmitting}
            />
            <button type="submit" className="btn btn-primary" disabled={setupSubmitting || !shopName.trim()}>
              {setupSubmitting ? 'Creating...' : 'Set Up Shop'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#c7d2fe', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Smartphone size={16} /> Designated Receiving Accounts
          </h4>

          <PaymentAccountList
            accounts={accounts}
            token={token}
            onAccountUpdated={(updated) => setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
            onError={setError}
            onReload={loadData}
          />

          <AddAccountForm
            token={token}
            onAccountCreated={(created) => setAccounts((prev) => [...prev, created])}
            onError={setError}
          />
        </div>
      )}
    </div>
  );
}
