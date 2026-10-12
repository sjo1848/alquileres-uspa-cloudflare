# Experiment Log — Alquileres Uspallata Cloudflare

Use one entry per bounded experiment. Do not rewrite history after results are known; append corrections or follow-up experiments.

## Template

### EXP-XXX — Title

- Date:
- Related task:
- Hypothesis:
- Falsification criterion:
- Source baseline:
- Target/runtime versions:
- Setup:
- Procedure:
- Evidence:
- Result: `SUPPORTED | REJECTED | UNRESOLVED`
- Unexpected findings:
- Cost/usage observation:
- Conclusion:
- Transferable learning:
- Follow-up:

### EXP-001 — Source baseline and parity inventory

- Date: 2026-08-26
- Related task: CF-AU-I00
- Hypothesis: the source product surface and persistence semantics can be inventoried without modifying the source.
- Falsification criterion: pinned source cannot be reproduced, or required behavior is absent/ambiguous in the source artifacts.
- Source baseline: `sjo1848/alquileres-uspa@cff14159daa1698a9ee04ea317c4a2c356112ae0`
- Target/runtime versions: source package manager pnpm 11.15.1; target inspection Wrangler 4.126.0.
- Setup: fresh read-only clone; inspect manifests, README, controllers, guards, services, tests, Prisma schema and 10 migrations.
- Procedure: verify remote HEAD, clone, inventory routes/models/migrations and record parity/risk surfaces.
- Evidence: `docs/research/SOURCE-INVENTORY.md`, `PARITY-MATRIX.md`, `MIGRATION-RISK-MAP.md`.
- Result: `SUPPORTED`
- Unexpected findings: historical fields are deliberately quarantined and availability timestamps were made nullable to avoid unsupported claims.
- Cost/usage observation: no Cloudflare resource or real data used.
- Conclusion: feasibility work can be grounded in a stable source baseline; migration must preserve several explicit truthfulness rules.
- Transferable learning: parity matrices need to include negative semantics and data-history rules, not only happy-path routes.
- Follow-up: build the first D1 migration and reconciliation harness.

### EXP-002 — Local Workers/D1/R2/Web Crypto primitive proof

- Date: 2026-08-26
- Related task: CF-AU-I00
- Hypothesis: the target runtime exposes D1, R2 and Web Crypto primitives needed by the first migration increment.
- Falsification criterion: local Worker cannot bind the primitives or cannot complete metadata/object/hash operations.
- Source baseline: source commit above; synthetic identifiers only.
- Target/runtime versions: Wrangler 4.126.0, compatibility date 2026-08-26.
- Setup: local `wrangler dev`; fixture config binds one local D1 database and one local R2 bucket.
- Procedure: Worker performs R2 put/get/delete, parameterized D1 query and SHA-256 via `crypto.subtle`; curl the endpoint.
- Evidence: `.orchestration/evidence/fixtures/`, invariant evidence response JSON.
- Result: `SUPPORTED`
- Unexpected findings: initial config path was wrong; routine REWORK corrected it and the rerun passed.
- Cost/usage observation: local execution only; no account, billing, remote database, bucket or deployment.
- Conclusion: primitives are available, but this does not prove password hashing, authorization, production behavior or transactional compensation.
- Transferable learning: target primitive tests should precede framework porting and must preserve negative/unresolved boundaries.
- Follow-up: implement auth contract tests and R2/D1 failure injection in the bounded increment.

### EXP-003 — REWORK-1 auth, D1/R2 lifecycle, and route-derived cost

- Date: 2026-10-12
- Related task: CF-AU-I00 REWORK-1
- Hypothesis: current Worker-compatible primitives preserve the source auth and image lifecycle contracts while fitting the Workers Free CPU/request and D1/R2 envelope.
- Falsification criterion: JWT/cookie/role behavior diverges; bcryptjs cost 12 exceeds the 10 ms Free CPU budget; OWNER isolation, public image visibility, metadata/order or D1/R2 compensation fails; route-derived counts cross an included quota.
- Source baseline: `sjo1848/alquileres-uspa@267c531f3e3d5869240894063d3a194fa1f9680b`; source drift is documentation/demo/static asset/CSS changes only, no API/schema changes.
- Target/runtime versions: Wrangler `4.149.0`, Workerd `1.20261006.1`, compatibility date `2026-10-06`; local D1/R2 bindings; npm dependencies pinned in `.orchestration/evidence/fixtures/package-lock.json`.
- Setup: synthetic-only local Worker with `cpu_ms=10` configured; local D1 and R2; source-compatible `bcryptjs@3.0.2`, `jsonwebtoken@9.0.2`, synthetic JWT secret and synthetic image bytes. No remote Cloudflare resource, source mutation, production or real data.
- Procedure: run the Worker checks in `.orchestration/evidence/fixtures/rework1-tests.mjs`; calculate route/data usage from `calculate-cost.mjs`; independently challenge both tracks in critic reports.
- Evidence: `.orchestration/evidence/CF-AU-I00-REWORK1-TEST-RESULTS.json` (16/16 passed); `.orchestration/evidence/CF-AU-I00-COST-CALCULATIONS.json`; specialist and critic reports; official Cloudflare links in `COST-ZERO-MODEL.md`.
- Result: `REJECTED` for source bcrypt cost-12 on the Workers Free cost-zero path; `UNRESOLVED` for full H2/H3/H4/H6. Tested JWT interoperability, selected cookie/role/OWNER checks and selected R2/D1 lifecycle paths passed. The source-parity mediated-image growth case is 122,500 Worker requests/day, 22,500 over Free allowance. D1 daily Free quota exhaustion rejects queries until reset and is not automatic paid overage.
- Unexpected findings: initial cost-specialist calculations had inconsistent R2 read/write headroom and used direct public image reads that conflicted with the source API delivery path. An independent critic identified both; integration corrected the arithmetic and counted each image response as a Worker request. An initial fixture constrained temporary negative positions; the local schema was corrected to reflect source two-phase reorder staging, and the final rerun passed.
- Cost/usage observation: local only; no usage against a Cloudflare account. Synchronous bcryptjs cost 12 elapsed at 539 ms (final synchronous comparison); local Workerd did not provide the production CPU meter. Treat as a very large local CPU proxy exceedance, not account telemetry.
- Conclusion: JWT/HMAC and D1/R2 bindings are technically available. The current auth CPU behavior falsifies the zero-cost Free path. Full relational migration and D1 replacement for PostgreSQL advisory locking remain unresolved. Do not begin migration from this evidence.
- Transferable learning: count API-mediated image delivery as Worker invocations; local primitives do not prove cross-service concurrency or production billing; internal cost critics must independently recompute every derived row.
- Follow-up: wait for External Independent Critic verdict; do not start a functional migration increment before PASS and resolution of any Human Gate.

---

## EXP-000 — Laboratory bootstrap

- Date: 2026-08-26
- Related task: CF-AU-I00
- Hypothesis: a second Cloudflare migration lab can start with canonical state, explicit hypotheses and cost constraints before migration implementation begins.
- Falsification criterion: bootstrap creates ambiguous authority, modifies source product, introduces paid resources, or begins migration without a bounded contract.
- Source baseline: `sjo1848/alquileres-uspa` main `cff14159daa1698a9ee04ea317c4a2c356112ae0`; product candidate I13 `8e11bebdb197321d500678f06233d6f174f03438`.
- Setup: separate repository `sjo1848/alquileres-uspa-cloudflare`; separate Drive lab archive.
- Result: pending bootstrap review/merge.
- Conclusion: pending.
