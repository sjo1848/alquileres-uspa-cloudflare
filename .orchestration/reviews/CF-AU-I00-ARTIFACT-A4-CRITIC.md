# CF-AU-I00 — External Independent Critic: Artifact A4
Date: 2026-10-12
**Verdict: REWORK-3 — ONE bounded documentation/evidence-provenance repair**
**Reviewed immutable Artifact A4:** `8e707eadca25e47827b6bc81adaa4f272192af2e`
**Annotated tag:** `CF-AU-I00-Artifact-A4` (dereferences to exact A4 SHA)
**Publication boundary:** `323365c19f68200c08521f56e467bd4273cc9167` (direct A4 descendant)
**PR:** https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/6 (OPEN / NOT MERGED)
**Task Contract:** `.orchestration/contracts/CF-AU-I00.md`
**Prior REWORK-2 Critic:** `.orchestration/reviews/CF-AU-I00-ARTIFACT-A3-CRITIC.md`
**Human Gate: NONE. Blocker: NONE.** Runtime authorization restricted to this exact existing contract and one documentation correction; no new architecture/product/migration increment.

## Independent review scope
Inspected GitHub content at immutable A4, PR #6 current boundary, source of Worker/tests, run-local launcher, recorded local results, current architecture/cost/hypothesis/integration summary and independent internal technical/cost critics. Verified SHA/tag dereference, that A3 is an ancestor of A4, boundary is exactly one commit after A4, canonical review base is represented in the preserved PR merge lineage, and source repository remains read-only in reported evidence. Compared checked-in `CF-AU-I00-COST-CALCULATIONS.json` to `CF-AU-I00-REWORK2-COST-RERUN.json` **byte-for-byte**: equal (same Git blob SHA `c809eed2cbd5368fbdc357324819a55bc3e12dc2`).
This was code/evidence static inspection from GitHub; the External Critic did NOT independently rerun local Wrangler/Workerd or `npm audit`. The 17/17 and 0 vulnerability results are recorded by Codex and its internal reviewers.

## Accepted/closed A3-F1..F3 functional criteria
- **A3-F1 / enum false-PASS: CLOSED.** `assertRejectedRoleInsert()` uses `assert.rejects` with CHECK-constraint match and independently checks row absence. The same helper is used with an unconstrained mutant table; accepted `SUPERUSER` causes the rejection assertion to fail and mutant row presence is verified.
- **A3-F2 / orphan assertion: CLOSED.** Before/after R2 key and D1 metadata snapshots are compared for injected D1 insert failure; mutant `mutateNoCleanup` leaks exactly one detectable key and demonstrates the same assertion fails; a synthetic-only fixture hook cleans the orphan. This is **not** evidence for all remote/storage failure modes.
- **A3-F3 / current top-level summaries: CLOSED for architecture/cost/hypotheses/Integration Review.** Final A4 result JSON reports async 624/642 ms and sync 613 ms local elapsed, not Cloudflare production CPU metering. Current research summaries use 613 ms and preserve limitations.
- **Local fixture hardening: ACCEPTED IN SCOPE.** Tracked Wrangler config has no `LOCAL_FIXTURE_ONLY`; `run-local-fixture.mjs` rejects forwarded args and uses fixed `--local` with synthetic fixture flag. Reported negative `npm run dev -- --remote` test exits before Wrangler; direct intentional CLI override is excluded, and no remote work/deploy is claimed.
- **Research/integrity: ACCEPTED IN SCOPE.** Cost drivers include image Worker/D1/R2 path, correct D1 output and honest unmeasured scans. H1/H2/H3/H4/H6 remain UNRESOLVED; H5 remains narrowly REJECTED for source bcryptjs cost-12 Workers Free on a qualified local elapsed CPU-bound proxy. I13 Human Product Acceptance is outstanding.
- **Artifact reachability: NO NEW DEFECT**. Automated PR reviewer P1 is a conditional warning about **squash/cherry-picking ONLY boundary**. A3 is proven ancestor of A4 and A4 ancestor of PR head. Eventual integration must preserve both histories (merge with parents or fast forward); do not merge now or treat hypothetical boundary-only cherry-pick as an actual A4 artifact defect.

## Binding remaining finding
### A4-F1 — [P2/EVIDENCE] Final cost-critic follow-up still presents stale synchronous bcrypt timing as CURRENT
Path: `.orchestration/evidence/critics/research-cost-method-critic.md`, latest section `## REWORK-2 F3 / cost-file spot check — 2026-10-12` (approx. lines 182-188) **occurs AFTER** a `Final runner/config rerun check` that correctly states final 624/642 async, 613 ms sync.
The later, last section explicitly says: `The current REWORK-2 result JSON records 539 ms synchronous elapsed`. It also calls 645/552 ms async current, but the immutable A4 results JSON records 624/642 and 613. This is not marked historical despite being appended last; it therefore conflicts with the exact final evidence and the current summaries, making the current internal critique/provenance misleading.
**Bounded fix**: Correct/reorder/date/explicitly mark the obsolete follow-up as historical and superseded by the actual final runner/config rerun **624/642 / 613**. Preserve the earlier observation as history if useful but remove all false "current/final" references. Do NOT rewrite immutable A4/tag.
**Proof**: A simple static audit across all CURRENT conclusion sections (not historical run snapshots) and final JSON must identify exactly one final timing set; retain no-production-meter caveat. Independent cost-critic may verify the one-file correction. No need to rerun unchanged Worker suite or recompute unchanged costs; instead reuse their exact SHA and add `not rerun; unchanged implementation` provenance. Only rerun if any executable input changes.

## Exit criteria / next transition
1. Codex reads this review from authoritative `main`, autonomously performs **A4-F1 only** in the same existing PR #6, preserves A4 ancestry and existing `CF-AU-I00` contract.
2. Update Integration Review/Pre-Critic only if needed for accurately reflecting latest review; check doc consistency without manufacturing new code/tests or reopening other already closed findings.
3. Publish immutable **A5** with a consistent final critic report, then one boundary commit recording exact A5 SHA/tag. `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, `external_review.required=true`, event advanced. Do not amend artifacts A3/A4 or rewrite branch history.
4. Stop for External Independent Critic. **No merge**, migration, source changes, production/paid/real-data work, or Runtime Watch work in CF-AU-I00.

**Conclusion:** A4 has correctly fixed the substantive REWORK-2 test weaknesses. The only blocking discrepancy is an appended document's inaccurate final-run provenance. **NOT PASS yet**, but no new technical feasibility investigation is required.
