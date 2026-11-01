# Issue #64 final technical reviews

## Exact candidate

- Functional PR: #65, https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/65
- Live PR tracking HEAD: `1e1e8bb3167a8c7991732b78c1f09ac3b227855a` (state/contract/evidence-only commit on executable candidate `f5591332b4fb9a2600fce0868a6b076ee3cb54cb`).
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

- One targeted separate `codex exec` review was run on the **live exact tracking HEAD** `1e1e8bb3167a8c7991732b78c1f09ac3b227855a` with requested `--model gpt-6-luna`, `model_reasoning_effort="high"`, `--sandbox read-only`, `--ephemeral`, `--ignore-user-config`, and isolated `TMPDIR`. Session `01a197e5-6c5a-7793-8901-647008495265` started and completed, exit 0. A disposable write probe was denied with `Read-only file system`, verifying the sandbox. The review found no demonstrated P0/P1/P2 defect and ran no tests. Its verdict remained **BLOCKED_MODEL_CONFIG** because it could not assert CLI model/effort configuration acceptance (`unknown`) or backend model identity (`unverified`). Provider backend attestation is not required by operational-verification v2, but this report did not issue PASS and is not relabeled as PASS. Raw output is local at `/tmp/alquileres-i64-controller-runtime-20261101/` and is not committed.
- The earlier separate-process attempt on `7d26b8b…` and native Controller attempt on `f559133…` also returned BLOCKED. No further retry was made after the one targeted attempt on the live exact HEAD.

## CI and test evidence

- The earlier candidate `8a73efdd…` had a Worker failure because local PASSWORD `/auth/me` also received `sessionExpiresAt`. Fixed by returning that field only for ACCESS_PREVIEW; local OWNER lifecycle then passed 6/6 and Preview Auth passed 11/11.
- Candidate `7d26b8b…` GitHub Quick Checks run `41309192279`: Worker/Web PASS; `staging-private` SKIPPED.
- Candidate `6103253…` run `41309463435` was cancelled by GitHub when the final documentation commit superseded it.
- Final code SHA `f559133…` Quick Checks run `41309543269`: Worker PASS, Web PASS, `staging-private` skipped. Worker included typecheck, catalog/media, owner, rental-terms, local owner-auth, admin, preview-auth, contact, management and orchestration checks. Web included typecheck and both standard/Preview builds.
- Current tracking HEAD `1e1e8bb…` Quick Checks run `41309775169`: Worker/Web PASS; `staging-private` SKIPPED. Its delta from the reviewed executable candidate is tracking/evidence only.
- Local Chromium E2E: 1/1 PASS with real 5-second browser-cookie expiry, persistent-profile reopen, OWNER→ADMIN explicit publication, concurrent role sessions, and selective logout. Worker auth tests 11/11; OWNER lifecycle 6/6; Worker/Web typecheck, Web build and Preview-config build passed. Remote Service Auth E2E was deliberately not run.

## Boundary

Keep PR #65 OPEN/DRAFT. The Controller gate remains unresolved. Next action: correct the launcher/runtime so the reviewer can verify accepted model/effort configuration while preserving the enforced read-only sandbox, then run a fresh exact-SHA review. A separate external review may supplement but does not automatically substitute for Controller PASS. No Access durations/policies or Service Token were changed/created, and migration 0016 was not applied to remote D1. Remote test execution and later integration/deployment require the separately authorized boundaries already recorded in the contract.
