# CF-AU-I00 REWORK-1 Integration Review

Date: 2026-10-12
Branch: `rework/cf-au-i00-rework-1`
Basis: canonical `main` at `452d764` and its review contract

Post-publication QA successively found stale async bcrypt timings in candidate `e367a9790070b8ecd905037c16e660d9043d8fc8`, then found that candidate A2 `1081b3a4170e84ea7cd0dc1221d6ef96e37747e1` omitted D1 lookup reads from mediated image delivery and retained an obsolete 16/16 log count. Both candidates are preserved unchanged for auditability and superseded for external review by the corrected Artifact A recorded in the current publication boundary.

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

## Final local evidence

`fixtures/rework1-tests.mjs` ran against Wrangler 4.149.0 / Workerd 1.20261006.1, compatibility date 2026-10-06, local D1 and local R2 with synthetic fixtures only. Final output: 17/17 checks passed. The result JSON records async bcrypt elapsed 513/592 ms and synchronous elapsed 539 ms. `npm audit --prefix .orchestration/evidence/fixtures --audit-level=moderate` reported 0 vulnerabilities. The reproducible cost script generated `CF-AU-I00-COST-CALCULATIONS.json` with lab/early/growth Worker totals 247/8,650/122,500 per day; growth is 22,500 over the documented daily request allowance.

## Remaining uncertainty, retained as research findings

- No source-specific Vue/Vite Static Assets build or browser smoke test (H1).
- No complete source auth flow, production CPU meter, cookie configuration matrix, logout or registration test (H2/H5 boundaries).
- No full PostgreSQL/Prisma migration, reconciliation or historical-data proof; source `pg_advisory_xact_lock` concurrency behavior remains unimplemented/unproven (H3; technical critic TSC-2/TSC-3 remain partial/open).
- Post-repair technical critique closed the synthetic session issuer trust defect, published-listing delete gate, and successful compensation byte/content-type verification. The implementation rejects a missing R2 object before D1 mutation, but no regression test injects that case. Owner management was verified only for DRAFT; REJECTED, foreign/published/missing cases remain untested. No simultaneous image mutation, maximum-count race, R2 restoration failure, failed cleanup, admin image-management, MIME/size boundary or orphan reconciliation test exists (H4; TSC-4 remains partial).
- Cost scenarios are average daily arithmetic, not peaks or forecasts; query-plan metering, exact per-route query/subrequest shape, initial R2 setup and static asset routing configuration are not measured (cost critic findings remain open/partial).

Post-repair spot checks by the independent technical and cost critics are included in their dated follow-up sections. The cost report was reconciled to the final test JSON: async bcrypt elapsed is 513/592 ms and synchronous elapsed is 539 ms. Their spot checks do not approve the overall task.

## PR review findings reconciled

The repository's automated PR review on earlier branch head `3e1c590` raised three concrete findings. The D1 cost formula now includes two row reads per mediated image GET as a minimum for the indexed image metadata row and joined listing visibility row; regenerated totals are 2,427 / 88,150 / 1,212,500 D1 reads/day, independently recomputed by the cost critic. This is not an upper bound or measured `meta.rows_read`; scans/query-plan amplification remains open. EXP-003 now records the final 17/17 result JSON. The immutable artifact is a tagged commit in the linear PR branch ancestry from `452d764`; `.orchestration/STATUS.json` records the exact commit and tag. Do not cherry-pick only the boundary commit or squash the artifact away when eventually integrating; preserve the artifact commit as reachable canonical history. No merge is authorized at this external-review boundary.

These uncertainties are represented by unresolved hypotheses and are not hidden by the 17/17 harness result. No migration implementation, real data, paid resource or production deployment was used. The completed scope remains CF-AU-I00 discovery/feasibility only.
