# CF-AU-I03 — Contact, availability and assisted-management evidence

Authority: Issue #7 comment 6248758792. Base `main`: `a1626e3a375a33bb76561e8666d6bdb070b77de5`. Executable implementation began at `df7e178d6b12729eb39971b76778cad54d5899ab`; current rework is on `work/contact-availability-journeys` and pending publication.

## Implemented journeys

- Public listing detail → validated contact request → unread D1 event for the owner.
- OWNER → paginated contact inbox/read state; update/reconfirm listing availability.
- ADMIN → assisted OWNER draft creation with audit event and stable request replay.

## GitHub review findings resolved in current local candidate

- ADMIN-assisted creation now requires `Idempotency-Key`, fingerprints the normalized request, atomically commits the listing, audit row and original response snapshot; replay returns that exact response, payload mismatch returns 409. The ADMIN form reuses its key after a transport failure for an unchanged form.
- OWNER inbox is bounded to 30 results per page with stable `(created_at,id)` cursor and SQL unread count.
- Migration 0011 and Markdown/JSON parity ledgers now include all three source ContactEvent indexes, including `(owner_id,state,created_at)`.

## Verification

- Focused Worker tests (`contact-workflow.test.ts`, `public-listings.test.ts`): 2 files / 11 tests PASS after rework. Includes successful replay equality, key/payload conflict, owner page bound/cursor coverage and SQL unread-count comparison.
- Worker TypeScript check: PASS.
- Web TypeScript check: PASS.
- Web production build: PASS.
- Local headed Playwright against Vite + integrated Worker / synthetic local D1: catalog and OWNER inbox loaded; ADMIN navigated to assisted management and created a synthetic audited draft successfully. The earlier local synthetic contact submission and OWNER availability/reconfirm journey also passed. Screenshot: `output/playwright/admin-assisted-local.png`.
- `git diff --check`: PASS.
- GitHub `worker`/`web` quick checks had passed on pre-rework HEAD `9e7b336`; they must rerun on the rework commit before merge.
- No full Wrangler suite rerun: only `contact_events`, assisted creation and their Vue forms changed; focused service tests plus GitHub's required `worker`/`web` checks cover this increment.

## Remote boundary

The user completed normal Cloudflare Access login in the visible headed browser. Do not export/save cookies, JWT, OTP, credentials or storage state. The authenticated remote smoke is to be performed against the new deployed code only after protected integration. Access policies remain unchanged. Existing private Preview is the sole remote target.

No Service Token, R2, paid service, Access-policy change, new Cloudflare resource, production deployment, real data, or source-repository write was used.

## Controller rework: pagination state retention

A consolidated Controller review found that changing a state on page two replaced the inbox with only that page. The OWNER view first retained loaded cursors; subsequent GitHub review identified that a concurrent new contact could shift page boundaries and still drop a row during a multi-page reload. The current implementation applies the confirmed state change to the loaded event in place and refreshes only the aggregate unread count from page one, avoiding page-boundary reconstruction. Local Playwright loaded multiple pages, submitted a new synthetic contact while page two was open (HTTP 201), marked a page-two item read, and confirmed that `Pagina 30` on page one remained visible and the page-two state control changed. Screenshot: `output/playwright/owner-contact-concurrent-arrival-local.png`. The initial pagination proof is retained at `output/playwright/owner-contact-pagination-local.png`.

## GitHub routing/auth rework

GitHub review also flagged direct `/owner/*` dispatch, missing Preview fail-closed coverage for owner APIs, and direct availability/reconfirm Worker routing. All three Static Assets configs now route `/owner/*`, `/listings/*/availability`, and `/listings/*/reconfirm` to Hono; the Preview guard includes `/owner`. Regression checks cover all three configs and an owner request under invalid Preview auth returns 503. Current focused verification: Worker typecheck PASS; `contact-workflow.test.ts` + `preview-auth.test.ts` PASS (2 files / 10 tests); web typecheck and production build PASS; Python config tests PASS (12/12); local Playwright concurrent-arrival pagination scenario PASS; `git diff --check` PASS. Exact-head GitHub checks/review and the consolidated Controller follow-up remain pending.

## Contact retry/idempotency and parity update

GitHub review found that a lost public contact response could create a duplicate inbox event on retry. Migration `0012_contact_submission_idempotency.sql` adds nullable request key/fingerprint columns and a unique `(listing_id, submission_key)` index. The public endpoint now requires a bounded idempotency key, returns the same event ID and 201 result on replay, and returns 409 if a key is reused with changed content. The Vue form preserves its key for the same unchanged payload after a failed response and clears it only on success. Focused Worker tests cover missing key, replay equality, changed-payload conflict and a single inbox event. Local integrated API replay check passed: same key/payload returned the identical 201 response and ID; changed payload returned 409. The parity ledgers now describe owner availability/reconfirmation and the contact idempotency columns/migration. These changes still require exact-head GitHub checks/review and the consolidated Controller follow-up.
