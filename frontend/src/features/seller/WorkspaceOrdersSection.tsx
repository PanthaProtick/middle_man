import React from 'react';
import { WorkspaceAccountsSummary } from './WorkspaceAccountsSummary';
import { BuyerCorrection } from './BuyerCorrection';
import { OrderList } from './OrderList';
import type { PaymentAccount } from './types';
import type { useSellerOrders } from './useSellerOrders';

interface WorkspaceOrdersSectionProps {
  accounts: PaymentAccount[];
  token: string;
  sellerOrders: ReturnType<typeof useSellerOrders>;
  onManageAccounts: () => void;
  onCheckTransactions: () => void;
}

export function WorkspaceOrdersSection({
  accounts,
  token,
  sellerOrders,
  onManageAccounts,
  onCheckTransactions,
}: WorkspaceOrdersSectionProps): React.JSX.Element {
  const portalToken = new URLSearchParams(window.location.search).get('order-link');
  const {
    orders,
    statusFilter,
    search,
    workQuery,
    dateMode,
    dateFrom,
    dateTo,
    lastDays,
    appliedDateRange,
    dateError,
    loading,
    nextCursor,
    reload,
    changeStatus,
    changeSearch,
    clearWorkQuery,
    changeDateMode,
    changeDateFrom,
    changeDateTo,
    changeLastDays,
    applyCustomDates,
    applyRelativePreset,
    applyLastDays,
    loadMore,
  } = sellerOrders;

  return (
    <section aria-labelledby="section-orders-title">
      <WorkspaceAccountsSummary
        accounts={accounts}
        onManageAccounts={onManageAccounts}
      />

      {portalToken && (
        <BuyerCorrection
          portalToken={portalToken}
          token={token}
          onCorrected={() => { void reload(); }}
        />
      )}

      <OrderList
        onCheckTransactions={onCheckTransactions}
        token={token}
        onCorrected={() => { void reload(); }}
        orders={orders}
        statusFilter={statusFilter}
        onFilterChange={changeStatus}
        search={search}
        onSearchChange={changeSearch}
        workQuery={workQuery}
        onClearWorkQuery={clearWorkQuery}
        dateMode={dateMode}
        dateFrom={dateFrom}
        dateTo={dateTo}
        lastDays={lastDays}
        appliedDateRange={appliedDateRange}
        dateError={dateError}
        onDateModeChange={changeDateMode}
        onDateFromChange={changeDateFrom}
        onDateToChange={changeDateTo}
        onLastDaysChange={changeLastDays}
        onApplyDates={applyCustomDates}
        onApplyPreset={applyRelativePreset}
        onApplyLastDays={applyLastDays}
        loading={loading}
        nextCursor={nextCursor}
        onLoadMore={loadMore}
      />
    </section>
  );
}
