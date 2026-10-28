import type { MessageKey } from '../locale';
import { canonicalizeBdPhone } from '../seller/api';
import { parseClaimedAmount } from './api';
import type { BuyerFormDraft } from './types';

export function validateBuyerDraft(draft: BuyerFormDraft): Record<string, MessageKey> {
  const errors: Record<string, MessageKey> = {};
  if (!draft.buyer_name.trim()) errors.buyer_name = 'buyer.form.nameRequired';
  if (!draft.contact_number.trim()) errors.contact_number = 'buyer.form.contactRequired';
  else {
    try { canonicalizeBdPhone(draft.contact_number); }
    catch { errors.contact_number = 'buyer.form.contactInvalid'; }
  }
  if (!draft.address_raw.trim()) errors.address_raw = 'buyer.form.addressRequired';
  if (!draft.payment_sender.trim()) errors.payment_sender = 'buyer.form.senderRequired';
  else {
    try { canonicalizeBdPhone(draft.payment_sender); }
    catch { errors.payment_sender = 'buyer.form.senderInvalid'; }
  }
  if (!draft.payment_trx_id.trim()) errors.payment_trx_id = 'buyer.form.trxRequired';
  try { parseClaimedAmount(draft.claimed_advance_bdt); }
  catch { errors.claimed_advance_bdt = 'buyer.form.amountInvalid'; }
  return errors;
}
