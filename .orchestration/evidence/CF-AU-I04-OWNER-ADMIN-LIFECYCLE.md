# CF-AU-I04 local validation evidence

Authority: Issue #7 comment 6257931179. Source code remains read-only; implementation is based on lab `main@774d0c747e8ecbbdb97776641becbd9e49875875`.

## Implemented surface

- OWNER individual listing read is scoped by authenticated owner ID. Deletion accepts only DRAFT/REJECTED, uses the per-listing lock and idempotency receipt, and cascades D1 BLOB/static metadata while preserving quota accounting.
- OwnerView can refresh the selected listing and delete it with a confirmation. Submitted/approved/published items have no delete action.
- ADMIN-assisted management includes a bounded existing-draft selector, edit, availability update, reconfirm, submit and delete. Target OWNER is derived from D1; audit actor, target and action are committed with each mutation. Delete retains a historical audit event and original idempotent response.
- Static Asset routing sends direct `/listings/*` routes through the Worker in local, Preview and E2E configs, using one non-redundant path pattern.

## Executed checks

| Check | Result |
| --- | --- |
| Worker TypeScript | PASS |
| `npm run test:management` | PASS, 1 file / 7 tests |
| Web TypeScript | PASS |
| Web `npm run build` | PASS |
| Web `npm run build:preview` | PASS |
| `python3 -B -m unittest discover -s scripts/tests` | PASS, 25 tests |
| Playwright local Workerd + isolated D1 | PASS: desktop OWNER (1440 px) and mobile ADMIN (390 px), synthetic identities/data |

Playwright verifies owner read and cross-owner denial, OWNER-to-ADMIN denial, the direct Worker route, selected-listing refresh, a synthetic D1 BLOB upload, cancel and confirm deletion, ADMIN create/edit/availability/reconfirm/submit/delete, and actor/target/action audit records. Screenshots: `output/playwright/owner-admin-lifecycle-desktop.png` and `output/playwright/owner-admin-lifecycle-mobile.png`.

Focused Worker regressions also verify missing keys, wrong roles, IDOR, status restrictions, image/quota cascade, idempotent replay and key conflict, listing lock conflict, immutable audit target, and rollback of both update and deletion when audit insertion fails. The verification used Workerd's local D1; no remote resource was read or changed.

## Review and delivery state

The final commit SHA, GitHub checks/review, delegated Controller report, protected merge, Preview deployment, and anonymous Access denial must be recorded after those steps complete. No Controller PASS, GitHub PASS, remote E2E PASS, or Preview update is claimed here.

Limits observed: USD 0; no R2, billing, new resources, production, real data, source writes, Access-policy changes, or real authentication.
