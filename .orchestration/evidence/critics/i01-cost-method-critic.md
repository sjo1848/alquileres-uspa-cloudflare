# Independent Cost and Method Critic — CF-AU-I01-P0P1

Reviewer: `/root/i01_cost_critic` (independent from cost-model author), 2026-10-12.

## Review scope

- `.orchestration/evidence/fixtures/calculate-i01-cost.mjs`
- `.orchestration/evidence/CF-AU-I01-P0P1-COST-RESULTS.json`
- `docs/research/CF-AU-I01-P0P1-COST-MODEL.md`
- `docs/research/CF-AU-I01-P0P1-BASELINE.md`

## Independent findings and closure

1. **Scenario arithmetic and current price inputs:** independently recalculated requests, D1 read/write counts, CPU sensitivity, R2 billing rounding and totals. After the latest regeneration, calculator stdout matches the checked-in result JSON byte-for-byte, including the optional DO metadata. Low/base totals remain USD 5; high totals remain USD 23.0005 / 26.6005 / 46.6005 at 10 / 100 / 600 assumed CPU ms/login. Official current Workers, D1, R2 pricing citations support the modelled rates. **Closed.**
2. **Login mix, timing and attack scope:** model explicitly assumes every login in CPU sensitivity reaches bcrypt; existing-account wrong-password attempts are a representative costly path, while an unknown account skips bcrypt. Burst concurrency is excluded from monthly-volume sensitivity. Latest local dedicated benchmark and documentation agree: successful comparisons 567/542 ms cold/warm; wrong-password comparisons 631/557 ms cold/warm; registration hash 644 ms. The separate integrated login sample is 558 ms wrong-password vs 0 ms unknown-account. All are local elapsed times, not billed CPU. The 600 ms input is illustrative and not exact telemetry. **Closed.**
3. **Optional SQLite-backed Durable Objects:** model and generated result list all five cost meter classes—requests, active duration, SQLite rows read, SQLite rows written and stored data—with their included allowances, rates and rounding notes. DO cost is explicitly `UNRESOLVED_NOT_INCLUDED_IN_SCENARIO_TOTALS`; the scenario total does not assume zero DO usage. This is appropriate because no actor/lock topology or monthly DO usage drivers are established; any eventual DO estimate is additive to Worker and D1/R2 scenario usage. **Closed.**
4. **Billing interpretation:** USD 5 is a minimum, not a spend cap; overage, account-shared consumption, excluded taxes/services, and lack of verified hard cap are explicit. No spend, billing, or remote-resource permission is inferred. **Closed.**

## Verdict

No remaining cost-method findings. This review is limited to cost arithmetic, assumptions, timing consistency and method presentation; it is not an External Independent Critic verdict or approval of a paid deployment.
