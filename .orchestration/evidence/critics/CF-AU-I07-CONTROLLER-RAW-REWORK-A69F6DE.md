## Verdict: REWORK

**P1 — the synthetic provenance guard accepts role-inconsistent listings and audit events.** It checks that a listing’s owner ID belongs to a synthetic user, but does not require that user to have the `OWNER` role. For audit events, it checks that actor and target IDs are synthetic, but does not generally require an `ADMIN` actor, an `OWNER` target, or a target that matches the referenced listing’s owner. Those role checks apply only to assisted-create events. See [preview_cd_guard.py]($I07_ARTIFACT_WORKTREE/scripts/preview_cd_guard.py:231).

The schema and API establish those relationships: the listing schema only has a user-ID foreign key, while moderation routes require OWNER-owned listings and create audit rows from the listing’s owner; admin audit routes require ADMIN authorization. See [0001_core.sql]($I07_ARTIFACT_WORKTREE/apps/worker/migrations/0001_core.sql:1), [0009_admin_audit_shape_and_review_queue_index.sql]($I07_ARTIFACT_WORKTREE/apps/worker/migrations/0009_admin_audit_shape_and_review_queue_index.sql:1), and [index.ts]($I07_ARTIFACT_WORKTREE/apps/worker/src/index.ts:319).

As written, a newly added listing owned by a synthetic ADMIN can pass. An audit event with a synthetic OWNER as actor, a synthetic ADMIN as target, and a listing ID that belongs to another synthetic listing can also pass. Because this guard reports synthetic provenance as verified, it should enforce those relationships before the candidate can pass.

## Required fields

- **REVIEWER_KIND:** `delegated_codex_separate_process`
- **VERDICT:** `REWORK`
- **MODEL_REQUESTED:** `gpt-6-luna`
- **EFFORT_REQUESTED:** `high`
- **CLI_CONFIGURATION_ACCEPTED:** `true` — launcher reports the CLI accepted the requested model, effort, and sandbox flags and exited successfully.
- **ACTUAL_RUNTIME_MODEL_EVIDENCE:** `UNVERIFIED`
- **SANDBOX_REQUESTED:** `read-only`
- **ARTIFACT_SHA:** `a69f6de128b374a7063a8ebe679f19d1665e9e17` (tree `124c60175d39426412f14b68995caba45c30d99a`)
- **CANONICAL_BASE_SHA:** `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`

## Review notes

The two prior findings are repaired in the inspected candidate: unknown audit listing IDs are rejected, reviewed baseline deletion and assisted synthetic creation have positive controls, and `PUBLISHED` now requires `APPROVED`. The guard tests cover the reported status combinations and unknown listing reference.

The JSONL parser selects exactly one Preview record and rejects malformed lines, non-object records, duplicate Preview records, and unknown record types. A nonblocking hardening follow-up: the deployment ID regex accepts any 36-character sequence of lowercase hex digits and hyphens, rather than a canonical UUID; repeated or out-of-order `wrangler-session` records are also accepted. See [preview_cd_guard.py]($I07_ARTIFACT_WORKTREE/scripts/preview_cd_guard.py:378).

The sub-KB formatter handles positive byte sizes, 1 KiB, larger values, and invalid numbers. OWNER and ADMIN E2E assertions check the synthetic 124-byte image display. Screenshot files are present with expected viewport widths; the QA report distinguishes the public captures from reused OWNER/ADMIN captures. I inspected the report, test capture paths, and image metadata, but did not independently reproduce the browser runs.

The later PR checkpoint `a90f202b513eabaccd48b9b5109cda8a8dec05f0` changes only `.orchestration/STATE.md`, `.orchestration/STATUS.json`, and `.orchestration/PRECRITIC-GATE.md`. It points to executable SHA `a69f6de`; its state still needs reconciliation with the live PR head and queued exact-head run. Do not reuse checks from older SHAs.

## Evidence and limitations

- Inspected the Issue #26 contract, checkpoint state, prior Controller findings, provenance manifest, migrations `0001`, `0008`, `0009`, and `0010`, guard implementation and tests, relevant Worker routes, UI formatter changes, QA report, and screenshot metadata.
- **Tests run:** none. The worktree was clean and detached at the stated artifact SHA. No files, refs, branches, issues, PRs, services, or remote resources were changed.
- I did not query GitHub or Cloudflare. The exact-head worker/web run was reported queued at review start; no result is claimed. This review makes no claim of remote verification, launch readiness, or independent trusted-party approval.

**Next step:** require the guard to enforce OWNER listing ownership and action-appropriate audit actor, target, and listing-owner relationships; add negative and positive controls for those cases, rerun the affected checks, then obtain a fresh exact-SHA review.