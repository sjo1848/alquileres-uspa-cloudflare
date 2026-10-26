# CF-AU-I06.6 — CI/CD to the existing private Preview

Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/49
Base: `main@6863bc02c8db45aae3cd231c349ecf069bcd72c5`
Scope: protected-main checks, D1 migration preflight/local rehearsal, and a fail-closed deployment job for the existing `private` Preview.

## Authorized outcome

- `worker` and `web` checks run for PRs and pushes to `main`.
- Only a successful `push` to `main` may reach the private Preview job; PRs never publish.
- D1 provenance, exact existing target, Access-denial checks, migration hashes, a private snapshot, local migration rehearsal, and a current-main check precede any remote write.
- The first approved migration is `0013_owner_auth_local.sql`, pinned by SHA-256 in the migration allowlist. A new migration must be reviewed and added there in its functional PR.
- Deployments and migrations are serialized and never cancel an in-flight deployment.
- The existing Access policy, D1 binding, Worker, and secret remain untouched; no resource creation, R2, production command, seed, or data reset is allowed.
- If the provenance gate, token, plan, Access, target, backup, migration rehearsal, or latest-main check is absent or fails, no remote mutation occurs.

## Pending prerequisites

The GitHub repository currently has no Cloudflare Actions secret or Preview variables. `CF_PREVIEW_CD_ENABLED` therefore defaults to disabled and a merge cannot trigger Cloudflare writes until the scoped CI credential and explicit enabling variable are configured. The CI token must be scoped to the existing Worker and D1 only, with Access/billing read-only where required. Do not reuse the local account token in Actions.

The D1 provenance comparison was completed on 2026-10-26 and is **SUPPORTED** by the user's 16 October OWNER-test record, the 17 October third-listing/image metadata, the 18 October synthetic ADMIN audit events and the same-day three-listing checkpoint. The comparison selected no addresses, descriptions, image names/bytes, or contact content. See `.orchestration/evidence/CF-AU-PREVIEW-D1-PROVENANCE.json` and Issue #49 comment `6416495157`.

After that result, the existing D1 was exported only to a local mode-0600 backup, imported to an isolated local D1, and `0013_owner_auth_local.sql` was rehearsed successfully. The existing remote D1 remains unchanged with 0013 pending. No Cloudflare write has occurred in this increment. The CI release gate remains fail-closed until its narrow Actions credential and explicit variables are present.

## Acceptance

1. Local guard unit tests cover main-only event admission, disabled/missing configuration, exact Worker/Preview/D1 identity, synthetic-data manifest equality, approved migration hash, fail-closed destructive patterns, and Access status checks.
2. A backup from the authorized synthetic D1 imports to a private local D1 and `0013` applies there without changing row counts or image/audit metadata.
3. PR CI `worker`/`web` pass; GitHub automatic review and proportional read-only technical review pass on the exact candidate; merge is protected.
4. Until CI credentials are correctly scoped and `CF_PREVIEW_CD_ENABLED=true`, the main-branch deployment job reports a safe skip and performs no remote call. Once armed, it verifies Access anonymously before and after deployment and records exact SHA/URLs/deployment ID without exposing contents or credentials.

## Data-provenance evidence

`.orchestration/evidence/CF-AU-PREVIEW-D1-PROVENANCE.json` stores only IDs, owner/actor IDs, states, counts, timestamps, media source/count/size metadata, and migration history. It contains no listing address, description, image name, image bytes, contact content, or secret.
