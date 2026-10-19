# I05 Controller run metadata

- Reviewer: `project_controller` as `delegated_codex_separate_process`; this is not a native subagent or external publisher.
- CLI: `codex-cli 0.163.0`, invocation: `codex exec --ignore-user-config --skip-git-repo-check --ephemeral --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json -C /tmp`.
- Session/thread: `01a15401-c55e-7611-b784-7fb3c4114acf`; final CLI exit status: 0 (`turn.completed`). Requested model and effort were accepted by the completed process. Provider backend model identity: **UNVERIFIED**.
- Reviewer process itself was the Controller; no nested reviewer was launched. The working directory was `/tmp`; repository files were inspected with read-only `git show`/absolute-path reads. No files, tests, branches or GitHub state were modified by the reviewer.
- Exact functional candidate: SHA `14d79e5792298c4f2eba0d53bc2f0b102818ab88`, tree `c8015ee49c29c271e90e8542858ab5fa0fe28997`; canonical base `093bd9128653281b79599caf61bb6fa979b8fb49`.
- Exact input: `CF-AU-I05-CONTROLLER-14D79E5-PROMPT.md`. Final reviewer output: `CF-AU-I05-CONTROLLER-14D79E5-PASS.md`.
- Controller did not execute tests. It supplied PASS with no P0/P1. Its sole P2 follow-up is an explicit ADMIN logout/session-version revocation regression; shared session middleware already checks version for ADMIN routes. This follow-up is nonblocking and remains recorded.
