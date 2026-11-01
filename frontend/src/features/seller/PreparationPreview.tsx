import { useState } from 'react';
import type { Locale } from '../locale/storage';
import { deliveryPreparationCopy } from '../locale/deliveryPreparationCopy';
import { formatBangladeshDateTime, formatCount } from '../locale/format';
import type { PreparationState } from './usePreparationQuery';
import type { SellerOrder } from './types';

interface Props {
  locale: Locale;
  state: PreparationState;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenOrder: (order: SellerOrder) => void;
  onShowInDashboard: () => void;
}

export function PreparationPreview({
  locale, state, onRefresh, onLoadMore, onOpenOrder, onShowInDashboard,
}: Props): React.JSX.Element {
  const text = deliveryPreparationCopy[locale];
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const reasonLabel = (code: string): string => {
    if (code === 'AWAITING_COURIER_PREPARATION') return text.AWAITING_COURIER_PREPARATION;
    if (code === 'PRIOR_DAY_BACKLOG') return text.PRIOR_DAY_BACKLOG;
    return code;
  };

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

  return <div className="preparation-preview" lang={locale}>
    <p>{text.showing.replace('{shown}', formatCount(state.items.length)).replace('{total}', formatCount(state.total))}</p>
    {state.retrievedAt && <p><small>{text.retrieved.replace('{time}', formatBangladeshDateTime(state.retrievedAt, locale))}</small></p>}
    {state.items.length === 0
      ? <p role="status">{text.empty}</p>
      : <ul>
        {state.items.map(item => <li key={item.order.id} data-testid="preparation-order">
          <h5>{item.order.product_name}</h5>
          <p>{item.order.id}</p>
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
    <div className="preparation-actions">
      {state.nextCursor && <button type="button" className="btn btn-secondary btn-sm" onClick={onLoadMore}>{text.loadMore}</button>}
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>{text.refresh}</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onShowInDashboard}>{text.showInDashboard}</button>
    </div>
  </div>;
}
