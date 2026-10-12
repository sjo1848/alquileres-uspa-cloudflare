# CF-AU-I01-P2 — First executable Cloudflare product slice (OWNER draft listing and images)

**Status:** `AUTHORIZED — LOCAL/SYNTHETIC IMPLEMENTATION ONLY`
**Controller authorization:** 2026-10-12 — canonical event seq 25.
**Implementation owner:** Codex CLI / independent specialist workers, lab repo `sjo1848/alquileres-uspa-cloudflare`.
**Issue:** https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/9 ; umbrella https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/7
**Source of product truth (read-only):** `sjo1848/alquileres-uspa@267c531f3e3d5869240894063d3a194fa1f9680b` (re-pin current main if advanced; do not assume prior source SHA).
**Authorized baseline:** lab `main@aa84e42d1b43b3e8fc5fbe7a95038a2073217f67`, CF-AU-I01-P0P1 research PASS Artifact A4 `c7c5704e606bda704140c972a1ca5032b09b0627`, PR #8 integrated.
**Product destination:** FULL app on Cloudflare. This is the *first executable parity slice*, not another generic feasibility report, not a static-only recruiter demo.
**Economics:** strict $0 is NOT required for eventual hosting; remote resources, Workers Paid billing, public deployment, overage, real data and production remain unapproved.

## Goal / acceptance journey

Deliver an executable **Hono + TypeScript Cloudflare Worker** using **actual local D1 and local R2 bindings**, whose HTTP endpoints implement this source-aligned journey using synthetic accounts/data:

`login OWNER → create a DRAFT rental listing → upload a valid image → list / retrieve privately → upload additional images → reorder → delete → verify dense order & R2/D1 consistency`.

A different OWNER must never view/mutate the first owner's private data; public visitor must not retrieve DRAFT images. Use source image route names and auth/JWT/cookie behavior where applicable; explicit documented divergences count as **UNRESOLVED** and must not silently pass as parity.

**Product result:** a working vertical API slice on local Workers+D1+R2, with deterministic user-visible response semantics and repeatable HTTP tests. No fake storage mocks as final acceptance. No Vue integration or wholesale API port in P2; those become subsequent functional slices.

## Source contract / bounded implementation

**Pinned source references** (re-inspect at execution start):
- `apps/api/prisma/schema.prisma`: User, Listing, ListingImage; enums, timestamps, nullable price/duration/availability fields, FK rules and unique `(listing_id, position)`, unique `object_key`, and indexing. See 10 PostgreSQL migrations for historical truth.
- `apps/api/src/auth/{auth.controller.ts,auth.service.ts,auth.guard.ts}`: register/login, bcryptjs cost-12 JWT, OWNER revalidation, cookie/Bearer selection. P0P1 fixture is an evidence reference only; do not ship its `/__fixture/sql`, timing debug fields, hard-coded test secrets or synthetic impersonation endpoints.
- `apps/api/src/listings/{listings.controller.ts,listings.service.ts,listing-images.validator.ts}`: OWNER Draft/Rejected-only image writes, source validators (JPEG/PNG/WebP signatures, image name/size, max image count 20 default), object key, ordering, compensation, and read endpoints.
- Source `withListingLock` uses PostgreSQL advisory transaction lock; cannot assume D1 `batch()` provides equivalent serialization across concurrent HTTP requests.

### Implementation boundaries

1. **D1 source-aligned schema/migrations**: implement local migratable SQL for required entities with source-grounded constraints, null history and time representations. Produce machine-checkable Postgres→D1 mapping ledger for all five source entities (User, Listing, ListingImage, ContactEvent, AdminAuditLog); **only required slice tables must be operational here**. Do not fabricate missing historical values or collapse nullable semantics. Do not mark unimplemented modules migrated.
2. **Auth**: adopt the previous actual bcryptjs cost-12 / JWT proof as source-compatible login/session guard *without diagnostic/public mutation endpoints*. Keep hashed password seed and OWNER/ADMIN semantics. Ensure role/user DB revalidation and cookie/Bearer precedence, correct auth error distinctions for tested subset, and same-origin/cookie security assumptions documented. Any unresolved `IsEmail`/numeric-expiry/malformed-cookie divergence remains explicitly named; **no insecure weakening**.
3. **Worker API routes**: OWNER create/list draft (minimum needed for image journey), add/list/private image GET, reorder, delete; HTTP source method/path/response mapping written down, validated by tests. Public DRAFT-image GET must return 404; cross-OWNER reading and writing must be denied without metadata leakage. No production-ready ADMIN/public publication claim.
4. **R2 local object bytes (not pretend mock)**: bound bucket for `wrangler dev` local state; no `remote:true`, no `wrangler dev --remote`. Validate bytes, MIME magic, filename, configured size/count; generated object keys must avoid traversal or user-supplied keys. Apply content type/length/Cache-Control according to source access policy.
5. **D1 invariants/concurrency**: exactly 0–20 images per listing, unique contiguous positions 0..n-1, no duplicate/ghost object key, role/ownership/status gate *on each mutation*, no cross-listing reordering, no orphan D1 metadata or leaked R2 bytes after acknowledged success/failure. Source listing lock must be replaced by an independently demonstrated safe serialization/conditional update scheme (e.g., conditional SQL version/CAS & retriable conflict, or per-listing Durable Object if necessary). `D1.batch()` is atomic for its constituent SQL statements but **does not by itself guarantee source per-listing HTTP mutation ordering**.
6. **Nontransactional D1/R2 recovery**: explicitly handle object upload succeeding when metadata insert fails, object delete succeeding when D1 commit fails, restore failure and crash/retry windows. Document recoverable vs impossible-to-guarantee atomicity; implement bounded compensation or reconciliation/operation ledger where needed. Do not claim fully atomic D1+R2 dual writes. Prefer no double-charging/racy writes. If a correctness property cannot be proved locally, STOP with explicit blocker rather than lowering invariant.
7. **Observability**: structured error correlation without PII or secrets; no uncontrolled credentials/data in logs; basic D1 `meta.rows_read/rows_written` evidence where supported. No need to redo abstract month-cost scenarios absent material new metering.

