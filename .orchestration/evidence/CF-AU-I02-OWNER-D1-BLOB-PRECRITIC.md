# CF-AU-I02 OWNER D1 BLOB — Pre-Critic Gate

Date: 2026-10-16. Gate applies to the executable code/test tree `04951f0af13335598a1dceb6fc08ac989f251a57`, application commit `964da27fe57bbfb961618abd9b6be4fafc82b112`, and bounded Vue error-display correction `2a65ad370fef062c217332c22492a4a5cb93ad4b`. GitHub candidate head reviewed by the bot: `12cf3cf9dfcb95bd498a7557953f2fe7a625baa0` (docs/state child also follows the reviewed executable tree). Canonical base: `main@f17adae431b92a4f66aecda066947b24164eb0e2`.

## Contract and acceptance evidence

Authority: Issue #7 comment `6219058078`, which records OWNER Preview acceptance 6/6 and authorizes D1 BLOB Free photo upload/view/reorder/remove in the same private synthetic Preview, no R2.

| Requirement | Evidence / result |
|---|---|
| OWNER only, own DRAFT/REJECTED listing | Positive and cross-owner/status-denial Worker HTTP tests in `apps/worker/tests/owner-d1-blob-media.test.ts`; backend owner checks in `apps/worker/src/index.ts`. |
| Bounded, actual supported image data | 1.8 MB stream bound; full JPEG/PNG/WebP WASM decoding; Worker 307,200-pixel cap; invalid/truncated and over-limit inputs rejected before D1 mutation. Browser normalizes to JPEG <=640×480. |
| One-step D1 persistence and replay | BLOB, metadata and committed idempotency result in `D1.batch`; replay after image deletion returns the original result without recreating data. Legacy R2 rows yield explicit 409 before replay; mixed-row retries are tested. |
| D1 storage limit and image count | Migration triggers validate BLOB length and 250,000,000-byte application cap; service rejects >20 images/listing. Concurrent quota test and same-listing concurrent add/reorder/delete test verify counters, membership, bytes and dense order. |
| Public visibility and Static Assets compatibility | D1 BLOB reads are restricted to APPROVED/PUBLISHED; repository-managed Static Assets remain supported under D1_BLOB. Public/detail/asset regressions cover this. |
| OWNER UI | Vue provides upload/view/reorder/remove, normalizes accepted browser images, and gives a migration-specific message for legacy rows. Local synthetic browser verified normalized upload and read; focused HTTP tests cover final backend. |
| Focused validation | media15/15, OWNER4/4, catalog7/7, Worker typecheck, Web typecheck/build, Preview template build, audit0 vulnerabilities, Wrangler dry-run. No full suite repeated. |
| GitHub integration | Required `worker` and `web` checks passed on head `12cf3cf`. Automatic code review completed on exact head with `has_any_findings=false` and `has_unresolved_findings=false`. Historical P1/P2 threads are replied to/resolved. |
| Independent Controller | Separate GPT-6 Luna/high/read-only process returned bounded PASS on `d340e74`, reviewing the exact D1 BLOB code/test tree `04951f0`. A later one-line Vue error-mapper correction was typechecked/built and covered by GitHub review; no Worker/D1/test logic changed. Backend model identity remains unverified. |

## Invariants

| Invariant | Status | Evidence / scope |
|---|---|---|
| 1 Source repository remains read-only | PASS | Source checkout status is clean; no source writes. |
| 2 Parity-first, no silent feature expansion | PASS | Only OWNER media lifecycle and explicit existing-row conflict handling. |
| 3 OWNER isolation / ADMIN authorization backend-enforced | PASS | OWNER paths tested; ADMIN paths were not changed. |
| 4 Public catalog is truthful | PASS | Approved/published gating; mixed unsupported legacy rows fail visibly with a migration conflict. |
| 6 Image metadata/order/object integrity | PASS | D1 BLOB/trigger/ordering/idempotency tests, including same-listing races and legacy-row retries. R2 is not used. |
| 7 ADMIN audit traceability | N/A | No ADMIN operation is added or modified in this increment. |
| 8 Application auth semantics preserved | PASS | Existing auth strategy and owner identity guards are unchanged; owner/cross-owner tests pass. |
| 9 No real data, production, paid transition | PASS | Local synthetic work only; remote Preview not yet changed. |
| 10 Cost claims conditional on limits | PASS | USD 0 is conditional on Free quotas. Cloudflare provider CPU for decode is unmeasured; measure on the existing private Preview after merge before requesting photo acceptance. No provider CPU PASS is claimed. |
| 11 GitHub is canonical | PASS | Main SHA and PR head verified via GitHub; no divergent local state. |
| 13/16 Implementer does not self-approve | PASS | Separate read-only Controller PASS and separate GitHub review; evidence retains requested settings and unverified backend identity. |
| 14 Routine failures are autonomous REWORK | PASS | Decoder, race, legacy-row and response-mapping findings were fixed and revalidated. |
| 15/20 Review gate and materiality | PASS | Current exact GitHub review has no findings; Controller found no P0/P1 on the consolidated functional delivery. Prior findings are retained, not erased. |
| 21/22 Scope and Controller model | PASS | Local synthetic only; GPT-6 Luna/high/read-only explicitly requested and CLI accepted; backend identity not asserted. |

## Truthful limits and boundary

Workers Free documents 10 ms CPU per request. The browser and server dimension caps bound image work, but Node timing does not establish provider CPU. Existing Preview D1 is synthetic and has the migration in scope; no remote migration/deploy has yet occurred in this increment. After protected merge only the existing private Preview is authorized for update. No R2, new resources, billing, production, real data, source writes, or public exposure are authorized. Photo-journey Human Acceptance is still required after remote verification.

## Gate decision

**Pre-Critic PASS to protected-merge PR #14 and update only the already-authorized private synthetic Preview, conditional on the final docs-only PR head retaining green required checks, completed no-findings GitHub review, and zero unresolved conversations.** This is not a remote CPU result, photo journey acceptance, product PASS, or production approval.
