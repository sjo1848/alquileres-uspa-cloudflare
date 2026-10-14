# Delegated Controller operational verification v2 — no impossible backend attestation gate

Date: 2026-10-14
Authoritative basis: Human expressly required GPT-6 Luna, High, read-only Controller in Codex; did **not** request provider-signed backend identity proof. This decision **supersedes** the previous automatic BLOCKED_MODEL_CONFIG criterion for unavailable internal provider-model attestation in `DELEGATED-CONTROLLER-GPT6-LUNA-HIGH.md`, `CONTROLLER-RUNTIME-CORRECTION.md`, `AGENTS.md`, and any older P2 pre-critic text, but ONLY for local/synthetic technical milestones.

## What operational verification means

An acceptable **delegated local technical** Controller run must have ALL of:
1. One actual distinct reviewer session/process launched with `--model gpt-6-luna`, `model_reasoning_effort="high"`, `--sandbox read-only`, or verified equivalent native role configuration **plus enforced read-only inherited runtime**. No model or effort fallback. Do not rely only on the model's own self-identification.
2. Captured invocation/config and session startup/completion evidence, exact reviewer input, actual candidate full SHA and canonical base full SHA, command exit status, and inspectable raw reviewer output (redact secrets and never commit a copied auth file, token, sensitive home path or session credential). Preserve CLI/app-server metadata when available.
3. Observed read-only execution: CLI explicitly accepted sandbox, reviewer tool calls stayed non-mutating, source repository and main refs unchanged; if sandbox refuses a write probe do so only in a disposable review-specific temporary directory, never prod/source. Ensure no write-capable connected app reaches the reviewer. Execution identity is `delegated_codex_separate_process` if a separate `codex exec`, not a native custom subagent.
4. Actual adversarial inspection of exact tested candidate code/test tree and D1/R2/identity/security invariants, current GitHub review comments, fixed P0/P1 findings, provenance of tests, and an explicit bounded PASS/REWORK/BLOCKED/HUMAN_GATE report with concrete evidence.
5. No errors suggesting the selected model was unsupported, downgraded or transparently substituted. If CLI fails to start, model unavailable, forced fallback detected, read-only not enforced, or reviewer output missing: `BLOCKED_MODEL_CONFIG`.

Record separately `model_requested = gpt-6-luna`, `reasoning_requested = high`, `cli_configuration_accepted = true` (only after evidence), `actual_backend_model_identity = UNVERIFIED` unless the provider exposes independent metadata. **Unavailable provider-signed attestation is NOT by itself a blocker** for this local technical review. Do NOT falsely assert verified backend identity. This is normal, noncryptographic operational verification, not a substitute for independently enforced release permissions.

## Current PR #10 / CF-AU-I01-P2

- PR #10 last observed `5dce70aa9065feb74dbf2f61ccf54241b9cdb815`, OPEN, NOT MERGED. Candidate code and its reviewed SHA `cdb8970ce06fb03d841bd9b2ba32769d78c5629e`. A4 has NOT been published. The last separate process audit found no P0/P1 in its inspected subset, but reported `BLOCKED_MODEL_CONFIG` solely due to lack of unavailable backend-model attestation. **This is not retroactively converted to PASS.**
- Fresh GitHub automated review of exact PR head `5dce70a` found an additional **client-controlled Idempotency-Key leakage** in scheduled recovery logs: `apps/worker/src/index.ts` around lines 311, 313, 324 contains `operationId:op.request_key` or `operationId:candidate.request_key`. Arbitrary caller-supplied values may contain personal/sensitive information, contradicting privacy/logging invariant. Even if GitHub labels it P2, correct and test this narrowly **before freezing A4**. Use only internal operation IDs or newly generated correlation IDs in logs, never raw request keys, JWTs, cookies, secrets or PII.
- Codex owns local changes/tests, independent internal review and processing of automated GitHub PR review. Run targeted logging/privacy checks and relevant regressions; if only log text changed and exact executable test inputs unchanged, avoid gratuitous multi-hour suite repetition if already matching the candidate, but refresh final validation provenance and run required full HTTP suite when implementation/regression changes make it necessary under contract.
- Then run a **fresh** Luna High read-only Controller review of the NEW exact SHA (not previous candidate), using operational criteria above and requesting a falsification of privacy/idempotency/commit-replay failure modes. If all applicable evidence and Pre-Critic are PASS, publish immutable A4 + SHA boundary; do not self-PASS or claim production readiness.

## Safety and scope

This is NOT authorization to change security risk acceptance, product behavior, real records, remote Cloudflare D1/R2/Workers, usage charges, staging/public/production, source repo writes, or auto-merge into main. The delegated reviewer remains in Codex's trust domain, not a separately authenticated release authority. Main integration remains separately gated; no Runtime Watch activation.
