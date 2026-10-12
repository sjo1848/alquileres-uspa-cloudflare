# CF-AU-I00 REWORK-1 — Independent Technical / Security / Data-Parity Critique

**Role:** independent internal falsifier; no implementation or approval authority.
**Scope:** source-auth semantics, PostgreSQL → D1 meaning, and R2 image ownership/order/delivery/compensation.
**Reviewed:** binding `.orchestration/reviews/CF-AU-I00-REWORK-1.md`, `.orchestration/contracts/CF-AU-I00.md`, current specialist reports, current hypothesis/architecture docs, and pinned source behavior.
**Source evidence:** read-only sibling checkout `../alquileres-uspa` at `5bcde39e0ca8abd2d5d2e0a9e9c90c5b3bf47a51`, the application tree parent of the pinned docs-only commit `267c531f3e3d5869240894063d3a194fa1f9680b`; specialist report records clean status and pin relation.
**Critic conclusion:** auth, D1 parity, and full R2 lifecycle remain **UNRESOLVED** on evidence inspected. Primitive availability, static source mapping, and a cost arithmetic scenario do not falsify the material gaps below.

## Falsification criteria

I attempted to disprove parity using these criteria:

1. **Auth:** any target behavior changes source credential acceptance, session token validity/expiry, cookie/header precedence or flags, database-backed account/role freshness, error/role enforcement, or cannot verify source bcrypt hashes within the applicable Workers Free per-invocation CPU cap.
2. **PostgreSQL → D1:** any legacy value/meaning is inferred or lost; enum/null/default, timestamp, JSON, FK, uniqueness, or ID behavior changes; migration is not reproducible from a clean database; or image/listing concurrency cannot preserve constraints without PostgreSQL advisory locks.
3. **R2:** any non-owner/non-admin path can access or mutate bytes, ordering/metadata can diverge, unpublished bytes become public, API DTO leaks object keys, or D1/R2 partial failures leave an undetectable object/metadata inconsistency.

## Findings

### TSC-1 — Auth feasibility is not demonstrated; exact parity surface is larger than primitive support

**Evidence:** source `AuthService` normalizes email, creates OWNER accounts, hashes with bcryptjs cost 12, signs `jsonwebtoken` using configurable `JWT_EXPIRES_IN` default `15m`, and reloads the user by ID on each token validation (`../alquileres-uspa/apps/api/src/auth/auth.service.ts:12-24,27-40,43-77`). Controller emits `alquileres_session` with HttpOnly, Path `/`, 15-minute Max-Age, configurable SameSite and production/explicit/None Secure behavior (`auth.controller.ts:72-99`). Guard gives `Bearer ` precedence over cookie, URI-decodes the selected token, then revalidates DB identity and live role (`auth.guard.ts:17-33`). Role denial is 401 (`auth.service.ts:79-82`).

`source-parity-data.md` explicitly says no target auth runtime was run and source tests do not establish Workers CPU or JWT-library compatibility (sections “Auth contract” and “Evidence-based conclusion”). `runtime-cost.md` likewise says SHA/HMAC/Web Crypto primitive support is not JWT/password-format parity and that CPU must be measured on a local Worker (`Runtime/auth and security constraints`, unresolved items 1–2). No local auth proof artifact or measured CPU evidence was present in the reviewed tree (`find .orchestration/evidence -type f` showed only the two specialist reports before this critique). Thus a claim that H2/H5 is supported would fail this falsification attempt.

**Required evidence/repair:** add a local Workers-targeted proof using source-compatible bcrypt cost-12 hashes and JWT fixtures; verify source→target token signature/claims/expiry semantics or explicitly test a replacement preserves all observable behavior. Include normalized mixed-case/space email, owner-only registration, wrong/unknown credentials, malformed/expired/wrong-secret tokens, Bearer-vs-cookie precedence, URI-encoded cookie, all SameSite/Secure/logout attributes, live role change and deleted/renamed account invalidation, OWNER denied ADMIN and ADMIN allowed. Measure actual Worker CPU (not only wall-clock `performance.now`) for successful and failed bcrypt verification, cold and warm, under `limits.cpu_ms: 10`; if unmeasured or over cap, keep auth/H5 unresolved or reject the USD 0 auth path. Never make token role authoritative or silently lower the bcrypt work factor.

