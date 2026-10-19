# CF-AU-I04 Artifact A5 — reject stale ADMIN edit snapshots

Date: 2026-10-19
Authorized base: `774d0c747e8ecbbdb97776641becbd9e49875875`
Executable candidate: `e592422e2e485aedf622d169a1e04652940bf814`
Scope: existing PR #22; OWNER/ADMIN listing lifecycle only.

## Rework

GitHub P2 `4310303875` found that an ADMIN edit opened before a later OWNER save could overwrite the newer OWNER values after acquiring the shared lease. The ADMIN edit API now requires the form's `expectedUpdatedAt`, checks it against the D1 snapshot read under the lease, and predicates the D1 update on that same version. A stale edit returns 409 without audit or idempotency receipt. The UI preserves unsaved ADMIN fields, disables further edits until the operator explicitly reloads the current version, then allows a fresh edit. The Playwright journey reproduces a newer OWNER save between ADMIN form load and save, verifies the conflict and preserved text, reloads, and saves against the current version.

A4 remains immutable and retains its exact Controller PASS for the prior two P2 repairs. That PASS does not transfer to A5. A5 additionally preserves A4's fail-closed media deletion and OWNER availability/reconfirm lease fixes.

## Verification

- Worker `npm run test:management`: PASS, 12/12 on final Worker source/test tree, including unset-media deletion, OWNER/ADMIN availability interleaving and stale ADMIN edit conflict.
- Worker `npm run typecheck`: PASS after the final app/test changes.
- Web `npm run typecheck`: PASS; `npm run build`: PASS; `npm run build:preview`: PASS after UI changes.
- `node --check apps/web/e2e/owner-admin-lifecycle.playwright.js`: PASS.
- Local Workerd + fresh synthetic D1 Playwright lifecycle: PASS, 21 named checks, including stale ADMIN edit 409 and explicit reload. Screenshots refreshed under `output/playwright/`.
- Contact workflow 6/6 and OWNER lifecycle 4/4 passed on the same Worker source before A5's ADMIN-edit-only code change; no contact/OWNER handler changed afterward. The final management suite covers the full modified Worker file.
- `git diff --check` and orchestration validator must pass on the final checkpoint before publishing A5.
- No R2, remote resource, production, real identity or real data used.

## Gate

Pre-Critic authorizes immutable A5 publication and one consolidated exact-head GitHub review/checks plus one new separate-process GPT-6 Luna/High/read-only Controller review. The Controller must not execute tests or write files; A5 requires its own verdict because A4's PASS is exact-sha scoped. This gate is not merge or Preview approval.

**State: PASS_TO_PUBLISH_A5_FOR_FINAL_REVIEW_ONLY.**
