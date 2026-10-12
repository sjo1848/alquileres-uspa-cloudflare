# Canonical State — Alquileres Uspallata Cloudflare Lab

State: `PENDING_EXTERNAL_REVIEW`
Phase: `FULL_CLOUDFLARE_ARCHITECTURE`
Active task: `CF-AU-I01-P0P1 — local baseline, synthetic auth feasibility and cost model`

> Historical note: earlier bootstrap, CF-AU-I00, and Artifact A1/A2 entries are retained as audit history. The latest canonical transition is recorded in the most recent CF-AU-I01-P0P1 section at the end of this file and mirrored in `.orchestration/STATUS.json`.

## Source baseline

- Source repository: `sjo1848/alquileres-uspa` (read-only reference).
- Source repository main at lab bootstrap: `cff14159daa1698a9ee04ea317c4a2c356112ae0`.
- Current product candidate underlying that source state: I13 candidate `8e11bebdb197321d500678f06233d6f174f03438`.
- I13 Human Product Acceptance in the source project is still pending at bootstrap. Therefore CF-AU-I00 may research/validate migration feasibility, but substantive parity implementation must not silently assume I13 is permanently accepted.

## Authorized work

CF-AU-I00 is authorized to:

- inventory source architecture and behavior;
- pin parity surfaces and migration scope;
- validate Workers/D1/R2 feasibility;
- validate application-auth compatibility on Workers;
- map PostgreSQL/Prisma schema and migrations to a D1/SQLite strategy;
- validate image-object flow to R2;
- build a zero-cost usage model against current Cloudflare free-tier limits;
- define falsification criteria and the next bounded migration increment;
- produce reproducible evidence and a Pre-Critic package.

CF-AU-I00 is NOT authorized to:

- deploy production;
- use real customer data;
- create paid resources or accept recurring cost;
- change product semantics;
- declare the target architecture proven before evidence;
- begin a broad migration implementation without closing feasibility and source-product dependency.

## Working target hypothesis

`Vue 3 + Vite Static Assets → Cloudflare Workers`

`API → Workers + Hono + TypeScript`

`PostgreSQL/Prisma → D1/SQLite-compatible persistence`

`Listing images → R2`

Application authentication/authorization semantics remain parity-first.

## Research framing

This project is a second Cloudflare migration laboratory alongside HMS Cloudflare. It exists to test whether the Project Method and Cloudflare architecture generalize to a different application topology and domain.

A cross-project thesis is not yet authorized as fact. It may only be formulated after evidence from both labs supports or falsifies reusable claims.

## External Independent Critic — REWORK-1

Artifact reviewed: `08fbf91f6e87c45db1d2f97fbb5793f75e1881b7`.
Verdict: `REWORK-1`.
Human Gate: none.
Blocker: none.

Accepted/reusable evidence includes the pinned source inventory, parity/risk baseline, local Worker+D1+R2+Web Crypto primitive proof, conditional official-limit cost baseline, and preservation of negative findings.

The artifact is not eligible for PASS because it diverges from the current hardened canonical method, lacks required specialist/independent-critic/Integration-Review evidence, has an invalid external-review state boundary, claims Pre-Critic readiness while an applicable invariant remains PENDING, leaves required auth/R2 lifecycle feasibility incomplete, overstates several hypothesis verdicts, and does not yet derive the cost envelope from the route/data drivers required by its own model.

Binding findings and exit criteria are in:

`.orchestration/reviews/CF-AU-I00-REWORK-1.md`

## External Independent Critic — Artifact A3 REWORK-2 (2026-10-12)

- Reviewed exact immutable Artifact A3: `d935616bb5634a7e357b5da2747767119b2c3464`, annotated tag `CF-AU-I00-Artifact-A3`; PR #6 boundary `db4902ebef4e03af72c41a4e3fc27622d004fccf` remains OPEN/unmerged.
- **Verdict: REWORK-2**. Three bounded evidence defects: invalid enum test false-PASS; R2 insert-failure compensation lacks orphan-absence assertion; architecture bcrypt measurement 521 ms disagrees with final 539 ms.
- Verdict and corrective acceptance criteria: `.orchestration/reviews/CF-AU-I00-ARTIFACT-A3-CRITIC.md`.
- No Human Gate; no technical blocker; `resume_authorized=true` to let Codex repair **within CF-AU-I00**. External review resumes only after a new immutable Artifact A4 and green Pre-Critic.
- Previously accepted research and uncertainties remain: H1/H2/H3/H4/H6 UNRESOLVED, H5 narrow bcryptjs cost-12 Workers Free rejection; source I13 Product Acceptance pending.
- Main is canonical for the review event, while PR #6 retains the immutable A3 lineage; preserve that lineage when reconciling branches. No merge, production, real data or paid resources.

