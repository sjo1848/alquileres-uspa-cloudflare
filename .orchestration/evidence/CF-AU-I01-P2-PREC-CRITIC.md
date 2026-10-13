# CF-AU-I01-P2 Pre-Critic Gate — publication readiness

Date: 2026-10-13. Artifact A2: to be pinned by the publication boundary commit.

## Contract and authorization

- Active contract `.orchestration/contracts/CF-AU-I01-P2.md` authorizes this local synthetic Worker + actual local D1/R2 slice, tests, critics and one immutable external-review artifact.
- Source `alquileres-uspa` remains read-only. No paid service, remote resource, deployment, production or real data used.
- Scope remains OWNER draft listing and images; no Vue, broader API migration or next task.

## Acceptance and invariant evidence

- Executable routes/mapping: `apps/worker/src/index.ts`, `apps/worker/docs/postgres-d1-map.md`.
- Actual D1/R2 migrations, local bindings, HTTP tests: `apps/worker/migrations`, `wrangler*.jsonc`, `tests/http.mjs`.
- Final commands and clean-run details: `CF-AU-I01-P2-VALIDATION.md`.
- Source/method invariant matrix: `CF-AU-I01-P2-INVARIANTS.md`.
- Integration Review: `CF-AU-I01-P2-INTEGRATION-REVIEW.md`.
- Independent security, integrity and technical review records: `critics/CF-AU-I01-P2-{SECURITY,INTEGRITY,INTEGRATION}.md`.
- Critical negative cases include OWNER isolation, CSRF origin checks, 20-image cap/race, D1/R2 fault injection, compensation/recovery, and no fixture route on the product Worker.
- REWORK-1 JWT controls: active seeded owner and correctly signed claims accepted; same-identity correctly signed expired JWT denied; same-identity active valid-shape wrong-HMAC JWT denied. One-hour active lifetime covers the later signature assertion. Independent security critique bounded PASS: `critics/CF-AU-I01-P2-REWORK1-JWT-SECURITY.md`.
- After the JWT-only test edit: `node --check tests/http.mjs` PASS and one complete fresh-state `npm test` PASS in 636.4 s. A preliminary run was stopped before completion when review caught an insufficient 60-second control lifetime; it is explicitly not counted as a test result.

## Truthful limits

External review must decide the substantive candidate. This gate does not assert external PASS, full parity, production readiness, atomic D1/R2 dual-write semantics, Postgres lock equivalence, or remote Cloudflare behavior. The private image GET divergence and unmigrated source entities are explicit.

## Disposition

**PRE-CRITIC PASS for immutable Artifact A2 publication only.** The REWORK-1 security controls have independent bounded PASS and the final fresh-state full suite and syntax check passed. Historical baseline runs (522.0 s, 543.7 s) and the final REWORK-1 run (636.4 s) are distinguished in the validation ledger. Required stop state: `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, open unmerged PR #10, exact A2 artifact SHA/tag.
