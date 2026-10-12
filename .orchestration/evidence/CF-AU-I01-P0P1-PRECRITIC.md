# CF-AU-I01-P0P1 — Pre-Critic Gate

Date: 2026-10-12. Purpose: determine whether the bounded evidence package may be submitted for External Independent Critic review. This is a publication gate, not a self-approval of the feasibility thesis or a product-parity PASS.

## Contract and scope

| Requirement | Evidence | Gate |
|---|---|---|
| Active authorized contract and scope unchanged | `.orchestration/contracts/CF-AU-I01-P0P1.md`; canonical start SHA and authorized paths/work branch recorded in validation evidence. | PASS |
| P0 exact source pin, accepted I13 SHA/PASS, no semantic drift, route inventory, bounded architecture, separate source-status reconciliation procedure | `docs/research/CF-AU-I01-P0P1-BASELINE.md`; `.orchestration/evidence/specialists/i01-source-parity.md`. Source repo is unmodified. | PASS — I13 source STATUS mismatch remains a separate prerequisite before migration. |
| P1 actual source-compatible synthetic registration/login, existing cost-12 hashes, JWT issue/verify/expiry/tamper, cookies, header precedence, live DB role/user checks, OWNER isolation, ADMIN, logout | `.orchestration/evidence/CF-AU-I01-P0P1-AUTH-RESULTS.json`; final local test run recorded in `VALIDATION.md`. | PASS for explicit subset — 23/23 grouped checks. Email DTO parity and named security limits remain unresolved and plainly stated. |
| Timing and platform CPU distinguished | AUTH results, baseline, cost model and validation record report only local elapsed values; provider billed CPU is not measured. | PASS |
| Workers Paid + D1 + R2 cost, route-driven 3 scenarios, registration CPU/user-index writes, image-delete/reorder lifecycle drivers, optional DO meters and safeguards | `.orchestration/evidence/fixtures/calculate-i01-cost.mjs`; `validate-i01-cost.mjs`; generated results; source route map and assumptions in `docs/research/CF-AU-I01-P0P1-COST-MODEL.md`. DO cost is explicitly unresolved and excluded from scenario totals. | PASS — independent cost critic recalculated all 9 scenario/sensitivity points and accepted the bounded source mappings; see `.orchestration/evidence/critics/i01-cost-method-critic.md`. |
| Research discipline: hypothesis, falsification, setup, result, conclusion and transferable learning | Baseline and cost model have structured experiment sections. Negative evidence and uncertainty remain visible. | PASS |
| Independent specialists and distinct critics | `.orchestration/evidence/specialists/i01-source-parity.md`, `i01-runtime-cost.md`; `.orchestration/evidence/critics/i01-technical-auth-critic.md`, `i01-cost-method-critic.md`, and `i01-cost-qa-critic-a3-f1.md`. Technical reviewer PASS is bounded to auth evidence; cost reviewer closes arithmetic/assumption findings; focused QA reviewer closes A3-F1. | PASS — no outstanding internal critic finding for the A4 evidence candidate. |
| Integration Review completed | `.orchestration/evidence/CF-AU-I01-P0P1-INTEGRATION-REVIEW.md` reconciles source, auth, security, cost, D1/R2 and scope. | PASS |
| Applicable invariants classified | `.orchestration/evidence/CF-AU-I01-P0P1-INVARIANTS.md` enumerates all 19; N/A rows explain why. Applicable evidence invariants pass for declared scope. | PASS |
| Tests, security checks, audit and static checks | `.orchestration/evidence/CF-AU-I01-P0P1-VALIDATION.md`: inherited A2 auth 23/23 and audit 0, unchanged auth/dependency blobs, deterministic cost output and independent validator with 4 negative mutations including the coherent prefetch omission; focused QA critic, syntax and whitespace checks. | PASS for applicable A4 QA-only edits; auth/audit not rerun because their source/dependency blobs are unchanged. |
| No unapproved scope or risk acceptance | No paid account, remote resource, deployment, production, source write, real data, functional migration, P2/P3 or Runtime Watch. Security findings stay unresolved; no security change is accepted. | PASS |

## Research truthfulness and remaining limits

- No substantive hypothesis is promoted to an architectural invariant. Local Workerd elapsed is not Worker CPU. `600 ms` in the cost calculation is a conservative illustrative sensitivity, not measurement.
- The high scenario assumes bcrypt-bound logins and a monthly volume; burst concurrency is unquantified. Shared account consumption and a hard account-wide spend cap are not verified.
- Full `class-validator IsEmail` equivalence is unproven; unit-bearing JWT expiry is covered while numeric text is an explicit fail-closed fixture divergence; malformed selected URI escape yields the source-compatible 500; bearer logout remains valid until JWT expiry or DB revalidation. Rate limit, CSRF, full API parity, D1 production rows, and R2 lifecycle remain outside this evidence.
- Source I13 PASS exists in Issue #24 comment `5891503272`, but the source repository's tracked status is stale. This lab records a separate reconciliation action and makes no source write.

## Publication decision

**PRE-CRITIC GATE: PASS TO PUBLISH EXACT IMMUTABLE ARTIFACT A4.** A3-F1 is closed by the source-bound delete-prefetch invariant and a coherent negative mutant preserving ordinary GETs; the independent QA critic confirmed the targeted rejection. The cost-method critic's bounded A3 recalculation remains valid because the cost calculator/results are unchanged. Integration Review and all applicable invariant classifications are complete. This PASS establishes evidence sufficiency for external review only; it is not an External Independent Critic verdict, product/security acceptance, operational/cost approval, or proof of full Cloudflare migration. Artifact A4's own commit must contain `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false` and its known tag; a following boundary commit pins the exact A4 SHA. Stop at that new external-review boundary.
