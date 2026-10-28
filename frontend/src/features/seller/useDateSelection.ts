import { useCallback, useState } from 'react';
import {
  lastDaysRange,
  parseDayCount,
  validateCustomRange,
  validateDayCount,
  type OrderDateError,
  type OrderDateMode,
  type OrderDateRange,
} from './orderDateFilter';
/** Shared date drafts and validation; callers own the applied query and paging. */
export function useDateSelection(onApply: (range: OrderDateRange | null) => void) {
  const [dateMode, setDateMode] = useState<OrderDateMode>('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastDays, setLastDays] = useState('');
  const [appliedDateRange, setAppliedDateRange] = useState<OrderDateRange | null>(null);
  const [dateError, setDateError] = useState<OrderDateError | null>(null);
  const clearActiveDateRange = useCallback(() => {
    onApply(null);
    setAppliedDateRange(null);
  }, [onApply]);

  const changeDateMode = useCallback((mode: OrderDateMode) => {
    setDateMode(mode);
    setDateError(null);
    if (mode === 'any' && appliedDateRange !== null) {
      clearActiveDateRange();
    } else if (appliedDateRange !== null) {
      // A pending custom/relative selection must not stay active in another mode.
      clearActiveDateRange();
    }
  }, [appliedDateRange, clearActiveDateRange]);

  const changeDateFrom = useCallback((value: string) => {
    setDateFrom(value);
    setDateError(null);
  }, []);
  const changeDateTo = useCallback((value: string) => {
    setDateTo(value);
    setDateError(null);
  }, []);
  const changeLastDays = useCallback((value: string) => {
    setLastDays(value);
    setDateError(null);
  }, []);

  const applyRange = useCallback((range: OrderDateRange, mode: OrderDateMode) => {
    onApply(range);
    setAppliedDateRange(range);
    setDateMode(mode);
    setDateError(null);
  }, [onApply]);

  const applyCustomDates = useCallback(() => {
    const error = validateCustomRange(dateFrom, dateTo);
    if (error) {
      setDateError(error);
      return;
    }
    applyRange({ from: dateFrom.trim(), to: dateTo.trim() }, 'custom');
  }, [applyRange, dateFrom, dateTo]);

  const applyRelativePreset = useCallback((days: number) => {
    setLastDays(String(days));
    applyRange(lastDaysRange(days), 'relative');
  }, [applyRange]);

  const applyLastDays = useCallback(() => {
    const error = validateDayCount(lastDays);
    if (error) {
      setDateError(error);
      return;
    }
    const days = parseDayCount(lastDays);
    if (days === null) return;
    applyRange(lastDaysRange(days), 'relative');
  }, [applyRange, lastDays]);

  return {
    dateMode,
    dateFrom,
    dateTo,
    lastDays,
    appliedDateRange,
    dateError,
    changeDateMode,
    changeDateFrom,
    changeDateTo,
    changeLastDays,
    applyCustomDates,
    applyRelativePreset,
    applyLastDays,
  };
}
