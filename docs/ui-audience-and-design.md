# Audience and UI design decisions

Researched 2026-10-24. This is desk research and a design hypothesis, not interviews or usability validation with actual pilot users.

## Audience

The approved Phase 1 scope targets sellers already collecting advances, with one confirmation operator per shop. Buyers arrive through a link after agreeing to the purchase in chat. This is an operations tool, not a product-discovery marketplace.

CGAP's [Bangladesh social-commerce fieldwork](https://www.cgap.org/blog/hiding-in-plain-site-informal-e-commerce-among-women-in-asia) describes social platforms repurposed for commerce, using interviews, focus groups and an online survey in 2019. Its [Bangladesh landscape report](https://www.findevgateway.org/sites/default/files/publications/2020/CGAP-Social-Commerce-Landscape-Bangladesh-FinalReport-piSTRATEGY.pdf) describes Messenger order collection, mobile-financial-service advances and cash on delivery. These older observations support the project's workflow; they are not current market-size evidence.

[GSMA's Mobile Gender Gap research](https://www.gsma.com/gender-gap-/) identifies affordability, digital skills and safety barriers, including Bangladesh. Inference: accessible phone layouts, familiar labels, manual fallbacks and low visual complexity should take priority over decorative animation. Do not infer that every seller is a woman, has low literacy, or has the same language preference.

## Theme: the everyday shop desk

Warm off-white canvas, white cards, deep teal actions, soft green surfaces, readable sans-serif typography, rounded controls and restrained shadows. Status colors have text labels. The visual choice is our design judgment; research does not establish that this palette improves trust or conversion.

The ui-ux-pro-max design-system search initially suggested a marketplace pattern and vibrant colors. We rejected those recommendations because the existing scope starts after the sale is agreed in chat. Retained accessible typography, visible focus, responsive forms and explicit actions. React stack guidance informed implementation.

## Interaction decisions

- One seller navigation set: orders, received payments/SMS, receiving accounts and retention. Diagnostic tools remain secondary, with a return-to-shop control.
- Explain the sequence: share a link, collect buyer/payment details, review and deliver.
- Keep order creation primary and payment recording secondary; preserve correction, exception and retention capabilities.
- Retain English/Bangla buyer labels and the existing manual submission path. Full seller localization needs separate language research and is not claimed here.
- Keep advance and remaining COD visible; replace unsupported secure/official-account language with seller-account wording. Seller acceptance does not imply provider verification.
- Label page-derived metrics as loaded records rather than claiming shop-wide totals from a filtered, paginated response.
- At least 44px primary control targets, visible keyboard focus, reduced-motion support, 16px form controls and an accessible skip link. Light is the supported theme; no dark-mode toggle is offered.
- Shared semantic colors cover seller/buyer states and dialogs. CSS is split by responsibility instead of extending the previous monolithic stylesheet.

## Validation boundaries

Synthetic browser fixtures exercise layouts and interactions, not authentication, database reconciliation, payment providers or deployment. Next research: watch pilot sellers create a link, review an unmatched payment and correct an address; watch buyers submit on their own phones. Measure completion, errors, comprehension and total seller effort before claiming UX improvement.
