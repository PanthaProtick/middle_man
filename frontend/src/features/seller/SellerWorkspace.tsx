import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import React, { useState, useCallback } from 'react';
import { SellerApiError } from './api';
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
import { useSellerBootstrap } from './useSellerBootstrap';
import { useSellerOrders } from './useSellerOrders';
import { useTransactionInbox } from './useTransactionInbox';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [manualAccountId, setManualAccountId] = useState<string>();
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | { code: string } | null>(null);
  const workspaceError = typeof error === 'object' && error ? error.code : null;
  const errorText = workspaceErrorText(error, locale);
  const captureWorkspaceError = useCallback((err: unknown) => setError({ code: err instanceof SellerApiError ? err.code : 'UNKNOWN' }), []);
  const {
    transactions,
    dates: transactionDates,
    filter: transactionsFilter,
    search: transactionsSearch,
    nextCursor: transactionsNextCursor,
    loading: transactionsLoading,
    reload: reloadTransactions,
    changeFilter: handleTransactionsFilterChange,
    changeSearch: handleTransactionsSearchChange,
    loadMore: loadMoreTransactions,
    upsert: upsertTransaction,
  } = useTransactionInbox(token, captureWorkspaceError);
  const {
    orders,
    statusFilter: ordersFilter,
    search: ordersSearch,
    dateMode: ordersDateMode,
    dateFrom: ordersDateFrom,
    dateTo: ordersDateTo,
    lastDays: ordersLastDays,
    appliedDateRange: ordersDateRange,
    dateError: ordersDateError,
    nextCursor: ordersNextCursor,
    loading: ordersLoading,
    reload: reloadOrders,
    changeStatus: handleFilterChange,
    changeSearch: handleSearchChange,
    changeDateMode: handleDateModeChange,
    changeDateFrom: handleDateFromChange,
    changeDateTo: handleDateToChange,
    changeLastDays: handleLastDaysChange,
    applyCustomDates: handleApplyDates,
    applyRelativePreset: handleApplyPreset,
    applyLastDays: handleApplyLastDays,
    loadMore: loadMoreOrders,
    addOrder,
  } = useSellerOrders(token, captureWorkspaceError);
  const reloadWorkspaceLists = useCallback(async () => {
    await reloadOrders();
    await reloadTransactions();
  }, [reloadOrders, reloadTransactions]);
  const {
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
  } = useSellerBootstrap({
    token,
    errorCode: workspaceError,
    setError,
    captureError: captureWorkspaceError,
    reloadLists: reloadWorkspaceLists,
  });
  if (!token) return <WorkspaceState state="signedOut" onSignIn={onSignIn} onRetry={() => undefined} />;
  const state = loading ? 'loading' : errorText && !shop && !setupNeeded ? 'error' : null;
  if (state) return <WorkspaceState state={state} errorText={errorText} onSignIn={onSignIn} onRetry={retry} />;

  return (
    <div className="card">
      <WorkspaceHeader
        displayTitle={setupNeeded ? text.setup : (shop?.display_name || text.workspace)}
        setupNeeded={setupNeeded}
        onOpenRecordModal={() => setIsRecordModalOpen(true)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onRefresh={refresh}
      />

      {errorText && <WorkspaceErrorBanner message={errorText} />}

      {setupNeeded ? (
        <ShopSetupForm
          error={workspaceError === 'INVALID_NAME' || workspaceError === 'NAME_LIMIT'}
          showRecovery={workspaceError === 'IDEMPOTENCY_KEY_REUSED' || workspaceError === 'RECOVERY_FAILED'}
          onRecover={() => { void recoverSetup(); }}
          shopName={shopName}
          setupSubmitting={setupSubmitting}
          onShopNameChange={setShopName}
          onSubmit={createShopFromName}
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
                onCheckTransactions={() => handleSectionSelect('payments')}
                token={token}
                onCorrected={() => { void reloadOrders(); }}
                orders={orders}
                statusFilter={ordersFilter}
                onFilterChange={handleFilterChange}
                search={ordersSearch}
                onSearchChange={handleSearchChange}
                dateMode={ordersDateMode}
                dateFrom={ordersDateFrom}
                dateTo={ordersDateTo}
                lastDays={ordersLastDays}
                appliedDateRange={ordersDateRange}
                dateError={ordersDateError}
                onDateModeChange={handleDateModeChange}
                onDateFromChange={handleDateFromChange}
                onDateToChange={handleDateToChange}
                onLastDaysChange={handleLastDaysChange}
                onApplyDates={handleApplyDates}
                onApplyPreset={handleApplyPreset}
                onApplyLastDays={handleApplyLastDays}
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
              transactionsSearch={transactionsSearch}
              transactionsNextCursor={transactionsNextCursor}
              onOpenRecordModal={(id) => {
                setManualAccountId(id);
                setIsRecordModalOpen(true);
              }}
              onRefreshTransactions={reloadTransactions}
              onTransactionsChanged={() => {
                void reloadTransactions();
                void reloadOrders();
              }}
              onFilterChange={handleTransactionsFilterChange}
              onSearchChange={handleTransactionsSearchChange}
              dates={transactionDates}
              onLoadMore={loadMoreTransactions}
            />
          )}

          {currentSection === 'accounts' && (
            <AccountsSection
              accounts={accounts}
              token={token}
              onAccountUpdated={(updated) => setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
              onAccountCreated={(created) => setAccounts((prev) => [...prev, created])}
              onError={setError}
              onReload={refresh}
            />
          )}

          {currentSection === 'retention' && (
            <RetentionSection
              token={token}
              onCleaned={() => {
                void reloadOrders();
                void reloadTransactions();
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
            if (ordersSearch.trim() || ordersFilter || ordersDateRange) void reloadOrders();
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
          onTransactionRecorded={upsertTransaction}
          onError={setError}
        />
      )}
    </div>
  );
}
