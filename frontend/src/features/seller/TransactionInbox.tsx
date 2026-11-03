import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal, ReceiptText } from 'lucide-react';
import type { PaymentAccount, ReceiptView } from './types';
import { EvidenceResolution } from './EvidenceResolution';
import { TransactionCard } from './TransactionCard';
import { OrderDateControls } from './OrderDateControls';
import type { useDateSelection } from './useDateSelection';
import { useScrollRetention } from './useScrollRetention';
import './TransactionInbox.css';

interface TransactionInboxProps {
  dates?: ReturnType<typeof useDateSelection>;
  transactions: ReceiptView[];
  accounts?: PaymentAccount[];
  token?: string;
  onResolved?: () => void;
  loading?: boolean;
  filter: string;
  onFilterChange: (filter: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  nextCursor?: string | null;
  onLoadMore?: () => void;
  onRefresh?: () => void;
}

export function TransactionInbox({
  dates,
  transactions,
  accounts,
  token,
  onResolved,
  loading = false,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  nextCursor,
  onLoadMore,
  onRefresh,
}: TransactionInboxProps): React.JSX.Element {
  const c = usePaymentInboxCopy();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const resetKey = `${filter}|${search}|${dates?.appliedDateRange?.from ?? ''}|${dates?.appliedDateRange?.to ?? ''}`;
  const { viewportRef, handleScroll } = useScrollRetention(transactions, resetKey);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const emptyMessage = dates?.appliedDateRange
    ? c("No received payments match this search, date and filter.")
    : search.trim()
    ? c("No received payments match this search and filter.")
    : filter
      ? c("No received transactions match the selected filter.")
      : c('No received payments recorded yet. Click "Record Received Payment" above to add manual payment observations.');

  return (
    <div className="isolated-section transaction-inbox" aria-busy={loading}>
      <div className="isolated-section-header">
        <div>
          <h4 className="isolated-section-title">
            <ReceiptText size={18} aria-hidden="true" /> {c("Transaction Ledger & Observations")}
          </h4>
          <p className="isolated-section-desc">
            {c("Received payment records and reconciliation history.")}
          </p>
        </div>
        <span className="section-tab-count transaction-count">
          {transactions.length} {transactions.length === 1 ? c("transaction") : c("transactions")}
        </span>
      </div>

      <div className="transaction-toolbar">
        <form
          role="search"
          aria-label={c("Search received payments")}
          className="transaction-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchChange(search);
          }}
        >
          <label htmlFor="transaction-search" className="transaction-search-label">
            {c("Search received payments")}
          </label>
          <input
            id="transaction-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={c("TrxID, receipt ID, sender or receiving account")}
            autoComplete="off"
            className="form-control transaction-search-input"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSearchChange(search)}
            disabled={loading}
          >
            {c("Search")}
          </button>
          {search && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label={c("Clear search")}
              onClick={() => onSearchChange('')}
              disabled={loading}
            >
              {c("Clear search")}
            </button>
          )}
        </form>

        {dates && (
          <div className="transaction-date-block">
            <OrderDateControls
              idPrefix="transaction"
              label={c("Recorded date:")}
              mode={dates.dateMode} from={dates.dateFrom} to={dates.dateTo}
              lastDays={dates.lastDays} appliedRange={dates.appliedDateRange} error={dates.dateError}
              onModeChange={dates.changeDateMode} onFromChange={dates.changeDateFrom}
              onToChange={dates.changeDateTo} onLastDaysChange={dates.changeLastDays}
              onApplyDates={dates.applyCustomDates} onApplyPreset={dates.applyRelativePreset}
              onApplyLastDays={dates.applyLastDays}
            />
            <p className="transaction-date-hint">
              {c("Dates filter by recorded time; each row shows the payment occurrence separately.")}
            </p>
          </div>
        )}

        <div className="transaction-filter-row">
          <div className="transaction-filter-group">
            <SlidersHorizontal size={16} color="var(--text-secondary)" aria-hidden="true" />
            <label htmlFor="transaction-filter" className="transaction-filter-label">
              {c("Filter:")}
            </label>
            <select
              id="transaction-filter"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="form-control transaction-filter-select"
            >
              <option value="">{c("All Transactions")}</option>
              <option value="conflicted">{c("Conflicted Only")}</option>
              <option value="incomplete">{c("Incomplete Only")}</option>
              <option value="unmatched">{c("Unmatched Only")}</option>
              <option value="used">{c("Used Only")}</option>
            </select>
          </div>

          {onRefresh && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" /> {c("Refresh Inbox")}
            </button>
          )}
        </div>
      </div>

      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="ledger-scroll-viewport"
        data-testid="transaction-scroll-viewport"
      >
        {loading && transactions.length === 0 ? (
          <div className="ledger-scroll-empty-state transaction-empty-state" role="status">
            <p className="transaction-empty-copy">{c("Loading received payments…")}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="ledger-scroll-empty-state transaction-empty-state">
            <Search size={24} className="transaction-empty-icon" aria-hidden="true" />
            <p className="transaction-empty-copy">{emptyMessage}</p>
          </div>
        ) : (
          <div className="transaction-card-list">
            {transactions.map((tx) => (
              <React.Fragment key={tx.id}>
                <TransactionCard
                  transaction={tx}
                  accounts={accounts}
                  isExpanded={expandedId === tx.id}
                  onToggleExpand={() => toggleExpand(tx.id)}
                />
                {expandedId === tx.id && token && (
                  <EvidenceResolution receiptId={tx.id} token={token} accounts={accounts} onResolved={onResolved ?? (() => {})} />
                )}
              </React.Fragment>
            ))}

            {nextCursor && onLoadMore && (
              <div className="transaction-load-more">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={onLoadMore}
                  disabled={loading}
                >
                  {c("Load More Received Payments")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
