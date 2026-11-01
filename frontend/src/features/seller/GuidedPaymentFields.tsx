import { guidedPaymentCopy } from '../locale/guidedPaymentCopy';
import { emptyPaymentFields } from './guidedPayment';
import { formatOrderAmount } from './orderNumbers';
import type { AssistantConversation } from './useAssistantConversation';

export function GuidedPaymentFields({ conversation: c }: { conversation: AssistantConversation }): React.JSX.Element {
  const text = guidedPaymentCopy[c.locale];
  const fields = c.draft?.payment ?? emptyPaymentFields();
  const summary = c.paymentSummary;
  const submission = c.paymentSubmission;
  const disabled = submission.frozen || Boolean(c.pending);
  return <div className="assistant-payment-fields">
    <p>{text.help}</p>
    {summary.errors.length > 0 && <div role="status"><p>{text.missing}</p>
      <ul>{summary.errors.map(key => <li key={key}>{text[key]}</li>)}</ul>
    </div>}
    {summary.errors.includes('account') && <p role="note">{text.accountHelp}</p>}
    <label>{text.account}<select name="assistant-payment-account" value={fields.account} disabled={disabled}
      aria-invalid={summary.errors.includes('account')} onChange={event => c.updatePayment({ account: event.target.value })}>
      <option value="">{text.choose}</option>
      {c.accounts.filter(account => account.is_active).map(account => <option key={account.id} value={account.id}>
        {account.label} · {account.provider} · {account.receiving_number}
      </option>)}
    </select></label>
    <button type="button" className="btn btn-secondary btn-sm" disabled={c.accountStatus === 'refreshing' || disabled}
      onClick={() => { void c.refreshAccounts(); }}>{c.accountStatus === 'refreshing' ? text.refreshing : text.refresh}</button>
    {c.accountStatus === 'refreshFailed' && <p role="alert">{text.refreshFailed}</p>}
    <label>{text.trxId}<input name="assistant-payment-trx" maxLength={128} value={fields.trxId}
      aria-invalid={summary.errors.includes('trxId')} disabled={disabled} autoComplete="off"
      onChange={event => c.updatePayment({ trxId: event.target.value })} /></label>
    <label>{text.amount}<input name="assistant-payment-amount" inputMode="decimal" maxLength={80}
      value={fields.amount} aria-invalid={summary.errors.includes('amount')} disabled={disabled}
      onChange={event => c.updatePayment({ amount: event.target.value })} /></label>
    <label>{text.sender}<input name="assistant-payment-sender" inputMode="tel" maxLength={32}
      value={fields.sender} aria-invalid={summary.errors.includes('sender')} disabled={disabled}
      autoComplete="off" onChange={event => c.updatePayment({ sender: event.target.value })} /></label>
    <label>{text.occurredAt}<input name="assistant-payment-time" type="datetime-local"
      value={fields.occurredAt} aria-invalid={summary.errors.includes('occurredAt')} disabled={disabled}
      onChange={event => c.updatePayment({ occurredAt: event.target.value })} /></label>
    {summary.payload && <section aria-label={text.summary}>
      <h5>{text.summary}</h5>
      <p>{text.account}: {c.accounts.find(account => account.id === summary.payload!.payment_account_id)?.label} · {summary.payload.provider.toUpperCase()}</p>
      <p>{text.trxId}: {summary.payload.trx_id}</p>
      <p>{text.amount}: BDT {formatOrderAmount(summary.payload.amount_minor)}</p>
      <p>{text.preview}</p>
      <p role="note">{text.previewWarning}</p>
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => {
        if (summary.payload) void submission.submit(summary.payload);
      }}>{text.record}</button>
    </section>}
    {submission.state !== 'idle' && <p role="status">{text[submission.state]}</p>}
    {submission.state === 'failed' && submission.failureMessage !== 'failed' &&
      <p role="alert">{text[submission.failureMessage]}</p>}
    {submission.state === 'unknown' && submission.failureMessage !== 'failed' &&
      <p role="alert">{text[submission.failureMessage]}</p>}
    {(submission.state === 'unknown' || submission.state === 'conflict') && <button type="button"
      className="btn btn-secondary" onClick={() => { void submission.check(); }}>{text.check}</button>}
    {submission.state === 'retry' && <button type="button" className="btn btn-primary"
      onClick={() => { void submission.retry(); }}>{text.retryButton}</button>}
  </div>;
}
