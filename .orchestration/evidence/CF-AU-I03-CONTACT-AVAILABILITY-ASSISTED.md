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

A consolidated Controller review found that changing a state on page two replaced the inbox with only that page. The OWNER view now retains the cursors of loaded pages and refreshes them all after a state update. Local browser QA seeded 31 additional synthetic messages on the local Worker, opened page two, marked its oldest event as read, and confirmed that `Pagina 30` on the first page remained present while `Pagina 00` showed `Leída`. Screenshot: `output/playwright/owner-contact-pagination-local.png`. The fix's web typecheck/build and whitespace check pass. Exact SHA and final CI/review are pending publication.

## GitHub routing/auth rework

GitHub's next pass flagged direct `/owner/*` asset routing and missing Preview fail-closed coverage for owner APIs. The Worker guard now includes the owner route family; the three local/Preview/runtime `run_worker_first` configs dispatch `/owner/*` to Hono. Regression checks verify all three route configs and that an owner request under missing Preview auth configuration returns 503. After these corrections: Worker typecheck PASS; focused `contact-workflow.test.ts` + `preview-auth.test.ts` PASS (2 files / 10 tests); web typecheck PASS; Python config tests PASS (11/11); `git diff --check` PASS. Web build PASS on unchanged web tree after the inbox pagination fix. Final exact-head GitHub quick checks and automatic review remain pending.
