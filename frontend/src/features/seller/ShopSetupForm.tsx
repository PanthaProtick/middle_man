import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';

interface ShopSetupFormProps {
  error?: boolean;
  showRecovery: boolean;
  onRecover: () => void;
  shopName: string;
  setupSubmitting: boolean;
  onShopNameChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ShopSetupForm({
  error,
  showRecovery,
  onRecover,
  shopName,
  setupSubmitting,
  onShopNameChange,
  onSubmit,
}: ShopSetupFormProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '20px' }}>
      <label htmlFor="shop-display-name" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {text.name}
      </label>
      <div style={{ display: 'flex', gap: '10px', maxWidth: '520px', flexWrap: 'wrap' }}>
        <input
          type="text"
          id="shop-display-name"
          name="displayName"
          maxLength={200}
          aria-invalid={error || undefined}
          aria-describedby={error ? "workspace-error" : undefined}
          placeholder={text.example}
          value={shopName}
          onChange={(e) => onShopNameChange(e.target.value)}
          className="text-input"
          style={{ flex: 1, minWidth: '220px' }}
          disabled={setupSubmitting}
        />
        <button type="submit" className="btn btn-primary" disabled={setupSubmitting || showRecovery || !shopName.trim()}>
          {setupSubmitting ? text.creating : text.create}
        </button>
      </div>
      {showRecovery && <button type="button" className="btn btn-secondary" disabled={setupSubmitting} onClick={onRecover}>{text.checkSetup}</button>}
    </form>
  );
}
