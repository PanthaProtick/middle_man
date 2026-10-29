import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import type { SellerOrder } from './types';
import { useLocale } from '../locale/context';
import { orderCopy, lifecycleLabel } from '../locale/orderCopy';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderExport } from './OrderExport';
import { OrderDateControls } from './OrderDateControls';
import { OrderCard } from './OrderCard';
import type { OrderDateError, OrderDateMode, OrderDateRange } from './orderDateFilter';

interface OrderListProps {
  token?: string;
  onCorrected?: (order: SellerOrder) => void;
  orders: SellerOrder[];
  statusFilter: string;
  onFilterChange: (status: string) => void;
  nextCursor: string | null;
  onLoadMore: () => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  loading?: boolean;
  dateMode?: OrderDateMode;
  dateFrom?: string;
  dateTo?: string;
  lastDays?: string;
  appliedDateRange?: OrderDateRange | null;
  dateError?: OrderDateError | null;
  onDateModeChange?: (mode: OrderDateMode) => void;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onLastDaysChange?: (value: string) => void;
  onApplyDates?: () => void;
  onApplyPreset?: (days: number) => void;
  onApplyLastDays?: () => void;
}

export function OrderList({
  token, onCorrected,
  orders,
  statusFilter,
  onFilterChange,
  nextCursor,
  onLoadMore,
  search = '',
  onSearchChange = () => undefined,
  loading = false,
  dateMode = 'any',
  dateFrom = '',
  dateTo = '',
  lastDays = '',
  appliedDateRange = null,
  dateError = null,
  onDateModeChange = () => undefined,
  onDateFromChange = () => undefined,
  onDateToChange = () => undefined,
  onLastDaysChange = () => undefined,
  onApplyDates = () => undefined,
  onApplyPreset = () => undefined,
  onApplyLastDays = () => undefined,
}: OrderListProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});

  const toggleReviewCodes = (id: string) => {
    setExpandedReviewIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const confirmedCount = orders.filter((o) => o.lifecycle === 'confirmed').length;
  const exceptionCount = orders.filter((o) => o.lifecycle === 'pending' && o.review_reasons?.length > 0).length;

  return (
    <div className="isolated-section" style={{ marginTop: '20px' }}>
      <div className="isolated-section-header">
        <div>
          <h4 className="isolated-section-title">
            <ShoppingBag size={18} /> {text.list} ({orders.length})
          </h4>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--emerald-accent)' }}>✓ {text.confirmed}: {confirmedCount}</span>
            {exceptionCount > 0 && <span style={{ color: 'var(--rose-accent)' }}>⚠ {text.exceptions} {exceptionCount}</span>}
          </div>
        </div>

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
              style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '36px', minWidth: '220px' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSearchChange(search)}
              style={{ minHeight: '36px' }}
            >
              {text.searchAction}
            </button>
            {search && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label={text.clearSearch}
                onClick={() => onSearchChange('')}
                style={{ minHeight: '36px' }}
              >
                {text.clearSearch}
              </button>
            )}
          </form>
          <label htmlFor="order-status-filter" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{text.status}</label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="form-control"
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              minHeight: '36px',
              width: 'auto',
            }}
          >
            <option value="">{text.all}</option>
            <option value="awaiting_buyer">{lifecycleLabel("awaiting_buyer", text)}</option>
            <option value="pending">{lifecycleLabel("pending", text)}</option>
            <option value="confirmed">{lifecycleLabel("confirmed", text)}</option>
            <option value="rejected">{lifecycleLabel("rejected", text)}</option>
            <option value="expired">{lifecycleLabel("expired", text)}</option>
            <option value="cancelled">{lifecycleLabel("cancelled", text)}</option>
          </select>
        </div>
      </div>

      <OrderDateControls
        mode={dateMode}
        from={dateFrom}
        to={dateTo}
        lastDays={lastDays}
        appliedRange={appliedDateRange}
        error={dateError}
        onModeChange={onDateModeChange}
        onFromChange={onDateFromChange}
        onToChange={onDateToChange}
        onLastDaysChange={onLastDaysChange}
        onApplyDates={onApplyDates}
        onApplyPreset={onApplyPreset}
        onApplyLastDays={onApplyLastDays}
      />
      <OrderExport
        key={`${statusFilter}|${appliedDateRange?.from ?? ''}|${appliedDateRange?.to ?? ''}`}
        status={statusFilter}
        search={search}
        fromDate={appliedDateRange?.from}
        toDate={appliedDateRange?.to}
        token={token}
      />
      <div className="ledger-scroll-viewport" data-testid="order-scroll-viewport">
        {loading ? (
          <div className="ledger-scroll-empty-state" style={{ borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <p role="status" style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
              {text.loading}
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="ledger-scroll-empty-state" style={{ borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
              {search.trim() ? text.noMatches : appliedDateRange ? text.noDateMatches : text.empty}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map((ord) => (
              <OrderCard
                key={ord.id}
                order={ord}
                text={text}
                locale={locale}
                expanded={Boolean(expandedReviewIds[ord.id])}
                onInspect={setSelectedOrder}
                onToggleReview={toggleReviewCodes}
              />
            ))}

            {nextCursor && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button className="btn btn-secondary btn-sm" onClick={onLoadMore}>
                  {text.more}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          token={token}
          onCorrected={fresh => {setSelectedOrder(fresh); onCorrected?.(fresh);}}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
