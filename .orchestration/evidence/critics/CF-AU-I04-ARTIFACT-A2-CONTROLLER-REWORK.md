# CF-AU-I04 Artifact A2 Controller result

- Reviewer: `project_controller`, delegated separate Codex CLI process.
- Verdict: **REWORK, material P2** on exact executable SHA `be68f314aaa77b8597c0ab6a5c3d16daaab62e5a`, tree `9c3caaa04cae3e0b54e803e79b3d1bc3b47697f7`; canonical base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- Requested invocation: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json --ephemeral --cd /home/sjo1848/dev/alquileres-uspa-cloudflare`; CLI `codex-cli 0.163.0`, thread `01a15240-a672-7351-9a2b-a1fb41aa62a8`, process output returned with status 0. Model and read-only configuration were requested through the CLI; the review runtime did not attest provider backend identity, recorded as `UNVERIFIED`.
- The reviewer found no P0/P1 and verified dirty OWNER refresh, DRAFT/REJECTED status guards, and the stable owner-scoped cursor.

## Finding

**P2 — stale ADMIN draft responses can cross owner selections.** `loadDrafts()` wrote an asynchronous result into shared page state after the selected OWNER changed; an in-flight load-more request could append results for the prior OWNER. The API remained correctly scoped, but the UI could display the old owner's drafts under the newly selected owner. See reviewer output and line references in `CF-AU-I04-ARTIFACT-A2-CONTROLLER-REWORK-OUTPUT.md`.

## Repair and verification

- `loadDrafts()` now captures owner and cursor, uses a generation token, and applies response/error/loading state only when both generation and owner still match. Changing owner invalidates pending generations.
- Worker code did not change after A2. Worker management tests remain 9/9; Web typecheck, standard build and Preview build pass. Python regressions pass 25/25.
- Fresh local Workerd+D1 Playwright passes 20 named checks and deterministically delays OWNER A's first page while switching to OWNER B; the late A response is discarded and does not populate B's selector. It then confirms 51 A drafts are discoverable across pages.
- Fresh A3 exact-SHA Controller review and GitHub auto review/checks remain pending.

The Controller did not run tests or write files. Prompt, final output and full JSONL are preserved in adjacent `...PROMPT.md`, `...OUTPUT.md`, and `...RAW.jsonl.gz`.
