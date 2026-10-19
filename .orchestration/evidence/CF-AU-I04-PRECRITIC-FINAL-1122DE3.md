# CF-AU-I04 Pre-Critic Gate — consolidated candidate (2026-10-19)

## Candidate and authority

- Authorized increment: `.orchestration/contracts/CF-AU-I04-OWNER-ADMIN-LIFECYCLE.md`, approved in Issue #7 comment `6257931179`.
- Exact executable candidate: `1122de39f497e0635b8405210c6efb48e77916ba`; tree `f5c1ce104875e8a5b948e06512460c72b61e89de`.
- Approved base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor. Only expected CF-AU-I04 worker/web/tests and synthetic screenshot/evidence files differ from the previous PR head `284086f4d539d00c9d6685a9f40cc37bae7a6702`.
- Immutable candidate tag to publish after this gate: `CF-AU-I04-OWNER-ADMIN-Artifact-A1`, targeting the exact executable SHA above. Controller and GitHub must review this exact SHA; this gate is not their PASS.
- Scope is OWNER individual GET/DELETE UI and ADMIN-assisted edit, availability, reconfirmation, review submission and delete. No real authentication, new workflow, source repository write, paid service, production or real data.

## Findings and repairs

1. Controller P1: public `/listings/:id` detail routing now falls through to Vue SPA while the API remains owner-scoped.
2. GitHub P2: refreshing a submitted OWNER listing no longer invokes editable-only image loading.
3. GitHub P2: a fresh idempotency key cannot resubmit an already submitted ADMIN draft or create duplicate audit; same-key replay remains stable.
4. GitHub P2: ADMIN cannot switch away, submit, change availability, reconfirm, delete, or create another draft while form changes are unsaved.
5. Controller P1 on exact prior candidate `284086f`: assisted availability and reconfirmation now require DRAFT/REJECTED in UI and Worker; guarded D1 update and audit predicates close status races. Unexpected storage errors now surface as 500 instead of a false 409.

Repair details and original reviewer output are preserved in `.orchestration/evidence/critics/CF-AU-I04-CONTROLLER-284086F-REWORK.md` and the adjacent OUTPUT/PROMPT/RAW files. Earlier reviews and findings remain in their original evidence files.

## Verification on the exact executable tree

| Check | Result |
|---|---|
| `cd apps/worker && npm run test:management` | PASS, 1 file / 8 tests |
| `cd apps/worker && npm run typecheck` | PASS |
| `cd apps/web && npm run typecheck` | PASS |
| `cd apps/web && npm run build` | PASS |
| `cd apps/web && npm run build:preview` | PASS |
| `python3 -B -m unittest discover -s scripts/tests` | PASS, 25/25 |
| local Workerd + fresh synthetic D1 Playwright `owner-admin-lifecycle.playwright.js` | PASS, 17 checks at desktop OWNER/mobile ADMIN |
| `git diff --check` / staged whitespace check | PASS |

The E2E covers individual OWNER read, cross-owner/role denial, SPA-vs-API routing, submitted refresh, D1 BLOB image and deletion confirmation/cascade, ADMIN create/edit, dirty-form guard, availability/reconfirmation, submit status guard/idempotency, audit actor and target, and assisted deletion. A first run used the catalog-only fixture and timed out because the OWNER/ADMIN test identities were absent; after applying the intended synthetic identity seed plus catalog seed to a new isolated local D1, the same 17-check E2E passed. Screenshots are `output/playwright/owner-admin-lifecycle-desktop.png` and `...-mobile.png`.

Consistency validator `python3 scripts/check_orchestration_state.py --base origin/main`: PASS (`canonical active state and final diff are consistent`); `git diff --check`: PASS on the full pending state/evidence diff.

## Invariants and boundary

- OWNER authorization/IDOR and ADMIN role boundaries: PASS, Worker tests + Playwright.
- Editable lifecycle state, idempotency and audit atomicity: PASS, Worker tests + Playwright.
- Source repo remains read-only; synthetic D1 only; no R2, billing, production, real data, real auth or Access changes: PASS by configured test/deployment boundary.
- Main remains canonical; protected merge is pending required checks, automatic review and Controller PASS.
- Preview update is pending protected integration; only the existing Access-protected Preview may be updated, without new resources or Access-policy changes.

**Pre-Critic decision: PASS to freeze/publish this single consolidated artifact for exact-SHA GitHub checks/automatic review and delegated read-only Controller review. This does not authorize merge or Preview update until both reviewers and branch protections pass.**
