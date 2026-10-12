# Independent research, cost and method critic — CF-AU-I00 REWORK-1

**Role:** internal falsification critic for `.orchestration/evidence/specialists/runtime-cost.md`.
**Independence:** this review did not author or modify the specialist report. It is not an External Independent Critic verdict and does not approve the task.
**Review date:** 2026-10-12.
**Scope:** official limit freshness, arithmetic and workload assumptions, research classifications, source-parity cross-checks, and Pre-Critic readiness.

## Conclusion

**REWORK REQUIRED.** The official Workers, D1 and R2 headline quotas checked here match the cited Cloudflare documentation observed on 2026-10-12. However, the published R2 Class A and Class B scenario arithmetic is internally inconsistent, and the headroom table materially overstates remaining R2 capacity. R2 delivery assumptions also conflict with the independently inventoried source behavior (application-mediated image delivery). These defects invalidate the current claim that every workload scenario fits the modeled quotas with the displayed headroom. The report correctly leaves actual auth CPU and workload measurements unresolved, but the H5 conclusion should remain `UNRESOLVED`, not be presented as a supported cost-zero hypothesis. This evidence is not ready to support Pre-Critic PASS until repaired and integrated.

## Evidence checked

- Specialist report: `.orchestration/evidence/specialists/runtime-cost.md`.
- Active contract: `.orchestration/contracts/CF-AU-I00.md`; required route/data-driver model, current official limits, explicit hypothesis verdicts, and method/evidence exit criteria.
- Binding critic findings: `.orchestration/reviews/CF-AU-I00-REWORK-1.md`, especially items 5–7 and exit criteria.
- Cost model requirements and previous baseline: `docs/research/COST-ZERO-MODEL.md`.
- Source behavior cross-check: `.orchestration/evidence/specialists/source-parity-data.md`, which finds source public image bytes are served through the application API and flags direct public object URLs as a parity/security change.
- Invariants and gate: `.orchestration/INVARIANTS.md` and `.orchestration/PRECRITIC-GATE.md`.
- Reopened official primary documentation on 2026-10-12: Workers [limits](https://developers.cloudflare.com/workers/platform/limits/) and [pricing](https://developers.cloudflare.com/workers/platform/pricing/); D1 [pricing](https://developers.cloudflare.com/d1/platform/pricing/), [limits](https://developers.cloudflare.com/d1/platform/limits/), and [Free-limit enforcement changelog](https://developers.cloudflare.com/changelog/product/d1/); R2 [pricing](https://developers.cloudflare.com/r2/pricing/).

The official docs support the report's headline numbers: Workers Free 100,000 requests/day, 10 ms CPU/invocation, 128 MB memory and 50 subrequests/request; D1 Free 5 million rows read/day, 100,000 rows written/day, 5 GB account storage, 500 MB/database and 50 D1 queries/invocation; R2 Standard Free 10 GB-month, 1 million Class A/month and 10 million Class B/month, with no egress charge. The D1 changelog confirms daily read/write limit enforcement began 2026-09-01. Workers Limits was last updated Oct 8, 2026. These checks validate headline limits only; they do not validate the scenario math or app-specific costs.

## Findings requiring repair

### 1. R2 Class B reads are miscalculated

The report defines monthly Class B reads as `30 * (catalog/day * 1 + detail/day * 3)`, but its scenario table does not follow that formula:

| Scenario | Formula result | Reported scenario value | Correct remaining headroom |
|---|---:|---:|---:|
| Lab/demo | 4,200 | 4,200 | 99.958% |
| Early adoption | 150,000 | 270,000 | 98.5% |
| Growth probe | 2,100,000 | 2,250,000 | 79% |

The headroom table gives 97.3% for early adoption, which corresponds to its incorrect 270,000 value, and 77.5% for growth, also derived from an inconsistent number. Recompute the scenario values from the stated formula and propagate them through every table and conclusion. If another multiplier (e.g. detail image fanout) is intended, state and consistently apply it.

### 2. R2 Class A use and headroom contradict the scenario definition

The scenario table defines modeled Class A use as one put per listed image plus 1% replacement puts: 101, 2,020 and 8,080. The headroom table instead reports 1,030, 2,600 and 10,400. Under the stated values, remaining monthly headroom is 99.9899%, 99.798% and 99.192%, respectively. The lab value is off by roughly 10x; the other two values also have no derivation in the report.

Clarify whether image puts describe initial population during a one-time setup month or recurring uploads every month. The narrative currently calls them a conservative initial-fill/monthly-inventory assumption, which conflates two distinct periods. Show initial-load use separately from a recurring replacement/upload rate. Include the operations actually expected from the selected API design (e.g. reads/HEADs, list operations, multipart uploads/retries if applicable), or explicitly justify their exclusion. Do not present unmodeled lifecycle operations as headroom.

### 3. The image delivery cost model conflicts with source parity

The specialist model counts public image GETs as direct R2 Class B operations separate from API Worker requests and suggests a public cached bucket. The source/parity specialist reports that public image bytes are currently served through the application API, and that a public bucket/stable unauthenticated URL changes the auth/cache boundary unless equivalence is proven.

This is a cross-track contract mismatch. Reconcile the image request path with the source behavior before using it in cost conclusions. Model Worker invocations and CPU/subrequests when the application proxies image bytes; distinguish bucket-origin R2 operations from browser/CDN cache hits; and preserve public/private authorization semantics. A direct public bucket path may appear only as an explicitly unresolved alternative, not as the baseline parity-preserving assumption.

### 4. “Growth threshold probe” is not shown to be a threshold

The growth scenario uses 52,500 API Worker requests/day, 1,072,500 D1 reads/day, 3,250 writes/day, 2.1 million Class B operations/month after correction, and 3.2 GB of 10 GB R2 storage. On the report's own assumptions it remains below every modeled numeric quota. The title “Growth threshold probe” and the discussion of a threshold are therefore unsupported by these drivers. Either relabel it as an illustrative growth scenario, or derive a separate threshold/crossover workload and show which quota is reached first (including request peaks, route mix, image delivery path, data retention and CPU constraint).

### 5. Headroom is not a substitute for threshold and peak analysis

The table models daily totals against daily limits and monthly totals against monthly limits, but gives no peak/concentration assumptions. Daily aggregate fits do not establish that traffic bursts, a single high-scan query, or a login burst fit. The report acknowledges that CPU is per invocation, but the growth scenario also needs route-level per-invocation query/subrequest and image fanout constraints. State the modeled unit and whether assumptions are averages, maxima or a daily distribution; avoid implying operational safety from aggregate totals.

### 6. H5 must remain unresolved at this stage

The report's conclusion is properly cautious about the real application, but the phrase “conditional `SUPPORTED` only for arithmetic feasibility” risks promoting an arithmetic exercise into support for contract hypothesis H5 (lab and plausible early low-traffic operation at USD 0). The scenario inputs are unvalidated planning assumptions, source public-image delivery is not reconciled, and source-compatible password verification CPU remains unmeasured. Preserve the useful narrow result as a subclaim (the corrected illustrative quotas can be arithmetically below Free limits), while assigning **H5 `UNRESOLVED`** until workload and auth evidence exist. Avoid claiming “early operation” is supported based on placeholder counts.

## Additional omissions / evidence quality

- The report's D1 route costs are transparent assumptions, which is useful, but the 30/8/20/1/1 scanned-row estimates are not tied to concrete source routes, SQL predicates, indexes, `EXPLAIN QUERY PLAN`, or measured D1 `meta.rows_read`. Add a route-to-query driver map and label each row estimate as measured, bounded, or speculative. The contract explicitly asks for rows read on high-frequency routes.
- Login is modeled as one D1 read and one D1 write each time. The source behavior described by the parity specialist reloads the user from D1 on every authenticated request; if a login includes any post-credential lookup or state/audit write, document exactly what operation the count means. Include per-route reads/writes for all state changes, not just the aggregate formula.
- The DB-size estimate is a plausible placeholder, not evidence of “realistic” listing/contact counts. The model itself says retention and record sizes remain unresolved. Keep this caveat attached to any claim about 500 MB headroom; show sensitivity to audit/contact retention and indexes.
- The report uses broad “auth CPU at source hash's actual cost/parameters” language without naming source bcryptjs cost 12. The cross-track source report has that exact fact. Cross-link the immutable/pinned source evidence and state that Web Crypto primitives do not implement bcrypt compatibility. A local Workers proof and CPU measurement, or explicit `UNRESOLVED` finding, is still required by the external REWORK.
- Verify the claim “R2 lifecycle consistency is not provided as a cross-service D1+R2 transaction by the cited docs” with a direct primary source or mark it as an architectural inference. The compensation sequence is sound as a recommendation but does not prove implementation feasibility or successful recovery.
- R2 operation assumptions should clarify that Standard storage's 10 GB-month is an averaged billing metric and object size figures are decimal MB/GB versus GiB where applicable. The report correctly notes billing-unit rounding, so report headroom conservatively and do not plan to use all nominal quota.
- Current official docs were verified as of the date above; keep that date attached to the limits table and revalidate before any deployment or cost decision. The `docs/research/COST-ZERO-MODEL.md` baseline says 2026-08-26, so either update it in the integration or make the newer date and source set explicit in the final canonical evidence package.

## Required bounded REWORK from this critique

1. Correct R2 Class A and Class B values and headroom in a reproducible calculation; add a small script/notebook or a fully auditable formula table and independently recalculate the outputs.
2. Separate one-time object population from recurring monthly object updates; state omitted R2 calls and why they are absent.
3. Resolve the source image delivery cross-track contradiction by using the parity-preserving API-mediated route in the baseline model, or leave the alternative explicitly unresolved and do not count it as proof of parity.
4. Rename or substantiate the growth “threshold” scenario; define which limit is being approached and include a separate bounded workload that demonstrates that threshold without paid services.
5. Map route labels to source routes/query shapes and record read/write assumptions, or preserve them as speculative values and avoid app-specific forecast claims. Keep D1 observed metering separate from SQL result cardinality.
6. Reclassify H5 as `UNRESOLVED` while source-compatible bcrypt cost-12 CPU and a parity-consistent workload remain unmeasured. The arithmetic subclaim may be described separately.
7. Add an integration note showing cross-track alignment on auth, R2 authorization/delivery and row metering; rerun the Pre-Critic checklist against the resulting final artifact and its exact immutable SHA. This critic report itself cannot supply that integration or gate result.

## Unresolved items

- Whether source bcryptjs cost 12 can be supported safely below Workers Free's per-invocation CPU cap; only a representative Workers runtime measurement can resolve it.
- Which source API routes and SQL query plans correspond to the scenario categories, and the D1 metered row counts for those queries.
- Whether preserving API-mediated image delivery stays within Worker request/CPU/subrequest limits with realistic cache behavior.
- Actual object replacement, deletion, retry and compensation operation rates; actual retention-driven database growth.
- Whether the selected workload is plausible for the intended lab/early-use phase; no observed traffic data is present and must not be inferred.
- Whether any current docs or plan terms change after 2026-10-12; no future billing decision is supported by this snapshot.

## Method boundary

This is a falsification record, not a `PASS`, Product Acceptance, Human Gate, or External Independent Critic verdict. The findings are routine bounded REWORK under the existing I00 contract. The candidate cannot clear the research/method portion of Pre-Critic while the arithmetic and source-parity mismatch remain unresolved.

## REWORK follow-up — updated model and local Worker evidence

**Follow-up date:** 2026-10-12. I inspected the revised `docs/research/COST-ZERO-MODEL.md`, `.orchestration/evidence/fixtures/calculate-cost.mjs`, `.orchestration/evidence/CF-AU-I00-COST-CALCULATIONS.json`, `docs/research/HYPOTHESES.md`, and `.orchestration/evidence/CF-AU-I00-REWORK1-TEST-RESULTS.json`. I independently recalculated the route totals and quota percentages below; running the supplied script also reproduced its JSON outputs.

This follow-up supersedes the initial conclusion above only for the repaired R2 arithmetic/headroom and the image-path mismatch: those findings are now closed in the updated cost model. The earlier review remains the record of the defects and why they were returned for REWORK.

### Prior findings disposition

| Prior finding | Status | Follow-up assessment |
|---|---|---|
| R2 Class B scenario arithmetic/headroom inconsistent | **CLOSED** | Recalculation now agrees: 4,200 / 150,000 / 2,100,000 per month, with 99.958% / 98.5% / 79% headroom. |
| R2 Class A scenario/headroom inconsistent; setup vs recurring unclear | **PARTIAL** | The computed values now agree with 30-day recurring upload assumptions: 31 / 909 / 11,363; headroom 99.9969% / 99.9091% / 98.8637%. The model labels these as one put per image mutation/day plus 1% replacement, but “image mutation” still needs to mean an upload/put specifically. Deletes, reorders, retries and other bucket calls are not quantified. Initial-load use remains a separate setup period and is not calculated. |
| Public image cost path conflicted with source delivery parity | **CLOSED** | The revised baseline says every image GET is API-mediated, adds those invocations to Workers requests and uses R2 Class B GETs for the same image count. This now agrees with source-parity evidence. Actual cache/routing configuration remains unproven, so these remain conservative planning assumptions. |
| “Growth threshold probe” mislabeled below quotas | **CLOSED** | It is now “growth crossover”; after adding mediated image requests it exceeds Workers Free by 22,500 requests/day (122,500 total vs 100,000). This is an illustrative crossover scenario, not evidence that the assumed demand is plausible. |
| Daily/monthly aggregate headroom lacked peaks and request-shape bounds | **OPEN** | The model clearly labels drivers as illustrative daily averages and says bursts, query-plan rows, cache hits and write amplification are unmeasured. No peak/concentration scenario or per-request D1 query/subrequest count was added. A daily average is not an operational bound. |
| H5 needed a truthful verdict pending workload/auth evidence | **PARTIAL** | H5 is now `REJECTED` for the current source-compatible bcryptjs cost-12 path on Workers Free, based on a very large local synchronous elapsed-time result. This is a defensible, narrowly qualified falsification, not direct proof from Cloudflare CPU telemetry. The exact production CPU measurement and broader plausible-early-workload forecast remain unobserved; keep those limits explicit and do not generalize the rejection to future parity-preserving alternatives. |
| Route-to-query mapping and measured D1 usage were absent | **PARTIAL** | The revised report names route families and has explicit row assumptions, but it does not list concrete source endpoint paths for every family, their SQL/filter/index shapes, query count per invocation, or measured D1 `meta.rows_read`/`rows_written`. The factors 30/8/20/1/1 and writes 2/1/2 are still speculative. |
| DB size/retention treated as realistic | **PARTIAL** | Record counts/sizes and the 2× factor are explicitly described as assumptions, which fixes the overstatement risk. Retention sensitivity and realistic distribution remain unresolved. Arithmetic (159.6 MB raw, 319.2 MB planned, 180.8 MB nominal per-DB remainder) is consistent. |
| Auth hash/cost and primitive-vs-compatibility gap | **PARTIAL** | The revised report names source bcryptjs cost 12 and marks JWT/cookie/role checks separately. It still must not characterize local elapsed time as Cloudflare CPU telemetry. JWT checks cover selected cases and do not resolve all source cookie configuration/parity tests. |

### Independent arithmetic

Using the documented assumptions (API = catalog + detail + owner/admin + login + contact; image GETs/day = catalog + 3 × detail; total Worker = API + image GETs; D1 read = 30 × catalog + 8 × detail + 20 × owner/admin + login + contact; D1 write = 2 × edits + contacts + 2 × image uploads; R2 A = ceil(30 × uploads/day × 1.01); R2 B = 30 × image GETs/day; storage = images × 0.4 MB / 1,000), I obtain:

| Scenario | API Worker/day | mediated image Worker/day | total Worker/day (headroom) | D1 reads/day (headroom) | D1 writes/day (headroom) | R2 A/month (headroom) | R2 B/month (headroom) | R2 GB-month (headroom) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Lab/demo | 107 | 140 | 247 (99.753%) | 2,147 (99.95706%) | 6 (99.994%) | 31 (99.9969%) | 4,200 (99.958%) | 0.04 (99.6%) |
| Early adoption | 3,650 | 5,000 | 8,650 (91.35%) | 78,150 (98.437%) | 170 (99.83%) | 909 (99.9091%) | 150,000 (98.5%) | 0.8 (92%) |
| Growth crossover | 52,500 | 70,000 | 122,500 (**−22.5%; 22,500 over**) | 1,072,500 (78.55%) | 2,000 (98%) | 11,363 (98.8637%) | 2,100,000 (79%) | 3.2 (68%) |

The JSON and script match these computations, including DB sizing. The model’s quota arithmetic is now internally consistent. These are still outputs of assumed drivers, not observed demand or D1 metering. In particular, counting 3 images for every detail and 1 image for every catalog request assumes every page response causes those uncached image GETs; it is useful as a conservative request-count case, not a measured client behavior.

### Auth CPU interpretation

The latest test JSON records async correct/wrong password compare elapsed times of 555/536 ms and synchronous compare elapsed time of 521 ms for `bcryptjs@3.0.2`, with `cpu_ms: 10` configured in `wrangler.jsonc`. The experiment log explicitly says local Wrangler/Workerd did **not** enforce or expose Cloudflare’s production CPU meter. `performance.now()` elapsed time from a synchronous, CPU-bound comparison with no I/O is strong evidence that the current password-verification path is grossly over the Free budget; 521 ms is about 52× the documented 10 ms threshold. It is not an actual production CPU-meter reading, and the single recorded timing is not a cold/warm distribution.

Therefore the registry’s `H5: REJECTED` is acceptable only with the exact scope already attached: **the current source-compatible bcryptjs cost-12 path on Workers Free** is strongly falsified by the local Workerd proxy. Keep direct Cloudflare CPU telemetry and realistic traffic distribution marked unobserved; do not claim that all possible parity-preserving auth implementations or all future configurations are disproved. No weakening of bcrypt cost or paid service follows from this result.

The 16/16 local harness result is useful as synthetic local Worker+D1+R2 evidence, but it is not 16 production tests and does not change the measured-vs-proxy distinction. The bcrypt test’s `PASS` means the harness observed a synchronous elapsed time above 10 ms, not that the Worker met the Free CPU limit.

### Remaining method/cost rework

- **OPEN:** Add a peak/burst case or explicitly scope all conclusions to average daily drivers, and show route-level D1 query/subrequest counts against the 50-query-per-invocation limit.
- **OPEN:** Bind the illustrative D1 read/write multipliers to source SQL/query shapes or label them as unvalidated estimates in all conclusions; obtain `meta` row metrics only in an authorized target proof (no paid account is needed or authorized here).
- **OPEN:** Clarify that `imageMutations/day` in the R2 Class A formula means uploads/puts, not every add/delete/reorder; either model lifecycle operations separately or say why they are excluded. The current per-month put model does not include retries or a one-time initial image load.
- **OPEN:** The Worker quota arithmetic covers API routes and mediated image requests. Cloudflare documents static-asset requests as free/unlimited when served directly ([billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)); requests configured with `run_worker_first` invoke the Worker and are billed against Workers limits. The actual Vite/SPA asset routing configuration and whether any paths use `run_worker_first` are not yet established; retain that deployment-routing caveat.
- **OPEN:** The `runtime-cost.md` specialist report still contains the original incompatible R2 figures and direct-public-image baseline. The canonical cost model/script correct those claims, but Integration Review must ensure the stale specialist artifact is explicitly superseded and cannot be mistaken for current evidence.
- **OPEN:** This follow-up is not the cross-track Integration Review or Pre-Critic Gate. H1/H2/H3/H4/H6 remain correctly unresolved in `HYPOTHESES.md`; the final package still needs exact invariant evidence and a genuinely green gate before immutable publication.

No new external limit claim was needed for the arithmetic review. The previous official-document check remains the applicable source freshness evidence for the quota constants; actual account usage and Cloudflare CPU telemetry remain absent.

## Artifact A spot check — 2026-10-12

**Reviewed boundary:** immutable Artifact A `e367a9790070b8ecd905037c16e660d9043d8fc8`; current PR #6 head `58350a6efc0020f9ec7746fc9c7f79df497c3fb9` (`rework/cf-au-i00-rework-1`, open against `main`). The cost model, hypothesis registry, calculation script/output and test-results JSON are byte-identical between Artifact A and the current PR head; the PR-head changes are state/status and Pre-Critic boundary records.

**Arithmetic: consistent.** Independent recomputation matches the embedded script and JSON. For lab / early / growth: total Worker requests are 247 / 8,650 / 122,500; D1 reads 2,147 / 78,150 / 1,072,500; D1 writes 6 / 170 / 2,000; R2 Class A 31 / 909 / 11,363; R2 Class B 4,200 / 150,000 / 2,100,000; storage 0.04 / 0.8 / 3.2 GB-month. Growth exceeds the 100,000/day Worker quota by 22,500; other modeled headroom percentages match the prior recalculation. The test JSON records 17 total, 17 passed, 0 failed.

**Finding — bcrypt timing text mismatch (REWORK).** Artifact test JSON reports async correct/wrong compare elapsed at **513/592 ms** and synchronous compare at **539 ms**. `COST-ZERO-MODEL.md` instead says async **555/536 ms**, while its synchronous **539 ms** agrees. Update the document to match the JSON or explicitly identify the async values as a separate earlier run with its own evidence. The hypothesis registry and H5 conclusion correctly use the final 539 ms value and narrowly reject the current bcryptjs cost-12 Workers Free path. Keep the caveat: this is local synchronous elapsed-time proxy evidence, not Cloudflare CPU telemetry; `cpu_ms=10` was configured but not enforced/measured by local Workerd. It strongly supports the narrow rejection without proving all future parity-preserving auth alternatives infeasible.

**Caveats remain open.** The model labels workload figures as daily averages and leaves bursts unmeasured; no peak case is present. Static-asset requests are excluded from Worker totals, appropriately only if the chosen Static Assets config serves those paths directly; actual SPA/API routing and `run_worker_first` behavior remain unverified. These do not change the reproduced arithmetic, but must remain explicit limits on interpretation.

This spot check is not an overall I00 approval, External Independent Critic verdict, or Pre-Critic re-run. The timing-text mismatch should be repaired or reconciled before PR #6 is treated as an exact, internally consistent evidence package.
