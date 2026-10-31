# M2.1 / Issue #61 — D1 migration 0015 preflight

Observed: 2026-10-31. No remote schema, Worker, Preview, Access, CI/CD, production, billing, or resource setting was changed.

## Canonical source and Preview

- PR #62 is merged at `main@2a7562aa4301211ab3e1bab7a85017f7d18e6ba4`; post-merge Quick checks run `41206139855` passed for Worker and Web. `staging-private` passed its fail-closed gate and all migration/deploy steps were skipped.
- Read-only `wrangler whoami` confirmed the expected Cloudflare account. The existing `private` Preview API returned the pinned Preview resource and latest deployment `b06c0fdc-5e76-45e4-829c-650e0890bbd7`; stable and immutable URLs were not changed.
- Worker/D1 target validation passed against the checked-in exact account, Worker, Preview, and D1 IDs. D1 list returned the existing `alquileres-uspa-preview-synthetic` database (`74a00c52-a63b-45a3-8213-6648378ed5b1`). No other resource was queried for content or modified.
- Cloudflare Access API read found the existing `Alquileres Uspallata private Preview` self-hosted app and `Operator only` allow policy. Policy selector values were not read. Anonymous checks across six routes on both stable and immutable URLs were denied: **12/12**.
- Synthetic provenance guard passed, selecting only approved identity/listing/audit anchors and aggregate counts; no address, description, email value, contact body, image name, or image bytes were selected.

## Remote migration state and exact migration

- Remote `d1_migrations` contains 14 known entries, `0001_core.sql` through `0014_monthly_rental_terms.sql`. `0014` is applied and `0015_listing_change_revisions.sql` is the **only pending migration**.
- SHA-256 of `apps/worker/migrations/0015_listing_change_revisions.sql`: `4932baa752f60f6d25813663dcdafa6454eff2e0cd97a9da16270731d030a22e`.
- 0015 is additive: one private revision table, one queue index, and two ownership/publication-boundary triggers. It does not alter or backfill existing listing, image, or contact rows and contains no destructive SQL or data-update statement. Its foreign keys reference existing `listings`/`users`; payload/reason/state/version constraints are checked by SQLite/D1. The triggers require the same OWNER binding and an `APPROVED/PUBLISHED` listing on revision insert/update.
- Existing product routes do not unpublish approved listings; OWNER deletion remains limited to DRAFT/REJECTED. The trigger predicate therefore matches the implemented revision lifecycle. The local rehearsal also exercised this DDL against the current remote snapshot with 0014 already applied.

## Private backup and isolated rehearsal

- A remote SQL export of the already-proven synthetic D1 was stored only under the operator's private configuration directory. File mode is `0600`, parent directory mode `0700`; size **65,021 bytes**. The path and contents are intentionally not published. A separate local Wrangler persistence directory was mode `0700`.
- The SQL backup was imported into isolated local D1. Baseline and post-0015 aggregate counts matched: users 2, listings 4, D1 BLOB images 2 / 21,015 bytes, static image references 2, contact events 1, audit events 4, idempotency records 4. No row content or image bytes were inspected.
- Local rehearsal recorded 0015 in the local migration ledger, created the 11-column revision table and exactly the two named ownership triggers. An initial disposable harness assertion incorrectly expected 12 columns; the migration definition and a corrected independent schema/count query confirmed 11, with no product or migration failure. Existing aggregates remained unchanged; synthetic-provenance verification passed after migration; local pending migrations: **0**.
- Recovery: stop on any mismatch; retain the private pre-migration SQL backup for isolated diagnosis. Do not auto-restore. A D1 restore overwrites the database and would need a separate explicit authorization after assessing the full snapshot; prefer an additive forward repair where safe. Worker publication is a later separate gate.

## Exact-hash guard and regression checks

- Prepared allowlist entry binds only 0015 to the exact SHA above and allows only the exact `BEFORE UPDATE ON listing_change_revisions` trigger header. The guard removes that reviewed DDL header before checking for `UPDATE`; update/DML in a trigger body remains rejected.
- Tests cover the exact hash acceptance, changed hash rejection, changed/extra update trigger rejection, general UPDATE/DML rejection even with a fixture-matching hash, destructive SQL rejection, and unapproved migration rejection.
- `python3 -B -m unittest discover -s scripts/tests -q`: **61/61 PASS**. Exact-hash consistency, `git diff --check`, and canonical-state validator pass.

## Stop boundary

**0015 remains unapplied remotely.** The private Preview remains on its current deployment; Access and D1 are unchanged. The allowlist/test change is in an unmerged functional PR for review. No Controller PASS or remote-migration authorization is claimed. Await separate Human authorization before any remote application; do not deploy the Worker or start M3.
