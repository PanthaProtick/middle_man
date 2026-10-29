import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, AlertCircle, MapPin } from 'lucide-react';
import type { BuyerFormDraft, BuyerSubmissionInput, PublicOrder } from './types';
import type { LocationAvailability } from './pathaoTypes';
import { BuyerContactFields } from './BuyerContactFields';
import { PaymentClaimFields } from './PaymentClaimFields';
import { PathaoLocations } from './PathaoLocations';
import { useLocale } from '../locale';
import { validateBuyerDraft } from './validateBuyerDraft';
import { parseClaimedAmount, type ApiError } from './api';
import { formFieldName, fieldMessage } from './submissionErrors';
import type { MessageKey } from '../locale';

interface BuyerSubmissionFormProps {
  portalToken?: string;
  order: PublicOrder;
  draft: BuyerFormDraft;
  onDraftChange: (draft: BuyerFormDraft) => void;
  onSubmit: (submission: BuyerSubmissionInput) => Promise<void>;
  isSubmitting: boolean;
  isLocked?: boolean;
  serverFields?: ApiError['fields'];
  submissionError: string | null;
}

function focusFirstError(form: HTMLFormElement | null, errors: Record<string, unknown>): void {
  Array.from(form?.querySelectorAll<HTMLInputElement>('input[name], textarea[name], select[name]') ?? [])
    .find(input => errors[input.name])?.focus();
}

export function BuyerSubmissionForm({
  portalToken,
  order,
  draft,
  onDraftChange,
  onSubmit,
  isSubmitting,
  isLocked = false,
  serverFields,
  submissionError,
}: BuyerSubmissionFormProps): React.JSX.Element {
  const { t, locale } = useLocale();
  const form = useRef<HTMLFormElement>(null);
  const [validation, setValidation] = useState<{fields: Record<string, MessageKey | ''>; serverFields: ApiError['fields']}>({fields: {}, serverFields});
  const [availability, setAvailability] = useState<LocationAvailability>(() => portalToken
    ? {state: 'loading', city: false, zone: false, area: false}
    : {state: 'unavailable', city: false, zone: false, area: false});
  const clearLocationErrors = useCallback(() => {
    setValidation(current => {
      const fields = Object.entries(current.fields).filter(([field]) => !field.startsWith('pathao_'));
      return fields.length === Object.keys(current.fields).length ? current : {...current, fields: Object.fromEntries(fields)};
    });
  }, []);
  const handleAvailabilityChange = useCallback((next: LocationAvailability) => {
    setAvailability(next);
    clearLocationErrors();
  }, [clearLocationErrors]);
  const localErrors = validation.serverFields === serverFields ? validation.fields : {};
  const fieldErrors = {
    ...Object.fromEntries((serverFields ?? []).map(field => [formFieldName(field.field), fieldMessage(t, field)])),
    ...Object.fromEntries(Object.entries(localErrors).map(([field, code]) => [field, code ? t(code) : ''])),
  };
  useEffect(() => {
    focusFirstError(form.current, Object.fromEntries((serverFields ?? []).map(field => [formFieldName(field.field), true])));
  }, [serverFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateBuyerDraft(draft, portalToken ? availability : undefined);
    setValidation({fields: errors, serverFields});
    if (Object.keys(errors).length) {
      focusFirstError(form.current, errors);
      return;
    }

    const amountMinor = parseClaimedAmount(draft.claimed_advance_bdt);
    const submission: BuyerSubmissionInput = {
      buyer_name: draft.buyer_name.trim(),
      contact_number: draft.contact_number.trim(),
      address: {
        raw_text: draft.address_raw.trim(),
        ...(draft.pathao ? {pathao: draft.pathao} : {}),
      },
      payment_claim: {
        provider: draft.payment_provider,
        trx_id: draft.payment_trx_id.trim(),
        sender_number: draft.payment_sender.trim(),
        amount_minor: amountMinor,
      },
    };

    await onSubmit(submission);
  };

  const updateField = (field: keyof BuyerFormDraft, value: string) => {
    onDraftChange({ ...draft, [field]: value });
    if (fieldErrors[field]) {
      setValidation({fields: { ...localErrors, [field]: '' }, serverFields});
    }
  };

  return (
    <form ref={form} lang={locale} onSubmit={handleSubmit} className="card" style={{ border: '1px solid var(--border-subtle)' }} noValidate>
      <div style={{ marginBottom: '18px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          {t('buyer.form.title')}
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
          {t('buyer.form.intro')}
        </p>
      </div>

      {submissionError && (
        <div
          role="alert"
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--rose-accent)',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{submissionError}</span>
        </div>
      )}

      <fieldset disabled={isSubmitting || isLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <BuyerContactFields draft={draft} fieldErrors={fieldErrors} onUpdateField={updateField} />

        {/* Section 2: Delivery Address & Courier */}
        <div className="buyer-form-section">
          <div className="buyer-form-section-header">
            <div className="buyer-form-section-badge">2</div>
            <div>
              <h4 className="buyer-form-section-title">{t('buyer.form.location')}</h4>
              <p className="buyer-form-section-subtitle">{t('buyer.form.locationHelp')}</p>
            </div>
          </div>

          {portalToken && <PathaoLocations portalToken={portalToken} value={draft.pathao ?? {}} fieldErrors={fieldErrors}
            disabled={isSubmitting || isLocked} onChange={pathao => { clearLocationErrors(); onDraftChange({...draft, pathao}); }}
            onAvailabilityChange={handleAvailabilityChange} />}

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label htmlFor="address_raw" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              <MapPin size={15} color="var(--primary-accent)" />
              <span>{t('buyer.form.address')} <span style={{ color: 'var(--rose-accent)' }}>*</span></span>
            </label>
            <textarea
              id="address_raw"
              name="address_raw"
              rows={3}
              value={draft.address_raw}
              onChange={(e) => updateField('address_raw', e.target.value)}
              placeholder={t('buyer.form.addressPlaceholder')}
              maxLength={2000}
              aria-describedby={fieldErrors.address_raw ? "address_raw-error" : undefined}
              aria-invalid={!!fieldErrors.address_raw}
              className="form-control text-area"
              style={{ marginTop: '6px', width: '100%', resize: 'vertical' }}
            />
            {fieldErrors.address_raw && (
              <div id="address_raw-error" role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.address_raw}</div>
            )}
          </div>
        </div>

        {/* Section 3: Advance Payment Information */}
        <div className="buyer-form-section">
          <div className="buyer-form-section-header">
            <div className="buyer-form-section-badge">3</div>
            <div>
              <h4 className="buyer-form-section-title">{t('buyer.form.payment')}</h4>
              <p className="buyer-form-section-subtitle">{t('buyer.form.paymentHelp')}</p>
            </div>
          </div>

          <PaymentClaimFields
            order={order}
            draft={draft}
            fieldErrors={fieldErrors}
            onUpdateField={updateField}
          />
        </div>
      </fieldset>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '0.95rem',
        }}
      >
        <Send size={18} aria-hidden="true" />
        <span>{t(isSubmitting ? 'buyer.form.submitting' : isLocked ? 'buyer.form.retry' : 'buyer.form.submit')}</span>
      </button>
    </form>
  );
}
