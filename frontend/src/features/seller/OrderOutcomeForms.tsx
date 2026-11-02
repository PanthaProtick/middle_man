import type { FormEvent } from 'react';
import type { CourierAttemptStatus } from './courierReviewTypes';
import type { PaymentAccount, SellerOrder } from './types';
import type { correctionOutcomeCopy } from '../locale/correctionOutcomeCopy';
import { shopDeskInputStyle as inputStyle } from './orderFormStyles';

type Action = 'none' | 'cancel' | 'reject' | 'replace';
type Copy = typeof correctionOutcomeCopy.en | typeof correctionOutcomeCopy.bn;
type ErrorKey = keyof Copy | 'unknown' | null;

interface Props {
  activeAction: Action; order: SellerOrder; isAllocated: boolean; courierAttemptStatus?: CourierAttemptStatus | null;
  reason: string; setReason: (value: string) => void;
  productName: string; setProductName: (value: string) => void;
  totalBdt: string; setTotalBdt: (value: string) => void;
  advanceBdt: string; setAdvanceBdt: (value: string) => void;
  accounts: PaymentAccount[]; selectedAccountId: string; setSelectedAccountId: (value: string) => void;
  isSubmitting: boolean; pending: boolean; error: ErrorKey; text: Copy;
  setError: (value: ErrorKey) => void; setActiveAction: (value: Action) => void;
  handleCancel: (event: FormEvent) => void; handleReject: (event: FormEvent) => void; handleReplace: (event: FormEvent) => void;
}

export function OrderOutcomeForms({activeAction, order, isAllocated, courierAttemptStatus, reason, setReason,
  productName, setProductName, totalBdt, setTotalBdt, advanceBdt, setAdvanceBdt, accounts,
  selectedAccountId, setSelectedAccountId, isSubmitting, pending, error, text, setError, setActiveAction,
  handleCancel, handleReject, handleReplace}: Props) {
  return <>
      {activeAction === 'cancel' && (
        <form onSubmit={handleCancel} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--rose-accent)', fontWeight: 600 }}>{text.cancelTitle} #{order.id}</div>
          {isAllocated && (
            <div style={{ fontSize: '0.75rem', color: 'var(--amber-accent)', background: 'rgba(245, 158, 11, 0.1)', padding: '8px 10px', borderRadius: '6px' }}>
              {text.allocationWarning}
            </div>
          )}
          {['submitting', 'unknown', 'success'].includes(courierAttemptStatus ?? '') && (
            <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--rose-accent)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 10px', borderRadius: '6px' }}>
              {text.courierWarning}
            </div>
          )}
          {isAllocated && courierAttemptStatus == null && <p role="alert">
            {text.courierUnavailable}
          </p>}
          {courierAttemptStatus === 'unsubmitted' && (
            <div role="note" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: '6px' }}>
              {text.draftWarning}
            </div>
          )}
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {text.cancelReason}
            <textarea
              required
              disabled={!!pending}
              aria-invalid={error === 'needCancelReason'}
              aria-describedby={error === 'needCancelReason' ? 'order-outcome-error' : undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              style={{ ...inputStyle, minHeight: '76px', resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" style={{ minHeight: '44px', padding: '8px 16px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting || !!pending}>{text.dismiss}</button>
            <button type="submit" className="btn btn-primary" style={{ minHeight: '44px', padding: '8px 16px', background: '#dc2626' }} disabled={isSubmitting}>{isSubmitting ? text.cancelling : pending ? text.retry : text.confirmCancel}</button>
          </div>
        </form>
      )}

      {activeAction === 'reject' && (
        <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--amber-accent)', fontWeight: 600 }}>{text.rejectTitle} #{order.id}</div>
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {text.rejectReason}
            <textarea
              required
              disabled={!!pending}
              aria-invalid={error === 'needRejectReason'}
              aria-describedby={error === 'needRejectReason' ? 'order-outcome-error' : undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              style={{ ...inputStyle, minHeight: '76px', resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" style={{ minHeight: '44px', padding: '8px 16px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting || !!pending}>{text.dismiss}</button>
            <button type="submit" className="btn btn-primary" style={{ minHeight: '44px', padding: '8px 16px', background: '#ea580c' }} disabled={isSubmitting}>{isSubmitting ? text.rejecting : pending ? text.retry : text.confirmReject}</button>
          </div>
        </form>
      )}

      {activeAction === 'replace' && (
        <form onSubmit={handleReplace} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--primary-accent)', fontWeight: 600 }}>{text.replaceTitle} #{order.id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {text.predecessor}
          </div>
          {['submitting', 'unknown', 'success'].includes(courierAttemptStatus ?? '') && (
            <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--rose-accent)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 10px', borderRadius: '6px' }}>
              {text.courierWarning}
            </div>
          )}
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {text.product}
            <input type="text" disabled={!!pending} value={productName} onChange={(e) => setProductName(e.target.value)} style={inputStyle} />
          </label>
          <div className="order-outcomes-amounts" style={{ display: 'grid', gap: '8px' }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {text.total}
              <input type="text" inputMode="decimal" disabled={!!pending} aria-invalid={error === 'invalidTotal'} aria-describedby={error === 'invalidTotal' ? 'order-outcome-error' : undefined} value={totalBdt} onChange={(e) => setTotalBdt(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
            </label>
            <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {text.requiredAdvance}
              <input type="text" inputMode="decimal" disabled={!!pending} aria-invalid={error === 'invalidAdvance'} aria-describedby={error === 'invalidAdvance' ? 'order-outcome-error' : undefined} value={advanceBdt} onChange={(e) => setAdvanceBdt(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
            </label>
          </div>
          {accounts.length > 0 && (
            <select aria-label={text.account} disabled={!!pending} aria-invalid={error === 'needAccount'} aria-describedby={error === 'needAccount' ? 'order-outcome-error' : undefined} value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={inputStyle}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label} ({a.provider.toUpperCase()} - {a.receiving_number})</option>
              ))}
            </select>
          )}
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {text.replaceReason}
            <textarea
              required
              disabled={!!pending}
              aria-invalid={error === 'needReplaceReason'}
              aria-describedby={error === 'needReplaceReason' ? 'order-outcome-error' : undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              style={{ ...inputStyle, minHeight: '76px', resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" style={{ minHeight: '44px', padding: '8px 16px' }} onClick={() => { setActiveAction('none'); setError(null); }} disabled={isSubmitting || !!pending}>{text.dismiss}</button>
            <button type="submit" className="btn btn-primary" style={{ minHeight: '44px', padding: '8px 16px' }} disabled={isSubmitting}>{isSubmitting ? text.creating : pending ? text.retry : text.createReplacement}</button>
          </div>
        </form>
      )}
  </>;
}
