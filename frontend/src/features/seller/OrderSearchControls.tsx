import React from 'react';
import type { OrderCopy } from '../locale/orderCopy';
import { lifecycleLabel } from '../locale/orderCopy';

export interface OrderSearchControlsProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onFilterChange: (val: string) => void;
  text: OrderCopy;
}

export function OrderSearchControls({
  search,
  onSearchChange,
  statusFilter,
  onFilterChange,
  text,
}: OrderSearchControlsProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <form
        role="search"
        aria-label={text.searchLabel}
        onSubmit={(event) => event.preventDefault()}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
      >
        <label htmlFor="order-search" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {text.searchLabel}
        </label>
        <input
          id="order-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={text.searchPlaceholder}
          autoComplete="off"
          className="form-control"
          style={{ padding: '6px 10px', fontSize: '0.85rem', minHeight: '44px', minWidth: '220px' }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onSearchChange(search)}
          style={{ minHeight: '44px', padding: '6px 14px' }}
        >
          {text.searchAction}
        </button>
        {search && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label={text.clearSearch}
            onClick={() => onSearchChange('')}
            style={{ minHeight: '44px', padding: '6px 12px' }}
          >
            {text.clearSearch}
          </button>
        )}
      </form>
      <label htmlFor="order-status-filter" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {text.status}
      </label>
      <select
        id="order-status-filter"
        value={statusFilter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="form-control"
        style={{ padding: '6px 10px', fontSize: '0.85rem', minHeight: '44px', width: 'auto' }}
      >
        <option value="">{text.all}</option>
        <option value="awaiting_buyer">{lifecycleLabel('awaiting_buyer', text)}</option>
        <option value="pending">{lifecycleLabel('pending', text)}</option>
        <option value="confirmed">{lifecycleLabel('confirmed', text)}</option>
        <option value="rejected">{lifecycleLabel('rejected', text)}</option>
        <option value="expired">{lifecycleLabel('expired', text)}</option>
        <option value="cancelled">{lifecycleLabel('cancelled', text)}</option>
      </select>
    </div>
  );
}
