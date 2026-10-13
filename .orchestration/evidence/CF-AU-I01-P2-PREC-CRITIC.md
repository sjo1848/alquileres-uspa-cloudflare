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
