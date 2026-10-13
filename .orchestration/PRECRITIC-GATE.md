# Mandatory Pre-Critic Gate

Before publishing a local substantive artifact for `project_controller` delegated review, Codex must prove:

## Contract

- active Task Contract exists and scope is unchanged or explicitly amended;
- every acceptance criterion has evidence;
- no unapproved product, cost, security or deployment scope was added.

## Invariants

- every relevant invariant is classified `APPLIES` or `N/A` with rationale;
- every applicable invariant is `PASS` with evidence;
- `FAIL` or `UNPROVEN` blocks publication and returns to autonomous REWORK.

## Research truthfulness

For laboratory/discovery work:

- every hypothesis has a falsification criterion;
- result distinguishes observation from inference;
- unsupported claims are marked unresolved;
- current platform limits/pricing use official sources and an observed-at date;
- negative findings are preserved rather than edited away;
- cost-zero claims include assumptions and thresholds.

## Technical evidence

As applicable:

- tests/typecheck/build/static checks pass;
- migration and reconciliation evidence is deterministic;
- API evidence does not substitute for required browser/UI evidence;
- auth/role/tenant-owner isolation has positive and negative cases;
- R2/D1/Workers evidence uses actual target primitives when the contract requires them;
- inherited regressions are rerun against the final candidate.

## Publication

Only after this gate passes may a local artifact be presented to `project_controller` for read-only review. Verify agent model/effort and sandbox before first verdict.

Codex cannot use this gate to self-declare substantive PASS.

## CF-AU-I01-P2 REWORK-3 consolidated candidate (2026-10-13)

- Contract: `.orchestration/contracts/CF-AU-I01-P2.md`; authorized scope remains local synthetic OWNER listing/image lifecycle and full acknowledgment, retry, compensation and recovery failure class under Autonomous Local Delivery Train v1.
- Controller REWORK on prior candidate `98cec68d81c7f80a7371ec5d60c80467d1cee476` is preserved in `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`; its DELETE acknowledgment P1 and the later internal critique findings are addressed in current code/tests.
- Internal security/integrity re-critiques: no remaining P0/P1 in the covered failure class. They were static reviews, not substitutes for execution.
- Current final local suite: PASS, 797.1 s, with typecheck, test syntax and whitespace checks PASS; exact run and history are in `CF-AU-I01-P2-VALIDATION.md`.
- Scope, source read-only state, local-only Wrangler D1/R2, synthetic data, no payment/deployment/remote resources, and all stated parity/atomicity limits were rechecked.
- **Gate: PASS to submit a single consolidated candidate to GitHub automatic review and delegated read-only Controller. This is not substantive PASS or external approval.** Candidate SHA and subsequent results must be recorded before publishing an immutable Artifact A4 and stopping at the external-review boundary.
