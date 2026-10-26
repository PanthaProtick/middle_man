# Seller-reviewed Pathao booking after order confirmation

Both manual and automatic order confirmation prepare a local courier draft, while an explicit seller submission creates a Pathao booking under that seller's merchant account and pickup store. Payment acceptance does not establish parcel readiness, and courier failures must not invalidate a successful confirmation; this boundary costs a seller review step but prevents incomplete orders from becoming immediate pickup requests.

Buyers select delivery locations from Pathao's hierarchy and provide a detailed written address. This accepts dependence on Pathao's location model to reduce seller remapping, with a written-address fallback during lookup outages; unresolved or unsupported locations block booking while preserving the buyer's submission.

The first version supports one booking per order and records its consignment ID, with delivery tracking and post-booking changes handled in Pathao. Ambiguous submission outcomes block resubmission until an existing booking is reconciled or creation failure is confirmed, because a merchant reference alone does not establish a provider idempotency guarantee.
