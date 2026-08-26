# CF-AU-I00 — Pre-Critic package

Candidate status: `READY_FOR_EXTERNAL_INDEPENDENT_CRITIC`  
Scope: discovery/feasibility only; no product migration claimed.

## Contract

- Active contract: `.orchestration/contracts/CF-AU-I00.md`; scope unchanged.
- Acceptance evidence: hypotheses and verdicts in `docs/research/HYPOTHESES.md`; source/parity/risk evidence in `docs/research/`.
- Product acceptance dependency: source I13 acceptance remains pending and is not assumed.
- No paid, production, irreversible or real-data scope added.

## Invariants

`.orchestration/evidence/CF-AU-I00-INVARIANTS.md` classifies every project/method invariant for the I00 scope. All are PASS for this discovery artifact; unresolved target implementation details are preserved as explicit next-increment risks rather than promoted to migration claims.

## Research truthfulness

- Each H1–H6 has a falsification criterion and a verdict.
- Observations, conditional inferences and unresolved implementation risks are distinguished.
- Cloudflare limits/pricing were checked against official documentation on 2026-08-26 and linked in `COST-ZERO-MODEL.md`.
- Negative findings are retained: password hashing, transaction/R2 compensation, audit JSON/delete semantics and browser deployment remain unresolved.
- Cost-zero scenarios include assumptions, headroom and a Human Gate threshold.

## Technical evidence

- `git diff --check` passes.
- Source HEAD verification and read-only inventory completed.
- Wrangler local D1 schema/query/owner-filter proof passed.
- Wrangler local Worker with D1 + R2 + Web Crypto bindings passed the put/get/delete/query/hash proof.
- No remote Cloudflare command, deployment, real data or paid resource was used.

## Gate result

The artifact is ready to be committed as an immutable review boundary. Codex does not self-approve the substantive migration; the next authority is the ChatGPT External Independent Critic.
