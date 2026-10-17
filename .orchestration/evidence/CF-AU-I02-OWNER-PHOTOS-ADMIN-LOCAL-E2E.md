# CF-AU-I02 — OWNER photos and ADMIN moderation local E2E

Date: 2026-10-16 (America/Argentina/Buenos_Aires)
Canonical base: `main@59660aed13f68b92b00cae0eced4494b54f2d8a7`
Scope: synthetic local Workerd + isolated D1 only. No remote resource or deployment changed.

## OWNER D1 BLOB photo journey — PASS

Playwright drove the real Vue OWNER form against the integrated local Worker and a fresh D1 database with migrations `0001`–`0008` and synthetic seed data.

Passed: synthetic OWNER login; draft creation; two valid generated PNG uploads; browser decode of both returned images; dense positions `1–2`; move blue before red; reload and order persistence; authorized image-byte GET returning normalized JPEG; delete red; dense position compaction; reload and delete persistence.

Direct D1 readback after the flow confirmed the remaining synthetic blue image at position `0`, with `mime_type=image/jpeg`, `byte_size=775`, `length(blob_data)=775`. The media accounting trigger also reconciled the stored BLOB bytes. The Worker OWNER lifecycle tests cover denial of other OWNER and ADMIN access to the OWNER slice.

Automated script: `apps/web/e2e/owner-d1-blob.playwright.js`. Synthetic fixtures are `apps/web/e2e/fixtures/owner-e2e-red.png` and `owner-e2e-blue.png`. UI captures: `output/playwright/owner-d1-blob-after-delete-uploaded.png` and `output/playwright/owner-d1-blob-after-delete.png`.

## ADMIN moderation and publication — PASS locally

Playwright completed an OWNER submission with a D1 BLOB image, signed in as a synthetic local ADMIN, loaded the pending listing and image, approved it, and confirmed it remained out of the public catalog until the separate publish action. Publishing made the listing visible in the catalog. A second submission was rejected with a required reason, remained absent from the catalog, and displayed the actor/action/reason in audit history.

The approval/publication split follows the read-only source application. The D1 audit row and status transition are committed as a batch; the focused failure test injects an audit insert failure and confirms the listing remains `SUBMITTED/UNPUBLISHED` with no partial audit event. Repeated approval is rejected without adding a duplicate event. Audit rows preserve actor, target OWNER, listing ID, action, reason, and time independently of listing deletion.

Automated script: `apps/web/e2e/admin-moderation.playwright.js`. Capture: `output/playwright/admin-moderation-audit.png`.

## Verification

- Worker Vitest: `admin-moderation.test.ts`, `owner-lifecycle.test.ts`, `public-listings.test.ts` — **14/14 PASS**.
- Focused Worker typecheck — **PASS**.
- Vue typecheck and integrated Worker/client build — **PASS**.
- Playwright OWNER D1 BLOB UI E2E — **PASS**.
- Playwright ADMIN review, approval/publication, rejection and audit UI E2E — **PASS**.
- `git diff --check` — **PASS**.

The final isolated database was freshly migrated through `0008_admin_moderation_audit.sql` and seeded before these final browser runs. Direct D1 readback confirmed the remaining OWNER image and the ADMIN-reviewed image were valid BLOBs (`775` stored bytes each; `byte_size=length(blob_data)`), and that the three ADMIN actions stored the target synthetic OWNER plus the rejection reason.

## Remote Preview boundary

The automated browser context has no authorized Cloudflare Access session; navigating to the existing private Preview reaches its Access sign-in page. Therefore `LOCAL E2E PASS / REMOTE E2E BLOCKED_AUTH`. No remote product actions were attempted, no Access policy or identity was changed, and no credential, cookie, OTP or API token was used as an Access identity. The existing operator-only Preview remains protected.

This evidence does not claim remote photo acceptance or remote ADMIN acceptance. Remote ADMIN also needs an explicitly authorized ADMIN identity mapping; the current Preview exchange intentionally maps the operator to the fixed synthetic OWNER identity. Do not broaden that mapping or weaken Access as part of this increment.

## 2026-10-17 local rerun and PR findings

The current PR #15 candidate was rerun with Playwright CLI against a newly migrated isolated Workerd/D1 database at `/tmp/cf-au-admin-resume/state` (migrations `0001`–`0008`, synthetic OWNER/ADMIN only). No remote binding was configured.