## External Independent Critic — Artifact A4 REWORK-3 (2026-10-12)

- Immutable reviewed artifact: `8e707eadca25e47827b6bc81adaa4f272192af2e`, annotated tag `CF-AU-I00-Artifact-A4`; PR #6 at boundary `323365c19f68200c08521f56e467bd4273cc9167` remains OPEN/unmerged.
- **Verdict: REWORK-3, only one bounded evidence-document correction.** Roles negative mutation and D1/R2 orphan-compensation negative mutation close substantive A3 findings. Reachability is preserved on PR branch; future integration must retain ancestry.
- **A4-F1:** latest appended `research-cost-method-critic.md` spot check incorrectly calls historical bcrypt 539 ms the *current* REWORK-2 result despite final A4 624/642 ms async and 613 ms sync. Label/reconcile historical observation and align latest evidence; see `.orchestration/reviews/CF-AU-I00-ARTIFACT-A4-CRITIC.md`. Do not redo unchanged code or cost calculator work.
- No Human Gate or technical blocker. Codex may autonomously repair A4-F1 under existing CF-AU-I00 and publish immutable A5/next boundary for external review. No feature migration, source changes, merge, production, paid resources, or Runtime Watch implementation.
- H1/H2/H3/H4/H6 remain UNRESOLVED, H5 narrow source bcrypt cost-12 Workers Free rejection only; I13 Product Acceptance pending.

## External Independent Critic — Artifact A5 PASS (2026-10-12)

- Immutable reviewed Artifact A5 `2b09ee585f24102b03bd6d6b7f44d6c5f61ad053`, tag `CF-AU-I00-Artifact-A5`; PR #6 boundary `7c6db892822e0fdd069d302d45d1c0f2451be043` remains OPEN/unmerged.
- **PASS of the bounded CF-AU-I00 feasibility/discovery contract only**. Exact review: `.orchestration/reviews/CF-AU-I00-ARTIFACT-A5-PASS.md`; A4-F1 timing-provenance correction is closed and previous test/compensation findings remain closed.
- No executable change or test/audit rerun between A4/A5. A4's 17/17 local synthetic checks and 0 npm vulnerabilities are reported historic evidence, **not new Controller runtime tests**.
- H1/H2/H3/H4/H6 remain UNRESOLVED and H5 remains narrowly REJECTED for source bcryptjs cost-12 Workers Free. No Cloudflare Free operational or product-parity approval is implied.
- **Integration only authorized**: Codex may merge PR #6 preserving A5/A4/A3 ancestry, verify exact artifact and verdict reachability on `main`, persist closeout and close Issue #4. Never squash/rebase/cherry-pick only boundary. Do not implement next migration/runtime watch increment as part of this authority.
- **Human Gate after integration**: material zero-cost architecture/topology decision following H5 negative result and I13 Product Acceptance before migration. No paid, production, real-data or security weakening authorized.

## Cloudflare platform decision and bounded CF-AU-I01-P0P1 authorization (2026-10-12)

