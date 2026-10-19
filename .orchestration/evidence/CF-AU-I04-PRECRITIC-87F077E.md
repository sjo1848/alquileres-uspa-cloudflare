# CF-AU-I04 Pre-Critic Gate — consolidated rework

- Executable candidate: `87f077ed3a64de36c89a6d4caf985bbd05405c29`
- Tree: `b77fe337a62dbb61bdf4f0163ae40d83bdc532a2`
- Base: `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- Scope: OWNER individual GET/delete/UI and ADMIN-assisted draft edit, availability, reconfirmation, submit, delete; no real authentication.
- Authority: Issue #7 Human decision `6257931179`.

## Contract and scope

The active CF-AU-I04 contract remains unchanged. All acceptance criteria have executable evidence in `apps/worker/tests/listing-management.test.ts` and `apps/web/e2e/owner-admin-lifecycle.playwright.js`. The Controller's public-detail routing P1 and GitHub P2 findings `4309937209` and `4309937211` are repaired in the executable candidate and have direct regressions. No product scope, authentication semantics, cost, deployment, or data boundary was expanded.

## Applicable invariants

- 1, 2: source remains read-only and scope remains parity-first; no source files changed.
- 3, 4: OWNER APIs are scoped/role-checked; public detail route returns SPA HTML, separately asserted from `/api/listings/:id`.
- 6, 7: D1 BLOB image cascade/accounting and ADMIN actor/target audit are exercised by Worker and browser tests.
- 8: no real authentication changes; synthetic test identities only.
- 9, 10: no remote mutation, production, real data, paid service or new cost path.
- 11: GitHub remains canonical; branch base is the recorded main SHA.
- 13, 15, 16: Codex has not self-approved; this gate permits exact-SHA GitHub and read-only Controller review only.
- 14, 17, 20: routine findings were consolidated and repaired; no P0/P1 is known open.
- 22, 23: delegated Controller review and protected merge controls remain required; no merge is authorized by this gate alone.
- 5, 12, 18, 19, 21: N/A to this bounded lifecycle increment (no data migration, Drive authority, cost-model claim, or P3/P4 delegation).

## Verification

- Worker typecheck: PASS.
- `npm run test:management`: PASS, 1 file / 7 tests.
- Web typecheck: PASS.
- Web `npm run build`: PASS.
- Web `npm run build:preview`: PASS.
- `python3 -B -m unittest discover -s scripts/tests`: PASS, 25 tests.
- Playwright local Workerd + fresh synthetic D1: PASS, 15 named checks; includes public SPA detail/API separation, submitted OWNER refresh, duplicate-submit audit suppression, owner delete confirmation, admin-assisted mutations and audit.
- `git diff --cached --check`: PASS before the executable commit.
- `python3 scripts/check_orchestration_state.py`: PASS before the executable commit.
- Exact test/browse evidence and screenshots are recorded in `CF-AU-I04-OWNER-ADMIN-LIFECYCLE.md` and `output/playwright/owner-admin-lifecycle-{desktop,mobile}.png`.

## Gate result

**PASS to publish one consolidated PR candidate for exact-head GitHub checks/automatic review and delegated read-only `project_controller` review.** This is not a Controller PASS, merge approval, or Preview update authorization. No remote Preview operation was performed.
