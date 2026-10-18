# CF-AU-I03 — Local journey evidence

Authority: Issue #7 comment 6248758792. Code commit: `df7e178d6b12729eb39971b76778cad54d5899ab` (branch `work/contact-availability-journeys`, based on `main@a1626e3a375a33bb76561e8666d6bdb070b77de5`).

## Implemented journeys

- Public listing detail → bounded contact form → success receipt; Worker persists an unread contact event only for an approved/published listing.
- OWNER → scoped inbox → mark read/unread; published listing → change availability → reconfirm.
- ADMIN → select existing synthetic OWNER → create assisted draft; the D1 batch records the action in audit history.

## Verification on the final executable candidate

- Worker and web TypeScript checks: PASS.
- Focused Worker tests (`contact-workflow.test.ts`, `public-listings.test.ts`): 2 files / 10 tests PASS.
- Web production build: PASS.
- Local Playwright against Vite + integrated Worker and isolated synthetic D1: PASS for all three journeys above. Evidence screenshot: `output/playwright/admin-assisted-local.png`.
- `git diff --check`: PASS.
- One unauthenticated startup probe to `/api/auth/me` returned expected HTTP 401 while restoring an empty session; it did not interrupt the public journey.
- Full suite not run; this increment is limited to the affected contact/listing routes and a local browser flow.

## Remote boundary

The user initiated normal Cloudflare Access login in the visible headed Playwright browser. Authenticated remote E2E remains pending until that login completes; no cookies, tokens, OTP, credentials, or storage state were captured or persisted. Access policies and Preview resources were not changed by this local implementation. The existing private Preview remains the only authorized remote target; anonymous Access smoke is required after any future authorized Preview update.

No R2, new resource, paid service, production deployment, real data, Service Token, Access-policy change, or source-repository write was used.
