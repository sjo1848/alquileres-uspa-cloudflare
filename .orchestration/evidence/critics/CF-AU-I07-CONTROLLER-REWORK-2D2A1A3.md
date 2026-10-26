# I07 Controller findings — assisted-delete receipt and exact tracking HEAD

- **Reviewer kind:** `delegated_codex_separate_process`
- **Verdict:** `REWORK` (two bounded P2 findings; no P0/P1).
- **Reviewed PR SHA/tree:** `2d2a1a31090aa47d9a5025cea5884b2ce1d7e1f9` / `55f8794f4f57ab820a0cab227ce41ddf536f5b1a`; recorded executable SHA/tree `a133282a8ab985d57ee8846a743e4a4396817006` / `4b12e82a66a94c9b54f3581251975d3d085dafe7`; base `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`.
- **CLI:** Codex CLI 0.164.0; requested `gpt-6-luna` / high / read-only; exact invocation `codex exec --json --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral`; session `01a17a1b-2db5-7e03-acdc-2095a5bc9ab8`; exit 0. Backend identity UNVERIFIED; reviewer cannot attest parent CLI metadata. Inspection only; no tests or edits.
- **Exact-head GitHub:** `worker`/`web` PASS, `staging-private` SAFE SKIP. Automatic review still running at review time.

## Findings

1. **P2 — standalone assisted-delete audit was enough to establish provenance.** `ADMIN_ASSISTED_LISTING_DELETED` for a previously unknown non-baseline listing ID populated the synthetic owner map from its target alone. Required repair: bind that audit to the matching successful ADMIN assisted-delete idempotency receipt; require its exact scope/resource, COMMITTED state and ADMIN actor; retain synthetic OWNER target and role/owner checks. Add a regression rejecting a free-standing orphan assisted-delete audit.
2. **P2 — last observed tracking SHA was stale.** `STATUS.json` named `dfb26fb` even though it was reviewed at PR HEAD `2d2a1a3`; reconcile by recording the observed parent HEAD/tree and explicitly documenting that the checkpoint commit's own SHA must be derived from GitHub after publication (avoid self-referential state).

## Repair status

The code repair is now local: D1 snapshot retrieves only `owner_id`, `scope`, `resource_id`, and `state` for both OWNER and ADMIN assisted deletion receipts; the assisted-delete audit must match a COMMITTED receipt, including actor ID. Focused guard/Python tests passed 27/27 and 52/52. Status/checkpoint reconciliation is being applied before the next exact-head review. This is not a PASS or merge approval.
