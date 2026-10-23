import React from 'react';
import { CreditCard, Phone, Hash } from 'lucide-react';
import type { BuyerFormDraft, PublicOrder } from './types';
import { formatBDT } from './api';

interface PaymentClaimFieldsProps {
  order: PublicOrder;
  draft: BuyerFormDraft;
  fieldErrors: Record<string, string>;
  onUpdateField: (field: keyof BuyerFormDraft, value: string) => void;
}

export function PaymentClaimFields({
  order,
  draft,
  fieldErrors,
  onUpdateField,
}: PaymentClaimFieldsProps): React.JSX.Element {
  return (
    <>
      <div style={{ margin: '18px 0', borderTop: '1px dashed var(--border-subtle)' }} />

      {/* Payment Provider & Amount */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div className="form-group">
          <label
            htmlFor="payment_provider"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}
          >
            <CreditCard size={15} color="#818cf8" />
            <span>Method / মাধ্যম</span>
          </label>
          <select
            id="payment_provider"
            name="payment_provider"
            value={draft.payment_provider}
            onChange={(e) => onUpdateField('payment_provider', e.target.value as 'bkash' | 'nagad')}
            className="form-control"
            style={{ marginTop: '6px', width: '100%' }}
          >
            <option value="bkash">bKash (বিকাশ)</option>
            <option value="nagad">Nagad (নগদ)</option>
          </select>
        </div>

        <div className="form-group">
          <label
            htmlFor="claimed_advance_bdt"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}
          >
            <span>Amount (BDT) / টাকা</span>
          </label>
          <input
            id="claimed_advance_bdt"
            name="claimed_advance_bdt"
            type="number"
            step="0.01"
            min="0.01"
            value={draft.claimed_advance_bdt}
            onChange={(e) => onUpdateField('claimed_advance_bdt', e.target.value)}
            aria-describedby={fieldErrors.claimed_advance_bdt ? "claimed_advance_bdt-error" : undefined}
          aria-invalid={!!fieldErrors.claimed_advance_bdt}
            className="form-control"
            style={{ marginTop: '6px', width: '100%' }}
          />
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
            Expected: {formatBDT(order.required_advance_minor)}
          </div>
          {fieldErrors.claimed_advance_bdt && (
            <div id="claimed_advance_bdt-error" role="alert" style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>
              {fieldErrors.claimed_advance_bdt}
            </div>
          )}
        </div>
      </div>

      {/* Payment Sender Number */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label
          htmlFor="payment_sender"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}
        >
          <Phone size={15} color="#818cf8" />
          <span>Payment Sender Number / টাকা পাঠানোর বিকাশ/নগদ নাম্বার <span style={{ color: '#ef4444' }}>*</span></span>
        </label>
        <input
          id="payment_sender"
          name="payment_sender"
          maxLength={32}
          type="tel"
          value={draft.payment_sender}
          onChange={(e) => onUpdateField('payment_sender', e.target.value)}
          placeholder="01XXXXXXXXX (number used to send money)"
          aria-describedby={fieldErrors.payment_sender ? "payment_sender-error" : undefined}
          aria-invalid={!!fieldErrors.payment_sender}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
          Can be different if a friend, relative, or agent paid for you (আলাদা নাম্বার হতে পারে)
        </div>
        {fieldErrors.payment_sender && (
          <div id="payment_sender-error" role="alert" style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>
            {fieldErrors.payment_sender}
          </div>
        )}
      </div>

      {/* Transaction ID */}
      <div className="form-group" style={{ marginBottom: '18px' }}>
        <label
          htmlFor="payment_trx_id"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}
        >
          <Hash size={15} color="#818cf8" />
          <span>Transaction ID (TrxID) / ট্রানজেকশন আইডি <span style={{ color: '#ef4444' }}>*</span></span>
        </label>
        <input
          id="payment_trx_id"
          name="payment_trx_id"
          maxLength={128}
          type="text"
          value={draft.payment_trx_id}
          onChange={(e) => onUpdateField('payment_trx_id', e.target.value)}
          placeholder="e.g. 9J4K2L7M"
          aria-describedby={fieldErrors.payment_trx_id ? "payment_trx_id-error" : undefined}
          aria-invalid={!!fieldErrors.payment_trx_id}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        {fieldErrors.payment_trx_id && (
          <div id="payment_trx_id-error" role="alert" style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>
            {fieldErrors.payment_trx_id}
          </div>
        )}
      </div>
    </>
  );
}
