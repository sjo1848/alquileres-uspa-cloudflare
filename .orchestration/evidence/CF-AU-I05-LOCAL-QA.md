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
