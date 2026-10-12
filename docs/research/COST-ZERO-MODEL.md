# Cost-Zero Model — Alquileres Uspallata Cloudflare

Observed: 2026-10-12 (UTC). Revalidate before any deployment or cost decision.

## Finding

The illustrative laboratory and early-adoption route totals fit the numeric request, row and object quotas only. The full cost-zero hypothesis is **REJECTED for the current source-compatible bcryptjs cost-12 login path on Workers Free**: a synchronous bcryptjs cost-12 comparison in the local Workerd harness took 613 ms, while Workers Free documents a 10 ms CPU budget per request. The measurement is a local synchronous CPU proxy, not Cloudflare production CPU telemetry, but it exceeds the limit by over 61.3×. Do not weaken the source hash work factor. JWT interoperability, cookies and role semantics passed local synthetic checks; the total auth path remains incompatible with this Free CPU envelope unless a future parity-preserving implementation demonstrates a materially different result.

The “early adoption” scenario below is arithmetic only, not a forecast. The growth crossover exceeds the Workers request allowance after public image bytes are routed through the Worker to preserve the source API-mediated delivery behavior. D1 daily quota exhaustion rejects queries until reset; it does not trigger automatic paid overage. The lab must stop before enabling any paid capacity.

## Current official included envelope

| Service | Included allowance used in model | Exhaustion behavior / note |
|---|---|---|
| Workers Free | 100,000 requests/day; 10 ms CPU per request; 128 MB memory; 50 subrequests/request | CPU is per invocation. A request can fail when limits are exceeded. |
| D1 Free | 5,000,000 rows read/day; 100,000 rows written/day; 5 GB/account; 500 MB/database; 10 databases; 50 D1 queries/Worker invocation | Daily read/write limit enforcement began 2026-09-01. Free quota exhaustion rejects D1 queries until reset at 00:00 UTC; no automatic paid overage. |
| R2 Standard Free | 10 GB-month; 1,000,000 Class A/month; 10,000,000 Class B/month; no egress fee | Free allowance applies to Standard, not Infrequent Access. Usage rounds up to billing units. |

Sources checked 2026-10-12: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 Free-limit enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). The R2 cost table gives Standard storage at $0.015/GB-month, Class A at $4.50/million, Class B at $0.36/million, and free egress; no paid use is authorized.

## Route and data assumptions

Every count below is an illustrative daily average, not observed user demand or a capacity guarantee. Browser bursts, actual cache hits, D1 query-plan rows, write amplification and real record retention are unmeasured. Route read values are planning assumptions, not result-row counts or D1 `meta.rows_read` measurements.

| Driver/day | Lab/demo | Early adoption | Growth crossover |
|---|---:|---:|---:|
| Public catalog requests | 50 | 2,000 | 25,000 |
| Listing detail requests | 30 | 1,000 | 15,000 |
| OWNER/ADMIN requests (including authenticated account revalidation) | 20 | 500 | 10,000 |
| Login requests (one D1 user lookup each; no login write) | 5 | 100 | 2,000 |
| Contact submissions (one D1 insert each) | 2 | 50 | 500 |
| Listing edits/day (listing row + audit row assumption) | 1 | 30 | 375 |
| Image uploads/day (one object put and metadata/index mutation assumption) | 1 | 30 | 375 |
| Image inventory × average object size | 100 × 0.4 MB | 2,000 × 0.4 MB | 8,000 × 0.4 MB |
| Catalog images returned per request | 1 | 1 | 1 |
| Detail images returned per request | 3 | 3 | 3 |

Source route basis: `GET /listings` catalog, `GET /listings/:id` public detail, authenticated OWNER and ADMIN route families, `POST /auth/login`, `POST /listings/:id/contact`, listing mutation routes and listing-image operations. Public image bytes are served through the application API in the source, so the baseline assumes each image GET invokes a Worker; a direct public R2 URL is not treated as parity evidence.

### Computation and headroom

The reproducible arithmetic is in `.orchestration/evidence/fixtures/calculate-cost.mjs`; its output is `.orchestration/evidence/CF-AU-I00-COST-CALCULATIONS.json`.

Formulas:

