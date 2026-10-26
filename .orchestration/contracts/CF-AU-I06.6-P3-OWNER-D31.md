# CF-AU-I06.6-P3 — OWNER D3.1

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/44
- Authorized base: `main@ec58cd9e2d702afe57d0d6a4ebb4f159bd831f8d` (PR #46 merged).
- Approved direction: D3.1, Issue #41, reference commit `77c99fa445171a58548e6e06497050bf2d923305`.

## Scope

Modernize the existing OWNER dashboard and listing editor as an operational D3.1 product experience. Preserve existing Vue/Worker/Hono/D1 behavior, routes, authorization, authentication strategy, listing state machine, image source restrictions, idempotency, availability and inbox READ/UNREAD semantics. Reconcile the stale active state for I06.6-P2 with PR #46 merge commit `ec58cd9e2d702afe57d0d6a4ebb4f159bd831f8d` within this functional PR.

Deliver: concise dashboard summary and next action; contextual listing cards and state-appropriate actions; editor sections for information, photographs and availability; real D1 BLOB/Static Asset photo display with local preview, ordering/removal and explicit save states; reliable availability timestamps/reconfirmation; real inbox state; safe destructive confirmations, retained draft/photo edits and clear retry/error feedback. Use mobile list→detail navigation where useful. Keep the design sans-led, accessible and consistent with D3.1.

## Acceptance / evidence

1. Existing OWNER functions continue to run through local Vue + Worker/Hono + D1 synthetic runtime: create/edit/save/review, photos, availability/reconfirm and real contact inbox READ/UNREAD.
2. Correct action availability by listing status and media strategy; preserve D1 BLOB/Static Asset restrictions and #36 approved-photo read-only visibility. No fabricated state or unsupported actions.
3. Preserve auth/session semantics and backend authorization, including expired sessions, forbidden roles/other OWNER, conflict/idempotency, and no private image/listing disclosure. No Worker/auth changes without a directly reproduced material defect.
4. Protect unsaved form/photo state across section switching, listing selection and route/logout; destructive actions remain confirmed and keyboard accessible.
5. Real Playwright coverage on local synthetic D1/MOCK verifies OWNER journey, public regressions, keyboard/focus and responsive 1440/390/320. Before/after screenshots are inspectable under `output/playwright/i06.6-p3/`.
6. Web typecheck/build, worker/web CI, consistency validator, exact-head GitHub review, separate GPT-6 Luna High read-only Controller and Pre-Critic pass; merge through enforced `main` protection.

## Boundaries

No Preview or production mutation/deploy, no R2/paid/new services, no real data, no authentication/backend product changes, no source repository writes. Do not implement ADMIN #33 or Product Acceptance #34. Close #44/update #25 after protected integration, then stop.
