# CF-AU-I00 Pre-Critic Gate

Candidate: REWORK-1 discovery/feasibility evidence package.
Gate status: `PASS` for publication to External Independent Critic only. This does not accept the migration or override unresolved hypotheses.

## Contract and scope

- [x] Active authorized contract exists: `.orchestration/contracts/CF-AU-I00.md`.
- [x] Scope stayed within source inventory, parity/feasibility research, local synthetic proofs, current-limit research and cost model.
- [x] Acceptance criteria are addressed in source/parity inventory, hypotheses, cost model, target architecture, specialist/critic reports, Integration Review, test evidence and invariant evidence.
- [x] No product migration, real data, production deployment, paid Cloudflare resource or unapproved product/security/cost decision.
- [x] I13 Product Acceptance dependency remains explicit.

## Invariants

- [x] All 19 invariants are classified `APPLIES` or `N/A` with rationale in `CF-AU-I00-INVARIANTS.md`.
- [x] Every applicable invariant is PASS for this bounded lab artifact and its publication discipline; this is not a PASS on target hypotheses.
- [x] No invariant remains PENDING, FAIL or UNPROVEN.

## Research truthfulness

- [x] Each H1-H6 entry states falsification criteria and only `SUPPORTED`, `REJECTED`, or `UNRESOLVED` verdicts.
- [x] Local observation is distinguished from inference; local Workerd elapsed time is not described as Cloudflare CPU telemetry.
- [x] Unresolved source/runtime/data/R2/cost findings remain visible; earlier specialist output is not silently overwritten.
- [x] Platform limits/pricing link official Cloudflare sources and use observed-at date 2026-10-12.
- [x] Cost-zero claims state assumptions, route drivers, quotas, thresholds, D1 exhaustion behavior and H5's narrow rejection.

## Technical evidence

- [x] Final local Worker/D1/R2 synthetic suite: 17/17 pass; exact output in `CF-AU-I00-REWORK1-TEST-RESULTS.json`.
- [x] Cost calculator rerun; its JSON output independently recomputed by cost critic and integrated with source API-mediated image path.
- [x] `npm audit --prefix .orchestration/evidence/fixtures --audit-level=moderate`: 0 vulnerabilities.
- [x] Local fixture uses only synthetic local D1/R2; no remote bindings or account interaction.
- [x] Technical critic follow-up findings are resolved where bounded repairs were possible; residual concurrency, full schema/migration and failure-injection cases are explicitly partial/open in Integration Review.
- [x] API-level synthetic evidence is not represented as browser/UI proof.

## Role separation and integration

- [x] Source/parity/data and runtime/cost specialist evidence is distinct.
- [x] Technical/security/data and research/cost/method criticisms are independent and persisted with follow-ups.
- [x] Integration Review reconciles contradictory route/cost assumptions and records repairs and open findings.
- [x] Codex does not claim External Independent Critic acceptance.

## Publication boundary

- [x] Publish candidate as immutable Artifact A; do not amend it after recording its SHA.
- [x] Boundary commit records exact Artifact A SHA in this file and canonical state/status; it is evidence packaging only and does not change substantive artifact A.
- [x] State/status must agree: `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, `external_review.required=true`, exact `artifact_head`, event sequence advanced, next action explicitly External Independent Critic.
- [x] Do not begin migration increment before external PASS.

This gate is green only for sending the immutable CF-AU-I00 research artifact to external review. `H1/H2/H3/H4/H6` remain `UNRESOLVED`; `H5` is narrowly `REJECTED` for source bcryptjs cost-12 on Workers Free on the qualified local proxy evidence. Product acceptance and deployment decisions remain outside this gate.
