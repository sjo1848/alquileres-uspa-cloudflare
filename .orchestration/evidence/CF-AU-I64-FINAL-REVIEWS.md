# Issue #64 final technical reviews

## Exact candidate

- Functional PR: #65, https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/65
- Candidate under review: `f5591332b4fb9a2600fce0868a6b076ee3cb54cb`
- Base: `main@944d4bb7591deb0fd889731c9922b5b571893527`
- PR state: OPEN/DRAFT. No merge, Preview deployment, D1 mutation, Access write, token creation, CD or production action.

## Independent Critic

- **PASS** on exact SHA `f5591332b4fb9a2600fce0868a6b076ee3cb54cb`.
- No remaining P0/P1/P2 findings. The final review verified the remote smoke is named `remote-mutating`, fails closed before reading credentials without `PREVIEW_QA_ALLOW_REMOTE_D1_WRITES=true`, and documentation describes the session-row write accurately.
- Reviewer did not run tests or contact Cloudflare. Local tests and CI are parent-run evidence, recorded separately.

## Integration Review

- **PASS** on exact SHA `f5591332b4fb9a2600fce0868a6b076ee3cb54cb`.
- Cookie browser path `/api/auth` matches the routed API; Access identity and exp checks remain; refresh/session binding and per-SID revocation agree across Worker/tests; migration 0016 is additive and local-only; remote test write gate precedes credential use.
- Initial review misstated that the remote role smoke created/published a listing. Exact-blob inspection showed only role selection and GET checks. The actual remote D1 session-row write was then made explicit and gated. Two stale documentation lines about shared `session_version` and GET-only behavior were corrected before this PASS.
- Reviewer did not run tests or contact Cloudflare.

## Controller

- Native configured `project_controller` reviewed exact SHA `f5591332b4fb9a2600fce0868a6b076ee3cb54cb`; requested model `gpt-6-luna`, effort `high`, read-only role. Verdict: **BLOCKED_MODEL_CONFIG; no Controller PASS**. The runtime reports unrestricted filesystem permissions, so effective read-only enforcement and actual backend model identity are not verifiable. Its static inspection found no demonstrated P0/P1 in the final docs delta.
- Separate `codex exec` was invoked with `--model gpt-6-luna`, `model_reasoning_effort="high"`, `--sandbox read-only`, `--ephemeral`, and JSON capture on exact predecessor `7d26b8bfb0a389cabcaa0951a7844e00b91a6a00`. Its bounded output was BLOCKED because it could not start the nested reviewer/read-only controller runtime; it found no demonstrated P0/P1 but noted the acceptance text/path mismatches that were corrected before the final candidate. This is not a PASS for the final SHA; backend identity and accepted enforced sandbox remain unverified.

## CI and test evidence

- The earlier candidate `8a73efdd…` had a Worker failure because local PASSWORD `/auth/me` also received `sessionExpiresAt`. Fixed by returning that field only for ACCESS_PREVIEW; local OWNER lifecycle then passed 6/6 and Preview Auth passed 11/11.
- Candidate `7d26b8b…` GitHub Quick Checks run `41309192279`: Worker/Web PASS; `staging-private` SKIPPED.
- Candidate `6103253…` run `41309463435` was cancelled by GitHub when the final documentation commit superseded it.
- Final code SHA `f559133…` Quick Checks run `41309543269`: Worker PASS, Web PASS, `staging-private` skipped. Worker included typecheck, catalog/media, owner, rental-terms, local owner-auth, admin, preview-auth, contact, management and orchestration checks. Web included typecheck and both standard/Preview builds.
- Local Chromium E2E: 1/1 PASS with real 5-second browser-cookie expiry, persistent-profile reopen, OWNER→ADMIN explicit publication, concurrent role sessions, and selective logout. Worker auth tests 11/11; OWNER lifecycle 6/6; Worker/Web typecheck, Web build and Preview-config build passed. Remote Service Auth E2E was deliberately not run.

## Boundary

Keep PR #65 OPEN/DRAFT. The verified Controller gate remains unresolved. No Access durations/policies or Service Token were changed/created, and migration 0016 was not applied to remote D1. Remote test execution and later integration/deployment require the separately authorized boundaries already recorded in the contract.
