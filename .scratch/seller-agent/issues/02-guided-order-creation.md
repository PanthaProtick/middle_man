# 02: Create orders through guided conversation

**What to build:** Prepare and confirm an awaiting-buyer order inside the assistant, then return its real buyer link and seller view.

**Blocked by:** 01: Unify the floating seller assistant and contextual review.

**Status:** ready-for-agent

- [ ] Interpret provided order fields locally; collect product name, positive total, positive required advance no greater than total, and active receiving account. Parcel weight and quantity remain optional under existing validation.
- [ ] Ask for all missing/invalid required fields together, preserve valid answers, never invent an advance or guess between accounts; accept clear Bengali digits/currency notation and clarify ambiguous amounts.
- [ ] Show an editable summary with interpreted amounts and an explicit Create order button. Edits invalidate earlier confirmation; no write occurs from a model response or conversational acknowledgement.
- [ ] Revalidate shop authorization, active account, and constraints at submission through existing domain behavior; return recoverable validation/conflict messages while preserving entered fields.
- [ ] Bind server-enforced submission identity to shop, action, and confirmed payload. Double clicks, concurrent retries, and lost responses cannot create duplicate orders; the same identity with changed payload cannot mutate the original action.
- [ ] Resolve uncertain outcomes by submission identity before resubmitting; define recovery and retention appropriate to configured storage, including restart behavior, rather than relying on a disabled button or process-local UI flag.
- [ ] Return actual awaiting-buyer result with Copy link and Open order actions. Do not collect buyer delivery details or book couriers.
- [ ] Support one creation action at a time and clarify multi-action requests. Test complete/incomplete/corrected inputs, bilingual amounts, cross-shop access, stale accounts, concurrent duplicates, and failed/processing/unknown outcomes.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

