# Independent QA Critic — CF-AU-I01-P0P1 A3-F1

Reviewer: `/root/i01_cost_critic`, independent of the validator author. Date: 2026-10-12.

## Scope

Reviewed only the A3-F1 correction in `.orchestration/evidence/fixtures/validate-i01-cost.mjs` against `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-CRITIC.md`. No cost-driver, auth, or architecture changes were reviewed or proposed.

## Findings

- **Source binding is enforced:** the validator requires `r2ClassBGetObjectBeforeFreeDeletePerOperation === 1` for the pinned source and `imageDeleteObjectReads === routeDrivers.imageDelete × factor` in every scenario. The source map must also retain `GetObject before free DeleteObject`.
- **The negative mutant represents A3-F1:** it uses the high scenario, removes only delete-prefetch reads, retains ordinary public and ADMIN image GETs, recomputes aggregate Class B operations and its billing-unit rounding, and asserts the aggregate equals public + ADMIN GETs before expecting rejection specifically at the source-binding invariant.
- Both the correct and mutant aggregates round to 12,000,000 Class B operations. The included 10,000,000 means the line item remains USD 0.72 and total does not change; the test rejects the omitted 150,000 prefetch on route/source evidence, not a fabricated price change or zeroed GET traffic.

## Verification and verdict

- `node .orchestration/evidence/fixtures/validate-i01-cost.mjs` — PASS; four omission mutations rejected, including the coherent delete-prefetch mutant.
- `node --check .orchestration/evidence/fixtures/validate-i01-cost.mjs` — PASS.

**Verdict: bounded PASS for A3-F1.** The mutant now exercises the exact missing-prefetch defect and is rejected for the required source-derived invariant. This is an internal QA review only, not an External Independent Critic verdict or product/cost acceptance.
