# Hypothesis Registry — Alquileres Uspallata Cloudflare

Status values: `OPEN`, `SUPPORTED`, `REJECTED`, `UNRESOLVED`.

## H1 — Frontend portability

Hypothesis: Vue 3 + Vite can remain materially unchanged and be served through Cloudflare Workers Static Assets with no material catalog/OWNER UX regression.

Initial status: `OPEN`.

Falsify if: required browser behavior, routing, asset behavior or deployment constraints force material product regression or a paid-only dependency.

## H2 — API portability

Hypothesis: existing NestJS route/domain behavior can be ported to Workers/Hono/TypeScript with parity in validation, ownership, ADMIN/OWNER authorization and error semantics.

Initial status: `OPEN`.

Falsify if: a required behavior depends on Node/server primitives that cannot be replaced without material product/security change.

## H3 — D1 relational parity

Hypothesis: the existing PostgreSQL/Prisma model can be represented in D1 without silent semantic inference and with reproducible migration/reconciliation evidence.

Initial status: `OPEN`.

Falsify if: required relational/transactional behavior cannot be represented safely or migration ambiguity cannot be reconciled truthfully.

## H4 — R2 listing images

Hypothesis: R2 can replace the current image object-storage behavior while preserving ownership, ordering, metadata and delivery semantics.

Initial status: `OPEN`.

Falsify if: required object lifecycle or authorization cannot be implemented safely within the target architecture.

## H5 — Cost-zero envelope

Hypothesis: the lab and plausible early low-traffic operation fit inside Workers/D1/R2 included usage, keeping Cloudflare platform cost at USD 0.

Initial status: `OPEN`.

Falsify if: normal expected usage exceeds free allowances, a required feature is paid-only, or the architecture requires another recurring paid dependency.

## H6 — Method portability

Hypothesis: the Project Method can transfer from HMS to this project with fewer routine human coordination steps while maintaining evidence quality.

Initial status: `OPEN`.

Falsify if: repeated manual dispatch, ambiguous state, critic leakage, non-reproducible artifacts or other orchestration defects materially undermine autonomy/auditability.

## Cross-project thesis candidate

No thesis is accepted yet. After sufficient HMS + Alquileres evidence, evaluate whether a defensible claim can be made about low-cost Cloudflare migration and autonomous evidence-driven software delivery for small operational systems.
