# PM-AUTONOMY-001 — Authority, Autonomy and Review Separation

Status: `APPROVED`
Date: 2026-08-26

## Decision

The Human is Product/Risk Authority, ChatGPT is External Project Controller / Method Custodian / Independent Critic / Human-Gate Classifier, and Codex is Runtime Orchestrator / Execution Owner.

Routine technical coordination belongs to Codex and its specialists/critics. The Human is not a dispatcher or technical relay.

## Codex autonomy

Once a Task Contract is authorized, Codex owns the routine loop through research/implementation, tests, internal adversarial QA, bounded REWORK, Integration Review when applicable, evidence, Pre-Critic and immutable-artifact preparation.

Routine defects, red tests, migration/tooling failures, incomplete evidence and bounded external REWORK are not Human Gates.

## Specialist / critic separation

- Specialists cannot approve their own substantive output.
- Critics must be independent from the implementation surface they falsify.
- Parallel/disjoint work requires Integration Review before Pre-Critic.
- Internal critics do not replace ChatGPT External Independent Critic.

## External controller

ChatGPT audits exact immutable artifacts and canonical evidence and classifies `PASS / REWORK / BLOCKED / HUMAN_GATE`.

When that verdict changes execution authorization, it must be persisted in GitHub canonical state so Codex consumes it directly. The Human must not be used to carry review findings between ChatGPT and Codex.

## Human Gates

Human involvement is reserved for material product intent/scope, architecture trade-offs, security/risk acceptance, paid/material recurring cost, irreversible migration/cutover, real data, production and Product Acceptance.

ChatGPT classifies whether a Human Gate genuinely exists; the Human decides it.

## Runtime Watch boundary

A future Runtime Watch may only continue work already authorized by canonical state. It is a scheduler/continuation mechanism, not an authority source and not a reviewer.
