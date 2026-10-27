# 15: Vocabulary review, completeness audit, and final gate

**What to build:** Reconcile remaining bilingual business vocabulary with the
approved glossary, audit localization completeness, update project documentation,
and run the root check as the final implementation gate.

**Blocked by:** 11, 12, 13, 14

**Status:** ready

- [ ] Inventory remaining English/Bengali business terms in owned UI copy and align
      them with `GLOSSARY.md`. Apply the approved terms for delivery advance,
      remaining COD balance, confirmed order, buyer payment proof, and courier
      draft. Record any term that still requires owner review; do not invent
      account, provider, or booking certainty.
- [ ] Confirm no in-scope buyer/seller surface still renders simultaneously
      bilingual owned copy, and that preserved user data, provider names, IDs,
      brands, Pathao locations, and CSV contract remain untouched. Explicitly list
      any excluded developer/demo/internal surfaces.
- [ ] Update `tasks/bengali-english-localization-design.md` with changed paths,
      decisions, checks/results, unresolved risks, and browser/live-auth gaps.
      Update `docs/ui-audience-and-design.md` and the ADR status so they no longer
      claim localization is unimplemented, while separating automated success from
      hosted/browser/live-provider acceptance.
- [ ] Run root `npm run check` from a clean integration-branch state and report the
      actual result, including tooling, lint, strict types, tests, build, and HTTP
      smoke. Fix failures caused by this feature; report any unrelated or blocked
      gate.
- [ ] Record exact unverified acceptance items: real embedded Clerk sign-in and
      recovery in Bengali, phone-browser legibility/announcement checks, and any
      live Pathao/payment-provider behavior. Do not claim full acceptance if these
      remain unverified.