- OWNER photo E2E: **PASS, 9 checks** using `apps/web/e2e/owner-d1-blob.playwright.js` — two uploads, browser decode, order, reorder, reload persistence, authorized byte GET, delete, compaction and delete persistence.
- ADMIN E2E: **PASS, 9 checks** using `apps/web/e2e/admin-moderation.playwright.js` — OWNER submission, ADMIN review, approval separated from publication, public catalog visibility after publish, reasoned rejection, audit actor/owner/reason, rejected listing stays private, and ADMIN session expiry returns to `/admin` after reauthentication.
- D1 readback: one approved/published synthetic listing has its 775-byte JPEG BLOB; rejected listing is `REJECTED/UNPUBLISHED` with no image. Audit rows show `e2e-admin` and synthetic OWNER plus approval/publication/rejection actions and the rejection reason.
- Worker focused suite: **15/15 PASS** (`admin-moderation`, `owner-lifecycle`, `public-listings`). One initial run hit the existing 5-second timeout on the OWNER lifecycle test while local browser/build processes competed for CPU. The test's assertions passed on rerun after its per-test execution allowance was raised to 15 seconds; the focused suite then passed 15/15. No application behavior was changed for this timing adjustment.
- Worker TypeScript typecheck: **PASS**. Vue typecheck and integrated Worker/client build: **PASS**. `git diff --check`: **PASS**.
- GitHub review findings on prior head `e20a65e`: P1 legacy D1 rows could otherwise be approved/published while image bytes are unavailable; queue now marks affected listings and API guards reject approval/publication with `409 LEGACY_MEDIA_MIGRATION_REQUIRED` until migration. Regression verifies both responses and unchanged unpublished state. P2 expired ADMIN session used to redirect to `/owner`; handler now preserves the protected current route (`/admin`) and the Playwright regression covers it.
- Exact-head automatic review on `ee125ed` found a CI wiring gap: the ADMIN Vitest file was included in Vitest configuration but no CI command invoked it. Added `npm run test:admin` and wired it into `.github/workflows/quick-checks.yml` after OWNER tests. The newly invoked suite passes **4/4** locally and Worker typecheck passes. On PR head `d1bde27`, required GitHub `worker` and `web` checks pass; the `worker` check includes and passed `test:admin`.
- Automatic review on `d1bde27` then found two P2s: the canonical resume state still described the earlier Controller retry as pending, and the global audit query needed an ordering index. The state checkpoint is being reconciled to the completed `ee125ed` Controller PASS and current action. Migration `0008` now adds `admin_audit_events_recent_idx(created_at DESC,id DESC)`; `test:admin` includes an `EXPLAIN QUERY PLAN` assertion that the global recent-audit query uses it without a temporary sort. The updated ADMIN suite passes **5/5** locally and Worker typecheck passes; required CI and GitHub review of the final indexed candidate are pending.
- Delegated Controller PASS on code-equivalent pre-index candidate `d1bde27` found no P0/P1; report: `.orchestration/evidence/critics/CF-AU-I02-OWNER-ADMIN-CONTROLLER-D1BDE27-PASS.md`. A fresh exact-head Controller run is required after the index/checkpoint correction.
- The fresh Controller review on `bb5d7df` returned REWORK for two evidence-quality items: trailing spaces in the just-added prior Controller report, and an EXPLAIN assertion using a simplified query rather than the route's joined global audit query. Both are corrected in the current local candidate: report whitespace removed, and the plan regression now checks the exact joined route query for the index and absence of a temporary sort. The updated ADMIN suite passes **5/5** locally; exact-head CI, GitHub review and Controller rerun are pending.

These results are local synthetic evidence only. The existing private Preview remains Access-protected and unchanged; no authorized Access session is present in this executor, so remote photo E2E remains **BLOCKED_AUTH**. ADMIN has no remote identity mapping. No R2, billing, paid resources, production, real data, or source repository changes were used.

## 2026-10-17 resumed local verification

The PR review on `54d6a42` identified four ADMIN defects. The candidate now returns 401 when an ADMIN session loses its role; applies the Preview-auth configuration fail-closed guard to `/admin`; clears a rejection draft when switching listings; and uses stable keyset pagination with newest submissions first, so new work remains immediately reachable while older rows remain pageable. API and Vue pagination contracts use `{items,nextCursor}`.

