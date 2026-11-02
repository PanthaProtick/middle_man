import React from 'react';
import type { WorkQuery } from './types';
import type { OrderCopy } from '../locale/orderCopy';
import './OrderWorkQueryNav.css';

interface OrderWorkQueryNavProps {
  workQuery: WorkQuery | '';
  onSelectWorkQuery: (query: WorkQuery | '') => void;
  text: OrderCopy;
}

export function OrderWorkQueryNav({
  workQuery,
  onSelectWorkQuery,
  text,
}: OrderWorkQueryNavProps): React.JSX.Element {
  return (
    <div className="order-work-query-nav" role="tablist" aria-label={text.workQueues}>
      <button
        type="button"
        role="tab"
        aria-selected={workQuery === 'attention'}
        className={`work-query-pill ${workQuery === 'attention' ? 'active' : ''}`}
        onClick={() => onSelectWorkQuery('attention')}
      >
        {text.needsAttention}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={workQuery === 'preparation'}
        className={`work-query-pill ${workQuery === 'preparation' ? 'active' : ''}`}
        onClick={() => onSelectWorkQuery('preparation')}
      >
        {text.readyForDelivery}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!workQuery}
        className={`work-query-pill ${!workQuery ? 'active' : ''}`}
        onClick={() => onSelectWorkQuery('')}
      >
        {text.allOrders}
      </button>
    </div>
  );
}
