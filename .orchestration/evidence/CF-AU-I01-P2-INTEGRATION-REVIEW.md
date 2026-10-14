# CF-AU-I01-P2 Integration Review

Scope: `.orchestration/contracts/CF-AU-I01-P2.md`, local Worker/Hono/TypeScript application under `apps/worker`, actual Wrangler local D1/R2, source mapping ledger and final validation ledger.

| Acceptance area | Evidence / disposition |
|---|---|
| Reproducible local setup and actual bindings | `apps/worker/README.md`, `wrangler.jsonc`, `wrangler.test.jsonc`, migrations, validation ledger. No remote bindings. |
| Auth/session and two-owner isolation | HTTP tests cover login, DB role revalidation, Owner A/B and ADMIN, expired/malformed/forged tokens, valid Bearer and CSRF/origin behavior. Independent security review bounded PASS. |
| Listing/image journey and source DTO | HTTP tests exercise create draft, upload/list/private read/reorder/delete, validation, image types, body/size/count limits and response mapping. |
| D1 schema constraints and dense order | Migration plus tests for FK/unique constraints, duplicate position, 0-based dense ordinals and list-specific mutations. |
| Actual R2 bytes | Tests read image bytes through Worker and inspect local R2 objects for missing/compensated cases; no mock storage substituted for acceptance. |
| 20-image limit and concurrency | Exactly one success expected at 19/20; ten repeated same-listing add/reorder/delete races and ten two-listing races with D1/API/R2 postconditions. |
| D1/R2 failures and retry/recovery | Fault worker injects before/after effects; tests cover D1 insert/delete failure, R2 put/delete failure, restoration failure, orphan reconciliation and scheduled cleanup. Independent integrity review bounded PASS. |
| Source mapping and scope | `apps/worker/docs/postgres-d1-map.{md,json}` maps five source entities; only slice tables operational. ContactEvent/AdminAuditLog remain unimplemented. |
| Operational observability | Correlation-only structured errors; no PII/secrets. Local CLI did not expose rows_read/rows_written, so those meters are not claimed. |
| Static/dependency checks | Exact final commands/results in validation ledger. |

## Material limits

The result is an executable local synthetic P2 slice, not full application parity, production readiness, remote Cloudflare behavior, PostgreSQL lock equivalence, or proof of atomic D1/R2 writes. The private Owner image byte route is an explicit unresolved source-surface divergence; public DRAFT image reads are rejected. Recovery paths are bounded and demonstrated, while arbitrary crash/timing behavior cannot be called atomic. Unimplemented source entities remain unmigrated.

Integration disposition: **candidate meets the bounded P2 technical contract for external review**, subject to the exact final test results in the validation ledger. This review is not a self-issued external PASS.

### Consolidated REWORK-3 review after delegated Controller feedback

The delegated Controller reviewed the prior candidate `98cec68d81c7f80a7371ec5d60c80467d1cee476` and returned REWORK. Its P1 on ignored survivor compaction after a committed DELETE was repaired with an explicit `RAISE(IGNORE)` HTTP/recovery case. Two subsequent independent internal security/integrity critiques identified and then closed additional risks: treating failed R2 HEAD as confirmed absence, and exposing sparse image ordinals through GET. The implementation now retains `NEEDS_REPAIR` and its backup on uncertain HEAD, returns 503 while image order is sparse, and allows same-key replay plus scheduled recovery to converge. Detailed critique history and dispositions: `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`.

Final integration evidence is the current validation ledger's fresh full-suite result (797.1s), typecheck, HTTP test syntax and whitespace checks. Both latest internal critics found no remaining P0/P1 in the bounded failure/acknowledgment/retry/compensation/recovery class; their review is static and independent of the runtime suite. Prior GitHub automatic review at `976a670` is stale relative to this candidate, so it does not count as final review evidence. Material limitations remain unchanged: local synthetic bindings do not establish remote multi-instance behavior, arbitrary crash-window elimination, atomic cross-service writes, full product parity, or production readiness.

Integration disposition: **Pre-Critic candidate only**. Await fresh GitHub automatic review and delegated read-only Controller review on the exact current frozen SHA. No substantive PASS is claimed here.

### Final idempotent reorder retry and acknowledgment correction

GitHub automatic review on `d4445c2` identified replay after current cardinality validation. The fix returns a stored matching committed result before that validation and adds a true reorder/delete/replay case. Independent integrity critique additionally found a P1 where the no-op reorder path could ignore failure to persist the idempotency `COMMITTED` result while returning 200. The handler now acknowledges only after a row-count-confirmed fenced write or exact committed-result readback; otherwise it returns 503. Before/after fault injection checks HTTP, idem state, subsequent retry/replay, and current dense D1 order. Both independent final reviewers found no remaining P0/P1/material blocker for this slice; review record is in `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`.

