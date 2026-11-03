import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React from 'react';
import { ShieldCheck, Smartphone, Plus } from 'lucide-react';
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
            {c("Record received payments from your payment app and review matches with buyer claims.")}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onOpenRecordModal()}>
          <Plus size={14} aria-hidden="true" /> {c("Record Payment")}
        </button>
      </div>

      <nav className="payments-step-rail" aria-label={c("Payment evidence steps")}>
        <button type="button" className="payments-step-link" onClick={() => onOpenRecordModal()}>
          <span className="payments-step-number" aria-hidden="true">1</span>
          <span className="payments-step-copy">
            <span className="payments-step-label">{c("Step 1 · Add evidence")}</span>
            <span className="payments-step-hint">{c("Record a received payment")}</span>
          </span>
        </button>
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
        <span>{c("Seller payment records are observations, not provider verification.")}</span>
      </p>

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
