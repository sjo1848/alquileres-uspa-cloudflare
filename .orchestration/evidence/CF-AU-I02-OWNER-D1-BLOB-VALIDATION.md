# CF-AU-I02 OWNER D1 BLOB — corrected local candidate

Date: 2026-10-16
Executable commit: `3b012442bf9304743df4aa9c6e3b9f861ac825c7`
Executable tree: `50b84899ebd9dc40203ea33a5ffb97ed2f75b168`
PR #14: <https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/14>

## Defects corrected

- The initial separate Controller review on `23f3ae0` returned REWORK because signature/header checks did not prove image decodability. Full WASM JPEG/PNG/WebP decoders now reject malformed/truncated content and dimension overflow before DB mutation. Browser normalization is capped at 640×480; the Worker independently enforces 307,200 decoded pixels. Full report and exact prompt: `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-B0F0BF6-REWORK.md`.
- GitHub P1 `4296816344` and Controller P1 on `b0f0bf6` required meaningful same-listing add/reorder/delete concurrency evidence. `b6d1bc5` requires at least one successful mutation, derives exact survivor membership, verifies successful reorder effect, byte-for-byte distinct PNG/JPEG/WebP content, dense order, row lengths and quota.
- Controller P1 on `b6d1bc5`: legacy R2 rows (`blob_data IS NULL`) could be hidden from D1 ordering and collide with the unique position constraint. `3b01244` now returns an explicit `409 LEGACY_MEDIA_MIGRATION_REQUIRED` on owner listing/read/mutations and public listing/image routes until the legacy image set is migrated. It does not read R2 or mutate those rows. Mixed-row tests verify rows and idempotency state remain unchanged.
- Controller report and exact prompt: `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-B6D1BC5-REWORK.md`.

## Checks on executable tree `50b8489`

| Check | Result |
|---|---:|
| Worker `npm run test:media -- --reporter=dot` | 14/14 PASS |
| Worker `npm run test:owner -- --reporter=dot` | 4/4 PASS |
| Worker `npm run test:catalog -- --reporter=dot` | 7/7 PASS |
| Worker `npm run typecheck` | PASS |
| Web `npm run typecheck && npm run build:preview` | PASS |
| `npm audit --audit-level=high` in `apps/worker` | 0 vulnerabilities |
| Wrangler deployment dry-run from generated Preview bundle | PASS; 3 WASM decoders included, 822.49 KiB total upload; no remote operation |
| GitHub required checks on `3b01244` | PENDING |
| GitHub automatic review on current candidate | PENDING |
| Fresh GPT-6 Luna High read-only Controller on current corrected tree | PENDING; prior exact-candidate REWORKs are preserved and are not PASS |

The browser upload/read check used a local synthetic OWNER and a 1920×1080 JPEG; it passed on the earlier decoder/normalization candidate. The current legacy-row correction is exercised through the Worker HTTP route tests. No remote or human photo acceptance is asserted.

## Limits and boundary

Cloudflare Workers Free documents 10ms CPU per request. Normalization and pixel limits bound the decode, but a Node timing proxy is not provider CPU telemetry. Measure provider CPU only on the already-authorized private Preview after protected merge, before asking for photo-journey acceptance.

No R2, new remote resource, billing, production, real data, source-repository modification or Preview update occurred. No merge is authorized by this record; protected merge follows only after exact-SHA Controller PASS, current GitHub findings resolved, required checks, and Pre-Critic pass.