### TSC-2 — D1 mapping remains a risk inventory, not migration/parity evidence

**Evidence:** source schema declares seven enum domains and five relational models; relevant columns include nullable modern listing fields alongside historical columns, `JSON` audit metadata, `DateTime` timestamps and explicit cascade/restrict FKs (`../alquileres-uspa/apps/api/prisma/schema.prisma:10-52,54-85,88-147`). The source specialist identifies 10 ordered SQL migrations and specifically records that I13 retains `price_per_night` / `max_guests` without inferring historical meanings and clears `last_confirmed_at`; it also identifies FK actions, unique constraints, indexes, application-generated IDs, and the advisory lock (`source-parity-data.md`, “PostgreSQL → D1 data semantics and non-equivalences”). However, no target D1 schema, deterministic migration ledger, or migration test artifact was present in the reviewed tree. Contract acceptance requires explicit migration handling; `TARGET-ARCHITECTURE.md` only states design intent at lines 46–54 and leaves migration/reconciliation as a criterion.

**Falsification outcome:** nothing inspected proves SQLite CHECK domains/defaults/nullability, UTC timestamp precision/round-trip, valid JSON round-trip, FK enforcement and cascade/restrict parity, unique/index behavior, repeatable migration application, or retention of those legacy values. H3 must remain UNRESOLVED. Static schema notes cannot justify `SUPPORTED`.

**Required evidence/repair:** provide an explicit D1 schema/migration ledger runnable from empty DB; test unique email, unique object key and `(listing_id, position)`, every enum domain, null/default behavior, JSON validity/round-trip, UTC timestamp precision, FK cascade and RESTRICT, ID generation/collision properties, and repeated migration behavior. Seed synthetic legacy-shaped rows and assert historical price/occupancy bytes/values remain unchanged and `last_confirmed_at` remains NULL; never synthesize modern values. Preserve the exact source ordered-migration lineage or explain a deterministic consolidation with equivalent checkpoints.

### TSC-3 — D1 has no demonstrated substitute for source per-listing lock / transaction boundary

**Evidence:** source image/listing operations use `withListingLock`, wrapping the work in a transaction and acquiring `pg_advisory_xact_lock(hashtextextended(listingId, 0))` (`../alquileres-uspa/apps/api/src/listings/listings.service.ts:962-973`). Add counts existing images and appends at `position=count` while holding the lock (`:847-894`); delete compacts positions (`:897-916`); reorder shifts all positions negative then rewrites dense zero-based order (`:919-960`). Source also uses the lock for listing state transitions, so the concern is wider than the three image endpoints (`listings.service.ts:265-268,334-336,381-384,440-444`). Specialist report states this primitive has no direct D1 equivalent and has not been tested (`source-parity-data.md`, migration and image lifecycle sections).

**Required evidence/repair:** prove the selected D1 concurrency strategy with concurrent synthetic requests against actual local D1/Worker primitives. Race max-count uploads; same-listing concurrent add/delete/reorder and publication transition; assert image count cap, unique dense positions, correct owner/status checks and no lost updates. Include a second listing to establish lock granularity/isolation. Exercise conflicts/retries and transactional rollback. A unique constraint alone does not establish equivalent serialization or safe retry behavior. Until then H3/H4 remain UNRESOLVED.

### TSC-4 — R2 ownership, visibility, ordering and cross-store compensation are only statically described

**Evidence:** source add authorizes owned DRAFT/REJECTED listing before object mutation, checks max count, writes object before metadata, and best-effort deletes on metadata failure (`listings.service.ts:847-894,1002-1016`). Delete validates ownership/status, reads bytes, deletes object, removes metadata and compacts positions; metadata failure attempts restoration (`:897-916`). Reorder updates metadata ordering only (`:919-960`). Public image read requires APPROVED + PUBLISHED and API-mediates bytes; admin read is separate (`:176-196,320-331`); public DTO selects image id/contentType/size/position but not `objectKey` (`:44-48,208-248`). Controllers return Content-Type and Content-Length (`public-listings.controller.ts:23-29`, `admin-listings.controller.ts:68-74`). Source adapter describes opaque-key byte get/put and idempotent delete (`listing-image.storage.ts:7-18`).

