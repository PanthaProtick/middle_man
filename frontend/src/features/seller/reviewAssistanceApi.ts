import { sellerFetch } from './sessionRequest';

export type ReviewAction = 'CHECK_TRANSACTIONS' | 'CORRECT_BUYER_DETAILS';
export type ReviewCondition =
  | 'NO_RECORDED_RECEIPT'
  | 'UNKNOWN_CAUSE'
  | 'UNSUPPORTED_REASON_CODE'
  | 'SENDER_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'TIME_UNCLEAR'
  | 'WRONG_RECEIVING_ACCOUNT'
  | 'CONFLICTING_RECEIPTS'
  | 'COMPETING_CLAIMS'
  | 'PAYMENT_USED'
  | 'MULTIPLE_REVIEW_REASONS';
export type AutomaticReviewReason =
  | 'SENDER_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'TIME_UNCLEAR'
  | 'WRONG_RECEIVING_ACCOUNT'
  | 'CONFLICTING_RECEIPTS'
  | 'COMPETING_CLAIMS'
  | 'PAYMENT_USED';
export type SenderStatus = 'missing' | 'different';
export type TimeStatus = 'missing' | 'before_order_creation' | 'after_claim_submission';
export type ConflictCategory = 'amount' | 'receiving_account' | 'sender' | 'time';

export interface ReviewFacts {
  has_matching_receipt: boolean;
  required_advance_minor?: number;
  claimed_amount_minor?: number;
  received_amount_minor?: number;
  currency?: 'BDT';
  sender_status?: SenderStatus;
  time_status?: TimeStatus;
  receiving_account_comparison?: 'different';
  conflict_categories?: ConflictCategory[];
  active_claim_count?: number;
  claim_held_by_prior_resolution?: boolean;
  payment_used?: boolean;
  payment_allocated?: boolean;
  provider_comparison?: 'same' | 'different';
  transaction_id_comparison?: 'same' | 'different';
  total_minor?: number;
}

export interface SuggestedAction {
  action_id: ReviewAction;
  label: string;
  target: string;
  description?: string | null;
}

export interface ReviewProviderContext {
  condition: ReviewCondition;
  reason_codes: AutomaticReviewReason[];
  unknown_reason_present: boolean;
  locale: 'en' | 'bn';
  facts: ReviewFacts;
  permitted_actions: ReviewAction[];
  selected_preview?: { conditions: string[]; blockers: string[] };
}

export interface ReviewAssistanceResponse {
  order_id: string;
  order_version: number;
  buyer_revision: number | null;
  lifecycle: string;
  source: 'local' | 'generated';
  condition: ReviewCondition;
  context_token: string;
  reason_codes: AutomaticReviewReason[];
  unknown_reason_present: boolean;
  explanation: string;
  suggested_actions: SuggestedAction[];
  facts: ReviewFacts;
  context: ReviewProviderContext;
  locale: 'en' | 'bn';
  selected_receipt_id?: string | null;
  selected_receipt_version?: number | null;
  preview_conditions?: string[];
  preview_blockers?: string[];
}

const REVIEW_ACTIONS: readonly ReviewAction[] = ['CHECK_TRANSACTIONS', 'CORRECT_BUYER_DETAILS'];

export function isReviewAction(value: string): value is ReviewAction {
  return (REVIEW_ACTIONS as readonly string[]).includes(value);
}

export async function fetchReviewAssistance(
  orderId: string,
  token: string | undefined,
  language: 'en' | 'bn',
  receiptId?: string
): Promise<ReviewAssistanceResponse> {
  const res = await sellerFetch(
    `/api/seller/orders/${encodeURIComponent(orderId)}/review-assistance`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        ...(receiptId ? { receipt_id: receiptId } : {}),
      }),
    },
    token
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data.error?.message || data.detail || 'Failed to fetch review assistance';
    throw new Error(message);
  }

  return res.json();
}
