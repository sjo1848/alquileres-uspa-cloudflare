# A5 Cost and Test Provenance Critic

Date: 2026-10-12

## Scope

Independent one-document verification of the A4-F1 correction in `research-cost-method-critic.md`. Reviewed immutable Artifact A4 at commit `8e707eadca25e47827b6bc81adaa4f272192af2e`, tag `CF-AU-I00-Artifact-A4` (tag dereferences to that commit).

## Evidence and result

- The exact A4 test-results blob is `758a584bd7cf9f6c3e2754203710438edd2910ba` at `.orchestration/evidence/CF-AU-I00-REWORK2-TEST-RESULTS.json`.
- It records **17/17 passed**, bcrypt async correct/wrong elapsed **624/642 ms**, synchronous elapsed **613 ms**, and `workerCpuBudgetConfiguredMs=10`.
- The corrected latest critic note now withdraws the stale **539 ms** sync and **645/552 ms** async values as current A4 evidence and accurately identifies the A4 JSON values as the final recorded run. It preserves the qualification that these are local elapsed-time proxies, not Cloudflare CPU telemetry.
- This A4-F1 documentation correction did not change or rerun application code, tests, or cost calculations. Provenance remains the exact unchanged A4 artifact/evidence; the External Critic's A4 review statically inspected that evidence and did not independently rerun Wrangler/Workerd or `npm audit`.

## Assessment

The narrow A4-F1 correction is consistent with immutable A4 and its recorded test provenance. This assessment is **not** overall CF-AU-I00 approval, a Pre-Critic verdict, or an External Independent Critic verdict.
