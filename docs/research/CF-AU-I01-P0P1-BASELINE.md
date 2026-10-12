# CF-AU-I01-P0P1 — Source pin, parity framing and authentication feasibility

Observed: 2026-10-12 UTC. Task scope: `.orchestration/contracts/CF-AU-I01-P0P1.md`.

## Experiment framing

### P0 source drift

- **Hypothesis:** the API and accepted I13 rental-domain behavior remain materially unchanged since Product Acceptance.
- **Falsification criterion:** any post-I13 change to API routes, guards/services, Prisma schema, migrations, or relevant tests changes the auth/data contract or accepted product semantics.
- **Setup:** pin source `main`; compare accepted I13 SHA `8e11bebdb197321d500678f06233d6f174f03438` through current main; inspect `apps/api` file changes and relevant source acceptance comment.
- **Evidence:** current source `main` is `267c531f3e3d5869240894063d3a194fa1f9680b`, parent `5bcde39e0ca8abd2d5d2e0a9e9c90c5b3bf47a51`. The current commit adds only `docs/issue-24-recruiter-demo-discovery-design.md`. The comparison from accepted I13 to current `main` has no changed `apps/api/**` files. Source Issue #24 comment `5891503272` records Product Acceptance PASS for accepted candidate `8e11bebdb197321d500678f06233d6f174f03438` on 2026-09-29.
- **Result:** no API/auth/Prisma/migration/test semantic drift was found after I13; repository main did advance in documentation and frontend work, so the source pin is updated rather than reusing an older hash.
- **Conclusion:** source auth, data, and route inventory remains applicable to the current API at this pin. The front-end drift does not prove Vue/Vite/Workers parity; P0P1 does not close I00 H1 or implement the frontend.
- **Transferable learning:** source acceptance and source canonical runtime status are separate facts; preserve the PASS and reconcile the stale source status through a separate auditable action without writing to the source repository from this lab.

## Full-platform parity framing

The selected destination is a complete application on Cloudflare: Vue/Vite Static Assets, Worker/Hono/TypeScript API, D1 persistence, and private R2 image bytes. The auth proof below is a synthetic Worker/D1 seam, not a port of the NestJS API. Source routes observed at the pinned tree:

| Source controller | Route family |
|---|---|
| `auth/auth.controller.ts` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `GET /auth/admin-check` |
| `health/health.controller.ts` | `GET /health` with database health behavior |
| `listings/listings.controller.ts` | `GET/POST /listings`; `GET/PATCH/DELETE /listings/:id`; `PATCH /listings/:id/availability`; `POST /listings/:id/reconfirm`; `POST /listings/:id/submit`; `GET/POST /listings/:id/images`; `DELETE/PATCH /listings/:id/images/:imageId` |
| `listings/public-listings.controller.ts` | `GET /public/listings`; `GET /public/listings/:id`; `GET /public/listings/:id/images/:imageId` |
| `listings/admin-listings.controller.ts` | `GET /admin/listings/review`; `GET /admin/listings/audit`; `GET /admin/listings/:id`; `GET /admin/listings/:id/images/:imageId`; `POST /admin/listings/:id/{approve,publish,reject}`; assisted listing create/update/availability/reconfirm/submit/delete; `GET /admin/owners` |
| `contact/contact.controller.ts` | `POST /public/listings/:id/contact`; `GET /owner/contact-events`; `GET /owner/contact-events/:id`; `PATCH /owner/contact-events/:id/state` |

| Surface | Source contract to preserve | P0P1 status |
|---|---|---|
| Auth register/login | DTO email validation; normalized `trim().toLowerCase()` email; OWNER registration; bcryptjs cost 12; duplicate email conflict; generic invalid-credentials response | Covered by local synthetic seam with a deliberately narrower email validator; full class-validator equivalence remains UNRESOLVED |
| Session | JWT secret required; `jsonwebtoken` HS256-compatible JWT; default 15-minute expiry and configured `JWT_EXPIRES_IN`; `alquileres_session`; DB user reload by ID; email equality; current role read from DB | Local token interoperability, default and configured 1-minute expiry, cookie issue/clear, deleted-user/email-change invalidation and role refresh exercised |
| Header/cookie selection | Exact `Bearer ` header takes precedence; otherwise cookie; selected value is URI-decoded | Positive precedence and percent-encoded Bearer decoding covered; malformed percent-encoding reproduces a 500 edge and remains unresolved |
| OWNER | Actor comes from current authenticated DB user; foreign listing is hidden | Synthetic own-listing 200 and foreign-listing 404 covered |
| ADMIN | ADMIN-only guard reads current user role | Synthetic ADMIN accepted then DB role downgrade denied without re-login |
| Logout | Clears cookie with matching options; source has no JWT revocation list | Cookie clear tested; bearer remains valid until expiration or subsequent DB invalidation |
| Product route families | Owner listing CRUD, images, review/publication, assisted ADMIN, audit, public catalog/detail/contact, health | Inventoried in I00 research; NOT ported or claimed as P0P1 evidence |
| Persistence and media | PostgreSQL/Prisma relations, ten migrations, D1 risk map, private R2 object flow and source-mediated public bytes | Reused as unresolved migration risks; no migration, R2 resource, or product data access in this increment |

