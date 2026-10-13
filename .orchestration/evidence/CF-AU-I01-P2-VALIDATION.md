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
