# CF-AU-I00 Integration Review — REWORK-1 historical record

The first review below is the immutable A3/REWORK-1 integration snapshot. Its values and publication references are historical; the current REWORK-2 integration and latest run are appended in the final section.

Date: 2026-10-12
Branch: `rework/cf-au-i00-rework-1`
Basis: canonical `main` at `452d764` and its review contract

Post-publication QA successively found stale async bcrypt timings in candidate `e367a9790070b8ecd905037c16e660d9043d8fc8`, then found that candidate A2 `1081b3a4170e84ea7cd0dc1221d6ef96e37747e1` omitted D1 lookup reads from mediated image delivery and retained an obsolete 16/16 log count. Both candidates are preserved unchanged for auditability and superseded for external review by Artifact A3, recorded in its then-current publication boundary.

## Integrated tracks and role boundaries

- Source/parity/data specialist report: `specialists/source-parity-data.md`.
- Runtime/cost specialist report: `specialists/runtime-cost.md`. It is retained as historical specialist output; its earlier direct-image and R2 arithmetic claims are superseded by the corrected model below.
- Independent technical/security/data critic: `critics/technical-security-data-critic.md`, including follow-up findings.
- Independent research/cost/method critic: `critics/research-cost-method-critic.md`, including follow-up recomputation.
- Implementer integration: this document. Neither specialist nor either critic approved their own output; external acceptance remains pending.

## Conflicts reconciled

1. **Auth session trust boundary:** the initial fixture accepted caller-supplied `{id,email,role}`. The harness now issues sessions only by looking up a seeded synthetic D1 user ID, is explicitly local-fixture-only, and revalidates user identity/role from D1 on every request. This proves selected token/cookie/guard behavior, not source login or registration parity. The password endpoint remains a bounded isolated bcrypt probe.
2. **Image route/source delivery:** cost calculations now count each public image fetch as a Worker request and R2 Class B read, matching the source API-mediated byte delivery. Direct public R2 links are not credited as parity.
3. **R2 deletion semantics:** delete now requires owner and DRAFT/REJECTED state before object access; a missing object returns 409 and retains D1 metadata; D1 delete failure attempts restoration. A local owner management read verifies restored bytes, content type and byte size without returning the object key. Published deletion denial is tested.
4. **Cost arithmetic:** the corrected script/output and the independent cost-critic recomputation agree on route counts, D1 row estimates, R2 Class A/B and storage. Class A means upload puts and 1% replacement puts; initial-load, retry, delete/reorder and burst effects remain excluded or unmeasured.
5. **Hypothesis scope:** H1, H2, H3, H4 and H6 remain `UNRESOLVED`; H5 is `REJECTED` only for the current source bcryptjs cost-12 path on Workers Free. Local synchronous Workerd elapsed time was 539 ms with a configured 10 ms CPU budget. This is a strong local CPU-bound proxy, not Cloudflare CPU telemetry, and does not resolve the full auth path.

## Final local evidence — Artifact A3 / REWORK-1 (historical)

`fixtures/rework1-tests.mjs` ran against Wrangler 4.149.0 / Workerd 1.20261006.1, compatibility date 2026-10-06, local D1 and local R2 with synthetic fixtures only. Final output: 17/17 checks passed. The result JSON records async bcrypt elapsed 513/592 ms and synchronous elapsed 539 ms. `npm audit --prefix .orchestration/evidence/fixtures --audit-level=moderate` reported 0 vulnerabilities. The reproducible cost script generated `CF-AU-I00-COST-CALCULATIONS.json` with lab/early/growth Worker totals 247/8,650/122,500 per day; growth is 22,500 over the documented daily request allowance.

## Remaining uncertainty, retained as research findings

- No source-specific Vue/Vite Static Assets build or browser smoke test (H1).
- No complete source auth flow, production CPU meter, cookie configuration matrix, logout or registration test (H2/H5 boundaries).
- No full PostgreSQL/Prisma migration, reconciliation or historical-data proof; source `pg_advisory_xact_lock` concurrency behavior remains unimplemented/unproven (H3; technical critic TSC-2/TSC-3 remain partial/open).
- Post-repair technical critique closed the synthetic session issuer trust defect, published-listing delete gate, and successful compensation byte/content-type verification. The implementation rejects a missing R2 object before D1 mutation, but no regression test injects that case. Owner management was verified only for DRAFT; REJECTED, foreign/published/missing cases remain untested. No simultaneous image mutation, maximum-count race, R2 restoration failure, failed cleanup, admin image-management, MIME/size boundary or orphan reconciliation test exists (H4; TSC-4 remains partial).
- Cost scenarios are average daily arithmetic, not peaks or forecasts; query-plan metering, exact per-route query/subrequest shape, initial R2 setup and static asset routing configuration are not measured (cost critic findings remain open/partial).

Post-repair spot checks by the independent technical and cost critics are included in their dated follow-up sections. The cost report was reconciled to the then-final REWORK-1 test JSON: async bcrypt elapsed is 513/592 ms and synchronous elapsed is 539 ms. Their spot checks do not approve the overall task.

## PR review findings reconciled

