# CF-AU-I00 — Baseline, Feasibility and Cost-Zero Validation

Status: `AUTHORIZED`
Type: discovery / migration feasibility / research experiment

## Objective

Determine whether Alquileres Uspallata can be migrated with product parity to a Cloudflare-first architecture while remaining operationally viable inside the intended free-tier envelope, and produce enough evidence to authorize or reject the first implementation increment.

## Source

- Repository: `sjo1848/alquileres-uspa`
- Bootstrap source HEAD: `cff14159daa1698a9ee04ea317c4a2c356112ae0`
- Product candidate: I13 `8e11bebdb197321d500678f06233d6f174f03438`
- Source is read-only from this lab.

## Working hypotheses

H1. The Vue/Vite frontend can be served with Cloudflare Workers Static Assets without material UX regression.

H2. The NestJS API behavior can be ported to Workers/Hono/TypeScript without losing authorization, validation or domain semantics.

H3. The current PostgreSQL/Prisma relational model can be represented truthfully in D1/SQLite with explicit migration handling and no silent semantic inference.

H4. Listing images can use R2 while preserving ownership, ordering, metadata and public delivery behavior.

H5. For the expected laboratory / early low-traffic workload, Workers + D1 + R2 can remain at USD 0 within current included usage, with measurable thresholds that identify when this ceases to be true.

H6. The Project Method used on HMS can generalize to this different source stack while reducing routine human coordination.

## Falsification criteria

A hypothesis fails or requires REWORK if evidence shows a material parity gap, unsupported runtime primitive, unacceptable auth/security regression, migration ambiguity that cannot be resolved truthfully, required paid dependency, or free-tier capacity clearly below plausible early usage.

## Required work

1. Inventory source runtime, routes, auth, persistence, images, tests and migrations.
2. Produce a source-to-target parity matrix.
3. Produce a PostgreSQL → D1 schema/migration risk map.
4. Prove or disprove auth feasibility using Workers-compatible primitives.
5. Prove or disprove R2 object lifecycle feasibility for listing images.
6. Revalidate current Cloudflare limits/pricing from official docs and record an observed-at date.
7. Build a simple usage/cost envelope with explicit assumptions.
8. Identify incompatibilities, migration adaptations and non-goals.
9. Run self-adversarial review against the hypotheses.
10. Produce invariant evidence and pass the Pre-Critic Gate.
11. Publish one immutable CF-AU-I00 artifact for External Independent Critic.

## Acceptance

- No product code migration is claimed complete.
- Every hypothesis has evidence and a verdict: `SUPPORTED`, `REJECTED`, or `UNRESOLVED`.
- Zero-cost claim is conditional and quantified, never absolute.
- Source-product I13 acceptance dependency is explicit.
- No paid resource, production deployment or real data is used.
- Next increment is bounded and justified by evidence.

## Evidence outputs

- `docs/research/LAB-CHARTER.md`
- `docs/research/HYPOTHESES.md`
- `docs/research/COST-ZERO-MODEL.md`
- `docs/architecture/TARGET-ARCHITECTURE.md`
- source/parity/migration evidence produced during I00
- `.orchestration/evidence/CF-AU-I00-INVARIANTS.md`

## Stop condition

Stop only at External Independent Critic boundary, legitimate Human Gate or demonstrated material blocker.
