# Independent Cost and Method Critic — CF-AU-I01-P0P1

Reviewer: `/root/i01_cost_critic` (independent from cost-model author), 2026-10-12.

## Review scope

- `.orchestration/evidence/fixtures/calculate-i01-cost.mjs`
- `.orchestration/evidence/CF-AU-I01-P0P1-COST-RESULTS.json`
- `docs/research/CF-AU-I01-P0P1-COST-MODEL.md`
- `docs/research/CF-AU-I01-P0P1-BASELINE.md`

## Independent findings and closure

1. **Scenario arithmetic and current price inputs:** independently recalculated requests, D1 read/write counts, CPU sensitivity, R2 billing rounding and totals. Calculator stdout matched the checked-in result JSON byte-for-byte. Low/base totals remain USD 5; high totals remain USD 23.0005 / 26.6005 / 46.6005 at 10 / 100 / 600 assumed CPU ms/login. Official current Workers, D1, R2 pricing citations support the modelled rates. **Closed.**
2. **Login mix, timing and attack scope:** model now explicitly assumes every login in CPU sensitivity reaches bcrypt; existing-account wrong-password attempts are a representative costly path, while an unknown account skips bcrypt. Burst concurrency is excluded from monthly-volume sensitivity. Latest local dedicated benchmark and documentation agree: successful 564/586 ms, wrong-password 589/590 ms; integrated wrong-password vs unknown-account sample 544/0 ms. All are elapsed time, not billed CPU. The 600 ms input is illustrative and not exact telemetry. **Closed.**
3. **Billing interpretation:** USD 5 is a minimum, not a spend cap; overage, account-shared consumption, excluded taxes/services, and lack of verified hard cap are explicit. No spend, billing, or remote-resource permission is inferred. **Closed.**

## Verdict

No remaining cost-method findings. This review is limited to cost arithmetic, assumptions, timing consistency and method presentation; it is not an External Independent Critic verdict or approval of a paid deployment.
