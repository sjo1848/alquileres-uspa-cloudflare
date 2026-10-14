# CF-AU-I01-P2 validation ledger

## Scope and environment

Local synthetic Worker/Hono/TypeScript API with Wrangler local Workerd, actual local D1 and R2 bindings. No remote bindings, Cloudflare account, real data, paid resources, deployment, or source repository writes. Lab baseline: `main@aa84e42d1b43b3e8fc5fbe7a95038a2073217f67`; source GitHub main pin in contract: `267c531f3e3d5869240894063d3a194fa1f9680b`.

Runtime observed: Node 24.18.0, npm 12.0.2, Wrangler 4.149.0. `npm ci --ignore-scripts` installs the lockfile. `npm run local:up` applies local migrations, seeds synthetic owners/admin and starts local Wrangler. `npm test` starts an isolated temporary local persistence directory per process and removes it on exit.

## Verification commands and results

| Command | Result |
|---|---|
| `npm ci --ignore-scripts` | PASS; lockfile install |
| `npm run typecheck` | PASS; `tsc --noEmit` |
| `node --check tests/http.mjs` | PASS |
| `npm audit` | PASS; 0 vulnerabilities |
| `git diff --check` | PASS |
| `npm test` (clean persistence run 1) | PASS; 522.0 s; fresh PID-specific temporary D1/R2 persistence |
| `npm test` (clean persistence run 2) | PASS; 543.7 s; fresh PID-specific temporary D1/R2 persistence |
| REWORK-1 `node --check tests/http.mjs` | PASS after JWT test edits |
| REWORK-1 `npm test` (fresh persistence) | PASS; 636.4 s; PID-specific temporary D1/R2 persistence |

The real HTTP suite exercises source-shaped synthetic login, owner isolation, listing creation, image upload/list/private byte retrieval/reorder/delete, JPEG/PNG/WebP signatures, validation, 20-image cap and 19/20 race, same-listing and cross-listing concurrent operations, D1/R2 consistency postconditions, fault injection and scheduled recovery. It tests both D1 records and R2 object bytes for failure/compensation cases. The executable product Worker exposes no fixture/debug mutation route; fault injection is isolated in `tests/fault-worker.ts` and test config.

## Boundaries and unresolved items

- This is a bounded OWNER draft listing/image slice, not complete application parity or production readiness.
- Private image bytes are served through a lab route whose existence differs from the source Owner route surface; public draft image retrieval is 404. This remains an explicit unresolved source divergence.
- D1 local testing does not establish PostgreSQL advisory-lock equivalence or production multi-instance ordering. Lock/lease and recovery behavior is demonstrated only in this local environment.
- Wrangler local D1 command output observed `meta.duration` but did not expose `meta.rows_read` / `meta.rows_written`; no zero-meter claim is made.
- D1 and R2 cannot form one atomic transaction. The operation ledger and compensation/reaper demonstrate bounded recovery paths, not impossibility of every crash window.

## Exact final full-suite runs

1. Clean persistence run 1: exit 0; `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (522.0s)`.
2. Clean persistence run 2: exit 0; `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (543.7s)`.

Those two baseline suites ran sequentially against distinct PID-specific temporary Wrangler local D1/R2 directories and ports. No failures were skipped or replaced. That statement applies to the A1 baseline package before the REWORK-1 JWT test edits below.

## REWORK-1 JWT regression controls

The first REWORK-1 test process was intentionally interrupted before completion after static review found that the active forged-token control expired after 60 seconds while its assertion occurs later in the long suite. It is not counted as a pass or failure. The control expiration was extended to one hour, the independent security critic re-reviewed the timing/falsifiability, and the complete suite was rerun from a new local persistence directory.

