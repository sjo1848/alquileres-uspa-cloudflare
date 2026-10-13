# CF-AU-I01-P2 independent security / authorization review

Reviewer: independent security critic agent. Scope: bounded HTTP auth, OWNER isolation, request validation and negative test paths; static review, not a test execution.

## Review history and closure

Initial review found critical-risk gaps in CSRF protection on cookie-authenticated listing mutation, absence of expired/malformed token test evidence, and missing proof of Bearer behavior. A subsequent review found login CSRF. Implementation added exact same-origin `Origin` checks for cookie-based login/logout/mutations, while valid Bearer authorization remains usable without cookie/origin. Tests cover owner A/B and ADMIN authorization boundaries, expired JWT, malformed cookie, forged Bearer precedence, valid Bearer, cross-origin/missing-origin denials and no side effects.

Final independent review: **bounded PASS; no remaining P0/P1 auth, authorization, privacy or request-handling finding** in reviewed paths. The critic did not execute the suite; runtime evidence is in `../CF-AU-I01-P2-VALIDATION.md`.

Limits: local synthetic-only review; no deployment, production hardening or complete source-auth parity claim. Cookie/origin assumptions and source divergences are documented in the Worker README.
