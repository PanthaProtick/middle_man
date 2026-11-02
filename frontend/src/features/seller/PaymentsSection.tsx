import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React from 'react';
import { ShieldCheck, Smartphone, Plus } from 'lucide-react';
import { SmsImportPanel } from './SmsImportPanel';
import { TransactionInbox } from './TransactionInbox';
import type { PaymentAccount, ReceiptView } from './types';
import type { useDateSelection } from './useDateSelection';
import './PaymentsSection.css';

interface PaymentsSectionProps {
  dates?: ReturnType<typeof useDateSelection>;
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
  dates,
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
    <section className="payments-section" aria-labelledby="section-payments-title">
      <div className="isolated-section-header payments-section-header">
        <div>
          <h4 id="section-payments-title" className="isolated-section-title">
            <Smartphone size={18} aria-hidden="true" /> {c("Received Payments Inbox")}
          </h4>
          <p className="isolated-section-desc">
            {c("Paste bKash, Nagad, or Rocket SMS to automatically extract transactions and resolve pending buyer orders.")}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onOpenRecordModal()}>
          <Plus size={14} aria-hidden="true" /> {c("Record Payment")}
        </button>
      </div>

      <nav className="payments-step-rail" aria-label={c("Payment evidence steps")}>
        <a className="payments-step-link" href="#payments-evidence">
          <span className="payments-step-number" aria-hidden="true">1</span>
          <span className="payments-step-copy">
            <span className="payments-step-label">{c("Step 1 · Add evidence")}</span>
            <span className="payments-step-hint">{c("Paste SMS or record a manual payment")}</span>
          </span>
        </a>
        <a className="payments-step-link" href="#payments-reconciliation">
          <span className="payments-step-number" aria-hidden="true">2</span>
          <span className="payments-step-copy">
            <span className="payments-step-label">{c("Step 2 · Review reconciliation")}</span>
            <span className="payments-step-hint">{c("Compare evidence and resolve outcomes")}</span>
          </span>
        </a>
      </nav>

      <p className="payments-observation-note">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{c("Seller records and SMS evidence are observations, not provider verification.")}</span>
      </p>

      <div id="payments-evidence" className="payments-step-panel">
        <SmsImportPanel
          accounts={accounts}
          token={token}
          onManual={(id) => onOpenRecordModal(id)}
          onImported={onTransactionsChanged}
        />
      </div>

      <div id="payments-reconciliation" className="payments-step-panel">
        <TransactionInbox
          dates={dates}
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
      </div>
    </section>
  );
}
