# CF-AU-I06.6-P2 — Catálogo, ficha y consulta pública D3.1

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/43
- Authorized base: `main@639ba0eacb02be6ed96f6ba8746959c792d57e48`
- Approved visual reference: D3.1 in Issue #41, commit `77c99fa445171a58548e6e06497050bf2d923305`.
- Depends on P1 foundations integrated in PR #45 at `main@639ba0eacb02be6ed96f6ba8746959c792d57e48`.

## Scope

Implement D3.1 for the real Vue public catalog, listing detail and contact journey. Recompose the catalog so useful results and property photos appear promptly, preserve working query-backed filters and pagination, and provide a clear photo-led listing detail with its real available contact action. Keep availability/freshness, price, currency, rental period and last-confirmation values sourced from the existing public API. Improve image loading/error/no-image fallbacks and investigate the red P1 screenshot artifact.

Do not add unsupported product functions (favorites, booking, reviews, online payments, new sort modes or invented availability), alter Worker/API contracts, change authentication or permissions, or refactor OWNER/ADMIN. A Worker/API change is allowed only to correct a directly reproduced material defect and must remain bounded to this journey. Use actual image URLs/bytes and access rules returned by existing Static Assets or D1 BLOB paths. Synthetic repository media and synthetic D1 data are permitted for local tests only; do not add synthetic showcase assets to the real product data.

## Acceptance criteria

1. Public catalog follows approved D3.1 and is responsive at 1440×1000, 390×844 and 320×844 without horizontal overflow. Photos, search and results are visible with less wasted vertical space than the P1 baseline.
2. Existing filters, URL state, paging, query cancellation, empty/error/retry behavior and result counts remain functional. Cards use the real public response for title, capacity, price + currency + period, availability, freshness, last confirmation and images.
3. Listing detail uses its real public response and image URLs, distinguishes no photos from failed loads, has useful alt text and a reliable fallback, and presents the existing availability/freshness disclaimer accurately.
4. Catalog → detail → contact completes against local Vue + Worker/Hono + real local D1. The contact API remains idempotent; retry uses the original key, preserves user input on error, does not create duplicate contact events, and never implies a reservation/payment.
5. Keyboard/focus, labels/contrast and reduced motion are checked; mobile contact retains the #35 regression. Existing public journey and applicable foundations/OWNER regressions pass.
6. Capture before/after runtime desktop and mobile screenshots, including 320px; document the red P1 block diagnosis and exact static/D1 paths used. Run typecheck, build, CI worker/web, consistency validator and whitespace check on the candidate.
7. Keep `STATE.md` and `STATUS.json` aligned with current main, D3.1 approval (#41), active Issue #43, and the actual branch/PR/head. Obtain exact-head GitHub review and delegated separate-process `project_controller` review, resolve findings, pass Pre-Critic and merge through branch protection.

## Out of scope and stop boundary

No Preview or production changes; no R2, paid services, new remote resources, real data, source-repository writes, authentication changes, OWNER implementation (#44), ADMIN implementation (#33), or work beyond Issue #43. After protected integration, update #43/#25 and stop before #44.