The specialist report identifies expected key/metadata relationship and uncompensated-failure risk, but explicitly performed static inspection only—no R2 lifecycle proof (`source-parity-data.md`, setup and “Image lifecycle and security boundaries”). Runtime specialist presents compensation/reconciliation as a design recommendation, not demonstrated implementation (`runtime-cost.md`, unresolved item 4 and R2 lifecycle paragraph). No reviewed artifact proves that target bucket is private, no direct bucket/public URL changes the API authorization boundary, and no D1/R2 injected failure or recovery is exercised. Therefore H4 is UNRESOLVED.

**Required evidence/repair:** with synthetic objects and local Worker/R2 binding, assert: unowned/unknown/non-draft listing and foreign image ID return source-equivalent not-found and cause zero R2 calls; success persists opaque key only in metadata and omits it from returned DTO; reorder changes metadata only and yields dense ordering; public object bytes are served only for APPROVED+PUBLISHED while admin access is role/owner constrained; content type/length are preserved; bucket is private and all reads go through the Worker unless an equivalent exposure/cache policy is explicitly demonstrated. Inject partial put, D1 insert failure, R2 get/delete failures, D1 delete/compaction failure, restore failure and cleanup failure. Show deterministic compensation or durable reconciliation/detection for orphan and missing objects. A log-only best-effort cleanup is not proof of lifecycle recovery.

## Cross-surface risks / unresolved items

- Auth CPU is a direct cost-zero feasibility constraint: Workers Free 10 ms CPU applies per invocation, while password verification uses source bcrypt cost 12. Route-count arithmetic in `runtime-cost.md` cannot establish this runtime bound. Keep H5 unresolved until CPU evidence exists.
- D1 image ordering relies on uniqueness plus concurrency control. A target migration that drops `(listing_id, position)` uniqueness or assumes transaction isolation from local unit mocks fails source parity.
- Object key unpredictability is not an authorization boundary; ownership and listing publication state must be checked before R2 access. Private bucket and proxy/cache headers matter because source delivery is application-mediated.
- The current evidence does not demonstrate Cloudflare actual R2/D1 production semantics nor should it use paid/production resources. Local synthetic bindings are appropriate, but conclusions must be bounded to what they prove.

## Required regression set before Pre-Critic

1. Auth parity cases enumerated under TSC-1, including measured CPU cap and cookie/header exact behavior.
2. Fresh-install and legacy-shaped D1 migration/round-trip/constraint cases under TSC-2.
3. Same-listing concurrency and state-transition conflict cases under TSC-3 using actual D1 binding.
4. R2 ownership/public delivery/order and injected compensation-failure cases under TSC-4 using actual local Worker R2/D1 bindings.
5. Re-run relevant inherited tests after proof additions; record exact commands/results and retain negative findings. Hypothesis verdicts remain `UNRESOLVED` wherever any defining criterion above is still unproved.

## Commands/evidence basis

- `cat .orchestration/reviews/CF-AU-I00-REWORK-1.md`
- `cat .orchestration/contracts/CF-AU-I00.md`
- `cat .orchestration/evidence/specialists/source-parity-data.md`
- `cat .orchestration/evidence/specialists/runtime-cost.md`
- `cat .orchestration/INVARIANTS.md .orchestration/PRECRITIC-GATE.md`
- `nl -ba ../alquileres-uspa/apps/api/src/auth/auth.service.ts | sed -n '1,100p'`
- `nl -ba ../alquileres-uspa/apps/api/src/auth/auth.controller.ts | sed -n '72,105p'`
- `nl -ba ../alquileres-uspa/apps/api/src/auth/auth.guard.ts | sed -n '17,36p'`
- `nl -ba ../alquileres-uspa/apps/api/src/listings/listings.service.ts | sed -n '847,1017p'`
- `nl -ba ../alquileres-uspa/apps/api/prisma/schema.prisma | sed -n '10,147p'`
- `find .orchestration/evidence -type f` (before writing this critique: specialist reports only)

