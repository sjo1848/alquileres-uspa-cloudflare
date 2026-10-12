# CF-AU-I01-P0P1 Artifact A3 — REWORK-2 Closure Evidence

Date: 2026-10-12. Scope: the single bounded A3-F1 QA mutation-test defect. Authorization: canonical `main@b7f49a6`, event seq 20. Binding finding: `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-CRITIC.md`.

## Experiment

- **Hypothesis:** a source-bound validator will reject an internally coherent cost result that omits only the R2 `GetObject` before image deletion, while preserving ordinary public and ADMIN image GET operations.
- **Falsification criterion:** a mutant setting delete-prefetch reads to zero, retaining the public/ADMIN GET aggregate and recomputing dependent R2 billing rounding passes validation; or the correct source route factor is not explicitly constrained to one `GetObject` per delete.
- **Setup:** the validator now checks the source map contains `GetObject before free DeleteObject`, constrains `r2ClassBGetObjectBeforeFreeDeletePerOperation === 1`, and validates `imageDeleteObjectReads === routeDrivers.imageDelete × factor` for each scenario. The deletion mutant uses the high scenario, sets only the prefetch-read assumption to zero, preserves both ordinary GET drivers, recomputes aggregate operations and rounded billing quantity, and confirms GET-only aggregate before asserting rejection.
- **Evidence:** `node .orchestration/evidence/fixtures/validate-i01-cost.mjs` passes four negative mutations, including this coherent delete mutant. `node --check .orchestration/evidence/fixtures/validate-i01-cost.mjs` passes. Independent QA report: `.orchestration/evidence/critics/i01-cost-qa-critic-a3-f1.md`.
- **Result:** the mutant is rejected specifically because `imageDeleteObjectReads` no longer equals image-delete route count × source factor. Its 11.5M GET-only operations and 11.65M correct operations both round to 12M; after the 10M included operations, Class B remains USD 0.72 in both, so the cost result correctly does not change.
- **Conclusion:** A3-F1 is closed in the A4 candidate. The validator now tests the actual omitted-prefetch class rather than relying on an unrealistic zero for all R2 Class B traffic.
- **Transferable learning:** cost mutation tests must preserve unrelated traffic and recalculate dependent totals; a negative case should fail on the specific source-to-meter invariant, not on a collateral inconsistency.

## Scope and limits

The calculator, A3 scenario outputs, source/auth executable, dependencies, and cost assumptions are unchanged. This is a bounded QA correction and internal review; it does not independently prove R2 behavior, alter the cost model, or constitute External Independent Critic PASS.
