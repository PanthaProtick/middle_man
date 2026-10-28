import { exportCopy } from '../locale/exportCopy';
import { lifecycleLabel, orderCopy } from '../locale/orderCopy';
import type { Locale } from '../locale/storage';
import { SellerApiError } from './api';

/** Server-provided values stay verbatim; only labels and the purpose sentence are localized. */
export interface ExportOrderSummary {
  order_id: string;
  product: string;
  lifecycle: string;
  buyer_name: string;
  contact_number: string;
  address: string;
  total_bdt: string;
  required_advance_bdt: string;
  accepted_advance_bdt: string;
  expected_cod_bdt: string;
  actual_cod_bdt: string;
}

export type ExportFailureCode =
  | 'clipboard'
  | 'rate_limited'
  | 'too_many'
  | 'unavailable'
  | 'summary_unavailable'
  | 'unauthorized'
  | 'unknown';

export type ExportFeedback =
  | { kind: 'copied' }
  | { kind: 'started' }
  | { kind: 'empty' }
  | { kind: 'error'; code: ExportFailureCode; detail?: string };

export function formatOptionalBdt(label: string, amount: string, notAcceptedLabel: string): string {
  return amount ? `${label}: BDT ${amount}` : `${label}: ${notAcceptedLabel}`;
}

export function summaryText(summary: ExportOrderSummary, locale: Locale): string {
  const text = exportCopy[locale];
  const acceptedAdvance = formatOptionalBdt(text.acceptedAdvance, summary.accepted_advance_bdt, text.notAccepted);
  const actualCod = formatOptionalBdt(text.actualCod, summary.actual_cod_bdt, text.notAccepted);
  return [
    `${text.order}: ${summary.order_id}`,
    `${text.product}: ${summary.product}`,
    `${text.lifecycle}: ${lifecycleLabel(summary.lifecycle, orderCopy[locale])}`,
    `${text.buyer}: ${summary.buyer_name}`,
    `${text.contact}: ${summary.contact_number}`,
    `${text.address}: ${summary.address}`,
    `${text.fixedTotal}: BDT ${summary.total_bdt}`,
    `${text.requiredAdvance}: BDT ${summary.required_advance_bdt}`,
    acceptedAdvance,
    `${text.expectedCod}: BDT ${summary.expected_cod_bdt}`,
    actualCod,
    text.purpose,
  ].join('\n');
}

export function resolveExportFailure(
  cause: unknown,
  status?: number,
  detail?: string,
): { code: ExportFailureCode; detail?: string } {
  let domainCode: string | undefined;
  let httpStatus = status ?? 0;
  let resolvedDetail = detail;

  if (cause instanceof SellerApiError) {
    domainCode = cause.code;
    httpStatus = cause.status || httpStatus;
    resolvedDetail = cause.message || resolvedDetail;
  } else if (cause instanceof Error) {
    resolvedDetail = cause.message || resolvedDetail;
  }

  if (domainCode === 'EXPORT_RATE_LIMIT' || httpStatus === 429) {
    return { code: 'rate_limited', detail: resolvedDetail };
  }
  if (domainCode === 'EXPORT_TOO_LARGE' || httpStatus === 422) {
    return { code: 'too_many', detail: resolvedDetail };
  }
  if (domainCode === 'EXPORT_UNAVAILABLE' || httpStatus === 503) {
    return { code: 'unavailable', detail: resolvedDetail };
  }
  if (domainCode === 'UNAUTHORIZED' || httpStatus === 401) {
    return { code: 'unauthorized', detail: resolvedDetail };
  }
  return { code: 'unknown', detail: resolvedDetail };
}

export function resolveSummaryFailure(
  cause: unknown,
  status?: number,
  detail?: string,
): { code: ExportFailureCode; detail?: string } {
  let domainCode: string | undefined;
  let httpStatus = status ?? 0;
  let resolvedDetail = detail;

  if (cause instanceof SellerApiError) {
    domainCode = cause.code;
    httpStatus = cause.status || httpStatus;
    resolvedDetail = cause.message || resolvedDetail;
  } else if (cause instanceof Error) {
    resolvedDetail = cause.message || resolvedDetail;
  }

  if (domainCode === 'EXPORT_RATE_LIMIT' || httpStatus === 429) {
    return { code: 'rate_limited', detail: resolvedDetail };
  }
  if (domainCode === 'EXPORT_UNAVAILABLE' || domainCode === 'ORDER_NOT_FOUND' || httpStatus === 503 || httpStatus === 404 || httpStatus === 422) {
    return { code: 'summary_unavailable', detail: resolvedDetail };
  }
  if (domainCode === 'UNAUTHORIZED' || httpStatus === 401) {
    return { code: 'unauthorized', detail: resolvedDetail };
  }
  return { code: 'unknown', detail: resolvedDetail };
}

export function exportFeedbackMessage(
  feedback: ExportFeedback,
  locale: Locale,
): { message: string; failed: boolean; detail?: string } {
  const text = exportCopy[locale];
  switch (feedback.kind) {
    case 'copied': return { message: text.summaryCopied, failed: false };
    case 'started': return { message: text.csvStarted, failed: false };
    case 'empty': return { message: text.noOrdersMatch, failed: false };
    case 'error': {
      let message: string;
      switch (feedback.code) {
        case 'clipboard':
          message = text.clipboardDenied;
          break;
        case 'rate_limited':
          message = text.rateLimited;
          break;
        case 'too_many':
          message = text.tooManyOrders;
          break;
        case 'unavailable':
          message = text.exportUnavailable;
          break;
        case 'summary_unavailable':
          message = text.summaryUnavailable;
          break;
        case 'unauthorized':
          message = text.unauthorized;
          break;
        default:
          message = text.fallbackError;
          break;
      }
      return { message, failed: true, detail: feedback.detail };
    }
  }
}
