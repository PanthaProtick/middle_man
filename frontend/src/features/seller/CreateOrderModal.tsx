import React from 'react';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { X, ShoppingBag, AlertCircle, ArrowRight } from 'lucide-react';
import { formatOrderAmount } from './orderNumbers';
import { ParcelEarlyFields } from './ParcelEarlyFields';
import { useOrderCreation, type CreateOrderModalProps } from './useOrderCreation';

export function CreateOrderModal(props: CreateOrderModalProps): React.JSX.Element {
  const { onClose } = props;
  const { text, formRef, activeAccounts, productName, setProductName, totalBdt, setTotalBdt,
    advanceBdt, setAdvanceBdt, parcel, selectedAccountId, setSelectedAccountId, submitting,
    validationError, validationField, productInputRef, expectedCod, handleSubmit, errorProps } = useOrderCreation(props);

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px',
      }}
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-order-dialog-title"
        style={{
          width: '100%', maxWidth: '520px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="var(--amber-accent)" />
            <h3 id="create-order-dialog-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{text.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={text.closeDialog}
            disabled={submitting}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        <LocaleSwitch />
        {validationError && <p id="create-order-error" role="alert">{text[validationError]}</p>}

        {activeAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <AlertCircle size={32} style={{ color: 'var(--amber-accent)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
              {text.noAccounts}
            </p>
            <button className="btn btn-secondary" onClick={onClose}>
              {text.close}
            </button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="create-order-product-name" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {text.product}
              </label>
              <input
                id="create-order-product-name"
                aria-label={text.product}
                type="text"
                ref={productInputRef}
                name="productName"
                {...errorProps("productName")}
                disabled={submitting}
                placeholder={text.productExample}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="form-grid-2">
              <div>
                <label htmlFor="create-order-total-bdt" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {text.total}
                </label>
                <input
                  id="create-order-total-bdt"
                  aria-label={text.total}
                  type="text"
                  inputMode="decimal"
                  name="totalBdt"
                {...errorProps("totalBdt")}
                disabled={submitting}
                  placeholder={text.totalExample}
                  min="1"
                  step="1"
                  value={totalBdt}
                  onChange={(e) => setTotalBdt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label htmlFor="create-order-advance-bdt" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {text.advance}
                </label>
                <input
                  id="create-order-advance-bdt"
                  aria-label={text.advance}
                  type="text"
                  inputMode="decimal"
                  name="advanceBdt"
                {...errorProps("advanceBdt")}
                disabled={submitting}
                  placeholder={text.advanceExample}
                  min="1"
                  step="1"
                  value={advanceBdt}
                  onChange={(e) => setAdvanceBdt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{text.cod}</span>
              <span style={{ fontWeight: 600, color: 'var(--primary-accent)', fontSize: '1rem' }}>
                BDT {formatOrderAmount(expectedCod)}
              </span>
            </div>

            <ParcelEarlyFields
              weightKg={parcel.weightKg}
              quantity={parcel.quantity}
              onWeightChange={parcel.onWeightChange}
              onQuantityChange={parcel.onQuantityChange}
              disabled={submitting}
              errors={parcel.errors}
              validationAttempt={parcel.validationAttempt}
              serverField={validationField}
              serverErrorId="create-order-error"
            />

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="create-order-payment-account-id" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {text.account}
              </label>
              <select
                id="create-order-payment-account-id"
                aria-label={text.account}
                name="paymentAccountId"
                {...errorProps("paymentAccountId")}
                disabled={submitting}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} — {acc.provider.toUpperCase()} ({acc.receiving_number})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {text.snapshot}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                {text.cancel}
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? text.creating : text.create} <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
