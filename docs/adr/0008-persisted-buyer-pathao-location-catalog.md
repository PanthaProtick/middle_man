---
status: superseded
superseded-by: 0009-on-demand-buyer-pathao-locations.md
---

# Persisted Pathao location catalogue for buyers

Superseded for buyer location authority by
[ADR-0009](0009-on-demand-buyer-pathao-locations.md) on 2026-10-31. Its independent
decisions about buyer interaction, seller review and booking safety remain in force;
snapshot tables and historical records are retained.

The buyer location controls currently clear their option lists and disable every
select while sequential catalogue requests finish. On 2026-10-31, the owner agreed
to show selections immediately, preserve parent controls, reset only descendants,
and remove location search inputs.

The agreed architectural direction is to serve buyer location browsing from a
persisted catalogue and synchronize with Pathao separately. Publish a replacement
only after successful validation; retain the last successful catalogue when a
refresh fails. This trades immediate provider freshness for availability and
predictable buyer interactions. Catalogue membership does not prove that Pathao
will accept a booking.

## Agreed operating policy

- Separate catalogues by shop and Pathao environment; do not assume identical
  coverage across merchant accounts.
- Synchronize daily and offer an explicit seller refresh action. Show sellers the
  catalogue age and refresh failures. Retain the last successful catalogue during
  refresh failures rather than imposing an automatic age cutoff for buyer browsing.
- Start the first synchronization when Pathao is connected. Until it succeeds,
  preserve the existing written-address submission fallback and require seller
  resolution before booking.
- Validate buyer submissions using saved choices. Check current Pathao location
  validity during seller courier review and block booking if validity cannot be
  established. The shared resolver must not silently grant booking authority to
  saved buyer choices. Existing submission safeguards remain necessary.

## Connection and checkout policy

- Disconnecting immediately removes catalogue authority. Reconnecting requires a
  successful synchronization before choices become available again, even if an
  older catalogue remains stored. Written-address fallback remains available.
- An open buyer form uses one catalogue version, including submission validation.
  Preserve replaced versions for 48 hours after replacement. Once that version
  expires, preserve entered details and ask the buyer to recheck location choices.
  A catalogue version never extends buyer-link authority or lifetime.
- Initially load cities, then fetch only the selected city's zones and selected
  zone's areas from the database. Remember fetched lists within the form. Only a
  child awaiting its choices is disabled; parent controls remain usable. Ignore
  late responses for a parent or connection that is no longer selected.

The owner confirmed the complete design and implementation on 2026-10-31. This
record does not establish completed behavior or hosted scheduling readiness.
