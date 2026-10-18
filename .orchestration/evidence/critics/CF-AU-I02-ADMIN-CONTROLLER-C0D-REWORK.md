# Controller review — c0d7839 — REWORK

- Reviewer: `delegated_codex_separate_process` (`project_controller` role instructions)
- Command: `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --ephemeral --json`
- Candidate code/test SHA/tree: `c0d78392dceac2498e94ee095f374f6f452c8a09` / `8c8c3c2ef7df2f5c8e071268c4d09520f79e1bdd`
- Canonical main base: `59660aed13f68b92b00cae0eced4494b54f2d8a7`
- Process exit: 0. CLI accepted the selected model, config and sandbox arguments sufficiently to start and complete; no option/model fallback was observed. CLI output does not independently expose selected runtime metadata; backend identity remains **UNVERIFIED**. The process remained read-only. Stderr contains unrelated ignored local project-config and unavailable local MCP transport notices; neither prevented code inspection/output.
- Verdict: **REWORK**, no P0/P1 code defect found.

Findings returned directly to Codex:

1. `STATUS.json` still referenced `c0d7839` as the exact PR head even though PR #15 had advanced to the state-only checkpoint `044e6ae`. Fix by recording distinct exact PR head and executable code/test SHA, and avoid stale next-action references.
2. The queue role regression seeded a listing under a user already ADMIN; it did not change an OWNER role during the test or prove a valid OWNER listing remained visible in that same test. Fix with a true role transition plus positive/negative queue assertions.

Codex verified PR #15 remained OPEN and `main` remained `59660aed`; the review comment's suggestion that a squash commit existed on main was not adopted. Both REWORK findings have now been corrected in the subsequent test/checkpoint work. The full output, exact prompt and raw JSONL process events are retained beside this report. This REWORK is not a PASS and does not authorize integration.
