# I07 GitHub automatic review finding — OWNER-created listing removed by assisted ADMIN

- **Source:** GitHub automatic review of PR #53, finding on reviewed commit `a90f202b513eabaccd48b9b5109cda8a8dec05f0`.
- **Severity:** P2.
- **Finding:** OWNER `POST /listings` does not emit an audit creation event. If ADMIN later deletes the listing through assisted management, the listing row is removed while an `ADMIN_ASSISTED_LISTING_DELETED` audit event remains. The provenance guard previously accepted only baseline IDs and assisted-create IDs, so it rejected this valid synthetic D1 state and could block later staging checks/releases.
- **Repair:** Use only an audit event with exact action `ADMIN_ASSISTED_LISTING_DELETED`, a synthetic ADMIN actor and synthetic OWNER target as durable provenance for the removed listing. Apply that owner association to its whole audit history. Reject missing targets, mismatches with current/baseline owners, invalid roles, and orphan IDs supported only by unrelated audit actions.
- **Regression:** Simulates a newly OWNER-created listing with an ADMIN review event, followed by assisted ADMIN deletion, with no live listing row; accepts it. A mismatched OWNER target for an existing listing and an unrelated orphan audit event remain rejected.
- **Tests after repair:** provenance guard 25/25; complete Python suite 50/50. These are local checks; exact-head GitHub CI and final read-only Controller review remain required.
- **Scope:** local code/guard only; no Preview/CD/D1 remote/Access/production/data mutation.
