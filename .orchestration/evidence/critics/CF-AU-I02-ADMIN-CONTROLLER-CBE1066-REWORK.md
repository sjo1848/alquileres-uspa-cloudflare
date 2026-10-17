# CF-AU-I02 ADMIN Controller — REWORK on cbe1066

- reviewer_kind: `delegated_codex_separate_process`
- requested model: `gpt-6-luna`
- requested reasoning: `high`
- requested sandbox: `read-only`
- CLI: `codex-cli 0.163.0`, separate `codex exec`, exit code `0`
- CLI arguments accepted: `--model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral --json`
- process/session id: `01a14a83-74b2-7ee0-a0c7-1b65734c966f`
- reviewed PR SHA/tree: `cbe1066ef488073ca2ebca297e5eed8a4ad0c616` / `791772e0fc713a0d270012a876ea29ac848547d4`
- executable parent SHA/tree: `3e8b5e8829250a53f52f68dff620f4ef6e4fbef6` / `e43c0644bfffeaaa87a16c21876d1194f45222c2`
- canonical base: `59660aed13f68b92b00cae0eced4494b54f2d8a7`
- result: `REWORK`
- actual backend model identity: `UNVERIFIED`; no provider attestation is claimed.
- observed behavior: repository inspection and GitHub calls were read-only; no file/ref/resource mutation was observed. The CLI emitted a non-project config warning and transient local MCP transport-closed warnings; review completed successfully and retrieved current PR comments. These were not model fallback/configuration errors.
- raw final review SHA-256: `845630b741b501e6738df8a726197ecda3c6f8485881479b3132bc4320c7dc96`

## Exact reviewer request

Review PR head `cbe1066ef488073ca2ebca297e5eed8a4ad0c616`, executable parent `3e8b5e8829250a53f52f68dff620f4ef6e4fbef6`, tree `e43c0644bfffeaaa87a16c21876d1194f45222c2`, and base `59660aed13f68b92b00cae0eced4494b54f2d8a7`. Inspect code, tests, migrations, state and live PR comments. Falsify the five earlier findings covering global audit index, pagination past 100, clearing rejection reason on selection, 401 after ADMIN demotion, and `/admin` Preview-auth fail-closed behavior. Also inspect legacy D1 BLOB safeguards, authorization, atomic audit/state transitions, test provenance and USD 0/no-R2/no-source/no-remote constraints. Do not trust narrative alone. Local evidence supplied: ADMIN tests 6/6, Preview-auth tests 4/4, Worker typecheck, Vue typecheck/build, ADMIN Playwright 11 checks, OWNER D1 BLOB Playwright 9 checks; exact-head GitHub checks passed. The automatic review was running at invocation; inspect its completed result if available. Read-only only; do not spawn agents or mutate anything. Return bounded PASS/REWORK/BLOCKED/HUMAN_GATE with P0/P1/P2 findings and exact provenance. Backend identity must be UNVERIFIED unless independently exposed.

## Reviewer output

## Verdict: REWORK

Bounded local/synthetic technical review of PR head **`cbe1066ef488073ca2ebca297e5eed8a4ad0c616`**, tree **`791772e0fc713a0d270012a876ea29ac848547d4`**. Its parent is executable candidate **`3e8b5e8829250a53f52f68dff620f4ef6e4fbef6`**, tree **`e43c0644bfffeaaa87a16c21876d1194f45222c2`**. The candidate descends from canonical base **`59660aed13f68b92b00cae0eced4494b54f2d8a7`**. The worktree is clean.

No P0 found. Two findings remain:

- **P1 — Audit schema cannot preserve the documented source record shape.** [Migration 0008](</home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/migrations/0008_admin_moderation_audit.sql:1>) requires `listing_id` and `target_owner_id` and omits `entity_type`, nullable `entity_id`, and JSON `metadata`, while the [source mapping](</home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/docs/postgres-d1-map.md:11>) documents those fields for `AdminAuditLog`. This schema cannot represent or faithfully migrate that audit contract. Add the source-shaped fields and JSON validation, or otherwise preserve the documented record shape before treating this as the ADMIN audit store. The current evidence says no historical data was copied, so I found no present data loss; the defect is in the schema’s ability to preserve source audit records.

- **P2 — The moderation queue still scans and sorts listings for every page.** The available listings indexes cover owner/status, publication/availability, and location, but none support the queue’s `created_at DESC, id DESC` ordering. The exact queue query in [index.ts](</home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/src/index.ts:79>) therefore lacks an index for its ordering; the completed GitHub review reports `SCAN l` and `USE TEMP B-TREE FOR ORDER BY`. Add a supporting index or query shape and an `EXPLAIN QUERY PLAN` regression for the queue query. Pagination fixes reachability, but this leaves page reads increasingly costly under D1 limits.

The five earlier findings are addressed in the candidate: the audit test checks the exact joined global query; the queue uses newest-first stable keyset pagination and reaches beyond 100 rows; changing selection clears the rejection reason; DB role revalidation rejects a demoted ADMIN with 401; and Preview-auth availability gates `/admin` before JWT handling. The corresponding focused tests and Playwright evidence are recorded in the [local E2E evidence](</home/sjo1848/dev/alquileres-uspa-cloudflare/.orchestration/evidence/CF-AU-I02-OWNER-PHOTOS-ADMIN-LOCAL-E2E.md>).

OWNER D1 BLOB legacy rows fail closed: read/list and mutations return the migration conflict, including before committed mutation replay; ADMIN queue items are flagged, and approval/publication are rejected. The focused tests cover those cases. Approval/publication status changes and audit inserts use D1 batches; the injected audit failure test confirms rollback.

Local evidence reports ADMIN tests 6/6, Preview-auth tests 4/4, Worker typecheck, Vue typecheck/build, ADMIN Playwright 11 checks, and OWNER D1 BLOB Playwright 9 checks passing. GitHub `worker` and `web` checks both succeeded on the exact PR head. I did not rerun tests. The live automatic review completed on `cbe1066…` and records findings and unresolved threads; the two findings above are from that exact-head review and my inspection.

The reviewed scope is local synthetic: **USD 0, no R2, no source-repository writes, and no remote or production mutation**. No files or refs were changed.

**Requested model:** GPT-6 Luna, High. **Actual backend identity: UNVERIFIED**; I do not claim model attestation or an independently invoked CLI process. This is a bounded local technical review, not external ChatGPT approval or merge authorization.