- API Worker requests/day = catalog + detail + OWNER/ADMIN + login + contact.
- Mediated image Worker requests/day = catalog × 1 + detail × 3.
- Total Worker requests/day = API requests + mediated image requests.
- D1 rows read/day estimate = catalog × 30 + detail × 8 + OWNER/ADMIN × 20 + login × 1 + contact × 1 + mediated image GETs × 2. Each public image GET executes a D1 join to check image metadata and listing visibility before reading R2; the two-row minimum assumes one image metadata row and one joined listing row. Actual `meta.rows_read` may be higher due to query plans/scans and must be measured in a target proof.
- D1 rows written/day estimate = listing edits × 2 (listing + audit) + contact submissions × 1 + image uploads × 2 (metadata row + position index). This omits additional index amplification on other indexed columns and therefore is not an upper bound.
- R2 Class A/month = `ceil(image uploads/day × 30 × 1.01)`, assuming one put per upload plus 1% replacement puts. Source's 5 MiB maximum is below multipart thresholds, so multipart operation amplification is excluded; retries and other bucket operations remain unmeasured.
- R2 Class B/month = mediated image GETs/day × 30. Each object GET passes through the Worker and reads R2; no CDN cache savings are assumed.
- R2 storage = image inventory × 0.4 MB ÷ 1,000 for decimal GB-month, assuming the inventory remains stored the full month.

| Meter | Free allowance | Lab/demo | Early adoption | Growth crossover |
|---|---:|---:|---:|---:|
| Worker requests/day (API + image delivery) | 100,000 | 247 (99.75% headroom) | 8,650 (91.35%) | 122,500 (**22,500 over limit**) |
| D1 rows read/day | 5,000,000 | 2,427 (99.95%) | 88,150 (98.24%) | 1,212,500 (75.75%) |
| D1 rows written/day | 100,000 | 6 (99.994%) | 170 (99.83%) | 2,000 (98%) |
| R2 Class A operations/month | 1,000,000 | 31 (99.997%) | 909 (99.91%) | 11,363 (98.86%) |
| R2 Class B operations/month | 10,000,000 | 4,200 (99.958%) | 150,000 (98.5%) | 2,100,000 (79%) |
| R2 Standard storage GB-month | 10 | 0.04 (99.6%) | 0.8 (92%) | 3.2 (68%) |

The growth case is a **crossover**, not a safe threshold: it exceeds Workers Free once API-mediated images are counted. The source-compatible bcrypt verification is the more immediate cost-zero incompatibility because CPU is per request, regardless of daily volume. D1 has large arithmetic headroom in these scenarios, but index effects/query scans have not been measured. Set operational investigation triggers at 80% of any applicable quota; never cross into paid capacity without a Human Gate. If D1 Free's daily row quota is reached, requests that query D1 fail until its daily reset; do not describe this as an automatic charge.

## D1 database size scenario

Illustrative snapshot: 1,000 listings × 8 KB + 50,000 contact events × 2 KB + 50,000 audit rows × 1 KB + 100 users × 1 KB + 3,000 image metadata rows × 0.5 KB = **159.6 MB raw**. A 2× factor for indexes and SQLite overhead gives **319.2 MB** planned, leaving **180.8 MB** under the 500 MB/database Free limit. These record sizes/counts and the 2× factor are assumptions, not measured source records; contacts/audit retention sensitivity remains unresolved. D1 account-level storage is 5 GB across databases.

## Authentication CPU experiment

Source uses bcryptjs cost 12; JWT defaults to 15 minutes and login issues `alquileres_session`. Local Workerd test used synthetic credentials and the source-compatible bcryptjs 3.0.2 implementation. Latest REWORK-2 successful/failed async compare elapsed 624/642 ms; synchronous cost-12 comparison took 613 ms. These values match `.orchestration/evidence/CF-AU-I00-REWORK2-TEST-RESULTS.json`; earlier A3 measurements remain in immutable A3 evidence. Worker config set `cpu_ms=10`, but local `wrangler dev` did not enforce or expose Cloudflare's production CPU meter. The synchronous, no-I/O operation is a direct local CPU proxy, not a production CPU telemetry reading. It strongly falsifies Free feasibility for the current path; re-measurement on a future authorized target environment is not allowed to spend money or weaken auth. No production, real data or remote Cloudflare resource was used.

## Cost gate and conclusions

- Full H5 (`USD 0` for lab and plausible early operation with source auth) is `REJECTED` for Workers Free on current evidence because the required cost-12 password verification proxy exceeds 10 ms by over 61.3×. Illustrative request counts alone fit at lab and early adoption; they do not rescue the CPU finding.
- The growth crossover also exceeds the 100,000/day Workers request allowance because image bytes remain API-mediated.
- D1 daily overage behavior is service rejection, not auto-billing. Any requirement for Paid Workers/D1, paid features or another recurring service stops at a Human Gate.
- Future changes to auth topology, password algorithm or image delivery must preserve product semantics and require new evidence/decision; this model does not authorize them.
