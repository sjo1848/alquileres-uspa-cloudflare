# CF-AU-I04 delegated Controller — REWORK

- `REVIEWER_KIND=delegated_codex_separate_process`
- Verdict: **REWORK, P1**.
- Candidate SHA: `284086f4d539d00c9d6685a9f40cc37bae7a6702`; base: `774d0c747e8ecbbdb97776641becbd9e49875875` (ancestor).
- Invocation: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json --ephemeral --cd /home/sjo1848/dev/alquileres-uspa-cloudflare --output-last-message /tmp/cf-au-i04-controller-284086f-last.txt -`; CLI `codex-cli 0.163.0`; process exit 0; thread `01a15226-3fd8-7222-be69-1f4e8823f0c1`.
- `MODEL_REQUESTED=gpt-6-luna`; `EFFORT_REQUESTED=high`; `SANDBOX_REQUESTED=read-only`; CLI accepted the invocation and the reviewer reports a read-only environment. `ACTUAL_BACKEND_MODEL_IDENTITY=UNVERIFIED`; no provider-signed identity is claimed.
- Full machine event stream: `CF-AU-I04-CONTROLLER-284086F-RAW.jsonl.gz`; final reviewer message: `CF-AU-I04-CONTROLLER-284086F-OUTPUT.md`.

## Blocking finding

**P1 — ADMIN availability actions were allowed on noneditable listing statuses.** `PATCH /admin/listings/assisted/:id/availability` and `POST .../reconfirm` did not require DRAFT/REJECTED and their UPDATE predicates omitted the status guard. The assisted UI showed these controls even after SUBMITTED. This exceeds the Task Contract, which bounds assisted management to drafts and rejected listings.

## Other review results

- No P0 was found.
- Prior P1/P2 repairs were verified in source/tests: public detail SPA/API route separation, submitted OWNER refresh, no fresh-key duplicate submit audit, and blocking unsaved ADMIN form actions.
- The reviewer recommended explicit audit row count after duplicate submit; the test was added in commit `4cc4da4` and `test:management` 7/7 passed.
- The reviewer could not query live GitHub PR/CI during its session due network/API errors; the parent separately queried the live PR. It did not run tests or mutate files.

## Repair

Repair the Worker availability/reconfirmation routes with both an early editable-status check and a guarded D1 UPDATE/audit predicate; return 409 and create no receipt/audit for SUBMITTED/APPROVED. Hide those UI controls outside DRAFT/REJECTED. Add negative tests for SUBMITTED and APPROVED, and a Playwright assertion that submitted assisted listings expose no availability controls. Then rerun affected checks and request a fresh review of the final exact candidate.

## Repair completed on the consolidated candidate

- Both handlers reject statuses outside DRAFT/REJECTED before preparing a mutation; each D1 update and audit predicate also requires an editable status, preventing a status race from committing either side effect.
- The ADMIN UI hides these actions for submitted and other noneditable listings. Playwright verifies submitted listings have neither control.
- Worker regressions cover SUBMITTED and APPROVED for both endpoints, require HTTP 409, and verify rejected attempts add no audit rows. A storage-failure regression verifies an unexpected D1 read error surfaces as HTTP 500 rather than an edit conflict.
- On the consolidated code candidate, Worker management tests pass 8/8; Worker typecheck, Web typecheck/build/Preview build, Python regressions (25/25), and local Workerd+D1 Playwright (17 checks) pass. Exact SHA and commands are recorded in `CF-AU-I04-PRECRITIC-FINAL.md`.
