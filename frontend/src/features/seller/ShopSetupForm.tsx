import React from 'react';

interface ShopSetupFormProps {
  shopName: string;
  setupSubmitting: boolean;
  onShopNameChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ShopSetupForm({
  shopName,
  setupSubmitting,
  onShopNameChange,
  onSubmit,
}: ShopSetupFormProps): React.JSX.Element {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '20px' }}>
      <label htmlFor="shop-display-name" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        Shop Display Name
      </label>
      <div style={{ display: 'flex', gap: '10px', maxWidth: '520px', flexWrap: 'wrap' }}>
        <input
          type="text"
          id="shop-display-name"
          name="displayName"
          placeholder="e.g. Dhaka Gadget Hub"
          value={shopName}
          onChange={(e) => onShopNameChange(e.target.value)}
          className="text-input"
          style={{ flex: 1, minWidth: '220px' }}
          disabled={setupSubmitting}
        />
        <button type="submit" className="btn btn-primary" disabled={setupSubmitting || !shopName.trim()}>
          {setupSubmitting ? 'Creating...' : 'Set Up Shop'}
        </button>
      </div>
    </form>
  );
}
