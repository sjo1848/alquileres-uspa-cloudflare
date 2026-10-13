# CF-AU-I01-P2 Pre-Critic Gate — publication readiness

Date: 2026-10-13. Artifact A3: exact SHA is pinned by the following publication boundary commit.

## Contract and authorization

- Active contract `.orchestration/contracts/CF-AU-I01-P2.md` plus canonical External REWORK-2 verdict `.orchestration/reviews/CF-AU-I01-P2-ARTIFACT-A2-CRITIC.md` authorize only committed-response D1 lease-release repair, associated tests/evidence, independent integrity QA and one immutable external-review artifact.
- Source `alquileres-uspa` remains read-only. No paid service, remote resource, deployment, production or real data used.
- Scope remains OWNER draft listing and images; no Vue, broader API migration or next task.

## Acceptance and invariant evidence

- Executable routes/mapping: `apps/worker/src/index.ts`, `apps/worker/docs/postgres-d1-map.md`.
- Actual D1/R2 migrations, local bindings, HTTP tests: `apps/worker/migrations`, `wrangler*.jsonc`, `tests/http.mjs`.
- Final commands and clean-run details: `CF-AU-I01-P2-VALIDATION.md`.
- Source/method invariant matrix: `CF-AU-I01-P2-INVARIANTS.md`.
- Integration Review: `CF-AU-I01-P2-INTEGRATION-REVIEW.md`.
- Independent security, integrity and technical review records: `critics/CF-AU-I01-P2-{SECURITY,INTEGRITY,INTEGRATION}.md`.
- Critical negative cases include OWNER isolation, CSRF origin checks, 20-image cap/race, D1/R2 fault injection, compensation/recovery, and no fixture route on the product Worker. REWORK-2 specifically tests pre-effect and post-effect D1 lock-delete faults on upload, reorder and delete; checks intended HTTP status, exact cardinality, D1/R2 consistency, lock release, terminal operation records and follow-up recovery.
- REWORK-1 JWT controls: active seeded owner and correctly signed claims accepted; same-identity correctly signed expired JWT denied; same-identity active valid-shape wrong-HMAC JWT denied. One-hour active lifetime covers the later signature assertion. Independent security critique bounded PASS: `critics/CF-AU-I01-P2-REWORK1-JWT-SECURITY.md`.
- REWORK-2 independent integrity critique is bounded PASS in `critics/CF-AU-I01-P2-REWORK2-INTEGRITY.md`. It is static-only; token replacement during release is not race-injected, while both cleanup statements are token-fenced.
- Final candidate: `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check` PASS; one complete fresh-state `npm test` PASS in 562.5 s. The ledger records the earlier interrupted and failed attempts without presenting them as passes. Dependencies were unchanged; npm audit was not rerun.

## Truthful limits

External review must decide the substantive candidate. This gate does not assert external PASS, full parity, production readiness, atomic D1/R2 dual-write semantics, Postgres lock equivalence, or remote Cloudflare behavior. The private image GET divergence and unmigrated source entities are explicit.

## Disposition

**PRE-CRITIC PASS for immutable Artifact A3 publication only.** A2-F1 is closed within the authorized boundary, the independent integrity critic is bounded PASS, and all final candidate checks including the full HTTP suite passed. Historical runs and unsuccessful REWORK-2 attempts are distinguished from the final result in the validation ledger. Required stop state after the publication boundary: `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, open unmerged PR #10, exact A3 artifact SHA/tag. Do not merge or start another task before the external verdict.
