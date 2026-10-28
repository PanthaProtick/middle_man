import type { CourierMessage } from '../locale/courierCopy';

const guidance: Record<string, CourierMessage> = {
  COURIER_REJECTED: 'Courier rejected booking',
  COURIER_SETUP_REQUIRED: 'Connect your merchant account in Pathao settings.',
  COURIER_CONNECTION_REQUIRED: 'Connect your merchant account in Pathao settings.',
  STALE_VERSION: 'Details changed or could not be validated. Reload and review current details.',
  COURIER_OUTCOME_UNKNOWN: 'Booking outcome unknown.',
  COURIER_TIMEOUT: 'Booking outcome unknown.',
  INTERRUPTED_IN_FLIGHT: 'Booking outcome unknown.',
  MALFORMED_SUCCESS: 'Booking outcome unknown.',
  PERSISTENCE_FAILURE: 'Booking outcome unknown.',
  COURIER_ATTEMPT_PROTECTED: 'Booking outcome unknown.',
  ALREADY_BOOKED: 'Check Pathao before recording a resolution.',
  EVIDENCE_MISMATCH: 'Reconciliation could not be validated. The attempt remains protected.',
  EVIDENCE_UNAVAILABLE: 'The consignment could not be verified. Check Pathao and reload before recording a resolution.',
  CONSIGNMENT_ALREADY_ASSOCIATED: 'This consignment is already associated with another order.',
  ATTEMPT_NOT_RECONCILABLE: 'Only an unknown submission outcome can be reconciled. Reload current details.',
  FORBIDDEN: 'Courier proposal access denied. Sign in with the owning seller account.',
  UNAUTHORIZED: 'Courier proposal access denied. Sign in with the owning seller account.',
};

export function courierErrorText(code: string | null, t: (message: CourierMessage) => string) {
  return t(guidance[code ?? ''] ?? 'Courier response could not be interpreted. Reload current details and check Pathao before taking further action.');
}