This critique is a falsification record, not a PASS, product decision, or External Independent Critic verdict.

## REWORK-1 follow-up — local Worker/D1/R2 harness review

**Reviewed artifacts:** `.orchestration/evidence/fixtures/rework1-worker.js`, `rework1-tests.mjs`, `rework1-schema.sql`, `rework1-seed.sql`, `wrangler.jsonc`, and `.orchestration/evidence/CF-AU-I00-REWORK1-TEST-RESULTS.json`. The JSON reports 16 passed / 0 failed. I inspected harness source and assertions; this is not a rerun and does not promote the report to independent acceptance.

| Earlier finding | Follow-up status | Evidence / reason |
|---|---|---|
| TSC-1 Auth feasibility/parity | **PARTIAL** | JWT cross-compatibility is tested in both directions for one `jsonwebtoken` default HS256 token (`rework1-tests.mjs:89-94`); bearer precedence, one encoded cookie, default `SameSite=Lax`/dev flags, expiry/tampering and basic OWNER/ADMIN guards have assertions (`:31-64,96-100`). However this fixture mints a session from caller-supplied `{id,email,role}` without password validation or database lookup in `/auth/session` (`rework1-worker.js:70-77`), and bcrypt is an isolated comparison endpoint (`:79-90`), unlike source login/register (`../alquileres-uspa/apps/api/src/auth/auth.controller.ts:40-63`; `auth.service.ts:27-52`). COOKIE_SAME_SITE strict/none, production/explicit Secure, logout clearing, renamed/deleted user, live role change and broader source JWT verification semantics are not covered. Cost-12 values in result JSON are `555/536/521 ms` (`TEST-RESULTS.json:5-10`) measured by `performance.now()` around calls (`rework1-worker.js:79-90`); this is wall time, not a reported Worker CPU meter. Although `limits.cpu_ms=10` is configured (`wrangler.jsonc:1-7`), request success with ~521 ms sync elapsed does not itself prove CPU over/under 10 ms. Treat the observed latency as a strong warning, not a calibrated CPU finding. |
| TSC-2 PostgreSQL → D1 | **PARTIAL** | `rework1-schema.sql:5-28` does exercise real local D1 CHECK/UNIQUE/FK constraints for three reduced tables, and synthetic seed includes historical columns (`rework1-seed.sql:1-14`). The only negative constraint assertion is invalid role (`rework1-tests.mjs:25-30`); it does not assert historical values after operations or test date/JSON semantics. The reduced schema omits source enums/tables/relations (no SUBMITTED status, contact/audit tables, migration versions, many nullable/defaulted columns and FK RESTRICT paths); it is a fresh test schema, not an ordered/replayable source migration. Therefore it establishes primitive SQLite constraints but not source model or migration parity. |
| TSC-3 D1 lock/concurrency | **OPEN** | The test named reorder runs one sequential reorder over two rows and checks output positions (`rework1-tests.mjs:135-142`). There are no concurrent requests, max-image-count race, concurrent add/delete/reorder, publication transition race, retry/rollback or separate-listing isolation assertions. Harness endpoints do not implement a per-listing lock (`rework1-worker.js:108-142,154-175`); D1 unique position constraints do not demonstrate the source transaction/advisory-lock semantics. |
| TSC-4 R2 ownership/order/delivery/compensation | **PARTIAL** | Positive synthetic put/metadata, owner denial, unpublished-vs-published read, reorder and one injected D1 insert/delete failure path are exercised (`rework1-tests.mjs:106-154`); public delivery checks bytes/type, but not Content-Length (`:126-134`). Critical source parity gaps remain: fixture delete checks only `owner_id`, not DRAFT/REJECTED (`rework1-worker.js:154-160`) whereas source `removeImage` calls `assertOwnedDraft` before R2 (`../alquileres-uspa/apps/api/src/listings/listings.service.ts:897-904,1002-1016`). It therefore allows image deletion on an approved/published listing in the harness. The R2 bucket is attached as a local binding (`wrangler.jsonc:15-17`), but no configuration/evidence tests private remote bucket policy or that deployed traffic cannot bypass Worker authorization. No admin-image endpoint/role test, foreign image id, max count/size/MIME validation, reorder invalid/missing ID, R2 operation failure, failed restoration/cleanup, or reconciliation is tested. |

