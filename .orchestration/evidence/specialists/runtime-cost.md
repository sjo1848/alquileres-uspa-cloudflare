# Runtime, cost and security research — CF-AU-I00 REWORK-1

Observed: 2026-10-12 (UTC)
Track owner: independent Cloudflare runtime/cost specialist
Scope: official Cloudflare limits, runtime/auth feasibility constraints, route/data-driven cost envelope, R2 exposure risks. This is evidence for integration, not an approval of the overall task.

## Research protocol

- **Hypothesis:** a modest, parity-preserving Vue/Vite + Workers + D1 + R2 application can operate at USD 0 in included tiers, if route-level workload remains below hard Free limits and password verification fits the 10 ms CPU/request budget.
- **Falsification:** any representative route exceeds the Free request/CPU ceiling; D1 reads/writes/storage or R2 Standard storage/operations exceed included limits; or the safe auth algorithm needed for the source hash format cannot run correctly within the Worker CPU budget.
- **Setup:** read the current Cloudflare primary documentation on Workers limits/pricing, D1 limits/pricing/enforcement, R2 pricing/public delivery, and Web Crypto. Route counts below are explicit planning scenarios, not observed traffic or claims about actual adoption. No Cloudflare account, paid service, production deployment or real data used.
- **Evidence:** official links are listed inline and in Sources. Calculations are reproducible from assumptions below.
- **Result:** current official Free limits permit a useful bounded experiment, but hard-stop behavior makes operational headroom and route-level measurement essential. Static docs do not establish this app's auth CPU or real query row counts.
- **Conclusion:** conditional `SUPPORTED` only for arithmetic feasibility of the illustrative low-volume workload; real application cost/auth-runtime feasibility remains `UNRESOLVED` until the local representative Worker proof measures it.
- **Transferable learning:** separate hard Free-plan exhaustion from billable Paid-plan overage. D1 Free exhaustion stops queries; it does not transparently incur charges. A request-count-only model misses D1 row amplification, login hash CPU, and direct R2 image operations.

## Current official operating envelope

The Workers Free plan allows 100,000 requests/day and 10 ms CPU time per HTTP request, with 128 MB memory and 50 subrequests/request. Workers Paid removes the request cap and raises per-request CPU to 5 minutes (30 seconds default); that is outside this lab's zero-cost target. Waiting for network/database I/O does not count as CPU, but CPU-heavy authentication and payload parsing do. Cloudflare describes common Worker usage around 2.2 ms/request and heavier auth/SSR/payload work around 10–20 ms; thus password verification is a specific Free-tier risk rather than something to assume fits. Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total account storage; each database is capped at 500 MB and Free supports 10 databases. Free query subrequest cap is 50 per Worker invocation. Reads/writes above the included daily quota now fail until midnight UTC; the documented enforcement started 2026-09-01. At 5 GB storage exhaustion, data cleanup is needed before inserts/schema changes. This is service interruption, not automatic paid overage. Paid-tier usage may be billed, which is prohibited absent a Human Gate. Sources: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq/), [D1 enforcement changelog](https://developers.cloudflare.com/changelog/product/d1/).

R2 Standard Free includes 10 GB-month storage, 1 million Class A ops/month and 10 million Class B ops/month, with no egress charge. Standard storage beyond the allowance costs $0.015/GB-month; Class A costs $4.50/million and Class B $0.36/million. Free allowance does not apply to Infrequent Access. Cloudflare rounds usage up to billing units, so do not target the boundary. Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Route/data-driven planning scenarios

These are transparent illustrative assumptions for load arithmetic. They must be replaced or confirmed by the source route inventory and representative query measurements before treating as app-specific forecasts. One “API request” means one inbound Worker API invocation; static assets and direct-to-R2 public image GETs are modeled separately. For D1, “rows read” means Cloudflare's metered rows read, not SQL result cardinality. Actual query plans/indexes, join fanout, and index maintenance must be measured.

