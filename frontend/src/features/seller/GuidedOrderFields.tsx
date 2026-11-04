import { guidedOrderCopy } from '../locale/guidedOrderCopy';
import { orderCreationCopy } from '../locale/orderCreationCopy';
import { emptyOrderFields } from './guidedOrder';
import { formatOrderAmount } from './orderNumbers';
import type { AssistantConversation } from './useAssistantConversation';
import { useLayoutEffect, useRef } from 'react';
import { AssistantAccountSelect } from './AssistantAccountSelect';

export function GuidedOrderFields({ conversation: c }: { conversation: AssistantConversation }): React.JSX.Element {
  const text = guidedOrderCopy[c.locale];
  const fields = c.draft?.order ?? emptyOrderFields();
  const summary = c.orderSummary;
  const disabled = c.submission.frozen || Boolean(c.pending);
  const account = c.accounts.find(item => item.id === summary.payload?.payment_account_id);
  const product = useRef<HTMLInputElement>(null);
  const review = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (c.orderReviewing) review.current?.focus();
    else product.current?.focus();
  }, [c.orderReviewing]);
  return <div className="assistant-order-fields" aria-busy={c.submission.state === 'processing'}>
    {summary.errors.length > 0 && <div role="status"><p>{text.missing}</p>
      <ul>{summary.errors.map(key => <li key={key}>{text[key]}</li>)}</ul>
    </div>}
    {!c.orderReviewing && <><p>{text.help}</p>
    <label>{text.value}<input ref={product} name="assistant-draft" maxLength={200} value={c.draft?.value ?? ''}
      aria-invalid={summary.errors.includes('value')} disabled={disabled} onChange={event => c.edit(event.target.value)} /></label>
    {(['total', 'advance', 'weight', 'quantity'] as const).map(key => <label key={key}>{text[key]}
      <input name={`assistant-${key}`} inputMode={key === 'quantity' ? 'numeric' : 'decimal'} value={fields[key]}
        maxLength={80} aria-invalid={summary.errors.includes(key)} disabled={disabled}
        onChange={event => c.updateOrder({ [key]: event.target.value })} />
    </label>)}
    <AssistantAccountSelect accounts={c.accounts} label={text.account} placeholder={text.choose}
      name="assistant-account" value={fields.account} disabled={disabled} invalid={summary.errors.includes('account')}
      onChange={account => c.updateOrder({ account })} />
    <button type="button" className="btn btn-secondary btn-sm" disabled={c.accountStatus === 'refreshing' || disabled}
      onClick={() => { void c.refreshAccounts(); }}>{c.accountStatus === 'refreshing' ? text.refreshing : text.refresh}</button>
    {c.accountStatus === 'refreshFailed' && <p role="alert">{text.refreshFailed}</p>}
    </>}
    {summary.payload && <section ref={review} tabIndex={-1} aria-label={text.summary}>
      <h5>{text.summary}</h5>
      <p>{summary.payload.product_name}</p>
      <p>{text.total}: <span className="assistant-numeric">BDT {formatOrderAmount(summary.payload.total_minor)}</span></p>
      <p>{text.advance}: <span className="assistant-numeric">BDT {formatOrderAmount(summary.payload.required_advance_minor)}</span></p>
      <p>{text.remainingCod}: <span className="assistant-numeric">BDT {formatOrderAmount(summary.payload.total_minor - summary.payload.required_advance_minor)}</span></p>
      <p>{text.account}: {account?.label} · {account?.provider} · <span className="assistant-numeric">{account?.receiving_number}</span></p>
    </section>}
    <div className="assistant-actions">
      {c.orderReviewing && <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => {
        if (summary.payload) void c.submission.submit(summary.payload);
      }}>{text.confirm}</button>}
    {c.orderReviewing && <button type="button" className="btn btn-secondary" disabled={disabled} onClick={c.changeOrder}>{text.changes}</button>}
    {!c.orderReviewing && <button type="button" className="btn btn-primary" disabled={disabled || !summary.payload}
      onClick={c.reviewOrder}>{text.review}</button>}
    </div>
    {c.submission.state !== 'idle' && <p role="status">{text[c.submission.state]}</p>}
    {c.submission.state === 'failed' && c.submission.failureMessage !== 'failed' &&
      <p role="alert">{orderCreationCopy[c.locale][c.submission.failureMessage]}</p>}
    {(c.submission.state === 'unknown' || c.submission.state === 'conflict') && <button type="button"
      className="btn btn-secondary" onClick={() => { void c.submission.check(); }}>{text.check}</button>}
    {c.submission.state === 'retry' && <button type="button" className="btn btn-primary"
      onClick={() => { void c.submission.retry(); }}>{text.retryButton}</button>}
  </div>;
}