Final REWORK-1 result: `node --check tests/http.mjs` exit 0; `npm test` exit 0; exact output: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (636.4s)`. This run includes an accepted, correctly signed active token for seeded `owner-a`, rejection of an otherwise matching correctly signed expired token, and rejection of same-claims active token with wrong HMAC. No Worker or dependency changed; prior audit remains applicable.

## REWORK-2 — D1 lease release after confirmed operations

The lease cleanup is now bounded and token-fenced: it retries DELETE three times, checks whether the same token still owns the row, and attempts a token-scoped expiry fallback. All cleanup failures are contained within `unlock()` so a confirmed upload/reorder/delete response is not replaced by a cleanup exception. Logging uses a random correlation identifier and does not include listing identifiers or tokens. The local fault harness injects a D1 lock DELETE failure before the effect and after the actual DELETE effect.

HTTP coverage asserts status 201 for both upload faults, 200 for both reorder and delete faults, exact image cardinality, HTTP/D1 id and position agreement, dense positions, R2 byte availability/content, committed/cleaned operation state, lock absence, and a successful follow-up upload after the delete faults. A one-shot delete-effect-loss models the D1 operation succeeding while its caller receives an exception. The tests use actual Wrangler local D1 and R2; test-only fault injection is confined to `tests/fault-worker.ts` and the test config.

- `npm run typecheck`: PASS (`tsc --noEmit`).
- `node --check tests/http.mjs`: PASS after final test edits.
- `git diff --check`: PASS after final test edits.
- `npm audit`: not rerun; dependencies and lockfile are unchanged.
- A preliminary full suite was stopped after independent review identified the need for explicit cardinality evidence; it is not counted as a result.
- A subsequent full suite exposed fixture interference: the new deletion case removed `faultImage`, which later R2 failure scenarios require. The test now selects other rows and asserts that fixture remains. That run is recorded as a failed test, not a pass.
- Final `npm test` on fresh PID-specific Wrangler local D1/R2 persistence: PASS, exit 0, 562.5 s. Exact output: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (562.5s)`.

Independent integrity critique: bounded PASS, static review only, recorded at `critics/CF-AU-I01-P2-REWORK2-INTEGRITY.md`. Token replacement during cleanup was not race-injected; both DELETE and fallback UPDATE match `listing_id` plus token, providing static fencing evidence. The critic did not run the HTTP suite; the runtime result above is separate.

## REWORK-3 — mutation acknowledgment, retry, compensation and recovery

Implementation commit: `21433103e8b8b201a442963401f10dc202b405fc`. Canonical merge commit: `976a670340cc931898492a591c7b066ccdc9a516`, whose second parent is latest `main@be60c4efbe5412d8a5317ba4d200b9a772c0cbd5`. Source repo remained unchanged at pinned source revision; all D1/R2 state was synthetic and local.

The final candidate checks completed successfully:

- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm test` — PASS, exit 0, fresh local persistence; exact output: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (835.4s)`.

The suite includes same-key create/upload/add/reorder/delete retry and changed-fingerprint conflict cases; D1 batch failures before and after effects plus zero-change acknowledgments; R2 compensation/delete failures; operation-state and lock-readback faults; sparse ADD repair; DELETE recovery with failed densification retaining its backup and nonterminal state; and later convergence. Assertions inspect HTTP status, D1 rows/order/operation state, R2 bytes or absence, and follow-up recovery. Existing JWT, isolation, concurrency and local HTTP cases remain in the full suite.

Earlier REWORK-3 full-suite attempts that failed or were stopped during fault-matrix expansion are not counted as passing evidence. They were repaired before the clean final run above. The pre-REWORK-3 results retained earlier in this ledger are historical and are not substitutes for this final run. The run did not use remote bindings or real data. No dependency changed; `npm audit` was not rerun for REWORK-3.

Independent reviews and scope limits: `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md` reports the final bounded internal security/integrity critique with no concrete residual P0/P1. GitHub automatic Codex review of PR #10 at `976a670340cc931898492a591c7b066ccdc9a516` completed without code suggestions (PR review submitted 2026-10-13T17:47:32Z). The separate configured `project_controller` review remains required on the exact frozen artifact; it is not represented here as completed. No claim of remote Cloudflare behavior, PostgreSQL advisory-lock equivalence, complete parity, or atomic D1/R2 dual writes is made.

