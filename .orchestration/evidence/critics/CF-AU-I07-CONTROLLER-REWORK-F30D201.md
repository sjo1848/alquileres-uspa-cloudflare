# I07 separate-process Controller review — findings on f30d201

- **Reviewer kind:** `delegated_codex_separate_process`
- **Verdict:** `REWORK`; not a final PASS.
- **Artifact SHA/tree:** `f30d2017a1947cf95e43eb5302ad171c260c254a` / `c801042ad64ea789909638c00d28b8d64a006f8a`
- **Base:** `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`
- **CLI:** Codex CLI `0.164.0`; requested with `codex exec --json --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral --cd /tmp/alquileres-uspa-i07-controller-f30d`; exit 0; session/thread `01a17a11-bdfc-7090-b056-ec4b6e89b4bd`. `-o` captured the complete final report. CLI configuration acceptance is **UNVERIFIED** per reviewer; actual backend model identity **UNVERIFIED**. Requested sandbox was read-only; checkout was detached and clean; report says inspection only and no tests or modifications.
- **Exact-head CI:** GitHub Actions for tracking SHA `720bf0ac19c6c11c1e9b3bd7ca9c4456cd19efd1` was pending at review. `web` subsequently completed PASS; `worker` was still running at observation. This review makes no CI PASS claim.

## P2 findings

1. Assisted-delete audit rows with missing `listing_id` and missing `target_owner_id` passed: validation gated both required fields on truthiness of `listing_id`, then skipped null listing IDs. Repair by requiring both nonempty listing ID and synthetic OWNER target on assisted create/delete events, while rejecting null/empty variants.
2. `parse_deploy_output` accepted malformed UUID strings of length 36 because it still used `[0-9a-f-]{36}`. Repair by using the canonical UUID pattern already applied in the remote-deployment verification path and test wrong-group UUIDs that retain length 36.
3. `QA.md` test table still showed 22/22 and 47/47 while evidence reported 25/25 and 50/50. Reconcile report totals.

The reviewer found the OWNER-created → assisted-delete provenance handling otherwise had a positive test and retained synthetic role/owner checks. It confirmed the report distinguishes local QA from remote QA and did not identify a new product, authorization, or data exposure issue.

## Repair status

These findings are repaired locally after the reviewed SHA. The corrected candidate's focused test result is 26/26 and full Python suite 51/51; exact-head CI, automatic review, and a fresh exact-SHA Controller review remain outstanding. See updated QA and follow-up state event. Do not treat this report as approval to integrate.

## Full Controller response

```text
## Verdict: REWORK

Artifact: f30d2017a1947cf95e43eb5302ad171c260c254a
Tree: c801042ad64ea789909638c00d28b8d64a006f8a
Base: b7e1d7b27f778ec56de29ed5bcd446f199d1a412

P2 — Assisted-delete audit can omit the target and listing ID. An event with action ADMIN_ASSISTED_LISTING_DELETED, synthetic ADMIN actor, listing_id=None, and target_owner_id=None passes because the required OWNER target check only runs when listing_id is truthy and null listing IDs are skipped.

P2 — Wrangler deploy-output parser accepts malformed UUIDs. It uses a 36-character lowercase hex-or-hyphen regex; `12345678-12345-123-1234-1234567890ab` passes the shape check and URL prefix validation.

P2 — QA test totals are stale. QA.md reports 22/22 and 47/47 while cited evidence reports 25/25 and 50/50.

The OWNER-created-then-assisted-deleted path otherwise has a positive regression; role checks, publication state checks, formatter assertions and JSONL ordering/duplicate/unknown checks appear covered. GitHub CI for 720bf0ac was pending, not passed.

Runtime: delegated_codex_separate_process; requested gpt-6-luna / high / read-only. CLI configuration acceptance UNVERIFIED; actual backend model identity UNVERIFIED. Bounded technical review; not external independent criticism or protected approval.
```
