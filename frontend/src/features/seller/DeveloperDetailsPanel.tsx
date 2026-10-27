import React, { useState } from 'react';
import { Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { SellerOrder } from './types';
import { formatBangladeshTime } from './api';

interface DeveloperDetailsPanelProps {
  order: SellerOrder;
  initialOpen?: boolean;
}

export function DeveloperDetailsPanel({ order, initialOpen = false }: DeveloperDetailsPanelProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [copied, setCopied] = useState(false);

  const getDiagnosticPayload = (): string => {
    return [
      '--- ORDER DIAGNOSTIC DETAILS (FOR DEV SUPPORT) ---',
      `Order ID: ${order.id}`,
      `Version: ${order.version}`,
      `Lifecycle: ${order.lifecycle}`,
      `Product: ${order.product_name}`,
      `Total: BDT ${(order.total_minor / 100).toFixed(2)}`,
      `Required Advance: BDT ${(order.required_advance_minor / 100).toFixed(2)}`,
      `Expected COD: BDT ${(order.expected_cod_minor / 100).toFixed(2)}`,
      `Actual COD: ${order.actual_cod_minor !== null && order.actual_cod_minor !== undefined ? `BDT ${(order.actual_cod_minor / 100).toFixed(2)}` : 'N/A'}`,
      `Allocation Basis: ${order.allocation_basis ?? 'automatic'}`,
      `Payment Account ID: ${order.payment_account_id}`,
      `Account: ${order.account_provider.toUpperCase()} (${order.account_receiving_number})`,
      `Portal Token: ${order.portal_token}`,
      `Portal URL: ${order.portal_url}`,
      `Predecessor Order ID: ${order.predecessor_order_id ?? 'None'}`,
      `Replaced By Order ID: ${order.replaced_by_order_id ?? 'None'}`,
      `Review Reasons: ${order.review_reasons?.length ? order.review_reasons.join(', ') : 'None'}`,
      `Buyer Revision: ${order.buyer_revision ?? 'None'}`,
      `Created At: ${order.created_at}`,
      `Expires At: ${order.expires_at}`,
      `Completed At: ${order.completed_at ?? 'None'}`,
      '---------------------------------------------------',
    ].join('\n');
  };

  const handleCopyDiagnostics = async (): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(getDiagnosticPayload());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        marginTop: '16px',
        marginBottom: '16px',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls={`dev-panel-${order.id}`}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            padding: 0,
            fontWeight: 500,
          }}
        >
          <Terminal size={14} color="var(--primary-accent)" />
          <span>Developer details (for support / কারিগরি তথ্য)</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isOpen && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyDiagnostics}
            title="Copy diagnostic information for technical support"
            style={{ fontSize: '0.725rem', padding: '3px 8px' }}
          >
            {copied ? <Check size={12} color="var(--emerald-accent)" /> : <Copy size={12} />}
            <span>{copied ? 'Copied to clipboard' : 'Copy dev info'}</span>
          </button>
        )}
      </div>

      <div
        id={`dev-panel-${order.id}`}
        role="region"
        aria-label="Developer diagnostic details"
        style={{
          display: isOpen ? 'block' : 'none',
          padding: '12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '8px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Order ID: </span>
            <code style={{ color: 'var(--primary-accent)', wordBreak: 'break-all' }}>{order.id}</code>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Version: </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>v{order.version}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Allocation Basis: </span>
            <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {order.allocation_basis ?? 'automatic'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Payment Account ID: </span>
            <code style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{order.payment_account_id}</code>
          </div>
          {order.predecessor_order_id && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Predecessor Order ID: </span>
              <code style={{ color: 'var(--primary-accent)' }}>{order.predecessor_order_id}</code>
            </div>
          )}
          {order.replaced_by_order_id && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Replaced by Order ID: </span>
              <code style={{ color: 'var(--rose-accent)' }}>{order.replaced_by_order_id}</code>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Portal Token: </span>
            <code style={{ color: 'var(--text-primary)' }}>{order.portal_token}</code>
          </div>
          {order.buyer_revision && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Buyer Revision: </span>
              <span style={{ color: 'var(--text-primary)' }}>#{order.buyer_revision}</span>
            </div>
          )}
        </div>

        {order.review_reasons && order.review_reasons.length > 0 && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)' }}>
            <span style={{ color: 'var(--rose-accent)', fontWeight: 600 }}>Raw Review Reasons: </span>
            <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {order.review_reasons.map((r) => (
                <span
                  key={r}
                  style={{
                    padding: '1px 6px',
                    borderRadius: '3px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--rose-accent)',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          Server Deadlines: Created {formatBangladeshTime(order.created_at)} · Expires {formatBangladeshTime(order.expires_at)}
        </div>
      </div>
    </div>
  );
}
