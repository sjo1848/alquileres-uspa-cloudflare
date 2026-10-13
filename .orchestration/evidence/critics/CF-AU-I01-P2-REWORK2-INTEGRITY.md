# CF-AU-I01-P2 REWORK-2 independent integrity critique

Reviewer: `/root/p2_unlock_integrity_critic` (independent sub-agent; static review only)

## Scope

Reviewed the bounded A2-F1 repair in `apps/worker/src/index.ts`, the test-only D1 fault proxy in `apps/worker/tests/fault-worker.ts`, and the HTTP assertions in `apps/worker/tests/http.mjs`. The reviewer did not edit files and did not execute the suite.

## Verdict

**Bounded integrity PASS for A2-F1.** The release loop catches DELETE and verification failures, retries a bounded number of times, and uses token-scoped cleanup so a stale holder cannot delete or expire a replacement token. Cleanup does not reject into a route's `finally`, preserving the already determined HTTP result. Both before-effect and after-effect D1 DELETE faults are covered for upload, reorder, and delete.

Tests now assert exact expected image counts for each stage (2 then 3 after uploads; 3 through reorders; 2 then 1 after deletes; 2 after recovery), HTTP/D1 id and order agreement, dense positions, readable R2 bytes matching the synthetic fixture, terminal operation state, absence of the lock, and a successful recovery upload. The recovery assertion verifies that the one returned image id exists in the expected D1/API set.

## Residual evidence limit

The tests do not race a replacement token into the lock table while cleanup is running. Token fencing is supported statically by both cleanup SQL predicates matching `listing_id` and `token`. This is a bounded test limitation, not a blocking defect for the requested one-shot before/after DELETE failure cases.

Runtime HTTP suite results are recorded separately in `../CF-AU-I01-P2-VALIDATION.md`; this reviewer did not run them.