### Consolidated REWORK-3 candidate after Controller and internal rework

The `835.4s` result above belongs to the earlier `2143310` implementation candidate. It is retained as history and is **not** the final verification for this candidate. The configured delegated Controller reviewed `98cec68d81c7f80a7371ec5d60c80467d1cee476` and returned REWORK with a P1 concerning DELETE acknowledgment after D1 target removal but ignored survivor compaction. That finding and repair are detailed in `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`.

After the Controller review, subsequent full-suite attempts exposed and fixed test/runtime issues. One run reached an expired synthetic login cookie; the test-only `JWT_EXPIRES_IN` was raised to two hours in `wrangler.test.jsonc` (production defaults and explicit JWT expiration/forgery controls are unchanged). A later run exposed reassignment of the test's operation record and loss of its `.id`; this was fixed by retaining the immutable operation ID. These attempts are historical and are not counted as final passes.

Final current-candidate checks, after all code changes and independent internal re-critiques:

- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm test` — PASS, exit 0, clean PID-specific local D1/R2 persistence; exact output: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (797.1s)`.

The final suite adds DELETE target-absent replay coverage for R2 HEAD errors before/after effect, proves those errors return 503 and preserve `NEEDS_REPAIR` plus the recovery backup, gates sparse-order list reads with 503, then verifies same-key acknowledgment and scheduled recovery to dense order, backup cleanup and `CLEANED`. The `798.4s` run passed an intermediate fix before these final tri-state/read-gate cases and is not the final result. Dependencies did not change; `npm audit` was not rerun.

### GitHub automatic review and final reorder-replay repair

GitHub's automatic review of candidate `d4445c2af1abbfef813f0f8e06b630c4e981cf4e` completed at 2026-10-13T19:19:37Z. It identified that a committed idempotent reorder was checked only after current cardinality validation, so deleting a different image could make a same-key retry return 400 instead of its stored result. The fix moves the matching `COMMITTED` replay ahead of list cardinality validation, validates the stored response is an array, and preserves owner checks, request fingerprint checking, and the listing lease. A regression case performs a real three-image reorder, deletes another image, retries with the now-out-of-range position, and verifies the historical response plus unchanged dense D1 state. Review thread: `https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/10#discussion_r4262996076`.

Independent `p2_security_integrity_critic` then found a related P1 on the no-op reorder path: the handler swallowed an idempotency COMMITTED-write failure and still returned 200, permitting a later same-key retry to apply after intervening state changes. The no-op path now only returns 200 if its owner/scope/key/fingerprint/state-fenced D1 update reports one changed row or a readback proves the exact matching COMMITTED result; otherwise it returns 503. Test-only `idem-commit-before` and `idem-commit-after` controls cover failure before and after D1 effect. HTTP tests verify 503 + PENDING on pre-effect loss and a later retry, and verified 200 + COMMITTED on post-effect loss followed by a cardinality change and exact replay.

Two independent read-only re-critiques (`p2_postfix_critic`, `p2_security_integrity_critic`) found no remaining P0/P1 or material blocker in the reorder replay repair. Their exact bounded verdicts and the optional follow-up note are in `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`. The first two complete-suite attempts on these added tests were intentionally stopped during subsequent adversarial review/test-strengthening and are not counted as passes. Final latest candidate checks:

- `npm run typecheck` — PASS.
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm test` — PASS, exit 0, fresh PID-specific local D1/R2 persistence; exact output: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (891.9s)`.

This final run includes the new before/after idempotency-record faults, real reorder replay after deletion, D1 state/HTTP assertions, and all prior JWT, isolation, concurrency, R2/D1 compensation and scheduled-recovery cases. No dependency changed. A fresh GitHub automatic review has been requested on commit `a7cbd8087576c3229267c5d60c2326eb0e08ceb2`; its state is recorded in canonical status and must be resolved before freezing an artifact.

### DELETE dense-order acknowledgment and confirmed replay rework

GitHub automatic review on `a7cbd80` completed at 2026-10-13T19:45:17Z and identified two findings:

