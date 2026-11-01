import { useLocale } from '../locale/context';
import { attentionCopy } from '../locale/attentionCopy';
import { deliveryPreparationCopy } from '../locale/deliveryPreparationCopy';
import type { WorkQuery } from './types';

export function OrderWorkQueryBanner({ query, onClear }: {
  query: WorkQuery;
  onClear: () => void;
}): React.JSX.Element {
  const { locale } = useLocale();
  const text = query === 'attention' ? attentionCopy[locale] : deliveryPreparationCopy[locale];
  return <div role="status" className="order-work-query-banner" style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
    flexWrap: 'wrap', padding: '8px 12px', marginBottom: '10px',
    border: '1px solid var(--border-subtle)', borderRadius: '8px',
  }}>
    <p style={{ margin: 0, fontSize: '0.85rem' }}>{text.dashboardBanner}</p>
    <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
      {text.clearWorkFilter}
    </button>
  </div>;
}
