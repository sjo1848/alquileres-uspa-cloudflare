# CF-AU-I04 Pre-Critic Gate — Artifact A3 (2026-10-19)

## Candidate and authority

- Exact executable candidate: `08184396c652087c6159513dc049eefc163adb8e`; tree `8fe95ecc08a3362010e5218b1cefe412bfcf6b0a`.
- Parent A2 executable SHA `be68f314aaa77b8597c0ab6a5c3d16daaab62e5`; approved base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- Contract `.orchestration/contracts/CF-AU-I04-OWNER-ADMIN-LIFECYCLE.md`; Human approval Issue #7 comment `6257931179`.
- Proposed immutable artifact tag: `CF-AU-I04-OWNER-ADMIN-Artifact-A3`, exact target `08184396c652087c6159513dc049eefc163adb8e`.
- Scope remains OWNER individual GET/DELETE UI and ADMIN-assisted draft discovery/edit/availability/reconfirmation/submit/delete. No real authentication, production flow, or new product scope.

## A2 Controller/GitHub finding and repair

Controller A2 REWORK and GitHub finding `4310143034` identified a stale-response race when ADMIN changes OWNER while a draft page request is in flight. In A3, `loadDrafts()` captures the selected owner and cursor and applies data, errors, or loading state only if its request generation and owner still match. Owner changes invalidate earlier generations. Playwright delays the OWNER A page, selects OWNER B, releases the response, and verifies A drafts do not appear under B. The A2 record remains immutable with its REWORK evidence; A3 contains the bounded repair.

Earlier findings remain repaired: status-bound availability/reconfirmation; D1/audit status predicates; unexpected-storage 500; dirty OWNER refresh guard; stable ADMIN pagination beyond 50; public detail SPA routing; submitted OWNER image refresh; duplicate submit/audit; dirty ADMIN form guard.

## Verification on the candidate tree

| Check | Result |
|---|---|
| Worker `npm run test:management` | PASS, 1 file / 9 tests |
| Worker `npm run typecheck` | PASS |
| Web `npm run typecheck` | PASS |
| Web `npm run build` | PASS |
| Web `npm run build:preview` | PASS |
| Python regression suite | PASS, 25/25 |
| `node --check apps/web/e2e/owner-admin-lifecycle.playwright.js` | PASS |
| Local Workerd + isolated synthetic D1 Playwright | PASS, 20 named checks |
| `git diff --check` | PASS on staged executable/evidence changes |

The 20 Playwright checks include OWNER read/IDOR/role isolation, dirty refresh guard, image upload and cancel/confirm deletion; ADMIN assisted create/edit/availability/reconfirmation/submit/delete/audit; 51-draft cursor pagination; and a delayed OWNER A response discarded after switching to OWNER B. Screenshots: `output/playwright/owner-admin-lifecycle-desktop.png`, `...-mobile.png`. No remote data or services were used.

## Invariants and review boundary

- OWNER scope, ADMIN role, owner filter on every cursor page, stale response isolation, status guards, idempotency and audit behavior: PASS in focused tests/E2E.
- Source repository untouched/read-only; USD 0; no R2, billing, real data, production, real authentication, Access changes or new remote resources.
- Preflight validator and final whitespace gate must pass immediately before publishing; result is recorded in Event 143.
- A2's separate Controller returned REWORK P2; report, prompt, output and raw event stream remain at `.orchestration/evidence/critics/CF-AU-I04-ARTIFACT-A2-CONTROLLER-REWORK.md` and adjacent files.

**Pre-Critic: PASS to publish immutable Artifact A3 at exact SHA `08184396c652087c6159513dc049eefc163adb8e` and submit for exact-SHA GitHub review/checks and delegated read-only Controller. Not merge or Preview approval.**
