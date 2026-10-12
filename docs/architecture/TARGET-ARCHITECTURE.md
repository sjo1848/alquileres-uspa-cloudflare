# Target Architecture Hypothesis — Alquileres Uspallata Cloudflare

Status: `WORKING HYPOTHESIS — NOT YET PROVEN`

## Source architecture

The source application uses:

- Vue 3 + Vite frontend;
- NestJS API;
- Prisma ORM;
- PostgreSQL;
- application-managed OWNER/ADMIN authentication;
- persisted listing/contact/audit/image metadata.

## Candidate Cloudflare architecture

```text
Browser
  |
  +--> Cloudflare Worker Static Assets (Vue/Vite)
  |
  +--> /api/* -> Cloudflare Worker (Hono + TypeScript)
                     |
                     +--> D1: users/listings/contact/audit/image metadata
                     |
                     +--> R2: listing image objects
```

## Design intent

### Frontend

Keep Vue/Vite unless evidence shows a Cloudflare-specific incompatibility. Prefer minimal product code change.

### API

Port NestJS behavior to a Worker-native Hono/TypeScript API. Treat NestJS as source behavior, not a framework requirement.

Required parity includes validation, role checks, owner isolation, public catalog/detail/contact behavior, ADMIN audit behavior and typed/consistent error handling.

### Database

D1 is the working relational target. Migration must be explicit about PostgreSQL-to-SQLite differences, IDs, enums, timestamps, JSON, foreign keys, cascade/restrict behavior, indexes, uniqueness and transaction semantics.

Do not perform silent data transformation to make a migration pass.

### Images

R2 stores image bytes. D1 stores image metadata and ordering. Object keys must not become an authorization boundary by themselves.

### Authentication

Preserve source application authentication semantics first. Do not substitute Cloudflare Access for public/OWNER auth by convenience. Any auth topology change needs explicit parity/security evidence and, if material, a Human Gate.

### Deployment topology

Laboratory first. No production custom domain, real data or irreversible cutover during BUILD.

## Architectural decision criteria

The hypothesis is supported only if:

- parity is demonstrable;
- security/isolation is not weakened;
- D1 migration/reconciliation is deterministic;
- R2 lifecycle is safe;
- Worker runtime limits are compatible with normal routes;
- expected workload fits the intended cost envelope;
- operational complexity is lower or at least justified.

If evidence contradicts any of these, revise the target rather than forcing the source application into the hypothesis.

## REWORK-1 feasibility evidence — 2026-10-12

The full target remains `UNRESOLVED`. Local Workerd plus D1/R2 fixtures demonstrated selected JWT/cookie/role and image lifecycle paths, but did not port Hono routes or the source product. The source bcryptjs cost-12 synchronous verification proxy elapsed 521 ms locally against the 10 ms Workers Free per-request CPU allowance; this rejects the current source-auth, zero-cost Free path. Preserve the work factor and auth meaning. The source uses PostgreSQL per-listing advisory locks; the D1 batch/two-phase reorder fixture does not establish a concurrent-safe equivalent. No broad migration implementation is authorized by these findings.