- P1: after D1 removed the target but failed survivor compaction, the handler returned 200 while image-list GET remained 503 and recovery was pending. The handler now returns 503, keeps the operation/idempotency state repairable, and only acknowledges after exact dense order is established and a same-key retry confirms the result. If repair marker writes themselves are ignored and stale `COMMITTED` values remain, replay performs a fresh dense-order check before any success.
- P2: an already-confirmed same-key DELETE replay rechecked R2 HEAD and could turn a durable 200 into 503 on transient R2 errors. A matching committed idempotency record and terminal/cleanup-pending DELETE operation now replay 200 only after current D1 order is confirmed dense; R2 backup cleanup remains reaper work.

The independent security/integrity re-critique found a deeper P1: the original atomic D1 batch can write `COMMITTED` markers even when a trigger ignores survivor compaction; subsequent `NEEDS_REPAIR` marker writes can also be ignored. A later replay must not trust stale markers while order is sparse. The replay shortcut now requires `orderIs(...)`; if false it attempts bounded repair and remains 503 if density cannot be proven. HTTP tests inject ignored compaction and ignored operation/idempotency repair-state updates, prove stale COMMITTED markers still return 503, then remove the faults, run scheduled recovery to dense order/backup cleanup, and confirm same-key success. The same fixtures test R2 HEAD before/after errors on uncommitted repair and confirmed replay without R2 reads for already-committed requests.

Both independent internal reviewers re-reviewed the final behavior and found no remaining P0/P1 or material blocker; they did not run tests. The final fresh local test run after these changes is:

- `npm run typecheck` — PASS.
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm test` — PASS, exit 0; exact output: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (828.8s)`.

Final code commit is `37e9860170e0958e4ab5b9bfef0e8b82f2e2bad1`, preserving A1–A3 ancestry on PR #10. A fresh GitHub automatic review has been requested for this SHA; no A4 is frozen or tagged while it runs and while the delegated runtime-verification block remains unresolved.

## Consolidated REWORK-3 — GitHub JWT-secret finding and D1/R2 retry audit (2026-10-14)

The latest GitHub automatic review of the previously pushed merge head `2ccaaef627bfedcca0f08a3914228a68043160d1` found a P1: missing `JWT_SECRET` became an empty HMAC key. The implementation now rejects missing or fewer than 32 UTF-8-byte secrets before signing or `/listings/*` verification; login/private API return 503 when the binding is misconfigured. Tests cover absent secret, empty configured secret plus an empty-key signed token, and a 31-byte secret. The test-only fault worker strips/overrides the binding and is not selected by `wrangler.jsonc`.

The broader image-mutation audit also closed retry/concurrency/recovery gaps: keyed upload and reorder acknowledgments require durable matching replay records; original reorder plans survive partial D1 writes; another mutation cannot invalidate a pending order; exact `(scope, key)` matching prevents same-text-key bypass; committed historical replay is resolved before gates/current-cardinality checks; add compensation and delete cleanup verify R2 absence; resolved-no-op deletes cannot remove D1 metadata; terminal compensation has an explicit `cleanup_complete` state for reaper fairness. Focused trigger and HTTP checks assert durable D1 rows/order, response status, R2 bytes/absence, retry result and scheduled convergence.

Implementation candidate commit: `408ea30a51bb74a3fc4eab27037292edd9f4f03a`, pushed to PR #10 without modifying main or rewriting the A1–A3 ancestry. The test run was against the identical `apps/worker` source/test tree immediately before that commit:

