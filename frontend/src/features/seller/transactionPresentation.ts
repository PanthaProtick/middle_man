import type { ReceiptView } from './types';

export type TransactionTone = 'emerald' | 'cyan' | 'amber' | 'rose' | 'neutral';

const KNOWN_STATES = [
  'unmatched',
  'used',
  'allocated',
  'conflicted',
  'incomplete',
  'matched',
  'conflicting',
  'identical',
  'consistent',
  'initial',
  'none',
] as const;

/** Translates only known reconciliation/parse codes; unknown codes keep review copy. */
export function stateLabel(copy: (value: string) => string, value: string): string {
  return (KNOWN_STATES as readonly string[]).includes(value) ? copy(value) : copy('Needs review');
}

export function isIncompleteReceipt(receipt: ReceiptView): boolean {
  return !receipt.sender_number_canonical || !receipt.occurred_at;
}

/**
 * Tone for the receipt-level chip. Conflicts always outrank completeness, and
 * allocation uses emerald without ever implying provider verification.
 */
export function receiptTone(receipt: ReceiptView): TransactionTone {
  const state: string = receipt.reconciliation_state;
  if (receipt.has_conflict) return 'rose';
  if (isIncompleteReceipt(receipt)) return 'amber';
  if (state === 'used' || state === 'allocated') return 'emerald';
  if (state === 'unmatched') return 'cyan';
  return 'neutral';
}

export function receiptStatusLabel(copy: (value: string) => string, receipt: ReceiptView): string {
  if (receipt.has_conflict) return copy('Conflicting Observations');
  if (isIncompleteReceipt(receipt)) return copy('Incomplete');
  return stateLabel(copy, receipt.reconciliation_state);
}

export function observationTone(conflictState: string): TransactionTone {
  if (conflictState === 'conflicting') return 'rose';
  if (conflictState === 'identical') return 'cyan';
  if (conflictState === 'none') return 'neutral';
  return 'emerald';
}
