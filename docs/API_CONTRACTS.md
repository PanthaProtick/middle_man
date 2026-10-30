# API Contracts & Data Flow Guide

> [!NOTE]
> This document is part of **Tier 2 (On-Demand Context)**. It indexes the
> authoritative domain contracts. Read the annex for a workflow before adding or
> changing its FastAPI endpoints, Pydantic models, or frontend client calls.

The contract text was moved into domain annexes without changing workflow
semantics. A stale statement about where all models live was corrected to match the
current route/service/model split; update the owning annex when behavior changes.

## Contract annexes

- [Application conventions and demo boundaries](contracts/application-conventions.md):
  REST status conventions, shared Pydantic/frontend synchronization, and the
  current demo boundaries that are not readiness claims.
- [Orders, search, and export](contracts/orders-search-and-export.md): seller order
  search, Bangladesh date bounds, pagination, and the English CSV export contract.
- [Payments and reconciliation](contracts/payments-and-reconciliation.md): received
  payment search, receipt comparison/resolution, unallocated corrections, and
  seller payment exception acceptance.
- [Pathao and courier](contracts/pathao-and-courier.md): merchant settings, local
  courier proposals, protected submission outcomes, reconciliation, and
  post-submission changes.
- [Buyer access and corrections](contracts/buyer-access-and-corrections.md): link
  reissue/revocation, public admission limits, manual address entry, and seller
  buyer corrections.
- [Retention, AI policy, and retired surfaces](contracts/retention-ai-and-retired-surfaces.md):
  raw-evidence and structured-record retention, self-test AI policy, and the
  retirement of buyer payment screenshots and address AI.

## Related contracts

- [Local seller review assistance](contracts/review-assistance.md)
- [Pathao account settings](pathao-account-contract.md)
- [Pathao locations](pathao-location-contract.md)
- [Pathao review](pathao-review-contract.md)
- [Pathao submission](pathao-submission-contract.md)
- [Retention lifecycle](retention-lifecycle.md)
- [SMS import](sms-import.md)
- [Order delivery workflow](order-delivery-workflow.md)

## Maintenance

- Source/test size, documentation review, and storage rules are in
  [repository conventions](CONVENTIONS.md).
- Historical acceptance evidence lives in [verification](verification/README.md)
  and is not a current readiness claim.
