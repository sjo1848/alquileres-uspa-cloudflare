# Separate technical Controller — b6d1bc5 REWORK

- Candidate SHA: `b6d1bc5dae177435574d729d768b9bf4bab7e4bc`
- Candidate tree: `31743cc072166eec1994df3be01fa2750c93fa38`
- Base SHA: `f17adae431b92a4f66aecda066947b24164eb0e2`
- Invocation: `codex exec --json --ephemeral --ignore-user-config --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only -C /tmp/cf-au-owner-d1-controller-b6d1bc5 -`
- Requested model/effort: GPT-6 Luna / high; CLI settings accepted; fallback/error not observed. Backend identity: **UNVERIFIED**.
- Distinct session/thread: `01a14595-a118-7bc2-b5cc-1f0fd29666bd`; process exit: 0; completed output tokens: 6347.
- Read-only observation: reviewer tool calls were source reads (`cat`, `nl`, `rg`); the detached worktree remained `clean`. No tests/builds/network/secrets were accessed by reviewer.
- Decision: **REWORK**, exact final report follows.

## Controller report

**REWORK — P1: migrated listings with existing R2-backed image rows cannot use the D1 BLOB lifecycle.**

The migration adds nullable `blob_data` and preserves existing `listing_images` rows ([0007 migration, line 1](/tmp/cf-au-owner-d1-controller-b6d1bc5/apps/worker/migrations/0007_owner_d1_blob_media.sql:1)). D1 reads and mutations filter to `blob_data IS NOT NULL` ([index.ts, lines 141 and 170](/tmp/cf-au-owner-d1-controller-b6d1bc5/apps/worker/src/index.ts:141)), but the existing unique constraint applies to every row’s `(listing_id, position)` ([0001 migration, line 26](/tmp/cf-au-owner-d1-controller-b6d1bc5/apps/worker/migrations/0001_core.sql:26)). Thus a listing with a legacy row at position 0 appears empty to the D1 upload path, which tries to insert at position 0 and hits the constraint; reorder and delete also see a non-dense D1-only order and return recovery errors. Unlike repository-managed images, these rows are not detected before D1 mutations.

Handle legacy rows explicitly for D1 mode—by a defined migration/compatibility path or a clear early conflict—and cover the mixed-row case. The rest of the reviewed paths show owner/editable-status checks, bounded uploads, decoder and pixel limits, trigger-backed quota accounting, immutable upload replay after deletion, per-listing mutation serialization, and approval-gated public BLOB reads.

The 640×480 server cap makes Free CPU usage bounded; measuring actual provider CPU remains a Preview follow-up, not an obvious local blocker. I did **not** run tests or builds.

## Exact reviewer input

```text
You are the read-only technical Controller for a bounded local/synthetic implementation review.

Candidate under review: PR #14 exact executable HEAD b6d1bc5dae177435574d729d768b9bf4bab7e4bc
Exact Git tree: 31743cc072166eec1994df3be01fa2750c93fa38
Canonical base: f17adae431b92a4f66aecda066947b24164eb0e2
Repository: sjo1848/alquileres-uspa-cloudflare

Review exact code and tests at this SHA. Do not change files, run tests/builds, use network, or inspect credentials. Return concise decision PASS, REWORK, BLOCKED, or HUMAN_GATE with concrete file/line evidence and severity. PASS means only bounded local/synthetic technical acceptance, not remote Preview, product, or release acceptance.

This implements OWNER photo upload/view/reorder/delete using D1 BLOB in the existing private Preview flow. Scope excludes R2, new remote resources, billing, production, real data, source repository writes and Preview mutation. An already-authorized existing Preview update can happen only after protected merge and all gates pass.

Previously identified review defects, now corrected in this exact tree:
1. Previous Controller P1: test allowed all three concurrent operations to return 409 and did not check successful reorder effect or surviving bytes. This tree now requires at least one successful mutation; checks exact survivors from outcomes, dense order, requested result if reorder succeeded, byte-for-byte distinct PNG/JPEG/WebP blobs, row byte lengths, and aggregate D1 usage.
2. GitHub P1: stale canonical resume action and stale evidence named old implementation SHA. Local orchestration checkpoint is now updated in the working branch to the correction sequence; the committed code/test tree under review is this exact SHA.
3. Earlier Controller REWORK: MIME/header checks did not prove decodability. Candidate now uses bundled WASM JPEG/PNG/WebP full decode, bounds request and dimensions, rejects invalid/truncated inputs before DB mutation and tests quota/row nonmutation; browser normalizes to JPEG <=640x480 and Worker independently caps pixels.

Also independently inspect lifecycle invariants: owner-only own DRAFT/REJECTED reads/mutations; bounded stream; immutable idempotency replay after later delete without recreation; atomic quota and max20; public bytes only when APPROVED/PUBLISHED; existing Static Assets compatibility; status and authorization isolation. Look for concrete P0/P1 defects, including malformed image decoder behavior or same-listing races. Test suite results are not asserted by this request; do not claim you ran any.

Cloudflare Workers Free documents 10ms CPU/request. Browser normalization and <=307,200 pixel server cap bound the image decode. Node wall-time is only a proxy; remote provider CPU measurement is planned before photo-product acceptance. Decide whether this is an obvious blocking local implementation violation or an honestly bounded remote follow-up. Avoid irrelevant exhaustive tests or invented product decisions.

The committed validation report is stale relative to this SHA. Do not use it as proof; inspect the code/tests/contract only and explicitly state that you did not run tests.
```
