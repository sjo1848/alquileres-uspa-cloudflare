# Issue #64 — Preview authentication friction and remote QA preparation

## Authority and base

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/64 (linked to #61)
- Authorized base: `main@944d4bb7591deb0fd889731c9922b5b571893527`
- Scope: read-only Access diagnostics; local code, tests and documentation; one functional draft PR.
- Remote changes explicitly excluded: Access/application/global/policy settings, service-token creation or activation, Preview deployment, merge, CD, D1, production, and new resources.

## Work and acceptance criteria

1. Measure actual Access application and policy settings using read-only API calls, and report which account/IdP/client values the API does not expose rather than infer them.
2. Renew only the short internal Preview OWNER/ADMIN cookie, and only from a same-origin POST carrying a currently valid signed Access assertion plus either the existing signed internal session or its opaque persisted refresh cookie. The refresh cookie is hash-bound to one synthetic D1 session and a non-sliding seven-day absolute expiry; it cannot extend an expired Access identity. Enforce fixed synthetic identities, role preservation, D1 session version, actual Access `exp`, per-session logout revocation, and exact Preview audience/origin.
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

## Rework against PR #65 review `pullrequestreview-5726242007`

- **P1 addressed locally:** short cookie is renewed preventively and a durable opaque refresh cookie supports a browser restart after the short cookie expires. The real browser uses `/api/auth/*`; the refresh-cookie path and clearing path are therefore `/api/auth`, not the Worker-internal stripped `/auth` path. Refresh accepts an empty POST stream even when the browser sends `Content-Type: application/json`; any non-empty body is rejected. Logout reports success only after the Worker confirms revocation, so an expired/rejected Access assertion cannot silently appear as a successful logout.
- **P2 addressed locally:** migration `0016_preview_auth_sessions.sql` adds per-SID persistence; refresh secrets are stored as hashes and logout revokes only that SID. The shared user `session_version` is unchanged. The migration is local code only and has not been applied remotely.
- **Required final evidence:** `apps/worker/tests/preview-auth.test.ts`, `apps/web/e2e/preview-auth-local.spec.ts`, `apps/worker/wrangler.preview-auth-e2e.jsonc`, and `.orchestration/evidence/CF-AU-I64-SESSION-RENEWAL-SERVICE-AUTH.md`. The local browser uses a 5-second internal JWT to prove actual browser cookie expiry and profile reopen; it does not emulate/claim real Cloudflare Access or remote Service Auth provider behavior. It covers independent concurrent browser sessions and selective logout, not a simultaneous refresh/logout race. The prepared remote role smoke signs in and creates synthetic session rows in Preview D1; it is a **remote-write test**, named `remote-mutating`, guarded before credential use by `PREVIEW_QA_ALLOW_REMOTE_D1_WRITES=true`, and remains unexecuted. No remote D1 writes are authorized here.
- **Stable candidate / dynamic review pointer:** `f5591332b4fb9a2600fce0868a6b076ee3cb54cb` is the functional code/test SHA. Do not store a moving PR HEAD in the contract or active state. Immediately before a Controller review, query GitHub PR #65 and fetch that exact HEAD; verify the local SHA and that changes after the functional candidate are only non-executable tracking/evidence. Record each observed HEAD in the GitHub review comment. The comment is the per-review SHA record.
- **Controller runtime capture:** use `scripts/controller_runtime.py`. Its isolated `--probe-only` mode must succeed first. The final review uses app-server JSON-RPC `ThreadStartResponse` metadata and verifies the runtime-accepted model, effort, read-only sandbox with `networkAccess=false`, and approval policy. Review mode rejects any post-candidate file outside the explicit Issue #64 state/evidence/launcher allowlist. Store a filtered record and hashed session correlation only; never include tokens, raw session IDs or full prompts. Backend identity remains unverified absent provider attestation.
- The previous Controller results remain historical. Do not relabel any `BLOCKED_MODEL_CONFIG` or `REWORK` as PASS. The corrected runtime probe, exact-head Worker/Web CI, and final Controller review are complete. See PR #65 comment 6561444134 for the per-review SHA and verdict. Keep PR #65 OPEN/DRAFT pending separate protected-merge authorization.
