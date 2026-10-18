# CF-AU-I03 delegated Controller — REWORK

- Reviewer kind: `delegated_codex_separate_process`.
- Invocation: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json`; requested model `gpt-6-luna`, effort `high`, read-only sandbox. Exact backend identity remains `UNVERIFIED`.
- Codex thread: `01a14ea5-a5f5-7850-83d0-8c013e24ba25`.
- Reviewed executable commit: `e0f87ae398078ff04ce7774738dac90f03ae1296`; tree: `9e06feb19fefd136e4c0336a20bb27be6c9eb9e6`; base main: `a1626e3a375a33bb76561e8666d6bdb070b77de5`. Controller confirmed the later `5a6dff9` checkpoint differed only in `STATE.md` and `STATUS.json`.
- Verdict: **REWORK**. One material P2: after paging the OWNER inbox, changing state called `loadContacts(contactCursor)` with `append=false`, replacing all accumulated pages with the last page.
- Fix/evidence: `OwnerView.vue` now remembers loaded page cursors and refreshes all loaded pages after a state change. Local Playwright added 31 synthetic events via the local Worker, opened page 2, marked its oldest event read, then verified the first-page item remained visible and page-2 event showed `Leída`. Screenshot: `output/playwright/owner-contact-pagination-local.png`.
- Parent verification after fix: web TypeScript check and production build PASS; `git diff --check` PASS. Worker code is unchanged from the 11/11 focused-test candidate. Fresh PR checks and final automated review are required after the fix is pushed.
- Full final reviewer output: `CF-AU-I03-CONTROLLER-REWORK.txt`. The process reported 714,388 input tokens (642,432 cached), 10,386 output tokens. Avoid broad repeat; any follow-up must be restricted to the one corrected UI behavior and exact changed files.
- The report text claimed no separate CLI invocation was available, although the parent did launch this exact `codex exec` process with the flags above. Therefore this verdict is recorded as a delegated REWORK finding, not an operational PASS/approval. No model backend attestation is claimed.

## Subsequent automated-review findings (fixed locally)

After the Controller's page-retention REWORK, GitHub reported two more P2 findings: worker-first routing omitted `/owner/*` in the local, Preview template and OWNER E2E configs; and the Preview configuration fail-closed guard omitted owner routes. Fixed by adding `/owner/*` to all three `run_worker_first` lists and including `/owner` in the global missing-Preview-auth guard. Focused Worker contact + preview-auth tests (2 files / 10 tests), Worker typecheck, web typecheck, Python config tests (11/11), and whitespace check pass. Latest exact-head CI and GitHub auto review remain pending.
