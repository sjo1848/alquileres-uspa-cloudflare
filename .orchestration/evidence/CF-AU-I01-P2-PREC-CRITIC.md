# CF-AU-I01-P2 Pre-Critic Gate — REWORK-3 candidate

Date: 2026-10-13. Scope: P2 mutation acknowledgment, retry, compensation and recovery defect family. This gate is for publication to the configured delegated Controller review only; it is not an external or product PASS.

## Authorization and boundaries

- Canonical `main` event seq 33 delegates local/synthetic technical review to `.codex/agents/project-controller.toml` (`gpt-6-luna`, `high`, `read-only`) following the runtime smoke. The recorded source policy is `.orchestration/decisions/DELEGATED-CONTROLLER-GPT6-LUNA-HIGH.md`.
- Existing P2 REWORK-3 authorization and contract remain the only functional scope. No source repository writes, remote Cloudflare resources, billing, deployment, real data, merge, or next task.
- A1–A3 history and tags remain preserved; the final candidate is on PR #10 and has latest canonical main as an ancestor.

## Evidence and checks

- Implementation/recovery semantics: `apps/worker/src/index.ts`, `apps/worker/migrations/0002_idempotency.sql`, `apps/worker/docs/mutation-retry-semantics.md`, `apps/worker/tests/fault-worker.ts`, and `apps/worker/tests/http.mjs`.
- Final commands and exact clean full-suite output: `CF-AU-I01-P2-VALIDATION.md`. Typecheck, test syntax, diff whitespace and fresh local HTTP suite all passed; earlier unsuccessful REWORK-3 suite attempts are excluded and disclosed.
- Independent security/integrity critique: `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`; final post-fix reviewer found no concrete P0/P1 or material blocker.
- GitHub automatic review: PR #10 at `976a670340cc931898492a591c7b066ccdc9a516` completed without code suggestions. Review evidence is recorded in the validation ledger.
- Integration Review and invariant matrix: `CF-AU-I01-P2-INTEGRATION-REVIEW.md` and `CF-AU-I01-P2-INVARIANTS.md` reconcile D1/R2 state, HTTP acknowledgment, retry identity, cleanup, and recovery limits.
- Runtime model availability/config and read-only smoke are recorded by the orchestrator; the Controller verdict on the eventual exact artifact remains pending and must not be inferred from smoke evidence.

## Limits

This candidate proves only the bounded synthetic local P2 behavior exercised by its tests. It does not prove arbitrary crash atomicity across D1/R2, remote Cloudflare behavior, PostgreSQL advisory-lock equivalence, complete product parity, or production readiness. Documented divergences remain explicit.

## Disposition

**PRE-CRITIC GATE: PASS to freeze one immutable P2 candidate for delegated `project_controller` review only.** Do not claim a substantive PASS until that independent read-only review audits the exact artifact. If it returns REWORK, resolve the bounded finding and rerun affected checks before freezing the final candidate. After a Controller PASS, publish the exact immutable tag and SHA-pinning boundary, then stop at the required external-review boundary; do not merge or begin another task.

## Post-review rework addendum — latest candidate not yet clear to freeze

GitHub automatic review on `d4445c2` found a committed reorder replay/cardinality ordering defect. Repair plus a real reorder/delete/replay regression test landed in `a7cbd8087576c3229267c5d60c2326eb0e08ceb2`. Independent security/integrity critique then found and closed a P1 in no-op reorder acknowledgment: 200 now requires the fenced idempotency commit or exact readback, otherwise 503. The before/after fault cases and strengthened suite are recorded in the validation ledger; both internal re-critiques found no remaining P0/P1.

Final code/test evidence: typecheck, HTTP test syntax, and whitespace checks PASS; full clean local Wrangler HTTP suite PASS 891.9 seconds. A new GitHub automatic review is pending on exact code commit `a7cbd80`. The configured delegated Controller reviewed only earlier `d4445c2` and returned `BLOCKED_MODEL_CONFIG` because named-agent invocation and backend runtime identity were not verifiable. Accordingly, the older gate decision to freeze is superseded: **do not publish A4 yet**. Process GitHub review on `a7cbd808...`, verify a supported read-only `project_controller` invocation/runtime, then obtain a non-blocked exact-SHA review. Only a technical Controller PASS clears the publication gate; a subsequent external-review boundary is still required.

### Latest DELETE dense-order rework (code commit `37e9860`)

