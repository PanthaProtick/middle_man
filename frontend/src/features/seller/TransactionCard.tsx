import { useLocale } from '../locale/context';
import { formatBangladeshDateTime } from '../locale/format';
import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ReceiptView } from './types';


interface TransactionCardProps {
  transaction: ReceiptView;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function TransactionCard({
  transaction: tx,
  isExpanded,
  onToggleExpand,
}: TransactionCardProps): React.JSX.Element {
  const c = usePaymentInboxCopy();
  const { locale } = useLocale();
  const formatBangladeshTime = (value: string) => formatBangladeshDateTime(value, locale);
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  const state = (value: string) => ['unmatched', 'used', 'allocated', 'conflicted', 'incomplete', 'matched', 'conflicting', 'identical', 'consistent', 'initial', 'none'].includes(value) ? c(value) : c('Needs review');
  const isIncomplete = !tx.sender_number_canonical || !tx.occurred_at;

  return (
    <div
      style={{
        overflowWrap: 'anywhere', minWidth: 0,
        background: 'var(--bg-surface)',
        border: tx.has_conflict
          ? '1px solid rgba(239, 68, 68, 0.4)'
          : isIncomplete
          ? '1px solid rgba(245, 158, 11, 0.4)'
          : '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '14px',
      }}
    >
      <div
        data-testid={`tx-header-${tx.id}`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        role="button" tabIndex={0} aria-expanded={isExpanded}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggleExpand(); } }}
        onClick={onToggleExpand}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              background: tx.provider === 'bkash' ? '#e2136e' : '#f7941d',
              color: 'var(--text-primary)',
            }}
          >
            {tx.provider}
          </span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-accent)' }}>
            {tx.trx_id}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            ৳{(tx.amount_minor / 100).toFixed(2)}
          </span>

          {/* Status Badges */}
          {tx.has_conflict && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                background: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--rose-accent)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
              }}
            >
              <AlertTriangle size={12} /> {c("Conflicting Observations")}
            </span>
          )}

          {isIncomplete && !tx.has_conflict && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                background: 'rgba(245, 158, 11, 0.2)',
                color: 'var(--amber-accent)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
            >
              <Clock size={12} /> {c("Incomplete")}
            </span>
          )}

          {!tx.has_conflict && !isIncomplete && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                background: 'rgba(16, 185, 129, 0.2)',
                color: 'var(--emerald-accent)',
              }}
            >
              <CheckCircle size={12} /> {state(tx.reconciliation_state)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '0.8rem' }}>
            {tx.observations.length} {c(tx.observations.length === 1 ? "observation" : "observations")}
          </span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Sender & Time Summary */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginTop: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          {c("Sender:")} {' '}
          <span style={{ color: tx.sender_number_canonical ? 'var(--text-primary)' : 'var(--amber-accent)' }}>
            {tx.sender_number_canonical || c("Unknown (Incomplete)")}
          </span>
        </div>
        <div>
          {c("Occurred At:")} {' '}
          <span style={{ color: tx.occurred_at ? 'var(--text-primary)' : 'var(--amber-accent)' }}>
            {tx.occurred_at ? formatBangladeshTime(tx.occurred_at) : c("Unknown (Incomplete)")}
          </span>
        </div>
        <div>
          {c("Recorded:")} {' '}
          <span style={{ color: 'var(--text-primary)' }}>{formatBangladeshTime(tx.created_at)}</span>
        </div>
      </div>

      {/* Expanded Observation History */}
      {isExpanded && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h5 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary-accent)' }}>
              {c("Recorded Observations")} ({tx.observations.length})
            </h5>
            <button
              type="button"
              onClick={() => setShowSystemDetails((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-accent)',
                cursor: 'pointer',
                fontSize: '0.725rem',
                textDecoration: 'underline',
                padding: 0,
              }}
              aria-expanded={showSystemDetails}
            >
              {showSystemDetails ? c("Hide dev details") : c("Show dev details")}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tx.observations.map((obs, idx) => (
              <div
                key={obs.id || idx}
                style={{
                  background:
                    obs.conflict_state === 'conflicting'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(0, 0, 0, 0.2)',
                  border:
                    obs.conflict_state === 'conflicting'
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c("Observation #")}{idx + 1} ({locale === "en" ? obs.source.toUpperCase() : c(obs.source)})
                  </span>
                  <span
                    style={{
                      color:
                        obs.conflict_state === 'conflicting'
                          ? 'var(--rose-accent)'
                          : obs.conflict_state === 'identical'
                          ? 'var(--primary-accent)'
                          : 'var(--emerald-accent)',
                      fontWeight: 500,
                    }}
                  >
                    {c("Status:")} {state(obs.conflict_state)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px' }}>
                  <div>{c("Amount:")} ৳{(obs.amount_minor / 100).toFixed(2)}</div>
                  <div>
                    {c("Sender:")} {obs.sender_number_canonical || <span style={{ color: 'var(--amber-accent)' }}>{c("Unknown")}</span>}
                  </div>
                  <div>
                    {c("Time:")} {obs.occurred_at ? formatBangladeshTime(obs.occurred_at) : <span style={{ color: 'var(--amber-accent)' }}>{c("Unknown")}</span>}
                  </div>
                  <div style={{ display: showSystemDetails ? 'block' : 'none' }}>{c("Actor:")} {obs.actor}</div>
                  <div>{c("Recorded:")} {formatBangladeshTime(obs.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
