# I06.4 GitHub review rework — incomplete rental price data

- Review finding `4320628608`, PR #39, exact prior head `eab7813f56511db37928b5c77b8d35d28c89ada3`, severity P2, catalog helper `HomeView.vue`.
- Reproduction: a published legacy listing can have `priceAmount` and `currency`, but lack `pricePeriod`, `rentalDuration`, or `maxOccupants`. API marks `domainDataStatus: MISSING`; catalog previously showed a numeric price with no period while detail said “Precio a consultar.”
- Repair: catalog now uses shared `hasRentalDomainData` from `rental-domain.ts`; price is shown only when all required rental fields are present, matching the detail view. No Worker API or domain rule changed.
- Regression: synthetic local seed row `synthetic-catalog-04` carries amount 45000 and ARS but null period/duration/capacity; Playwright asserts the catalog displays “Precio a consultar” and hides `45.000`. Existing complete-price listings still show their amount/period.
- Validation on local Vue + Worker/Hono + synthetic D1: `npm run typecheck` PASS; `npm run test:e2e:public` 4/4 PASS in 3.5 minutes (local host load high). Covers both GitHub P2 fixes, prior public journey, contact idempotency and #35 at 320/390px. Worker integration/API source unchanged.
- No Preview/Access/production/paid/R2/real data/source repo actions. Fresh Controller, exact-head GitHub checks/review, and final Pre-Critic required.
