import type { OrderCopy } from '../locale/orderCopy';
import { attentionCopy } from '../locale/attentionCopy';
import { deliveryPreparationCopy } from '../locale/deliveryPreparationCopy';
import type { OrderDateRange } from './orderDateFilter';
import type { WorkQuery } from './types';

export interface ResolveEmptyMessageOptions {
  workQuery?: WorkQuery | '';
  search?: string;
  appliedDateRange?: OrderDateRange | null;
  locale: 'en' | 'bn';
  text: OrderCopy;
}

export function resolveOrderEmptyMessage({
  workQuery,
  search,
  appliedDateRange,
  locale,
  text,
}: ResolveEmptyMessageOptions): string {
  if (workQuery === 'attention') {
    return attentionCopy[locale].dashboardEmpty;
  }
  if (workQuery === 'preparation') {
    return deliveryPreparationCopy[locale].dashboardEmpty;
  }
  if (search?.trim()) {
    return text.noMatches;
  }
  if (appliedDateRange) {
    return text.noDateMatches;
  }
  return text.empty;
}
