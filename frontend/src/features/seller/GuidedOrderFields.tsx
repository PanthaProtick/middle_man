import { guidedOrderCopy } from '../locale/guidedOrderCopy';
import { orderCreationCopy } from '../locale/orderCreationCopy';
import { emptyOrderFields } from './guidedOrder';
import { formatOrderAmount } from './orderNumbers';
import type { AssistantConversation } from './useAssistantConversation';

export function GuidedOrderFields({ conversation: c }: { conversation: AssistantConversation }): React.JSX.Element {
  const text = guidedOrderCopy[c.locale];
  const fields = c.draft?.order ?? emptyOrderFields();
  const summary = c.orderSummary;
  const disabled = c.submission.frozen || Boolean(c.pending);
  return <div className="assistant-order-fields">
    <p>{text.help}</p>
    {summary.errors.length > 0 && <div role="status"><p>{text.missing}</p>
      <ul>{summary.errors.map(key => <li key={key}>{text[key]}</li>)}</ul>
    </div>}
    <label>{text.value}<input name="assistant-draft" maxLength={200} value={c.draft?.value ?? ''}
      aria-invalid={summary.errors.includes('value')} disabled={disabled} onChange={event => c.edit(event.target.value)} /></label>
    {(['total', 'advance', 'weight', 'quantity'] as const).map(key => <label key={key}>{text[key]}
      <input name={`assistant-${key}`} inputMode={key === 'quantity' ? 'numeric' : 'decimal'} value={fields[key]}
        maxLength={80} aria-invalid={summary.errors.includes(key)} disabled={disabled}
        onChange={event => c.updateOrder({ [key]: event.target.value })} />
    </label>)}
    <label>{text.account}<select name="assistant-account" value={fields.account} disabled={disabled}
      aria-invalid={summary.errors.includes('account')} onChange={event => c.updateOrder({ account: event.target.value })}>
      <option value="">{text.choose}</option>
      {c.accounts.filter(account => account.is_active).map(account => <option key={account.id} value={account.id}>
        {account.label} · {account.provider} · {account.receiving_number}
      </option>)}
    </select></label>
    <button type="button" className="btn btn-secondary btn-sm" disabled={c.accountStatus === 'refreshing' || disabled}
      onClick={() => { void c.refreshAccounts(); }}>{c.accountStatus === 'refreshing' ? text.refreshing : text.refresh}</button>
    {c.accountStatus === 'refreshFailed' && <p role="alert">{text.refreshFailed}</p>}
    {summary.payload && <section aria-label={text.summary}>
      <h5>{text.summary}</h5>
      <p>{summary.payload.product_name}</p>
      <p>{text.total}: <span className="assistant-numeric">BDT {formatOrderAmount(summary.payload.total_minor)}</span></p>
      <p>{text.advance}: <span className="assistant-numeric">BDT {formatOrderAmount(summary.payload.required_advance_minor)}</span></p>
      <p>{text.remainingCod}: <span className="assistant-numeric">BDT {formatOrderAmount(summary.payload.total_minor - summary.payload.required_advance_minor)}</span></p>
      <p>{text.account}: {c.accounts.find(account => account.id === summary.payload!.payment_account_id)?.label}</p>
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => {
        if (summary.payload) void c.submission.submit(summary.payload);
      }}>{text.create}</button>
    </section>}
    {c.submission.state !== 'idle' && <p role="status">{text[c.submission.state]}</p>}
    {c.submission.state === 'failed' && c.submission.failureMessage !== 'failed' &&
      <p role="alert">{orderCreationCopy[c.locale][c.submission.failureMessage]}</p>}
    {(c.submission.state === 'unknown' || c.submission.state === 'conflict') && <button type="button"
      className="btn btn-secondary" onClick={() => { void c.submission.check(); }}>{text.check}</button>}
    {c.submission.state === 'retry' && <button type="button" className="btn btn-primary"
      onClick={() => { void c.submission.retry(); }}>{text.retryButton}</button>}
  </div>;
}
