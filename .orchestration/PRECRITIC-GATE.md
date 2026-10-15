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

## CF-AU-I01-P2 consolidated candidate after reorder recovery (2026-10-14)

- Contract scope remains the local synthetic listing/image lifecycle; no frontend migration, production, real data, paid services, remote Cloudflare bindings, merge or source-repository write.
- Latest GitHub P1 stale reorder reservation barrier is addressed by scheduled exact-plan recovery under a D1 listing lease; invalidated plans become nonretryable and no longer block subsequent mutations. The P2 default-test omission is addressed by running the focused retry suite from `npm test`.
- D1/R2 confirmation, compensation, recovery, concurrency and authentication were rechecked. Three independent read-only reviewers found no P0/P1/P2 after the final D1 marker-predicate adjustment. They did not run tests.
- `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check`, `npm run test:retry`, and fresh local D1/R2 `npm test` pass. The complete default test run passed in 1122.2s; the first full attempt caught a marker-recovery mismatch, which was repaired and is recorded (not hidden) in the validation ledger.
- Main was fetched and verified at `91db05fb343d0bc020335bfc05790a2f3f824b82`; this remains an ancestor of the PR branch. The new migration and scheduled hook are code only; no remote binding was selected or deployed. Existing synthetic test harness uses local Wrangler D1/R2.
- Relevant invariants: 1 source remains read-only; 2 no feature expansion; 3 owner enforcement retained and regression suite passes; 6 image/order/storage recovery tested; 8 auth semantics retained and JWT hardening verified; 9 no real data/production/paid transition; 11 main remains GitHub canonical and is unchanged; methods 13/16 exact-SHA read-only Controller review remains required; 14 technical failures were autonomously repaired; 15 this gate is only a pre-review gate; 20 full P0/P1 failure class was re-critically reviewed.
- **Pre-Critic: PASS to push one consolidated candidate for GitHub automated review, then submit its exact immutable SHA to the documented separate `codex exec` Controller. This is not a substantive PASS and does not authorize A4 until that Controller returns a verified technical PASS.** Record model requested, reasoning effort, CLI sandbox, runtime and backend-attestation limits truthfully.

## CF-AU-I01-P2 REWORK-3 supplemental candidate — operation-only and terminal-ledger recovery (2026-10-14)

- The prior GitHub/Controller findings are addressed on the candidate tree: reaper order follows the persisted plan; incomplete reservation halves are read back and recovered; NULL legacy results are filled only under matching fingerprint/state; operation-only reservations converge through the scheduled reaper; terminal retirement repairs the matching idempotency record without releasing the mutation barrier until the operation is confirmed nonretryable.
- Evidence is pinned in `evidence/CF-AU-I01-P2-VALIDATION.md`: `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check`, `npm run test:retry`, fresh `npm test` PASS in 3557.1s (local Wrangler, synthetic D1/R2), and `npm audit --audit-level=high` reports zero vulnerabilities.
- Three independent read-only internal tracks report no actionable P0/P1/P2: reorder/idempotency/concurrency, D1/R2 saga/recovery, and auth/runtime/API. Exact scopes are in `evidence/critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`; critics did not edit or run tests.
- Integration Review confirms `origin/main@91db05fb343d0bc020335bfc05790a2f3f824b82` remains an ancestor, PR #10 remains open/clean, A1–A3 commit history remains intact, and the working tree contains only evidence/gate updates beyond tested checkpoint `5b9fe7d5e6ea756f94267f321cbf12b61805bc8d`. No source repository, production, real data, paid or remote resources were touched.
- Applicable invariants: source read-only, parity scope, owner/auth boundaries, exact order/readback, D1/R2 compensation/recovery, no-cost local synthetic only, and main as canonical were all rechecked. No invariant is marked proven beyond the local evidence above.
- **Pre-Critic: PASS to freeze and push one candidate for GitHub automatic review, then run the documented separate-process `project_controller` on the exact pushed SHA. This is not Controller PASS, external approval, or permission to publish Artifact A4.** Record the requested model/effort/sandbox and runtime/backend attestation limits exactly.

## CF-AU-I01-P2 final consolidated candidate — 2026-10-15

- Scope remains the authorized local synthetic OWNER listing/image lifecycle; source remains read-only; no remote Cloudflare resource, billing, deployment, production data, merge or scope expansion.
- Final local code delta fixes auth middleware error classification and post-commit DELETE backup-only cleanup/recovery. Independent auth and D1/R2 critiques found no material issue; details in `evidence/critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`.
- Full `npm test` passed in the prior session on unchanged executable content (527.4s, synthetic local Wrangler D1/R2). Current-session typecheck, HTTP/retry syntax, focused `npm run test:retry` and `git diff --check` also pass. Provenance and hashes are in `evidence/CF-AU-I01-P2-VALIDATION.md`; the old pause checkpoint that said interrupted was stale and corrected.
- Current `main` base `ed52e7e17f6378e62d14896a095f54abb7304f66` is an ancestor of PR #10. Existing Artifact A1–A3 ancestry is preserved. GitHub automatic review of the exact consolidated commit and delegated GPT-6 Luna/High/read-only Controller review are still required.
- **Gate: PASS to publish one consolidated candidate to PR #10 and run exact-SHA GitHub and Controller reviews. This is not substantive Controller PASS or authorization to tag Artifact A4 yet.**
