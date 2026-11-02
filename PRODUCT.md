# Middleman

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary users are Bangladesh social-commerce sellers already collecting delivery
  advances, with one confirmation operator per shop.
- Buyers arrive through a shared order link after agreeing to buy in chat. They
  review the agreed terms and provide the details needed to confirm the order.

## Product Purpose

Reduce seller effort between an agreed sale and delivery through buyer confirmation
links, seller-recorded payment reconciliation, and seller-reviewed courier preparation.
Success means less manual coordination while keeping order, payment, and delivery
decisions clear to the seller and buyer. This is a product goal, not a measured claim.

## Positioning

Middleman is an operations tool for the work after a social-commerce sale is agreed
in chat. Its mechanism connects an individual buyer confirmation link with the
seller's payment records and delivery workflow. Product discovery is outside this
scope; no unique market advantage or competitive superiority has been established.

## Operating Context

- Sellers create orders and share buyer links, record received payments, review
  claims and exceptions, and prepare orders for delivery.
- Buyers use the single-order portal at `/orders/:token` to review terms, provide
  delivery information, and submit payment claims.
- Mobile web and Bengali/English presentation support the workflow. Manual
  fallbacks remain available when automation or external services cannot help.
- The existing web application uses React, strict TypeScript, and Vite with a
  FastAPI/Pydantic backend; feature ownership is described in
  [the architecture guide](docs/ARCHITECTURE.md).

## Capabilities and Constraints

- Keep the delivery advance and remaining cash-on-delivery amount understandable.
- Buyer payment claims, seller-recorded transactions, and seller acceptance are
  distinct facts. Reconciliation does not establish independent provider verification.
- Preserve explicit seller authority over decisions and courier preparation.
  Assistance must respect the applicable domain contracts and confirmation boundary.
- Pathao supports the courier workflow; external-provider availability is not a
  prerequisite for local development and unit tests.
- Configuration, mock responses, local checks, and prepared integrations do not
  establish production readiness or successful live-provider behavior.
- Accepted designs and future capabilities must not be presented as implemented
  solely because they appear in a specification or ADR.

## Brand Commitments

Use Middleman as the product name. Keep buyer and seller language factual and
clear in Bengali and English. Avoid unsupported claims that payment accounts are
official, secure, or independently verified.

## Evidence on Hand

- [Audience and interaction decisions](docs/ui-audience-and-design.md) describe
  the operating context and existing accessibility goals. The audience research is
  desk research and a design hypothesis, not pilot-user validation.
- [API contracts](docs/API_CONTRACTS.md) and
  [architecture](docs/ARCHITECTURE.md) describe workflow boundaries; executable
  code and current verification remain necessary evidence of implementation.
- Existing automated checks and verification records have bounded scope. Do not
  invent usability outcomes, customer endorsements, benchmarks, or launch claims.
- The root README retains development-template content; it is not the authority
  for the current product audience or positioning.

## Product Principles

1. Reduce coordination around an agreed sale while preserving seller control.
2. Keep claims, recorded evidence, and decisions distinguishable.
3. Preserve usable manual paths alongside optional automation and integrations.
4. Make the buyer's next action and the seller's outstanding work understandable.
5. Base product claims on evidence and state material uncertainty plainly.

## Accessibility & Inclusion

Preserve Bengali/English support, readable phone layouts, visible keyboard focus,
text labels for status, reduced-motion support, and usable touch targets. Existing
guidance targets at least 44px primary controls and 16px form text. These are
requirements to verify, not a claim of audited accessibility conformance.

## Open Decisions

Pilot usability outcomes, quantified effort savings, and production launch readiness
remain unestablished. Future product expansion requires an explicit scope decision.
