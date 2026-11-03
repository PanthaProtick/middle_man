import { LocaleSwitch } from '../locale/LocaleSwitch';
import { useLocale } from '../locale/context';
import { receiptText } from '../locale/receiptCopy';
import React from 'react';
import { X, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import type { PaymentAccount, ReceiptView } from './types';
import { useManualTransaction } from './useManualTransaction';
import './ManualTransactionModal.css';

interface ManualTransactionModalProps {
  accounts: PaymentAccount[];
  token?: string;
  initialAccountId?: string;
  onClose: () => void;
  onTransactionRecorded: (tx: ReceiptView) => void;
  onError?: (msg: string) => void;
}

export function ManualTransactionModal({
  accounts,
  token,
  initialAccountId,
  onClose,
  onTransactionRecorded,
}: ManualTransactionModalProps): React.JSX.Element {
  const { locale } = useLocale();
  const tr = (value: string) => receiptText(locale, value);
  const {
    activeAccounts, selectedAccountId, setSelectedAccountId,
    trxId, setTrxId, amountBdt, setAmountBdt,
    senderNumber, setSenderNumber, occurredAt, setOccurredAt,
    submitting, localError, fieldErrors, handleSubmit,
  } = useManualTransaction({ accounts, token, initialAccountId, onClose, onTransactionRecorded });

  return (
    <div className="manual-payment-overlay">
      <div
        role="dialog" aria-modal="true" aria-label={tr("Record Received Payment")} lang={locale}
        className="manual-payment-dialog"
      >
        <header className="manual-payment-header">
          <h3 className="manual-payment-title">
            <Smartphone size={20} aria-hidden="true" /> {tr("Record Received Payment")}
          </h3>
          <div className="manual-payment-header-actions">
            <LocaleSwitch />
            <button type="button" className="manual-payment-close" onClick={onClose} aria-label={tr("Close")}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="manual-payment-body">
          <p className="manual-payment-intro">{tr("This records a seller observation. It is not provider verification.")}</p>
          <p className="manual-payment-requirements">{tr("TrxID, amount, and receiving account are required. Sender and payment time may stay unknown.")}</p>

          {localError && (
            <div role="alert" className="manual-payment-alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{tr(localError)}</span>
            </div>
          )}

          <form className="manual-payment-form" onSubmit={handleSubmit}>
            <div className="manual-payment-field">
              <label htmlFor="manual-accountId">{tr("Receiving Account *")}</label>
              <select
                id="manual-accountId" aria-invalid={Boolean(fieldErrors.accountId)} aria-describedby={fieldErrors.accountId ? 'manual-accountId-error' : undefined} value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={submitting || activeAccounts.length === 0}
              >
                {activeAccounts.length === 0 ? (
                  <option value="">{tr("No active receiving accounts available")}</option>
                ) : (
                  activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.provider.toUpperCase()} - {a.label} ({a.receiving_number})
                    </option>
                  ))
                )}
              </select>
              {fieldErrors.accountId && (
                <span className="manual-payment-field-error" id="manual-accountId-error">{tr(fieldErrors.accountId)}</span>
              )}
            </div>

            <div className="manual-payment-field">
              <label htmlFor="manual-trxId">{tr("Transaction ID (TrxID) *")}</label>
              <input
                type="text"
                placeholder={tr("e.g. 9K72LKQW1")}
                id="manual-trxId" aria-invalid={Boolean(fieldErrors.trxId)} aria-describedby={fieldErrors.trxId ? 'manual-trxId-error' : undefined} value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                disabled={submitting}
                className="manual-payment-trx"
              />
              {fieldErrors.trxId && (
                <span className="manual-payment-field-error" id="manual-trxId-error">{tr(fieldErrors.trxId)}</span>
              )}
            </div>

            <div className="manual-payment-field">
              <label htmlFor="manual-amount">{tr("Actual Received Amount (BDT) *")}</label>
              <input
                type="text" inputMode="decimal"
                step="any"
                min="0.01"
                placeholder={tr("e.g. 150")}
                id="manual-amount" aria-invalid={Boolean(fieldErrors.amount)} aria-describedby={fieldErrors.amount ? 'manual-amount-error' : undefined} value={amountBdt}
                onChange={(e) => setAmountBdt(e.target.value)}
                disabled={submitting}
                className="manual-payment-amount"
              />
              {fieldErrors.amount && (
                <span className="manual-payment-field-error" id="manual-amount-error">{tr(fieldErrors.amount)}</span>
              )}
            </div>

            <div className="manual-payment-field">
              <label htmlFor="manual-sender">
                {tr("Sender Number ")}<span className="manual-payment-optional">{tr("(Optional - incomplete if omitted)")}</span>
              </label>
              <input
                type="text"
                placeholder={tr("e.g. 01700000000")}
                id="manual-sender" value={senderNumber}
                aria-invalid={Boolean(fieldErrors.sender_number)} aria-describedby={fieldErrors.sender_number ? 'manual-sender-error' : undefined}
                onChange={(e) => setSenderNumber(e.target.value)}
                disabled={submitting}
                className="manual-payment-phone"
              />
              {fieldErrors.sender_number && (
                <span className="manual-payment-field-error" id="manual-sender-error">{tr(fieldErrors.sender_number)}</span>
              )}
            </div>

            <div className="manual-payment-field">
              <label htmlFor="manual-time">
                {tr("Payment Occurrence Time ")}<span className="manual-payment-optional">{tr("(Optional - incomplete if omitted)")}</span>
              </label>
              <input
                type="datetime-local"
                id="manual-time" value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="manual-payment-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={submitting}
              >
                {tr("Cancel")}
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={submitting || activeAccounts.length === 0}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="spin" aria-hidden="true" /> {tr("Recording...")}
                  </>
                ) : (
                  tr("Record Payment")
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
