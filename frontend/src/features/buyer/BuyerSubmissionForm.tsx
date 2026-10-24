import React, { useState } from 'react';
import { Send, AlertCircle, User, Phone, MapPin } from 'lucide-react';
import type { BuyerFormDraft, BuyerSubmissionInput, PublicOrder } from './types';
import { PaymentClaimFields } from './PaymentClaimFields';
import { EvidenceUploadField } from './EvidenceUploadField';
import { PaymentAssistance } from './PaymentAssistance';
import { AddressAssistance } from './AddressAssistance';
import { canonicalizeBdPhone } from '../seller/api';
import { parseClaimedAmount } from './api';

interface BuyerSubmissionFormProps {
  portalToken?: string;
  order: PublicOrder;
  draft: BuyerFormDraft;
  onDraftChange: (draft: BuyerFormDraft) => void;
  onSubmit: (submission: BuyerSubmissionInput) => Promise<void>;
  isSubmitting: boolean;
  isLocked?: boolean;
  serverFields?: Record<string, string>;
  submissionError: string | null;
}

export function BuyerSubmissionForm({
  portalToken,
  order,
  draft,
  onDraftChange,
  onSubmit,
  isSubmitting,
  isLocked = false,
  serverFields = {},
  submissionError,
}: BuyerSubmissionFormProps): React.JSX.Element {
  const [localErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldErrors = { ...serverFields, ...localErrors };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!draft.buyer_name.trim()) {
      errors.buyer_name = 'Full name is required / আপনার নাম লিখুন';
    }

    if (!draft.contact_number.trim()) {
      errors.contact_number = 'Contact number is required / যোগাযোগের নাম্বার লিখুন';
    } else {
      try {
        canonicalizeBdPhone(draft.contact_number);
      } catch {
        errors.contact_number = 'Valid 11-digit BD phone number required / সঠিক ১১ ডিজিটের নাম্বার দিন';
      }
    }

    if (!draft.address_raw.trim()) {
      errors.address_raw = 'Delivery address is required / সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন';
    }

    if (!draft.payment_sender.trim()) {
      errors.payment_sender = 'Payment sender number is required / টাকা পাঠানো নাম্বার লিখুন';
    } else {
      try {
        canonicalizeBdPhone(draft.payment_sender);
      } catch {
        errors.payment_sender = 'Valid 11-digit BD sender number required / সঠিক ১১ ডিজিটের নাম্বার দিন';
      }
    }

    if (!draft.payment_trx_id.trim()) {
      errors.payment_trx_id = 'Transaction ID is required / TrxID লিখুন';
    }

    try {
      parseClaimedAmount(draft.claimed_advance_bdt);
    } catch {
      errors.claimed_advance_bdt = 'Valid payment amount is required / সঠিক টাকার পরিমাণ দিন';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const amountMinor = parseClaimedAmount(draft.claimed_advance_bdt);
    const submission: BuyerSubmissionInput = {
      buyer_name: draft.buyer_name.trim(),
      contact_number: draft.contact_number.trim(),
      address: {
        raw_text: draft.address_raw.trim(),
      },
      payment_claim: {
        provider: draft.payment_provider,
        trx_id: draft.payment_trx_id.trim(),
        sender_number: draft.payment_sender.trim(),
        amount_minor: amountMinor,
        ...(draft.evidence_id ? { evidence_id: draft.evidence_id } : {}),
      },
    };

    await onSubmit(submission);
  };

  const updateField = (field: keyof BuyerFormDraft, value: string) => {
    onDraftChange({ ...draft, [field]: value });
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ border: '1px solid var(--border-subtle)' }} noValidate>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}>
          Delivery & Payment Confirmation / ডেলিভারি ও পেমেন্ট তথ্য
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
          Please fill in your details accurately to confirm this order.
        </p>
      </div>

      {submissionError && (
        <div
          role="alert"
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
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
      {/* Buyer Name */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="buyer_name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
          <User size={15} color="#818cf8" />
          <span>Your Full Name / আপনার নাম <span style={{ color: '#ef4444' }}>*</span></span>
        </label>
        <input
          id="buyer_name"
          name="buyer_name"
          type="text"
          value={draft.buyer_name}
          onChange={(e) => updateField('buyer_name', e.target.value)}
          placeholder="e.g. Rahim Uddin"
          maxLength={200}
          aria-describedby={fieldErrors.buyer_name ? "buyer_name-error" : undefined}
          aria-invalid={!!fieldErrors.buyer_name}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        {fieldErrors.buyer_name && (
          <div id="buyer_name-error" role="alert" style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.buyer_name}</div>
        )}
      </div>

      {/* Contact Number */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="contact_number" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
          <Phone size={15} color="#818cf8" />
          <span>Your Contact Number / যোগাযোগের ফোন নাম্বার <span style={{ color: '#ef4444' }}>*</span></span>
        </label>
        <input
          id="contact_number"
          name="contact_number"
          type="tel"
          value={draft.contact_number}
          onChange={(e) => updateField('contact_number', e.target.value)}
          placeholder="017XXXXXXXX or ০১৭XXXXXXXX"
          maxLength={32}
          aria-describedby={fieldErrors.contact_number ? "contact_number-error" : undefined}
          aria-invalid={!!fieldErrors.contact_number}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
          For courier call & delivery updates (কুরিয়ার কলের জন্য)
        </div>
        {fieldErrors.contact_number && (
          <div id="contact_number-error" role="alert" style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.contact_number}</div>
        )}
      </div>

      {/* Delivery Address */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="address_raw" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
          <MapPin size={15} color="#818cf8" />
          <span>Full Delivery Address / সম্পূর্ণ ডেলিভারি ঠিকানা <span style={{ color: '#ef4444' }}>*</span></span>
        </label>
        <textarea
          id="address_raw"
          name="address_raw"
          rows={3}
          value={draft.address_raw}
          onChange={(e) => updateField('address_raw', e.target.value)}
          placeholder="House/Holding, Road, Area/Thana, District (e.g. বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা)"
          maxLength={2000}
          aria-describedby={fieldErrors.address_raw ? "address_raw-error" : undefined}
          aria-invalid={!!fieldErrors.address_raw}
          className="form-control"
          style={{ marginTop: '6px', width: '100%', resize: 'vertical' }}
        />
        {fieldErrors.address_raw && (
          <div id="address_raw-error" role="alert" style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.address_raw}</div>
        )}
      </div>

      {portalToken && <AddressAssistance portalToken={portalToken} address={draft.address_raw}
        onUse={value => updateField('address_raw', value)} disabled={isSubmitting || isLocked} />}

      {portalToken && (
        <EvidenceUploadField
          portalToken={portalToken}
          evidenceId={draft.evidence_id}
          fileName={draft.evidence_file_name}
          onUploaded={(id, name) => onDraftChange({ ...draft, evidence_id: id, evidence_file_name: name })}
          onRemoved={() => onDraftChange({ ...draft, evidence_id: undefined, evidence_file_name: undefined })}
          disabled={isSubmitting || isLocked}
        />
      )}

      {portalToken && draft.evidence_id && <PaymentAssistance portalToken={portalToken} draft={draft}
        onUse={patch => onDraftChange({ ...draft, ...patch })} disabled={isSubmitting || isLocked} />}

      <PaymentClaimFields
        order={order}
        draft={draft}
        fieldErrors={fieldErrors}
        onUpdateField={updateField}
      />

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
        <Send size={18} />
        <span>{isSubmitting ? 'Submitting / জমা হচ্ছে...' : isLocked ? 'Retry Same Submission / একই তথ্য দিয়ে আবার চেষ্টা করুন' : 'Submit Order Details / তথ্য জমা দিন'}</span>
      </button>
    </form>
  );
}
