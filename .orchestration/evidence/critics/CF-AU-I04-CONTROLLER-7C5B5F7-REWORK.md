# CF-AU-I04 delegated Controller — REWORK

- Reviewed candidate: `7c5b5f71a2920123fbf219ba0c57de88b2cc8299` (tree `cabc292097d829b051bc212e42723f26a04b8850`), base `774d0c747e8ecbbdb97776641becbd9e49875875`.
- Reviewer: delegated local `project_controller`; requested GPT-6 Luna / High / read-only. Backend identity is not independently attested.
- Verdict: **REWORK, P1**. No P0 reported.

## Finding

The three Wrangler configurations sent generic `/listings/*` requests to the Worker before the Static Assets SPA fallback. The Vue router uses `/listings/:id` for public property detail pages, so anonymous visitors and non-OWNER identities would receive the OWNER API behavior at a public page URL. The prior browser assertion checked only HTTP 200 and could pass against the wrong response type.

The completed GitHub review on the same SHA also reported two P2 defects: OWNER refresh attempted editable-only image loading for `SUBMITTED`/`APPROVED` listings, and a new idempotency key could create duplicate `ADMIN_ASSISTED_LISTING_SUBMITTED` audit events when the listing was already submitted. Both were included in this consolidated rework.

## Repair and evidence

- Removed generic `/listings/*` from local, Preview-template, and E2E runtime configs. Kept `/api/*` for authenticated APIs and only the explicit `/listings/*/availability`, `/listings/*/reconfirm`, and `/listings/*/images[/*]` Worker-first paths.
- Strengthened Playwright to require direct `/listings/:id` requests to return the SPA HTML shell for OWNER and a second synthetic identity, while `/api/listings/:id` remains owner-scoped and cross-owner access returns 404.
- OWNER refresh now loads images only in editable states; Playwright submits a synthetic OWNER listing then refreshes it and checks that no editable-image error appears.
- ADMIN-assisted submit accepts new operations only from DRAFT/REJECTED; same-key replay remains stable, while a fresh key against an already SUBMITTED item returns 409 without a second audit event.
- Fresh Controller follow-up on checkpoint SHA `8981f7e` was technically clear of P0/P1 but returned `BLOCKED_MODEL_CONFIG` because the subagent runtime could not verify the actual model or enforced read-only mode. Its P2 test-hardening request for an explicit post-rejection audit count is addressed in the follow-up test commit; see `.orchestration/evidence/critics/CF-AU-I04-CONTROLLER-8981F7E-BLOCKED.md`.
- Updated the Python routing regression to assert the same configuration boundary.
- Focused verification on executable repair SHA `87f077e`: Python regression suite **25/25 PASS**, Worker management suite **7/7 PASS**, Worker and Web typechecks **PASS**, Web build **PASS**, Preview build **PASS**, fresh local Workerd+D1 Playwright lifecycle **15 checks PASS**, including all three findings. Follow-up audit-count assertion was added after the Controller review and its focused Worker suite/typecheck passed 7/7. Earlier E2E retries exposed ambiguous test selectors only; after narrowing them to listing row and state, the full flow passed.
- No remote resources, Preview, Access policy, production, real data, or source repository were accessed or changed during this repair.

Fresh exact-SHA review is required after publishing this repair. This REWORK report does not approve the candidate for integration.
