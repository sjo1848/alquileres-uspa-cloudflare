# Mandatory Pre-Critic Gate

Before publishing any substantive artifact for External Independent Critic, Codex must prove:

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

Only after this gate passes may the task be published as an immutable artifact awaiting External Independent Critic.

Codex cannot use this gate to self-declare substantive PASS.
