# Independent internal critique — replay and scheduled recovery (2026-10-15)

Scope: PR #10 local synthetic D1/R2 image ADD, REORDER and DELETE acknowledgment, idempotency replay, compensation, and scheduled reconciliation. Review was static/read-only; reviewers did not execute tests or edit files.

## Findings and repairs

- GitHub P1 `4277515488`: unrelated image mutations could run while a DELETE operation remained eligible for scheduled recovery. `hasPendingDeleteRecovery` now covers `PENDING`, `NEEDS_REPAIR`, `CLEANUP_PENDING`, `COMMITTED`, and `COMPENSATED` with `cleanup_complete=0`. Its exact keyed retry exception is tied to owner, scope, key, fingerprint, and resource image. Regression cases cover successful-delete cleanup and compensated-delete cleanup; they block ADD, REORDER, and another DELETE until scheduled recovery completes.
- GitHub P2 `4277515495`: canonical status pointed at an obsolete candidate and stale next action. Event 45 and `STATUS.json` now name the exact pushed code candidate and pending GitHub review. The later documentation-only state commit is tracked separately from executable code; final review evidence will pin the publication candidate.
- Independent critic P1: `reconcilePendingReorders` also selects a `COMMITTED` reorder whose matching idempotency record remains `PENDING` or `NEEDS_REPAIR`. `hasPendingReorder` now fences that exact scheduler-reopenable state as well as retryable `PENDING`/`NEEDS_REPAIR` operations. Only a same-scope/key/fingerprint retry may pass its own barrier. A focused test verifies ADD, a different REORDER, and DELETE get 503 until the scheduler commits the marker, then verifies deferred mutations resume.
- Independent critic P2 suggestions: add an explicit committed-marker assertion before ADD→DELETE→replay, and keep historical replay from repairing current positions. The HTTP regression now asserts `COMMITTED` before deletion; existing-row ADD replay no longer writes D1 ordering, and committed target-missing DELETE replay returns the stored 200 without repair. Nonhistorical missing-target recovery checks pending reorder work before order/R2 effects.

## Independent review results

- `delete_recovery_audit`: final re-review approved DELETE cleanup barrier and exact-key exception; then identified the missing COMMITTED+pending-marker reorder state (repaired above); final re-review approved the expanded reorder barrier and test.
- `idempotency_replay_audit`: confirmed direct already-COMMITTED ADD→DELETE→same-key replay returns the original body and does not recreate D1/R2; final review approved the barriers and replay paths. It noted optional extra same-key REORDER-before-scheduler coverage, with no concrete defect found.
- `reorder_concurrency`: approved the pending-DELETE barrier and its tested recovery/resume sequence; did not report an actionable P0/P1/P2.

These are bounded internal code critiques, not the delegated Controller verdict. Test execution evidence is recorded separately. Scope remains local synthetic only; no production, merge, paid/remote service, real data, or source-repository write.
