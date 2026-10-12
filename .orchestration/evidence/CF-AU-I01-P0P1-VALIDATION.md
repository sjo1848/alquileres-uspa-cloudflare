# CF-AU-I01-P0P1 — Reproducible Validation Record

Observed 2026-10-12 in branch `work/cf-au-i01-p0p1`; Artifact A3 REWORK-2 was authorized by canonical `main@b7f49a6` and merged into this same branch with A1/A2/A3 ancestry preserved. This A4 candidate changes only validator QA/evidence; all Workerd and D1 operations remain local and synthetic.

## Environment and commands

| Command | Result |
|---|---|
| `node i01-auth/tests.mjs` from `.orchestration/evidence/fixtures/` | **Not rerun for A3/A4.** A2 records PASS — 23/23 grouped local synthetic checks (Node `v24.18.0`, Wrangler `4.149.0`, bcryptjs `3.0.2`). Auth Worker and test runner blobs are unchanged from A2: `worker.js` `2420ca39a24dcdb0b75c6e5ae84533fe81e06b3a`; `tests.mjs` `71dc57fa4dfd3f90d5f3d56506cb9457fd23696e`. |
| `node calculate-i01-cost.mjs > ../CF-AU-I01-P0P1-COST-RESULTS.json` | PASS — generated three route-driven scenarios, 9 CPU sensitivities applied to login + registration, registration user/index writes, separate public/ADMIN image reads, image deletion auth/owner/image/compaction work and reorder D1 work, plus optional SQLite DO price meters. Actual DO usage remains unresolved/not in scenario totals. |
| `cmp <(node calculate-i01-cost.mjs) ../CF-AU-I01-P0P1-COST-RESULTS.json` | PASS — calculator output and result JSON match byte-for-byte. |
| `node validate-i01-cost.mjs` | PASS — independently reconciled request, CPU, D1 read/write and R2 Class B totals for all 3×3 scenario/sensitivity results; four mutation checks reject missing registration, delete-prefetch, reorder and separate ADMIN-read accounting. The delete mutant preserves public/ADMIN GETs and recalculates the R2 aggregate and billing rounding; rejection comes from the source-bound `imageDelete route count × 1 GetObject` invariant. |
| Independent QA review of A3-F1 | PASS — `.orchestration/evidence/critics/i01-cost-qa-critic-a3-f1.md` confirms the coherent mutant is rejected specifically by the source-bound route/factor invariant; no files were changed by the critic. |
| `npm audit --audit-level=low` from fixture directory | Not rerun for A3/A4; fixture `package.json` (`134dcc407fb8d19cc455bf91db38bc1594d8f2ab`) and `package-lock.json` (`1e7c75ce25dce7e22dccc58adc0d7f92f85f5bf1`) blobs are unchanged from A2, whose audit found 0 vulnerabilities. |
| `node --check calculate-i01-cost.mjs && node --check validate-i01-cost.mjs` | PASS — syntax checks clean. Auth executable inputs are unchanged as above. |
| `git diff --check` | PASS — no whitespace errors. |

There is no lint or typecheck script in the fixture package; these are not applicable to the plain JavaScript proof. No application build exists in this research-only increment. There is no provider CPU meter in local Workerd: recorded `elapsedMs` is wall elapsed, never billed CPU.

## Evidence interpretation

- Final dedicated bcrypt comparison samples remain A2 evidence: successful 567 ms cold / 542 ms warm; wrong password 631 ms / 557 ms. Integrated wrong-password vs unknown-account sample: 558 ms / 0 ms. Registration hash sample: 644 ms. These are noisy local elapsed measurements and not provider CPU readings; none were rerun because A3/A4 change only cost evidence and its validator.
- A4 cost model outputs remain the unchanged A3 results: low/base USD 5.00 monthly; high USD 23.1467 / 26.8367 / 47.3367 at 10 / 100 / 600 assumed CPU ms per login or registration. `600` is illustrative sensitivity, not a measured billing value. Unknown-account requests skip bcrypt; monthly volume only, not burst concurrency.
- Optional SQLite Durable Objects inputs list request, active duration, rows-read, rows-written and storage meters. DO total is explicitly unresolved and excluded from scenarios because no DO concurrency/actor workload or resource counts are established.
- npm audit and local tests do not prove remote Cloudflare behavior, full auth validation parity, production billing, route-level D1 row counts, or the entire application migration.
- No lint/typecheck output is invented. No source changes, paid services, account settings, remote bindings, production deployments, real customer data, functional migration, or R2 resource activity occurred.
- For the high scenario, removing only the 150,000 delete-prefetch reads leaves 11,500,000 ordinary GET Class B operations; both correct and mutant aggregates round to 12,000,000 billable-unit operations, so R2 Class B line item and total remain unchanged. The validator still rejects the mutant at the explicit source/route binding, rather than depending on the broad aggregate becoming zero.
