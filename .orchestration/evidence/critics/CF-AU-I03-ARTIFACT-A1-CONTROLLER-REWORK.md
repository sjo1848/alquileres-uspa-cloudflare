# CF-AU-I03 Artifact A1 — Controller REWORK

- **Artifact:** `CF-AU-I03-Artifact-A1`, SHA `ccd6902357e797a1bc65706074c7daf37301f50d`, tree `e0afc36eac01ac7b6742a3e2931c667a9b0a4034`.
- **Base:** `a1626e3a375a33bb76561e8666d6bdb070b77de5` (ancestor).
- **Verdict:** REWORK. No P0/P1; two material P2 findings, preserved in raw report.
- **Findings:** (1) ADMIN-assisted create could mark the idempotency row COMMITTED and return 201 even when the listing/audit inserts affected zero rows; (2) parity documentation described R2 as the current image store despite the authorized configs using Static Assets locally and D1 BLOB in Preview.

## Controller runtime record

- Role: delegated `project_controller`, separate `codex exec` process.
- Requested args: `--model gpt-6-luna`, `-c 'model_reasoning_effort="high"'`, `--sandbox read-only`, `--ephemeral`; CLI `0.163.0`.
- Session/thread: `01a14fd2-5460-79b0-8610-359cc2456281`.
- The process streamed read-only file inspections and completed a review response (CLI turn completion reported 931,481 input tokens / 12,455 output tokens). The report text also describes a nested CLI initialization failure. To avoid overclaiming, effective backend/model identity remains **UNVERIFIED**; this result is a REWORK and is not a PASS.
- No tests, writes, GitHub mutations, or remote changes were performed by the reviewer. The invocation flags and process output are not cryptographic model attestation.
- Exact reviewer response: `CF-AU-I03-ARTIFACT-A1-CONTROLLER-REWORK-RAW.txt`.

## Codex repair disposition

1. The last D1 batch transition now commits only when both the expected DRAFT listing and matching ADMIN audit event exist. Any missing insert selects an invalid state rejected by the idempotency `CHECK`, causing D1 batch rollback; the reservation stays PENDING and the caller receives a retryable 503. A focused regression reproduces the zero-row listing insert and verifies no audit row and no COMMITTED result.
2. The parity maps now state the configured strategies truthfully: repository-managed Workers Static Assets locally; D1 BLOB in the private Preview; no R2 binding/use in the authorized configurations. Legacy R2 code remains explicitly labeled outside this deployment.

## Focused validation after repair

- `npm run test:contact-workflow`: 1 file / 6 tests PASS.
- Worker TypeScript check: PASS.
- `python3 -m json.tool apps/worker/docs/postgres-d1-map.json`: PASS.
- `git diff --check`: PASS.

No full suite was repeated. The prior A1 remains immutable and retains its REWORK history; the corrected work will be reviewed as a new candidate/tag. No remote D1 migration, Worker update, Access change, R2 use, spend, production, real-data or source-repository action occurred.
