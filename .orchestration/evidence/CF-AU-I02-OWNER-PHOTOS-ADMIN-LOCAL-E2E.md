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
