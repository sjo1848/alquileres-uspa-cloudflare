# Architecture and Budget Policy — Alquileres Uspallata on Cloudflare

Date: 2026-10-12
Authority: Human product direction + Controller interpretation of permitted next technical scope.

## Accepted product direction
1. **Final hosting destination: 100% Cloudflare.** Entire application including API and persistence, not merely a static demo. No external hosting as the destination.
2. **Strict USD 0 is NOT a constraint.** Paid Cloudflare services are acceptable design candidates when they preserve functionality and security.
3. **Workers Paid is the preferred architecture candidate to evaluate**, not an approved purchase or proof of full parity. D1 + R2 Standard, DO only if necessary.
4. Preserve authentication (including bcryptjs cost-12 compatibility), OWNER/ADMIN isolation, I13 rental-domain meaning, historical data truth, concurrent operations and users' safety.
5. Human has **NOT set a monthly spending ceiling** and has **NOT authorized** billing activation, recurring purchase, overages, real customer data, staging/public deploy or production cutover. Such action requires another explicit gate before execution.
6. Source repo I13 Product Acceptance PASS already exists in Issue #24 (2026-09-29) but source canonical state is stale; reconcile it separately before migration. Don't ask Human to repeat it.
7. Lab CF-AU-I00 research is closed with bounded external PASS, not a PASS for the whole Cloudflare app. H5 narrow Workers Free rejection remains accurate.

## Controlled next technical action
`CF-AU-I01-P0P1`: source pin + full-platform parity framing + locally tested real auth feasibility + qualified Paid-budget model; return at External Independent Critic. No remote or paid actions.

## Costs and evidence references (observed 2026-10-12)
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

The Workers Paid minimum is listed as USD 5 monthly, with usage metering beyond included limits. D1 and R2 have their own billing quotas. This is not a promise of a fixed USD 5 total bill.
