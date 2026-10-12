# CF-AU-I01-P0P1 — Invariant Evidence Matrix

Candidate scope: exact source/API baseline, local synthetic auth feasibility, and Workers Paid + D1 + R2 cost sensitivity. Statuses below classify this bounded artifact only; no full application parity is implied.

| # | Classification | Evidence status | Evidence / rationale |
|---:|---|---|---|
| 1 | APPLIES | PASS | Source repository was read-only; current source main SHA and no API changes since I13 are recorded in `docs/research/CF-AU-I01-P0P1-BASELINE.md` and `.orchestration/evidence/specialists/i01-source-parity.md`. |
| 2 | APPLIES | PASS | Contract explicitly limits the increment to research and synthetic proof; no feature expansion or migration occurred. |
| 3 | APPLIES | PASS | Positive/negative OWNER listing isolation and live ADMIN role check are in `.orchestration/evidence/CF-AU-I01-P0P1-AUTH-RESULTS.json`. |
| 4 | N/A | N/A | Public catalog/detail/contact behavior is inventoried, but no public behavior is implemented in the auth seam. No parity claim is made. |
| 5 | APPLIES | PASS | Only synthetic `example.test` accounts and fixture-owned local D1 schema/seed are used; no source or customer data is copied. |
| 6 | N/A | N/A | No image metadata/object implementation occurs in this auth/cost increment. R2 costs are sensitivity assumptions; I00 image-flow evidence remains bounded and unchanged. |
| 7 | N/A | N/A | No ADMIN audit/event mutation route is implemented or claimed. |
| 8 | APPLIES | PASS WITH EXPLICIT LIMITS | Source-compatible tested auth subset and known divergences are documented in baseline, integration review and test limitations: DTO email equivalence remains unproven; numeric-text expiry deliberately fails closed; malformed percent encoding reproduces 500; logout does not revoke bearer tokens. |
| 9 | APPLIES | PASS | All Workerd/D1 activity uses local mode and synthetic data. No Cloudflare account resource, billing setting, paid service, production, or real-data deployment was used. |
| 10 | APPLIES | PASS | Cost claims are conditional and route-driven. Official pricing is dated; $5 is described as account minimum, not cap; CPU is separated from elapsed time; shared usage and excluded costs are explicit. |
| 11 | APPLIES | PASS | Canonical main at task start was `84930c4ba59d133e40099aebb0edd0a8584fb6ab`; this candidate is isolated on `work/cf-au-i01-p0p1`. External state transition will be published on its open PR. |
| 12 | N/A | N/A | No Drive mirror was used or updated. |
| 13 | APPLIES | PASS | Execution owner does not issue External Independent Critic PASS. Internal critics reviewed independently; final state remains pending external verdict. |
| 14 | APPLIES | PASS | A2's 23/23 auth suite and 0-vulnerability audit are inherited evidence. A3/A4 change only cost-model/validator/evidence files; relevant Worker, test-runner and dependency blobs are unchanged, so the external critic's direction not to rerun auth/audit was followed. |
| 15 | APPLIES | PASS FOR PUBLICATION | The independent cost-method critic recalculated all nine outputs and A3-F1 is repaired in the A4 candidate with a source-bound invariant and coherent omission mutant; see focused independent QA critique and Pre-Critic gate. PASS is publication-only. |
| 16 | APPLIES | PASS FOR A4 PUBLICATION | A4 will be an immutable tagged commit containing the external-review stop state; a subsequent boundary commit will pin its exact SHA. No self-approval or merge. |
| 17 | APPLIES | PASS | Work continued across multiple technical review/rework cycles until the bounded contract's external-review boundary. |
| 18 | APPLIES | PASS | Reusable failure learnings are preserved in the technical critic report and corrected tests: count grouped checks accurately, decode selected Bearer/cookie consistently, validate expiry config before writes. |
| 19 | APPLIES | PASS FOR PUBLICATION | A2-F1/F2 closure, unknown-account bcrypt skip, registration factors, image lifecycle assumptions and the A3-F1 validator invariant were independently reconciled; remaining telemetry and workload uncertainties are explicitly retained. |

`PASS WITH EXPLICIT LIMITS` means the invariant is preserved for this evidence-only increment while stated unresolved compatibility findings remain open; it does not convert them into product acceptance or full-parity PASS.
