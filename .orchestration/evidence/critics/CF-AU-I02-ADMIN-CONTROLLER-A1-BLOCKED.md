# Controller attempt — ADMIN Artifact A1 (BLOCKED)

- Artifact tag: `CF-AU-I02-ADMIN-Artifact-A1`
- Artifact commit/tree: `254917fbff8495a32f0113da8b0851036b7c1c64` / `40c280bff027c9e3e05efb2c6b42e754375e49ba`
- Code/test commit/tree: `e9e9e0b4808e26980087c5b87f133974477c2e9c` / `0775136cc16240b4e2ace2a2972b6834500722dc`
- Requested invocation: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral --json -`; one retry added `--ignore-user-config` and kept the same model, reasoning, and sandbox.
- Process outcome: **BLOCKED; no valid PASS**. The returned Controller report says its requested review-process initialization failed with `Read-only file system`, exit 1, and that sandbox enforcement was not observed. The separate CLI attempts did not yield a valid bounded technical PASS. Backend model identity is UNVERIFIED.
- File audit found no material code defect in the inspected subset, but found stale wording in this report's source E2E evidence: repeated approval/publication return success and write an audit event per invocation, as asserted by `apps/worker/tests/admin-moderation.test.ts` and implemented in `apps/worker/src/index.ts`. This was an evidence consistency defect, not a reason to change runtime behavior.
- No Human Gate. Remote ADMIN remains `BLOCKED_AUTH`; Preview unchanged.

This record is not a Controller PASS or merge approval. The corrected evidence must be checkpointed as a new candidate and reviewed by a successfully operating read-only Controller process.
