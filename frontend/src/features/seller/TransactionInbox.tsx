import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal, ReceiptText } from 'lucide-react';
import type { PaymentAccount, ReceiptView } from './types';
import { EvidenceResolution } from './EvidenceResolution';
import { TransactionCard } from './TransactionCard';
import { OrderDateControls } from './OrderDateControls';
import type { useDateSelection } from './useDateSelection';

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
    <div className="isolated-section" aria-busy={loading}>
      <div className="isolated-section-header">
        <div>
          <h4 className="isolated-section-title">
            <ReceiptText size={18} /> {c("Transaction Ledger & Observations")}
          </h4>
          <p className="isolated-section-desc">
            {c("Received payment SMS extractions, manual payment records, and reconciliation history.")}
          </p>
        </div>
        <span className="section-tab-count" style={{ alignSelf: 'center', fontSize: '0.78rem', padding: '3px 8px' }}>
          {transactions.length} {transactions.length === 1 ? c("transaction") : c("transactions")}
        </span>
      </div>

      <form
        role="search"
        aria-label={c("Search received payments")}
        onSubmit={(event) => {
          event.preventDefault();
          onSearchChange(search);
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}
      >
        <label htmlFor="transaction-search" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {c("Search received payments")}
        </label>
        <input
          id="transaction-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={c("TrxID, receipt ID, sender or receiving account")}
          autoComplete="off"
          className="form-control"
          style={{ padding: '6px 10px', fontSize: '0.85rem', minHeight: '38px', minWidth: '260px' }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onSearchChange(search)}
          disabled={loading}
          style={{ minHeight: '38px' }}
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
            style={{ minHeight: '38px' }}
          >
            {c("Clear search")}
          </button>
        )}
      </form>

      {dates && <OrderDateControls
        idPrefix="transaction"
        label={c("Recorded date:")}
        mode={dates.dateMode} from={dates.dateFrom} to={dates.dateTo}
        lastDays={dates.lastDays} appliedRange={dates.appliedDateRange} error={dates.dateError}
        onModeChange={dates.changeDateMode} onFromChange={dates.changeDateFrom}
        onToChange={dates.changeDateTo} onLastDaysChange={dates.changeLastDays}
        onApplyDates={dates.applyCustomDates} onApplyPreset={dates.applyRelativePreset}
        onApplyLastDays={dates.applyLastDays}
      />}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <SlidersHorizontal size={16} color="var(--text-secondary)" />
          <label htmlFor="transaction-filter" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {c("Filter:")}
          </label>
          <select
            id="transaction-filter"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="form-control"
            style={{
              padding: '6px 10px',
              minHeight: '38px',
              fontSize: '0.85rem',
              width: 'auto',
            }}
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
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {c("Refresh Inbox")}
          </button>
        )}
      </div>

      <div className="ledger-scroll-viewport" data-testid="transaction-scroll-viewport">
        {loading && transactions.length === 0 ? (
          <div
            className="ledger-scroll-empty-state"
            role="status"
            style={{ borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}
          >
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
              {c("Loading received payments…")}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div
            className="ledger-scroll-empty-state"
            style={{ borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}
          >
            <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transactions.map((tx) => (
              <React.Fragment key={tx.id}>
                <TransactionCard
                  transaction={tx}
                  isExpanded={expandedId === tx.id}
                  onToggleExpand={() => toggleExpand(tx.id)}
                />
                {expandedId === tx.id && token && (
                  <EvidenceResolution receiptId={tx.id} token={token} accounts={accounts} onResolved={onResolved ?? (() => {})} />
                )}
              </React.Fragment>
            ))}

            {nextCursor && onLoadMore && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
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
