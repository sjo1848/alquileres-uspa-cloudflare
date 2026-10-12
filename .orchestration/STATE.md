# Canonical State — Alquileres Uspallata Cloudflare Lab

State: `PENDING_EXTERNAL_REVIEW`
Phase: `DISCOVERY / FEASIBILITY`
Active task: `CF-AU-I00 — Baseline, feasibility and cost-zero validation`

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

## External Independent Critic — Artifact A4 REWORK-3 disposition

- A4-F1 repaired under the existing CF-AU-I00 contract: the stale trailing cost-critic note no longer presents intermediate timing values as current. It explicitly withdraws the 539 ms / 645/552 ms attribution and points to final immutable A4 evidence (624/642 ms async, 613 ms sync local elapsed proxy).
- No test, cost calculation, application code or dependency changed. A4 test/evidence blobs are recorded and unchanged; the External Critic explicitly instructed not to repeat them for this documentation-only correction.
- Independent cost-provenance verification is persisted in `.orchestration/evidence/critics/a5-cost-provenance-critic.md`; Integration Review and Pre-Critic were refreshed for the exact evidence correction.
- No Human Gate or blocker. No source changes, product migration, real data, production deployment, paid resources or merge.

## External Independent Critic — Artifact A5 (2026-10-12)

- Exact immutable Artifact A5 commit: `2b09ee585f24102b03bd6d6b7f44d6c5f61ad053`; annotated tag `CF-AU-I00-Artifact-A5` dereferences to this SHA.
- Artifact A4 `8e707eadca25e47827b6bc81adaa4f272192af2e`, A3, and canonical main A4 review event are preserved in PR #6 ancestry.
- Final result provenance is unchanged from A4: 17/17 local synthetic checks, 624/642 ms async and 613 ms sync bcrypt elapsed proxy. No test/cost/audit rerun was needed or claimed.

## Next action

Await External Independent Critic review of exact Artifact A5 `2b09ee585f24102b03bd6d6b7f44d6c5f61ad053` (tag `CF-AU-I00-Artifact-A5`). Do not merge PR #6 or start another increment before the external verdict and any required gates.
