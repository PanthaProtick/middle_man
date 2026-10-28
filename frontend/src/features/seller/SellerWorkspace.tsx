import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PaymentAccount, ReceiptView, Shop } from './types';
import { fetchShop, createShop, fetchPaymentAccounts, fetchTransactions, SellerApiError } from './api';
import { OrderList } from './OrderList';
import { CreateOrderModal } from './CreateOrderModal';
import { ManualTransactionModal } from './ManualTransactionModal';
import { BuyerCorrection } from './BuyerCorrection';
import { ShopMetricsBar } from './ShopMetricsBar';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';
import { workspaceErrorText } from './workspaceErrorText';
import { WorkspaceState } from './WorkspaceState';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ShopSetupForm } from './ShopSetupForm';
import { WorkspaceSectionNav } from './WorkspaceSectionNav';
import { WorkspaceAccountsSummary } from './WorkspaceAccountsSummary';
import { PaymentsSection } from './PaymentsSection';
import { AccountsSection } from './AccountsSection';
import { RetentionSection } from './RetentionSection';
import { useSellerOrders } from './useSellerOrders';

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
  const { locale } = useLocale();
  const text = sellerCopy[locale];
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
  const [transactions, setTransactions] = useState<ReceiptView[]>([]);
  const [transactionsFilter, setTransactionsFilter] = useState<string>('');
  const [transactionsNextCursor, setTransactionsNextCursor] = useState<string | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [manualAccountId, setManualAccountId] = useState<string>();
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | { code: string } | null>(null);
  const workspaceError = typeof error === 'object' && error ? error.code : null;
  const errorText = workspaceErrorText(error, locale);
  const captureWorkspaceError = useCallback((err: unknown) => setError({ code: err instanceof SellerApiError ? err.code : 'UNKNOWN' }), []);
  const {
    orders,
    statusFilter: ordersFilter,
    search: ordersSearch,
    nextCursor: ordersNextCursor,
    loading: ordersLoading,
    reload: reloadOrders,
    changeStatus: handleFilterChange,
    changeSearch: handleSearchChange,
    loadMore: loadMoreOrders,
    addOrder,
  } = useSellerOrders(token, captureWorkspaceError);
  const [shopName, setShopName] = useState<string>('');
  const [setupSubmitting, setSetupSubmitting] = useState<boolean>(false);
  const shopIdempotencyKeyRef = useRef<string>(crypto.randomUUID());
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
        captureWorkspaceError(err);
      } finally {
        setTransactionsLoading(false);
      }
    },
    [token, captureWorkspaceError],
  );
  const loadData = useCallback(() => {
    if (!token) return;
    fetchShop(token)
      .then(async (status) => {
        setSetupNeeded(status.setup_needed);
        setShop(status.shop);
        setError(null);
        if (status.shop) {
          const accs = await fetchPaymentAccounts(token);
          setAccounts(accs);
          await reloadOrders();
          await loadTransactions(transactionsFilter);
        }
      })
      .catch((err: unknown) => captureWorkspaceError(err))
      .finally(() => setLoading(false));
  }, [token, transactionsFilter, reloadOrders, loadTransactions, captureWorkspaceError]);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token, loadData]);
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return setError({ code: 'UNKNOWN' });
    if (workspaceError === 'IDEMPOTENCY_KEY_REUSED' || workspaceError === 'RECOVERY_FAILED') return;
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
      else captureWorkspaceError(err);
    } finally {
      setSetupSubmitting(false);
    }
  };
  const checkSetup = async () => {
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
  };
  if (!token) return <WorkspaceState state="signedOut" onSignIn={onSignIn} onRetry={() => undefined} />;
  const state = loading ? 'loading' : errorText && !shop && !setupNeeded ? 'error' : null;
  if (state) return <WorkspaceState state={state} errorText={errorText} onSignIn={onSignIn}
    onRetry={() => { setError(null); setLoading(true); loadData(); }} />;

  return (
    <div className="card">
      <WorkspaceHeader
        displayTitle={setupNeeded ? text.setup : (shop?.display_name || text.workspace)}
        setupNeeded={setupNeeded}
        onOpenRecordModal={() => setIsRecordModalOpen(true)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onRefresh={() => { setLoading(true); loadData(); }}
      />

      {errorText && <WorkspaceErrorBanner message={errorText} />}

      {setupNeeded ? (
        <ShopSetupForm
          error={workspaceError === 'INVALID_NAME' || workspaceError === 'NAME_LIMIT'}
          showRecovery={workspaceError === 'IDEMPOTENCY_KEY_REUSED' || workspaceError === 'RECOVERY_FAILED'}
          onRecover={() => { void checkSetup(); }}
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
                  onCorrected={() => { void reloadOrders(); }}
                />
              )}

              <OrderList
                token={token}
                onCorrected={() => { void reloadOrders(); }}
                orders={orders}
                statusFilter={ordersFilter}
                onFilterChange={handleFilterChange}
                search={ordersSearch}
                onSearchChange={handleSearchChange}
                loading={ordersLoading}
                nextCursor={ordersNextCursor}
                onLoadMore={loadMoreOrders}
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
                void reloadOrders();
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
                void reloadOrders();
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
          onOrderCreated={(newOrder) => {
            if (ordersSearch.trim() || ordersFilter) void reloadOrders();
            else addOrder(newOrder);
          }}
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