### New harness defects and limitations

1. **Auth harness is not safe to treat as an implemented login proof.** `/auth/session` signs caller-provided identity/role directly (`rework1-worker.js:70-77`); this deliberately helps exercise JWT/cookies, but if ever exposed beyond the synthetic local harness it allows arbitrary ADMIN token minting. Keep the limitation explicit and do not reuse this handler as target application auth. A parity proof needs the actual credential lookup/hash verification/session route with roles sourced from D1.
2. **DRAFT/REJECTED deletion rule is missing from the tested R2 delete route.** The route reads listing owner but no listing status (`rework1-worker.js:158-160`); source rejects management outside DRAFT/REJECTED. Add tests for approved/unpublished and approved/published owners and repair the predicate before claiming lifecycle parity.
3. **Missing-object behavior differs from source.** Harness R2 `get()` may return `null`, but delete proceeds to delete the key and then remove metadata (`rework1-worker.js:161-170`); source `get` is expected to provide bytes and fails before object/metadata delete if absent (`listings.service.ts:904-907`). Test and preserve the failure behavior so stale metadata is not silently removed without compensation bytes.
4. **Compensation tests only cover successful compensation.** Insert failure calls `IMAGES.delete` without asserting key absence (`rework1-worker.js:119-126`; test checks only 500 response at `rework1-tests.mjs:116-120`). Delete failure restores object, and test verifies a subsequent public 200, but does not compare bytes/metadata or inject restore failure (`worker.js:161-173`; `tests.mjs:143-148`). Neither path tests failed R2 delete/put or persistent orphan/missing-object detection. This is insufficient to establish recovery behavior.
5. **CPU result is not a measured Cloudflare CPU budget result.** Test merely asserts sync wall elapsed is above 10 (`rework1-tests.mjs:81-87`); configuration sets the limit but JSON stores only `performance.now` durations. If local Workerd reports a distinct CPU metric, record that metric and validate configured-limit enforcement; otherwise keep this result as wall-latency evidence and leave exact Free CPU compatibility unresolved. It already demonstrates cost-12 compare taking roughly half a second in this local measurement, which is a material risk requiring investigation, not a reason to weaken password hashing.

### Follow-up falsification and required next checks

- TSC-1 cannot close until the proof measures Worker CPU directly (or honestly concludes that this runtime cannot establish CPU fit), and tests real source-compatible login/registration and configured cookie/session branches. Preserve the negative CPU-risk evidence.
- TSC-2 cannot close until the migration is complete or explicitly bounded, and synthetic source-shaped records are checked for every preserved semantic including historical fields, timestamp/JSON, enums, FK RESTRICT/CASCADE, unique constraints and deterministic migration ledger behavior.
- TSC-3 remains open until actual local D1 concurrent interleavings exercise add at image cap, delete/reorder/add and status transition; sequential `batch()` success is not concurrency proof.
- TSC-4 cannot close until management status is enforced, admin access is tested, missing object and each R2/D1 compensation failure is injected and detected, metadata/bytes/order are compared, and bucket exposure/delivery path is evidenced. Keep H4 `UNRESOLVED` in the meantime.

Supporting commands: `cat .orchestration/evidence/CF-AU-I00-REWORK1-TEST-RESULTS.json`; `nl -ba .orchestration/evidence/fixtures/rework1-worker.js | sed -n '65,180p'`; `nl -ba .orchestration/evidence/fixtures/rework1-tests.mjs | sed -n '24,160p'`; `nl -ba .orchestration/evidence/fixtures/rework1-schema.sql`; `cat .orchestration/evidence/fixtures/wrangler.jsonc`; and the source line references listed above.
