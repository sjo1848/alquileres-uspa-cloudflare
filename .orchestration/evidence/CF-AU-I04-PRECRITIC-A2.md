# CF-AU-I04 Pre-Critic Gate — Artifact A2 (2026-10-19)

## Candidate and scope

- Executable candidate SHA: `be68f314aaa77b8597c0ab6a5c3d16daaab62e5a`; tree `9c3caaa04cae3e0b54e803e79b3d1bc3b47697f7`.
- Parent candidate/A1 executable SHA: `1122de39f497e0635b8405210c6efb48e77916ba`; authorized `main` base `774d0c747e8ecbbdb97776641becbd9e49875875` remains an ancestor.
- Contract: `.orchestration/contracts/CF-AU-I04-OWNER-ADMIN-LIFECYCLE.md`; approval Issue #7 comment `6257931179`.
- Proposed immutable Artifact A2: `CF-AU-I04-OWNER-ADMIN-Artifact-A2`, exact target `be68f314aaa77b8597c0ab6a5c3d16daaab62e5a`.
- Scope remains OWNER individual GET/delete/UI and ADMIN-assisted discovery/edit/availability/reconfirmation/review submission/delete. No real authentication or new workflow.

## Consolidated repairs

- Controller P1 status boundary: availability and reconfirmation require DRAFT/REJECTED in handler, guarded D1 update and audit predicates, and UI. Regression covers SUBMITTED/APPROVED HTTP 409 with no audit additions. Unexpected D1 read failure returns 500, not false 409.
- GitHub P2 dirty OWNER refresh: refresh is disabled and guarded while editable fields are dirty; Playwright verifies stored values remain intact and the refresh becomes available after reverting changes.
- GitHub P2 ADMIN first-50 cap: the assisted-draft endpoint returns a stable `(updated_at,id)` cursor page with owner-scoped filtering; UI appends further pages. Worker tests cover 51 synthetic drafts on one owner, partial cursor rejection, completion of the second page, and no owner mixing. Playwright seeds 51 synthetic drafts, loads another page and confirms the selector contains all 51.
- Earlier findings are preserved and repaired: public detail SPA routing, submitted OWNER refresh image guard, duplicate submit/audit, and dirty ADMIN edit guard. A1 remains immutable with its BLOCKED Controller result and GitHub P2s; A2 is the corrected candidate.

## Validation

| Check | Result |
|---|---|
| Worker `npm run test:management` | PASS, 1 file / 9 tests |
| Worker `npm run typecheck` | PASS |
| Web `npm run typecheck` | PASS |
| Web `npm run build` | PASS |
| Web `npm run build:preview` | PASS |
| `python3 -B -m unittest discover -s scripts/tests` | PASS, 25/25 |
| Local Workerd + fresh synthetic D1 Playwright OWNER/ADMIN lifecycle | PASS; result includes OWNER dirty-refresh protection and ADMIN pagination beyond 50 |
| `node --check apps/web/e2e/owner-admin-lifecycle.playwright.js` | PASS |
| `git diff --check` | PASS |

The successful Playwright run used local Workerd, D1 migrations 0001–0012 and synthetic fixtures only. Its result payload reports the 17 named journey checks; the two additional direct assertions for dirty refresh and the 51st ADMIN draft also passed during that run. Screenshots: `output/playwright/owner-admin-lifecycle-desktop.png` and `...-mobile.png`. The separate A1 Controller attempted but did not execute Vitest because the read-only environment rejected Vitest's temporary config write; parent test results above are independent and successful. Full A1 provenance/output is in `.orchestration/evidence/critics/CF-AU-I04-ARTIFACT-A1-CONTROLLER-BLOCKED.md`.

## Boundaries and gate

- OWNER/API isolation, ADMIN authorization, status guards, pagination scope, idempotency and audit integrity: PASS on focused tests and browser path.
- Source repository remains untouched and read-only; no R2, billing, real data, production, real auth, Access policy changes or new remote resources.
- Main protection requires PR plus strict `worker`/`web` checks; merge and existing Preview update remain pending fresh exact-A2 GitHub review/checks and Controller PASS.

**Pre-Critic: PASS to publish immutable Artifact A2 and submit exact SHA to GitHub automatic review/checks and delegated read-only Controller. Not merge or Preview approval.**
