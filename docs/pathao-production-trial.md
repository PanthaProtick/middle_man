# Manual Pathao production trial

2026-10-31: Production submission is now an explicit opt-in. This supersedes the
earlier setup-only restriction in the account, review, and submission contracts.
Enabling it permits real courier bookings; it does not establish provider acceptance.

## Server configuration

Set the following in the backend environment and restart the API:

```dotenv
PATHAO_PRODUCTION_BOOKING_ENABLED=true
PATHAO_LOCATION_ENVIRONMENT=production
```

The production switch also enables durable mode: startup verifies PostgreSQL,
schema inventory, order-link encryption and payment-marker protection. Seller
requests require verified authentication; development tokens are rejected. Keep
the existing dedicated `PATHAO_CREDENTIAL_ENCRYPTION_KEY` stable across restarts.

Buyer catalog selection follows `PATHAO_LOCATION_ENVIRONMENT`, independently of
the booking switch. Use production locations for new production trial orders.
Existing orders still require an explicit review of their environment and choices.

## Manual workflow

1. Sign in as the seller. Open Accounts → Pathao courier account → production.
2. Under Connect merchant, enter the account's client ID, client secret, merchant
   email and password directly into the form. Verify and save the connection.
3. Under Courier defaults, choose an active merchant-owned pickup store and
   delivery service. Save the defaults.
4. Create an order link with the actual parcel quantity and weight. Complete its
   buyer form using the intended recipient and production city, zone and area.
5. Complete the order's payment/confirmation workflow. Open its courier review.
6. Select production, verify pickup store, service, parcel, destination and COD.
   Save delivery choices, resolve blockers, then Confirm current review.
7. The order is still a local draft. Click **Submit booking to Pathao production**
   only when ready to create the real courier order.
8. Check the returned consignment in the Pathao merchant panel before dispatch.

Local cancellation and delivery edits do not cancel or update a booking already
created in Pathao.

## Interrupted submission

A timeout or malformed success leaves an unknown attempt and blocks another
submission. Check the merchant panel, then attach the matching consignment through
reconciliation. The app verifies account, order reference and available store
evidence. An empty panel alone does not prove noncreation.

Set `PATHAO_PRODUCTION_BOOKING_ENABLED=false` to stop new production bookings.
Production consignment lookup remains available so existing unknown attempts can
still be reconciled. Keep durable storage and authentication configured when
operating on those existing records.

## Verification limits

Offline tests mock provider traffic. Production authentication, store/catalog
access, booking acceptance and consignment lookup require manual account-owned
verification. The configured production host is `https://api-hermes.pathao.com`;
successful connection verification checks that host with the merchant credentials.
