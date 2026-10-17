# Delegated Controller review — ADMIN PR #15

- Verdict: **REWORK (P2)**
- Reviewed PR HEAD: `18f405cb94f039392cdc5ff1cad23bc46706036c`
- Reviewed tree: `40261e117fff9570e56fe605234ba59ebb131898`
- Canonical base: `59660aed13f68b92b00cae0eced4494b54f2d8a7`
- Reviewer kind: `delegated_codex_separate_process`
- CLI: `codex-cli 0.163.0 exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral --json`
- Process thread: `01a14aa4-d0d5-7500-a98e-d97681d64acd`; turn completed with exit status 0.
- Model/effort/sandbox flags were explicitly passed; selected provider backend identity is **UNVERIFIED**. The process issued repository read commands only. Startup logged an unrelated ignored setting for another project and MCP transport-close errors; local review commands continued and the reviewer returned its verdict. No fallback warning was observed.
- Exact prompt: `CF-AU-I02-ADMIN-CONTROLLER-18F405C-PROMPT.txt` (SHA-256 `28de5e2938df98679646aa94b8e2ce6a0961d0c468c4c6717a4870a3c1f60444`).
- Captured final response: `CF-AU-I02-ADMIN-CONTROLLER-18F405C-OUTPUT.txt` (SHA-256 `0ca23709f71c39299e6085a9d45407985c7646198c0d6bba31e968ca869ad18d`).
- GitHub evidence snapshots supplied to reviewer: `/tmp/cf-au-i02-pr15-current.json` SHA-256 `b2df8d732920e4e547c40966123fcc7d070475e2b094b8ed769de1509a93d800`; issue comments SHA-256 `98dc96693302f98461dd07910342751b789f9cabbf836187fa4173a27bb65cf5`; review comments SHA-256 `edc7f253b92c361ca3fdeb092127b48bab79732f90bea12f9c94f525f0822dd9`.

## Finding

**P2 — Moderation target can change while a decision is in flight.** `AdminReviewView.vue` captured the selected listing before awaiting review/publication, but queue selection and refresh/pagination remained enabled. A moderator could start an action for listing A, switch to B while the request was pending, then see the busy state or success notice next to B. The server correctly acted on A; the UI attribution was ambiguous. The Controller requested disabling selection during `busy` or binding the result to the action target, plus a delayed-response regression.

## Review scope

The Controller inspected ADMIN authorization and Preview-auth guards, queue keyset cursor/index, D1 review/publication batches and audit inserts, legacy-media checks, migration 0009 and regressions, Markdown/JSON parity maps, Vue route/view and OWNER image controls/E2E evidence. It verified that later state/evidence commits did not alter executable behavior after `da15d77`. It identified no other actionable issue in its review. Remote Access E2E remained accurately marked `BLOCKED_AUTH`; the reviewer did not claim remote validation.

This finding was corrected in the subsequent candidate: the queue selector, refresh and load-more controls are disabled while `busy`; a Playwright test delays the approval response, asserts selection is disabled and the original target remains selected, then completes the lifecycle. See `CF-AU-I02-OWNER-PHOTOS-ADMIN-LOCAL-E2E.md`. The REWORK verdict is preserved and is not a PASS; a fresh exact-head Controller review is required.
