# M3 — Mi selección (Issue #70)

## Authorization and base

- Authorized by the Product Owner on 2026-11-03.
- Base: `main@a7a98664b2bbc5f8ad81a790b77fbdc0f09f31f0`.
- Parent roadmap: Issue #55. M2.1 accepted; M4 excluded.

## Outcome

A visitor saves up to four monthly listing IDs in browser local storage, restores them after reload, and compares current public API data for two or more published MONTH rentals.

## Scope

- Save/remove controls in catalog cards and public detail pages; public navigation to `/selection`.
- Persist only an ordered JSON array of listing IDs. No names, prices, terms, photos, contact data, API snapshots, credentials or other personal data.
- Rehydrate every saved ID from the public listing API when the selection view opens, on explicit refresh, and when returning to a visible tab.
- Compare monthly price/currency, capacity, location, deposit, utility inclusion, pets, estimated move-in and declared availability/freshness.
- Unknown values render as “No informado”; owner-declared values and availability are not verified or reserved by this feature.
- Handle 404/non-public IDs without silently deleting them; allow removal. Show a still-public `UNAVAILABLE` listing distinctly. If a saved item is no longer MONTH, keep it removable and exclude it from monthly comparison.
- Reuse the existing detail and contact flow. Saving never sends a contact or makes a reservation.
- Desktop uses two-column comparison cards; mobile uses a single readable card stack, including 320px.

## Acceptance

- Unit coverage: normalization, malformed storage, duplicate IDs, ordered persistence, max four, removal.
- Chromium local E2E: save/remove from catalog and detail; reload persistence; current API rehydration (storage contains IDs only); compare 2–4; known and unknown terms; stale/404; unavailable; API error/retry; detail/contact navigation; viewport overflow at 320/390/1440.
- Web typecheck/build/build:preview and required Worker/Web CI pass.
- No backend, migration, account, sync, remote D1/Preview/Access/CD/production change, M4 or external cost.

## Review and delivery

Use the functional PR for code, regression tests and visual evidence. Run the consistency validator before publication. Request one exact-head automated GitHub review and one risk-appropriate read-only technical review. Merge only through current protected-main controls. Do not deploy automatically; after merge provide the existing private Preview publication procedure for separate approval.
