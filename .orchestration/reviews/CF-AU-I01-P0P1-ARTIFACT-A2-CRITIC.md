# CF-AU-I01-P0P1 — External Independent Critic on Artifact A2

Date: 2026-10-12
**Verdict: REWORK-1 — bounded COST MODEL scope**
Immutable Artifact A2 commit: `f9d8bfa9afb39555649365596be467d88f18d7a8`
Annotated tag: `CF-AU-I01-P0P1-Artifact-A2` — verified to dereference to A2
Publication boundary: `ec851d4e9fcdd729db270ec8a2be4ebcb16039f6` — direct A2 descendant, `PENDING_EXTERNAL_REVIEW` / `resume_authorized=false`, seq 16.
PR: https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8 (OPEN, unmerged at review).
Task: `.orchestration/contracts/CF-AU-I01-P0P1.md`.
**Human Gate: NONE for this bounded evidence repair. Blocker: NONE.**
No new functional migration, remote resources, paid subscription, real customer data, release or deployment authorized.

## Verified/accepted evidence

- Exact A2 annotated tag, history preserving A1, and PR boundary SHA are consistent. A2 and boundary have `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`; A1's publication-state defect is closed.
- 23/23 **recorded grouped local synthetic Workerd+D1 auth tests**; source-compatible bcryptjs cost 12 hashes/JWT/cookies/owner-role changes are evidenced for the explicit subset. Compared source auth controller/service in `sjo1848/alquileres-uspa@267c531f...` against `i01-auth/worker.js`; the fixture is explicitly NOT complete source auth parity. The Controller did **not** independently rerun Workerd. The prior internal security critic's scoped findings remain: incomplete `class-validator IsEmail` equivalence, malformed URI yielding 500, timing account enumeration, numeric JWT expiration config divergence, CSRF, rate-limit/burst and provider CPU unmeasured.
- Final auth metrics in A2 report: bcrypt comparison 567/542 ms successful cold/warm, 631/557 ms invalid cold/warm, integrated unknown account 0 ms versus incorrect password 558 ms, registration hash 644 ms. These are **local elapsed proxies, not Cloudflare provider-billed CPU milliseconds**. The internal cost critic report matches these current figures. No cost-12 work factor weakening is permitted.
- Optional SQLite Durable Objects model now lists requests, active duration, rows read/written and storage rates; it correctly leaves DO actual usage **UNRESOLVED_NOT_INCLUDED_IN_SCENARIO_TOTALS**. No proof that DO is required. No implied fixed monthly spend cap.
- Cost model's printed low/base/high arithmetic is internally consistent for its stated variables, including Workers Paid minimum, D1 assumed scans, R2 rounded units. `npm audit --audit-level=low` zero and the calculation JSON byte-for-byte match are **reported implementation evidence**, not independently re-executed by Controller.
- CF-AU-I00 previous external PASS is preserved; source I13 product approval exists in source Issue #24 but the source's canonical state still needs **separate technical reconciliation**, not a repeated Human gate.

## Binding findings preventing PASS

### A2-F1 — [P2/COST] Registration traffic omitted while cost model claims coverage of every dynamic route

`.orchestration/evidence/fixtures/calculate-i01-cost.mjs`: the scenario `workers` drivers are `catalog,detail,login,ownerAdmin,contact,imageGet`; **`register` is absent in all three scenarios**. `docs/research/CF-AU-I01-P0P1-COST-MODEL.md` says the model includes every dynamic route and is intended as a full-platform route-driven budget, while the actual proof's `POST /auth/register` executes bcryptjs cost-12 and inserts a D1 user. Any nonzero sign-up activity produces additional Worker requests, CPU and D1 rows written, and possibly index writes; the current totals omit all of it. GitHub automated review on A1/03ae raised this risk, which is **still present in immutable A2**.
**Required repair:** add an explicit per-scenario registration driver to the Worker request, bcrypt CPU sensitivity, and D1 write model (including clearly identified assumptions for user/index rows), with a source-route map and update examples/totals/JSON; or bound the study to zero registrations AND drop all claims that all dynamic routes are covered, accompanied by a clear nonzero-registration sensitivity. Prefer the former because P1 centers on both login and registration and the end goal is a complete app. Treat provider CPU as *unmeasured*.

### A2-F2 — [P2/COST] Image deletion/reorder lifecycle operations missing from modeled D1/R2 work

Source `apps/api/src/listings/listings.service.ts` uses read-before-delete of image objects for restoration/compensation and D1 metadata deletion/dense-position compaction; reorder updates positions across a listing. The current calculator only uses uploads, public image GETs, edits and contacts. No explicit delete or reorder driver or resulting R2 Class B `GetObject` and D1 row-read/write/transaction effects are modeled. R2 `DeleteObject` is **free** on Standard, but source read-before-delete is not; reorders can update multiple D1 rows, plus index write amplification. Current model refers to 'OWNER/ADMIN includes mutations' yet understates high-churn inventory and reads.
**Required repair:** introduce an explicit deletion/reorder lifecycle component (e.g., counts per scenario, assumed avg/max images shifted, source-derived D1 row scan/write factors, source object-read-before-delete R2 Class B), propagate into calculated scenarios/totals and update conditional scope. An explicit zero-churn subscenario alone is not enough to claim full-platform cost completeness; include at least a nonzero sensitivity and openly label unknown concurrency/cleanup/retry amplification. Full P2 migration or D1 concurrency proof is NOT required in this P0P1 rework. R2 pricing primary source confirms `DeleteObject` free and `GetObject` Class B: https://developers.cloudflare.com/r2/pricing/.

## Rework exit, evidence and stop

1. Codex must consume this exact review on canonical `main`, reconcile main into **the same PR #8 preserving A1/A2 ancestry** (avoid squash/rebase/cherry-picking only the boundary), and resolve A2-F1/F2 autonomously within `CF-AU-I01-P0P1`; **do not open P2 data concurrency/migration or P3 API implementation** under this authority.
2. Regenerate cost calculator/results deterministically, validate byte-for-byte equality and rerun the independent **cost/method critic against the exact final model**. Reconcile current `COST-MODEL.md`, specialist, Integration Review, limitations and Pre-Critic/validation. Include negative/manual arithmetic or mutation-style checks to catch omitted drivers/units in the model.
3. No unchanged auth Worker, auth test suite or fixture dependencies need be rerun just for cost edits; compare exact A2 blobs and state transparently `not rerun; unchanged`. Rerun auth tests if any relevant executable auth fixture changes. Recheck `npm audit` only if dependency inputs change, else preserve provenance.
4. Preserve all unproven parity/security/CPU findings. No new Human Gate or source repo write. Re-run applicable checks, independent internal review/Pre-Critic.
5. Publish **immutable Artifact A3** with annotated tag and an exact SHA-pinning boundary on the PR, `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, and stop for the next External Independent Critic verdict. PR stays OPEN/unmerged until PASS.
6. No paid/remote Cloudflare resource, production/real-data activity, security weakening, new Task Contract, auto-merge or Runtime Watch activation.

**Disposition:** A2 made meaningful progress and closed A1's three previous evidence defects, but the full-platform route-based cost sensitivity has two material omission errors. **REWORK-1** is necessary and sufficient; no broad reconsideration of the Cloudflare Paid architectural direction.
