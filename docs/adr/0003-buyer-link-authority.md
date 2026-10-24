# Separate buyer-link access from order lifecycle

Buyer-link possession grants public order terms/status and the initial submission,
without buyer sign-in or OTP. Forwarding can expose those terms or permit a first
submission by another holder; the seller-assisted workflow accepts this risk while
keeping personal details, evidence and seller actions private.

The initial submission deadline does not end submitted-order status access. Owning
sellers may revoke access or reissue a link without cancelling the order or changing
its payment allocation; reissue permanently invalidates the old link and preserves
the original deadline and submission state. Replacement links are shared explicitly,
never disclosed through predecessor links. This adds access-state and concurrency
handling but lets sellers recover from leaked links without changing business history.

Approved during the 2026-10-24 readiness review; implementation and verification
remain pending under the local self-test checklist.