- `npm run test:retry` — PASS: `PASS focused keyed upload/reorder ignored-marker and historical-replay checks`.
- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm audit --audit-level=high` — PASS, 0 vulnerabilities.
- `npm test` — PASS, exit 0, fresh PID-specific Wrangler local persistence, `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (1243.5s)`.

Runtime versions: Node `v24.18.0`, npm `12.0.2`, Wrangler `4.149.0`. All data and D1/R2 operations were local synthetic fixtures. No remote Cloudflare bindings, paid services, deployments, real data or source-repository writes occurred. The first full-suite process was stopped after the new GitHub P1 was discovered and is excluded. Independent internal reviewers found no remaining P0/P1 in the revised auth, reorder, upload/delete and reaper paths; their reviews were read-only and did not substitute for execution.

GitHub automatic review of `408ea30` has been explicitly requested and is pending at this ledger update. No exact-SHA Controller verdict or Pre-Critic PASS is claimed here; publish neither Artifact A4 nor a review boundary until GitHub review completes, exact-SHA delegated Controller review returns technical PASS, and the final Pre-Critic gate is refreshed.

## Consolidated candidate after GitHub reorder-recovery findings (2026-10-14)

GitHub automatic review on `408ea30a51bb74a3fc4eab27037292edd9f4f03a` completed and identified two findings: abandoned `PENDING` reorder reservations could indefinitely block mutations if the original client never retried (P1), and the documented default `npm test` omitted `tests/retry-idempotency.mjs` (P2). The current candidate adds migration `0004_reorder_recovery.sql`, stores a listing association and retryability state for reorder operations, and runs a scheduled reconciliation that obtains the listing lease, validates the exact reserved plan and image set, converges to the saved dense order, and confirms both operation and idempotency records. If the image set makes replay impossible, the old operation becomes `NEEDS_REPAIR` and nonretryable; it no longer blocks other mutations and the same key receives 409. The default `npm test` now runs focused replay checks followed by the full HTTP suite.

The first full-suite attempt found a test-visible recovery gap: when D1 ignored only the operation marker update, the idempotency result update was conditioned on the operation marker already being `COMMITTED`, so it remained `PENDING`. The condition was corrected to require the exact matching operation reservation with `retryable=1`, plus the same live lease and exact dense-order guard. This allows either durable marker to be independently recorded under the verified D1 postcondition, and a subsequent retry or scheduled reconciliation repairs the missing counterpart. `confirmReorderOperation` also verifies `retryable=1` on readback. The failed first attempt is excluded from pass evidence.

Final checks on the current worktree:

- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm run test:retry` — PASS: `PASS focused keyed upload/reorder ignored-marker and historical-replay checks`.
- `npm test` — PASS, exit 0, fresh PID-specific Wrangler D1/R2 persistence; the default command ran `tests/retry-idempotency.mjs` and then the full HTTP suite: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (1122.2s)`.
- `npm audit --audit-level=high` — PASS, 0 vulnerabilities (run before this latest source-only recovery delta; dependency files unchanged).

The HTTP tests exercise successful stale-plan reaper convergence, retained exact historical replay, invalidated-plan retirement and nonblocking behavior, same-key rejection, competing-mutation barriers, and the ignored-marker idempotency/operation repair path. Local synthetic fixtures only; no real customer data, remote bindings, payment, deployment, source repository changes or merge. Canonical `main` was fetched and verified at `91db05fb343d0bc020335bfc05790a2f3f824b82`, an ancestor of the existing PR branch. Internal read-only specialists independently reviewed the reaper, D1/R2 saga/retry behavior, and cross-cutting runtime/security; no P0/P1/P2 was found after the final marker-predicate adjustment. Their reviews did not run tests.

This is validation for the current candidate only. GitHub automatic review of the next pushed SHA and the separate `project_controller` process review of that exact SHA are still required; no Artifact A4 or technical PASS is claimed at this ledger entry.

## Verification of reservation/reaper recovery delta (2026-10-14)

Exact tree: `5b9fe7d5e6ea756f94267f321cbf12b61805bc8d` (local checkpoint commit, source/tests are in `e1b935042e044a7f32f21b08f09463b866902fe7`; no source change after the test tree). Canonical base remains `origin/main@91db05fb343d0bc020335bfc05790a2f3f824b82`.

The delta closes the latest automated-review/Controller findings: scheduled reorder recovery applies the stored ID order explicitly; paired reservation insertions are read back and incomplete newly created halves are compensated; same-key recovery can reconstruct an absent idempotency row from its durable operation; scheduled recovery reconstructs legacy operation-only reservations; retirement is retried/read back and repairs terminal idempotency state; a matching pending/repair record with a NULL `result_json` is filled only from its durable operation plan. Mismatched fingerprints, non-NULL plans, committed rows and terminal rows are never overwritten. New HTTP cases cover exact reaper order, missing/ignored records, ignored operation retirement, ignored idempotency retirement and later convergence/replay.

Checks on the exact tree:

- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `git diff --check` — PASS.
- `npm run test:retry` — PASS: `PASS focused keyed upload/reorder ignored-marker and historical-replay checks`.
- `npm test` — PASS, exit 0; runs the focused suite then fresh PID-specific local Wrangler HTTP/D1/R2 suite: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (3557.1s)`.
- `npm audit --audit-level=high` — PASS, 0 vulnerabilities.

