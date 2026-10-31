# Alquileres Uspallata local application lab

## Navegar catálogo y fichas (datos sintéticos)

Desde `apps/web`, inicializá una vez la D1 local y levantá la aplicación integrada Vue + Worker:

```sh
npm run seed:local
npm run dev
```

Abrí `http://127.0.0.1:5173`. Vite sirve el frontend y conecta el Worker y D1 locales en un solo proceso de desarrollo. `npm run build` valida el bundle integrado. No se requiere `wrangler dev` como servidor separado.

Las credenciales y propiedades son sintéticas. `npm run seed:local` solo inicializa almacenamiento local; no usa `--remote`.

Las imágenes de esta versión son ilustraciones sintéticas bajo `apps/web/public/media/catalog`, gestionadas por repositorio y Static Assets. No hay R2 en la configuración activa ni subida OWNER habilitada. `npm run test:catalog` y `npm run test:media` desde `apps/worker` son verificaciones rápidas.

Preview: `npm run build:preview` compila la plantilla sin desplegar. La D1 de la plantilla es un UUID inválido de ejemplo; sustituirla por la D1 sintética aislada solo después de verificar Workers/Access Free. `python3 scripts/cloudflare-preview-preflight.py` desde la raíz consulta permisos/planes sin mutaciones; requiere Billing Read, Access Organizations Read y Access Apps/Policies Write en un token local. Mantener un único Preview `private` y proteger todas sus URLs con Access antes de publicarlo.

## Autenticación OWNER local sintética

Desde `apps/worker`, ejecutá `npm run local:owner-auth`. En un checkout limpio instala dependencias del Worker y de web, construye el SPA, aplica migraciones solo en D1 local y levanta Wrangler en `127.0.0.1`; crea una cuenta desde la pantalla de registro y usa el buzón mock solo local para verificarla. No envía correo real ni configura Preview.

## Laboratorio histórico OWNER de P2

The preserved P2 test harness (`wrangler.test.jsonc`) requires Node 24+, npm, and Wrangler. It uses synthetic accounts and local D1/R2 stores; configuration has no remote binding or production secret. Authentication fails closed unless `JWT_SECRET` is provided with at least 32 UTF-8 bytes. The legacy OWNER HTTP test harness uses `wrangler dev --local` and never calls `--remote`.

```sh
npm ci && npm run local:up -- --var JWT_SECRET:replace-with-a-local-only-secret
```

`local:up` applies migrations, seeds only synthetic users, and starts Wrangler bound to `127.0.0.1` with the dedicated `wrangler.local.jsonc` config (`PASSWORD` + `MOCK`, D1 BLOB, and no R2 binding). Those flags are for local development only; Worker auth also checks the request hostname and rejects PASSWORD mode on non-loopback hosts. The command-line JWT value above is a local-only placeholder; use a different random secret of at least 32 bytes outside test runs, and never commit it. Login and `/listings/*` fail closed when the secret is absent or too short; no empty-key JWT is accepted. Keep this terminal running. Login/logout and cookie-authenticated POST/PATCH/DELETE requests must carry an `Origin` exactly matching the Worker origin; browser same-origin requests do this automatically. This check blocks cross-origin form/fetch and login-CSRF side effects. Bearer-authenticated API mutations do not use cookies and are not subject to the Origin check.

In another terminal, run the one-command integration suite. It first runs the focused idempotency/replay cases, then applies migrations, resets/seeds synthetic users and starts the full local HTTP Worker suite:

```sh
npm test
npm run typecheck
```

The focused local replay fault test exercises ignored D1 idempotency updates for keyed upload/reorder, a later mutation, and historical response replay:

```sh
npm run test:retry
```

Seed owners use `synthetic-owner-password-1`; password hashes are bcrypt cost 12 and are inherited from the earlier source-compatible local auth fixture. Never reuse these users or secret outside the local lab.

## Implemented API

