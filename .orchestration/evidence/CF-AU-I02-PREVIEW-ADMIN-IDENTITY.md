# CF-AU-I02 — Preview OWNER/ADMIN identity switch and moderation journey

Date: 2026-10-18. Authority: Issue #7 comment 6245079462 plus the Human instruction in this session.

## Candidate and scope

- Canonical base: `main@42bef5c53abea65720082bbd86da9a082a51ed51`.
- Executable/test commit: `e12dbdcd8a1704a86a5ace65a23f0e2d1d59d1e3`; tree `9145e36e2d6aebb39b13c9dae8e5197724dd4b64`.
- Scope: let the already-allowlisted Cloudflare Access operator explicitly choose one of two fixed synthetic identities in the existing Preview: OWNER or ADMIN. The Worker still verifies the signed Access app JWT (RS256, pinned issuer, audience, time claims, exact allowlisted operator email, non-empty subject and app-token type), exact origin, and the fixed D1 id/email/current role before issuing a short-lived app session. The client supplies only `role`; extra identity fields and roles are rejected. Existing HttpOnly/Secure/SameSite cookie, CSRF/Origin and per-request D1 role checks remain.
- The Preview selector appears only after `/auth/config` returns `ACCESS_PREVIEW`. It clears the current cookie/session before presenting the role choices. Password authentication in the local/production strategy is unchanged, and the selector is absent in PASSWORD mode.
- No Access policy/app, production auth, D1 schema migration, source repo, HMS/portfolio, R2, paid service, new resource, production host or real data was changed. No remote operation has been performed for this candidate.

## Verification on the executable/test tree

- `npm --prefix apps/worker run test:preview-auth`: **6/6 PASS**. `jose` verifies synthetic RS256 tokens against a test JWKS and covers issuer/audience/time/type/email/subject, fixed-role D1 mapping, wrong D1 role/email, forged identity fields, origin and OWNER/ADMIN route separation.
- `npm --prefix apps/worker run typecheck`: **PASS**.
- `npm --prefix apps/web run typecheck`: **PASS**.
- `npm --prefix apps/web run build`: **PASS**.
- Playwright CLI with integrated local Workerd + isolated local D1, migrations `0001`–`0010`, and synthetic OWNER/ADMIN rows: **6 checks PASS**. OWNER created/submitted a listing, switched explicitly after logout to the distinct ADMIN demo identity, approved it while it remained unpublished, then separately published it and confirmed catalog visibility. The selector is absent under the local PASSWORD config. Screenshot: `output/playwright/preview-admin-role-switch.png`.
- Local Playwright test adapter substitutes a local synthetic password login only for the browser's `/auth/preview-session` exchange; it does not simulate or claim a remote Access login. Cryptographic Access-JWT verification is exercised separately in the Worker test above. The initial anonymous `/auth/me` 401 in the browser console is the expected session-restore probe before login; no application warning was observed.
- `node --check apps/web/e2e/preview-role-switch.playwright.js` and `git diff --check`: **PASS**.

## Integration/security review

The UI sends only an enum role. The server maps it to constants `synthetic-catalog-owner` or `synthetic-catalog-admin`, queries the corresponding fixed email and exact current D1 role, and uses the verified Access token expiry to cap the app cookie. User id/email/role fields from the request cannot choose an account. Existing Worker middleware rejects OWNER on `/admin/*` and ADMIN on `/listings/*`; tests exercise both boundaries. The role selector is not reachable in PASSWORD mode, and the Preview route is still protected by the unchanged operator-only Access policy.

## Review/deployment boundary

This is local/synthetic evidence, not remote Access or remote browser evidence. GitHub required checks/review and the exact-candidate delegated Controller are pending. No Preview D1 migrations or seed, deployment, or remote mutation has occurred. After protected integration, the existing synthetic Preview needs migrations `0008`–`0010` if not already present, idempotent application of `tests/seed-preview-admin.sql`, then a guarded Preview-only update and anonymous Access denial verification. Do not report authenticated remote E2E PASS unless the operator's real Access session is exercised.

## Checkpoint traceability correction

GitHub's review of the initial checkpoint `09575923ee4f61945d686dec9864bf129e41a293` found that `READY_TO_RESUME` directed the next run to its sibling executable commit `e12dbd...`, omitting the checkpoint commit itself. Corrected in Event 105 and STATUS: `e12dbd...` is explicitly the executable/test provenance only; the authoritative candidate is the live PR #17 head resolved from GitHub and verified against the checked-out branch. The fix is documentation-only; all executable tests above remain applicable to the unchanged tree. Exact-head checks and the focused Controller remain pending.

## Canonical resume-field correction

A focused Controller inspection found the top-level STATUS event sequence and resume action remained stale after Event 105. Corrected in Event 106: the next runner must resolve the live PR #17 HEAD and verify ancestry; `e12dbd...` is executable provenance only and must not be used as a checkout/push target. The nested Preview ADMIN record keeps `20c80c6...` as the last observed (not perpetually current) PR checkpoint, with live GitHub ref required at resume. No executable files changed; exact new-head checks/review and final Controller PASS remain pending.

## Top-level active-state correction

GitHub review of checkpoint `64120b7...` found stale top-level `pull_request` and `external_review` fields still pointing at completed PR #15 and historical CF-AU-I01-P2 A4. Event 107 updates current STATUS to CF-AU-I02 / PR #17 and archives those previous values under `historical_status.pr15_completed` without deleting or rewriting their evidence. The active candidate/checkpoint/executable provenance are distinct, current integration is pending, and the resume action resolves the live GitHub PR head. This is documentation-only; worker/web checks remain the latest verified evidence on the prior state checkpoint and will be refreshed for this checkpoint.

## Immutable review boundary

GitHub's review of `1f47c90...` found the canonical resume path omitted the mandatory Pre-Critic and immutable Artifact A boundary. Event 108 now requires, in order: exact live PR head/checks/review/protection; Pre-Critic PASS; one immutable annotated A1 tag on the exact checkpoint; exact-tag Controller PASS; protected integration. STATUS expressly says A1 is pending, with no premature PASS/tag claim. This change is documentation-only.
