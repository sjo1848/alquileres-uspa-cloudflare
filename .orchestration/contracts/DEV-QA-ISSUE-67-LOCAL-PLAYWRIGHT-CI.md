# DEV-QA — Issue #67 Local OWNER→ADMIN E2E in CI

## Authority and boundaries

- Product Owner decision: Issue #67 now authorizes a local Chromium E2E harness and execution in GitHub CI.
- Base: `main@c73d1e43d93541de89fc134952acfa0cf1d70774`.
- No remote scheduled E2E, service-auth secrets in CI, Preview/Access/D1 writes, migrations, deployments, CD, production, or real data.
- M2.1 product acceptance remains a Human decision. Do not start M3 until it is recorded.

## Scope

Reuse the existing loopback-only Preview-auth test mode, signing fixture, local D1 migrations/seeds, and OWNER→ADMIN flow. Make one web package command run it on bundled Playwright Chromium against a fresh per-run D1 state directory. Delete D1 state, browser profile, and Playwright result files after success or failure. Run the same command in the `web` CI job for each PR.

## Acceptance

1. `npm run test:e2e:preview-auth:local` starts a fresh local D1 database with migrations and synthetic fixtures, starts the application, and runs the Chromium flow.
2. The flow proves OWNER creates and submits a MONTH listing, ADMIN approves it, publication requires an explicit action, and the published listing appears in the catalog.
3. Local Access simulation remains restricted by the existing Worker loopback-origin check and is configured only by the dedicated local E2E Worker config.
   A negative Worker regression rejects the signed test assertion on Preview origins; a config regression ensures the test issuer/JWK are absent from the deployable Preview config.
4. Each run removes temporary D1 state, test browser contexts/profile, and Playwright output even on assertion failure.
5. GitHub `web` CI installs bundled Chromium and executes the exact same command on PRs, without Cloudflare credentials or remote mutation.
6. Worker tests, Web typecheck/build, state consistency, CI and an independent review pass before protected merge.

## Evidence

Record the exact merged SHA, GitHub Worker/Web results, and the local command result in Issue #67. Keep Issue #67 closed only after the CI result is green. Preserve M2.1 Preview acceptance status as pending and do not start M3.
