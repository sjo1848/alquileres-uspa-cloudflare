# CF-AU-I05 — local synthetic OWNER auth evidence

Authority: Issue #7 Human decision comment `6265554947`. Base: `main@093bd9128653281b79599caf61bb6fa979b8fb49`.

## Architecture decision

- The source repository remains read-only. Its OWNER registration creates a password-backed OWNER account and has no email verification/reset lifecycle. The lab's prior Worker already used bcryptjs, HS256 JWT, HttpOnly/SameSite cookies, exact-Origin checks and D1 role revalidation.
- Keep bcrypt cost 12 for local source-contract fidelity. Existing Cloudflare Free CPU evidence is not path-attributed enough to prove Free-tier viability, while the local bcrypt proxy is substantially above the documented Free per-request CPU budget. Do not reduce the work factor to force compatibility.
- No arbitrary-recipient mail delivery is available under the authorized Free setup, and no provider was selected. The implementation uses only a bounded in-memory mock mailbox on explicitly configured loopback Workerd. It does not represent a delivered or production verification email.
- Therefore local registration, verification, password login, logout/revocation and password reset are testable; Preview/public enrollment, external mail, OAuth and production authentication remain disabled/out of scope.

## Implemented and reviewed paths

- Registration accepts only email/password and always creates `OWNER`; passwords are bcrypt cost 12 and capped at 72 UTF-8 bytes. Duplicate registration has the same response; an unverified duplicate can receive a fresh mock verification link.
- Verification and reset tokens are 256-bit random values; only SHA-256 hashes are stored in D1. Tokens expire after one hour and are consumed once. Password reset advances `session_version`; logout advances it for the account, invalidating every prior session. Existing accounts at migration time remain usable; new accounts are unverified by default.
- Login has a generic unknown/wrong/unverified response, bounded request bodies, constant-work unknown-account comparison and hashed fixed-window rate-limit buckets. Mutations require exact Origin. Sessions remain HttpOnly, SameSite and 15-minute cookies with JWT expiry validation and D1 role/version revalidation.
- Password auth is reachable only when all are true: URL host is loopback, `AUTH_STRATEGY=PASSWORD`, `LOCAL_OWNER_AUTH_ENABLED=true`, and `LOCAL_EMAIL_ADAPTER=MOCK`. Protected auth/OWNER/ADMIN routes fail closed for remote hosts. Existing `ACCESS_PREVIEW` role switching remains unchanged; no signup/reset link is rendered there.
- Local start command: `npm run local:owner-auth` from `apps/worker`; it runs only local D1 migrations and binds Wrangler to `127.0.0.1`. Automated test entry: `npm run test:owner-auth`.

## Verification

- `npm run typecheck` in `apps/worker`: PASS.
- `npm run test:owner-auth`: 4/4 PASS, covering remote/loopback guard, cross-Origin and role injection, duplicate enumeration response, unverified and replay/expired paths, hashed tokens, OWNER-only creation, rate limiting, session revocation, reset and old-password invalidation.
- `npm run test:preview-auth`: 6/6 PASS; the Access Preview strategy remains intact and password mode without explicit local configuration fails closed.
- Consolidated Workerd/D1 run (`local-owner-auth`, `preview-auth`, `owner-lifecycle`, `contact-workflow`): 20/20 PASS.
- `npm run typecheck`, `npm run build`, and `npm run build:preview` in `apps/web`: PASS.
- `python3 -B -m unittest discover -s scripts/tests`: 25/25 PASS.
- Playwright CLI against local Worker + synthetic D1 exercised register → mock mailbox/verify → login → request/reset password → new login → OWNER dashboard → logout. After the final Worker fail-closed middleware change, all 20 relevant Worker tests above were rerun and the final local build again passed login → OWNER dashboard → logout. The initial browser-only unauthenticated `/auth/me` response was expected HTTP 401; no browser exception was observed.
- No Preview request, remote migration, deployment, Access mutation, paid service, R2, real identity/data, or source-repository write was used. Remote authenticated E2E remains `BLOCKED_AUTH`.

## Review boundary

