# COST-001 — Zero-Cost Laboratory Constraint

Status: `APPROVED`
Date: 2026-08-26

## Decision

The laboratory targets Cloudflare platform cost of USD 0 while usage remains inside included free-tier allowances.

No paid Cloudflare plan, paid feature, recurring third-party service or other material recurring cost may be enabled without a Human Gate.

## Interpretation

This decision does not assert that the finished product will always cost USD 0. It establishes a design and experiment constraint:

- measure usage;
- document free-tier thresholds;
- design for scale-to-zero and low operational overhead;
- identify the growth point where the hypothesis fails;
- stop before enabling paid capacity.

## Scope exclusions

Domain registration, external email/SMS/WhatsApp, paid observability, payment processors and unrelated external services are not presumed free.

## Review trigger

Re-open this decision if a required product behavior cannot be supported safely within the target free-tier envelope or if expected real workload approaches the documented limits.
