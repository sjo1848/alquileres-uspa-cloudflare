# CF-AU-I01-P2 — External Independent Critic on Artifact A1

**Date:** 2026-10-12
**Verdict: REWORK-1 — bounded P1 security-test false positives; no demonstrated Worker crypto bypass.**
**Immutable artifact:** `4ea23b9931ebd15936af4473997cc1ecacc2bb1b`
**Annotated tag:** `CF-AU-I01-P2-Artifact-A1`, verified to dereference to exact A1.
**SHA-pinning boundary:** `d301b6cb6743bafd2761ce0780090b1aa1f75d68` (direct A1 child).
**PR:** https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/10 — OPEN, NOT MERGED; current head `e6b664e90be59c5a09c487dd46e80f1da35cd82a` is a descendant of boundary with **only** `.orchestration/STATE.md`/ `STATUS.json` PR URL bookkeeping.
**Task Contract:** `.orchestration/contracts/CF-AU-I01-P2.md`; umbrella Issue #7, implementation Issue #9.
**Human Gate:** none for bounded test repair. **Blocker:** none; no payment/remote/production/source changes authorized.

## Accepted, scoped evidence

- This increment ships **substantive executable product code**, not a standalone research model: `apps/worker/src/index.ts` Hono/TypeScript Worker, `migrations/0001_core.sql` SQLite D1 with FK/uniqueness, Wrangler-local R2 object storage and actual HTTP integration tests under `apps/worker/tests/http.mjs`. Inspected direct code, schema, fixture fault wrapper, tests, mappings, independent security/integrity/integration critics, integration review, Pre-Critic and validation ledger. No mocks replace accepted D1/R2 backend bindings.
- Source-aligned OWNER draft create/list and image add/list/retrieve/reorder/delete, bcryptjs cost-12/login, cookie/Bearer and OWNER/ADMIN boundary. Cross-OWNER denial, source image signatures/size/name/count limit, local D1/R2 compensation ledger/cron and token-fenced lease are implemented. Explicit source surface divergence: private image byte GET on OWNER route added for bounded local slice.
- Implementation ledger records **two independent fresh-local-state full HTTP runs**, PASS after 522.0s and 543.7s, including repeated 19/20 cap and parallel same/cross-listing operations, injected D1/R2 errors, recovery/cleanup and object byte reads. `typecheck`, `node --check`, `npm audit` zero and `git diff --check` recorded as PASS. These are **Codex execution claims in committed evidence**; Controller did not personally rerun local Wrangler suite or provider operations.
- Review separation documented: specialized security/integrity/integration critics were independent of implementation in their reports. The Pre-Critic PASS is only approval to publish reviewable evidence, not an independent product PASS.
- All known limits remain open: no remote Cloudflare/provider CPU or spending proof, no PostgreSQL lock equivalence, no atomic D1+R2 transaction, no public/ADMIN/ContactEvent workflows, full Vue or complete authentication/registration parity; source I13 Product Owner PASS exists but tracked source status remains stale, requiring technical reconciliation before source writes/cutover. No real data or paid resources used.
- Automated Codex PR review at boundary `d301b6c` independently raised the two binding security-test problems below.

## Binding findings

### A1-F1 — [P1/SECURITY QA] JWT expiration test checks unknown identity instead of expiry

`apps/worker/tests/http.mjs` near line 23 constructs a correctly HMAC-signed expired JWT with payload `{ id: 'fixture-owner-a', email: 'owner.a@example.test', iat:1, exp:1 }`, while `tests/seed.sql` seeds the actual account ID **`owner-a`**. A missing/disabled `exp` enforcement would still lead to 401 during DB current-user revalidation because this subject does not exist; therefore the negative test cannot falsify an expiry regression. Code `verify()` currently explicitly compares `c.exp`, so this is a **false-positive regression guard**, not proof of a vulnerable runtime.

**Required:** use the actual seeded `owner-a` identity, match stored email, and ideally assert an otherwise identical non-expired, *correctly signed* token is accepted (200). Then assert expired signed token with same valid subject is denied (401) for expiry. A negative control may use expired payload with correct token structure and actual signing key; do not change Worker auth or relax JWT policy.

### A1-F2 — [P1/SECURITY QA] JWT forgery test fails parser before HMAC verification

`apps/worker/tests/http.mjs` near line 64 sends `Authorization: Bearer fake.jwt.token`. The header/payload are not valid base64url JSON JWT parts, so `unb64` / JSON decode fails before HMAC verification. Even if `crypto.subtle.verify()` were bypassed, this assertion remains 401. As above, this is a test coverage defect, not a demonstrated security bypass; actual source `verify()` contains HMAC-SHA256 comparison.

**Required:** build a structurally valid `HS256` JWT with active seeded `owner-a`, correct email, unexpired `iat/exp`, and deliberately incorrect signature (HMAC with wrong key or targeted signature mutation). Compare with a correctly signed **positive control of same subject** accepted via Bearer (200) and ensure forged structurally valid token returns 401. Tests must be specific enough to catch an implementation that accepts the invalid signature; no source/production key exposure.

## Acceptance criteria and streamlined follow-on

1. Codex consumes the authoritative review on **main**, merges its PASS/REWORK-bearing main history into the *existing PR #10 branch*, preserving immutable A1, annotated tag and direct boundary lineage. Do not rewrite/squash/cherry-pick only boundary.
2. **Change only `apps/worker/tests/http.mjs` and directly dependent validation/review/Pre-Critic records** for A1-F1/A1-F2. Existing Worker implementation, D1 migration, R2 fault flows, independent integrity evidence, product/auth semantics, and previously proven race/failure models remain in scope and do **not** require redesign. If new execution uncovers an actual auth vulnerability, escalate to substantive P0/P1 correction within same contract with independent re-critique.
3. Rerun **at least one full fresh-state `npm test` HTTP suite** after test edits, plus syntax/static checks; prior two full baseline runs remain provenance, not current final evidence. Rerun targeted security tests against active seeded account and forged-HMAC specifically; invite a distinct independent security critic to challenge negative test quality. `npm audit` need only rerun if dependencies change; preserve exact blob SHA for unchanged code/deps, don't invent a fresh audit.
4. Include 2 negative controls **with positive controls**: current valid signed JWT accepted; same existing account signed expired denied; valid-shaped wrong-HMAC bearer denied. Explain clearly in security critique which rejection reason is isolated. Pre-Critic and integration review should be narrowly refreshed, not bloated.
5. Publish one immutable **Artifact A2** with annotated tag and exact SHA-pinning boundary under PR #10, status `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, STOP for next External Independent Critic. No new task, no manual Human Gate, no unconditional merge.
6. **No remote Cloudflare resource, billed service, public/staging/prod deployment, real data, original source repo edits, broader API port, unrelated workflow, or Runtime Watch.**

## Process direction

Risk-tiered review is active: these findings are materially **P1** because they undermine protection against authentication regressions. They justify one rework, unlike purely stylistic P2 report polish. Preserve the otherwise strong local executable slice and move toward subsequent functional increments once this bounded QA correction passes. Do not loop back into generic P0/P1 feasibility research.
