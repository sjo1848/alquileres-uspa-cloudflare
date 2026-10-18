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

## Follow-up repair evidence (2026-10-18)

- GitHub identified a second pagination race: a new contact can move the older page boundary while the UI refetches each page using stale cursors. Current code updates the confirmed event locally, adjusts the unread count, and refreshes only the aggregate unread count from page one; it no longer rebuilds the displayed rows from shifting cursors.
- Local Playwright loaded older inbox rows, submitted a new synthetic contact concurrently (HTTP 201), changed a page-two row state, and verified that the first-page `Pagina 30` row remained visible. Screenshot: `output/playwright/owner-contact-concurrent-arrival-local.png`.
- This evidence does not convert the earlier Controller REWORK into PASS. A narrow Controller follow-up is still pending after GitHub exact-head checks.

## Subsequent automated-review findings (fixed locally)

After the Controller's page-retention REWORK, GitHub reported P2 findings about worker-first owner and availability/reconfirm routing, the Preview fail-closed guard, and a concurrent arrival shifting pagination boundaries. Fixed by adding `/owner/*`, `/listings/*/availability`, and `/listings/*/reconfirm` to all three `run_worker_first` lists; including `/owner` in the global missing-Preview-auth guard; and updating the confirmed contact row in place rather than rebuilding pages from stale cursors. Current verification: focused Worker tests (2 files / 10 tests), Worker/web typechecks, web build, Python config tests (12/12), local concurrent-arrival Playwright, and whitespace check pass. Latest exact-head CI, automatic review and narrow Controller follow-up remain pending.

The subsequent GitHub pass identified public contact retries without stable idempotency and an outdated Listing parity disposition. Migration 0012 and the UI/Worker now persist and replay the same contact event by key/fingerprint; mismatched key reuse is rejected. Local D1/Worker API replay returned the identical response and ID; changed payload returned 409. Parity maps now include the availability workflow and contact replay schema. Focused Worker tests, typechecks, web build and Python checks passed after these changes; exact-head GitHub and Controller review remain outstanding.