| Driver per day | Lab/demo | Early adoption | Growth threshold probe |
|---|---:|---:|---:|
| Public catalog requests | 50 | 2,000 | 25,000 |
| Listing-detail requests | 30 | 1,000 | 15,000 |
| OWNER/ADMIN requests (lists, edits, audit) | 20 | 500 | 10,000 |
| Login requests | 5 | 100 | 2,000 |
| Contact submissions | 2 | 50 | 500 |
| Total API Worker requests/day | 107 | 3,650 | 52,500 |
| Catalog rows read/request (assumed) | 30 | 30 | 30 |
| Detail rows read/request (assumed) | 8 | 8 | 8 |
| OWNER/ADMIN rows read/request (assumed) | 20 | 20 | 20 |
| Login rows read/request (assumed) | 1 | 1 | 1 |
| Contact rows read/request (assumed) | 1 | 1 | 1 |
| **D1 reads/day** | **2,147** | **78,150** | **1,072,500** |
| **D1 writes/day** (login 1, listing changes × 2 rows, contact 1 row) | **9** (1 edit/day) | **210** (30 edits/day) | **3,250** (375 edits/day) |
| Images; average stored size | 100 × 0.4 MB | 2,000 × 0.4 MB | 8,000 × 0.4 MB |
| R2 Class A/month (one put per listed image + 1% replacement puts; no list calls) | 101 | 2,020 | 8,080 |
| R2 Class B/month (catalog 1 thumbnail + detail 3 full images) | 4,200 | 270,000 | 2,250,000 |
| R2 steady storage | 40 MB | 800 MB | 3.2 GB |

Calculations:

- D1 reads/day = `catalog/day*30 + detail/day*8 + owner/day*20 + login/day + contacts/day`.
- D1 writes/day = `login/day + contacts/day + 2*listing_edits/day` (assumes one listing row and one audit row per edit; scenario edit assumptions are 1/30/375 per day; ignores additional indexed-row write amplification).
- R2 reads/month = `30*(catalog/day*1 + detail/day*3)`; this assumes direct object GET per displayed image and no cache hit. A public cached bucket can lower origin operations; real cache behavior is unknown. Actual app delivery design must identify which requests invoke the Worker.
- R2 writes/month = `one put per modeled image + 1% replacement allowance`; this is a conservative initial-fill/monthly inventory assumption, not an observed recurring upload rate; excludes multipart amplification, retries and lifecycle/list operations.
- Listing DB estimate for sizing: 1,000 listing rows × 8 KB + 50,000 contact rows × 2 KB + 50,000 audit rows × 1 KB + 100 users × 1 KB + 3,000 image metadata rows × 0.5 KB ≈ 160 MB raw. Add an explicit 2× planning factor for indexes/SQLite overhead ⇒ ~320 MB, leaving ~180 MB under the 500 MB Free per-database cap. This is illustrative, and the growth scenario's listing/contact/audit volume can exceed it; retention and realistic record sizes remain unresolved.

### Headroom and interpretation

| Meter | Free allowance | Lab/demo use (headroom) | Early adoption (headroom) | Growth probe (headroom) |
|---|---:|---:|---:|---:|
| Worker requests/day | 100,000 | 107 (99.89%) | 3,650 (96.35%) | 52,500 (47.5%) |
| D1 reads/day | 5,000,000 | 2,147 (99.96%) | 78,150 (98.44%) | 1,072,500 (78.55%) |
| D1 writes/day | 100,000 | 9 (99.991%) | 210 (99.79%) | 3,250 (96.75%) |
| R2 Class A/month | 1,000,000 | 1,030 (99.90%) | 2,600 (99.74%) | 10,400 (98.96%) |
| R2 Class B/month | 10,000,000 | 4,200 (99.96%) | 270,000 (97.3%) | 2,250,000 (77.5%) |
| R2 storage | 10 GB-month | 0.04 GB (99.6%) | 0.8 GB (92%) | 3.2 GB (68%) |

Percentages in parentheses are remaining headroom. All three workload scenarios fit the numeric service quotas before CPU is considered. That is not a prediction of actual demand and does not prove Free eligibility under traffic spikes. If the API CPU average is 5 ms, daily API CPU at the growth probe is 262.5 CPU-seconds, but Free's 10 ms is a **per-invocation hard cap**, not an aggregate allowance. Password verification must be measured per request. At the source hash's actual cost/parameters, a login route consistently above 10 ms is incompatible with the Free request CPU limit even when request volume is low. No hash algorithm or cost factor should be weakened to meet this envelope.

