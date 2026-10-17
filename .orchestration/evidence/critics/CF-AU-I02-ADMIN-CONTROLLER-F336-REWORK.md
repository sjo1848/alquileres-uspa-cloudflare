# Delegated Controller review — ADMIN candidate `f336630`

- Verdict: **REWORK (P2)**
- Exact PR HEAD/tree: `f3366307556b536fa8d90a2572993c84c9ec0c99` / `123981ae2bd053ac9aa618bec231c892015be310`.
- Canonical main: `59660aed13f68b92b00cae0eced4494b54f2d8a7`.
- Reviewer kind: `delegated_codex_separate_process`.
- Parent invocation: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral --json`, CLI version `0.163.0`, terminal session `3298`, reviewer thread `01a14aae-a1c7-7823-8dae-e7e552caf1f3`, process exit 0 / `turn.completed`.
- CLI parameters were explicitly passed and accepted by the process. The reviewer itself stated its interface did not expose argv/session metadata; provider backend identity remains **UNVERIFIED**. It performed repository reads only. Stderr includes transient localhost MCP transport-close errors and an unrelated ignored config for another project; no selected-model fallback was reported.
- Exact prompt, output, full JSONL events and stderr are preserved in the companion files `CF-AU-I02-ADMIN-CONTROLLER-F336-{PROMPT,OUTPUT,EVENTS,STDERR}`. SHA-256 values: prompt `bc8277f03ee0bc3b911d1e93024ba9f16f6da9a8a36557a8894d75735f19b9c1`, output `70545ca1c2ced90fa4bb6fce386247c99a0cc62fd980dc63674448142d8f9a6e`, events `4b46bc14a512e25ad0aaf571d9908a2daf73c5a6455550d69c21e6c4d3744500`, stderr `3918156562ba4e0386919829f3e1feae6cbe2de3a1ff3fbcf51c58e6c7e960c5`.
- Reviewer verified snapshot hashes; worker/web CI succeeded on `39048992611`; merge state was CLEAN. The GitHub automatic review had returned `Unknown error`, so it correctly was not treated as PASS.

## Finding

**P2 — In-flight request test was time dependent.** The prior Playwright regression delayed a response by 500ms but did not synchronize assertion with interception; it checked only the first two queue items. The UI fix itself correctly disabled queue selection, refresh and pagination while busy. The reviewer requested a request-start signal and explicit response release gate, and assertions for all queue buttons.

## Correction and evidence

The regression now signals after the approval request is intercepted and blocks continuation on a promise gate. Before releasing the response it checks every queue button, the refresh button, and the selected target. It releases the request in `finally`, then verifies the existing approval/publication/rejection flow. It also waits for the refresh button to become enabled in the separate session-expiry segment, removing a queue-loading race observed on the populated local DB.

Final local ADMIN Playwright CLI run on synthetic local Worker/D1: **PASS, 12 checks**. Script syntax and `git diff --check`: **PASS**. Evidence is in `CF-AU-I02-OWNER-PHOTOS-ADMIN-LOCAL-E2E.md`. This second REWORK remains a REWORK verdict; a fresh review of the corrected pushed candidate and successful GitHub automatic review are still required.