Automatic review on `a7cbd80` found P1 sparse-order acknowledgment and P2 R2 access on confirmed replay. Internal critique exposed stale COMMITTED markers when both compaction and repair-marker writes are ignored. These paths now fail closed until exact dense D1 order is verified, confirmed replay avoids R2 only after that check, and scheduled recovery plus same-key retry is exercised. The full suite after the final code changes passed at 828.8 s; typecheck, syntax and diff whitespace checks passed. Internal independent critics found no remaining P0/P1. Fresh GitHub review is requested for exact code commit `37e9860170e0958e4ab5b9bfef0e8b82f2e2bad1` and is not yet recorded here. The delegated named-agent/runtime block remains. Therefore **do not publish Artifact A4 yet**; resolve the exact-SHA review and Controller runtime before publication.

## cdb8970 exact review update — 2026-10-14

GitHub automatic review of exact candidate `cdb8970ce06fb03d841bd9b2ba32769d78c5629e` completed at `2026-10-14T15:11:59Z` without new suggestions. The documented separate `project_controller` CLI invocation was attempted twice with `gpt-6-luna`, HIGH effort and `--sandbox read-only`; both attempts failed before initialization because the app-server could not initialize on the read-only filesystem. The reviewer process therefore did not inspect code, issue a verdict, or establish actual model/sandbox runtime evidence. This is `BLOCKED_MODEL_CONFIG`, not a code PASS. The earlier freeze-only PASS is not sufficient for A4: **do not tag or publish A4**. Exact next action: rerun the same project_controller review on `cdb8970` in a runtime where CLI initialization works while retaining the requested read-only sandbox. See `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md` and `STATUS.json`.


### Controller completed static audit — blocked model evidence (2026-10-14)

The separate Controller process inspected exact candidate `cdb8970` and found no P0/P1 in its bounded static audit, but returned `BLOCKED_MODEL_CONFIG` because actual model/backend identity could not be verified. The read-only CLI/workspace profile was evidenced; model backend identity was not. Therefore the prior freeze-only Pre-Critic does not authorize A4. Exact next action is to obtain verifiable GPT-6 Luna/HIGH runtime evidence in a read-only process and repeat the exact-SHA review. See `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`.


### Controller PASS with verified runtime configuration — exact code SHA `cdb8970`

The latest separate project_controller process returned PASS on exact candidate `cdb8970ce06fb03d841bd9b2ba32769d78c5629e` against canonical main `91db05fb343d0bc020335bfc05790a2f3f824b82`, with no P0/P1. Local Codex `turn_context` verifies model `gpt-6-luna`, effort `high`, and read-only sandbox; provider/backend identity has no cryptographic attestation and remains unverified. The reviewer verified matching tested Worker-tree hashes and relied on ledgered local synthetic tests without rerunning them. This supersedes the earlier BLOCKED attempt. Artifact A4 still requires a final evidence-updated exact-SHA candidate review, clean GitHub automated review, and refreshed Pre-Critic before tagging. Full Controller evidence is in `critics/CF-AU-I01-P2-CONTROLLER-RUNTIME-CDB8970.md`.

### Superseding rework gate — findings from exact `30c126e`

GitHub automatic review identified two new P2 gaps on `30c126e`: recovery logs included caller-controlled idempotency keys, and retired recovery could leave a NULL result row permanently unreplayable. Both are repaired. Independent auth/runtime and D1/R2 recovery critiques found no residual P0/P1/P2. The current full test suite passed from fresh local synthetic Wrangler D1/R2 state (1366.7s), with typecheck, both syntax checks, focused retry and diff check passing. Therefore the pre-critic checklist is complete **to submit the evidence candidate** for fresh automatic review and exact-SHA `project_controller` review. Do not tag A4 yet: Controller must issue a technical PASS on the final exact SHA, then publish the immutable A4 and SHA-pinning review boundary. Provider/backend cryptographic identity remains unverified even though the prior Controller session's turn context verified requested model, effort and read-only sandbox; record the new run's metadata honestly.

### Pre-Critic status after ignored-write and sparse ADD findings (2026-10-14)

Local implementation and tests now cover exact ADD commit ordering, interrupted sparse-order repair, same-key replay, and scheduled convergence, in addition to guarded DELETE confirmation and R2 compensation. Internal independent saga and concurrency re-critiques found no actionable P0/P1/P2. The fresh local synthetic `npm test` suite passed in 1188.1s; typecheck, syntax, whitespace, and focused retry checks also passed. Prior failed runs are explicitly excluded in the validation ledger.

This Pre-Critic entry is **not a publication PASS**: the evidence candidate has not yet been committed/pushed and requires a fresh GitHub automatic review and an exact-SHA separate `project_controller` run invoked with GPT-6 Luna, High reasoning, read-only. Publish A4 only after both reviews pass and their runtime/evidence provenance is recorded.
