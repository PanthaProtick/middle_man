import React from 'react';
import { Smartphone, Plus } from 'lucide-react';
import { SmsImportPanel } from './SmsImportPanel';
import { TransactionInbox } from './TransactionInbox';
import type { PaymentAccount, ReceiptView } from './types';

interface PaymentsSectionProps {
  accounts: PaymentAccount[];
  token: string;
  transactions: ReceiptView[];
  transactionsLoading: boolean;
  transactionsFilter: string;
  transactionsNextCursor: string | null;
  onOpenRecordModal: (accountId?: string) => void;
  onRefreshTransactions: (filter: string) => void;
  onTransactionsChanged: () => void;
  onFilterChange: (filter: string) => void;
  onLoadMore: () => void;
}

export function PaymentsSection({
  accounts,
  token,
  transactions,
  transactionsLoading,
  transactionsFilter,
  transactionsNextCursor,
  onOpenRecordModal,
  onRefreshTransactions,
  onTransactionsChanged,
  onFilterChange,
  onLoadMore,
}: PaymentsSectionProps): React.JSX.Element {
  return (
    <section aria-labelledby="section-payments-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 id="section-payments-title" style={{ color: 'var(--primary-accent)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Smartphone size={16} /> Received Payments Inbox
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0' }}>
            Paste bKash, Nagad, or Rocket SMS to automatically extract transactions and resolve pending buyer orders.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onOpenRecordModal()}>
          <Plus size={14} /> Record Payment
        </button>
      </div>

      <SmsImportPanel
        accounts={accounts}
        token={token}
        onManual={(id) => onOpenRecordModal(id)}
        onImported={onTransactionsChanged}
      />

      <TransactionInbox
        accounts={accounts}
        token={token}
        onResolved={onTransactionsChanged}
        transactions={transactions}
        loading={transactionsLoading}
        filter={transactionsFilter}
        onFilterChange={onFilterChange}
        nextCursor={transactionsNextCursor}
        onLoadMore={onLoadMore}
        onRefresh={() => onRefreshTransactions(transactionsFilter)}
      />
    </section>
  );
}
