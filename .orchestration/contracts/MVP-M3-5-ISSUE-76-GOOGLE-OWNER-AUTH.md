# M3.5 — Google Login and individual OWNER identities

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/76
- Roadmap: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/55
- Authorized base: `main@98e89fe67b52568bd1879298590f80b360739a10`
- Branch: `feat/m3-5-google-owner-auth`
- State: implementation and local verification in progress.

## Accepted scope

Implement Google Identity Services login for OWNER accounts, with server-side Google ID Token validation; a one-time `nonce` bound to an HttpOnly browser cookie; identity keys based on `provider=google` plus Google `sub`; no account linking by email; OWNER-only first registration; individual D1-backed revocable sessions; CSRF/origin checks; session expiry; and local-only synthetic JWK tests. Google email is stored as a profile/contact attribute, never used as an identity key or for linking, and does not set the application's independent `email_verified_at` flag.

The first Google sign-in creates an OWNER account without creating or publishing a listing. Existing public catalog, M3 selection, OWNER ownership checks, ADMIN moderation, `ACCESS_PREVIEW`, and loopback-only `PASSWORD` behavior remain supported. Google mode does not expose the synthetic role selector and cannot create or authenticate an ADMIN.

## Data and runtime boundary

- Add migration `0017_google_owner_identity_sessions.sql`; apply only in isolated local/test D1 during this increment.
- Store Google subject identity, hashed login nonce/browser binding, and hashed session identifier in local D1. No Google credentials or live OAuth configuration in CI.
- `AUTH_STRATEGY=GOOGLE` is opt-in and fails closed without a Client ID, a sufficiently strong `JWT_SECRET`, secure cookies, and a valid session TTL.
- A per-run synthetic RSA pair is created in a temporary local directory. Its public JWK is injected only into the local Worker config; the matching private key and generated config are deleted after Playwright. The Worker accepts this JWK only with `GOOGLE_AUTH_LOCAL_TEST=true` on loopback.
- No remote D1 migration, Google Console configuration, remote secret, Access/CD/Preview modification, deployment, production, M4 or other feature work.

## Acceptance evidence required

1. Worker typecheck and Google auth tests: valid/invalid issuer, audience, expiration, signature, `sub`, email verification, nonce binding, one-time replay/concurrent redemption, same-email/no-link conflict, parallel first sign-in, session isolation/rotation/revocation, CSRF, role and strategy boundaries.
2. Local Chromium E2E using Vue + Worker/Hono + disposable D1: Google OWNER login and registration, session restore after reload, OWNER listing persistence, logout/re-entry with the same user ID, no admin selector, no token in localStorage, and mobile readability.
3. Web typecheck, build, Preview build, and existing public/OWNER/ADMIN/Preview-auth regressions.
4. Exact-head GitHub `worker` and `web` checks, automated review, and a read-only `project_controller` review; address substantive findings before protected merge.
5. Canonical state records the exact functional base, migration local-only status, CI/review result, PR/merge state, and the separate activation gates.

## Activation gates after this increment

To enable Google Login in the private Preview later, the Product Owner must separately authorize and complete: (a) create a Google OAuth Web Client ID and configure the exact Preview origin; (b) authorize applying migration 0017 to the existing synthetic D1; (c) configure Preview-only `AUTH_STRATEGY=GOOGLE`, `GOOGLE_CLIENT_ID`, `GOOGLE_SESSION_TTL_SECONDS`, `COOKIE_SECURE=true`, and a strong `JWT_SECRET`; (d) decide how current Cloudflare Access protection coexists with real-user login and anonymous public browsing; and (e) authorize deployment plus authenticated remote QA. No such gate is consumed by this local increment.
