# CF-AU-I02 — OWNER D1 BLOB image lifecycle

**Authority:** Issue #7 comment 6219058078; owner journey PASS 6/6 at main f17adae. Scope is a complete OWNER journey to upload, view, reorder and remove images in D1 BLOB Free, then publish them only after approval. Reuse the existing private Access Preview, synthetic D1 and Vue app. No R2, paid services, source repository writes, real data or production.

## Platform constraints verified 2026-10-16

Cloudflare official D1 limits (docs last updated 2026-04-21): maximum BLOB/table row 2,000,000 bytes; Free DB 500MB and account 5GB; Free 5m rows read/day and 100k rows written/day. Daily overage fails queries until reset; D1 data egress has no charge. D1 is single-threaded per DB; `batch()` is atomic. Cloudflare also documents Free daily-limit enforcement from 2026-09-01.

Design headroom: max image payload 1,800,000 bytes (metadata remains under row limit); max20 images/listing; D1 trigger-enforced aggregate media BLOB cap250,000,000 bytes in this Preview database, reserving at least250MB of its500MB cap for non-image relational data. These app caps do not police storage used by other D1 databases in the account.

Sources: https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/ .

## Acceptance

1. OWNER (and only OWNER) can list/upload/read/delete/reorder images on own DRAFT/REJECTED listing. SUBMITTED/APPROVED or another owner's listing cannot mutate images.
2. Upload uses a bounded request stream, checks origin, byte length, filename, actual JPEG/PNG/WebP signature, and binds BLOB+metadata+immutable idempotency result in one D1 transaction. Replay returns original result without recreating a subsequently deleted image.
3. DB constraints/triggers enforce exact BLOB byte count, per-row max and aggregate app quota under concurrent uploads; max20 images/listing.
4. Delete and reorder are atomic D1 operations with dense unique positions; state remains consistent under concurrent requests and failures.
5. OWNER UI displays thumbnails and upload/order/delete controls, enforcing the 1.8MB cap client-side for usability while server remains authoritative.
6. Public catalog/detail expose D1 images only when listing is APPROVED and PUBLISHED; unapproved images stay unavailable. Existing Static Assets images remain served.
7. Focused tests prove valid and spoofed MIME/signatures, oversize/stream limit, empty/unsupported input, unauthorized/cross-owner/status denials, quota, 20-photo cap, byte integrity/public visibility, idempotency after delete, delete/order races/rollback, and merged image ordering. Typechecks/build/required CI pass.
8. Read-only GPT-6 Luna/high Controller reviews the exact candidate; GitHub findings material to safety/functionality resolved; protected merge preserves history. Same authorized private Preview is updated only after these checks. Do not infer human acceptance from local tests; request new short owner photo journey only after publication.

## Implementation bounds

Use the existing `listing_images` table with a nullable BLOB column for the D1 strategy; preserve historical R2 implementation untouched behind its strategy. Maintain Static Assets catalog images and combine their metadata for public catalog. D1 mutations require no cross-store saga. No background repair system, broad media architecture rewrite or R2.
