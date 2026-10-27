# 01: Shared locale foundation

**What to build:** Add one device-local locale provider, typed translation
catalog, locale-aware formatters, and the visible বাংলা / English switch used by
both rendering entry paths. Split `App.tsx` into buyer and seller shells so later
tickets can own separate files.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] `Locale` is `'bn' | 'en'`. Initialization order: stored device preference
      (localStorage key `middleman.locale`) → first preferred browser language is
      Bengali → English. Invalid stored values are ignored.
- [ ] `LocaleProvider` exposes the current locale, an explicit `setLocale`, and
      translation/formatting helpers. Explicit choice persists on that device and
      overrides browser preference on reload. No account or server sync.
- [ ] Provider is mounted once above both `main.tsx` branches, so the `/orders/*`
      buyer path, the no-Clerk path, and the Clerk-backed seller path share it. It
      must not be remounted below `BuyerPortal`'s token key.
- [ ] Extracted `BuyerPortalShell` and `SellerShell` components preserve current
      behavior and let tickets 02 and 04 own separate files. `App.tsx` stays below
      the line limit.
- [ ] `LocaleSwitch` renders visible `বাংলা / English` choices in either mode with
      accessible names and `aria-pressed`; selecting a language changes the UI
      immediately without navigation. A polite live announcement reports the
      change. It is exported for mounting in buyer and seller chrome.
- [ ] Provider updates `document.documentElement.lang` (`bn` / `en`) and
      `document.title` for the active route/locale. Static `index.html` remains a
      sane English fallback.
- [ ] Translation catalog is typed and split by area so parallel tickets do not
      edit one shared file. Every area is pre-registered: `common`, `buyerShell`,
      `buyerForm`, `sellerShell`, `orders`, `paymentsCore`, `paymentsEvidence`,
      `courierDraft`, `courierAdmin`, `corrections`, `copied`, `auth`. Each area
      module owns both English and Bengali messages.
- [ ] `t(key, params?)` rejects unknown catalog keys at compile time and replaces
      `{name}` placeholders. Missing runtime translations fall back to English.
- [ ] Formatting helpers: money uses `৳`, comma grouping, two decimals, 0-9
      digits; dates use Gregorian month names, unambiguous day/month order,
      `Asia/Dhaka`, 0-9 digits, and an explicit Bangladesh-time label where a time
      is shown. Bengali `০-৯` input is normalized only at numeric parse boundaries;
      arbitrary text and identifiers are untouched.
- [ ] Translation-completeness test compares English/Bengali key sets, detects
      extra/missing keys, and verifies placeholder parity. Behavior tests cover
      browser initialization, explicit override, reload persistence, document
      language, and purchase-free switching.
- [ ] Focused `npm run test:frontend` passes for new i18n tests and any touched
      shell tests. Existing English-default behavior keeps unrelated tests green.
