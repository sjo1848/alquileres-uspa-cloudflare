# Controller runtime and static review — PR #10 candidate cdb8970

Date: 2026-10-14 UTC. Exact candidate `cdb8970ce06fb03d841bd9b2ba32769d78c5629e`; canonical base `91db05fb343d0bc020335bfc05790a2f3f824b82`.

## Startup attempts and successful audit process

Initial invocations with `--model gpt-6-luna`, `model_reasoning_effort="high"`, and `--sandbox read-only` failed before session initialization because the CLI attempted to initialize app-server state on a read-only filesystem. The failure was resolved for the review run by setting an isolated temporary `CODEX_HOME` (with the existing local auth file copied privately), `--ignore-user-config`, and `--ephemeral`, retaining the requested model/effort/sandbox. The actual separate Codex process then started; shell inspection showed commands launched under the read-restricted workspace profile (root access `read`). The review process directly inspected the exact Git objects and evidence and did not run tests or write repository/GitHub state.

## Verdict

`REVIEWER_KIND=delegated_codex_separate_process`
`VERDICT=BLOCKED_MODEL_CONFIG`
`MODEL_REQUESTED=gpt-6-luna`
`EFFORT_REQUESTED=high`
`SANDBOX_REQUESTED=read-only`
`ACTUAL_RUNTIME_MODEL_EVIDENCE=unverified`
`ARTIFACT_SHA=cdb8970ce06fb03d841bd9b2ba32769d78c5629e`
`CANONICAL_BASE_SHA=91db05fb343d0bc020335bfc05790a2f3f824b82`

The separate review process completed a static audit of the requested exact SHA and reported **no P0/P1 identified**. It could not verify actual provider/model identity from available session metadata; under the controller configuration this requires BLOCKED_MODEL_CONFIG and is not a technical PASS. Read-only execution is supported by the requested CLI flag and observed restricted workspace profile; provider-model identity remains unverified. No substitute model was used.

## Reviewed technical paths / nonblocking limits

The Controller examined keyed upload acknowledgment/replay, reorder durable commit confirmation, DELETE logical commit and deferred backup cleanup, scheduled D1/R2 recovery, idempotency/recovery tests and prior evidence. It cited `apps/worker/src/index.ts` around lines 114, 161, 262, and 277, `apps/worker/tests/retry-idempotency.mjs` around line 18, and `apps/worker/tests/http.mjs` around lines 64 and 170. It found no P0/P1 counterexample in the static inspection. Nonblocking limitations: private image GET remains an explicit source-surface divergence; local synthetic tests do not establish remote multi-instance behavior or atomicity across D1/R2.

The validation ledger records fresh local synthetic `npm test` PASS (3557.1 s) on code/test tree `e1b9350`/`5b9fe7d`, which matches the Worker tree at `cdb8970`; it also records typecheck, retry, test syntax, diff and npm audit PASS. The Controller did not execute or independently verify those tests.

## Exact next action

Obtain a supported runtime attestation or delegated `project_controller` invocation that verifies selected model GPT-6 Luna and HIGH effort while retaining read-only, then repeat the exact-SHA review. Until that returns an evidence-backed technical PASS, do not publish Artifact A4. No merge authority is implied.
