# Separate technical Controller — 757a495 REWORK

- Exact reviewed PR HEAD: `757a495643b708bb54b6b9aac4a4cedf2bb8f0df`, tree `720de4c87bcabe03b33cf7130a83ad9060e4e1c5`.
- Executable parent: `3b012442bf9304743df4aa9c6e3b9f861ac825c7`, source/test tree `50b84899ebd9dc40203ea33a5ffb97ed2f75b168`.
- Base: `f17adae431b92a4f66aecda066947b24164eb0e2`.
- Invocation: `codex exec --json --ephemeral --ignore-user-config --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only -C /tmp/cf-au-owner-d1-controller-757a495 -`.
- Requested model/effort: GPT-6 Luna / high; CLI accepted configuration, no fallback/error observed. Actual backend identity: **UNVERIFIED**.
- Distinct session/thread `01a14695-9871-7ff2-bb89-8ed8f9759676`, process exit 0, completed output tokens 4342.
- Read-only observation: tool calls were Git metadata and file reads only; no network, tests, builds, credential files, or writes. Detached worktree remained `clean`.
- Decision: **REWORK, P1**.

## Controller report

**REWORK — P1, legacy-row fail-closed behavior is bypassed by idempotent replays.**

Git confirms PR #14 HEAD `757a495643b708bb54b6b9aac4a4cedf2bb8f0df` has tree `720de4c87bcabe03b33cf7130a83ad9060e4e1c5`. Its executable parent is `3b012442bf9304743df4aa9c6e3b9f861ac825c7`, tree `50b84899ebd9dc40203ea33a5ffb97ed2f75b168`; the HEAD delta is evidence/state documentation only.

On listings with legacy rows where `blob_data IS NULL`, the upload, reorder, and delete handlers replay a committed idempotency result **before** checking for legacy media. For example, upload returns the stored success at [index.ts](/tmp/cf-au-owner-d1-controller-757a495/apps/worker/src/index.ts:166) before its legacy check at line 171; reorder does the same at lines 220–224, and delete at lines 244–248. A retry can therefore return 201 or 200 instead of the contract’s 409 `LEGACY_MEDIA_MIGRATION_REQUIRED`. Move the legacy check ahead of replay handling for these routes and add tests that seed a legacy row after a successful operation, then retry its original idempotency key. The current mixed-row test does not cover that sequence ([owner-d1-blob-media.test.ts](/tmp/cf-au-owner-d1-controller-757a495/apps/worker/tests/owner-d1-blob-media.test.ts:125)).

The remaining requested behavior is supported by the inspected code/tests: OWNER-only own editable-listing access, bounded upload bodies, decode and pixel checks, atomic BLOB/metadata/idempotency writes, trigger-accounted quota, cap 20, dense reorder/delete, replay without recreating deleted bytes, approved/published public gating, Static Assets compatibility, and same-listing race assertions. Legacy reads/listing paths otherwise fail closed. I found no P0 issue.

The documented 10ms Free CPU limit is **not an obvious local defect** on this evidence: normalization and server pixel bounds constrain work, while provider CPU is unmeasured. Measure it on the already-authorized Preview before photo-journey acceptance.

I inspected files and Git metadata only; I did not run tests/builds or access the network.

## Exact reviewer input

```text
You are the read-only technical Controller for a bounded local/synthetic implementation review.

Candidate under review: exact PR #14 HEAD 757a495643b708bb54b6b9aac4a4cedf2bb8f0df
Candidate tree: 720de4c87bcabe03b33cf7130a83ad9060e4e1c5
Executable application commit: 3b012442bf9304743df4aa9c6e3b9f861ac825c7
Executable source/test tree: 50b84899ebd9dc40203ea33a5ffb97ed2f75b168
Canonical base: f17adae431b92a4f66aecda066947b24164eb0e2
Repository: sjo1848/alquileres-uspa-cloudflare

This is the current pushed PR head with state/evidence updated and no executable changes after 3b01244. Review the exact HEAD and its implementation/test parent. Do not change files, run tests/builds, use network, or inspect credentials. Return concise decision PASS, REWORK, BLOCKED, or HUMAN_GATE with concrete file/line evidence and severity. PASS means bounded local/synthetic technical acceptance only; not remote Preview/product/release acceptance.

Scope: OWNER photo upload/view/reorder/delete using D1 BLOB in an already-authorized private Preview. No R2, new remote resource, billing, production, real data, source repo writes or Preview mutation. Existing Preview update only after protected merge and gates pass.

Prior exact-controller/GitHub findings and fixes:
1. `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-B0F0BF6-REWORK.md`: prior image marker checks accepted invalid/truncated images; now full WASM JPEG/PNG/WebP decode, normalized browser output <=640×480, server cap 307,200 pixels, malformed rejects before D1 writes.
2. Same report: race test could allow all add/reorder/delete to return 409. `b6d1bc5` requires a success and verifies successful order effect, exact survivor membership, distinct byte-for-byte PNG/JPEG/WebP payloads, dense order, lengths and quota.
3. `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-B6D1BC5-REWORK.md`: legacy R2 rows have `blob_data IS NULL` and may collide with D1 position uniqueness or be hidden. `3b01244` now emits HTTP 409 `LEGACY_MEDIA_MIGRATION_REQUIRED` for affected OWNER and public image listing/read/mutation routes without changing legacy rows or accessing R2; mixed-row tests cover the failure path.
4. GitHub P1 stale canonical resume metadata is corrected: STATE/STATUS/evidence point to executable SHA/tree `3b01244/50b8489`, while exact current PR head is this documentation-only child. The historical finding thread is replied to and resolved.

Independently inspect the actual exact code and tests for owner-only own DRAFT/REJECTED access, bounded streams, immutable replay after delete, atomic D1 quota, cap 20, public approved/published gating, Static Assets compatibility, race guarantees, and explicit behavior for legacy rows. Verify no P0/P1 remains. Examine whether the migration conflict is early and consistent enough not to hide or corrupt data.

Cloudflare Workers Free 10ms CPU/request remains a known unmeasured provider limit. Normalization and server pixel bounds constrain work. Decide whether that is an obvious blocking local defect or an explicitly bounded Preview measurement before photo-journey acceptance.

Current evidence ledger is `evidence/CF-AU-I02-OWNER-D1-BLOB-VALIDATION.md`; it lists fresh local focused checks and clearly separates pending GitHub checks/this Controller. Do not claim tests were run by you. Confirm candidate SHA/tree from Git.
```
