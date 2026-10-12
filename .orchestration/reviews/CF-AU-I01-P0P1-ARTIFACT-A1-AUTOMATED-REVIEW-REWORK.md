# CF-AU-I01-P0P1 Artifact A1 — GitHub Automated Review Rework

Reviewed commit: `db0f18f062635d687e72ced0d0d405b9faa351ab`, tag `CF-AU-I01-P0P1-Artifact-A1`, PR #8. GitHub `chatgpt-codex-connector[bot]` posted review findings on 2026-10-12; these are bounded evidence rework findings, not a product or spending decision.

| Comment | Severity | Finding | Resolution plan |
|---|---|---|---|
| [discussion_r4252024073](https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8#discussion_r4252024073) | P1 | Reviewed Artifact A1 commit had inherited `READY_TO_RESUME`/`resume_authorized=true`; the PENDING_EXTERNAL_REVIEW state existed only in a later PR boundary commit. | Artifact A2 will carry `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, and its known tag in its tagged commit; a following publication-boundary commit pins the exact artifact SHA. Review is retriggered against that final PR head. **Resolution included in Artifact A2 publication.** |
| [discussion_r4252024082](https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8#discussion_r4252024082) | P1 | Independent cost-critic report file still cited an earlier timing run than the final auth-results JSON, despite the critic having sent a later message. | Independent cost critic revalidated final auth JSON and cost model, edited its own durable report, matched final timings and exact calculator JSON. **Closed independently.** |
| [discussion_r4252024089](https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/8#discussion_r4252024089) | P2 | Optional SQLite Durable Objects prices omitted billed rows read/written. | Added current official rates/included quotas for DO requests, active duration, SQLite rows read, rows written and storage to the report/calculator/result. DO total is explicitly unresolved and excluded from scenarios because no DO workload/topology is established. **Closed in the evidence; no usage cost is assumed zero.** |

These findings are handled under the existing CF-AU-I01-P0P1 authorization. No Human Gate or blocker was identified. A1 and its tag remain immutable and reachable; the corrected evidence and in-tag stop boundary are a new Artifact A2.
