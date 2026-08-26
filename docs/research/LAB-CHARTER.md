# Cloudflare Lab Charter — Alquileres Uspallata

## Research question

Can a small but real multi-role rental marketplace built originally with Vue, NestJS, Prisma and PostgreSQL be migrated to a Cloudflare-first architecture while preserving product semantics, reducing infrastructure burden and remaining inside a practical USD 0 operating envelope for laboratory and early low-traffic use?

## Why this is a laboratory

The goal is not only to make the application run. The goal is to generate reusable knowledge.

Each increment must separate:

- what we expected;
- what we tested;
- what actually happened;
- what evidence supports the result;
- what failed or surprised us;
- what lesson can transfer to another project.

## Relation to HMS Cloudflare

HMS Cloudflare is the first migration laboratory. Alquileres Uspallata Cloudflare is the second.

The pair is useful because the source applications differ in domain, auth model, data model and product exposure. Repeated findings across both projects become stronger candidates for reusable method/architecture conclusions.

## Thesis discipline

Do not start by asserting a thesis. Start with hypotheses.

A later cross-project thesis may be formulated only when multiple experiments support a stable claim, for example around:

- feasibility of Workers + D1 for small operational products;
- real free-tier operating envelopes;
- migration patterns from serverful Node/PostgreSQL stacks;
- evidence requirements for parity migrations;
- effectiveness and failure modes of the Project Method / Runtime Watch.

Negative and mixed results are first-class evidence.

## Sources of truth

- GitHub: canonical technical state, contracts, code, evidence and immutable boundaries.
- Google Drive: research archive, readable synthesis, experiment journal and cross-project learning.
- Cloudflare official documentation: current platform capabilities, limits and pricing.

Drive must not become a second mutable runtime state machine.

## Cost rule

The economic hypothesis is `USD 0 within included usage`, not `Cloudflare is always free`.

Every material Cloudflare component must have:

- current free allowance;
- expected workload assumption;
- observable usage metric;
- threshold/risk;
- fallback or Human Gate if payment becomes necessary.

## Safety boundaries

No production, real customer data, irreversible cutover or paid transition is allowed during the lab without an explicit Human Gate.
