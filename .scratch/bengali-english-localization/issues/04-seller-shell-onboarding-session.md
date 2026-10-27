# 04: Seller shell, onboarding, navigation, and session UI

**What to build:** Localize the seller chrome, shop setup/onboarding, workspace
navigation, metrics ribbon, and signed-out/session error UI, and mount the locale
switch in seller chrome.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `SellerShell`, `Header`, `SellerWorkspace`, `WorkspaceHeader`,
      `WorkspaceSectionNav`, `WorkspaceAccountsSummary`, `ShopSetupForm`,
      `ShopMetricsBar`, and `FormErrorBanner`.
- [ ] Cover masthead/eyebrow copy, workflow guide, footer trust wording, demo/tools
      toggle, sign-in/sign-out controls, skip link, section tabs, metrics labels,
      shop setup guidance, and loading/error/retry banners.
- [ ] `SellerSession` and `sessionRequest` messages are localized, including
      configuration, session-lost, reload, retry, and diagnostic states. Keep the
      seller-session contract and sign-in behavior unchanged; Clerk internal UI is
      ticket 13.
- [ ] Mount `LocaleSwitch` in the seller header with a label discoverable in either
      language. Ensure it remains reachable at phone widths and does not crowd
      primary actions.
- [ ] Switching language preserves the active section, session, loaded data, shop
      setup inputs, open banners, and pending requests. It issues no business
      request and does not re-run session loading.
- [ ] Use approved vocabulary for orders, delivery advance, remaining COD balance,
      confirmed order, buyer payment proof, and courier draft. Keep provider/brand
      names and opaque identifiers verbatim.
- [ ] Update shell/onboarding/session/metrics tests for both locales, observable
      labels, accessible names, preserved inputs, and no extra fetch on switch.
- [ ] Focused `npm run test:frontend` passes for these suites.
