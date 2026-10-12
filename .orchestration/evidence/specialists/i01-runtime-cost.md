# CF-AU-I01-P0P1 runtime/auth/cost specialist report

Role: independent runtime/auth/cost research; no implementation edits or remote Cloudflare resource use.

## Runtime/auth findings

- The previous I00 fixture's `/auth/session` accepts a caller `userId` and therefore proves only selected primitives, not real source login or registration. It must not be represented as P1 completion.
- bcryptjs is JS implementation; the local proof must run actual hash/compare cost 12 on Workerd and use local D1 synthetic users, then test Node `jsonwebtoken` interoperability in both directions.
- Source semantics to test: registration normalization + OWNER role + duplicate conflict; credentials errors; current user/email/role revalidation; exact Bearer-over-cookie selection; session expiry/cookie variants/clear; OWNER isolation; ADMIN live authorization; deleted user; logout behavior.
- Local elapsed from prior I00 sync/async checks is ~0.6 s, but is not provider CPU. Current Paid CPU max is 30 s default, configurable to 300 s; local bcrypt elapsed gives a candidate feasibility signal only. The UX latency, actual billed CPU, abuse/rate limits, CSRF/origin behavior and JWT revocation remain unresolved.
- Missing-account login skips bcrypt compare, while wrong password performs it. Timing differential is a security concern; preserve/document rather than claim it closed.

## Cost/method findings

- Model route request count, per-route D1 scans, write amplification and R2 object get/put totals independently; static assets are free/unlimited only when requests do not invoke Worker-first handling.
- D1 bills scanned rows (not result count) and indexed writes add metered rows. Use query metadata in future authorized route/data proof.
- Account-level Workers Paid minimum USD 5 with included requests and CPU is not a spend cap. R2 billing units round; D1 and Worker overages can accrue. Attack bursts and shared account usage can alter actual bills.
- Durable Objects are not in the base topology. They add requests, duration and SQLite storage meters; do not propose them absent concurrency requirement/evidence.

Current official source values and URLs are recorded in `docs/research/CF-AU-I01-P0P1-COST-MODEL.md`; calculations and assumptions are independently executable from `calculate-i01-cost.mjs`.
