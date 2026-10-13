# CF-AU-I01-P2 — External Independent Critic on Artifact A3

Date: 2026-10-13
**Verdict: REWORK-3 — coherent image-operation acknowledgment/integrity review, not one micro-fix.**
**Exact immutable Artifact A3:** `8e5b67668686f8543a8facc632d53f4535837c3c`
**Annotated tag:** `CF-AU-I01-P2-Artifact-A3`; independently verified dereference to exact A3.
**Publication boundary:** `dceff5071a8be19acfc3a423a601f8b98e025264`, direct child, `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, seq 31.
**PR #10:** https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/10 — OPEN/unmerged, head exactly boundary at review.
**Prior verdict:** `.orchestration/reviews/CF-AU-I01-P2-ARTIFACT-A2-CRITIC.md` (REWORK-2).
**Delegated operating policy:** `.orchestration/decisions/AUTONOMOUS-LOCAL-DELIVERY-TRAIN-V1.md`.
**Human Gate:** none for local synthetic repair. **Technical blocker:** none demonstrated.

## Accepted A3 evidence and closure

- **A2-F1 (unlock overwriting confirmed response): CLOSED within tested scope.** Examined actual code in `apps/worker/src/index.ts`: token-fenced DELETE retries, checks current token, and token-fenced safe expiry fallback; cleanup exceptions contained instead of replacing successful 201/200. Both pre-effect and post-effect fault paths are injected by test-only D1 proxy, with outcomes asserted for image upload, reorder and DELETE.
- Controller inspected actual Worker, test-only fault proxy, suite, independent integrity critic, Pre-Critic and validation ledger on exact A3 commit. Final fresh local Wrangler Worker/D1/R2 full HTTP suite **recorded PASS 562.5 seconds** after explicitly disclosed interrupted and failed attempts; typecheck, JS syntax and git whitespace checks recorded PASS. These are committed executor results, not independently re-executed by Controller.
- Independent internal integrity critic issued scoped PASS and acknowledged **no replacement-token race was injected**; both lock cleanup statements are token-fenced. This remains a stated *limit*, not blanket multi-instance-proof.
- The earlier A1 JWT test findings remain closed: real seeded owner, valid signing positive, expired negative, well-formed wrong-HMAC negative. No auth scope rewrite.
- A3 tag, A1/A2 ancestry, PR boundary and required stop posture are consistent. No paid/remote/source/release action observed in the audited artifact.

## New binding P1 finding — confirmed delete acknowledged as failed if postcommit backup cleanup fails

**A3-F1 [P1/consistency]:** `apps/worker/src/index.ts` in the `DELETE /listings/:id/images/:imageId` handler around lines 125-141, after R2 original object is deleted and D1 metadata/position batch has committed:
```ts
try {
  await c.env.IMAGES.delete(backup);
  await c.env.DB.prepare("UPDATE image_operations SET state='CLEANED',updated_at=? WHERE id=?").bind(now(),op).run();
} catch {
  await c.env.DB.prepare("UPDATE image_operations SET state='CLEANUP_PENDING',updated_at=? WHERE id=?").bind(now(),op).run();
  return c.json({error:'image cleanup pending'},503);
}
```
The **logical delete is already durable** and image returns 404 on subsequent reads, but a transient cleanup failure yields 503, inducing a retry/ambiguity while there is nothing left to delete. The suite currently **asserts 503** as desired behavior for `x-local-fault: delete-backup-before`. That expectation confirms the bug instead of falsifying it. The same branch occurs after a D1 batch exception when a read-back shows deletion committed (around lines 125-128). GitHub automated review independently confirmed the issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/10#discussion_r4261048970.

**Required fix:** once the effective delete is confirmed committed (D1 row gone and R2 original gone), return the source-success result (200 empty body for this bounded slice), with backup cleanup **deferred durably** through `CLEANUP_PENDING`/reconciliation. Failure to persist cleanup intent after a confirmed operation needs a clearly safe repair/observability path; do not silently claim cleanup complete. If the commit outcome is genuinely unknown, preserve explicit ambiguity and safe recovery, not unconditional success. Do not let an after-effect failure fabricate a failed client result.

## Autonomous bounded rework mandate (User-requested fewer round trips)

Rather than creating yet another one-line fix and asking for review, **Codex owns the whole postcommit-acknowledgment fault class across P2 routes** within original local-only contract:
1. Audit all image create/reorder/delete response branches, before/after-effect D1 and R2 failures, lock release and compensation/cleanup; identify any branch where *confirmed durable logical success* is returned as an error, or *unconfirmed failure* as a success. Include create-listing acknowledgment as a scoped check if related; do not rewrite auth/product scope.
2. Separate logical-operation commit from best-effort cleanup; use bounded retry, token fencing, durable operation ledger and idempotent retry behavior where necessary. Do not assert distributed atomicity. Keep source API status/body parity for chosen supported routes or document explicit divergence.
3. Replace bad test assertions with **causally isolated positive and negative controls** for precommit/postcommit faults, and assert API response, D1 rows/order, actual R2 bytes, operation states, retry/replay result, no orphan/duplicate. Add source-derived invariant-based negative mutation as appropriate. Test realistic failures rather than just HTTP code.
4. Allow Codex to execute as many small internal commits, local iterations, independent security+integrity critiques, and automated GitHub PR reviews as required **without Controller/Human interaction**. Request a candidate review early enough that new automated P0/P1 findings are resolved **before** the next immutable artifact. Classify P2 style/legacy filename regex as follow-up, not gate.
5. Once **all relevant P0/P1** are closed and full fresh-state Worker/D1/R2 HTTP suite, static tests, Pre-Critic, independent critics and accurate evidence PASS, publish exactly ONE new immutable `CF-AU-I01-P2-Artifact-A4` (or next artifact name after any internal branch numbering) on SAME PR #10 preserving A1–A3 ancestry, with SHA-pinning boundary and `PENDING_EXTERNAL_REVIEW` / `resume_authorized=false`. STOP for external review. No repeated external requests for intermediate internal fixes.
6. If a genuine material architecture/product tradeoff or unrecoverable blocker emerges, stop with `HUMAN_GATE` or `BLOCKED` classified by risk; do not relax security/consistency properties to claim PASS.

## Full-program forward delegation

User requested more independent delivery. `.orchestration/decisions/AUTONOMOUS-LOCAL-DELIVERY-TRAIN-V1.md` authorizes Codex to **plan local subsequent marketplace slices** and, after an actual external P2 PASS and deterministic integration, execute bounded subsequent local source-parity development on isolated work branches **without asking for a fresh Controller contract per small increment**. External independent review is retained at substantive release checkpoints, not each internal commit. No automation/scheduler is activated by this policy alone.

## Exclusions

No merge PR #10 before external PASS; no paid/remote Cloudflare resources, production/staging deployment, real data, source repository writes, Runtime Watch activation, unrelated service integrations or weakening auth. **REWORK-3 is not a criticism of already demonstrated local image functionality**; it protects correctness of client-visible acknowledgments under a newly identified failure mode.