The repository's automated PR review on earlier branch head `3e1c590` raised three concrete findings. The D1 cost formula now includes two row reads per mediated image GET as a minimum for the indexed image metadata row and joined listing visibility row; regenerated totals are 2,427 / 88,150 / 1,212,500 D1 reads/day, independently recomputed by the cost critic. This is not an upper bound or measured `meta.rows_read`; scans/query-plan amplification remains open. EXP-003 now records the final 17/17 result JSON. The immutable artifact is a tagged commit in the linear PR branch ancestry from `452d764`; `.orchestration/STATUS.json` records the exact commit and tag. Do not cherry-pick only the boundary commit or squash the artifact away when eventually integrating; preserve the artifact commit as reachable canonical history. No merge is authorized at this external-review boundary.

These uncertainties are represented by unresolved hypotheses and are not hidden by the 17/17 harness result. No migration implementation, real data, paid resource or production deployment was used. The completed scope remains CF-AU-I00 discovery/feasibility only.

## REWORK-2 integration — Artifact A4 candidate

Date: 2026-10-12. Canonical review event: `origin/main` `0af0ab4fa368d8b7faf4c7b287ba0d021182bed6`; branch is based on a commit-preserving merge and retains A3 as an ancestor.

- **A3-F1 repaired:** the invalid-role test uses `assert.rejects` with a CHECK-constraint predicate and separately verifies the row is absent. A mutation creates an unconstrained table, inserts `SUPERUSER`, and proves the same helper fails with “Missing expected rejection”; the mutation row is observed before its temporary table is dropped.
- **A3-F2 repaired:** the failure test snapshots sorted R2 keys and D1 metadata rows before/after the injected D1 insert failure. Exact set equality proves compensation. A controlled `mutateNoCleanup` variant creates one orphan, asserts metadata unchanged and proves the snapshot assertion fails on the changed R2 key set; the fixture-only cleanup hook deletes that object and the baseline equality is rechecked.
- **A3-F3 reconciled:** latest REWORK-2 result is async correct/wrong elapsed 624/642 ms and sync elapsed 613 ms. Current architecture, cost, hypothesis and parity summaries use 613 ms and describe it as a local elapsed CPU-bound proxy, not Cloudflare CPU telemetry. Earlier A3 measurements remain in immutable A3 evidence.
- **Local fixture security boundary repaired:** `wrangler.jsonc` no longer contains `LOCAL_FIXTURE_ONLY` or any tracked `vars`; `.gitignore` ignores `.dev.vars`; `run-local-fixture.mjs` writes synthetic `.dev.vars` without the hook flag, rejects forwarded arguments, and launches Wrangler with fixed `--var LOCAL_FIXTURE_ONLY:true` and `--local`. The suite asserts the tracked config and `.dev.vars` lack the flag. `run-local-fixture.mjs` rejects all forwarded arguments and launches Wrangler with fixed `--local` and `--var` arguments; `npm run dev -- --remote` was explicitly attempted and exited 1 before Wrangler started. A direct deliberate Wrangler invocation with a manual remote flag override is outside this bounded proof. No remote mode or deployment was run.

Final REWORK-2 test evidence: `.orchestration/evidence/CF-AU-I00-REWORK2-TEST-RESULTS.json`, Node v24.18.0, Wrangler 4.149.0, Workerd 1.20261006.1, compatibility date 2026-10-06, local synthetic D1/R2: 17/17 passed, 0 failed. Cost calculator rerun `.orchestration/evidence/CF-AU-I00-REWORK2-COST-RERUN.json` byte-matches `CF-AU-I00-COST-CALCULATIONS.json`; `npm audit --audit-level=moderate` reports 0 vulnerabilities. No source repository changes, remote Cloudflare resources, real data, paid resources, or deployments occurred.

The two internal critics reviewed this repaired candidate independently; findings and scope limits remain in their dated follow-ups. The A3 exit criteria are met for submission to External Independent Critic, subject to exact A4 publication boundary. H1/H2/H3/H4/H6 remain UNRESOLVED and H5 remains narrowly REJECTED for the current source bcryptjs cost-12 Workers Free path. No migration increment is authorized here.

## REWORK-3 integration — Artifact A5 candidate (A4-F1 evidence provenance only)

Canonical event: Artifact A4 review from `main` `cbd521f940722ba2ab108c9d0d2c50cf4e9d3ff0` (integrated in merge commit `4dbfd52`; A4/A3 ancestry remains intact).

- **A4-F1 repaired:** the trailing section in `critics/research-cost-method-critic.md` now explicitly withdraws its 539 ms sync / 645/552 ms async claims as current A4 evidence and identifies the paragraph as a superseded, misattributed intermediate note. The immediately prior final-run section and the correction state the A4 JSON values: async 624/642 ms, sync 613 ms. The local elapsed-proxy/no Cloudflare CPU telemetry caveat remains.
- The original note's calculator verification is not invalidated; its cost conclusion is already corroborated by the exact byte-identical calculation/rerun JSON recorded in Artifact A4. No calculator formulas, code, tests, dependencies or result files changed.
- Per the external critic's bounded exit criteria, the Worker suite, cost script and npm audit were not rerun for this documentation-only correction. Their exact unchanged A4 provenance is referenced in the REWORK-3 Pre-Critic Gate; no new execution result is claimed.
- No additional scope, implementation, source change, migration, remote Cloudflare activity, paid resource, production or real data was introduced. Existing I00 hypotheses and residual limitations remain unchanged.

The independent internal cost-document critic checked the corrected section against A4's immutable test JSON; the result is persisted in `critics/a5-cost-provenance-critic.md`. This is a narrow evidence integration check, not overall I00 approval or External Independent Critic acceptance.
