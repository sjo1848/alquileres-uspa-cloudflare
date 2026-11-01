# Issue #64 final technical reviews

## Stable functional candidate and dynamic PR pointer

- Functional PR: #65, https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/65
- Stable functional code/test candidate: `f5591332b4fb9a2600fce0868a6b076ee3cb54cb`.
- Do not store an active/rolling PR HEAD in this evidence file. Query GitHub PR #65 immediately before each review, fetch and verify that exact local SHA, and record the observed review SHA in the corresponding GitHub comment. Prior exact SHAs below are historical evidence only.
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

## Previous Controller results (historical)

- The previous separate `codex exec` review observed PR HEAD `1e1e8bb3167a8c7991732b78c1f09ac3b227855a` (historical, not current) with requested model/effort/read-only flags. Its write probe was denied, but the report was **BLOCKED_MODEL_CONFIG** because runtime acceptance of model/effort remained unknown. Do not relabel this historical report.
- The earlier separate-process attempt on `7d26b8b…` and native Controller attempt on `f559133…` also returned BLOCKED. Those records are historical and do not describe the runtime probe below.

## Latest Controller result before the runtime-capture rework (historical)

- On PR HEAD `59ac3895f36ca052305a07a96c94c1e1643ed1f3`, the single Controller returned **REWORK P2**. It found no material P0/P1/P2 in the functional auth code, but identified two state/evidence mismatches: active STATUS called the remote role smoke GET-only despite a D1 session-row write, and rolling HEAD pointers still named `1e1e8bb…`. Result is recorded at https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/65#issuecomment-6560949541. These findings are corrected by the current change; this result remains historical, not PASS.

## Controller runtime capture probe

- Isolated probe PASS, before any new functional review. Codex CLI `0.166.0` app-server `ThreadStartResponse` returned the accepted model `gpt-6-luna`, reasoning effort `high`, `sandbox.type=readOnly`, `networkAccess=false`, and `approvalPolicy=never`.
- Filtered response evidence: `.orchestration/evidence/CF-AU-I64-CONTROLLER-RUNTIME-PROBE.json`; source is the app-server JSON-RPC response, not the request arguments or reviewer self-report. Session/thread correlation is SHA-256 only. Telemetry export was disabled. Provider/backend identity remains `UNVERIFIED`.
- Reproducible isolated command: `python3 -B scripts/controller_runtime.py --probe-only --cwd /tmp --evidence <private-output.json>`. It uses a mode-0700 temporary `CODEX_HOME`, references the local auth file by symlink without printing/copying it, and deletes the temporary home on exit.
- The review mode requires a clean checkout whose SHA equals the GitHub-observed SHA and a specified base ancestor. It persists only filtered runtime metadata plus hashed correlations and keeps the full reviewer output in a caller-selected private file.

## Controller rework on runtime-verified exact HEAD

- Controller reviewed `9f05c41ab242d5db0e633129f227fb46dfb98f1d` through the app-server launcher after its isolated metadata probe. Accepted runtime configuration was GPT-6 Luna / High / readOnly / network disabled; provider backend identity remains UNVERIFIED.
- Verdict: **REWORK P2**, not PASS. Concrete findings: launcher did not enforce `sandbox.networkAccess == false`, and its candidate-delta filter did not reject all executable changes outside the watched directories. It confirmed P2-A and P2-B tracking corrections and found no new functional authentication defect.
- Both launcher findings were corrected with regression tests. Re-review is pending the new exact-head CI because the read-only boundary itself changed materially. The prior REWORK remains historical and is not promoted.

## CI and test evidence

- The earlier candidate `8a73efdd…` had a Worker failure because local PASSWORD `/auth/me` also received `sessionExpiresAt`. Fixed by returning that field only for ACCESS_PREVIEW; local OWNER lifecycle then passed 6/6 and Preview Auth passed 11/11.
- Candidate `7d26b8b…` GitHub Quick Checks run `41309192279`: Worker/Web PASS; `staging-private` SKIPPED.
- Candidate `6103253…` run `41309463435` was cancelled by GitHub when the final documentation commit superseded it.
- Final code SHA `f559133…` Quick Checks run `41309543269`: Worker PASS, Web PASS, `staging-private` skipped. Worker included typecheck, catalog/media, owner, rental-terms, local owner-auth, admin, preview-auth, contact, management and orchestration checks. Web included typecheck and both standard/Preview builds.
- Historical tracking HEAD `1e1e8bb…` Quick Checks run `41309775169`: Worker/Web PASS; `staging-private` SKIPPED. Do not use this SHA as the current PR pointer.
- Local Chromium E2E: 1/1 PASS with real 5-second browser-cookie expiry, persistent-profile reopen, OWNER→ADMIN explicit publication, concurrent role sessions, and selective logout. Worker auth tests 11/11; OWNER lifecycle 6/6; Worker/Web typecheck, Web build and Preview-config build passed. Remote Service Auth E2E was deliberately not run.

## Boundary

Keep PR #65 OPEN/DRAFT. The active runtime capture is implemented in `scripts/controller_runtime.py`; its isolated probe evidence is `.orchestration/evidence/CF-AU-I64-CONTROLLER-RUNTIME-PROBE.json`. After the Controller REWORK, both launcher-boundary findings were fixed with focused regressions. The corrected candidate passed the final exact-head Controller review; see PR comment 6561444134 for verdict and observed SHA. No Access durations/policies or Service Token were changed/created, and migration 0016 was not applied to remote D1. Remote test execution and later integration/deployment require the separately authorized boundaries already recorded in the contract.


## Final Controller review

- **PASS**; exact reviewed SHA, runtime configuration evidence, and concise report are linked in PR comment [6561444134](https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/65#issuecomment-6561444134). The matching Issue #64 summary is [comment 6561446034](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/64#issuecomment-6561446034).
- It confirmed P2-A/P2-B and both launcher-boundary fixes, with no actionable findings. No auth functional code changed after the stable candidate. Controller did not run tests; Worker/Web CI run `41331871407` passed, with staging-private skipped.
- Runtime model/effort/sandbox are operationally reported as accepted by app-server `ThreadStartResponse`; backend identity remains **UNVERIFIED**. This is not provider attestation.
- The prior REWORK on the earlier launcher SHA remains preserved above and in GitHub history. PR remains OPEN/DRAFT until separate merge authorization.
