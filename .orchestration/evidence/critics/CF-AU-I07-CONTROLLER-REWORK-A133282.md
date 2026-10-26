# I07 Controller finding — stale tracking checkpoint after code commit

- **Reviewer kind:** `delegated_codex_separate_process`
- **Verdict:** `REWORK` (tracking checkpoint only).
- **Reviewed SHA/tree:** `a133282a8ab985d57ee8846a743e4a4396817006` / `4b12e82a66a94c9b54f3581251975d3d085dafe7`; base `b7e1d7b27f778ec56de29ed5bcd446f199d1a412`.
- **CLI:** Codex CLI 0.164.0; requested model/effort/sandbox `gpt-6-luna` / high / read-only; `codex exec --json --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral`; session `01a17a19-42c5-7573-804c-3ae45b279a5f`; exit 0. Backend identity UNVERIFIED. Configuration acceptance not independently attested by reviewer.
- **Finding:** `STATUS.json` on the code commit still referenced prior executable `7869af8` and previous 26/51 results. It did not reflect this code candidate; the state checkpoint that reconciles code/tree and 27/52 results is subsequent tracking commit `2d2a1a31090aa47d9a5025cea5884b2ce1d7e1f9`.
- **Repair:** final review must inspect the complete PR HEAD containing the state checkpoint, with status explicitly identifying the current observed tracking parent and explaining that the state commit SHA is derived from GitHub after push to avoid self-reference.
- **Other assessment:** reviewed receipt semantics and code as sound; no code defects were reported in that pass. No tests run; no changes by reviewer.
