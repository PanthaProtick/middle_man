import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { Button } from '../../components/Button';

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
      <label
        htmlFor="shop-display-name"
        style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}
      >
        {text.name}
      </label>
      <div style={{ display: 'flex', gap: '10px', maxWidth: '560px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          type="text"
          id="shop-display-name"
          name="displayName"
          maxLength={200}
          aria-invalid={error || undefined}
          aria-describedby={error ? 'workspace-error' : undefined}
          placeholder={text.example}
          value={shopName}
          onChange={(e) => onShopNameChange(e.target.value)}
          className="text-input"
          style={{ flex: 1, minWidth: '220px' }}
          disabled={setupSubmitting}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={setupSubmitting || showRecovery || !shopName.trim()}
        >
          {setupSubmitting ? text.creating : text.create}
        </Button>
      </div>
      {showRecovery && (
        <div style={{ marginTop: '12px' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={setupSubmitting}
            onClick={onRecover}
          >
            {text.checkSetup}
          </Button>
        </div>
      )}
    </form>
  );
}
