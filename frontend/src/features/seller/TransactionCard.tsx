import { useLocale } from '../locale/context';
import { formatBangladeshDateTime, formatBdt, formatCount } from '../locale/format';
import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
} from 'lucide-react';
import type { PaymentAccount, ReceiptView } from './types';
import { TransactionObservation } from './TransactionObservation';
import {
  isIncompleteReceipt,
  receiptStatusLabel,
  receiptTone,
  type TransactionTone,
} from './transactionPresentation';
import './TransactionCard.css';

interface TransactionCardProps {
  transaction: ReceiptView;
  accounts?: PaymentAccount[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function StatusIcon({ tone }: { tone: TransactionTone }): React.JSX.Element {
  if (tone === 'rose') return <AlertTriangle size={12} aria-hidden="true" />;
  if (tone === 'amber') return <Clock size={12} aria-hidden="true" />;
  if (tone === 'emerald') return <CheckCircle size={12} aria-hidden="true" />;
  return <CircleDot size={12} aria-hidden="true" />;
}

export function TransactionCard({
  transaction: tx,
  accounts,
  isExpanded,
  onToggleExpand,
}: TransactionCardProps): React.JSX.Element {
  const c = usePaymentInboxCopy();
  const { locale } = useLocale();
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  const tone = receiptTone(tx);
  const incomplete = isIncompleteReceipt(tx);
  const account = accounts?.find((item) => item.id === tx.payment_account_id);
  const accountLabel = account
    ? `${account.provider} — ${account.label} (${account.receiving_number})`
    : tx.payment_account_id;

  return (
    <article className="transaction-card" data-tone={tone}>
      <div
        className="transaction-card-header"
        data-testid={`tx-header-${tx.id}`}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggleExpand(); } }}
        onClick={onToggleExpand}
      >
        <div className="transaction-card-identity">
          <span className="transaction-provider" data-provider={tx.provider}>{tx.provider}</span>
          <span className="transaction-trx">{tx.trx_id}</span>
          <span className="transaction-amount">{formatBdt(tx.amount_minor)}</span>
          <span className="transaction-state" data-tone={tone}>
            <StatusIcon tone={tone} /> {receiptStatusLabel(c, tx)}
          </span>
        </div>

        <div className="transaction-card-summary">
          {tx.related_claims_count > 0 && (
            <span className="transaction-claims">
              {c("Related claims:")} {formatCount(tx.related_claims_count)}
            </span>
          )}
          <span className="transaction-observation-count">
            {formatCount(tx.observations.length)} {c(tx.observations.length === 1 ? 'observation' : 'observations')}
          </span>
          {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </div>
      </div>

      <dl className="transaction-meta">
        <div>
          <dt>{c("Received in")}</dt>
          <dd className="transaction-meta-account">{accountLabel}</dd>
        </div>
        <div>
          <dt>{c("Sender:")}</dt>
          <dd className={incomplete && !tx.sender_number_canonical ? 'transaction-missing' : undefined}>
            {tx.sender_number_canonical || c("Unknown (Incomplete)")}
          </dd>
        </div>
        <div>
          <dt>{c("Payment occurred")}</dt>
          <dd className={incomplete && !tx.occurred_at ? 'transaction-missing' : undefined}>
            {tx.occurred_at ? formatBangladeshDateTime(tx.occurred_at, locale) : c("Unknown (Incomplete)")}
          </dd>
        </div>
        <div>
          <dt>{c("Recorded:")}</dt>
          <dd>{formatBangladeshDateTime(tx.created_at, locale)}</dd>
        </div>
      </dl>

      {isExpanded && (
        <div className="transaction-expansion">
          <div className="transaction-expansion-head">
            <h5 className="transaction-expansion-title">
              {c("Recorded Observations")} ({formatCount(tx.observations.length)})
            </h5>
            <button
              type="button"
              className="transaction-dev-toggle"
              onClick={() => setShowSystemDetails((prev) => !prev)}
              aria-expanded={showSystemDetails}
            >
              {showSystemDetails ? c("Hide dev details") : c("Show dev details")}
            </button>
          </div>
          <div className="transaction-observations">
            {tx.observations.map((obs, idx) => (
              <TransactionObservation
                key={obs.id || idx}
                observation={obs}
                index={idx}
                showSystemDetails={showSystemDetails}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