Runtime: Node `v24.18.0`, npm `12.0.2`, Wrangler `4.149.0`. All bindings, data, and R2 objects were local synthetic fixtures. Intermediate full-suite attempts exposed and repaired: an inherited NULL `result_json` retirement path; test helpers referenced before declaration; nondeterministic concurrent fixture setup; and a duplicate synthetic request key. Those runs are excluded. One prior run was intentionally interrupted at the Human's pause request and is not counted. The final full run above passed.

Independent reviewers rechecked the final recovery paths: reorder/idempotency/concurrency, D1/R2 saga/integrity, and auth/runtime. They found no actionable P0/P1/P2; they did not modify code or execute tests. Their full exact-tree review notes are appended to `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`.

This verification is local evidence only. GitHub automatic review and a fresh separate-process `project_controller` GPT-6 Luna High read-only review on the frozen exact candidate remain required. Artifact A4 is not yet published; no merge, deployment, paid service, real data or source-repository write occurred.

## GitHub ADD/DELETE ignored-write findings — local rework validation (2026-10-14)

GitHub automatic review on prior PR head `e07241a53635ed9b6f605f5b53ff589d92a8a15f` reported two P2 cases: (1) an ignored guarded ADD insert could leave a committed replay marker despite compensating the R2 object, and (2) an ignored guarded DELETE could leave a committed marker after restoring the R2 object. The Worker now guards ADD operation/idempotency commits on the exact expected D1 image row. DELETE commits additionally require target-row absence and all survivor positions to be within the dense ordinal range. HTTP regressions cover each ignored-write trigger, 503/409 responses, PENDING/COMPENSATED states, R2 restore/removal and successful same-key retry.

One first full-suite attempt stopped at an older DELETE repair-marker fixture assertion that expected COMMITTED markers. Under the new dense-order commit guard, the correct observed state is PENDING until dense recovery succeeds. The test expectation and description were corrected; application code was unchanged in that adjustment. That failed attempt is retained as rework evidence and excluded from pass claims.

Fresh verification after the correction:

