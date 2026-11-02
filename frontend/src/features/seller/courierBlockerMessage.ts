import type { CourierMessage } from '../locale/courierCopy';

const blockerLabels: Record<string, CourierMessage> = {
  PARCEL_DETAILS_REQUIRED: 'Save explicit parcel weight and quantity above.',
  COURIER_CONNECTION_REQUIRED: 'Connect your merchant account in Pathao settings.',
  PICKUP_STORE_REQUIRED: 'Choose an active pickup store for this connection.',
  SERVICE_REQUIRED: 'Choose a supported delivery service.',
  LOCATION_METADATA_REQUIRED: 'Resolve the destination and supported delivery coverage.',
  LOCATION_CHOICES_INVALID: 'Choose destination IDs from their current city and zone.',
  METADATA_UNAVAILABLE: 'Metadata could not be validated. Retry after restoring the connection.',
  ORDER_NOT_CONFIRMED: 'This order is no longer confirmed.',
};

export function courierBlockerMessage(code: string): CourierMessage {
  return blockerLabels[code] ?? 'Courier response could not be interpreted. Reload current details and check Pathao before taking further action.';
}
