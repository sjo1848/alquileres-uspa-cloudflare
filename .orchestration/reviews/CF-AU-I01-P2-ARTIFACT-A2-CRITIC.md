# CF-AU-I01-P2 — External Independent Critic on Artifact A2

**Date:** 2026-10-13
**Verdict: REWORK-2 — ONE NEW P1 runtime consistency/availability defect in lease cleanup.**
**Immutable artifact A2:** `5d888e177d3ba7c6ecd73bb96cc70434268c2abf`.
**Annotated tag:** `CF-AU-I01-P2-Artifact-A2` — verified dereference to exact A2 SHA.
**Publication boundary:** `d5346ada61287637987c5372fe6c9e9d323de7b2` — A2 direct child, contains `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, event seq 28.
**PR #10:** https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/10 — OPEN, not merged, boundary is current PR head at review.
**Task contract:** `.orchestration/contracts/CF-AU-I01-P2.md`; implementation Issue #9, umbrella Issue #7.
**Human Gate:** NONE for this bounded P1 repair. No paid/remote/deploy/source-product activity authorized.

## Accepted evidence: A1 security tests fixed

- **A1-F1 CLOSED:** `apps/worker/tests/http.mjs` now signs a live `owner-a` JWT for `owner.a@example.test`. Active claims (`exp=now+3600`) produce HTTP 200. Same valid identity/key and expired `iat=exp=1` produce 401. Test can detect removed expiry check rather than merely missing identity.
- **A1-F2 CLOSED:** structurally correct HS256 Bearer for that same active account, but with deliberately wrong HMAC, produces 401. Same-claims active correctly signed positive control produces 200. Test can detect removed signature verification rather than malformed JSON.
- The SHA of unchanged Worker `apps/worker/src/index.ts` is `449327c60f08eb58c6838099447559d0bd658a40`, identical to A1; only JWT test and directly dependent evidence changed in this rework. Independent security QA critic examined exact checks and issued bounded PASS.
- One preliminary P2 test run was intentionally canceled after a review caught expiring 60-second positive claims in a ~10-minute full suite. It was **not counted** as PASS. Corrected 1-hour token then underwent one clean fresh-state `npm test` **reported PASS 636.4 seconds** and syntax check PASS. The two prior A1 runs (522.0s and 543.7s) remain historical evidence, not reruns. Controller reviewed GitHub code/evidence but did not rerun the Wrangler+D1+R2 suite independently.
- Tag, A1 ancestry, annotated A2 tag, and exact boundary integrity verified. PR automated review on exact A2 boundary found the additional P1 runtime issue below.
- Pending limitations remain: local Workerd tests do not prove remote Cloudflare runtime, spend/CPU, PostgreSQL advisory-lock equivalence, D1+R2 atomicity, full source parity or source I13 canonical reconciliation. A product API slice does execute locally and has substantive concurrent/negative test evidence.

## Binding finding preventing External PASS

### A2-F1 — [P1/CONSISTENCY] Awaited unlock in finally overwrites committed success/error outcome

**Code** `apps/worker/src/index.ts`, `unlock` at line ~35 and route `finally` at lines ~77 (upload), ~81 (reorder), ~119 (delete); scheduled reaper also calls unlock at ~140. `unlock` runs
```ts
await db.prepare('DELETE FROM listing_locks WHERE listing_id=? AND token=?').bind(lid,t).run();
```
and all three API routes use `finally { await unlock(...) }` without isolating or recovering from failures.

After a successful, durable D1 metadata batch and R2 put, an independent transient **D1 lock DELETE failure** from `finally` rejects the route handler promise and replaces its intended **201** response (similarly successful 200s for reorder/delete) with HTTP **500**, even though the image/object/position change is already committed. The client can retry and create a duplicate listing image or retry an already applied mutation. A left-behind lease may reject legitimate operations until its ~1-hour expiration; tests currently inject D1 mutations and R2 failures but do **not** inject lock-release-before/after failure. GitHub automated PR review independently identified it: https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/10#discussion_r4260385876.

**This is a production-relevant consistency/availability finding**, not a cosmetic P2 issue. It is present in the P2 implementation as published in A1 and unchanged A2, newly surfaced in A2's code review. It does NOT retroactively invalidate the local positive/fault suites on their actual tested paths, but it prevents unconditional P2 PASS until controlled.

**Required bounded repair (one repair package):**

1. Make lock-release failures unable to overwrite an **already committed** API result or invent a successful write on failed metadata. Preserve true state semantics: success must be based on confirmed D1/R2 commit and at-least-once retries must not silently duplicate objects. Separate main operation result from cleanup errors; no arbitrary catch-and-201 for unknown commit.
2. Provide robust, safe token-fenced unlock with bounded retry / recovery classification and structured logging that excludes PII/secrets. Consider crash/after-effect ambiguity. Address stalled lease availability so recovery does not simply wait an hour if safe to release (without violating mutual exclusion). Do not silently shorten leases if that weakens race protection or leave a background unlock that can release another request's lock.
3. In **test-only fault harness** `apps/worker/tests/fault-worker.ts` (not deployable production fault headers), inject lock-release **before-effect and after-effect** faults into D1 execution, with representative upload/DELETE/reorder successful-commit routes. Assert client receives accurate response consistent with D1/R2 final state, no duplicate on bounded retry, token fencing maintained and no hard one-hour availability stall from a transient failure. If one failure mode is inherently ambiguous, preserve state and classify/reconcile it safely; do not falsely claim perfect distributed atomicity.
4. Security/integrity independent critic must review the new failure tests against realistic mutations and failure states; refresh brief Integration Review, Pre-Critic and validation ledger. Rerun the **full local fresh-state HTTP suite once** because Worker executable/fault harness will change, plus typecheck/syntax, audit if dependencies change (else SHA provenance), and narrow failure-path tests. Do not rerun unrelated research or open new full-platform work.
5. Publish immutable **Artifact A3** with annotated tag and exact SHA-pinning PR boundary, `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`; request next External Critic. Maintain A1/A2 exact ancestry and PASS/REWORK state history on the *same PR #10*.
6. No PR merge, Cloudflare remote bindings, paid service, production, real data, source repo write, unrelated code or Runtime Watch.

## Nonblocking source compatibility note

GitHub also noted that `living-room.png` is rejected by the current image filename regex. The **pinned source's own** `listing-images.validator.ts` uses the same negated `- ` pattern, so this is **not a newly introduced migration divergence**; it is a usability limitation to track for product follow-up rather than expand this P1 repair. Any later policy relaxation should be product/source-parity approved and tested; avoid silently changing source semantics in this slice.

## Process disposition

No new Human Gate. Only A2-F1 above blocks; A1-F1/A1-F2 are fully closed. This is a genuine transaction-acknowledgment hazard, not a reason for another generic feasibility cycle. Preserve working slice and progress to broader functional module as soon as the cleanup edge is correctly tested and closed.
