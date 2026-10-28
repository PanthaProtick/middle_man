# Bengali and English presentation with preserved business data

Status: accepted and implemented. Automated rendered and catalog tests establish
the presentation contract. Phone-browser, screen-reader, real embedded
authentication, hosted, and live-provider acceptance remain unverified; rendered
tests and HTTP smoke do not establish those gates.

Use a selected-language Bengali or English experience across buyer and seller
surfaces, replacing simultaneous bilingual labels. Preserve user-written data,
provider location names, identifiers, brand names, and the English CSV contract;
translate their surrounding labels and human-readable instructions instead.
This avoids accidental changes to delivery/payment evidence and spreadsheet
compatibility while making the operational interface understandable in Bengali.

Language is a device preference shared by buyer and seller screens, initialized
from browser preference and overridden by explicit choice. Shared buyer links do
not inherit the seller's language. Account synchronization is intentionally
excluded initially because people may prefer different languages on different
devices.

Render known errors from stable codes in the selected language, including saved
errors. Generated explanations should follow the requested language, but changing
language must not repeat AI calls or payment/courier actions, alter extracted
addresses, or rewrite historical evidence. When saved generated text has no
translation, provide a localized explanation with an explicit way to view the
original text.

Embedded authentication belongs in the localization scope. External provider
websites retain their own language, with localized guidance before leaving the
application. Completeness of embedded authentication requires live verification.

This decision replaces the paired-buyer-label design direction in
[Audience and UI design decisions](../ui-audience-and-design.md). Localized
document titles, browser-preference initialization, explicit-choice persistence,
and shared buyer/seller device preference are covered by automated tests; other
parts of this record remain acceptance requirements rather than demonstrated
browser or live-provider behavior. See the
[implementation brief](../../tasks/bengali-english-localization-design.md) for
wording, number/date rules, acceptance cases, exact evidence, and unrun gates.
