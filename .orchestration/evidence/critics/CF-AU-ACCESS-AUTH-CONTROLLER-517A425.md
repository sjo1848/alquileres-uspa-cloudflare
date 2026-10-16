# Initial Access auth code review

Separate actual codex exec gpt-6-luna/high/read-only, exit0, exact517a4258b6dbb27ae48abb9472f310d946ac9574; backendUNVERIFIED. Raw output adjacent. Routine REWORK repaired before release.

**REWORK — P1: Preview configuration can re-enable password login.**

At [index.ts](/tmp/cf-au-owner-review/apps/worker/src/index.ts:49), `/auth/login` allows bcrypt whenever `AUTH_STRATEGY` is missing or set to `PASSWORD`. `/auth/config` also reports `PASSWORD` when the variable is missing. That preserves local defaults, but it means a Preview configuration error can restore the password path that the approved decision says must be disabled there.

Make password login fail closed for `PREVIEW_ORIGIN`, while retaining the local password flow, and add coverage for Preview with `AUTH_STRATEGY` missing and set to `PASSWORD`. The current tests check the Preview session endpoint when config is missing, but not the password endpoint in those cases.

I verified HEAD is `517a4258b6dbb27ae48abb9472f310d946ac9574`. No tests or builds were run. This is a local technical REWORK; remote Access behavior and provider CPU remain unverified, so this is not product or remote PASS. Requested model and effort flags are caller-configured; backend identity is **UNVERIFIED**.