Latest current candidate verification is the full fresh local HTTP suite PASS at 891.9 seconds plus typecheck, syntax and diff-check, recorded in the validation ledger. GitHub automatic review was requested on code commit `a7cbd8087576c3229267c5d60c2326eb0e08ceb2` and was RUNNING at the last poll. The earlier delegated Controller verdict on `d4445c2` remains `BLOCKED_MODEL_CONFIG`: CLI banner showed requested model/provider/effort/read-only sandbox but backend model identity and configured named-agent invocation were not verifiable. Therefore this integration review is not yet eligible to freeze/publish an immutable Artifact A4. Next step is to resolve the exact-SHA automatic review and obtain a supported, verifiable non-blocked delegated Controller verdict.

### DELETE dense-order and confirmed replay rework

Automatic review on `a7cbd80` found P1 acknowledgment while D1 order remained sparse, plus P2 R2 revalidation during a confirmed retry. The initial correction changed sparse DELETE response to 503, retained repair state, confirmed idempotency before any success, and skipped R2 HEAD for a committed replay only after dense D1 confirmation. Internal re-review then found the marker-downgrade counterexample: the D1 batch may persist stale `COMMITTED` markers while triggers ignore compaction and both later `NEEDS_REPAIR` writes. A fresh density check now gates the replay shortcut and failure remains 503. Tests prove stale marker replay cannot acknowledge, then scheduled recovery densifies, cleans backup, and enables same-key 200. Internal integrity/security critics found no residual P0/P1/material blocker.

The final current code commit is `37e9860170e0958e4ab5b9bfef0e8b82f2e2bad1`; its clean local suite passed in 828.8s, with typecheck, syntax and whitespace checks passing. A fresh GitHub automatic review was requested for this exact SHA. No Artifact A4 has been frozen. The delegated Controller result remains `BLOCKED_MODEL_CONFIG` on the earlier candidate because a supported named-agent invocation and independent runtime identity evidence are not available in the current CLI. Publication remains blocked until the exact current SHA has resolved automatic review and a non-blocked delegated technical review.

## REWORK-3 — mutation acknowledgment, retry, compensation and recovery

The consolidated REWORK-3 implementation is commit `21433103e8b8b201a442963401f10dc202b405fc`, integrated with canonical method/policy update `main@be60c4efbe5412d8a5317ba4d200b9a772c0cbd5` by merge commit `976a670340cc931898492a591c7b066ccdc9a516`. It preserves the A1–A3 artifact ancestry. The source repository remains at its pinned read-only revision.

Across listing create and image add/reorder/delete, the review checked the relationship between durable D1/R2 effects, returned HTTP status, retry identity and operation-ledger recovery. Idempotency keys replay confirmed results and reject changed request fingerprints. Post-commit readback reconciles ambiguous D1 acknowledgments. DELETE backup cleanup failures no longer turn a committed deletion into an error response; failed densification keeps recovery state and backup available. ADD repairs sparse positions before append and checks resulting order. Recovery handles failed state writes and does not restore an orphan object when its D1 row is already absent.

The REWORK-3 HTTP suite exercises before-effect, after-effect and zero-change acknowledgments, R2 compensation/deletion, operation-state failures, lock readback failures, confirmed-request replay, and sparse-order repair/reaper recovery. It checks HTTP status, D1 state, R2 bytes/object absence and convergence after retry. Exact commands, final duration, and excluded earlier unsuccessful attempts are recorded in the validation ledger. Independent security/integrity critiques are recorded in `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`; GitHub automatic review of PR #10 head `976a670` completed without code suggestions.

Remaining limits are unchanged: local synthetic Workerd/D1/R2 does not establish remote multi-instance timing, impossible-to-rule-out arbitrary crash windows, full product parity, or production readiness. Disclosed divergences and deferred source entities remain unresolved.

## REWORK-1 delta

The two JWT security regression controls were repaired without changing Worker or dependency code. Active claims identify seeded `owner-a`/matching email and remain valid for one hour; the same-claims active positive control returns 200, its correctly signed expired counterpart returns 401, and the same active claims signed with a wrong HMAC return 401. `node --check tests/http.mjs` and one full fresh-state local HTTP suite passed after this edit; exact result and the deliberately interrupted preliminary run are transparently recorded in `CF-AU-I01-P2-VALIDATION.md`. Independent security QA bounded PASS is in `critics/CF-AU-I01-P2-REWORK1-JWT-SECURITY.md`.

## REWORK-2 — committed-response lease-release integrity

