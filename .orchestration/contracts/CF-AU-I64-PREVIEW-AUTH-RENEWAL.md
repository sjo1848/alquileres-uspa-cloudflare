# Issue #64 — Preview authentication friction and remote QA preparation

## Authority and base

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/64 (linked to #61)
- Authorized base: `main@944d4bb7591deb0fd889731c9922b5b571893527`
- Scope: read-only Access diagnostics; local code, tests and documentation; one functional draft PR.
- Remote changes explicitly excluded: Access/application/global/policy settings, service-token creation or activation, Preview deployment, merge, CD, D1, production, and new resources.

## Work and acceptance criteria

1. Measure actual Access application and policy settings using read-only API calls, and report which account/IdP/client values the API does not expose rather than infer them.
2. Renew only the short internal Preview OWNER/ADMIN cookie, and only from a same-origin POST while the request carries a currently valid signed Access assertion and the browser still holds an intact signed session. Enforce fixed synthetic identities, role preservation, D1 session version, actual Access `exp`, logout revocation, and exact Preview audience/origin.
3. Resolve the old one-hour assertion-age check against longer sessions without accepting expired, modified, wrong-audience, wrong-issuer, wrong-signature, or future assertions.
4. Prepare but do not activate dedicated Access Service Auth for Playwright. Code must fail closed while the exact client ID setting is absent; no arbitrary identity, role, or token is trusted. Keep the human `Operator only` policy unchanged. E2E credentials must be local process secrets and injected only to the exact Preview origin.
5. Add security regressions, a signed-Access local OWNER→ADMIN lifecycle test, and a local Playwright journey against Worker/Hono and isolated synthetic D1.
6. Document exact proposed seven-day human Access settings, dedicated Service Auth setup, local secret handling, current measurement gaps, risks and separate activation/rollback boundary.
7. Reconcile active STATE/STATUS to Issue #64 within this functional PR. Run focused worker suites, web typecheck/build, local integrated Playwright, orchestration consistency, CI and exact-head reviews. No claim of remote authenticated E2E until the separate Service Auth policy/token and Worker setting are authorized, installed and tested.

## Current measured Access state (2026-11-01; GET only)

- Application `Alquileres Uspallata private Preview`: `session_duration=1h`.
- Policy `Operator only`: Allow; policy duration `null`, inheriting application duration.
- Organization global `session_duration`: omitted by the successful API response; documented default is not treated as an observed account value.
- WARP/Cloudflare One Client: `allow_authenticate_via_warp=false`; no applicable client session duration returned. IdP session duration was not exposed by the queried API.
- Service-token strict mode is false; no policy/service token was created or changed.

## Explicit stop boundary

Leave the PR open/draft. Do not change Cloudflare, create tokens, deploy, merge, migrate D1, change CD, touch production, or begin M3. Human authorization is required before separately activating 168h Access durations, a dedicated Service Auth policy/token, or deploying the Worker variable.
