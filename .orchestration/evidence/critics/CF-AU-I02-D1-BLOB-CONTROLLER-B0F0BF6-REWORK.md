# Separate technical Controller — b0f0bf6 REWORK

- Candidate SHA: `b0f0bf61fc7e1b9d2165c85c5f004f28e5c63504`
- Candidate tree: `1e7cf8f5389a4aea5d326ec13c663431c197a9d6`
- Base SHA: `f17adae431b92a4f66aecda066947b24164eb0e2`
- Invocation: `codex exec --json --ephemeral --ignore-user-config --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only -C /tmp/cf-au-owner-d1-controller-b0f0bf6 -`
- Requested model/effort: GPT-6 Luna / high; CLI settings accepted; fallback/error not observed. Backend identity: **UNVERIFIED**.
- Distinct session/thread: `01a14593-1f40-7510-9501-641e9cf863cb`; process exit: 0; completed output tokens: 6345.
- Read-only observation: reviewer tool calls were source reads (`cat`, `nl`, `rg`); the detached worktree remained `clean`. No tests/builds/network/secrets were accessed by reviewer.
- Decision: **REWORK**, exact final report follows.

## Controller report

**REWORK — P1 test gap.**

Inspected commit `b0f0bf61fc7e1b9d2165c85c5f004f28e5c63504`, tree `1e7cf8f5389a4aea5d326ec13c663431c197a9d6`, against base `f17adae431b92a4f66aecda066947b24164eb0e2`.

The concurrent add/reorder/delete test does not yet provide strong evidence for the requested race behavior. In [owner-d1-blob-media.test.ts](/tmp/cf-au-owner-d1-controller-b0f0bf6/apps/worker/tests/owner-d1-blob-media.test.ts:146), it allows all three requests to return `409`, so it can pass without any concurrent mutation succeeding. If reorder returns `200`, the test still does not verify that the requested order took effect. It checks stored BLOB length and quota totals, but not that surviving BLOB bytes match the uploaded image (lines 154–160). Strengthen the race assertions to cover successful outcomes, their resulting order, and byte integrity.

The inspected upload path bounds the request before decoding, checks decoded dimensions before storage, and batches the BLOB row with its idempotency record; the migration triggers account for BLOB bytes and enforce the aggregate cap. OWNER and editable-status checks guard private image routes; public image reads require approval and publication. Static Assets have a D1_BLOB regression test. The validator decodes JPEG, PNG, and WebP and compares decoded dimensions and RGBA byte length; the tests exercise valid formats and malformed/truncated inputs. I found no material authorization, visibility, or quota defect in the inspected paths.

The Free Worker 10 ms CPU limit remains a follow-up for authorized Preview measurement before product acceptance. The contract’s Node timing is not provider CPU evidence; I found no basis here to treat that uncertainty alone as a blocking local-code defect.

I did **not** run tests or builds. The committed validation evidence names an earlier SHA and was not used as proof for this candidate.

## Exact reviewer input

```text
You are the read-only technical Controller for a bounded local/synthetic implementation review.

Candidate under review: PR #14 exact HEAD b0f0bf61fc7e1b9d2165c85c5f004f28e5c63504
Exact Git tree: 1e7cf8f5389a4aea5d326ec13c663431c197a9d6
Canonical base: f17adae431b92a4f66aecda066947b24164eb0e2
Repository: sjo1848/alquileres-uspa-cloudflare

Review the exact code and tests at this SHA. Do not change files, run tests/builds, use network, or inspect credentials. Return a concise decision: PASS, REWORK, BLOCKED, or HUMAN_GATE, with concrete file/line evidence and severity. PASS means only bounded local/synthetic technical acceptance; it is not remote Preview, product, or release acceptance.

This candidate implements OWNER D1 BLOB photo upload/view/reorder/delete in an existing private Preview flow. Scope: no R2, no new remote resource, no billing, production, real data, source checkout write, or Preview mutation. The task requires the already-authorized existing Preview to be updated only after protected merge and all gates pass.

Prior review outcomes to falsify:
1. The previous separate Controller returned REWORK because signature/header checks accepted malformed/truncated PNG/JPEG/WebP. This candidate adds full WASM decoder validation and browser-side normalization to <=640x480 JPEG. Verify decoder behavior and tests actually reject invalid content before DB mutation/quota, accept valid formats, and enforce server-side dimensions. Consider malformed images that decoders tolerate, worker bundling, concurrency/retry effects, and whether the input and output limits are coherent.
2. GitHub review P1 requested concurrent D1_BLOB add/reorder/delete on the same listing and a dense/loss-free final order. This candidate adds a Promise.all race test. Verify it truly provides meaningful assertions for each permitted outcome, membership, density, blob integrity, usage counter, and does not merely encode one lucky sequence.
3. Existing lifecycle invariants: OWNER-only and own DRAFT/REJECTED mutations; bounded request stream; idempotency replay returns its original result after deletion without recreating bytes; atomic D1 quota accounting; max 20; public bytes only after approval/publication; Static Assets continue working under D1_BLOB; no cross-owner/status leak. Inspect handlers and relevant tests for concrete P0/P1 defects.

Consider Free limits: Cloudflare Workers Free documents 10ms CPU per request. Browser normalization and <=307,200 pixel server check aim to bound the decode; Node wall-time benchmark is not provider CPU evidence. Decide whether this local candidate has an obvious blocking violation or whether remote measurement can remain an explicitly stated follow-up before product acceptance. Do not demand irrelevant exhaustive tests or invent a product decision.

The committed validation evidence file still describes the previous candidate and is stale; do not rely on it as proof for this SHA. Inspect the implementation, tests and contract, and limit the verdict to the exact code/test tree. Fresh execution evidence is recorded separately after this commit; state clearly that you did not run tests. Report material defects only and distinguish nonblocking limitations. State exact SHA/tree you inspected. Do not claim test execution.
```
