# Preview Access and internal session renewal

This note records the read-only Access inspection for Issue #64 and the activation steps intentionally left for a later authorization. It contains no Access JWT, service-token secret, user selector, or production configuration.

## Read-only diagnosis (2026-11-01)

Cloudflare API GETs only; no Access writes were made.

| Setting | Observed value | Effect |
| --- | --- | --- |
| Access application `Alquileres Uspallata private Preview` | Self-hosted, `session_duration=1h` | Application token currently lasts one hour. |
| Policy `Operator only` | `allow`, `session_duration=null` | No policy override; inherits the application's one hour. |
| Zero Trust organization global `session_duration` | Field omitted by the successful read-only API response | Cloudflare documents a 24-hour default. The actual configured value could not be independently read from the API response, so 24h is a documented default, not a measured account value. |
| Cloudflare One Client / WARP | Organization `allow_authenticate_via_warp=false`; no `warp_auth_session_duration` returned | Client-session duration does not currently govern this app. |
| Identity providers | Cloudflare account members and One-time PIN | Their provider-side login/session lifetime was not returned by the Access API reads; do not claim it was measured. |
| Service-token strict mode | `strict_service_token_auth=false` | Account-wide behavior; this change does not alter it. |

The product had a separate local auth cookie: `JWT_EXPIRES_IN=15m`, `Max-Age=900`. `verifyPreviewOperator` also limited Access assertion age to one hour. Thus the 15-minute interruption was the internal cookie; the one-hour assertion cap was a second, independent incompatibility with longer Access app sessions.

Cloudflare documents global/app/policy session inheritance and the one-month maximum in its [Access session management guide](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/). Its [JWT validation guide](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) describes verifying the signed Access assertion and its issuer/audience. A longer Access browser session does not make an expired assertion valid; Access refreshes assertions while the global session remains valid, and this Worker still enforces each assertion's own `exp`.

Cloudflare generates signed global and application tokens. The application token is checked for the current request; Access refreshes it while the global session remains valid. This Worker now accepts an Access assertion for at most 720h, validates its signature/issuer/audience/type/identity, and caps every internal Preview JWT and cookie to the assertion's actual `exp`. The refresh endpoint never trusts a browser-supplied new expiry or role.

## Human session target (not activated)

After separate approval, configure only the existing private Preview Access application and the account global session:

1. Set global session duration to `168h` (7 days), or retain a shorter value if the Product Owner prefers reauthentication sooner.
2. Set the private Preview application's session duration to `168h`.
3. Set the `Operator only` policy session duration to `168h`; it is currently inherited (`null`). Keep its operator selector and `Allow` decision unchanged.
4. Leave Cloudflare One Client/WARP disabled. If MFA is configured separately, its session controls only MFA re-prompts and do not lengthen the Access application token.

Do not set a session beyond Cloudflare's documented maximum of one month. At expiration, reauthentication remains required. The app's internal cookie remains short-lived (15 minutes) and renews only in response to a same-origin request while a currently valid, signed Access assertion is present. It cannot outlive the Access JWT.

## Playwright Service Auth (not activated)

The remote Playwright config targets only `https://private-alquileres-uspa-lab.sjo1848.workers.dev`. It adds `CF-Access-Client-Id` and `CF-Access-Client-Secret` only to requests whose origin exactly matches that hostname; it does not add them to Cloudflare's login domain, other Workers, or the source repository. Traces, video, screenshots and network logging are disabled in that config.

To activate after separate approval:

1. Create one dedicated Access service token named `alquileres-preview-playwright`; select a bounded expiry and store its Client ID/Secret directly in the local secret environment as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`. Never put them in `.env` committed to Git, GitHub variables, logs, traces, HAR or Issues. Cloudflare documents the [Service Auth policy and token headers](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) and a [50-token Free account limit](https://developers.cloudflare.com/cloudflare-one/account-limits/).
2. Add a `Service Auth` policy to this one Access application with only that exact token selected. Keep the human `Operator only` Allow policy intact. Do not add `Bypass`, `Everyone`, email selectors for machine auth, or a production hostname. Do not toggle the account-wide strict-service-token setting as part of app activation.
3. Set the Worker Preview variable `PREVIEW_QA_SERVICE_CLIENT_ID` to the exact service-token Client ID and publish the change only after separate deployment authorization. With the variable unset, the Worker rejects service identities. The Worker requires a signed, app-scoped Access JWT whose service `common_name`/ID exactly matches this setting and maps it only to the two fixed synthetic D1 demo identities. It never uses a request parameter or unsigned header as a role.
4. The remote E2E is deliberately named `test:e2e:preview-auth:remote-mutating`. Loading its config fails closed unless `PREVIEW_QA_ALLOW_REMOTE_D1_WRITES=true` is explicitly set. Role selection POSTs to `/auth/preview-session` and creates a synthetic `preview_auth_sessions` row in remote D1; only the subsequent role/API checks are GET-only. Do not set the flag or run this suite until a separate authorization permits those remote test writes and cleanup is defined. It also requires local `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`; this repository does not contain those credentials.
5. Revoke the token after the QA period or rotate it immediately if exposure is suspected. Since service-token headers are bearer credentials, keep the token narrowly scoped and short-lived.

No token or Service Auth policy exists for this change. Because the current Access app has only `Operator only`, the remote Playwright suite is prepared but is not expected to pass until the separately approved policy/token/Worker variable and Preview deployment exist. The local signed-assertion tests and local OWNER→ADMIN integrated journey are the executable QA for this PR.

## Security properties and remaining risk

- Refresh requires POST, exact same-origin `Origin`, rejects cross-site Fetch Metadata when present, a valid current Access JWT for the exact Preview AUD, the existing signed HttpOnly session cookie, the same identity source, and the exact synthetic D1 user/email/role/session version.
- Refresh carries forward the role from the signed existing cookie. To switch OWNER/ADMIN, the UI must explicitly call `/auth/preview-session` with one of the two fixed demo roles.
- Preview logout revokes only the current `preview_auth_sessions` SID and clears both cookies; it leaves the shared user's `session_version` unchanged. Protected requests and refresh re-check the per-session revocation row, so another browser using the same fixed demo profile remains valid.
- The Access client ID match protects against generic service tokens but cannot replace Access policy scope. The Access policy must select the exact dedicated token; the Worker refuses service tokens until `PREVIEW_QA_SERVICE_CLIENT_ID` is set.
- The preview demo accounts are shared synthetic OWNER/ADMIN identities. Even the remote role-permission smoke creates a per-browser session row, so it remains gated by separate D1-write authorization; a remote listing lifecycle test also remains out of scope until a separately approved isolated fixture/cleanup strategy is available.
- A 7-day human session increases the period before IdP reauthentication; it does not bypass Access, revoke compromised IdP credentials, or create a revocation mechanism beyond Cloudflare's current session/token controls.
