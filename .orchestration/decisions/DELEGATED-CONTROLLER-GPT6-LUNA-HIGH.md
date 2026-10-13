# Controller delegado — GPT-6 Luna High

Date: 2026-10-13
Human instruction: a Codex subagent now takes over the routine technical Controller/Critic role previously exercised by ChatGPT. This document OVERRIDES conflicting earlier ChatGPT-External-Review wording in AGENTS.md and Autonomous Local Delivery Train v1 FOR FUTURE LOCAL/SYNTHETIC P2/P3/P4 TECHNICAL CHECKPOINTS ONLY. Historical ChatGPT verdicts and current open PR evidence stay intact.

## Model / responsibility
- Review agent: `.codex/agents/project-controller.toml`, exact `name = "project_controller"`, `model = "gpt-6-luna"`, `model_reasoning_effort = "high"`, `sandbox_mode = "read-only"`.
- Parent Codex orchestrates implementation, specialist agents, local tests, internal critiques and fixes; reviewer separately reads exact source/evidence and issues bounded PASS / REWORK / BLOCKED / HUMAN_GATE. Parent copies review output to GitHub with `REVIEWER_KIND=delegated_codex_subagent`. NEVER label it `external_chatgpt` or independently authenticated.
- ChatGPT does not need to review each local change. Human decides only genuine product/risk gates.
- This subagent is still within the Codex harness and can share its trust domain. It is NOT a separate secure actor. Prior history remains unaltered.

## Operative workflow
1. Current PR #10/P2 A3 is **REWORK-3**; Codex must solve the image operation postcommit-acknowledgment and idempotency/recovery defect CLASS under existing contract. Preserve A1–A3 lineage.
2. Before freezing another candidate, explicitly spawn `project_controller` with an exact SHA, active contract, past findings and task to seek remaining material failures. On REWORK, Codex autonomously repairs and re-invokes reviewer; do not invoke Human/ChatGPT per patch.
3. Independently critique security/data failures internally, consume GitHub automated PR review BEFORE publishing candidate, and execute targeted tests during iteration plus final fresh-state full suite. No false PASS for untested negative guards.
4. Record the read-only review's actual runtime model/effort verification, reviewed SHA, precise test provenance and explicit uncertainty. Model/sandbox smoke required before the first verdict; if unavailable, `BLOCKED_MODEL_CONFIG` and no model fallback.
5. After PASS a local integration branch can advance with verified immutable history. **No unattended merge into main** until separate trusted GitHub main protection/publisher boundary is actually verified; rulesets API previously returned none and branch-protection endpoint was inaccessible. A subagent's output alone is not tamper-resistant authorization.
6. P3 local marketplace API and P4 Vue UI code work remain conditionally predelegated only after P2 review and safe integration, still under Human product boundaries. No new ChatGPT prompt required for routine local REWORK.

## Hard stops
No actual billing/Workers Paid subscription or overage, remote Cloudflare D1/R2/Workers resource, public staging/production, real customer data, source repo writes, changed security/product acceptance or irreversible cutover without Human Gate. Strict USD 0 is NOT a requirement; this does NOT authorize spending. Runtime Watch Issue #5 remains NOT ENABLED.

Official configuration docs: https://developers.openai.com/codex/subagents and https://developers.openai.com/api/docs/models/gpt-6-luna.

## Superseding sandbox correction — 2026-10-13

The earlier claim that a standalone custom agent TOML could enforce `sandbox_mode=read-only` was INCORRECT. Codex's current docs state sandbox/approval settings are inherited from the parent. The key is removed, and for operationally separated review the supported alternative is explicit `codex exec --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only` in a separate process, as described in `.orchestration/decisions/CONTROLLER-RUNTIME-CORRECTION.md`. This is NOT native agent sandboxing or independently verified provider model identity. A4 still requires closing fresh GitHub automated P2 findings plus an actual supported reviewer run.
