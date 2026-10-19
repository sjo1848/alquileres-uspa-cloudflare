# CF-AU-I04 local validation evidence

Authority: Issue #7 comment 6257931179. Source code remains read-only; implementation is based on lab `main@774d0c747e8ecbbdb97776641becbd9e49875875`.

## Implemented surface

- OWNER individual listing read is scoped by authenticated owner ID. Deletion accepts only DRAFT/REJECTED, uses the per-listing lock and idempotency receipt, and cascades D1 BLOB/static metadata while preserving quota accounting.
- OwnerView can refresh the selected listing and delete it with a confirmation. Submitted/approved/published items have no delete action.
- ADMIN-assisted management includes a bounded existing-draft selector, edit, availability update, reconfirm, submit and delete. Target OWNER is derived from D1; audit actor, target and action are committed with each mutation. Delete retains a historical audit event and original idempotent response.
- Public detail pages `/listings/:id` fall through to the SPA shell; owner APIs use `/api/*`, while only explicit availability/reconfirm/image paths are Worker-first in local, Preview and E2E configs.

## Executed checks

| Check | Result |
| --- | --- |
| Worker TypeScript | PASS |
| `npm run test:management` | PASS, 1 file / 7 tests |
| Web TypeScript | PASS |
| Web `npm run build` | PASS |
| Web `npm run build:preview` | PASS |
| `python3 -B -m unittest discover -s scripts/tests` | PASS, 25 tests, repeated after Controller REWORK |
| Web `npm run build` and `npm run build:preview` | PASS, repeated after Controller REWORK |
| Playwright local Workerd + isolated D1 | PASS: desktop OWNER (1440 px) and mobile ADMIN (390 px), synthetic identities/data; repeated after Controller REWORK |

Playwright verifies owner read and cross-owner denial, OWNER-to-ADMIN denial, public `/listings/:id` returning the HTML SPA shell for both identities while `/api/listings/:id` remains owner-scoped, selected-listing refresh, a synthetic D1 BLOB upload, cancel and confirm deletion, ADMIN create/edit/availability/reconfirm/submit/delete, and actor/target/action audit records. Screenshots: `output/playwright/owner-admin-lifecycle-desktop.png` and `output/playwright/owner-admin-lifecycle-mobile.png`.

Focused Worker regressions also verify missing keys, wrong roles, IDOR, status restrictions, image/quota cascade, idempotent replay and key conflict, listing lock conflict, immutable audit target, and rollback of both update and deletion when audit insertion fails. The verification used Workerd's local D1; no remote resource was read or changed.

## Review and delivery state

Latest consolidated executable candidate: `1122de39f497e0635b8405210c6efb48e77916ba`. Final exact-tree evidence and Pre-Critic: `.orchestration/evidence/CF-AU-I04-PRECRITIC-FINAL-1122DE3.md`. Worker management tests now pass 8/8, and local Workerd+D1 Playwright passes 17 checks. The Controller P1 requiring availability/reconfirmation to be DRAFT/REJECTED is fixed in the Worker, SQL predicates, UI and negative regressions; unexpected storage failures are verified to remain HTTP 500.

The first exact-SHA Controller review found a P1 route collision and GitHub reviews found three P2 lifecycle defects; the consolidated repairs are recorded in `.orchestration/evidence/critics/CF-AU-I04-CONTROLLER-7C5B5F7-REWORK.md`. A subagent Controller process could not verify model/read-only runtime and returned `BLOCKED_MODEL_CONFIG`; its audit-count test follow-up is included and revalidated in the final candidate. See `.orchestration/evidence/critics/CF-AU-I04-CONTROLLER-8981F7E-BLOCKED.md`. Final exact-head GitHub checks/review, separate-process Controller PASS, protected merge, Preview update and anonymous Access denial remain pending. No Controller PASS, GitHub PASS, remote E2E PASS, or Preview update is claimed here.

Limits observed: USD 0; no R2, billing, new resources, production, real data, source writes, Access-policy changes, or real authentication.
