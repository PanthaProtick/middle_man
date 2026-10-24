import { requestJson } from './api';
import type { ManualReceiptInput, ReceiptView } from './types';

export interface ReceiptCorrectionInput extends ManualReceiptInput {
  expected_version: number;
  reason: string;
}

export interface ReceiptSnapshot extends ManualReceiptInput { has_conflict: boolean }

export interface ResolutionInput {
  expected_version: number;
  selected_observation_id: string;
  selected_order_id: string | null;
  reason: string;
}

export interface ReceiptComparison {
  receipt: ReceiptView;
  allocated_order_id: string | null;
  claims: {
    order_id: string; revision_id: string; lifecycle: string; buyer_name: string;
    sender_number: string; amount_minor: number; submitted_at: string;
    review_reasons: string[]; held_by_resolution: boolean;
  }[];
  history: {
    selected_observation_id: string; selected_order_id: string | null;
    rejected_revision_ids: string[]; reason: string; actor: string; created_at: string;
  }[];
  corrections: {
    before: ReceiptSnapshot; after: ReceiptSnapshot; observation_id: string;
    reason: string; actor: string; created_at: string;
  }[];
}

const path = (id: string) => `/api/seller/transactions/${encodeURIComponent(id)}`;
export const compareReceipt = (id: string, token: string) =>
  requestJson<ReceiptComparison>(path(id), {}, token);
export const resolveReceipt = (id: string, input: ResolutionInput, key: string, token: string) =>
  requestJson<ReceiptComparison>(path(id) + '/resolve', {method: 'POST', body: JSON.stringify(input)}, token, key);
export const correctReceipt = (id: string, input: ReceiptCorrectionInput, key: string, token: string) =>
  requestJson<ReceiptComparison>(path(id), {method: 'PATCH', body: JSON.stringify(input)}, token, key);