This evidence is for the consolidated local synthetic candidate only. It does not claim successful external email delivery, Free-tier production CPU compatibility, or remote/production authentication. Exact executable SHA, GitHub checks/review, Controller provenance/verdict and final Pre-Critic result are to be appended only after those controls run.

## Consolidated GitHub review corrections (candidate `6c344ce710a9e9636afd3c546ca4a6a2519d3d01`)

- Added `sv:0` to the preserved HTTP harness's signed positive-control JWT; its seeded session version is zero. `node --check apps/worker/tests/http.mjs` passes. The preserved full HTTP/R2 harness was not run for this correction.
- `local:up` now uses isolated `wrangler.local.jsonc`: PASSWORD + MOCK, D1_BLOB, no R2 binding; local Worker binds to `127.0.0.1`. Smoke verified `/health` and seeded synthetic OWNER login return 200 and set a session cookie. No remote binding/resource was involved.
- Focused Worker checks after fixture updates: catalog 7/7, media 15/15, ADMIN moderation 12/12, OWNER management 13/13, local auth 4/4, Preview auth 6/6, Worker typecheck PASS. GitHub full `worker`/`web` quick-check run `39245540349` passed the previous checkpoint `ccd2f5695e4c29379c892c8eacbf1b51f2dafb65`; final exact-head run remains pending for the harness/startup edits.
- Review findings fixed: `4313265555`, `4313360409`, `4313360419`. The final GitHub review and exact-SHA Controller must still complete before closeout.
- Clean-start repair after GitHub finding `4313445923`: `local:owner-auth` now installs web dependencies/builds the SPA before local D1 migration and loopback Worker start. Full command smoke: `/health` 200 and `/auth/config` confirms PASSWORD registration. `local:up` smoke also confirmed seeded OWNER login 200 with D1 BLOB and no R2 binding.
- GitHub finding set for final pass: `4313265555`, `4313360409`, `4313360419`, `4313445923`, each repaired in code/test/config and awaiting final exact-head confirmation.

## GitHub P2 4313547498 — bearer-only logout revocation regression

- The final automated review of checkpoint `3be04bc0fc3ccd675b6b6c2528c345f9628e2726` found that local logout cleared only a session cookie; a valid supported Bearer token remained usable after a 200 response.
- Fix and regression candidate: `8ae6186a310fa665da1cc199ef3aef575b538843`, tree `7f808d0dbe139ab2812f74925cac7105a40ab219`. In explicitly local PASSWORD/MOCK mode, logout now verifies unique bearer and cookie tokens, increments each account's `session_version`, fails with 503 if persistence fails, and clears the cookie on success. Access Preview behavior is unchanged.
- `npm run typecheck` (Worker): PASS. `npm run test:owner-auth`: 5/5 PASS, including OWNER and ADMIN Bearer-only logout and subsequent rejection of both old bearer and cookie sessions. `npm run test:preview-auth`: 6/6 PASS. These are focused regressions for the changed logout route; no full suite was repeated.
- GitHub finding thread `4313547498` remains open pending publication and exact-head review. A fresh Controller review on the final exact code SHA is required; prior Controller PASS is historical and not transferable. Pre-Critic remains pending until exact-head GitHub checks/review and Controller complete.
- No Preview/remote D1/Access, production, provider, R2, paid service, real identity/data or source-repository write was used.
- Exact-SHA Controller result: PASS, no P0/P1/P2 findings on executable commit `8ae6186a310fa665da1cc199ef3aef575b538843` / tree `7f808d0dbe139ab2812f74925cac7105a40ab219`. Separate `codex exec` process requested GPT-6 Luna / High / read-only; CLI accepted configuration, exit 0, thread `01a15410-8f45-7d80-9fe5-d10b5f3ef06d`; backend identity UNVERIFIED. It did not run tests or edit files. Report, prompt and invocation metadata are under `evidence/critics/CF-AU-I05-CONTROLLER-8AE6186-*`.
- GitHub consolidated review on checkpoint `82d9d0bb9511ee550afd04f4b3514a984db0b110`: completed with no findings and no unresolved findings. `worker`/`web` both passed run `39249255619`. Finding thread `4313547498` was answered in `4313633558` and resolved; zero unresolved threads observed.
