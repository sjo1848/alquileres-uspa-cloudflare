# Hypothesis Registry — Alquileres Uspallata Cloudflare

Verdicts use only `SUPPORTED`, `REJECTED`, or `UNRESOLVED`. A conditional note narrows what the evidence covers; it does not upgrade unresolved defining criteria.

## H1 — Frontend portability

Hypothesis: Vue 3 + Vite can be served using Workers Static Assets without material UX regression.

Falsification: required browser behavior, SPA routing, asset loading or deployment constraints force product regression or paid-only dependencies.

I00 verdict: `UNRESOLVED`. Latest source drift through `267c531f3e3d5869240894063d3a194fa1f9680b` is documentation-only; the app tree matches its parent `5bcde39e0ca8abd2d5d2e0a9e9c90c5b3bf47a51`. The source/frontend inventory and current official Vue/Static Assets guides show no evident incompatibility. No source-specific Worker Static Assets build or browser smoke was run. I13 Product Acceptance remains pending.

## H2 — API portability

Hypothesis: NestJS route/domain behavior can be moved to Workers/Hono/TypeScript without weakening validation, role/owner isolation or error semantics.

Falsification: a required behavior depends on a Node/PostgreSQL primitive that cannot be replaced with parity, or auth/security behavior is weakened.

I00 verdict: `UNRESOLVED`. Local Worker tests verified JSON Web Token interoperability with `jsonwebtoken` HS256, token expiration/tampering rejection, source cookie name/flags/default, Bearer precedence, database-backed role freshness shape, OWNER/ADMIN positive and negative checks, and OWNER isolation. Password hashing with source `bcryptjs` cost 12 took 613 ms synchronous local Workerd elapsed in the latest run against a 10 ms Free CPU limit. This local metric is not production CPU telemetry, but strongly falsifies the current zero-cost auth path. No route-wide NestJS parity port exists.

## H3 — D1 relational parity

Hypothesis: PostgreSQL/Prisma schema and data can be represented in D1 without silent inference and with deterministic migration/reconciliation.

Falsification: enum/null/default/FK/unique/timestamp/JSON behavior cannot be represented safely, legacy meaning is changed, migration is non-reproducible, or concurrent ordering/state changes cannot preserve source semantics.

I00 verdict: `UNRESOLVED`. Local D1 synthetic checks exercised text/CHECK enum rejection, unique `(listing_id, position)`, dense reordering with a two-phase batch, and DB rollback used in image compensation. No full target migration/reconciliation ledger exists. Source per-listing transactions use PostgreSQL `pg_advisory_xact_lock`; a concurrent-safe D1 replacement is still unproven. I13 legacy price/occupancy fields and `last_confirmed_at` must not be inferred or backfilled.

## H4 — R2 listing image lifecycle

Hypothesis: R2 can store image bytes while preserving ownership, ordering, metadata, and source public delivery behavior.

Falsification: unowned access reaches bytes, object keys become authorization, order/metadata diverge, unpublished images are public, or partial D1/R2 failure cannot be detected/compensated.

I00 verdict: `UNRESOLVED`. A local Workerd/R2/D1 synthetic harness passed 17 auth and lifecycle cases, including owner authorization before object writes, omitted object keys in DTOs, public delivery only when approved and published, dense position reorder/delete compaction, D1 insert failure compensation after R2 put, and D1 batch failure compensation after R2 delete. The Worker mediated reads to match source behavior. Same-listing concurrent mutations, all R2 failure modes, MIME/signature/size boundary validation, source frontend delivery and orphan reconciliation remain untested.

## H5 — Cost-zero operating envelope

Hypothesis: the lab and plausible early low-traffic use can run at USD 0 within current included Workers/D1/R2 use while preserving source auth and image delivery.

Falsification: representative required auth exceeds Free CPU, route/image volume exceeds quotas, or any required behavior needs paid capacity.

I00 verdict: `REJECTED` for the current Workers Free path. The local bcryptjs cost-12 synchronous proxy was 613 ms versus the documented 10 ms per-request Free CPU allowance. Illustrative lab and early-adoption request/row/storage arithmetic remains below the non-CPU quotas, but it is not a measured forecast. The growth crossover exceeds the Worker request allowance when source-parity API-mediated image GETs are counted. D1 Free daily row exhaustion rejects queries until reset rather than charging automatically.

## H6 — Method portability

Hypothesis: the Project Method from HMS can transfer to this different stack with fewer routine human coordination steps while preserving evidence quality.

Falsification: role boundaries are ambiguous, critics lack independence, integration misses track conflicts, evidence is non-reproducible, or human dispatch is still routinely required.

I00 verdict: `UNRESOLVED`. This REWORK run produced separate source/parity and runtime/cost specialist reports, two independent internal critiques, autonomous repairs, and an Integration Review without technical relay through the Human. One bounded run does not establish cross-project generalization or lower coordination cost.

## Cross-project thesis

No thesis is accepted. Evidence from this lab rejects the narrow source-auth/Workers-Free cost-zero path and leaves several parity surfaces unresolved. Compare with HMS only after both labs have mature external-reviewed artifacts.
