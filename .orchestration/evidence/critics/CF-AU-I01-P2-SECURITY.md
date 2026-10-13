# CF-AU-I01-P2 independent security / authorization review

Reviewer: independent security critic agent. Scope: bounded HTTP auth, OWNER isolation, request validation and negative test paths; static review, not a test execution.

## Review history and closure

Initial review found critical-risk gaps in CSRF protection on cookie-authenticated listing mutation, absence of expired/malformed token test evidence, and missing proof of Bearer behavior. A subsequent review found login CSRF. Implementation added exact same-origin `Origin` checks for cookie-based login/logout/mutations, while valid Bearer authorization remains usable without cookie/origin. Tests cover owner A/B and ADMIN authorization boundaries, expired JWT, malformed cookie, forged Bearer precedence, valid Bearer, cross-origin/missing-origin denials and no side effects.

Final independent review: **bounded PASS; no remaining P0/P1 auth, authorization, privacy or request-handling finding** in reviewed paths. The critic did not execute the suite; runtime evidence is in `../CF-AU-I01-P2-VALIDATION.md`.

Limits: local synthetic-only review; no deployment, production hardening or complete source-auth parity claim. Cookie/origin assumptions and source divergences are documented in the Worker README.

## External REWORK-1 JWT test correction

The external critic found two regression-test false positives, not a demonstrated Worker crypto bypass. The expired token previously used a nonexistent subject; the forged Bearer token previously failed parsing before HMAC verification. Both tests were replaced with seeded `owner-a`/matching-email controls. A correctly signed active token is accepted (200); a same-identity correctly signed expired token is denied (401); and a same-identity active, structurally valid token signed with a wrong key is denied (401). The active test token expires in one hour so it remains valid when the later signature assertion runs.

Independent security re-review: **bounded PASS** for falsifiability and isolation of the two checks; static-only, no test execution. Details: `CF-AU-I01-P2-REWORK1-JWT-SECURITY.md`.
