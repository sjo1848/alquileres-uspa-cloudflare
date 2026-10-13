# CF-AU-I01-P2 local OWNER image slice

This is a local-only Hono Worker. It requires Node 24+, npm, and Wrangler 4.149.0. It uses synthetic accounts and Wrangler's local D1/R2 stores; configuration has no remote binding or production secret. The test harness uses `wrangler dev --local` and never calls `--remote`.

```sh
npm ci && npm run local:up -- --var JWT_SECRET:replace-with-a-local-only-secret
```

`local:up` applies the D1 migration, seeds synthetic users, and starts the local Worker. Keep this terminal running. Login/logout and cookie-authenticated POST/PATCH/DELETE requests must carry an `Origin` exactly matching the Worker origin; browser same-origin requests do this automatically. This check blocks cross-origin form/fetch and login-CSRF side effects. Bearer-authenticated API mutations do not use cookies and are not subject to the Origin check.

In another terminal, run the one-command HTTP integration suite (it applies migrations, resets/seeds synthetic users and starts its own local Worker):

```sh
npm test
npm run typecheck
```

Seed owners use `synthetic-owner-password-1`; password hashes are bcrypt cost 12 and are inherited from the earlier source-compatible local auth fixture. Never reuse these users or secret outside the local lab.

## Implemented API

| Method | Route | Result |
|---|---|---|
| `POST` | `/auth/login` | Source-shaped `{user}` and `alquileres_session` HttpOnly/SameSite cookie, 200 |
| `POST` | `/auth/logout` | Clears the cookie; does not revoke an already issued bearer token, matching source behavior |
| `GET` | `/listings` | Current OWNER's listings |
| `POST` | `/listings` | Source-required listing fields; creates a DRAFT with source camelCase fields, 201 |
| `GET/POST` | `/listings/:id/images` | List source-shaped image metadata or multipart-add field `image` |
| `GET` | `/listings/:id/images/:imageId` | Private image bytes for an owned DRAFT/REJECTED listing |
| `PATCH/DELETE` | `/listings/:id/images/:imageId` | Reorder by `{position}` / delete and compact |
| `GET` | `/public/listings/:id/images/:imageId` | Always 404 for this P2 draft-only slice |

Listing create/list returns source camelCase fields; image list/add/reorder returns `id`, `originalName`, `contentType`, `sizeBytes`, `position` and `createdAt`; delete returns an empty 200 response. These mappings and tested denial statuses are asserted by the HTTP suite.

Private OWNER image-byte GET is not present as an OWNER route in the pinned source controller; P2 adds this bounded route to make the requested private retrieval journey executable. **Source route parity remains unresolved** pending controller/product confirmation. Auth also retains three explicitly unresolved P0/P1 details: its email check is narrower than source `class-validator` `IsEmail`; JWT expiry parsing accepts only integer `s/m/h/d` forms rather than the full source `jsonwebtoken` option behavior; and malformed percent-encoding in a cookie returns 401 here while source decoding escapes as 500. No ADMIN endpoints, public approved-image behavior, registration, Vue integration, ContactEvent or AdminAuditLog are claimed.

The listing lock is a D1 lease with token-fenced image metadata writes; the per-listing operation is serialized while its lease is held. Image routes recheck OWNER/status under the lease and fence their D1 mutations against both the lease and current DRAFT/REJECTED ownership. Any later listing status transition must use the same listing lease. A five-minute cron reconciles pending operations under the same lock, rotates attempts by `updated_at`, and the local test harness invokes its scheduled handler directly. D1 batch is transactional only for its SQL statements; R2+D1 is not an atomic distributed transaction. Persistent provider failures may leave `NEEDS_REPAIR`; this is surfaced in the operation ledger and never described as success. Reconciled DELETE operations become terminal `CLEANED`, so they cannot starve later recovery work.

Local Wrangler's D1 CLI result exposes `meta.duration` but omitted `rows_read` and `rows_written` in the observed run; those provider counters are therefore unavailable in this local runtime evidence, not reported as zero.

Logs contain only a random correlation ID, never request bodies, credentials, email addresses, filenames or object keys. There is no `/__fixture/*` mutation/debug route.
