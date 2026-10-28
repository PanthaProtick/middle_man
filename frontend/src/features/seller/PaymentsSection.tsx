import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
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
  transactionsSearch: string;
  transactionsNextCursor: string | null;
  onOpenRecordModal: (accountId?: string) => void;
  onRefreshTransactions: () => void;
  onTransactionsChanged: () => void;
  onFilterChange: (filter: string) => void;
  onSearchChange: (search: string) => void;
  onLoadMore: () => void;
}

export function PaymentsSection({
  accounts,
  token,
  transactions,
  transactionsLoading,
  transactionsFilter,
  transactionsSearch,
  transactionsNextCursor,
  onOpenRecordModal,
  onRefreshTransactions,
  onTransactionsChanged,
  onFilterChange,
  onSearchChange,
  onLoadMore,
}: PaymentsSectionProps): React.JSX.Element {
  const c = usePaymentInboxCopy();
  return (
    <section aria-labelledby="section-payments-title">
      <div className="isolated-section-header" style={{ marginBottom: '16px' }}>
        <div>
          <h4 id="section-payments-title" className="isolated-section-title">
            <Smartphone size={18} /> {c("Received Payments Inbox")}
          </h4>
          <p className="isolated-section-desc">
            {c("Paste bKash, Nagad, or Rocket SMS to automatically extract transactions and resolve pending buyer orders.")}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onOpenRecordModal()}>
          <Plus size={14} /> {c("Record Payment")}
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
        search={transactionsSearch}
        onSearchChange={onSearchChange}
        nextCursor={transactionsNextCursor}
        onLoadMore={onLoadMore}
        onRefresh={onRefreshTransactions}
      />
    </section>
  );
}
