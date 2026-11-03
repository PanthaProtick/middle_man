# Confirm orders from seller-supplied payment evidence

Phase 1 uses shop-isolated received-payment records supplied through seller SMS
entry or manual observation in the payment app, rather than direct payment-provider
verification. Deterministic matches can confirm automatically and recorded seller
decisions can resolve exceptions, but each received transaction can fund only one
order. This preserves the seller's existing process and avoids a provider-integration
dependency, while accepting that confirmation expresses seller acceptance rather
than independently authenticated proof of receipt; AI extraction never upgrades
that evidence into provider verification.

## Superseding note — 2026-11-03

Seller SMS import has been retired. Sellers now supply records through manual or
guided entry from their payment app. Historical SMS-origin records and accepted
allocations remain subject to the same evidence and retention rules; retirement
does not change their authority or permit another order to spend a used receipt.
