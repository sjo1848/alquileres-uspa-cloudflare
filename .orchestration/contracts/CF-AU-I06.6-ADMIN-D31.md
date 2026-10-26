# CF-AU-I06.6 — ADMIN D3.1

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/33
- Authorized base: `main@0eff7358006a7e6e207387380ecc7bdd27615fb5` (PR #51 merged).
- Visual system: approved D3.1 from Issue #41, reference `77c99fa445171a58548e6e06497050bf2d923305`.
- Parent: Issue #25.

## Scope

Modernize Vue routes `/admin` and `/admin-assist` using existing Worker/Hono APIs and local synthetic D1. Keep approval, publication, rejection, assisted editing, availability/reconfirmation, submission, deletion, image authorization, idempotency, optimistic concurrency and audit semantics unchanged. ADMIN image inspection is read-only unless an existing authorized API explicitly supports mutation; do not invent upload/reorder/delete APIs.

Reconcile PR #51's post-merge checkpoint in this functional PR. Keep the staging CD disabled; do not change its guard in this scope.

## Acceptance

1. Moderation queue is decision-oriented and responsive: submitted and approved/unpublished states are visually distinct; contextual detail shows owner, location, price+currency+period, duration, capacity, availability/freshness/last confirmation, image state and data warnings.
2. Approve, publish and reject-with-reason are separate and accurately reflect API transitions. Rejection reason is required; stale/conflicting operations give actionable 409 feedback and retry/refresh without false success.
3. ADMIN-assisted owner/draft navigation is clear and safe; editing is grouped by sections for listing details, read-only photos, availability and audit. Persisted owner/actor audit remains visible with human-readable action names; unknown events stay explicit and private data is not overexposed.
4. Unsaved edits are preserved or explicitly confirmed before changing OWNER/listing/route, deleting, submitting, or reloading. Existing cursor pagination, idempotency keys, optimistic version checks and audit invariants remain intact.
5. Reproduce and fix defect #35 in `/admin-assist` at 390×844 and 320×844; preserve the already-fixed public contact flow and close #35 only with evidence for both.
6. Reproduce and fix defect #37 with deterministic `es-AR` 24-hour local formatting and fixed timezone tests for morning/evening/day rollover; UTC persistence and freshness logic do not change.
7. Real local Vue + Worker/Hono + D1 synthetic Playwright verifies OWNER submit → ADMIN inspect → approve/reject → separate publish → public catalog; assisted edit/availability/reconfirm/submit/delete; audit persistence; negative OWNER/ADMIN permissions and IDOR; conflicts/idempotency/errors; keyboard/focus; 1440×1000, 390×844, 320×844 no overlap/overflow.
8. Focused Worker regressions, Web typecheck/build, relevant local E2E, exact-head `worker`/`web` CI, GitHub review, delegated GPT-6 Luna High read-only Controller, final consistency/Pre-Critic and protected merge pass. Preserve public and OWNER regression evidence.

## Boundaries

No remote Preview/CD activation, D1 mutation, production, Access changes, new resources, R2, paid cost, real data, source-repository writes, auth/role changes, #34 Product Acceptance or I07. Resolve only concrete backend defects reproduced by this task; keep API edits minimal and covered by regressions.
