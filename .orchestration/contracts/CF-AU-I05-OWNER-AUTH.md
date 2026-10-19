# CF-AU-I05 — OWNER authentication, local synthetic scope

Authority: Issue #7 decision comment `6265554947` (2026-10-19). Base: `main@093bd9128653281b79599caf61bb6fa979b8fb49`.

## Goal

Implement a usable, secure **local-only** OWNER account lifecycle using synthetic email identities and D1: register, email verification, login, logout/revocation, and password-reset flow. Use an in-memory mock email adapter for local Workerd/Playwright; only token hashes may be stored in D1. New accounts are always OWNER. Keep existing ADMIN/OWNER authorization and Preview Access role-switch behavior.

## Architecture findings / decision

- The read-only NestJS source exposes `/auth/register` and `/auth/login`, immediately creates OWNER and issues a cookie; it uses bcryptjs cost 12 and has no email verification or reset flow. Lab D1 users currently have unique normalized email, password hash and constrained OWNER/ADMIN role. Lab Worker login also uses bcryptjs; JWT is HS256 with 15-minute default, HttpOnly/SameSite cookie, exact-Origin mutation checks and current D1 role/email revalidation. Logout currently only clears the cookie; there is no account verification, token revocation or rate limit.
- Preserve source password semantics for synthetic **local testing only**. Do not expose PASSWORD auth/register to any non-loopback host, even if config is missing or says PASSWORD. Existing Preview remains `ACCESS_PREVIEW`; no Preview account enrollment or password fallback.
- Workers Free currently documents 10 ms CPU per HTTP request. Existing Cloudflare telemetry for the isolated Preview experiment observed 348.640–446.872 ms CPU quantiles in a 4-request health/login window, without path-level attribution; local bcryptjs cost-12 samples separately measured 474–534 ms CPU proxy. This does not establish reliable free-tier compatibility; do not lower bcrypt cost to force it. Source evidence: `.orchestration/evidence/CF-AU-OWNER-PROVIDER-CPU-QUERY.json`, `CF-AU-OWNER-BCRYPT-CPU.json`. Current docs: https://developers.cloudflare.com/workers/platform/limits/ .
- Passwordless verification/reset needs outbound mail. Cloudflare Email Service documents arbitrary-recipient sending as Workers Paid; Free only supports verified destinations. No mail domain/provider is selected or authorized. Source: https://developers.cloudflare.com/email-service/platform/pricing/ and https://developers.cloudflare.com/email-service/api/send-emails/workers-api/ . OAuth similarly requires a Human-selected provider/client/topology. Therefore no external email/OAuth integration is added and no claim of production/free Cloudflare login is made.
- Local implementation keeps the existing password-based source contract for test fidelity but uses a mock-only, ephemeral mailbox to exercise verification/reset. This is not release authentication. A future production choice of password+paid mail, passwordless+provider, OAuth, or a different CPU-safe password verifier is a material architecture/cost/security decision and remains outside this contract.

## Allowed implementation

- Add account state, one-time verification/reset token hashes, expiry/consumption and revocation fields/migration. Preserve existing seeded Preview identities and role checks.
- Add server-side local-host/config guard, normalized validation, uniform responses for duplicate/unknown emails and invalid credentials, email verification before OWNER login, bounded rate limits, Origin/CSRF checks, HttpOnly session cookies, current-D1 role checks and session revocation on logout/reset.
- Add a local mock mail adapter/outbox that exists only for loopback + explicit local test configuration, is bounded and ephemeral, and has no binding to any remote provider. Do not log or persist plaintext tokens/passwords.
- Add small usable Vue local signup/verify/login/recovery interactions compatible with the present UI; leave visual redesign to I06.
- Test Worker/D1 paths and local Playwright journeys with synthetic users. Negative coverage: duplicate/unknown email response parity, unverified login, expiry/replay, origin/CSRF, role elevation, IDOR/cross-role, rate limiting, password reset revocation and remote/Preview fail-closed behavior.

## Forbidden

No public Preview registration, remote auth/email tests, Access changes, real identities/customer data, provider selection/provisioning, payment, R2, production/preparation, source-repository writes, Admin self-registration, weakened password hashing, or I06 redesign work. Do not publish updated auth code to the Preview unless later review proves all PASSWORD enrollment routes are unreachable remotely and a separate authorized release decision is recorded.

## Delivery gate

Use quick focused tests during fixes; run the consolidated auth suite, relevant UI/typecheck/build checks, orchestration consistency preflight and diff check once on the final candidate. Obtain one consolidated GitHub review and one separate requested GPT-6 Luna/High/read-only Controller review for this material auth change. Preserve I04 closure evidence. Protected integration only after clean checks/reviews; do not update Preview in I05.
