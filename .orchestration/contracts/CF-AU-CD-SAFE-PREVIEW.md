# CF-AU — Safe automatic publication to the existing private Preview

Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/49

Base: `main@3c6837723d2d48a1710c692185aa9c1484b513db`

## Authorized scope

Prepare an opt-in GitHub Actions path that publishes a successful protected `main` SHA only to the existing `private` Preview of Worker `alquileres-uspa-lab`. The Product Owner explicitly requires CD to remain disabled until a separate activation authorization. This PR must not create or configure Cloudflare credentials, GitHub secrets/variables, branch protections, Access policies, D1, or other resources.

## Release conditions

- Publish on `push` to `refs/heads/main`, after `worker` and `web` both pass. A main-only `workflow_dispatch` provides the single controlled first deployment after activation (and is subject to the same checks); PR jobs never receive the Cloudflare credential.
- Confirm the candidate SHA is still the protected `main` HEAD immediately before deployment.
- Confirm the existing account, Worker, Preview resource ID/name, stable URL, secure Preview vars, static asset routing, and the sole D1 binding match the pinned target. Reject production routes and every unapproved binding.
- Validate the Wrangler-generated deployment JSON as well as the source config: exact normalized top-level key allowlist, pinned runtime/entrypoint/build settings, exact Preview environment keys, and no unreviewed variables, triggers, migrations, routes, environments, or bindings. Run this check on every PR after `build:preview` and again before publication.
- Confirm synthetic D1 provenance, the presence of `JWT_SECRET` without reading it, and anonymous Access denial on stable and immutable URLs before and after publication.
- Read the latest Preview deployment's `workers/commit_sha`; compare the migration directory from that exact previously published SHA to the candidate. Reject any migration/schema-file change and any pending migration. Never back up, rehearse, authorize, or apply a remote migration in this workflow.
- Run `wrangler preview --name private --worker-name alquileres-uspa-lab` only. Validate Wrangler's deployment ID and URLs, then re-read Cloudflare metadata to confirm the exact source SHA and deployment ID before recording success.
- Expose the Cloudflare token only to the gate/preflight/deploy verification steps that require it. Never provide it to dependency installation, build, worker/web tests, or Playwright.
- Serialize publications without cancelling an in-flight deployment. On any failed preflight, skip before publication; on a post-publication verification failure, fail the run and follow the rollback procedure below.

## Rollback procedure

Before publication, retain the verified previous deployment ID, immutable URL, and its `workers/commit_sha` in the run log. If publication or post-publication verification fails, do not change D1 or Access. Rebuild the recorded last-known-good main SHA in a clean checkout, re-run the same target/provenance/zero-migrations/Access preflight, and republish it to the same Preview using `wrangler preview` with a message naming that SHA. Verify the new deployment annotation equals the rollback SHA and repeat anonymous Access denial. This creates a new immutable Preview deployment; it does not alter production or restore database data. Until this procedure succeeds, treat the stable URL as unaccepted and stop further releases by setting `CF_PREVIEW_CD_ENABLED` false.

## CODEOWNERS and current GitHub protection

CODEOWNERS covers this workflow, this guard and its tests, Preview Wrangler configs, migration files, application/package lockfiles used by the deployment toolchain, authentication components, and the CODEOWNERS file itself. The current main protection enforces `worker`/`web` checks and admin enforcement but has zero required approving reviews and does not require code-owner reviews. This PR does not change remote branch settings. Before activation, enable required CODEOWNER reviews for these paths while preserving zero globally required approvals, so ordinary application changes remain mergeable with existing CI and automated review.

## Activation boundary

Until a separate Product Owner authorization, `CF_PREVIEW_CD_ENABLED` remains unset/false, and no credential or variable is written. The current repository has no usable Actions Cloudflare secret or Preview variables. Activation requires a dedicated GitHub Actions secret `CF_PREVIEW_API_TOKEN`, the explicit enable variable, and the existing gate's free-plan/provenance/Access attestations. The token must be an account-owned API token with Workers Editor scoped only to the existing Worker, plus D1 Read scoped only to the synthetic D1 if required by read-only provenance/ledger queries; no D1 Edit, Access Edit, R2, billing, routes, or account administration. The Preview remains protected by its existing Access policy.

## Residual risk without per-release human approval

- A defect or malicious change merged to protected `main` can be published automatically. CI, automated review and code-owner enforcement on sensitive paths reduce this risk but cannot prove every product change safe.
- The Worker Editor token can update/deploy the one scoped Worker. Even though the token has no D1 Write permission, deployed Worker code runs with its existing D1 binding and can mutate the synthetic database through application code. A redeployment rollback restores code only; it cannot reverse application writes. The zero-schema-change gate prevents migration DDL, not ordinary data writes.
- A compromised or malicious deployment workflow/toolchain could access the deployment credential in its narrowly scoped steps. Workflow, guard, configs, migration and package-lock changes therefore need enforced code-owner review before CD is activated.
- Access is not read through the deployment token. The release gate requires the operator-only attestation and verifies anonymous denial on the stable and immutable URLs before and after publication; this proves effective anonymous blocking, not the complete live Access policy configuration.
- These risks are confined to the existing private Preview and its synthetic D1; no production resources or real data are in scope.

## Acceptance

- Unit regressions fail closed on wrong destination/config/bindings, pending migration, changed migration/schema file, stale/unauthorized SHA, missing credential, invalid Wrangler output, and Access allow/redirect to an unexpected host.
- Workflow inspection proves all remote mutation is limited to the existing Preview `wrangler preview` operation, with no migration commands and no token in install/build/test steps.
- `worker`/`web` CI and delegated read-only technical review pass on the exact PR HEAD. Merge, if permitted by current remote protection, still leaves CD disabled.
