# CF-AU-I04 Artifact A6 delegated Controller REWORK

- Reviewer: `delegated_codex_separate_process`, `project_controller` role; separate CLI process, not native subagent or external authority.
- Exact artifact reviewed: A6 executable SHA `549baf37952129d1cacfc46565e8ee1fb5581887`, tree `3887b1056b08d139367e94119c476bc05fcaf9c5`; base `774d0c747e8ecbbdb97776641becbd9e49875875`; current PR checkpoint `739fc900e337943b17be8f414bc79afcada7acda` adds only state/evidence beyond A6.
- Verdict: **REWORK (bounded P2 evidence gap)**. No P0/P1 or deletion-code defect was found. The Controller verified external/unknown/unset strategy guard before lock, D1_BLOB preservation, same-key replay ordering, and STATIC_ASSETS distinction.
- Findings: STATIC_ASSETS regression did not assert no audit/idempotency receipt and only covered recovery-operation metadata, not a dynamic `listing_images` row; external strategy regression lacked a separate arbitrary unknown strategy. Fixes are in the subsequent A7 test candidate; no production Worker source changed after A6.
- Runtime: CLI `codex-cli 0.163.0`; explicitly invoked with `--worktree --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json`; process exit 0, thread `01a15399-fa25-7300-9918-3c61fc11bb85`, turn completed. An earlier attempt without `--worktree` failed before review because the read-only filesystem prevented app-server initialization; it produced no verdict. The successful retry kept `--sandbox read-only`; worktree was `/home/sjo1848/.codex/worktrees/d4e4/alquileres-uspa-cloudflare`, detached at PR head. CLI exposed requested configuration; backend model identity remains **UNVERIFIED**.
- Reviewer made only read-only `git`, `rg`, and `sed` inspection calls; no tests/builds or file/ref mutations. Three transient localhost MCP transport errors appeared, but the session continued to inspect the exact diff and returned the final report. Raw final output and exact prompt are preserved alongside this report.
- Parent reran the affected Worker management test after A7 regressions: 13/13 PASS, and Worker typecheck PASS. The earlier A6 test pass is preserved in A6 evidence; no full suite or Playwright rerun was needed because only regression assertions/cases changed.
- Token usage: 294,286 input (228,480 cached), 3,803 output (1,895 reasoning). This is a local technical review and does not authorize integration by itself.

## Exact reviewer output

See `CF-AU-I04-ARTIFACT-A6-CONTROLLER-REWORK-RAW.txt`. The exact prompt is `CF-AU-I04-ARTIFACT-A6-CONTROLLER-PROMPT.txt`.
