# 01: Search Orders and export the matching set

**What to build:** A seller can search all eligible orders by a familiar identifier or buyer detail, combine that search with lifecycle, page through the results, and download the same matching set as an English CSV.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] One Orders search field matches exact trimmed case-insensitive order IDs, partial case-insensitive product and buyer names, and normalized full Bangladesh buyer contact numbers. Short numeric fragments do not match phone fields.
- [ ] Search is shop scoped, excludes retained orders, and applies before pagination on database and offline paths. It combines with the existing lifecycle filter. Changing search or lifecycle clears old rows and cursor; stale in-flight responses cannot repopulate them.
- [ ] The Orders CSV uses the same search and lifecycle criteria across all pages, preserves English columns and existing safety headers/escaping/rate limit, and returns an explicit narrowing error above 500 matches rather than a truncated file.
- [ ] Search stays out of the browser address bar and is cleared by refresh. English and Bengali labels, accessible controls, empty results, and error feedback work without losing entered values or focus.
- [ ] Focused route/export and workspace tests cover matches and nonmatches, mixed lifecycle filters, pagination, shop isolation, offline behavior, locale changes, stale responses, and 500/501 export results. Run root `npm run check` as the final gate; report browser acceptance separately.
