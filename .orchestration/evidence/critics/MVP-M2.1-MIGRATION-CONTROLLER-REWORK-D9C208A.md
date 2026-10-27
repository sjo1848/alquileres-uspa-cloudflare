# M2.1 migration guard Controller review — REWORK

- Reviewer kind: `delegated_codex_separate_process`
- Artifact reviewed: `d9c208ad35b52a44ef799ed155e38c22bed7a087`
- Canonical base: `797e6656488d5473b9348542c2312ed0c90c94a6`
- Requested model/effort: `gpt-6-luna` / High; actual provider/backend identity: **UNVERIFIED**.
- Invocation: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json --ephemeral --cd <isolated-worktree> --output-last-message <private-output> -`.
- Codex CLI: `0.164.0`; process exit: `0`; session/thread: `01a17f0e-5f7d-7631-8f10-1067903d3b74`. The selected CLI configuration was accepted and the reviewer performed read-only inspection; no filesystem/GitHub/Cloudflare writes occurred. No provider-signed model attestation is available.
- Input/output usage reported by the CLI: 416,163 / 8,152 tokens. The large input was caused by broad canonical-state inspection; subsequent review prompts are narrowed to the small changed surface.
- Prompt: `.orchestration/evidence/critics/MVP-M2.1-MIGRATION-CONTROLLER-REWORK-D9C208A-PROMPT.md`.

## Verdict and findings

**REWORK — two P2 findings.**

1. Canonical `STATUS.json` and `STATE.md` referred to the older checkpoint `52ed890...` while the reviewed PR HEAD was `d9c208a...`. Reconcile the active review pointers to the actual guard artifact and explicitly distinguish executable/test SHA from a later status-only checkpoint.
2. Tests did not explicitly falsify altered or extra trigger declarations. Add regressions for a changed trigger header and an additional unlisted `BEFORE UPDATE` trigger, even if the fixture digest is recomputed, proving the DDL exception cannot broaden.

No material unsafe allowlist or DML bypass was found. The exact migration SHA is checked before parsing; only the listed trigger header is removed; remaining `UPDATE` is rejected. Unapproved migrations, digest mismatch, and tested destructive SQL remain fail-closed.

The reviewer inspected the diff, migration, allowlist, guard/tests, preflight evidence, and state. It did not run the tests or verify the private backup/bookmark. GitHub Worker/Web checks were PASS on `d9c208a`; `staging-private` was safely skipped. The PR remained open and unmerged.

## Runtime limitation

The configured native Controller returned `BLOCKED_MODEL_CONFIG` because it could not establish enforced read-only confinement. Its result is advisory only. This separate process used the documented requested CLI model/effort and `--sandbox read-only`; provider identity remains unverified. This REWORK is technical feedback, not merge/migration/deployment authorization.
