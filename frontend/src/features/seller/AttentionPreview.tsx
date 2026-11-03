import { useState } from 'react';
import type { Locale } from '../locale/storage';
import { attentionCopy } from '../locale/attentionCopy';
import { formatBangladeshDateTime, formatCount } from '../locale/format';
import type { AttentionState } from './useAttentionQuery';
import type { AttentionCategory, AttentionReason, SellerOrder } from './types';

interface Props {
  locale: Locale;
  state: AttentionState;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenOrder: (order: SellerOrder) => void;
  onShowInDashboard: () => void;
}

const categoryLabelKeys: Record<AttentionCategory, keyof typeof attentionCopy.en> = {
  unknown_outcome: 'categoryUnknownOutcome',
  failed_submission: 'categoryFailedSubmission',
  pending_review: 'categoryPendingReview',
  preparation: 'categoryPreparation',
  awaiting_buyer: 'categoryAwaitingBuyer',
};

export function AttentionPreview({
  locale, state, onRefresh, onLoadMore, onOpenOrder, onShowInDashboard,
}: Props): React.JSX.Element {
  const text = attentionCopy[locale];
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const reasonLabel = (code: AttentionReason): string => text[code];

  async function copyReference(order: SellerOrder) {
    try {
      await navigator.clipboard.writeText(order.id);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  if (state.status === 'loading') {
    return <p role="status">{text.loading}</p>;
  }
  if (state.status === 'error') {
    return <div>
      <p role="alert">{state.error === 'unauthorized' ? text.unauthorized : text.failed}</p>
      {state.error !== 'unauthorized' && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>{text.retry}</button>
      )}
    </div>;
  }
  if (state.status === 'idle') return <p role="status">{text.title}</p>;

  return <div className="attention-preview" lang={locale}>
    <p>{text.showing.replace('{shown}', formatCount(state.items.length)).replace('{total}', formatCount(state.total))}</p>
    {state.retrievedAt && <p><small>{text.retrieved.replace('{time}', formatBangladeshDateTime(state.retrievedAt, locale))}</small></p>}
    {state.items.length === 0
      ? <p role="status">{text.empty}</p>
      : <ul tabIndex={0} aria-label={text.title}>
        {state.items.map(item => <li key={item.order.id} data-testid="attention-order"
          data-category={item.category}>
          <h5>{text[categoryLabelKeys[item.category]]}</h5>
          <p>{item.order.product_name}</p>
          <p className="assistant-numeric">{item.order.id}</p>
          <ul>{item.reason_codes.map(code => <li key={code}>{reasonLabel(code)}</li>)}</ul>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenOrder(item.order)}>
            {text.openOrder}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyReference(item.order)}>
            {text.copyReference}
          </button>
        </li>)}
      </ul>}
    {copyStatus !== 'idle' && <p role={copyStatus === 'failed' ? 'alert' : 'status'}>
      {copyStatus === 'failed' ? text.copyFailed : text.copied}
    </p>}
    <div className="attention-actions">
      {state.nextCursor && <button type="button" className="btn btn-secondary btn-sm" onClick={onLoadMore}>{text.loadMore}</button>}
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>{text.refresh}</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onShowInDashboard}>{text.showInDashboard}</button>
    </div>
  </div>;
}
