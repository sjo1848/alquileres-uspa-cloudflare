# I07 qualified separate-process Controller finding — synthetic role ownership

- **Reviewer kind:** `delegated_codex_separate_process`
- **Verdict:** `REWORK` (not PASS)
- **Artifact SHA/tree:** `a69f6de128b374a7063a8ebe679f19d1665e9e17` / `124c60175d39426412f14b68995caba45c30d99a`
- **Canonical base:** `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`
- **CLI:** Codex CLI v0.164.0; explicit args `--model gpt-6-luna -c model_reasoning_effort="high" --sandbox read-only --ephemeral`; exit 0; session `01a17a0a-8c29-76f0-98f6-5b5929a61922` (captured by parent). CLI settings accepted; actual backend identity `UNVERIFIED`. Reviewer used inspection-only shell commands and made no changes. Exact artifact worktree was detached/clean at review start.
- **Test provenance:** no tests/builds run by reviewer; source and existing QA evidence inspected. Exact PR tracking-head checks were queued at launch; no current result inferred. No GitHub or Cloudflare reads/mutations by reviewer.

## Blocking P1

The provenance guard accepted any synthetic user ID as a listing owner, regardless of role. It also accepted synthetic audit actors/targets without requiring ADMIN actor or OWNER target, and did not check that the audit target owner matched the current or reviewed listing owner. Counterexamples: a listing owned by the synthetic ADMIN; an audit event with OWNER actor/ADMIN target; or a synthetic OWNER target that differs from the referenced listing’s owner. The schema only enforces user-ID existence; Worker routes establish the role relationships.

## Repair in the next candidate

- Require every listing owner to be a synthetic `OWNER`.
- Require audit actors to be synthetic `ADMIN`, non-null targets to be synthetic `OWNER`, and each event’s target owner to match the current, baseline, or verified-assisted-create owner for that listing ID.
- Keep baseline deletion and assisted create/delete positive controls; add negative OWNER-owned-by-ADMIN, OWNER-as-audit-actor, ADMIN-as-target, and mismatched synthetic owner tests.
- Harden the JSONL parser follow-up: require a canonical UUID deployment ID and only accept either a single Preview record or one `wrangler-session` followed by Preview.
- Current local affected result after repair: parser/provenance 23/23; complete Python suite 48/48.

The two earlier Controller findings on unverified audit listing IDs and impossible listing publication states remain fixed in the inspected candidate. A new final exact-SHA Controller review is required after this repair.
