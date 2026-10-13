# Autonomous Local Delivery Train v1 — Alquileres Uspallata Cloudflare

Date: 2026-10-13
Authority: Human explicit request for greater Codex autonomy in the existing 100% Cloudflare goal; Controller-defined safeguards.
**Status: AUTHORIZED for local/synthetic work only, subject to per-milestone independent review.**
Source of original product truth: `sjo1848/alquileres-uspa` READ-ONLY.
Target: eventual full app in Cloudflare Workers Static Assets + Workers/Hono + D1 + R2; Paid allowed as architectural candidate, **not** purchased or remotely provisioned.

## Why change

P0/P1 research and implementation experienced multiple external feedback loops around successive errors in the same behavior family. External review remains useful for security and data integrity, but the **work boundary is too small**. The durable outcome needs to be a working local product slice; engineers must own defect families end-to-end, not just reproduce review-specific assertions.

## Delegation rules

Codex Execution Owner is responsible for **entire local engineering loop**:
`read canonical authority → plan issue-sized behavior → execute specialists → implement → adversarial tests & failure injection → independent internal security/data critics → fix all material P0/P1 defects → request/read GitHub automated PR review → repair new material findings → run full relevant tests → Integration Review → Pre-Critic → publish release candidate for external review`.

Codex may make multiple commits and repair related defects without new Human/Controller messages, and coordinate distinct specialist agents. Existing `AGENTS.md` still prohibits self-PASS of substantive release candidates. **A GH automated Codex review and internal critiques are review aids, NOT substitutes for final independent ChatGPT Critic on a release checkpoint.**

### Current P2 milestone — now

Artifact A3 `8e5b67668686f8543a8facc632d53f4535837c3c` is externally **REWORK-3** for confirmed-delete-after-commit backup cleanup failure; exact scope and executable exit criteria are in `.orchestration/reviews/CF-AU-I01-P2-ARTIFACT-A3-CRITIC.md`.
- Codex fixes the **entire bounded acknowledgment/idempotency/failure-response class** across the OWNER/D1/R2 image journey; not one line at a time.
- Internally re-criticise repeatedly, handle Codex PR review findings *before* immutable publication. **P0/P1 substantive failures are BLOCKING**. Minor P2 style/naming/docs do not block when they cannot falsify a claim, hide security issues or affect contract acceptance.
- Preserve previous evidence and SHA chain, publish **one new P2 release candidate** after all internal severe findings resolved. No self-merge. External PASS required before moving P2 onto main.

### Following conditional local delivery phases — no extra Human dispatcher

**Condition precedent:** P2 obtains real external PASS, integration onto `main` preserves evidence and is verified. Without this condition, no autonomous phase expansion.

On satisfaction, Codex may autonomously write focused child Task Contracts and implement **local synthetic parity slices** under the standing umbrella Issue #7, without a fresh Human decision for every ticket:
- **P3 Market API:** public approved listings/catalog/detail/image rules; owner listing edits/status flows; ContactEvent and confirmation semantics; data migration/schema scope and API tests; ADMIN approval/moderation/audit only when source semantics are precisely mapped and independently security-reviewed.
- **P4 Application integration:** Vue/Vite UI wired to local Cloudflare Worker/D1/R2 API for visitor + owner + admin journeys as source supports; browser/mobile QA and end-to-end smoke; align response shapes and authenticated sessions.
- Use a staged **integration branch / bounded PR train**. Specialists may integrate nonfinal implementation internally on that branch after internal QA; **do not merge substantive code to main** without external PASS at a functional checkpoint.
- External Independent Critic reviews a **coherent executable milestone** (e.g., P3 API vertical train, then P4 UI-connected train), not each internal fix, commit or evidence-note update. Once each major milestone PASSes, Codex may deterministically integrate and proceed to the next already authorized local phase. Any new major source product question must stop for Human classification.
- Each milestone must ship real local HTTP/browser behavior, source contracts and necessary tests. Avoid re-running the entire ~10 minute suite for every docs edit: targeted regressions during implementation, full suite at major code freeze. Proof of what was and was not rerun is mandatory.

## Independent severity gates

**Blocking P0/P1:** cross-OWNER exposure, auth bypass, irreversible/corrupt data, incorrect success/failure acknowledgment after committed operation, concurrency invariants or ghost objects, CSRF, leaked secrets, materially untested negative guard, source-contract semantics breach, deploy/paid/real-data boundary crossing. Rework internally before next external checkpoint.
**Potentially nonblocking P2:** stylistic docs, benign naming, performance improvements without proven SLA failure, inherited hyphen filename policy for P2 unless user changes policy; record with owner and exit criteria.
**Human Gate:** material product scope/semantics, genuine architecture choice beyond standing Workers Paid/D1/R2 candidate, accepted security-risk exception, billed resource/subscription/overage, real records, remote staging, public/production deploy, cutover. The user lifting strict USD 0 is **NOT spending authorization**.
**BLOCKED:** demonstrable technical impossibility or no safe solution after bounded diagnosis; do not relabel as Human decision.

## Authorization and runtime trust boundary

- Codex may modify **lab repo only**, local code, synthetic fixtures, tests, child issues/PRs and bounded contracts.
- No original `alquileres-uspa` repo writes, account provisioning, remote `wrangler` bindings, payment, production, externally exposed URLs, secrets, real customer data, Runtime Watch unattended execution, or auto-merging critical PRs.
- This delegation does not start Codex by itself: GitHub instructions are authorizations, not a background process. Runtime Watch Issue #5 remains DESIGN_READY / NOT ENABLED. Unattended execution must first satisfy independent credential separation and runner security gates.
- External reviews remain independent. Codex is **not** authorized to forge or change a Controller/Human verdict. Persistent state updates must be attributable to the correct authority; a STATUS flip alone is not a secure authorization boundary.
- When within authorized work and a session ends, persist `READY_TO_RESUME` with exact next step. Do not ask Human to act as message courier. Stop only at substantive checkpoint review, real Human Gate or proven blocker.

## Measure improvement

Track per major functional milestone: number of external artifacts and repeated review cycles, time spent testing vs new behavior, P0/P1 reopened at final review, runnable routes and successful browser/user workflows. Aim for **one substantive external review per coherent functional milestone**, not an infinite loop of tiny artifact rewrites. **Quality remains a gate, not optional.**
