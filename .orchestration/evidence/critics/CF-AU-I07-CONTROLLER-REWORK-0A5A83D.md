# I07 Controller finding — provenance guard (candidate 0a5a83d)

- **Reviewer kind:** `delegated_codex_subagent` (`project_controller`)
- **Verdict:** `REWORK` (diagnostic feedback; not a qualified PASS)
- **Artifact SHA:** `0a5a83d7a262a8bdde0860b10d745fd4e9944f3f`
- **Canonical base:** `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`
- **Requested runtime:** `gpt-6-luna`, high effort. Actual backend identity: **UNVERIFIED**. Read-only confinement was not independently verified; this invocation does not satisfy operational verification v2 as a qualified read-only Controller gate.
- **Test provenance:** reviewer inspected the candidate and local QA report; did not rerun tests. At that time exact-head GitHub CI/review was pending.

## Blocking technical finding

`validate_synthetic_provenance` checked audit actors and target owners, but did not constrain `listing_id`. Migration `0009_admin_audit_shape_and_review_queue_index.sql` has no foreign key for this reference. Thus a synthetic actor could have an audit event pointing at an unknown/unverified listing and pass the staging provenance gate. The positive “deleted synthetic listing” test also used an arbitrary ID, so did not prove a safe deletion case.

## Repair applied in the candidate

- Audit listing references are accepted only if the ID is a current synthetic listing, a reviewed baseline listing anchor, or is established by a valid synthetic `ADMIN_ASSISTED_LISTING_CREATED` event whose actor is ADMIN and target is OWNER.
- Positive regression uses a deleted reviewed-baseline listing and exercises create-then-delete for a new assisted synthetic listing.
- Negative regression proves an unknown audit listing ID fails closed.

The original verdict remains REWORK. A qualified separate read-only Controller review is required on the final exact SHA after the repair.