## Mandatory executable verification (acceptance gate)

- Fresh clone deterministic setup: one command install/setup local D1/R2 and start Workerd; one command run the local HTTP integration suite. Document exact commands, versions, elapsed and expected outputs.
- Positive: 2 synthetic owners A/B, one DRAFT, valid JPEG/PNG/WebP signatures, upload/read/list/reorder/delete, actual R2 bytes, ordering 0-based dense, 20-image cap; cross-OWNER and unauthorized/public DRAFT reads get correct denial. Verify source HTTP response shapes/status/cookie behaviors for implemented routes.
- Negative: invalid MIME/signature mismatch, file name, size/empty/missing, duplicate positions, wrong owner, wrong listing, wrong listing state, expired/forged token, malformed/missing image, R2 missing object.
- Concurrent tests: 10–30 repeated parallel upload/reorder/delete sequences on same listing and across listings; specially **two concurrent uploads at 19/20** → exactly one acceptable success (or documented retriable conflict) and never 21/duplicate position/orphan; concurrent delete vs reorder must preserve ordinal uniqueness and R2/D1 consistency.
- Fault injection: R2 put failure; D1 insert/commit failure after put; R2 delete failure; D1 mutation failure after delete; restoration failure; retry/idempotency where applicable. Test observed postconditions in **both local D1 and local R2**. Demonstrate negative mutation checks for at least the 20-image cap, cross-OWNER authorization and orphan/compensation handling. Do not disguise expected failures as test PASS.
- Repeat suite with fresh local state; no failed flaky test masked by skipped/different result. Vulnerability audit and static/build/typing checks for touched deps. Confirm fixture debug mutation endpoint unreachable in executable Worker.
- Independent **security/authorization** and **data integrity/concurrency** critics must challenge negative tests and fault postconditions. Integration Review and Pre-Critic must evaluate supported invariants, not merely counts or process forms.

## Risk-tiered review policy (avoid repetitive process-only loops)

- **P0/P1 blocking**: auth/OWNER isolation, unapproved scope, lost or corrupted data, concurrent invariant violations, compensated-object leak, false test PASS for critical invariant, non-reproducible HTTP slice, exposed debug routes, or fabricated provider/cost proof. Repair autonomously within this same bounded contract, with independent re-critique.
- **P2 tracked/nonblocking only when truly immaterial**: stylistic docs, verbosity, non-security ergonomics, naming and minor reporting polish that do **not** change contract satisfaction or turn a falsified claim into PASS. Capture as follow-up rather than manufacturing endless immutable artifact rounds. External Independent Critic retains final independent judgement on what blocks.
- Work incrementally on one branch/worktree with small internal commits and QA; **do not tag every internal repair**. One immutable Artifact at external-review boundary after all relevant internal critics, unless genuine external failure requires another artifact.
- Keep source pinned and traceability. Limit documentation to contract, mapping ledger, test evidence, critical design decision and explicit unresolved findings. Do not generate redundant backlog/bitácora/slide decks.

## Human and external gates

- **Authorized:** local-only lab application code, synthetic migrations, local D1/R2/DO if justified by proof, verified test automation, issue/PR/evidence files; Codex may operate autonomously for routine rework within this scope.
- **Not authorized:** write the original `alquileres-uspa` repo, import real user/listing data, enable Cloudflare billing, create remote D1/R2/Worker objects, use `remote:true`, deploy preview/public/prod, change security/business semantics, merge before external PASS, close umbrella Issue #7, implement unrelated modules or Runtime Watch.
- Source I13 Human Product Acceptance PASS exists in source Issue #24 but canonical source STATUS still pending; reconcile under a separate authorized task before altering/cutting over source product. Do not ask Human to repeat I13 acceptance.
- If Durable Objects are needed beyond **local simulation** or materially change persistence topology/security, record architecture decision and stop at true Human Gate before remote use. A local proof of necessity is allowed and encouraged.
- Finish in `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false` with open PR, immutable artifact tag and exact SHA-pinning publication boundary. ChatGPT serves as External Independent Critic. Do not self-PASS or auto-merge.

## Completion criterion and follow-on

**PASS requires actual local Worker API + D1 + R2 bytes + tested owner image lifecycle, concurrency and failure recovery**, not merely documentation. Negative results are legitimate but must be reported as UNSOLVED with evidence; cannot claim product readiness. This is partial platform functionality: next planned increments are public listings/admin/contact and **real Vue frontend integration**, then remote staging on Cloudflare after budget/operational Human Gate.