- Human product direction is now **100% Cloudflare, complete application**. A static recruiter demo is NOT the destination. Strict USD 0 requirement is explicitly lifted; paid Cloudflare services may be evaluated, **but no cost has been authorized**.
- Decision with financial safeguards: `.orchestration/decisions/CF-AU-I01-CLOUDFLARE-COST-POLICY.md`.
- I13 Human Product Acceptance PASS was explicitly issued on source [Issue #24 comment](https://github.com/sjo1848/alquileres-uspa/issues/24#issuecomment-5891503272). Source `STATUS.json` still says pending; it is an existing *state reconciliation task*, **not** a new pending Human Product Acceptance decision. Source remains read-only here.
- New bounded lab Task Contract: `.orchestration/contracts/CF-AU-I01-P0P1.md`. Codex is authorized for **local synthetic P0 source pin/parity + P1 source-compatible authentication proof and Workers Paid cost study ONLY**. No functional migration, source writes, remote Cloudflare resources, payment or public deployment.
- Canonical transition from I00 closed Human Gate is **only into this local authorized research task**. Future payment/overage/deploy and data migration decisions remain gated independently; no blanket spending authorization is implied.
- After internal critics, integration, evidence and Pre-Critic, publish immutable Artifact for External Independent Critic and STOP. Preserve I00 PASS historical evidence; H1-H4 etc not falsely resolved.

## External Independent Critic — CF-AU-I01-P0P1 Artifact A2 REWORK-1 (2026-10-12)

- Reviewed immutable Artifact A2 `f9d8bfa9afb39555649365596be467d88f18d7a8`, annotated tag `CF-AU-I01-P0P1-Artifact-A2`; publication boundary `ec851d4e9fcdd729db270ec8a2be4ebcb16039f6`; PR #8 open and unmerged.
- **Verdict: REWORK-1, cost model ONLY.** Canonical review: `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A2-CRITIC.md`.
- A1 defects are closed: in-artifact external-review STOP, current independent cost critic timing reconciliation, DO all five price-meter categories disclosed. The 23/23 recorded synthetic local auth checks remain valid as bounded evidence with security and provider CPU caveats.
- **A2-F1:** registration route omitted from Workers request/bcrypt CPU/D1 user-write driver while claiming all dynamic routes. **A2-F2:** image delete/reorder not represented in R2 read-before-delete and D1 mutation/read/compaction costs. Both are bounded model omissions; no deployment/security code change authorized.
- No Human Gate or technical blocker. Resume Codex **only under existing CF-AU-I01-P0P1** to fix two cost drivers, rerun deterministic cost arithmetic/independent cost critic, keep unchanged auth test provenance, Pre-Critic and publish immutable A3 for external review.
- CF-AU-I00 remains closed; source I13 PASS is documented but canonical source state reconciliation is separate. No functional migration, deployment, real data or paid service authorized.

## External Independent Critic — CF-AU-I01-P0P1 Artifact A3 REWORK-2 (2026-10-12)

- Reviewed immutable A3 `917119138433fd1f413331970fe4ccc7ce660841`, annotated tag `CF-AU-I01-P0P1-Artifact-A3` and boundary `9ed93722f1fcb2f7e480f7c240c50fe30ca86dd9` on PR #8. **Verdict: REWORK-2, one QA-only correction**; binding review `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-CRITIC.md`.
- **A2-F1/F2 CLOSED.** Registration CPU/request/D1 and image-delete/reorder R2/D1 are now included and independently recalculated for 9 scenarios. USD 5 low/base, USD 23.1467/26.8367/47.3367 high at hypothetical auth CPU. Not measured provider billing or authorization.
- **A3-F1:** negative mutant for deletion prefetch wrongly zeros *all* R2 Class B, so it fails even without detecting a realistic omission of delete-prefetch. Require a source-derived `imageDeleteObjectReads == imageDelete * 1` guard and a coherent mutant preserving public/admin image GETs.
- Existing 23/23 synthetic A2 auth evidence and npm audit 0 preserved by exact matching blobs; no unchanged auth rerun needed. No Human Gate/blocker. Codex may fix only QA validator and related criticism/Pre-Critic within P0P1, publish immutable A4 for External Independent Critic and STOP.
- No PR merge, migration, remote/paid/production/data action or new task authorized.

## Next action

CF-AU-I00 remains technically closed with a bounded research PASS. The Human has now selected full Cloudflare as the destination and waived strict free-only design, without authorizing spending. Codex must execute only the **single QA mutation-test correction** in `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-CRITIC.md` under existing `.orchestration/contracts/CF-AU-I01-P0P1.md`, then publish immutable Artifact A4 and stop at External Independent Critic. Source I13 product acceptance already received Human PASS and awaits technical state reconciliation; do not repeat that gate. No broad migration, paid resource, remote deploy, production, real-data action, or Runtime Watch activation is authorized.

Integration evidence: `.orchestration/evidence/CF-AU-I00-INTEGRATION-CLOSEOUT.md`.

## CF-AU-I01-P0P1 — Artifact A1 external-review REWORK (2026-10-12)

- Bounded task contract: `.orchestration/contracts/CF-AU-I01-P0P1.md`; authorization is local/synthetic P0 source baseline + P1 auth feasibility and Workers Paid cost sensitivity only.
- Canonical lab `main` at task start: `84930c4ba59d133e40099aebb0edd0a8584fb6ab`. Exact source repository `main` checked through GitHub: `267c531f3e3d5869240894063d3a194fa1f9680b`; no API semantic drift from accepted I13 candidate found. Source repo remains unchanged. Its I13 `STATUS.json` discrepancy is a separate reconciliation prerequisite before migration.
- Immutable evidence Artifact A1: commit `db0f18f062635d687e72ced0d0d405b9faa351ab`, annotated tag `CF-AU-I01-P0P1-Artifact-A1`.
- External-review boundary: PR #8, `https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8`, base `main`, head `work/cf-au-i01-p0p1`; unmerged. Review the exact artifact commit/tag, not a moving summary.
- Local Workerd/synthetic D1 auth proof: 23/23 grouped checks; npm audit found 0 vulnerabilities; syntax and whitespace checks passed. Cost calculator output was independently recomputed and matches the result JSON. See `.orchestration/evidence/CF-AU-I01-P0P1-VALIDATION.md`.
- Internal technical/auth critic and cost-method critic closed their bounded findings. Integration Review, all-invariant matrix and Pre-Critic publication gate are included. Pre-Critic PASS means the evidence package is ready for external review only; it is not a feasibility/product/security PASS.
- Preserved unresolved limits: full `class-validator` email parity; malformed percent URI source 500; account-enumeration timing; logout does not revoke issued bearer JWT; provider-billed CPU and burst traffic unmeasured; D1 production row counts and R2 lifecycle not exercised; full API migration unimplemented; source I13 canonical status remains stale.
- No paid plan/billing, remote Cloudflare resource, source write, production, real customer data, migration feature, P2/P3, or Runtime Watch was started.
- GitHub automated review of exact Artifact A1 (reviewed commit `db0f18f062635d687e72ced0d0d405b9faa351ab`) posted bounded rework findings at PR #8 discussion IDs `4252024073`, `4252024082`, `4252024089`: make the state boundary visible with the reviewed package, refresh the independent cost critic report against final timings, and include/exclude explicitly the optional DO SQLite row-read/write meters. No Human Gate or material blocker was classified.
- **Authorized routine rework:** continue under the same CF-AU-I01-P0P1 contract. Preserve A1 tag/commit ancestry, close all three findings, rerun cost calculations, independently re-review changed evidence, repeat Integration Review and Pre-Critic, then publish immutable Artifact A2 and a new external-review boundary. No migration, merge, paid service, remote resource, production, real data or source write.
- The A1 rework corrections are now included in the A2 candidate: refreshed independent cost-critic report and final timing alignment; official optional SQLite DO rows-read/write meters with DO total still explicitly unresolved; and in-tag publication stop state.

## CF-AU-I01-P0P1 — Artifact A2 publication state (2026-10-12)

- Artifact A1 commit/tag remains immutable and reachable. All three A1 automated-review findings are resolved in the A2 candidate as recorded in `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A1-AUTOMATED-REVIEW-REWORK.md`.
- Immutable Artifact A2: commit `f9d8bfa9afb39555649365596be467d88f18d7a8`, annotated tag `CF-AU-I01-P0P1-Artifact-A2`. The artifact commit itself contains `runtime_status=PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, and the known tag; the exact SHA is pinned in the following boundary commit.
- PR #8 remains the open, unmerged review surface. Review is requested on exact commit `f9d8bfa9afb39555649365596be467d88f18d7a8` and tag `CF-AU-I01-P0P1-Artifact-A2`; the boundary commit records the SHA.
- At publication time the next action was to await the External Independent Critic. This historical A2 boundary was superseded by the canonical REWORK-1 event below.

## CF-AU-I01-P0P1 — Artifact A2 REWORK-1 execution (2026-10-12)

- Canonical authorization is `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A2-CRITIC.md` from `main@66a56a193ec418e28b17ca871df2289bf706edef`, event seq 17. It authorizes only the two bounded cost-model repairs A2-F1/A2-F2 under the existing P0P1 contract.
- Main was merged into the same open PR branch by merge commit `f2f3e08223807bdecfb4640dd480920391a90f2d`; A1 and A2 lineage remains reachable. The STATUS conflict was resolved in favor of canonical main's REWORK-1 verdict and `READY_TO_RESUME` authorization.
- A3 candidate now has nonzero registration Worker/bcrypt/D1 user+index drivers, image delete read-before-delete R2 Class B plus D1 lookup/compaction, and image reorder D1 read/write assumptions. Dispositions and exact formulas are in `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A2-REWORK1-CLOSURE.md`.
- Auth implementation/tests and fixture dependencies remain byte-identical to A2 and were not rerun, per the external critic's scope direction. Independent cost review recorded bounded PASS; Integration Review and Pre-Critic are complete for publication only.
- Immutable Artifact A3 will contain `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, and the known tag; its exact SHA is pinned in the following boundary commit on PR #8. No merge, functional migration, paid service, remote resource, production, real data or source write.


## CF-AU-I01-P0P1 — Artifact A3 external-review boundary (2026-10-12)

- Canonical main at rework start: `66a56a193ec418e28b17ca871df2289bf706edef`; merged into the open PR branch without rewriting A1/A2 history at `f2f3e08223807bdecfb4640dd480920391a90f2d`.
- External REWORK-1 findings A2-F1/F2 are closed in `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A2-REWORK1-CLOSURE.md`; independent cost-method review is bounded PASS in `.orchestration/evidence/critics/i01-cost-method-critic.md`. Integration Review, invariant matrix and Pre-Critic PASS are included in this artifact.
- Immutable Artifact A3: commit `917119138433fd1f413331970fe4ccc7ce660841`, annotated tag `CF-AU-I01-P0P1-Artifact-A3`; PR #8 remains open and unmerged. This boundary pins the exact artifact SHA for external review.
- **Next action: await the External Independent Critic verdict on Artifact A3.** No merge, functional migration, paid service, remote resource, production, real data or source write is authorized by this boundary.


## CF-AU-I01-P0P1 — Artifact A3 REWORK-2 execution

- Canonical authorization is from `main@b7f49a6`; event seq 20, no Human Gate or blocker. The binding scope is solely A3-F1 in `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-CRITIC.md`.
- Main was integrated into the same PR #8 branch with merge commit recorded in history; A1/A2/A3 ancestry is retained. STATUS conflict was resolved in favor of canonical main REWORK-2 and its `READY_TO_RESUME` authorization.
- Repair required: make `imageDeleteObjectReads = imageDelete × source GetObject-before-delete factor` a validated invariant and replace the old broad zero-R2 negative case with a coherent missing-prefetch mutant preserving public/ADMIN GET operations.
- The validator now pins the source GetObject factor to one and binds each scenario's prefetch reads to the image-delete route driver. A coherent high-scenario mutant preserves public/ADMIN GETs, recomputes the R2 aggregate and rounding, and is rejected specifically by that source-binding invariant. The independent QA critique is `.orchestration/evidence/critics/i01-cost-qa-critic-a3-f1.md`; closure experiment is `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-REWORK2-CLOSURE.md`.
- Pre-Critic Gate is PASS to publish exact immutable A4. The artifact commit is prepared to carry `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, and the known A4 tag; the next boundary commit will pin its exact SHA on PR #8.
- **Next action:** await External Independent Critic verdict on Artifact A4. No merge, deployment, paid services, or new task.


## CF-AU-I01-P0P1 — Artifact A4 external-review boundary (2026-10-12)

- Canonical authorization: `main@b7f49a6`, event seq 20. A3-F1 was the only authorized change; the PR branch includes main through merge commit `d2eb6e0` without rewriting A1/A2/A3 ancestry.
- The coherent prefetch mutation defect is closed in `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A3-REWORK2-CLOSURE.md`; focused independent QA verdict is in `.orchestration/evidence/critics/i01-cost-qa-critic-a3-f1.md`. Integration Review, invariant evidence and Pre-Critic PASS are included for publication only.
- Artifact A4 tag: `CF-AU-I01-P0P1-Artifact-A4`. Its exact commit SHA is pinned in the following boundary commit; PR #8 remains open and unmerged.
- **Next action: await External Independent Critic verdict on exact Artifact A4.** No merge, deployment, paid service, production, real data or new task is authorized.
