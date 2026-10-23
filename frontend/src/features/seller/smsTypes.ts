import type { ManualReceiptInput } from './types';

export type SmsImportState = 'imported' | 'duplicate' | 'conflicting' | 'unsupported' | 'missing' | 'masked' | 'ambiguous' | 'provider_mismatch';
export interface SmsItemResult {
  index: number;
  state: SmsImportState;
  issues: string[];
  fields: ManualReceiptInput | null;
  receipt_id: string | null;
  order_ids: string[];
  evidence_id: string;
  collected_at: string;
  delete_after: string;
}
export interface ImportResult {
  id: string;
  payment_account_id: string;
  created_at: string;
  items: SmsItemResult[];
}
export interface ImportList {
  items: ImportResult[];
  next_cursor: string | null;
}
