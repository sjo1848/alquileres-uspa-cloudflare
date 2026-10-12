# CF-AU-I00 Pre-Critic Gate — REWORK-3 / Artifact A5

Candidate: one-file evidence-provenance correction under REWORK-3. Gate status: `PASS` for publication of this exact immutable evidence artifact to External Independent Critic only. This does not accept migration feasibility or override unresolved hypotheses.

Artifact A5 exact commit: **to be sealed in the publication boundary after this evidence commit**. Immutable Artifact A4 `8e707eadca25e47827b6bc81adaa4f272192af2e` and A3 `d935616bb5634a7e357b5da2747767119b2c3464` remain ancestors with tags unchanged. PR #6 remains open and unmerged.

## Contract, source and scope

- [x] Authorized active contract `.orchestration/contracts/CF-AU-I00.md`; External Independent Critic A4-F1 is recorded in `.orchestration/reviews/CF-AU-I00-ARTIFACT-A4-CRITIC.md`; the existing CF-AU-I00 contract is unchanged.
- [x] Canonical main review event `0af0ab4fa368d8b7faf4c7b287ba0d021182bed6` is integrated through a merge commit that preserves A3 ancestry.
- [x] Work remains within feasibility research, synthetic local evidence, bounded REWORK and publication. No functional migration, source changes, real data, production deployment, paid Cloudflare resource, or new task.
- [x] I13 Product Acceptance remains an explicit dependency.

## External REWORK-3 exit criteria

- [x] A4-F1 corrected in `.orchestration/evidence/critics/research-cost-method-critic.md`: the stale trailing spot-check no longer calls 539 ms/645/552 ms the current A4 result; it is explicitly identified as a superseded, misattributed intermediate note.
- [x] The report's final A4 result section and corrected note agree with immutable A4 JSON: 624/642 ms async; 613 ms sync. The sync value is a local elapsed proxy, not Cloudflare CPU telemetry.
- [x] Earlier A3 and intermediate snapshots remain clearly historical; the stale current/final attribution is withdrawn rather than erased from the audit trail.
- [x] No executable code, cost formula, test, or result JSON changed. The correction is restricted to evidence provenance.

## Unchanged verification evidence

- [x] Immutable A4 `.orchestration/evidence/CF-AU-I00-REWORK2-TEST-RESULTS.json` records Node v24.18.0, Wrangler 4.149.0, Workerd 1.20261006.1, local synthetic D1/R2, 17/17 passed. This documentation-only A4-F1 correction did **not** rerun the suite, per the external critic's bounded instruction; executable inputs and the result JSON are unchanged.
- [x] `.orchestration/evidence/CF-AU-I00-REWORK2-COST-RERUN.json` remains byte-identical to `.orchestration/evidence/CF-AU-I00-COST-CALCULATIONS.json`; the calculator was not rerun because its code/inputs did not change.
- [x] A4's recorded `npm audit --audit-level=moderate` result is 0 vulnerabilities; audit was not rerun because dependency inputs did not change.
- [x] A4 immutable unchanged test evidence blob: test results `758a584bd7cf9f6c3e2754203710438edd2910ba`; test runner `08d1c10523486c6c0a805ba7f7c9bdf4f1cf2fab`; Worker `6f43cda523e5d5082f7aa8b5c461e80be98cbca2`; package lock `1e7c75ce25dce7e22dccc58adc0d7f92f85f5bf1`. These exact blobs are the recorded source of the unchanged 17/17 result; not rerun for this documentation-only repair.
- [x] Cost script `bd09e10a33800d53016e8b4f4e8c836bb754fa74`, calculation output and rerun output (`c809eed2cbd5368fbdc357324819a55bc3e12dc2`) are unchanged from A4. The existing byte equality and internal critic verification are reused; no cost calculation rerun.
- [x] No remote Cloudflare resource, production, paid resource, real data or source repository is involved.

## Method, integration and invariant evidence

- [x] Source/parity/data specialist and runtime/cost specialist evidence are separate from the independent technical and research/cost critic reviews; dated findings and follow-ups are preserved.
- [x] Integration Review `.orchestration/evidence/CF-AU-I00-INTEGRATION-REVIEW.md` adds the A4-F1 provenance correction and records unchanged test/cost evidence plus remaining scope. Independent verification is persisted in `.orchestration/evidence/critics/a5-cost-provenance-critic.md`.
- [x] All 19 invariants in `.orchestration/evidence/CF-AU-I00-INVARIANTS.md` are classified APPLIES or N/A with rationale; no PENDING, FAIL or UNPROVEN invariant remains for this bounded lab artifact.
- [x] H1/H2/H3/H4/H6 remain `UNRESOLVED`; H5 is narrowly `REJECTED` for the current source-compatible bcryptjs cost-12 path on Workers Free. No target architecture or full app parity PASS is claimed.
- [x] Cost claims remain conditional and quantified; quota, CPU proxy, static routing, concurrency and query metering caveats remain explicit.

## Publication boundary

- [x] A5 evidence candidate will be committed once; no amendments after its SHA is recorded.
- [x] This gate and canonical state/status boundary will identify exact Artifact A5 SHA and annotated tag `CF-AU-I00-Artifact-A5`.
- [x] State/status agree at boundary: `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, `external_review.required=true`, exact artifact head/tag, sequence advanced, next action names External Independent Critic.
- [x] A5/A4/A3 exact commits remain in PR #6; no merge, squash, or boundary-only cherry-pick.
- [x] Stop at External Independent Critic review. Do not begin migration before external PASS and any required gates.

This gate is limited to preparing the research evidence package for external review. It is not external acceptance, product acceptance, authorization to pay, deployment approval, or authorization for a functional migration.
