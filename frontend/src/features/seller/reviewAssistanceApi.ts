import { sellerFetch } from './sessionRequest';

export type ReviewAction = 'CHECK_TRANSACTIONS' | 'CORRECT_BUYER_DETAILS';
export interface SuggestedAction {
  action_id: ReviewAction;
  label: string;
  target: string;
  description?: string | null;
}

export interface ReviewAssistanceResponse {
  order_id: string;
  order_version: number;
  buyer_revision: number | null;
  lifecycle: string;
  source: 'local' | 'generated';
  condition: string;
  context_token: string;
  reason_codes: string[];
  explanation: string;
  suggested_actions: SuggestedAction[];
  facts: Record<string, unknown>;
  locale: 'en' | 'bn';
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