- `npm test` — PASS, exit 0; focused replay suite followed by full HTTP suite against fresh local synthetic Wrangler D1/R2 persistence: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (1224.6s)`.
- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `node --check tests/retry-idempotency.mjs` — PASS.
- `git diff --check` — PASS.

This remains local/synthetic verification, not a remote runtime claim. Independent reviewers are rechecking the exact current worktree. Fresh GitHub automatic review and a distinct `project_controller` GPT-6 Luna/High/read-only review on the resulting exact pushed SHA remain required. No Artifact A4, technical PASS, merge, deployment, paid service, real data or source-repository write is claimed.

## ADD exact-order acknowledgment finding and recovery proof (2026-10-14)

Independent concurrency critique found an additional P2: keyed ADD could mark its operation/replay row COMMITTED when an AFTER INSERT effect left sparse positions, before the later postcondition check failed. Repairs now make both COMMITTED statements require the exact expected D1 row count and each expected `(id, listing_id, position)`. The request fails closed unless it can restore and read back that exact order. Same-key replay and scheduled recovery restore density while preserving a later valid order, so retrying an older upload does not undo an intervening reorder.

The regression injects a sparse position after INSERT and blocks its repair. It asserts HTTP 503, operation `NEEDS_REPAIR`, idempotency `PENDING`, retained R2 bytes, and another 503 on same-key replay. After the update trigger is removed, scheduled recovery restores dense D1 order and marks the operation COMMITTED; same-key replay returns 201 and confirms idempotency without losing R2 bytes.

An early complete-suite attempt exposed only a test fixture issue: its repair-blocking trigger also suppressed the trigger meant to create the sparse position. The trigger was narrowed to block updates only after position 7 existed. The next run then reached the new case and all recovery assertions passed, but test helper declaration order caused a `ReferenceError` at the last redundant D1/R2 assertion; this was replaced with a direct HTTP read and byte comparison. These attempts are excluded from the final pass.

Final fresh local verification after source and test changes:

- `npm test` — PASS, exit 0, focused idempotency checks plus full local Wrangler HTTP D1/R2 suite: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (1188.1s)`.
- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `node --check tests/retry-idempotency.mjs` — PASS.
- `git diff --check` — PASS.
- Separate `npm run test:retry` — PASS: `PASS focused keyed upload/reorder ignored-marker and historical-replay checks`.

Three independent read-only critics (ADD/order concurrency, D1/R2 saga recovery, and prior auth/runtime track) found no remaining actionable P0/P1/P2 in their reviewed scopes. They did not edit code or execute tests. All tests used local synthetic D1/R2 only. Fresh GitHub automatic review and exact-SHA GPT-6 Luna/High/read-only Controller review are still outstanding; no technical PASS or A4 is claimed.

### Superseding exact-candidate replay repair — 2026-10-14

GitHub automatic review on `6a4581b71910ec0862b2ec793f8699b572384d15` identified a P2: replaying a confirmed ADD after a later confirmed DELETE returned 503 because its D1 metadata no longer existed. The route now recognizes an owner-, scope-, key-, and fingerprint-matched `COMMITTED` record with absent image metadata, validates the stored historical result, confirms the exact idempotency marker, and returns the original `201` without restoring D1 or R2. A new HTTP regression uploads, deletes, retries the identical upload, compares the complete original response, and verifies D1 absence and image GET 404 after replay.

Three independent read-only reviews (`review_idempotency`, `review_recovery`, and `reorder_concurrency`) inspected the new path and equivalent reorder/delete replay paths. All found no actionable P0/P1/P2. They did not edit files or run tests. `review_recovery` noted only that stored result-shape validation is narrower than a complete DTO check; the JSON is internally generated and bound by exact request fingerprint and committed marker, so it was not assessed as actionable.

Verification on the consolidated source/test candidate:

