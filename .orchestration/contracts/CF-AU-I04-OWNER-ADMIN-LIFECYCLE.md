# CF-AU-I04 — OWNER lifecycle and ADMIN-assisted listing management

Status: `ACTIVE`
Base: `main@774d0c747e8ecbbdb97776641becbd9e49875875`
Authority: [Issue #7, Human decision 6257931179](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/7#issuecomment-6257931179)

## Scope

- OWNER: add individual `GET /listings/:id`, owner-scoped and source-state-gated `DELETE /listings/:id`, and UI refresh/delete with explicit confirmation.
- ADMIN assisted: make existing drafts discoverable in the existing assisted UI; edit, change/reconfirm availability, submit for review, and delete only DRAFT/REJECTED items. Derive target OWNER from D1. Write actor/target audit events atomically with mutations and preserve retry results.
- Preserve existing moderation behavior; do not add real authentication, payment/reservation features, or unrelated catalog changes.

## Required proof

- Focused Worker tests for unauthenticated/role denial, cross-owner IDOR, allowed/prohibited statuses, retries, locking, D1 BLOB/static metadata cascade and usage accounting, actor/target audit, and rollback when audit insertion fails.
- Integrated Playwright against isolated local Workerd and synthetic D1, covering OWNER desktop and ADMIN mobile UI journeys, cancellation and confirmation of destructive actions, and audit results.
- Worker/Web typechecks, Web normal and Preview builds, Python regression tests, and deterministic orchestration preflight over all staged/new files.
- One consolidated GitHub review/required `worker` + `web` checks and one delegated read-only `project_controller` review of the exact final SHA. Resolve material findings autonomously before protected merge.
- After protected integration, update only the existing Access-protected private Preview through `wrangler preview`, retain synthetic D1, and verify anonymous Access denial. Record any lack of an authorized remote Access session as `BLOCKED_AUTH`.

## Boundaries

USD 0. No R2, billing, paid/third-party services, new Cloudflare resources, production deployment, real data, Access-policy changes, source-repository writes, or real authentication. Do not start the next product workflow under this contract.
