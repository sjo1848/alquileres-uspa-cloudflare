# CF-AU-I01-P0P1 — Cloudflare Full-Platform Baseline and Authentication Feasibility

Status: `AUTHORIZED — LOCAL RESEARCH / SYNTHETIC PROOF ONLY`
Controller authorization: 2026-10-12, bounded follow-on to the Human decision that strict USD 0 is **not** a requirement.
Active issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/7
Source project: `sjo1848/alquileres-uspa` (READ-ONLY).
I00 prior PASS: `main@13063632477dec7c75a9c1955285df4502bf3321`, exact immutable A5 `2b09ee585f24102b03bd6d6b7f44d6c5f61ad053`.
Human I13 Product Acceptance PASS: source repo Issue #24, comment https://github.com/sjo1848/alquileres-uspa/issues/24#issuecomment-5891503272 ; source `STATUS.json` still not reconciled. Treat this discrepancy as an auditable dependency to resolve before product migration. Do not re-ask the Human to repeat I13 acceptance.

## Fixed objective

**Full Alquileres Uspallata eventually runs only on Cloudflare.** Not a static-only demo, and not a hybrid external API/database. This contract authorizes evidence-building, NOT release, billing or source-product edits. Candidate stack:

- Real Vue/Vite frontend -> Cloudflare Workers Static Assets;
- source-parity API -> Cloudflare Workers/Hono/TypeScript;
- users, listings, contacts, audit and image metadata -> D1;
- private listing images -> R2 Standard;
- Durable Objects only if a demonstrated per-listing concurrency gap cannot be safely solved using D1 transactional/conditional patterns.

Workers Paid is the **primary budgetable candidate** because I00's source-compatible bcryptjs cost-12 local CPU-bound elapsed proxy exceeded Workers Free's 10 ms/invocation budget. Treat Workers Paid as a hypothesis until actual feasibility, metering and costs are shown. Human has said it **does not all have to be free**, but has NOT approved spending, subscriptions or unbounded overage.

## P0 — exact baseline, design and acceptance drift

1. Pin current source `main` exact SHA, product-domain I13 accepted SHA `8e11bebdb197321d500678f06233d6f174f03438`, and source I13 Human PASS issue comment. Verify no product semantic drift and document if newer commits impact API/schema/tests.
2. Prepare complete route/auth/data/image parity inventory. Reuse I00 research; do not re-create stale docs or accept unresolved H1-H4 as PASS.
3. Define thin Hono Worker architecture for full API and single-origin session, secrets, validation, OWNER/ADMIN role, ContactEvent, image flow; record concrete tech risks and test falsifiers. Do not implement full API in this contract.
4. Open a separate, method-compliant reconciliation action for source I13 canonical status if still not reconciled; do not write source repo from lab.

## P1 — highest-risk real authentication local proof

Build **small local Workerd synthetic-only proof** of the actual SOURCE-compatible login and registration flow (not fixture-only arbitrary `userId` session minting) in the lab. Use real source-compatible `bcryptjs` cost-12 existing hashes, password correctness/incorrectness, email canonicalization, registration validation, JWT issue/verify, expiry/tampering, cookie `HttpOnly`/`Secure`/`SameSite` variants, header precedence, live role and deleted account revalidation, OWNER isolation and ADMIN authorization, logout and safety of cookie sessions. Preserve source behavior or log any divergence as unresolved/REWORK. Never weaken hash work factor merely to fit Free.

Instrument timed cold/warm and success/failure samples, use supported CPU metering if available, and **explicitly distinguish** `performance.now()` elapsed proxy from provider-billed CPU time. Assess Workers Paid per-invocation configured limits and ability to serve these operations; treat expected user-visible login latency as a separate UX/performance risk. Include abuse/rate-limit/CSRF concerns as unresolved unless proved.

## Cost and decision output

Prepare the first Workers Paid + D1 + R2 (and optional DO) route-driven budget: Workers minimum USD 5/month + billed overage; Worker requests, CPU ms, D1 rows/storage, R2 storage/Class A/B, optional DO operations; evaluate 3 transparent low/mid/growth scenarios and burst/attack sensitivity, and flag billing-risk mechanisms. Verify limits using current official Cloudflare documentation at time of report. **Not an authorization to subscribe, purchase, deploy, enable billing or create remote resources.** Avoid assuming a hard Cloudflare account-level spend cap exists if one is not verified.

## Execution method, gates and evidence

- Codex Execution Owner; independent specialists for source/security and runtime/cost; critics distinct from implementers; Integration Review for shared assumptions.
- Use only local synthetic data and local Workerd/D1/R2; no real PII, no Cloudflare account remote binding/resource, no paid service, no production URL.
- Use an isolated branch/worktree with explicit allowed paths, no main rewrite, commit history retained. Do not expose internal fixture mutation/debug routes in deployable config.
- Run reproducible tests, negative/mutation security tests, lint and npm audit where applicable, Pre-Critic and invariant matrix; record commands, versions, runtimes, omissions.
- Publish a **new immutable P0P1 Artifact A** on an open PR and canonical `PENDING_EXTERNAL_REVIEW` boundary, `resume_authorized=false`. Await ChatGPT External Independent Critic verdict; do not self-PASS or auto-merge.
- Ordinary technical rework stays with Codex. Genuine Human Gates: material change to product security/domain, paid service/recurring cost or overage acceptance, remote staging/prod deployment, real data/cutover.
- Do NOT begin P2 data/concurrency migration, P3 functional API port, static-only demo #24, or Runtime Watch #5 under this contract. Once P0P1 passes external review, Controller can authorize next separate bounded increment.

**Exit:** exact source inventory, meaningful source-compatible local auth evidence or explicit negative finding, viable-cost envelope with assumptions, transparent remaining risks, independent falsification and immutable external-review handoff. A negative result is valid evidence; no unearned full-platform PASS.
