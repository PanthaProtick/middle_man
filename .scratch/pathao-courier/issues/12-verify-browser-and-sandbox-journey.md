# 12: Verify the complete browser and sandbox journey

**What to build:** Demonstrate the finished buyer-to-seller workflow in an actual browser and the real Pathao sandbox, with clear evidence of what passed and what remains unverified. Production booking stays disabled.

**Blocked by:** 09 — Submit protected bookings to Pathao's sandbox; 10 — Include courier data in retention cleanup.

**Status:** ready-for-agent

- [ ] Exercise actual buyer and seller screens at phone-sized and desktop viewports with keyboard-accessible loading, validation, recovery, and submission controls. Component tests and HTTP smoke are not substitutes for browser execution.
- [ ] Verify a seller can create a link before courier setup, optionally enter parcel details, and later connect an account/store and complete the draft. Verify a buyer can select valid locations and submit a detailed address and payment claim.
- [ ] Demonstrate both manual and automatic confirmation producing exactly one draft and correct remaining COD. Include accepted advance exceptions, a different payment sender/contact number, and fully paid zero collection in suitable acceptance cases.
- [ ] Exercise location loading/outage recovery, unsupported destinations, metadata blockers, stale review, pre-submission corrections/cancellation, duplicate clicks, unknown-outcome recovery, and post-booking external-action notices. Label each controlled fault as a local/adapter simulation unless actually induced in the provider.
- [ ] Complete a real sandbox journey using verified sandbox credentials/store and synthetic data: connect, load locations, create link, submit buyer data, confirm, review, submit, inspect actual consignment persistence, and recover it after refresh/restart where appropriate.
- [ ] Verify tenant/session privacy through the user-facing workflow, including another shop's denied access and no leakage of merchant secrets or private courier data to a public buyer link.
- [ ] Verify courier retention/redaction through its existing seller/maintenance workflow on disposable data. Confirm cleanup cannot resurrect private data through replay or enable duplicate booking.
- [ ] Confirm production create-order calls remain disabled and environment/store/reference separation holds. Do not create a real pickup request, claim physical delivery/settlement, or treat sandbox acceptance as production readiness.
- [ ] Run the final root `npm run check` gate against the accepted implementation and retain its result/log artifact. Fix regressions found by this acceptance slice with focused verification before repeating the final gate.
- [ ] Publish a concise acceptance record separating automated/offline, PostgreSQL, browser, actual sandbox, and production statuses. Reference the independent obsolete-Neon-data ticket's actual status without making cleanup a false prerequisite for this journey or silently claiming it completed.
- [ ] Explicitly report failed, blocked, and unrun checks. Missing sandbox access, incomplete browser coverage, or an interrupted check cannot be recorded as a pass.
