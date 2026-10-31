# Historical contract — M2.1 remote migration preflight (Issue #58 / migration 0014)

This contract is retained as historical evidence for the completed 0014 preflight. It is **not** the active contract for the 0015 preflight in Issue #61. The active contract is `.orchestration/contracts/MVP-M2.1-0015-MIGRATION-PREFLIGHT.md`.

- **Authorized base:** `main@797e6656488d5473b9348542c2312ed0c90c94a6`.
- **Scope:** read-only verification of the existing private Preview, Access, and synthetic D1; exact-hash allowlist and local guard tests for migration `0014_monthly_rental_terms.sql`; private SQL backup; isolated local rehearsal against the backup; report results in Issue #58.
- **Forbidden:** applying 0014 remotely, publishing or changing the Worker, modifying Access, production, CD configuration, resources, or billing; starting M2.2/M3.
- **Authorization boundary:** this task ends before merging any change that makes 0014 eligible for remote automation and before remote migration. A separate Human authorization is required for remote application. Preview publication requires another separate authorization.

## Acceptance

1. Confirm `main` is the authorized SHA and the migration-only config still pins the existing Worker account and synthetic D1.
2. Read-only checks show the existing operator-only Access policy, anonymous denial, D1 synthetic provenance, and exactly one pending migration: 0014.
3. Add an allowlist entry bound to the exact 0014 SHA. Permit only its named `BEFORE UPDATE OF` trigger DDL; generic data `UPDATE`, destructive SQL, hash mismatches, and unapproved migrations remain blocked.
4. Tests cover the exact migration, hash mutation, unapproved migration, destructive migration, and DML UPDATE rejection.
5. Export the existing D1 to a local private SQL backup and rehearse 0014 against an isolated local copy. Do not publish backup contents or recovery identifiers.
6. Record results, limits, and a fail-safe recovery plan in Issue #58. Leave remote D1 and Preview unchanged and stop for separate remote-migration authorization.
