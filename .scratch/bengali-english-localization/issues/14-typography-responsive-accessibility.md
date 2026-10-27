# 14: Bengali typography, responsive layout, and accessibility pass

**What to build:** Make the localized UI legible and usable on phone widths in both
languages, and ensure language-dependent document/accessible semantics are
complete.

**Blocked by:** 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 13

**Status:** ready

- [ ] Add Bengali-capable font support that works offline with a sensible system
      fallback. Remove or reconcile unused/dead font imports. Bengali text must not
      depend on a Windows-only font.
- [ ] Ensure headings, metric labels, section tabs, status rows, delivery grids,
      modal content, and controls accommodate longer Bengali strings without
      clipping, overlap, obscured actions, or horizontal scrolling at phone widths.
      Allow wrapping where nowrap currently clips; retain 44px primary targets and
      16px form controls.
- [ ] Avoid negative letter-spacing and other Latin-only typographic tightening
      for Bengali. Keep Bengali digits legible and 0-9 output for amounts,
      identifiers, and dates.
- [ ] Verify `document.documentElement.lang`, document titles, accessible names for
      every control, error association via `aria-describedby`, `aria-invalid`, live
      regions, dialog names, focus visibility, skip link, and reduced-motion
      behavior follow the selected locale. No status conveyed by color alone.
- [ ] Add or extend tests that assert accessible names, document language, and
      status/alert announcements in both locales. Add a maintainable check for
      untranslated owned copy (for example inline English literals in in-scope
      components) without flagging preserved data, provider names, or English CSV
      text.
- [ ] Record a manual phone-browser checklist for Bengali and English covering
      wrapping, control access, keyboard focus, announcements, no lost input, and
      real Clerk sign-in/recovery. Automated checks cannot establish browser or
      live-auth acceptance; report unverified items explicitly.
- [ ] Focused frontend tests and `npm run build` pass.
