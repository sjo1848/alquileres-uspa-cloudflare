# M2.1 remote migration preflight

Observed: 2026-10-27. Authorized main base: `797e6656488d5473b9348542c2312ed0c90c94a6`.

## Read-only remote checks

- GitHub `main` and merged PR #59 both resolve to `797e6656488d5473b9348542c2312ed0c90c94a6`.
- The existing target config validates the one private Worker Preview, `ACCESS_PREVIEW`, secure cookies, D1 BLOB, no R2, and the existing D1 ID `74a00c52-a63b-45a3-8213-6648378ed5b1`. No configuration was changed.
- Cloudflare read-only metadata returned the existing private Preview resource and current immutable deployment `f9b74d2e-c503-43b4-b15c-bc4b45e3f8f1`. This remains the previously published M1 version; M2.1 is not deployed. The Preview check validates resource/deployment identity, not a cryptographically attested source SHA.
- Cloudflare Access has the existing `Alquileres Uspallata private Preview` self-hosted app and one enabled `Operator only` allow policy with one email selector. Selector values were not read into the report. Anonymous requests to the six checked routes on both stable and immutable URLs were denied: 12/12.
- D1 `info` identifies the pinned synthetic database; the repository provenance guard passed using identity/audit anchors and aggregate checks without selecting listing descriptions, addresses, contact contents, or image bytes.
- Wrangler `d1 migrations list --remote` returned exactly one pending migration: `0014_monthly_rental_terms.sql`. No discrepancy was found. Remote `d1_migrations` remains unchanged.
- A current D1 Time Travel bookmark was captured before the migration rehearsal and stored only in the local private recovery record. It is not included in GitHub evidence. Restore overwrites the entire database; never run it automatically.
- The account subscriptions API returned an empty list. This does not independently attest the plan tier; no plan claim is made. No plan, billing, resource, Access, or Worker setting was changed.

## Backup and local rehearsal

- `wrangler d1 export --remote` created a 62,127-byte SQL backup outside the repository under the operator's protected config directory. Backup mode is `0600`; its parent is `0700`. The backup may contain synthetic password hashes and is not uploaded or linked.
- The SQL backup was imported into a separate local Wrangler persistence directory (`0700`). The provenance guard passed before the rehearsal. Migration 0014 was applied only to that local copy; the resulting local migration ledger showed 0014 and both expected validation triggers. The provenance guard passed again and reported zero pending local migrations.
- Remote D1 was not migrated. The private Preview Worker was not published or otherwise changed.

## Guard change and evidence

- Migration 0014 is SHA-256 `e71a710f90cf6b2dfdd5d329b280ac57931bab9d212dfdfbf74f1f43ce5cdb95`.
- The allowlist binds that exact hash to Issue #58 and allows only the named `listings_validate_rental_terms_update` `BEFORE UPDATE OF` trigger declaration. After the exact trigger header is removed from validation, any remaining `UPDATE` still fails. The existing 0013 policy remains unchanged.
- `python3 -m unittest scripts.tests.test_preview_cd_guard -q`: 32/32 PASS, including exact 0014 hash acceptance, hash mismatch rejection, altered and extra trigger declaration rejection, unauthorized migration rejection, destructive SQL rejection, and general DML UPDATE rejection under the 0014 policy.
- Python compilation, `git diff --check`, and `scripts/check_orchestration_state.py --base 797e6656488d5473b9348542c2312ed0c90c94a6`: PASS.
- GitHub Actions run `40579143017` on tracking SHA `f26df3033591fd40e8dac559cded50637f889c95`: `worker` and `web` SUCCESS; `staging-private` SKIPPED. The branch protection read showed `worker` and `web` required, admins enforced; required approval count is zero.
- Delegated Controller review first returned two P2s on `d9c208a`; both were repaired in the test/canonical checkpoint. Its bounded review of exact artifact `f26df3033591fd40e8dac559cded50637f889c95` found no code/guard defect but returned REWORK for stale `30/30` text in active STATUS. That count is reconciled to 32/32 below. No final Controller PASS is claimed. Review report: `.orchestration/evidence/critics/MVP-M2.1-MIGRATION-CONTROLLER-REWORK-F26DF30.md`.
- No automated GitHub review submission was observed; none is claimed. The PR remains open and unmerged.
- The change is prepared for a protected PR. Do not merge it or allow any remote migration to run before the separate Human authorization.

## Recovery plan and stop boundary

Before a separately authorized remote migration, refresh the remote migration list and bookmark, confirm the SQL backup remains present and mode `0600`, and confirm the protected PR's exact 0014 hash still matches. Apply only 0014 if that separate authorization explicitly permits it. Verify the remote migration ledger and schema without reading/publishing listing contents.

If the migration fails or integrity differs, stop further writes and preserve logs without SQL rows or credentials. Do not automatically restore. Time Travel restore is a full-database overwrite and requires an explicit separate authorization; use the private SQL backup for isolated diagnosis only. Preview publication is a separate gate.
