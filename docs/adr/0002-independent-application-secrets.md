# Keep saved-link and payment-reuse secrets independent of seller authentication

Phase 1 will use dedicated stable application secrets for saved buyer-link encryption
and payment-reuse protection, independent of Clerk credentials. This adds secret
configuration and rotation responsibilities but prevents authentication credential
changes from disrupting saved-link recovery or payment single-use protection.
Missing or incompatible key material must fail explicitly. Approved during the
2026-10-24 readiness review; implementation, existing-data compatibility and
application-key rotation mechanics remain to be verified.
