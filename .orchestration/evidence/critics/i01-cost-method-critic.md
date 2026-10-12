# Independent Cost and Method Critic — CF-AU-I01-P0P1

Reviewer: `/root/i01_cost_critic`, independent from the cost-model author. Review date: 2026-10-12.

## Scope and source basis

Re-reviewed the A3 candidate in:

- `.orchestration/evidence/fixtures/calculate-i01-cost.mjs`
- `.orchestration/evidence/fixtures/validate-i01-cost.mjs`
- `.orchestration/evidence/CF-AU-I01-P0P1-COST-RESULTS.json`
- `docs/research/CF-AU-I01-P0P1-COST-MODEL.md`
- `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A2-REWORK1-CLOSURE.md`

Source route/schema mapping was checked against the read-only pinned source `sjo1848/alquileres-uspa@267c531f3e3d5869240894063d3a194fa1f9680b`, especially `auth.service.ts`, `listings.service.ts`, `listings.controller.ts`, and `schema.prisma`. Current official pricing references were rechecked: Workers `https://developers.cloudflare.com/workers/platform/pricing/`, D1 `https://developers.cloudflare.com/d1/platform/pricing/`, R2 `https://developers.cloudflare.com/r2/pricing/`, Durable Objects `https://developers.cloudflare.com/durable-objects/platform/pricing/`.

## A3 audit results

### Source-route and meter coverage

- Registration is present in all scenarios. Pinned `registerOwner` hashes before `User.create` and makes no explicit pre-insert lookup; D1 query reads are therefore modeled as zero, with engine/index-level uniqueness reads explicitly unresolved. The source User schema has an id primary key and unique email; three registration write rows (table + those two indexes) are a stated planning assumption.
- Public and ADMIN image GETs have separate route drivers and factors (2 and 4 D1 read rows respectively), under an explicit 95%/5% scenario mix. ADMIN includes AuthGuard user revalidation and image/listing/owner-role lookup. `ownerAdmin` explicitly excludes separately modeled image GET, DELETE and reorder traffic, avoiding request double count.
- DELETE includes auth revalidation, owned-draft listing lookup, image lookup and position scan: `S + 3` reads. Its `5 + 3S` write proxy accounts for the removed image table row and four indexes present in the pinned schema, plus each shifted image table row and two position indexes. Reorder uses `4N + 2` read rows (auth + owner + four per-image passes) and `6N` write rows for the two position-update passes and indexes. These are conditional D1 planning estimates; no future D1 schema/query-plan/`meta` counters are represented as measured facts.
- R2 Class B includes public/admin image `GetObject` plus the read-before-delete prefetch; Standard `DeleteObject` is free. Failed restore puts, retries, multipart, and shared-account consumption are explicitly excluded/unresolved.
- Every modeled login is assumed to reach the bcrypt compare path for CPU sensitivity; unknown-account login skips bcrypt. Registration hashes are included. Burst attack concurrency and throttling are explicitly outside the monthly volume model.

### Independent recalculation of all nine scenario/sensitivity points

I independently recomputed request counts, CPU, D1 read/write totals, R2 rounded operations, overages and line-item totals from scenario drivers and published rates. Results match the candidate:

| Scenario | Requests | D1 reads | D1 writes | R2 Class B including delete read | USD at 10 / 100 / 600 assumed auth CPU ms |
|---|---:|---:|---:|---:|---:|
| Low | 100,900 | 1,805,900 | 31,600 | 14,300 | 5 / 5 / 5 |
| Base | 3,009,500 | 267,586,000 | 445,500 | 1,853,000 | 5 / 5 / 5 |
| High | 20,300,000 | 30,381,700,000 | 17,300,000 | 11,650,000 | 23.1467 / 26.8367 / 47.3367 |

The high 10ms line items independently sum to USD 23.1467: minimum 5, requests 3.09, CPU 2.73, D1 reads 5.3817, D1 storage 1.50, R2 storage 0.225, Class A 4.50 and Class B 0.72. The high 100ms and 600ms CPU line items are 6.42 and 26.92. D1 writes remain below the included allowance in all scenarios. R2 operations and storage are rounded to billing units before included usage is subtracted. Current official rates and limits support the inputs; Workers Paid's USD 5 is an account minimum, not a spend ceiling.

### Auth timing and uncertainty

The baseline and model consistently record the latest local Workerd measurements: successful bcrypt comparisons 567/542ms cold/warm; wrong-password comparisons 631/557ms; registration hash 644ms; unknown-account path 0ms because bcrypt is skipped. The separate integrated wrong-password/unknown sample is 558/0ms. These are elapsed-time observations, not Cloudflare billed CPU. The 10ms and 100ms inputs are illustrative provider-CPU sensitivities; 600ms is illustrative and near the local elapsed proxy, not exact measured or billed CPU. No stale 541ms timing remains in the reviewed cost artifacts.

### Optional Durable Objects

The result lists all five SQLite-backed DO meter categories (requests, active duration, SQLite rows read, rows written, stored data) and current allowances/rates. DO is marked `UNRESOLVED_NOT_INCLUDED_IN_SCENARIO_TOTALS` because no actor/lock topology or usage drivers are established. This is explicit and does not assume zero future DO cost; any future DO cost is additive to modeled Worker and D1/R2 use.

## Validation evidence

- `node .orchestration/evidence/fixtures/validate-i01-cost.mjs` — PASS, 3 scenarios × 3 CPU sensitivities; 4 omission mutations rejected.
- `cmp <(node .orchestration/evidence/fixtures/calculate-i01-cost.mjs) .orchestration/evidence/CF-AU-I01-P0P1-COST-RESULTS.json` — PASS.
- `node --check` for calculator and validator — PASS.
- `python3 -m json.tool .orchestration/evidence/CF-AU-I01-P0P1-COST-RESULTS.json` — PASS.
- `git diff --check` — PASS.

## Verdict — bounded PASS

No remaining bounded cost-method finding for the reviewed A3 candidate. The scenario counts and factors remain hypothetical sensitivities, not forecasts or account telemetry; future D1 schema/query plans, actual `meta` counters, provider CPU, DO need/usage and shared account usage remain unresolved as stated. This is an internal independent cost-method review only, not an External Independent Critic verdict, Pre-Critic PASS, paid-service authorization or product acceptance.
