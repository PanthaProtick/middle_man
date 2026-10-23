import React, { useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import type { ReceiptView } from './types';
import { TransactionCard } from './TransactionCard';

interface TransactionInboxProps {
  transactions: ReceiptView[];
  loading?: boolean;
  filter: string;
  onFilterChange: (filter: string) => void;
  nextCursor?: string | null;
  onLoadMore?: () => void;
  onRefresh?: () => void;
}

export function TransactionInbox({
  transactions,
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
    <div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter:</span>
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'rgba(10, 14, 23, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All Transactions</option>
            <option value="conflicted">⚠️ Conflicted Only</option>
            <option value="incomplete">ℹ️ Incomplete Only</option>
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
            padding: '32px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {filter
              ? 'No received transactions match the selected filter.'
              : 'No received payments recorded yet. Click "Record Received Payment" above to add manual payment observations.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {transactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              isExpanded={expandedId === tx.id}
              onToggleExpand={() => toggleExpand(tx.id)}
            />
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
