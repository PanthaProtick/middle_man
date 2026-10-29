import type { BuyerFormDraft } from './types';
import { User, Phone } from 'lucide-react';
import { useLocale } from '../locale';

interface BuyerContactFieldsProps {
  draft: BuyerFormDraft;
  fieldErrors: Record<string, string>;
  onUpdateField: (field: keyof BuyerFormDraft, value: string) => void;
}

export function BuyerContactFields({ draft, fieldErrors, onUpdateField }: BuyerContactFieldsProps) {
  const { t } = useLocale();
  return (
    <div className="buyer-form-section">
      <div className="buyer-form-section-header">
        <div className="buyer-form-section-badge">1</div>
        <div>
          <h4 className="buyer-form-section-title">{t('buyer.form.recipient')}</h4>
          <p className="buyer-form-section-subtitle">{t('buyer.form.recipientHelp')}</p>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="buyer_name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          <User size={15} color="var(--primary-accent)" />
          <span>{t('buyer.form.name')} <span style={{ color: 'var(--rose-accent)' }}>*</span></span>
        </label>
        <input
          id="buyer_name"
          name="buyer_name"
          type="text"
          value={draft.buyer_name}
          onChange={(e) => onUpdateField('buyer_name', e.target.value)}
          placeholder={t('buyer.form.namePlaceholder')}
          maxLength={200}
          aria-describedby={fieldErrors.buyer_name ? "buyer_name-error" : undefined}
          aria-invalid={!!fieldErrors.buyer_name}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        {fieldErrors.buyer_name && (
          <div id="buyer_name-error" role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.buyer_name}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="contact_number" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          <Phone size={15} color="var(--primary-accent)" />
          <span>{t('buyer.form.contact')} <span style={{ color: 'var(--rose-accent)' }}>*</span></span>
        </label>
        <input
          id="contact_number"
          name="contact_number"
          type="tel"
          value={draft.contact_number}
          onChange={(e) => onUpdateField('contact_number', e.target.value)}
          placeholder={t('buyer.form.contactPlaceholder')}
          maxLength={32}
          aria-describedby={`contact_number-help${fieldErrors.contact_number ? ' contact_number-error' : ''}`}
          aria-invalid={!!fieldErrors.contact_number}
          className="form-control"
          style={{ marginTop: '6px', width: '100%' }}
        />
        <div id="contact_number-help" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {t('buyer.form.contactHelp')}
        </div>
        {fieldErrors.contact_number && (
          <div id="contact_number-error" role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.contact_number}</div>
        )}
      </div>
    </div>
  );
}
