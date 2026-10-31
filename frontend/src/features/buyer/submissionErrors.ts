import type { Translate } from '../locale/context';
import type { ApiError, BuyerApiError } from './api';

const fieldNames: Record<string, string> = {
  buyer_name: 'buyer_name', contact_number: 'contact_number', 'address.raw_text': 'address_raw',
  'address.pathao.city_id': 'pathao_city', 'address.pathao.zone_id': 'pathao_zone',
  'address.pathao.area_id': 'pathao_area',
  'payment_claim.sender_number': 'payment_sender', 'payment_claim.trx_id': 'payment_trx_id',
  'payment_claim.amount_minor': 'claimed_advance_bdt', 'payment_claim.provider': 'payment_provider',
};

export function formFieldName(field: string): string {
  // Unknown server paths must never enter a CSS selector or become visible copy.
  return fieldNames[field] ?? '';
}

export function fieldMessage(t: Translate, field: NonNullable<ApiError['fields']>[number]): string {
  if (field.code === 'pathao_catalog_expired') return t('buyer.location.expired');
  if (field.code === 'pathao_location_invalid') return t('buyer.location.invalid');
  const maxLength = field.params?.max_length;
  const minLength = field.params?.min_length;
  if (field.code === 'string_too_long' && typeof maxLength === 'number' && Number.isSafeInteger(maxLength)) {
    return t('buyer.error.maxLength', {max_length: maxLength});
  }
  if (field.code === 'string_too_short' && typeof minLength === 'number' && Number.isSafeInteger(minLength)) {
    return t('buyer.error.minLength', {min_length: minLength});
  }
  if (['value_error', 'missing', 'string_too_short', 'greater_than', 'int_type', 'literal_error',
    'pathao_location_required'].includes(field.code)) {
    switch (formFieldName(field.field)) {
      case 'buyer_name': return t('buyer.form.nameRequired');
      case 'contact_number': return t('buyer.form.contactInvalid');
      case 'address_raw': return t('buyer.form.addressRequired');
      case 'pathao_city': return t('buyer.location.cityRequired');
      case 'pathao_zone': return t('buyer.location.zoneRequired');
      case 'pathao_area': return t('buyer.location.areaRequired');
      case 'payment_sender': return t('buyer.form.senderInvalid');
      case 'payment_trx_id': return t('buyer.form.trxRequired');
      case 'claimed_advance_bdt': return t('buyer.form.amountInvalid');
      case 'payment_provider': return t('buyer.error.provider');
    }
  }
  return t('buyer.error.invalidField');
}

export function submissionMessage(t: Translate, error: BuyerApiError | undefined, uncertain: boolean): string {
  let message: string;
  switch (error?.code) {
    case 'PUBLIC_RATE_LIMITED':
      message = error.retryAfterSeconds === undefined ? t('buyer.error.rateLimit')
        : t('buyer.error.retryAfter', {seconds: error.retryAfterSeconds});
      break;
    case 'PUBLIC_BODY_TOO_LARGE': message = t('buyer.error.tooLarge'); break;
    case 'VALIDATION_ERROR': message = t('buyer.error.validation'); break;
    case 'EXPIRED_SUBMISSION': message = t('buyer.error.expired'); break;
    case 'BUYER_LINK_REVOKED':
    case 'NOT_FOUND': message = t('buyer.error.unavailable'); break;
    case 'ORDER_ALREADY_SUBMITTED': message = t('buyer.error.submitted'); break;
    case 'IDEMPOTENCY_KEY_REUSED': message = t('buyer.error.conflict'); break;
    case 'PATHAO_LOCATION_REQUIRED': message = t('buyer.location.required'); break;
    case 'PATHAO_LOCATION_INVALID': message = t('buyer.location.invalid'); break;
    case 'PATHAO_CATALOG_EXPIRED': message = t('buyer.location.expired'); break;
    default: return t(uncertain ? 'buyer.error.unknown' : 'buyer.error.failed');
  }
  return uncertain ? `${message} ${t('buyer.error.unknown')}` : message;
}