## P1 local authentication experiment

- **Hypothesis:** a small Workerd Worker using the current source-compatible bcryptjs cost-12 hash and Web Crypto HS256 can perform register/login/session checks over a local D1 synthetic account table without changing auth semantics.
- **Falsification criterion:** Workerd cannot load/use the source password hashes, Node `jsonwebtoken` interoperability fails, session attributes/expiry diverge, malformed/tampered/expired tokens are accepted, current role/deleted account are not revalidated, OWNER isolation or ADMIN denial fails, or the local operation exceeds Workers Paid's default per-invocation CPU limit when a supported provider meter is available.
- **Setup:** Node 24.18.0, Wrangler 4.149.0 / Workerd local, bcryptjs 3.0.2, local D1 only, synthetic `example.test` identities/passwords, Worker fixture under `.orchestration/evidence/fixtures/i01-auth/`. Fixture-only D1 mutation route is inaccessible unless the local command supplies `LOCAL_FIXTURE_ONLY=true`; the tracked Wrangler config does not enable it. No deploy command, Cloudflare account binding, live secret, or remote database exists in the fixture.
- **Evidence:** `.orchestration/evidence/fixtures/i01-auth/worker.js`, `tests.mjs`, `schema.sql`, `seed.sql`, `wrangler.jsonc`; result summary `.orchestration/evidence/CF-AU-I01-P0P1-AUTH-RESULTS.json`.
- **Result:** final run passed 23/23 grouped checks (not individual assertion count). Registration generated a bcrypt cost-12 hash and Worker JWT verified with Node `jsonwebtoken`; Worker accepted Node-issued HS256 JWT. Measured local elapsed values from the final run: register/hash 644 ms, first/repeated successful compare 567/542 ms, wrong-password compare 631/557 ms, unknown account 0 ms. These are local elapsed observations, not Workers billed CPU readings.
- **Conclusion:** source bcryptjs hash and token semantics are compatible in this narrow local Workerd/D1 proof. This does not prove production latency, provider CPU metering, all auth route parity, node runtime compatibility of the full Nest app, or Workers Paid viability.
- **Transferable learning:** separate wall elapsed, source contract and provider CPU metering. A valid-Paid hypothesis remains provisional until bundled code is exercised with supported provider telemetry and UX latency is accepted.

## Findings and unresolved security risks

1. Login for a missing email returns the same status/message as wrong password, but the measured local path differs: `0 ms` (no hash compare) versus `558 ms` in the integrated login check. The dedicated cold/warm benchmark measured wrong-password compares at `631/557 ms`. The source has the same control flow. This leaves account-enumeration timing risk; rate limiting and timing mitigation were not in the proof and require a bounded security follow-up before migration.
2. Source guard URI-decodes the cookie before `AuthService.verify` can convert token errors; malformed `%` currently yields an unhandled 500 in the local compatibility proof. Preserve this finding rather than silently claiming all malformed cookies return 401.
3. Logout clears the browser cookie, not already issued Bearer JWTs. Tokens remain accepted until expiry unless live DB revalidation fails, matching current source behavior.
4. CSRF/cross-site request defenses, origin checks, credentialed CORS, password-reset/session revocation, abuse throttling, concurrent registration behavior, full DTO validation equivalence, signing-key rotation, and hostile request/body limits are not established. Expiry proof covers default `15m` and unit-bearing `s/m/h/d` strings. A bare numeric text setting such as `"120"` is rejected by the fixture; source `jsonwebtoken` interprets it as 120 ms and floors `exp` to `iat`, making the token immediately expired. The fixture fails closed on this invalid setting before hashing or writing any user row; this differs from source immediate-expiry behavior and remains an explicit configuration divergence. Complex timespan strings are not differentially tested. The narrow email regex remains explicitly non-equivalent to `class-validator` `IsEmail` until a differential corpus is run.
5. `elapsedMs` and `hashCost` are returned only by the explicitly local fixture flag and are absent in normal configuration. They are test instrumentation, never an application response contract.

## I13 canonical state discrepancy — separate follow-up, no source write

Source Issue #24 has an explicit Human Product Acceptance PASS for I13 candidate `8e11bebdb197321d500678f06233d6f174f03438` (comment `5891503272`, 2026-09-29). The source repo's tracked orchestration status still says pending. I01 does not edit that repository and does not repeat the acceptance decision. Before any migration, create a separate method-compliant, reviewable reconciliation action against the exact source `main` SHA: include the accepted candidate, exact PASS comment, current source commit, only relevant I13 canonical state/evidence files, conflict/stale-state check, invariant and Pre-Critic evidence, and external review if the current method requires it. This is state reconciliation only and must not alter accepted product code or declare production acceptance.

## Scope boundary

No source writes, full API port, schema migration, P2 concurrency work, R2 remote object, paid subscription, account setting, public URL, production, real data, or Runtime Watch action occurred. Findings return to P0P1 review only.
