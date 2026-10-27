import React, { useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal, ReceiptText } from 'lucide-react';
import type { PaymentAccount, ReceiptView } from './types';
import { EvidenceResolution } from './EvidenceResolution';
import { TransactionCard } from './TransactionCard';

interface TransactionInboxProps {
  transactions: ReceiptView[];
  accounts?: PaymentAccount[];
  token?: string;
  onResolved?: () => void;
  loading?: boolean;
  filter: string;
  onFilterChange: (filter: string) => void;
  nextCursor?: string | null;
  onLoadMore?: () => void;
  onRefresh?: () => void;
}

export function TransactionInbox({
  transactions,
  accounts,
  token,
  onResolved,
  loading = false,
  filter,
  onFilterChange,
  nextCursor,
  onLoadMore,
  onRefresh,
}: TransactionInboxProps): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="isolated-section">
      <div className="isolated-section-header">
        <div>
          <h4 className="isolated-section-title">
            <ReceiptText size={18} /> Transaction Ledger &amp; Observations
          </h4>
          <p className="isolated-section-desc">
            Received payment SMS extractions, manual payment records, and reconciliation history.
          </p>
        </div>
        <span className="section-tab-count" style={{ alignSelf: 'center', fontSize: '0.78rem', padding: '3px 8px' }}>
          {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>

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
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter:</span>
          <select
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
            <option value="">All Transactions</option>
            <option value="conflicted">Conflicted Only</option>
            <option value="incomplete">Incomplete Only</option>
            <option value="unmatched">Unmatched Only</option>
            <option value="used">Used Only</option>
          </select>
        </div>

        {onRefresh && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Inbox
          </button>
        )}
      </div>

      {transactions.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            {filter
              ? 'No received transactions match the selected filter.'
              : 'No received payments recorded yet. Click "Record Received Payment" above to add manual payment observations.'}
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
                Load More Received Payments
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
