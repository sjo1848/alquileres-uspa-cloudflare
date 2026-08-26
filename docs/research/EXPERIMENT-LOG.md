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
