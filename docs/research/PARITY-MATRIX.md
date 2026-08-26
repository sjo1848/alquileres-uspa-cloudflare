# CF-AU-I00 — Source-to-target parity matrix

Status: feasibility baseline; no migration is complete.

| Surface | Source invariant | Cloudflare adaptation | I00 result | Next proof |
|---|---|---|---|---|
| Static web | Vue/Vite routes and assets | Workers Static Assets; preserve SPA fallback and API origin | SUPPORTED conditionally | Browser build/deploy smoke |
| Session auth | 15-minute HttpOnly `alquileres_session`, SameSite policy | Hono `Request`/`Response` cookie handling; Web Crypto or supported JWT implementation | SUPPORTED conditionally | Worker auth contract tests |
| Passwords | Stored hashes never returned | Use a Workers-compatible password hash library/runtime path; do not invent a weaker scheme | UNRESOLVED | Benchmark/validate chosen hash library under 10 ms CPU |
| OWNER isolation | Backend derives owner from authenticated principal | SQL predicates include `owner_id = session.sub`; negative tests required | SUPPORTED structurally | API positive/negative matrix |
| ADMIN auth | Role guard on review/assisted/audit | Hono middleware and explicit role checks | SUPPORTED structurally | API positive/negative matrix |
| Review/publication | Approved and published are independent states | D1 enum-as-text plus CHECK constraints and transition service | SUPPORTED conditionally | Transition tests and migration reconciliation |
| D1 schema | Relational FK/index/unique semantics | SQLite-compatible explicit schema; preserve nullable legacy fields | SUPPORTED for current model | Generated D1 migration and reconciliation |
| Transactions | Assisted mutation + audit transaction; image deletion compensates external failure | D1 batch/transaction semantics plus explicit R2 compensation | UNRESOLVED | Failure-injection test for DB/R2 ordering |
| Images | D1 metadata/order, object bytes separately, object key unique | R2 binding + D1 metadata; Worker mediates authorization | SUPPORTED structurally | Multipart and lifecycle tests |
| Public catalog | only approved + published; filters/pagination/count | Indexed D1 query; avoid full scans | SUPPORTED conditionally | Query row-read measurements |
| Contact | server resolves owner, validates visitor fields, creates event | D1 insert in Worker; no visitor owner input | SUPPORTED structurally | API contract and isolation tests |
| Audit | actor, target, entity, listing, metadata, timestamp retained | D1 JSON text or validated JSON; restrict actor/target deletion behavior explicitly | UNRESOLVED | Schema decision and audit tests |

The matrix intentionally leaves password hashing, transaction failure semantics and audit JSON/delete semantics unresolved. They are the first implementation increment's acceptance risks, not silently supported claims.
