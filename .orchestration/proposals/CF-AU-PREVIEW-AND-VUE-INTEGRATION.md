# Protected Cloudflare Preview and Vue integration

Status: **proposal only; no remote resource, billing, or deployment authorized**
Prepared: 2026-10-16
Basis: P2 Artifact A4 `c9090202441ecd534f84c2dcc610dc5d86bab4e0` has bounded External Independent Critic PASS; PR #10 is awaiting protected `main` integration.

## Minimum Preview

Use one Workers Preview for the lab branch, with a `workers.dev` URL, served by the same Worker as the Vue static assets and `/api/*`. Preview URLs are public by default, so configure Cloudflare Access and verify the allow policy before sharing the URL. Cloudflare documents Access protection for a single Worker's Preview URLs. [Previews](https://developers.cloudflare.com/workers/previews/), [Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

Resources required:

| Resource | Minimum | Isolation / use |
| --- | --- | --- |
| Worker Preview | 1, branch scoped | No production route or custom domain; Vue assets and API on same origin. |
| D1 database | 1 dedicated database | Synthetic fixtures only; bind Preview to its own `database_id`, never the production or shared database. |
| R2 bucket | 1 dedicated bucket | Synthetic listing images only; bind to a unique `bucket_name`. |
| Cloudflare Access app/policy | 1 | Allow only named testers; require sign-in before opening the Preview. |
| Preview secret | 1 synthetic JWT signing secret | Store as a secret, never in Wrangler config or Git. Do not reuse a production secret. |

D1 and R2 are not automatically isolated per Preview: previews sharing a database ID or bucket name share data. Configure dedicated bindings and a matching migration target. [Preview resource isolation](https://developers.cloudflare.com/workers/previews/resources/)

Exclude Cron Triggers from the Preview configuration. The current Worker config has a scheduled image recovery trigger; Cloudflare documents that Cron Triggers target production rather than a Preview. Do not configure service bindings, queues, production secrets, or production data. [Preview limitations](https://developers.cloudflare.com/workers/previews/)

Use Wrangler 4.135.0 or later. Proposed access is limited to the account and required operations: Workers script/Preview deploy, create/use one D1 database, create/use one R2 bucket, and manage one Access application/policy. A deployment token would be scoped to that account and those products; no global API key. Enabling Zero Trust and its Access policy requires account authority to manage Workers and Access. [Preview requirements](https://developers.cloudflare.com/workers/previews/), [Access prerequisites](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## Cost estimate (USD/month)

Expected incremental spend is **$0** only if the account remains on Workers Free and Preview traffic stays within Free limits, with synthetic use below the D1 and R2 allowances. Workers Free includes 100,000 Worker requests/day; D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total; R2 Standard includes 10 GB-month, 1 million Class A and 10 million Class B operations/month, with free egress; Cloudflare Zero Trust Free supports up to 50 users. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)

If Workers Paid is selected, its minimum is **$5/month per account**, before any usage above included limits. This is not an approved cost. R2 overages are $0.015/GB-month Standard storage, $4.50/million Class A and $0.36/million Class B operations. D1 Paid usage beyond included quotas is separately metered. R2 account activation/billing requirements and this account's plan/usage are not verified; therefore the $0 estimate is conditional, not a bill guarantee. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

## First browser journey

Integrate the existing read-only Vue source in this order:

1. Build `apps/web` with Vite and serve its static assets from the Worker; route `/api/*` to Hono on the same origin. Replace the source default `http://localhost:3000` API URL for Preview with a relative `/api` base; retain cookie credentials.
2. Complete public catalog: connect `HomeView.vue` to `GET /api/public/listings` with its current filters and pagination; implement the source-compatible public approved-listing query in D1.
3. Complete property detail and images: connect `ListingView.vue` to `GET /api/public/listings/:id` and public image reads. Only approved/published listings and their images may be visible.
4. Complete contact submission as a separate next journey after catalog/detail: `POST /api/public/listings/:id/contact`, with source validation and synthetic email/contact behavior for Preview.

The current P2 Worker provides OWNER draft/image operations and has no public catalog/detail/contact API. The source Vue app already contains catalog and property-detail views, but expects a local API default. The public endpoints are therefore the first missing vertical slice; no public route should expose DRAFT records or private OWNER images.

After the P2 integration gate clears, implement the local synthetic API journey first, add focused API/UI tests, then run one relevant suite at the consolidated user-journey checkpoint. Connect the protected remote Preview only after separate authorization for resources, possible billing, Access setup, and deployment. Do not make a Preview URL available until Access has been verified.

## Decision requested before remote setup

Authorize creation/deployment only after confirming: (a) the account plan is acceptable, including possible $5/month Workers Paid and R2 billing setup; (b) the dedicated synthetic D1/R2 and Access resources above; and (c) the narrow account-scoped permissions above. No resources were created and no deployment was attempted for this proposal.
