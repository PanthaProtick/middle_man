import React from 'react';
import { CreditCard, Phone, Hash } from 'lucide-react';
import type { BuyerFormDraft, PublicOrder } from './types';
import { formatBDT } from './api';
import { useLocale } from '../locale';

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
  const { t } = useLocale();
  return (
    <>
      {/* Payment Provider & Amount */}
      <div className="form-grid-2">
        <div className="form-group">
          <label
            htmlFor="payment_provider"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}
          >
            <CreditCard size={15} color="var(--primary-accent)" />
            <span>{t('buyer.form.method')}</span>
          </label>
          <select
            id="payment_provider"
            name="payment_provider"
            value={draft.payment_provider}
            aria-describedby={fieldErrors.payment_provider ? 'payment_provider-error' : undefined}
            aria-invalid={!!fieldErrors.payment_provider}
            onChange={(e) => onUpdateField('payment_provider', e.target.value as 'bkash' | 'nagad')}
            className="form-control"
            style={{ marginTop: '6px', width: '100%' }}
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
          </select>
          {fieldErrors.payment_provider && <div id="payment_provider-error" role="alert">{fieldErrors.payment_provider}</div>}
        </div>

        <div className="form-group">
          <label
            htmlFor="claimed_advance_bdt"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}
          >
            <span>{t('buyer.form.amount')}</span>
          </label>
          <input
            id="claimed_advance_bdt"
            name="claimed_advance_bdt"
            type="text"
            inputMode="decimal"
            value={draft.claimed_advance_bdt}
            onChange={(e) => onUpdateField('claimed_advance_bdt', e.target.value)}
            aria-describedby={`claimed_advance_bdt-help${fieldErrors.claimed_advance_bdt ? ' claimed_advance_bdt-error' : ''}`}
            aria-invalid={!!fieldErrors.claimed_advance_bdt}
            className="form-control"
            style={{ marginTop: '6px', width: '100%' }}
          />
          <div id="claimed_advance_bdt-help" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {t('buyer.form.expected', { amount: formatBDT(order.required_advance_minor) })}
          </div>
          {fieldErrors.claimed_advance_bdt && (
            <div id="claimed_advance_bdt-error" role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '4px' }}>
              {fieldErrors.claimed_advance_bdt}
            </div>
          )}
        </div>
      </div>

      {/* Payment Sender Number */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label
          htmlFor="payment_sender"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}
        >
          <Phone size={15} color="var(--primary-accent)" />
          <span>{t('buyer.form.sender')} <span style={{ color: 'var(--rose-accent)' }}>*</span></span>
        </label>
        <input
          id="payment_sender"
          name="payment_sender"
          maxLength={32}
          type="tel"
          value={draft.payment_sender}
          onChange={(e) => onUpdateField('payment_sender', e.target.value)}
          placeholder={t('buyer.form.senderPlaceholder')}
          aria-describedby={`payment_sender-help${fieldErrors.payment_sender ? ' payment_sender-error' : ''}`}
          aria-invalid={!!fieldErrors.payment_sender}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        <div id="payment_sender-help" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {t('buyer.form.senderHelp')}
        </div>
        {fieldErrors.payment_sender && (
          <div id="payment_sender-error" role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '4px' }}>
            {fieldErrors.payment_sender}
          </div>
        )}
      </div>

      {/* Transaction ID */}
      <div className="form-group" style={{ marginBottom: '6px' }}>
        <label
          htmlFor="payment_trx_id"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}
        >
          <Hash size={15} color="var(--primary-accent)" />
          <span>{t('buyer.form.trx')} <span style={{ color: 'var(--rose-accent)' }}>*</span></span>
        </label>
        <input
          id="payment_trx_id"
          name="payment_trx_id"
          maxLength={128}
          type="text"
          value={draft.payment_trx_id}
          onChange={(e) => onUpdateField('payment_trx_id', e.target.value)}
          placeholder={t('buyer.form.trxPlaceholder')}
          aria-describedby={fieldErrors.payment_trx_id ? "payment_trx_id-error" : undefined}
          aria-invalid={!!fieldErrors.payment_trx_id}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        {fieldErrors.payment_trx_id && (
          <div id="payment_trx_id-error" role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '4px' }}>
            {fieldErrors.payment_trx_id}
          </div>
        )}
      </div>
    </>
  );
}
