# Issue #49 — CI/CD local preflight evidence

Observed against protected `main@6863bc02c8db45aae3cd231c349ecf069bcd72c5` on 2026-10-26. No remote D1 migration or Preview publication was performed during this run.

## D1 provenance and migration rehearsal

- The minimum metadata comparison is recorded in `.orchestration/evidence/CF-AU-PREVIEW-D1-PROVENANCE.json`; it contains no address, description, image name, image bytes, contact content, or secret. The third record's creation time/OWNER ID, two BLOB image metadata rows, and 18 October synthetic ADMIN audit actor/events align with the user's 16 October OWNER test and 18 October synthetic-data checkpoint. Provenance: **SUPPORTED**; content was not inspected.
- After that comparison, a private local backup of the existing synthetic D1 was made at mode `0600` inside a mode `0700` state directory; it is outside Git and not published. Size: 58,481 bytes. SHA-256: `07336ae2430f697607ee1ea076bdc7d5e56402268cc2611b716e6fea4c54fcab`.
- The backup was imported into an isolated persisted local D1. Migration `0013_owner_auth_local.sql` applied successfully in that copy. Verification preserved the metadata baseline and row counts (2 users, 3 listings, 2 D1 BLOB rows, 2 Static Assets rows, 0 contact events, 2 audit events); no local migration remained pending. The remote D1 still has `0013` pending.

## Local controls

- Preview/CD guard tests: **13/13 PASS**.
- Entire existing Python unit set: **38/38 PASS**.
- Web typecheck: PASS.
- D3.1 `build:preview`: PASS; generated Worker config targets the existing `private` Preview/D1, has `ACCESS_PREVIEW`, `D1_BLOB`, secure cookies, and no R2.
- Existing stable and latest observed immutable Preview (`c652ceb4-01aa-408c-8a3f-4abbb91b4ca7`): anonymous probes across six routes each, **12/12 denied by Cloudflare Access**. No authenticated remote browser session was available in this run.
- Fail-closed gate with deployment disabled: SAFE SKIP. GitHub currently has no `CF_PREVIEW_API_TOKEN` secret or Preview CD variables, so no workflow path can perform remote reads/writes until configured.
- Workflow static checks: actionlint PASS; `git diff --check` PASS.

## Boundary

No Cloudflare resource, Access policy, billing setting, production target, source repository, or Preview deployment was changed. The local token was not copied to GitHub Actions. Missing narrowly scoped CI credentials leave remote migration/deploy disabled; merge of the functional PR cannot cause a remote mutation in that state.