The A2-F1 cleanup path now retries token-fenced D1 DELETE, verifies ownership state, and uses a token-fenced expiry fallback. Cleanup errors are contained so an already confirmed mutation response is not overwritten. Test-only D1 fault injection covers failures before and after the lock DELETE effect across upload, reorder and delete. HTTP status, exact cardinality, D1 metadata/order, readable or absent R2 objects, terminal operation state, lock absence, and follow-up recovery are asserted. Independent static integrity review is bounded PASS in `critics/CF-AU-I01-P2-REWORK2-INTEGRITY.md`; the replacement-token race is an explicit nonblocking coverage limitation because both SQL cleanup statements are token-scoped.

Final candidate verification: `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check`, and the complete local Wrangler HTTP suite passed. The suite completed against fresh local D1/R2 persistence in 562.5 s. Two earlier suite attempts are not counted: one was interrupted to add cardinality checks, and one exposed/fixed interference with the existing R2 failure fixture. Details are in the validation ledger. Dependencies did not change, so `npm audit` was not rerun.


## Exact candidate `cdb8970` review status (2026-10-14)

The candidate is pushed to PR #10 and descends from canonical `main@91db05fb343d0bc020335bfc05790a2f3f824b82`. GitHub automated review completed at `2026-10-14T15:11:59Z` without new findings for this exact candidate. The separate Controller could not initialize under `--sandbox read-only` and returned no technical verdict; details are recorded in `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`. The previous gate to publish A4 is therefore not cleared. Exact next action is a successful same-model, same-effort read-only Controller review of `cdb8970` in a runtime that permits app-server initialization.


## Controller exact-SHA result — `cdb8970`

A separate read-only project_controller process completed a static audit of `cdb8970` and identified no P0/P1 in the reviewed paths. It returned `BLOCKED_MODEL_CONFIG`, not PASS, because actual model identity could not be attested from available runtime/session metadata. The requested model/effort/sandbox flags and restricted workspace profile are recorded; actual backend model remains unverified. No A4 is authorized by this result. See `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`.


## Controller PASS on exact code candidate — `cdb8970`

The delegated separate-process Controller returned bounded technical PASS on exact SHA `cdb8970ce06fb03d841bd9b2ba32769d78c5629e`, found no P0/P1 in audited code paths, and verified local Codex runtime context `gpt-6-luna` / `high` / `read-only`. No cryptographic provider/backend attestation exists. The code/test tree is byte-identical to recorded tested tree `e1b9350` / `5b9fe7d`; no tests were run by the Controller. Exact provenance and limitations: `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`. This pass clears the delegated code review for `cdb8970`; a refreshed exact-artifact review candidate, GitHub check, Pre-Critic and publication boundary remain.

### Latest recovery-log / retired NULL replay rework

GitHub automatic review on `30c126e` identified two P2 issues: client idempotency keys in scheduled recovery logs and a retired operation path that could strand a NULL replay result. Both are repaired with static-only recovery log events and fingerprint/state-fenced result repair plus readback. The source regression guard and HTTP recovery case are in `tests/retry-idempotency.mjs` and `tests/http.mjs`. Two independent read-only specialists (auth/runtime and D1/R2 saga recovery) found no remaining actionable P0/P1/P2. Fresh focused retry and full local suite pass; exact commands/output and limitations are in the validation ledger. The candidate now meets Integration Review for delegated exact-SHA Controller/GitHub review; this is not an external PASS and does not yet authorize publication.

### Integrated ignored-write and sparse ADD recovery repairs — local candidate (2026-10-14)

The current worktree extends the two GitHub P2 fixes with an independently identified ADD acknowledgment/recovery P2. Marker writes now require the exact expected ordered image set and row positions. The same-key path preserves the current dense order after a legitimate later reorder; scheduled ADD recovery repairs sparse positions and confirms readback before marking the operation committed. The local HTTP fault scenario exercises injected sparse insertion, blocked repair, pending marker state, no-success retry, scheduled convergence, replay, and R2 readability. DELETE completion likewise requires target absence plus dense survivor positions.

Fresh full `npm test` passed after these changes in 1188.1 s, including the focused replay suite and local synthetic HTTP/D1/R2 suite. Typecheck, both syntax checks, `git diff --check`, and separately invoked `npm run test:retry` passed. Internal read-only saga and concurrency critics found no actionable P0/P1/P2; their review did not execute tests. Earlier failed runs and exact causes are preserved in `CF-AU-I01-P2-VALIDATION.md` and excluded.

This worktree is not yet the frozen pushed candidate. Re-run GitHub automatic review and the separate GPT-6 Luna/High/read-only Controller on the exact pushed SHA, then refresh the final Pre-Critic. No technical PASS, Artifact A4, or external-review boundary is claimed here.
