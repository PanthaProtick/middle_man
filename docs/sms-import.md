# Seller SMS import retirement

Seller payment SMS pasting, batch parsing, results and import history are retired.
`POST /api/seller/transactions/sms-import` and
`GET /api/seller/transactions/sms-imports` return 404, including authenticated
requests. There is no replacement importer or provider integration.

Sellers record observations from their payment app through manual or guided
transaction entry. Receiving accounts, matching, exception review, duplicate
protection and seller authority retain their existing contracts. These records
express seller-supplied evidence, not independently verified provider receipts.

## Historical data and retention

Migration `0007_sms_import.sql` remains part of the migration history. Legacy
evidence and import-result tables remain available for retention and redaction;
retirement does not drop them or require a destructive migration.

Existing SMS-origin receipts, observations, allocations, accepted advances, COD
balances and order relationships remain intact. Historical source labels may
remain visible when reviewing those receipts. Retirement does not rematch records
or free a used payment identity.

Historical raw bodies keep their original collection instant and 30-day deadline.
Raw cleanup sets expired content to NULL without restoring it or changing the
structured payment record. Structured retention continues to redact legacy import
results and preserve nonspendable identities under the existing retention policy.
See [retention contracts](contracts/retention-ai-and-retired-surfaces.md) for the
owning-seller status/cleanup endpoints and operator CLI.

The process-memory adapter remains offline standby. Passing local checks does not
establish PostgreSQL upgrade, hosted scheduling, backup deletion, live identity or
provider acceptance. Historical planning and acceptance records describe the
former workflow and are not instructions to restore it.