| Method | Route | Result |
|---|---|---|
| `POST` | `/auth/login` | Source-shaped `{user}` and `alquileres_session` HttpOnly/SameSite cookie, 200 |
| `POST` | `/auth/logout` | Clears the cookie; does not revoke an already issued bearer token, matching source behavior |
| `GET` | `/listings` | Current OWNER's listings |
| `GET` | `/listings/:id` | One listing owned by the authenticated OWNER |
| `POST` | `/listings` | Source-required listing fields; creates a DRAFT with source camelCase fields, 201 |
| `DELETE` | `/listings/:id` | Idempotently delete only an owned DRAFT/REJECTED listing and cascade its D1/static image metadata |
| `GET/POST` | `/listings/:id/images` | List source-shaped image metadata or multipart-add field `image` |
| `GET` | `/listings/:id/images/:imageId` | Private image bytes for an owned DRAFT/REJECTED listing |
| `PATCH/DELETE` | `/listings/:id/images/:imageId` | Reorder by `{position}` / delete and compact |
| `GET` | `/public/listings` | Paginated/filterable APPROVED + PUBLISHED catalog |
| `GET` | `/public/listings/:id` | Public detail for APPROVED + PUBLISHED listing |
| `GET` | `/public/listings/:id/images/:imageId` | Public image bytes only for visible listings |
| `POST` | `/public/listings/:id/contact` | Validated public contact; requires `Idempotency-Key`, persists one unread event and replays the original event on retry |
| `GET` | `/owner/contact-events` | OWNER-only cursor-paginated inbox (30 per page) and unread count |
| `PATCH` | `/owner/contact-events/:id/state` | OWNER-scoped `UNREAD`/`READ` update |
| `PATCH` | `/listings/:id/availability` | OWNER-scoped availability update |
| `POST` | `/listings/:id/reconfirm` | OWNER-scoped availability reconfirmation |
| `GET` | `/admin/owners?search=` | ADMIN-only bounded OWNER search for assisted management |
| `POST` | `/admin/listings/assisted` | ADMIN-only idempotent draft creation for an existing OWNER, with audit event |
| `GET` | `/admin/listings/assisted?ownerId=...` | ADMIN-only bounded list of that OWNER's editable assisted drafts |
| `PATCH` | `/admin/listings/assisted/:id` | ADMIN-only edit of a DRAFT/REJECTED listing; OWNER target is loaded from D1 and the action is audited |
| `PATCH` | `/admin/listings/assisted/:id/availability`, `POST /admin/listings/assisted/:id/reconfirm` | ADMIN-assisted availability and confirmation updates with audit events |
| `POST` | `/admin/listings/assisted/:id/submit`, `DELETE /admin/listings/assisted/:id` | ADMIN-assisted submission or editable-draft deletion with audit events |
| `GET` | `/admin/listings/review`, `/admin/listings/audit` | ADMIN review queue and audit history |
| `GET` | `/admin/listings/:id` | ADMIN listing detail |
| `POST` | `/admin/listings/:id/review`, `/approve`, `/reject`, `/publish` | ADMIN moderation and publication actions with audit history |
| `GET` | `/admin/listings/:id/images/:imageId` | ADMIN review image bytes |

Listing create/list returns source camelCase fields; image list/add/reorder returns `id`, `originalName`, `contentType`, `sizeBytes`, `position` and `createdAt`; delete returns an empty 200 response. These mappings and tested denial statuses are asserted by the HTTP suite.

Private OWNER image-byte GET is not present as an OWNER route in the pinned source controller; P2 adds this bounded route to make the requested private retrieval journey executable. **Source route parity remains unresolved** pending controller/product confirmation. Auth also retains three explicitly unresolved P0/P1 details: its email check is narrower than source `class-validator` `IsEmail`; JWT expiry parsing accepts only integer `s/m/h/d` forms rather than the full source `jsonwebtoken` option behavior; and malformed percent-encoding in a cookie returns 401 here while source decoding escapes as 500. Registration remains out of scope. ContactEvent and AdminAuditLog are implemented for the bounded synthetic journeys documented above; they do not claim historical data migration.

The listing lock is a D1 lease with token-fenced image metadata writes; the per-listing operation is serialized while its lease is held. Image routes recheck OWNER/status under the lease and fence their D1 mutations against both the lease and current DRAFT/REJECTED ownership. Any later listing status transition must use the same listing lease. A five-minute cron reconciles pending operations under the same lock, rotates attempts by `updated_at`, and the local test harness invokes its scheduled handler directly. D1 batch is transactional only for its SQL statements; R2+D1 is not an atomic distributed transaction. Persistent provider failures may leave `NEEDS_REPAIR`; this is surfaced in the operation ledger and never described as success. Reconciled DELETE operations become terminal `CLEANED`, so they cannot starve later recovery work.

Local Wrangler's D1 CLI result exposes `meta.duration` but omitted `rows_read` and `rows_written` in the observed run; those provider counters are therefore unavailable in this local runtime evidence, not reported as zero.

Logs contain only a random correlation ID, never request bodies, credentials, email addresses, filenames or object keys. There is no `/__fixture/*` mutation/debug route.

La plantilla `wrangler.preview-migrations.example.jsonc` es solo un ejemplo con UUID placeholder. Para el Preview privado existente, las migraciones remotas deben pasar por `scripts/preview_cd_guard.py apply-remote`: valida target, procedencia y hash exacto; para 0015 también exige que `CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA` coincida con el SHA de `main` que ejecuta el workflow. Sin esa autorización 0015 no se aplica. No ejecutar `wrangler d1 migrations apply --remote` directamente ni usar el ejemplo como destino remoto. Los seeds son exclusivamente locales/sintéticos.
