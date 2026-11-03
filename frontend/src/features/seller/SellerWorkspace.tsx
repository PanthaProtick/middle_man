import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import React, { useState, useCallback } from 'react';
import { SellerApiError } from './api';
import { ShopMetricsBar } from './ShopMetricsBar';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';
import { workspaceErrorText } from './workspaceErrorText';
import { WorkspaceState } from './WorkspaceState';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ShopSetupForm } from './ShopSetupForm';
import { WorkspaceSectionNav, type SettingsSubSection } from './WorkspaceSectionNav';
import { PaymentsSection } from './PaymentsSection';
import { AccountsSection } from './AccountsSection';
import { RetentionSection } from './RetentionSection';
import { WorkspaceOrdersSection } from './WorkspaceOrdersSection';
import { WorkspaceModals } from './WorkspaceModals';
import { useSellerBootstrap } from './useSellerBootstrap';
import { useSellerOrders } from './useSellerOrders';
import { useTransactionInbox } from './useTransactionInbox';
import { useTodayMetrics } from './useTodayMetrics';
import { useUnseenEntries } from './useUnseenEntries';
import { AssistantWorkspace } from './AssistantWorkspace';

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
  const text = sellerCopy[useLocale().locale];
  const [internalSection, setInternalSection] = useState<WorkspaceSection>('orders');
  const [settingsSub, setSettingsSub] = useState<SettingsSubSection>('all');
  const currentSection = activeSection ?? internalSection;
  const handleSectionSelect = (section: WorkspaceSection) => {
    setInternalSection(section);
    onSectionChange?.(section);
  };
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [manualAccountId, setManualAccountId] = useState<string>();
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [error, setError] = useState<string | { code: string } | null>(null);
  const workspaceError = typeof error === 'object' && error ? error.code : null;
  const errorText = workspaceErrorText(error, useLocale().locale);
  const captureWorkspaceError = useCallback((err: unknown) => setError({ code: err instanceof SellerApiError ? err.code : 'UNKNOWN' }), []);
  const txInbox = useTransactionInbox(token, captureWorkspaceError);
  const sellerOrders = useSellerOrders(token, captureWorkspaceError);
  const { reload: reloadOrders } = sellerOrders;
  const { reload: reloadTransactions } = txInbox;
  const reloadWorkspaceLists = useCallback(async () => {
    await Promise.all([reloadOrders(), reloadTransactions()]);
  }, [reloadOrders, reloadTransactions]);
  const {
    loading, shop, setupNeeded, accounts, setAccounts, shopName, setShopName,
    setupSubmitting, createShopFromName, recoverSetup, refresh, retry,
  } = useSellerBootstrap({
    token, errorCode: workspaceError, setError,
    captureError: captureWorkspaceError, reloadLists: reloadWorkspaceLists,
  });
  const todayMetrics = useTodayMetrics(shop && !setupNeeded ? token : undefined, sellerOrders.orders, txInbox.transactions);
  const unseen = useUnseenEntries(token, shop?.id, currentSection, sellerOrders.orders, txInbox.transactions, accounts, !loading && !setupNeeded);
  if (!token) return <WorkspaceState state="signedOut" onSignIn={onSignIn} onRetry={() => undefined} />;
  const state = loading ? 'loading' : errorText && !shop && !setupNeeded ? 'error' : null;

  return (
    <AssistantWorkspace key={JSON.stringify([token, shop?.id])} floating accounts={accounts} token={token}
      onOrderCreated={() => { void sellerOrders.reload(); }}
      onPaymentRecorded={() => { void sellerOrders.reload(); void txInbox.reload(); }}
      onOpenPayment={(receiptId) => { handleSectionSelect('payments'); txInbox.changeSearch(receiptId); }}
      onShowInDashboard={(query) => { handleSectionSelect('orders'); sellerOrders.applyWorkQuery(query); }}>
    {state ? <WorkspaceState state={state} errorText={errorText} onSignIn={onSignIn} onRetry={retry} /> : <div className="card">
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
          <ShopMetricsBar metrics={todayMetrics} />
          <WorkspaceSectionNav
            currentSection={currentSection}
            onSelectSection={handleSectionSelect}
            ordersCount={unseen.orders}
            transactionsCount={unseen.payments}
            accountsCount={unseen.accounts}
            activeSettingsSub={currentSection === 'retention' ? 'retention' : settingsSub}
            onSelectSettingsSub={(sub) => {
              setSettingsSub(sub);
              if (sub === 'retention') handleSectionSelect('retention');
              else handleSectionSelect('accounts');
            }}
          />
          {currentSection === 'orders' && (
            <WorkspaceOrdersSection
              accounts={accounts}
              token={token}
              sellerOrders={sellerOrders}
              onManageAccounts={() => handleSectionSelect('accounts')}
              onCheckTransactions={() => handleSectionSelect('payments')}
            />
          )}
          {currentSection === 'payments' && (
            <PaymentsSection
              accounts={accounts}
              token={token}
              transactions={txInbox.transactions}
              transactionsLoading={txInbox.loading}
              transactionsFilter={txInbox.filter}
              transactionsSearch={txInbox.search}
              transactionsNextCursor={txInbox.nextCursor}
              onOpenRecordModal={(id) => { setManualAccountId(id); setIsRecordModalOpen(true); }}
              onRefreshTransactions={txInbox.reload}
              onTransactionsChanged={() => { void txInbox.reload(); void sellerOrders.reload(); }}
              onFilterChange={txInbox.changeFilter}
              onSearchChange={txInbox.changeSearch}
              dates={txInbox.dates}
              onLoadMore={txInbox.loadMore}
            />
          )}
          {currentSection === 'accounts' && (
            <AccountsSection
              accounts={accounts}
              token={token}
              subSection={settingsSub === 'courier' ? 'courier' : settingsSub === 'accounts' ? 'accounts' : 'all'}
              onAccountUpdated={(updated) => setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
              onAccountCreated={(created) => setAccounts((prev) => [...prev, created])}
              onError={setError}
              onReload={refresh}
            />
          )}
          {currentSection === 'retention' && (
            <RetentionSection
              token={token}
              onCleaned={() => { void sellerOrders.reload(); void txInbox.reload(); }}
            />
          )}
        </div>
      )}
      <WorkspaceModals
        isCreateModalOpen={isCreateModalOpen}
        isRecordModalOpen={isRecordModalOpen}
        manualAccountId={manualAccountId}
        accounts={accounts}
        token={token}
        ordersSearch={sellerOrders.search}
        ordersFilter={sellerOrders.statusFilter}
        ordersDateRange={sellerOrders.appliedDateRange}
        onCloseCreateModal={() => setIsCreateModalOpen(false)}
        onCloseRecordModal={() => { setIsRecordModalOpen(false); setManualAccountId(undefined); }}
        onAddOrder={sellerOrders.addOrder}
        onReloadOrders={() => { void sellerOrders.reload(); }}
        onTransactionRecorded={txInbox.upsert}
        onError={setError}
      />
    </div>}
    </AssistantWorkspace>
  );
}
