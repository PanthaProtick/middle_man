import type { BuyerFormDraft } from './types';

export interface PaymentSuggestions {
  is_payment_screenshot: boolean | null;
  provider: 'bkash' | 'nagad' | null;
  trx_id: string | null;
  amount_minor: number | null;
  sender_number: string | null;
  receiver_number: string | null;
  occurred_at: string | null;
  unreadable_fields: string[];
}
const fields = ['is_payment_screenshot', 'provider', 'trx_id', 'amount_minor', 'sender_number', 'receiver_number', 'occurred_at'];
export function parsePaymentSuggestions(value: unknown, evidenceId: string): PaymentSuggestions {
  if (!value || typeof value !== 'object') throw new Error('Invalid response');
  const body = value as Record<string, unknown>;
  if (body.available !== true || body.review_required !== true || body.evidence_id !== evidenceId || !body.suggestions || typeof body.suggestions !== 'object') throw new Error('Unavailable');
  const result = body.suggestions as Record<string, unknown>;
  if (Object.keys(result).some(key => ![...fields, 'unreadable_fields'].includes(key))) throw new Error('Unexpected field');
  if (result.is_payment_screenshot !== null && typeof result.is_payment_screenshot !== 'boolean') throw new Error('Invalid flag');
  if (![null, 'bkash', 'nagad'].includes(result.provider as string | null)) throw new Error('Unknown provider');
  if (result.amount_minor !== null && (typeof result.amount_minor !== 'number' || !Number.isSafeInteger(result.amount_minor) || result.amount_minor <= 0 || result.amount_minor > 100_000_000_00)) throw new Error('Invalid amount');
  for (const field of ['trx_id', 'sender_number', 'receiver_number', 'occurred_at']) {
    const text = result[field];
    if (text !== null && (typeof text !== 'string' || text.length > (field === 'trx_id' ? 128 : field === 'occurred_at' ? 64 : 32))) throw new Error('Invalid field');
  }
  if (typeof result.occurred_at === 'string' && (!/(Z|[+-]\d{2}:\d{2})$/.test(result.occurred_at) || !Number.isFinite(Date.parse(result.occurred_at)))) throw new Error('Invalid time');
  if (!Array.isArray(result.unreadable_fields) || result.unreadable_fields.length > 7 || result.unreadable_fields.some(field => typeof field !== 'string' || !fields.includes(field))) throw new Error('Invalid unreadable fields');
  return result as unknown as PaymentSuggestions;
}

export function reviewedPaymentPatch(value: PaymentSuggestions): Partial<BuyerFormDraft> {
  // Receiver and time remain review context. Never rewrite the seller's designated account.
  if (value.is_payment_screenshot !== true) return {};
  return {
    ...(value.provider ? { payment_provider: value.provider } : {}),
    ...(value.trx_id?.trim() ? { payment_trx_id: value.trx_id.trim() } : {}),
    ...(value.sender_number?.trim() ? { payment_sender: value.sender_number.trim() } : {}),
    ...(value.amount_minor !== null ? { claimed_advance_bdt: (value.amount_minor / 100).toFixed(2) } : {}),
  };
}
