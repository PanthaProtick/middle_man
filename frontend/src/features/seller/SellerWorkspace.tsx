import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { PaymentAccount, ReceiptView, SellerOrder, Shop } from './types';
import { fetchShop, createShop, fetchPaymentAccounts, fetchOrders, fetchTransactions } from './api';
import { OrderList } from './OrderList';
import { CreateOrderModal } from './CreateOrderModal';
import { ManualTransactionModal } from './ManualTransactionModal';
import { BuyerCorrection } from './BuyerCorrection';
import { ShopMetricsBar } from './ShopMetricsBar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ShopSetupForm } from './ShopSetupForm';
import { WorkspaceSectionNav } from './WorkspaceSectionNav';
import { WorkspaceAccountsSummary } from './WorkspaceAccountsSummary';
import { PaymentsSection } from './PaymentsSection';
import { AccountsSection } from './AccountsSection';
import { RetentionSection } from './RetentionSection';

export type WorkspaceSection = 'orders' | 'payments' | 'accounts' | 'retention';

interface SellerWorkspaceProps {
  token?: string;
  activeSection?: WorkspaceSection;
  onSectionChange?: (section: WorkspaceSection) => void;
  onSignIn?: () => void;
}

export function SellerWorkspace({
  token,
  activeSection,
  onSectionChange,
  onSignIn,
}: SellerWorkspaceProps): React.JSX.Element {
  const [internalSection, setInternalSection] = useState<WorkspaceSection>('orders');
  const currentSection = activeSection ?? internalSection;

  const handleSectionSelect = (section: WorkspaceSection) => {
    setInternalSection(section);
    onSectionChange?.(section);
  };

  const [loading, setLoading] = useState<boolean>(() => Boolean(token));
  const [shop, setShop] = useState<Shop | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<string>('');
  const [ordersNextCursor, setOrdersNextCursor] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ReceiptView[]>([]);
  const [transactionsFilter, setTransactionsFilter] = useState<string>('');
  const [transactionsNextCursor, setTransactionsNextCursor] = useState<string | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [manualAccountId, setManualAccountId] = useState<string>();
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [shopName, setShopName] = useState<string>('');
  const [setupSubmitting, setSetupSubmitting] = useState<boolean>(false);
  const shopIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const loadOrders = useCallback(
    async (status?: string, cursor?: string) => {
      if (!token) return;
      try {
        const res = await fetchOrders({ status: status || undefined, cursor }, token);
        setOrders((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setOrdersNextCursor(res.next_cursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      }
    },
    [token],
  );

  const loadTransactions = useCallback(
    async (filterKey?: string, cursor?: string) => {
      if (!token) return;
      setTransactionsLoading(true);
      try {
        const review = filterKey === 'conflicted' ? 'conflicted' : undefined;
        const parse = filterKey === 'incomplete' ? 'incomplete' : undefined;
        const used = filterKey === 'unmatched' || filterKey === 'used' ? filterKey : undefined;
        const res = await fetchTransactions({ review, parse, used, cursor }, token);
        setTransactions((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setTransactionsNextCursor(res.next_cursor || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load received payments');
      } finally {
        setTransactionsLoading(false);
      }
    },
    [token],
  );

  const loadData = useCallback(() => {
    if (!token) return;
    fetchShop(token)
      .then(async (status) => {
        setSetupNeeded(status.setup_needed);
        setShop(status.shop);
        if (status.shop) {
          const accs = await fetchPaymentAccounts(token);
          setAccounts(accs);
          await loadOrders(ordersFilter);
          await loadTransactions(transactionsFilter);
        }
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load shop workspace'))
      .finally(() => setLoading(false));
  }, [token, ordersFilter, transactionsFilter, loadOrders, loadTransactions]);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token, loadData]);

  const handleFilterChange = (status: string) => {
    setOrdersFilter(status);
    loadOrders(status);
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return setError('Authentication required');
    if (!shopName.trim()) return setError('Shop display name cannot be blank');
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

  if (!token) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '420px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>Sign in to your shop</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Please authenticate to manage your orders, receiving accounts, and shop settings.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!onSignIn}
            onClick={() => onSignIn?.()}
          >
            Sign in
          </button>
          {!onSignIn && <p>Seller sign-in is unavailable. Configure Clerk to connect your shop.</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw size={28} className="spin" style={{ color: 'var(--primary-accent)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading shop workspace...</p>
      </div>
    );
  }

  if (error && !shop && !setupNeeded) {
    return (
      <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: 'var(--rose-accent)', margin: '0 auto 12px' }} />
        <h4 style={{ color: 'var(--rose-accent)', marginBottom: '8px' }}>Workspace Error</h4>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { setLoading(true); loadData(); }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <WorkspaceHeader
        displayTitle={setupNeeded ? 'Shop Setup' : (shop?.display_name || 'Seller Workspace')}
        setupNeeded={setupNeeded}
        onOpenRecordModal={() => setIsRecordModalOpen(true)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onRefresh={() => { setLoading(true); loadData(); }}
      />

      {error && (
        <div role="alert" style={{ margin: '16px 0', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--rose-accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {setupNeeded ? (
        <ShopSetupForm
          shopName={shopName}
          setupSubmitting={setupSubmitting}
          onShopNameChange={setShopName}
          onSubmit={handleCreateShop}
        />
      ) : (
        <div style={{ marginTop: '16px' }}>
          <ShopMetricsBar orders={orders} transactionsCount={transactions.length} />

          <WorkspaceSectionNav
            currentSection={currentSection}
            onSelectSection={handleSectionSelect}
            ordersCount={orders.length}
            transactionsCount={transactions.length}
            accountsCount={accounts.length}
          />

          {currentSection === 'orders' && (
            <section aria-labelledby="section-orders-title">
              <WorkspaceAccountsSummary
                accounts={accounts}
                onManageAccounts={() => handleSectionSelect('accounts')}
              />

              {new URLSearchParams(window.location.search).get('order-link') && (
                <BuyerCorrection
                  portalToken={new URLSearchParams(window.location.search).get('order-link')!}
                  token={token}
                  onCorrected={() => { void loadOrders(ordersFilter); }}
                />
              )}

              <OrderList
                token={token}
                onCorrected={() => { void loadOrders(ordersFilter); }}
                orders={orders}
                statusFilter={ordersFilter}
                onFilterChange={handleFilterChange}
                nextCursor={ordersNextCursor}
                onLoadMore={() => ordersNextCursor && loadOrders(ordersFilter, ordersNextCursor)}
              />
            </section>
          )}

          {currentSection === 'payments' && (
            <PaymentsSection
              accounts={accounts}
              token={token}
              transactions={transactions}
              transactionsLoading={transactionsLoading}
              transactionsFilter={transactionsFilter}
              transactionsNextCursor={transactionsNextCursor}
              onOpenRecordModal={(id) => {
                setManualAccountId(id);
                setIsRecordModalOpen(true);
              }}
              onRefreshTransactions={loadTransactions}
              onTransactionsChanged={() => {
                void loadTransactions(transactionsFilter);
                void loadOrders(ordersFilter);
              }}
              onFilterChange={(f) => {
                setTransactionsFilter(f);
                loadTransactions(f);
              }}
              onLoadMore={() => transactionsNextCursor && loadTransactions(transactionsFilter, transactionsNextCursor)}
            />
          )}

          {currentSection === 'accounts' && (
            <AccountsSection
              accounts={accounts}
              token={token}
              onAccountUpdated={(updated) => setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
              onAccountCreated={(created) => setAccounts((prev) => [...prev, created])}
              onError={setError}
              onReload={loadData}
            />
          )}

          {currentSection === 'retention' && (
            <RetentionSection
              token={token}
              onCleaned={() => {
                void loadOrders(ordersFilter);
                void loadTransactions(transactionsFilter);
              }}
            />
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateOrderModal
          accounts={accounts}
          token={token}
          onClose={() => setIsCreateModalOpen(false)}
          onOrderCreated={(newOrder) => setOrders((prev) => [newOrder, ...prev])}
          onError={setError}
        />
      )}

      {isRecordModalOpen && (
        <ManualTransactionModal
          initialAccountId={manualAccountId}
          accounts={accounts}
          token={token}
          onClose={() => { setIsRecordModalOpen(false); setManualAccountId(undefined); }}
          onTransactionRecorded={(newTx) => {
            setTransactions((prev) =>
              prev.some((t) => t.id === newTx.id)
                ? prev.map((t) => (t.id === newTx.id ? newTx : t))
                : [newTx, ...prev],
            );
          }}
          onError={setError}
        />
      )}
    </div>
  );
}