Static assets: Workers Static Assets has its own file count/size limits; ordinary asset delivery is not included in the API request scenarios. Confirm the deployment routing/configuration because dynamic fallback or Worker code paths can change invocations. R2 public reads may be delivered directly and count as R2 Class B operations, not API Worker requests. Asset and image request counts therefore need independent evidence.

## Runtime/auth and security constraints

- Workers Web Crypto supports SHA-256, HMAC, RSASSA-PKCS1-v1_5, RSA-PSS, ECDSA, Ed25519, PBKDF2 and other listed operations; Cloudflare states Web Crypto is significantly faster than pure JS for CPU-intensive cryptographic work. `argon2`/`argon2Sync` are explicitly unsupported in Node crypto compatibility. This establishes primitive availability only, not JWT library byte/claim/cookie parity, password-hash format compatibility, or CPU suitability. The repository's local auth benchmark must run positive and negative login/token/role cases using the source's exact cookie/JWT/password semantics and report measured CPU (`performance.now()` wall time alone is not CPU time). Sources: [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), [Node crypto compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).
- Public R2 buckets are private by default, but enabling `r2.dev` makes all bucket contents internet-accessible and that endpoint is rate-limited/intended for development. For production-like public delivery, Cloudflare documents custom domains for access controls, caching and bot controls. A listing image's key is not authorization: validate listing ownership before mutations and make public/private read semantics an explicit parity decision. Sources: [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
- Presigned URLs are bearer capabilities: anyone holding one can perform the permitted operation on the named object until expiry (1 second–7 days). Keep signing credentials server-side; issue narrowly scoped object/action/expiry only after application authentication and ownership checks. No source behavior yet proves direct uploads are parity-compatible.
- R2 lifecycle consistency is not provided as a cross-service D1+R2 transaction by the cited docs. Use explicit compensation/order (e.g. authorize first; write object; commit metadata; delete newly written object if DB commit fails; for delete remove metadata/mark pending then delete object and retry cleanup), stable opaque keys, and a reconciliation process. This is a design recommendation, not demonstrated implementation evidence.
- D1 rows written include index update effects; indexed-column changes add at least one additional written row per referenced index. Estimate with actual schema/indexes to avoid a misleading quota margin. D1 query limits and row sizes also matter: Free has 50 D1 queries per Worker invocation and a 2 MB max row/string/blob; verify large result routes and image bytes are not stored in D1. Sources: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Unresolved points for integration

1. Exact source auth cookie attributes, token algorithm/claims/expiry/revocation behavior, password hash algorithm/parameters and role denial behavior must be derived from pinned source and tested locally. Docs cannot prove parity.
2. Measure CPU time for source-compatible password verify/sign/verify on actual Workers local runtime; report cold/warm and worst observed cases. CPU over 10 ms falsifies Free auth feasibility.
3. Confirm actual SQL row-meter counts (including joins/indexes) and D1 subrequest count for catalog/detail/admin routes; SQL row result counts are insufficient.
4. Derive actual image display counts, max object size, replacement/deletion workflow and whether objects are public or owner/admin gated. Establish compensation/reconciliation evidence.
5. Confirm realistic dataset sizes/retention and SQLite/index overhead. The illustrative 320 MB database leaves ~180 MB under the 500 MB per-database limit.
6. Actual browser cache hit rate and image request fanout are unknown. Cost estimate assumes one thumbnail per catalog result and three image GETs per detail request, no cache savings.
7. The free-tier figures and billing rules are time-sensitive and must be rechecked before any cost decision/deployment.

## Sources (official primary documentation; checked 2026-10-12)

- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 FAQ: https://developers.cloudflare.com/d1/reference/faq/
- D1 Free limit enforcement: https://developers.cloudflare.com/changelog/product/d1/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Workers Web Crypto: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Node crypto compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/
- R2 public buckets: https://developers.cloudflare.com/r2/buckets/public-buckets/
- R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
