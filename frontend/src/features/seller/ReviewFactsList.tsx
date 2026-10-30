import React from 'react';
import { formatBdt, formatCount } from '../locale/format';
import { reviewAssistanceCopy } from '../locale/reviewAssistanceCopy';
import type { Locale } from '../locale/storage';
import type { ConflictCategory, ReviewFacts } from './reviewAssistanceApi';

interface ReviewFactsListProps {
  facts: ReviewFacts;
  locale: Locale;
}

interface FactRow {
  key: string;
  label: string;
  value: string;
}

export function ReviewFactsList({ facts, locale }: ReviewFactsListProps): React.JSX.Element | null {
  const copy = reviewAssistanceCopy[locale];
  const text = copy.facts;
  const rows: FactRow[] = [];
  const add = (key: string, label: string, value: string) => rows.push({ key, label, value });

  if (facts.required_advance_minor !== undefined) {
    add('required-advance', text.requiredAdvance, formatBdt(facts.required_advance_minor));
  }
  if (facts.claimed_amount_minor !== undefined) {
    add('claimed-amount', text.claimedAmount, formatBdt(facts.claimed_amount_minor));
  }
  if (facts.received_amount_minor !== undefined) {
    add('received-amount', text.receivedAmount, formatBdt(facts.received_amount_minor));
  }
  if (facts.sender_status !== undefined) {
    add('sender', text.sender, facts.sender_status === 'missing' ? text.senderMissing : text.senderDifferent);
  }
  if (facts.time_status !== undefined) {
    const value = facts.time_status === 'missing'
      ? text.timeMissing
      : facts.time_status === 'before_order_creation' ? text.timeBefore : text.timeAfter;
    add('payment-time', text.paymentTime, value);
  }
  if (facts.receiving_account_comparison === 'different') {
    add('receiving-account', text.receivingAccount, text.receivingAccountDifferent);
  }
  if (facts.conflict_categories !== undefined) {
    const labels = facts.conflict_categories.map(
      (category: ConflictCategory) => text.conflictCategoryLabels[category],
    );
    add('conflict-categories', text.conflictCategories, labels.join(', '));
  }
  if (facts.active_claim_count !== undefined) {
    add('active-claim-count', text.activeClaimCount, formatCount(facts.active_claim_count));
  }
  if (facts.claim_held_by_prior_resolution !== undefined) {
    add('held-by-prior-resolution', text.heldByPriorResolution,
      facts.claim_held_by_prior_resolution ? text.yes : text.no);
  }
  if (facts.payment_used !== undefined) {
    add('payment-used', text.paymentUsed, facts.payment_used ? text.yes : text.no);
  }
  if (facts.payment_allocated !== undefined) {
    add('payment-allocated', text.paymentAllocated, facts.payment_allocated ? text.yes : text.no);
  }

  if (rows.length === 0) return null;

  return (
    <div data-testid="review-facts" style={{ marginTop: '10px' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary, #94a3b8)',
          marginBottom: '6px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {copy.factsTitle}
      </div>
      <dl style={{ margin: 0, display: 'grid', gap: '4px' }}>
        {rows.map(row => (
          <div
            key={row.key}
            data-testid={`review-fact-${row.key}`}
            style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.8rem' }}
          >
            <dt style={{ color: 'var(--text-secondary, #94a3b8)' }}>{row.label}</dt>
            <dd style={{ margin: 0, color: 'var(--text-primary, #f8fafc)', textAlign: 'right' }}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
