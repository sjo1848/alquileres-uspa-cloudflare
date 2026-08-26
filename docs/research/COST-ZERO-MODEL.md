# Cost-Zero Model — Alquileres Uspallata Cloudflare

Observed: 2026-08-26
Authority: current Cloudflare official documentation. Revalidate before any deployment/cost decision.

## Hypothesis

The laboratory and plausible early low-traffic use can run with Cloudflare platform cost of USD 0 while remaining within included Workers Free, D1 Free and R2 Standard free-tier usage.

This is a conditional hypothesis, not a guarantee.

## Current included envelope

### Workers Free

Observed current limit:

- 100,000 requests/day.
- 10 ms CPU time/request on Workers Free.
- 128 MB memory.
- 50 subrequests/request.

Source: https://developers.cloudflare.com/workers/platform/limits/

### D1 on Workers Free

Observed current included usage:

- 5,000,000 rows read/day.
- 100,000 rows written/day.
- 5 GB total storage across the account.
- 10 databases on Free.
- 500 MB maximum size per D1 database on Free.

Sources:

- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/

### R2 Standard

Observed monthly free tier:

- 10 GB-month storage.
- 1,000,000 Class A operations/month.
- 10,000,000 Class B operations/month.
- internet egress: no R2 egress charge.

Source: https://developers.cloudflare.com/r2/pricing/

## What is not automatically free

- custom domain registration;
- external email/SMS/WhatsApp providers;
- third-party observability;
- usage above included Cloudflare limits;
- paid Cloudflare plan/features;
- any future service introduced by the product.

No such cost may be silently added.

## I00 required model

CF-AU-I00 must convert product behavior into a workload model containing at least:

- public catalog requests/day;
- listing detail requests/day;
- OWNER/ADMIN requests/day;
- expected D1 rows read per high-frequency route;
- writes caused by login/state changes/listing edits/contact events;
- image count, average image size, R2 read/write operations;
- expected database size at realistic listing/lead counts;
- headroom against Workers/D1/R2 limits.

At minimum model three scenarios:

1. laboratory/demo;
2. early local adoption;
3. growth threshold where free-tier assumptions fail.

## Cost gate

If a required architecture or expected workload requires paid Cloudflare capacity, CF-AU-I00 must not hide it. Record the threshold and stop at a Human Gate before enabling cost.
