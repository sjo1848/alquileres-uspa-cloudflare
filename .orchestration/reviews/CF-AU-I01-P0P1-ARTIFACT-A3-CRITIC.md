# CF-AU-I01-P0P1 — External Independent Critic on Artifact A3

Date: 2026-10-12
**Verdict: REWORK-2 — ONE bounded mutation-test robustness repair**
**Immutable Artifact A3:** `917119138433fd1f413331970fe4ccc7ce660841`
**Annotated tag:** `CF-AU-I01-P0P1-Artifact-A3` — verified to dereference to exact A3 SHA.
**Publication boundary:** `9ed93722f1fcb2f7e480f7c240c50fe30ca86dd9` — one direct descendant pinning A3 SHA, `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, event seq 19.
**PR #8:** https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8 — OPEN, NOT MERGED at review.
**Task Contract:** `.orchestration/contracts/CF-AU-I01-P0P1.md`.
**Human Gate:** NONE for the bounded test correction. **Technical Blocker:** NONE.
**Scope:** read-only/synthetic local feasibility and cost sensitivity only, NOT migration, deploy, Cloudflare account provisioning, subscription, release or product approval.

## Independently verified/accepted

1. **A2-F1 registration cost: CLOSED.** All low/base/high scenarios include nonzero `POST /auth/register` request volume (100/1,500/50,000); Worker CPU sensitivity charges a source bcryptjs cost-12 hash for each modeled registration; D1 writes count user-row and two source-derived indexes. Registration query reads are an explicit source-SQL zero with potential engine/index probe costs unresolved.
2. **A2-F2 image deletion/reorder lifecycle cost: CLOSED.** The calculator and prose model include nonzero image DELETE and PATCH reorder route volumes; split public vs ADMIN image GET with separate read factors; source image deletion reads R2 object once before free Standard DeleteObject and performs D1 metadata delete/position compaction; source reorder performs D1 batch reset and per-image position update. Verified source `apps/api/src/listings/listings.service.ts` at pinned source `267c531f...`: `removeImage` lines ~897-916, `reorderImage` lines ~919-959. Unknown D1 index/query counters, retries, compensation, bursts and DO costs are honestly described as assumptions/unresolved, not measured.
3. **Independent external recalculation:** nine 3×3 cost points match the immutable A3 JSON, including all request, D1 row-read/write, R2 Class B prefetch, Worker CPU and total arithmetic. Low/base USD 5 in all sensitivities; high USD **23.1467 / 26.8367 / 47.3367** for assumed 10/100/600 billed CPU-ms per auth operation. The 600 ms case is a *hypothetical sensitivity near Workerd wall elapsed*, not actual provider CPU metering. Official Cloudflare pricing docs inspected: Workers / D1 / R2. This is not an actual monthly forecast or a spend cap.
4. **A3 publication integrity:** annotated tag dereferences exactly to `917119138433fd1f413331970fe4ccc7ce660841`; A2 is an ancestor of A3; publication boundary is its direct child; PR #8 OPEN and unmerged; canonical PR-boundary status is `PENDING_EXTERNAL_REVIEW` and `resume_authorized=false` at event seq 19.
5. **Source/test provenance:** independently compared eight Git blob SHAs between A2 and A3: unchanged auth Worker, tests, schema, seed, Wrangler config, package.json, package-lock.json and immutable auth results. Therefore 23/23 auth checks and zero npm vulnerabilities are *inherited recorded A2 findings*, not independently rerun or newly observed by Controller. Cost-method internal critic/Integration Review and Pre-Critic are complete for research evidence.

## One remaining binding finding

### A3-F1 — [P2/QA] Image deletion prefetch mutation is a false guard for the exact missing-cost defect

File `.orchestration/evidence/fixtures/validate-i01-cost.mjs`, `deleteMutation` block near end:
```js
const deleteMutation = structuredClone(result.scenarios[0]);
deleteMutation.assumptions.imageDeleteObjectReads = 0;
deleteMutation.cpuSensitivity.forEach(point => { point.r2ClassBIncludingDeletePrefetchReads = 0; });
assert.throws(() => validateScenario(deleteMutation), /read-before-delete omitted/);
```
This is not a representative A2-F2 omission. It sets **all R2 Class B operations to zero**, dropping ordinary public/admin image GETs along with prefetch. `validateScenario()` currently checks only `point.r2ClassBIncludingDeletePrefetchReads === publicImageGet + adminImageGet + assumptions.imageDeleteObjectReads`, but **never enforces** `imageDeleteObjectReads === workers.imageDelete * 1 GetObject-before-delete`. Thus a coherent wrong model using `imageDeleteObjectReads=0` and `point.r2ClassBIncludingDeletePrefetchReads=publicImageGet+adminImageGet` passes the existing guard. This is exactly the class of omission the mutation test purports to falsify. GitHub automated Codex review independently corroborated the issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8#discussion_r4252356516.

**Required bounded fix:**
- Add a source-derived invariant: `imageDeleteObjectReads === routeDrivers.imageDelete * imageDeleteAssumptions.r2ClassBGetObjectBeforeFreeDeletePerOperation`, and separately ensure `r2ClassBGetObjectBeforeFreeDeletePerOperation === 1` for the pinned source.
- Create a *coherently wrong* negative mutant with missing delete prefetch but retained `publicImageGet + adminImageGet`; recompute dependent R2 Class B aggregate and, where needed, billing fields so the mutant only removes the delete-prefetch cost. Prove `validateScenario(mutant)` throws for the SOURCE binding, not merely because ordinary GETs were zeroed.
- Optionally use a pure generator input mutation so this test would detect a calculator implementation that drops prefetch and produces internally consistent JSON. Do not change the correct source model drivers, official rates, cost outputs or auth executable.
- Preserve the 4 existing negative test cases with realistic mutation semantics, update independent cost/QA critic and applicable validation/Integration Review/Pre-Critic to identify the corrected test and provenance. Only rerun cost validator/calc and relevant static checks; source-compatible auth and npm audit need not be rerun unless their inputs change.

## Next authorized transition

1. Codex reads this exact review from authoritative `main` and reconciles it into **the existing PR #8 without rewriting immutable A1/A2/A3 history**; no squash/rebase-away or boundary-only cherry pick.
2. Fix **A3-F1 only**. Do not open fresh cost projections, extra architectural research, functional implementation or migrations; correct the single QA protection defect in the exact validator/independent critic documents.
3. Publish immutable **Artifact A4** (with tag) and one following boundary commit pinning exact SHA. The tagged commit itself and boundary must remain `PENDING_EXTERNAL_REVIEW` / `resume_authorized=false`. Return to External Independent Critic.
4. No merge, external Cloudflare account resources, paid activity, real data, release, other Task Contract, Runtime Watch or production.

**Conclusion:** A3's quantitative cost model is mathematically sound within stated assumptions, and both original A2 cost omissions are closed. One self-described negative test is ineffective against a realistic missing-prefetch mutation and must be hardened before technical research PASS.
