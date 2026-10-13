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