- Worker `test:admin`: **6/6 PASS**, covering cursor boundaries, invalid cursor, newest-first order, ADMIN demotion, audit index use, legacy-media guard and audit-failure rollback.
- Worker `test:preview-auth`: **4/4 PASS**, including ADMIN's fail-closed 503 with invalid Preview-auth configuration.
- Worker TypeScript typecheck: **PASS**.
- Vue typecheck and integrated Worker/client production build: **PASS**.
- Playwright ADMIN flow: **PASS, 11 checks**, including reaching the oldest of 101 queued submissions via Load More and clearing the prior listing's rejection reason on selection change.
- Playwright OWNER D1 BLOB flow: **PASS, 9 checks**, verifying two uploads, browser decode, reorder and reload persistence, byte GET, delete and dense compaction.
- `git diff --check`: **PASS** before publication.

Local Workerd and D1 are isolated under `/tmp/cf-au-admin-resume/state`, migrated through `0008`, and use synthetic identities/records only. Browser runs reuse this synthetic state. The ADMIN UI E2E creates 101 synthetic submissions to test pagination; screenshots were refreshed under `output/playwright/`.

These fixes still require review on the new exact PR head. This executor has no authorized Cloudflare Access session, so remote photos remain **BLOCKED_AUTH** and remote ADMIN has no role mapping. The existing protected Preview was not accessed or modified. No Access policy, credential, remote data, billing, R2, production or source repository was used.

## 2026-10-17 ADMIN schema/index REWORK and local rerun

The exact-head GitHub and Controller reviews of `cbe1066` found two more material issues:

- P1: the initial ADMIN audit table did not retain the source `AdminAuditLog` shape (`entityType`, nullable `entityId`/`listingId`/`targetOwnerId`, JSON `metadata`). Migration `0009_admin_audit_shape_and_review_queue_index.sql` rebuilds the table, preserves existing synthetic listing events and rejection reasons into JSON metadata, validates JSON, retains nullable relationships and source indexes, and keeps the UI-compatible `reason` convenience field. API audit output now handles a null target and exposes parsed metadata. A Python regression seeds an old-table event, applies the migration, verifies it is preserved, verifies a generic audit row with no listing/target can be stored, and rejects invalid JSON.
- P2: the paginated queue's exact ordered query still scanned/sorted listings. Migration `0009` adds a partial index for pending/unpublished review rows in `created_at DESC,id DESC` order; Worker `EXPLAIN QUERY PLAN` test asserts that the route query uses it with no temporary sort.

The local-only persistent D1 at `/tmp/cf-au-admin-resume/state` was upgraded with `wrangler d1 migrations apply DB --local --config wrangler.owner-e2e.runtime.jsonc --persist-to /tmp/cf-au-admin-resume/state`; output applied only `0009_admin_audit_shape_and_review_queue_index.sql` to local DB `00000000-0000-0000-0000-000000000071`. No remote operation occurred.

After the final local migration and UI fix, Playwright ADMIN passed **11/11** including reaching item 000 through Load More and clearing a rejection reason on selection change; OWNER photo lifecycle passed **9/9** including uploads, browser decode, reorder, reload, byte read, delete and compaction. The ADMIN pagination E2E now waits for the first page to finish loading before asserting older-page reachability, eliminating a test-only race.

Worker ADMIN Vitest passed **8/8**; Preview-auth passed **4/4**; Worker typecheck passed; Python `unittest discover -s scripts/tests` passed **9/9**, including legacy audit migration preservation and the partial-index query plan; Vue typecheck and integrated Worker/client build passed; `git diff --check` passed. These checks apply to the local candidate after `3e8b5e8`; GitHub checks and Controller must be rerun after publishing these changes. Remote photos remain `BLOCKED_AUTH`; Preview and Access policies are unchanged.

The completed GitHub review on PR head `43d38cb` found one final P2: the machine-readable `apps/worker/docs/postgres-d1-map.json` still marked `AdminAuditLog` unimplemented after the Markdown map and D1 migration were corrected. The JSON ledger now records `OPERATIONAL_SYNTHETIC`, `admin_audit_events`, migration `0009`, source-shaped fields, JSON validation and indexes. JSON parsing and the Python migration regression suite pass 9/9. This is a parity-ledger correction; it does not change executable behavior. Re-run exact-head GitHub review and Controller after publishing it.