- Focused `npm run test:retry` — PASS: `PASS focused keyed upload/reorder ignored-marker and historical-replay checks`.
- `npm test` — PASS, exit 0, fresh PID-specific Wrangler local D1/R2 persistence; focused retry plus complete HTTP suite: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (1284.7s)`.
- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `node --check tests/retry-idempotency.mjs` — PASS.
- `git diff --check` — PASS.

No dependencies changed. The full suite used synthetic local Workers/D1/R2 only; no paid, remote, production or real-data resource was used. Fresh GitHub automatic review and exact-SHA Controller review remain required; this evidence is not a technical PASS or Artifact A4 publication.


## Exact candidate review boundary — `cdb8970` (2026-10-14)

GitHub automatic review of PR #10 candidate `cdb8970ce06fb03d841bd9b2ba32769d78c5629e` completed at `2026-10-14T15:11:59Z`; no new review suggestions or comments were posted for the run. Older comment threads were distinguished by their original commit and creation time.

A separate `project_controller` run was attempted twice with requested `gpt-6-luna`, HIGH reasoning, and read-only sandbox. Both failed before reviewer initialization because the CLI could not initialize its app-server under the read-only filesystem (`os error 30`). No code review, verdict, or test execution occurred in that process. Model backend identity and sandbox enforcement remain unverified; exact details are in `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`. Consequently no technical PASS or Artifact A4 is claimed.


## Separate Controller static audit — exact SHA `cdb8970`

The separate CLI Controller completed read-only static inspection of exact candidate `cdb8970ce06fb03d841bd9b2ba32769d78c5629e` against canonical `main@91db05fb343d0bc020335bfc05790a2f3f824b82`; it reported no P0/P1 identified in inspected paths. It did not run tests. It returned `BLOCKED_MODEL_CONFIG`, because actual provider/model identity could not be verified from session metadata even though the CLI was invoked with `--model gpt-6-luna`, `model_reasoning_effort="high"`, and `--sandbox read-only`. Read-only inspection ran under the restricted workspace profile. Prior test results remain recorded provenance, not reviewer-executed tests. No technical PASS or A4 is claimed. Full attempt and review details: `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`.


## Superseding exact-SHA Controller verdict — `cdb8970`

The delegated separate-process Controller reviewed exact candidate `cdb8970ce06fb03d841bd9b2ba32769d78c5629e` against canonical `main@91db05fb343d0bc020335bfc05790a2f3f824b82` and returned **PASS for the bounded local technical review**, with no P0/P1 found in its static audit. Its session `turn_context` verified `model=gpt-6-luna`, `effort=high`, and `sandbox_policy.type=read-only`; provider/backend identity remains without cryptographic attestation. It did not run tests. It confirmed source/test tree hashes match the tested `e1b9350` / `5b9fe7d` tree; `npm test` is recorded PASS in 3557.1s with synthetic local Wrangler D1/R2 and the other verification commands listed above. The Controller’s exact verdict, paths and limits are in `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`. The earlier runtime BLOCKED attempt is superseded; no Artifact A4 is yet tagged.

## Latest automatic-review rework — recovery log privacy and retired NULL replay repair (2026-10-14)

GitHub automatic review of exact candidate `30c126e516f223dd798e448b68a757a08a2a8bfd` identified two P2 findings. First, four scheduled reorder recovery warnings logged the caller-controlled `Idempotency-Key`; these now emit only static event names. `tests/retry-idempotency.mjs` adds a source regression guard against `request_key` or `operationId` in those recovery error logs. Second, a retired `NEEDS_REPAIR/retryable=0` operation could strand a matching PENDING idempotency row whose `result_json` was NULL. Retirement repair now fills only NULL (or already-identical) result data for a matching fingerprint and recoverable state, and verifies exact state/result afterward. A new HTTP case seeds this legacy state, invokes scheduled recovery, checks the copied operation plan, and proves same-key replay reaches terminal 409 rather than permanent 503.

Independent read-only re-review by the auth/runtime specialist confirmed recovery logs no longer contain client-controlled values; remaining operation IDs are generated internally. A separate D1/R2 saga/recovery specialist confirmed the conditional NULL repair, exact readback, terminal replay result, and regression case. Both found no P0/P1/P2; reviewers did not edit or execute tests.

Verification after both changes:

- `git diff --check` — PASS.
- `npm run typecheck` — PASS (`tsc --noEmit`).
- `node --check tests/http.mjs` — PASS.
- `node --check tests/retry-idempotency.mjs` — PASS.
- `npm run test:retry` — PASS: `PASS focused keyed upload/reorder ignored-marker and historical-replay checks`.
- `npm test` — PASS, exit 0, fresh PID-specific local Wrangler D1/R2 persistence; focused suite plus full HTTP suite: `PASS local Wrangler HTTP D1/R2 slice: lifecycle, 19/20 cap race, 10 repeated same-listing add/reorder/delete races, isolation, validation, D1/R2 fault compensation and scheduled recovery (1366.7s)`.

No dependencies changed; the prior `npm audit --audit-level=high` result remains applicable. Tests use only synthetic local D1/R2 and Worker bindings. This is not remote Cloudflare, production, full parity, or atomic D1/R2 evidence. These two findings are resolved locally; fresh GitHub automatic review and separate GPT-6 Luna High read-only Controller review are still required on the final evidence candidate. No Artifact A4 is yet published.
