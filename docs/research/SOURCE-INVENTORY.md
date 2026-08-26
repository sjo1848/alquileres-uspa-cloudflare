# CF-AU-I00 — Source inventory

Observed: 2026-08-26  
Source: `sjo1848/alquileres-uspa` at `cff14159daa1698a9ee04ea317c4a2c356112ae0`

## Runtime and product surface

The source is a pnpm workspace with a Vue 3/Vite web app and a NestJS API. The API uses Prisma Client against PostgreSQL. The browser uses an application-managed `alquileres_session` cookie; registration and login issue a 15-minute HttpOnly, SameSite cookie, and logout clears it. JWT verification and role checks are performed by the application.

The source README explicitly excludes payments, reservations, tourism, realtime flows and notifications. I13 product acceptance remains a source-project dependency; this lab does not treat it as accepted.

## Persisted models

The current Prisma schema contains `users`, `listings`, `listing_images`, `contact_events` and `admin_audit_logs`. Enums are `Role`, listing review/publication/availability states, contact state, price period, rental duration and currency. Foreign keys use owner/listing cascades and audit actor/target-owner restrict semantics. Listing image order is protected by `(listing_id, position)` uniqueness; object keys are globally unique.

There are 10 forward migrations. The I13 migration deliberately leaves legacy `price_per_night` and `max_guests` untouched and quarantines them from new rental-domain fields. The availability migration later nulls historical `last_confirmed_at` values because creation time is not proof of owner confirmation. These are parity-critical truthfulness rules.

## HTTP surface

| Area | Source routes / behavior | Target concern |
|---|---|---|
| Health | `GET /health` with database check and 503 on failure | D1 query and non-sensitive response |
| Auth | register, login, logout, me, admin-check | Web Crypto/JWT implementation, cookie parity, secret handling |
| OWNER listings | CRUD, submit, availability update/reconfirm | owner derived from session; no client actor |
| OWNER images | upload, list, delete, reorder | multipart parsing, R2/D1 compensation and ordering |
| ADMIN review | review, approve, reject, publish | role guard and workflow idempotency |
| ADMIN assisted | create/edit/availability/reconfirm/submit/delete | target owner validation and audit transaction |
| ADMIN audit | audit query and owner list | actor/target/entity traceability and cap |
| Public catalog | paginated/filterable list and public detail | published + approved predicate and deterministic ordering |
| Public images | ordered image metadata/object delivery | object key is not an auth boundary |
| Public contact | create contact event for public listing | server-resolved owner and validation |
| OWNER contacts | list/detail/state update | owner isolation and contact-event state |

## Evidence method

Inventory was produced from `package.json`, `README.md`, `apps/api/prisma/schema.prisma`, all 10 migration SQL files, controllers, auth guards/services, listing/image/contact services and tests. No source files were modified. The source repository was cloned read-only for inspection and its HEAD matched the pinned bootstrap commit.
