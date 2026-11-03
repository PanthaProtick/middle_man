# 04: Production buyer-link workflow

**What to build:** An explicitly enabled production buyer-link policy permits public order terms/status and initial submission while preserving seller authority and private-data boundaries.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Add a default-disabled production policy separate from local self-test policy; accept only the documented link-possession policy and reject unknown settings.
- [ ] Allowed link possession grants public terms/status and permitted initial submission, without claiming buyer identity or granting seller actions, private evidence access, or unrestricted corrections.
- [ ] Preserve expiry, revocation, reissue, projection, initial submission, and existing correction rules. Submitted-order status access is not incorrectly ended by the initial submission deadline.
- [ ] Reissue invalidates the old link without changing the original deadline, submission state, or payment allocation; predecessor links never disclose replacements.
- [ ] HTTP contract tests cover disabled and enabled production policy, invalid settings, invalid/expired/revoked links, private access rejection, and duplicate-safe submission retries, including authority checks before cached replay.
- [ ] Preserve bounded requests, actionable failures, and offline test operation; do not enable real courier booking or paid AI.
- [ ] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact. Hosted browser acceptance belongs to ticket 09.
