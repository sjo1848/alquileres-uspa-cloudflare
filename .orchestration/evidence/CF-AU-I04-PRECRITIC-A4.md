# CF-AU-I04 Artifact A4 — consolidated P2 rework

Date: 2026-10-19
Authorized base: `774d0c747e8ecbbdb97776641becbd9e49875875`
Executable rework: `0678f39437d9f3796d0c3338520abe59e9e99e5e`
Scope: PR #22; OWNER/ADMIN listing lifecycle only.

## Findings repaired together

- GitHub P2 `4310175148`: OWNER and ADMIN-assisted whole-listing deletion now fails closed with HTTP 409 before deletion when image metadata points to externally stored bytes (`blob_data IS NULL`). D1 BLOB remains deletable; legacy D1 rows retain the migration-required response. Static repository assets remain separate. Regression verifies both roles leave listing, image metadata, idempotency ledger and audit unchanged when `MEDIA_STRATEGY` is unset.
- GitHub P2 `4310175152`: OWNER availability and reconfirm now use the same per-listing lease as ADMIN-assisted mutations and perform version-conditional D1 updates. ADMIN snapshots use a monotonic `updated_at`; audit and idempotency remain in the same atomic batch. An interleaving regression pauses the ADMIN commit, verifies both OWNER endpoints conflict while its lease is held, then checks the committed row, response snapshot and same-key replay agree with exactly one audit event.
- No R2 was enabled or used. No product behavior outside this bounded lifecycle changed.

## Verification

- `apps/worker`: `npm run test:management` — PASS, 11/11.
- `apps/worker`: `npm run test:contact-workflow` — PASS, 6/6. This ran before the final test-helper-only adjustment; application code was unchanged afterward.
- `apps/worker`: `npm run test:owner` — PASS, 4/4. This ran before the final test-helper-only adjustment; application code was unchanged afterward.
- `apps/worker`: `npm run typecheck` — PASS after the final source/test changes.
- `git diff --check` — PASS before the executable commit.
- Existing A3 evidence remains applicable to unchanged Web code/builds and local OWNER/ADMIN Playwright UI journeys; the focused Worker suites above exercise the changed API/locking behavior.
- No remote database, real identity, paid service, R2, deployment or production data was used.

## Gate

Pre-Critic authorizes one immutable A4 candidate for the exact-head GitHub checks/review and a separate `codex exec` `project_controller` review with requested GPT-6 Luna / High / read-only settings. The Controller must not run tests or write files; local tests above are the test evidence. This is not Controller PASS, merge permission or Preview update approval.

**State: PASS_TO_PUBLISH_A4_FOR_FINAL_REVIEW_ONLY.**
