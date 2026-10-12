# CF-AU-I00 Pre-Critic Gate — REWORK-2 / Artifact A4

Candidate: REWORK-2 feasibility evidence package. Gate status: `PASS` for publication of this exact immutable research artifact to External Independent Critic only. This does not accept migration feasibility or override unresolved hypotheses.

Artifact A4 exact commit: **to be sealed in the publication boundary after this evidence commit**. A3 `d935616bb5634a7e357b5da2747767119b2c3464` remains an immutable ancestor and its tag is unchanged. PR #6 remains open and unmerged.

## Contract, source and scope

- [x] Authorized active contract `.orchestration/contracts/CF-AU-I00.md`; External Independent Critic REWORK-2 criteria are recorded in `.orchestration/reviews/CF-AU-I00-ARTIFACT-A3-CRITIC.md`.
- [x] Canonical main review event `0af0ab4fa368d8b7faf4c7b287ba0d021182bed6` is integrated through a merge commit that preserves A3 ancestry.
- [x] Work remains within feasibility research, synthetic local evidence, bounded REWORK and publication. No functional migration, source changes, real data, production deployment, paid Cloudflare resource, or new task.
- [x] I13 Product Acceptance remains an explicit dependency.

## External REWORK-2 exit criteria

- [x] F1: invalid role test requires observed CHECK-constraint rejection and absent row; unconstrained mutation proves the assertion fails on an accepted invalid role.
- [x] F2: injected D1 insert failure compares R2 key set and D1 metadata snapshots; no-cleanup mutation proves detection of exactly one orphan, followed by fixture-only cleanup and baseline recheck.
- [x] F3: mutable current summaries report latest REWORK-2 bcrypt values (624/642 ms async; 613 ms sync) and label local elapsed CPU proxy, not Cloudflare CPU telemetry. Historical A3 evidence is preserved and distinguished.
- [x] Additional internal finding: tracked Wrangler config has no `LOCAL_FIXTURE_ONLY`; ignored synthetic `.dev.vars` contains no hook flag; `run-local-fixture.mjs` rejects all forwarded arguments and launches Wrangler with fixed `--local` and `--var` arguments. Tests assert absence from tracked config and `.dev.vars`, and assert the exact runner script. `npm run dev -- --remote` was attempted and rejected with exit 1 before Wrangler started. A direct deliberate Wrangler invocation with manual remote flag override is outside this bounded proof.

## Tests and evidence

- [x] `.orchestration/evidence/CF-AU-I00-REWORK2-TEST-RESULTS.json`: Node v24.18.0, Wrangler 4.149.0, Workerd 1.20261006.1, compatibility date 2026-10-06; local D1/R2, synthetic data only; 17/17 pass, 0 fail.
- [x] Cost calculation rerun `.orchestration/evidence/CF-AU-I00-REWORK2-COST-RERUN.json` is byte-identical to `.orchestration/evidence/CF-AU-I00-COST-CALCULATIONS.json`; internal cost critic independently recomputed the D1 image-read adjustment. Inputs remain assumptions, not a forecast or account metering.
- [x] `npm audit --prefix .orchestration/evidence/fixtures --audit-level=moderate`: 0 vulnerabilities.
- [x] No remote Cloudflare account or resource interaction. Test suite and calculator use local fixtures only.

## Method, integration and invariant evidence

- [x] Source/parity/data specialist and runtime/cost specialist evidence are separate from the independent technical and research/cost critic reviews; dated findings and follow-ups are preserved.
- [x] Integration Review `.orchestration/evidence/CF-AU-I00-INTEGRATION-REVIEW.md` reconciles REWORK-2 findings, current metrics, local fixture security boundary and residual scope.
- [x] All 19 invariants in `.orchestration/evidence/CF-AU-I00-INVARIANTS.md` are classified APPLIES or N/A with rationale; no PENDING, FAIL or UNPROVEN invariant remains for this bounded lab artifact.
- [x] H1/H2/H3/H4/H6 remain `UNRESOLVED`; H5 is narrowly `REJECTED` for the current source-compatible bcryptjs cost-12 path on Workers Free. No target architecture or full app parity PASS is claimed.
- [x] Cost claims remain conditional and quantified; quota, CPU proxy, static routing, concurrency and query metering caveats remain explicit.

## Publication boundary

- [x] Substantive A4 candidate will be committed once; no amendments after its SHA is recorded.
- [x] This gate and canonical state/status boundary will identify the exact Artifact A4 SHA and annotated tag `CF-AU-I00-Artifact-A4`.
- [x] State/status agree at boundary: `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, `external_review.required=true`, exact artifact head/tag, sequence advanced, next action names External Independent Critic.
- [x] A4 exact commit and A3 ancestry remain in PR #6; no merge, squash, or boundary-only cherry-pick.
- [x] Stop at External Independent Critic review. Do not begin migration before external PASS and any required gates.

This gate is limited to preparing the research evidence package for external review. It is not external acceptance, product acceptance, authorization to pay, deployment approval, or authorization for a functional migration.
