# CF-AU-I00 Invariant Evidence

Candidate: REWORK-2 evidence package, based on canonical `main` `0af0ab4` with A3 ancestry retained.
Scope: discovery/feasibility only. PASS means the laboratory artifact respects the invariant; it does not turn unresolved target-parity hypotheses into proven architecture.

| # | Classification | Result | Evidence |
|---:|---|---|---|
| 1 | APPLIES | PASS | Source is referenced read-only; source commit pins and drift are recorded in `SOURCE-INVENTORY.md`; no source checkout changes. |
| 2 | APPLIES | PASS | `HYPOTHESES.md`, `PARITY-MATRIX.md` and `INTEGRATION-REVIEW.md` contain no product expansion or migration implementation. |
| 3 | APPLIES | PASS | Synthetic Worker tests enforce owner isolation and DB-derived admin role for tested endpoints; broader source route parity remains explicitly unresolved. |
| 4 | APPLIES | PASS | Public image delivery checks both APPROVED and published and returns 404 otherwise; source public catalog/detail parity remains unresolved. |
| 5 | APPLIES | PASS | Synthetic schema retains legacy values; no semantic data conversion or backfill is performed. `MIGRATION-RISK-MAP.md` records unresolved legacy interpretation. |
| 6 | APPLIES | PASS | Local D1/R2 test exercises metadata link, ordering, owner/state gate, public visibility and failure compensation; `H3/H4` remain unresolved for concurrency, full migration, and untested failure modes. |
| 7 | N/A | PASS | No ADMIN audit operation is implemented or claimed; the fixture only checks role gating. |
| 8 | APPLIES | PASS | Auth fixture preserves tested cookie/JWT/role semantics, never weakens bcrypt cost, and labels source login/register parity unresolved; see `HYPOTHESES.md` and tests. |
| 9 | APPLIES | PASS | Tracked `wrangler.jsonc` and ignored `.dev.vars` lack `LOCAL_FIXTURE_ONLY`; `run-local-fixture.mjs` rejects forwarded args and starts Wrangler with fixed `--local`/flag args. `npm run dev -- --remote` was rejected before Wrangler launch. Direct manual remote invocation with an explicit hook override is outside this evidence. D1/R2 are local synthetic bindings; no deployment or real data. H5 rejects current Free auth on a qualified local proxy. |
| 10 | APPLIES | PASS | Cost report records observed-at date, official limits, explicit route/data assumptions, failure behavior and stop thresholds; model is not forecast. |
| 11 | APPLIES | PASS | Work branch descends from canonical `main`; state publication will reference exact immutable Artifact A SHA. |
| 12 | N/A | PASS | No Drive artifact is used as runtime authority. |
| 13 | APPLIES | PASS | Both independent critics' findings and follow-ups are preserved; integration does not self-approve task acceptance. |
| 14 | APPLIES | PASS | Wrangler/test harness conflict was repaired locally by using local D1 binding controls; no routine Human gate was raised. |
| 15 | APPLIES | PASS | This evidence matrix plus the completed Pre-Critic review is attached before external review. |
| 16 | APPLIES | PASS | Candidate is published as exact immutable Artifact A and external review is requested for that SHA; see boundary state. |
| 17 | APPLIES | PASS | State transitions to `PENDING_EXTERNAL_REVIEW`, `resume_authorized=false`, and next action explicitly names External Independent Critic. |
| 18 | APPLIES | PASS | New invariant #19 records the critic-derived cost-method lesson; critics' findings/fixes remain preserved in their own artifacts. |
| 19 | APPLIES | PASS | Cost script is independently recomputed by cost critic; source API-mediated image requests are reconciled into Worker/R2 model. Remaining setup/burst/query details are explicitly bounded. |

No invariant is `PENDING`, `FAIL` or `UNPROVEN` for the bounded lab artifact and its publication process. This is not a hypothesis PASS: H1/H2/H3/H4/H6 are unresolved, and H5 is narrowly rejected as stated in the research registry.
