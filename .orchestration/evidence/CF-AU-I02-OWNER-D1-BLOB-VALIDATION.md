# CF-AU-I02 OWNER D1 BLOB — corrected local candidate

Date: 2026-10-16
Current code commit: `2a65ad370fef062c217332c22492a4a5cb93ad4b`
Current code tree: `55decd177d05f677a0f286d00fc39f397679a75d`
PR #14: <https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/14>

## Defects corrected

- The initial separate Controller review on `23f3ae0` returned REWORK because signature/header checks did not prove image decodability. Full WASM JPEG/PNG/WebP decoders now reject malformed/truncated content and dimension overflow before DB mutation. Browser normalization is capped at 640×480; the Worker independently enforces 307,200 decoded pixels. Full report and exact prompt: `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-B0F0BF6-REWORK.md`.
- GitHub P1 `4296816344` and Controller P1 on `b0f0bf6` required meaningful same-listing add/reorder/delete concurrency evidence. `b6d1bc5` requires at least one successful mutation, derives exact survivor membership, verifies successful reorder effect, byte-for-byte distinct PNG/JPEG/WebP content, dense order, row lengths and quota.
- Controller P1 on `b6d1bc5`: legacy R2 rows (`blob_data IS NULL`) could be hidden from D1 ordering and collide with the unique position constraint. `3b01244` now returns an explicit `409 LEGACY_MEDIA_MIGRATION_REQUIRED` on owner listing/read/mutations and public listing/image routes until the legacy image set is migrated. It does not read R2 or mutate those rows. Mixed-row tests verify rows and idempotency state remain unchanged.
- Controller report and exact prompt: `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-B6D1BC5-REWORK.md`.
- Controller P1 on `757a495`: committed upload/reorder/delete replays bypassed the legacy-row conflict. `964da27` checks for legacy rows before replay and tests committed add/reorder/delete followed by insertion of a legacy row and retry. Report and exact prompt: `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-757A495-REWORK.md`.

## Checks on executable tree `04951f0`

| Check | Result |
|---|---:|
| Worker `npm run test:media -- --reporter=dot` | 15/15 PASS |
| Worker `npm run test:owner -- --reporter=dot` | 4/4 PASS |
| Worker `npm run test:catalog -- --reporter=dot` | 7/7 PASS |
| Worker `npm run typecheck` | PASS |
| Web `npm run typecheck && npm run build:preview` | PASS |
| `npm audit --audit-level=high` in `apps/worker` | 0 vulnerabilities |
| Wrangler deployment dry-run from generated Preview bundle | PASS; 3 WASM decoders included, 822.49 KiB total upload; no remote operation |
| GitHub required checks on reviewed head `d340e74` | worker PASS, web PASS |
| GitHub automatic review on `ee1bcaab` | Completed; two P2 findings corrected in `2a65ad3`; latest exact-head review pending |
| GPT-6 Luna High read-only Controller on exact PR head `d340e74` | Bounded PASS; exact report and prompt in `evidence/critics/CF-AU-I02-D1-BLOB-CONTROLLER-D340E74-PASS.md` |

After the Controller review, GitHub P2 requested that the OWNER image-list error use the image-specific mapper and that the persisted next action stop repeating the already-recorded Controller step. The first is fixed in `2a65ad3` and its Web typecheck/Preview build pass; the second is fixed in the current state checkpoint. Controller reviewed the D1/Worker and image lifecycle; the later one-line Vue error-routing correction does not alter those invariants.

The browser upload/read check used a local synthetic OWNER and a 1920×1080 JPEG; it passed on the earlier decoder/normalization candidate. The current legacy-row correction is exercised through the Worker HTTP route tests. No remote or human photo acceptance is asserted.

## Limits and boundary

Cloudflare Workers Free documents 10ms CPU per request. Normalization and pixel limits bound the decode, but a Node timing proxy is not provider CPU telemetry. Measure provider CPU only on the already-authorized private Preview after protected merge, before asking for photo-journey acceptance.

No R2, new remote resource, billing, production, real data, source-repository modification or Preview update occurred. No merge is authorized by this record; protected merge follows only after exact-SHA Controller PASS, current GitHub findings resolved, required checks, and Pre-Critic pass.
