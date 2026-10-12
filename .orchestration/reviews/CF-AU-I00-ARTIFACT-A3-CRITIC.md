# CF-AU-I00 — External Independent Critic: Artifact A3
Date: 2026-10-12
Verdict: **REWORK-2** (bounded evidence repair)
Artifact reviewed (immutable): `d935616bb5634a7e357b5da2747767119b2c3464`
Artifact tag: `CF-AU-I00-Artifact-A3` (annotated tag dereferences exactly to artifact SHA)
Publication boundary commit (non-substantive): `db4902ebef4e03af72c41a4e3fc27622d004fccf`
PR: https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/6 (OPEN, NOT MERGED)
Task Contract: `.orchestration/contracts/CF-AU-I00.md`
Previous critic: `.orchestration/reviews/CF-AU-I00-REWORK-1.md`
**Human Gate:** NONE. **Blocker:** NONE. **Authorization:** repair the existing contract; do not begin product migration, Runtime Watch, production, real data, or paid deployment.

## Review method and evidence
ChatGPT External Independent Critic inspected the exact artifact's fixture Worker, tests, SQL, cost calculator/output, research notes, hypotheses, specialist and independent internal critic outputs, invariant matrix, Integration Review, and PR publication boundary on GitHub. Confirmed annotated tag points to `d935616bb5634a7e357b5da2747767119b2c3464` and boundary `db4902ebef4e03af72c41a4e3fc27622d004fccf` is a one-commit descendant recording the review SHA; main baseline remains `452d7649f3d371ae1df5f84dae1a7d1747fa4d47`.
Existing GitHub Codex PR review surfaced the same three defects at the current boundary; this verdict independently corroborates them against the actual artifact. Neither its auto-review nor internal critics constitute this External Critic verdict. This was a static/reproducibility audit of committed evidence; no local Wrangler tests were independently rerun by this Controller.

## Accepted evidence; preserve it
- A3 commits form a linear descendant of the authorized canonical base; historic artifacts A1/A2 remain immutable. Integration must preserve A3's exact commit ancestry and tag: never squash/cherry-pick only the boundary.
- Role-separated source/data and runtime/cost research, independent internal criticism, Integration Review and bounded Pre-Critic are documented.
- Source remains read-only; zero paid resources, real customer data, production deployment or source code migration.
- Test JSON records 17/17 *reported*, cost-12 local sync elapsed 539 ms and async 513/592 ms; this is a **local elapsed proxy**, not Cloudflare CPU telemetry. H1/H2/H3/H4/H6 remain UNRESOLVED; H5 is REJECTED narrowly for the present source bcryptjs cost-12 Workers Free path, not for every alternative topology.
- Image delivery is counted as Worker/R2/D1 activity. Conditional route-driven scenarios and D1 Free exhaustion behavior are appropriately qualified; D1 rows_read scans and burst/actual meter remain unresolved.
- Source I13 Human Product Acceptance is still pending; no product authorization is implied by this review.

## Required bounded REWORK-2
### A3-F1 — [P2] Invalid role test can falsely PASS
File: `.orchestration/evidence/fixtures/rework1-tests.mjs`, test `schema enum checks reject invalid role`, around lines 24–30.
The code catches the deliberate `assert.fail()` when the forbidden `SUPERUSER` insert unexpectedly succeeds; `assert.notEqual(error.status, 0)` then also accepts that error because `status` is undefined.
**Fix:** use `await assert.rejects(sql("INSERT ... 'SUPERUSER'"), predicate)` with validation of an actual SQL/D1 constraint error; assert the bad row does not exist after attempted insert. Falsification: cause the SQL layer to accept that insert in an isolated mutation/regression check and prove the test then FAILS, not PASSES. Re-run suite and update JSON truthfully.

### A3-F2 — [P2] R2 insert-failure compensation only checks 500, not object absence
File: same test runner around `R2 write is compensated after injected D1 insert failure`, lines 116–121; Worker `rework1-worker.js` /images handler.
Returning 500 with the injected error does **not** prove that the R2 object written before failed D1 metadata insert was removed. Removing `IMAGES.delete(key)` would leave an orphan but still satisfy the existing test.
**Fix:** expose a narrowly scoped **LOCAL_FIXTURE_ONLY** inspection hook or deterministic R2 key/listing snapshot that confirms object-set equality before/after this failure and no inserted D1 metadata. Keep object keys private from real API/public handlers. Perform a controlled negative/mutation test showing broken/no-op cleanup makes the compensating test fail. Retain uncertainty about failures beyond this bounded happy compensation.

### A3-F3 — [P2] Stale bcrypt experiment measurement in architecture
File: `docs/architecture/TARGET-ARCHITECTURE.md`, REWORK-1 feasibility paragraph reports **521 ms**, whereas A3 final results, Integration Review and Cost Model record **539 ms** synchronous elapsed.
**Fix:** synchronize architecture to 539 ms, explicitly local elapsed/CPU-bound proxy, not production Cloudflare CPU meter; or clearly label the older run historically. Check other *current summary* claims for stale metric values while preserving immutable historical critique.

## Exit / resumption
1. Codex reads this review from **canonical main** and resolves A3-F1..F3 autonomously under **existing** `CF-AU-I00`; no additional task contract, Human relay, or material architecture/product decision is required.
2. Reconcile latest canonical `main` into existing PR branch WITHOUT deleting/rebasing away A3 immutable ancestry. Retain same open PR #6. Never rewrite/delete historical artifacts or tag.
3. Require the independent internal critics to challenge modified tests and refreshed evidence; rerun local synthetic suite, cost calculator (if impacted), npm audit, Integration Review, applicable invariants and Pre-Critic. Report exact reproducible commands, outputs and versions; no invented PASS.
4. Publish **new immutable Artifact A4** with revised evidence. Boundary state and STATUS must name A4's exact SHA/tag, `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, `external_review.required=true`, and advanced event identity/sequence. Maintain accurate OPEN hypotheses and cost-zero limitations.
5. Stop at next External Independent Critic boundary. No PR merge before PASS. Preserve I13 dependency; do not implement Runtime Watch, modify source, deploy, use real data or paid features in this increment.

REWORK-2 reflects evidence/test correctness defects, **not** a finding that the migration is technically impossible. The current A3 artifact is **NOT PASS**.
