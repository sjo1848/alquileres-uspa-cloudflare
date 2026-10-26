# I07 separate-process Controller finding — workflow-state provenance

- **Reviewer kind:** `delegated_codex_separate_process`
- **Verdict:** `REWORK` (not PASS)
- **Artifact SHA:** `65a59e81f7f3021ae9f21107de1b2c5e4c0c3460`
- **Canonical base:** `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`
- **CLI:** Codex CLI 0.164.0; parent invocation explicitly supplied `--model gpt-6-luna`, `-c 'model_reasoning_effort="high"'`, `--sandbox read-only`, and `--ephemeral`; process exited 0, session `01a17a01-126d-7573-b5cb-a461e31117c1`. The reviewer response itself marked CLI configuration UNVERIFIED because invocation data was not included in its prompt. Actual backend model identity remains **UNVERIFIED**. Tool calls in the captured session were read-only shell inspections; no edits, git ref changes, GitHub writes or Cloudflare actions occurred.
- **Test provenance:** reviewer inspected the files and report; ran no tests/builds. Exact-head GitHub `worker`/`web` PASS and automatic review with no findings had completed on this SHA; the reviewer did not query GitHub. No remote Cloudflare state was read.

## Blocking P1

The provenance guard validated `status` and `publication_status` independently. As a result, `DRAFT/PUBLISHED`, `SUBMITTED/PUBLISHED`, and `REJECTED/PUBLISHED` could pass even though only `APPROVED` can be published. The worker publication transition in `apps/worker/src/index.ts` requires `APPROVED/UNPUBLISHED`.

## Additional evidence gap

The QA report still showed pre-addition test totals and did not state that public captures came from the I07 Playwright run while OWNER/ADMIN screenshots were reused from I06. The next candidate must reconcile counts and capture provenance.

## Repair applied in the next candidate

- Reject `publication_status=PUBLISHED` unless `status=APPROVED`.
- Add negative controls for DRAFT/SUBMITTED/REJECTED published states and a positive APPROVED/PUBLISHED control.
- Reconcile guard test counts to 22/22 and full scripts suite to 47/47.
- Record which screenshots were newly emitted by the current public run versus reused from I06 OWNER/ADMIN captures.

The first finding on audit `listing_id` remains fixed with its own evidence in `CF-AU-I07-CONTROLLER-REWORK-0A5A83D.md`. A final qualified read-only Controller review is still required on the eventual exact candidate SHA.
