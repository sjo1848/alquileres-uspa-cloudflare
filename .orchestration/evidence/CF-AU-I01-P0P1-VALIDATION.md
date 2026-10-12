# CF-AU-I01-P0P1 — Reproducible Validation Record

Observed 2026-10-12 in branch `work/cf-au-i01-p0p1`, based on canonical lab `main` at `84930c4ba59d133e40099aebb0edd0a8584fb6ab`. All Workerd and D1 operations below were local and synthetic.

## Environment and commands

| Command | Result |
|---|---|
| `node i01-auth/tests.mjs` from `.orchestration/evidence/fixtures/` | PASS — 23/23 grouped checks. Result file: `.orchestration/evidence/CF-AU-I01-P0P1-AUTH-RESULTS.json`; Node `v24.18.0`, Wrangler `4.149.0`, bcryptjs `3.0.2`. Includes registration/login bcrypt cost 12, cookie profiles, role/owner checks, encoded and malformed Bearer/cookie, configured expiry and no-write failure for unsupported numeric expiry. |
| `node calculate-i01-cost.mjs > ../CF-AU-I01-P0P1-COST-RESULTS.json` | PASS — generated three route-driven scenarios, 9 CPU sensitivities, and all optional SQLite DO price meters. DO usage cost remains explicitly unresolved/not in scenario totals. Independent cost critic recomputation matched scenario arithmetic. |
| `cmp <(node calculate-i01-cost.mjs) ../CF-AU-I01-P0P1-COST-RESULTS.json` | PASS — calculator output and result JSON (including the optional DO meter block) match byte-for-byte. |
| `npm audit --audit-level=low` from fixture directory | PASS — found 0 vulnerabilities. |
| `node --check i01-auth/worker.js && node --check i01-auth/tests.mjs && node --check calculate-i01-cost.mjs` | PASS — syntax checks clean. |
| `git diff --check` | PASS — no whitespace errors. |

There is no lint or typecheck script in the fixture package; these are not applicable to the plain JavaScript proof. No application build exists in this research-only increment. There is no provider CPU meter in local Workerd: recorded `elapsedMs` is wall elapsed, never billed CPU.

## Evidence interpretation

- Final dedicated bcrypt comparison samples: successful 567 ms cold / 542 ms warm; wrong password 631 ms / 557 ms. Integrated wrong-password vs unknown-account sample: 558 ms / 0 ms. Registration hash sample: 644 ms. These are noisy local elapsed measurements and not provider CPU readings.
- Cost model outputs: low/base USD 5.00 monthly; high USD 23.0005 / 26.6005 / 46.6005 at 10 / 100 / 600 assumed CPU ms/login. `600` is illustrative sensitivity, not a measured billing value. Unknown-account requests skip bcrypt; the CPU sensitivity assumes costly bcrypt-bound logins and the attack case is monthly volume only, not burst concurrency.
- Optional SQLite Durable Objects inputs list request, active duration, rows-read, rows-written and storage meters. DO total is explicitly unresolved and excluded from scenarios because no DO concurrency/actor workload or resource counts are established.
- npm audit and local tests do not prove remote Cloudflare behavior, full auth validation parity, production billing, route-level D1 row counts, or the entire application migration.
- No lint/typecheck output is invented. No source changes, paid services, account settings, remote bindings, production deployments, real customer data, functional migration, or R2 resource activity occurred.
