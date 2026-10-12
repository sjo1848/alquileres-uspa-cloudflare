# CF-AU-I00 — External Independent Critic: Artifact A5
Date: 2026-10-12
**Verdict: PASS — TECHNICAL ACCEPTANCE OF THE BOUNDED DISCOVERY / FEASIBILITY RESEARCH CONTRACT ONLY**
**Artifact reviewed (immutable):** `2b09ee585f24102b03bd6d6b7f44d6c5f61ad053`
**Annotated tag:** `CF-AU-I00-Artifact-A5` — verified to dereference exactly to A5 commit
**PR publication boundary:** `7c6db892822e0fdd069d302d45d1c0f2451be043` — direct A5 descendant, OPEN/unmerged at review
**Contract:** `.orchestration/contracts/CF-AU-I00.md`
**Prior binding review:** `.orchestration/reviews/CF-AU-I00-ARTIFACT-A4-CRITIC.md` (REWORK-3)
**Human Gate for accepting the research itself:** NONE
**Product / deployment / paid-resource authorization:** NONE

## Evidence inspected
- Exact A5 source and GitHub commit tree; A4 is an ancestor of A5 and A5 an ancestor of PR #6 boundary. A3/A4 artifacts and prior review main commit remain reachable through PR branch lineage.
- A4 → A5 comparison: only research/critic/Pre-Critic/Integration Review documentation and the canonical review-state files changed. No Worker, test runner, Wrangler configuration, dependency lock, cost calculator or archived test/cost results changed.
- `research-cost-method-critic.md` at A5: last section is explicitly titled `Superseded intermediate timing note — 2026-10-12 (A4-F1 corrected)`; it withdraws 539 ms sync / 645/552 async as current A4 observations and points to the actual immutable A4 result: **624/642 ms async, 613 ms sync**, 17/17 local synthetic tests. No mislabelled current/final timing remains in that concluding section.
- Independent internal one-file provenance critic: `.orchestration/evidence/critics/a5-cost-provenance-critic.md` verifies the exact A4 test-results blob `758a584bd7cf9f6c3e2754203710438edd2910ba`, non-rerun provenance and metric correction.
- Updated Integration Review and Pre-Critic Gate at the PR publication boundary identify exact A5 SHA/tag and the reuse of A4's unchanged technical inputs/results.
- Prior External Critic reviews of A3/A4 closed the mutant-sensitive role-constraint test, orphan detection under D1 insert failure, conditional D1+R2 cost model, source-parity API-mediated image route, and narrow local fixture security boundary.
- Reviewer independently checked GitHub documentation, commit relationships, blobs/cost equality and test source; **did not independently run local Wrangler/Workerd, npm audit or load tests.** The inherited 17/17 and npm audit zero are *recorded* A4 observations, not fresh Controller runtime results.
- This PASS is for a completed and honestly bounded feasibility evaluation with negative/unresolved outcomes; it does NOT imply acceptance of a Worker production design.

## Research findings that survive PASS
1. **H1/H2/H3/H4/H6: UNRESOLVED.** Source-specific Vue browser/Static Assets, NestJS parity, PostgreSQL migration/locking to D1, full R2 lifecycle, and cross-project method effectiveness remain unproven. Local synthetic path checks have narrower evidentiary scope.
2. **H5: REJECTED in the current source-compatible bcryptjs cost-12 Workers Free topology.** Local synchronous Workerd elapsed **613 ms** vs configured 10 ms CPU budget is a strong CPU-bound *proxy*, not actual Cloudflare CPU metering. Do not silently weaken bcrypt work factor or claim all alternate free approaches impossible.
3. Conditional illustrative Worker request counts lab/early/growth 247/8,650/122,500 per day; growth exceeds 100,000/day; D1 modeled 2,427/88,150/1,212,500 rows read/day and R2 figures are assumptions, not observed load. D1 query-plan reads, peaks, traffic validity and static routing remain unmeasured.
4. Source product I13 Human Product Acceptance pending; this lab cannot override it.

## Exactly what this PASS authorizes next
- **Mechanical integration of PR #6 only**, by Codex as Execution Owner, after verifying current refs, all required review/CI constraints and invariant evidence. Use a **history-preserving merge commit or equivalent true fast-forward**, NEVER squash/rebase or cherry-pick only the boundary commit. A5 and A3/A4 must remain reachable from the resulting `main`.
- Verify post-merge main contains A5, final `STATUS.json` and this exact PASS review, no artifact SHA has changed, no substantive source/test changes. If an actual merge conflict changes substantive evidence, STOP and seek a fresh external review instead of auto-approving it.
- Close Issue #4 and mark CF-AU-I00 research complete only when integration evidence is persisted and correct. Do **not** start a functional Cloudflare migration, Runtime Watch execution or a new Task Contract as an automatic consequence of this PASS.
- **Post-integration Human Gate (separate from research acceptance):** resolve material architecture/cost choice after H5 rejection (e.g., maintain hybrid external API/PostgreSQL vs investigate a parity-preserving no-cost auth alternative), and the product source I13 acceptance dependency. No paid service, production deploy, real data or silent change to auth/security can be authorized by this PASS.
- At end of routine integration: persist completed/stop state with `resume_authorized=false` pending the real product/architecture decision; do not leave an open autonomous migration authorization.

## Disposition
**PASS for CF-AU-I00 discovery/feasibility contract.** REWORK-1/2/3 are resolved at the evidence level; no additional documentation-only revision is requested. The outcome of the hypothesis study is not an authorization to adopt the rejected zero-cost topology.
