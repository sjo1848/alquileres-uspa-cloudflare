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

## REWORK-1 delta

The two JWT security regression controls were repaired without changing Worker or dependency code. Active claims identify seeded `owner-a`/matching email and remain valid for one hour; the same-claims active positive control returns 200, its correctly signed expired counterpart returns 401, and the same active claims signed with a wrong HMAC return 401. `node --check tests/http.mjs` and one full fresh-state local HTTP suite passed after this edit; exact result and the deliberately interrupted preliminary run are transparently recorded in `CF-AU-I01-P2-VALIDATION.md`. Independent security QA bounded PASS is in `critics/CF-AU-I01-P2-REWORK1-JWT-SECURITY.md`.

## REWORK-2 — committed-response lease-release integrity

The A2-F1 cleanup path now retries token-fenced D1 DELETE, verifies ownership state, and uses a token-fenced expiry fallback. Cleanup errors are contained so an already confirmed mutation response is not overwritten. Test-only D1 fault injection covers failures before and after the lock DELETE effect across upload, reorder and delete. HTTP status, exact cardinality, D1 metadata/order, readable or absent R2 objects, terminal operation state, lock absence, and follow-up recovery are asserted. Independent static integrity review is bounded PASS in `critics/CF-AU-I01-P2-REWORK2-INTEGRITY.md`; the replacement-token race is an explicit nonblocking coverage limitation because both SQL cleanup statements are token-scoped.

Final candidate verification: `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check`, and the complete local Wrangler HTTP suite passed. The suite completed against fresh local D1/R2 persistence in 562.5 s. Two earlier suite attempts are not counted: one was interrupted to add cardinality checks, and one exposed/fixed interference with the existing R2 failure fixture. Details are in the validation ledger. Dependencies did not change, so `npm audit` was not rerun.
