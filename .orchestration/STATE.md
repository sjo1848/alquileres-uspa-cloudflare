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

## External Independent Critic — Artifact A4 (2026-10-12)

- Artifact A4 exact immutable commit: `8e707eadca25e47827b6bc81adaa4f272192af2e`; annotated tag `CF-AU-I00-Artifact-A4` dereferences to that exact commit.
- A4 preserves A3 as an ancestor and includes the canonical main review event `0af0ab4fa368d8b7faf4c7b287ba0d021182bed6`; same PR #6 remains OPEN/unmerged.
- A3 REWORK-2 criteria F1/F2/F3 are repaired and retested. The final local synthetic suite reports 17/17; captured cost rerun matches the canonical calculator JSON; npm audit reports 0 vulnerabilities. Integration Review, all 19 applicable invariants and Pre-Critic are complete.
- Internal independent technical/security/data and research/cost/method critiques and source/runtime specialists have recorded findings and follow-ups. Their evidence does not substitute for the External Independent Critic.
- Final test runtime: Node 24.18.0, Wrangler 4.149.0, Workerd 1.20261006.1; bcrypt latest local elapsed proxy 624/642 ms async and 613 ms sync, not Cloudflare CPU telemetry.
- No Human Gate or material blocker. No merge, production deployment, paid resource, real data, source change or functional migration occurred.
- H1/H2/H3/H4/H6 remain UNRESOLVED; H5 remains narrowly REJECTED for current source-compatible bcryptjs cost-12 on Workers Free. I13 Product Acceptance remains pending.

## Next action

Await External Independent Critic review of exact Artifact A4 `8e707eadca25e47827b6bc81adaa4f272192af2e` (tag `CF-AU-I00-Artifact-A4`). Do not merge PR #6 or begin another increment before the external verdict and any required gates.
