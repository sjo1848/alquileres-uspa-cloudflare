# CF-AU-I00 — External Independent Critic REWORK-1

Verdict: `REWORK`
Artifact reviewed: `08fbf91f6e87c45db1d2f97fbb5793f75e1881b7`
Reviewed against canonical contract on `main` after role/critic hardening.
Human Gate: `NONE`
Blocker: `NONE`

## What is accepted from the artifact

- source baseline is pinned and treated read-only;
- source inventory/parity/risk mapping is materially useful;
- local Wrangler proof establishes availability of Worker + D1 + R2 + Web Crypto primitives;
- Cloudflare free-tier figures were sourced from official documentation and the zero-cost claim is framed conditionally;
- negative findings were preserved instead of hidden;
- no production deployment, paid resource or real data was used.

These accepted portions may be reused in REWORK-1; they do not need to be discarded.

## Required REWORK

### 1. Reconcile with current canonical method before republishing

Artifact `08fbf91...` diverges from current canonical `main`; its merge-base is the earlier bootstrap and it does not contain the role/critic hardening now binding for CF-AU-I00.

Rework must start from current canonical `main`, preserve the useful I00 evidence, and satisfy the current Task Contract. Do not overwrite or rewrite the historical artifact.

### 2. Provide required specialist / critic / Integration Review evidence

The current contract requires separated investigation tracks, independent internal falsification and Integration Review for parallel/disjoint work. The reviewed artifact contains no durable evidence proving those boundaries.

Persist evidence showing at minimum:

- source/parity/data specialist track;
- Cloudflare/runtime/cost specialist track;
- independent technical/security/data-parity critic;
- independent research/cost/method-assumption critic;
- findings and autonomous REWORK performed;
- Integration Review across the tracks before Pre-Critic.

A specialist must not approve its own output. Internal critics do not replace the External Independent Critic.

### 3. Repair the external-review boundary/state

The reviewed artifact sets `runtime_status=PENDING_EXTERNAL_REVIEW` while leaving `resume_authorized=true`. It also leaves `external_review.artifact_head=null`, `last_completed_head=null`, and the old authorization event (`seq=1`, `READY_TO_RESUME`) unchanged.

For the next immutable artifact:

- `resume_authorized=false` at the external-review boundary;
- `external_review.required=true`;
- `external_review.artifact_head` must equal the exact full immutable artifact SHA once published;
- `last_completed_head` must identify the completed artifact where applicable;
- event sequence/id/type must advance truthfully;
- `next_action` must point to External Independent Critic;
- state and status must agree.

### 4. Pre-Critic must actually be green

The invariant evidence says `Exact immutable artifact for critic = PENDING` while the Pre-Critic package declares the gate ready/passed. That is contradictory.

No Pre-Critic PASS may be claimed while an applicable invariant is `PENDING`, `FAIL` or `UNPROVEN`. Re-run the gate after the final candidate and record all applicable invariants as PASS with evidence before publication.

### 5. Resolve required auth feasibility, not only primitive availability

CF-AU-I00 explicitly requires proving or disproving auth feasibility using Workers-compatible primitives. Current evidence proves SHA-256 availability but leaves password hashing, exact JWT compatibility and auth CPU suitability unresolved.

Produce a bounded local Workers auth feasibility proof covering at minimum:

- source cookie semantics relevant to parity;
- JWT sign/verify compatibility or an explicitly parity-preserving replacement;
- password hash/verify path compatible with Workers;
- measurement against Workers Free CPU constraints, or a truthful conclusion that this remains incompatible with the USD 0 target;
- positive/negative auth/role cases sufficient for feasibility.

If the source auth semantics cannot fit safely inside the target/free-tier constraint, mark the corresponding hypothesis `REJECTED` or `UNRESOLVED`; do not weaken auth silently.

### 6. Resolve R2 image lifecycle feasibility, not only put/get/delete primitives

CF-AU-I00 explicitly requires proving or disproving R2 object lifecycle feasibility for listing images. The reviewed proof demonstrates primitive R2 operations but not the hypothesis' full ownership/order/metadata/delivery semantics.

Add bounded evidence for:

- object key and D1 metadata relationship;
- listing ownership/authorization boundary;
- image ordering/reorder semantics;
- public delivery path assumptions;
- DB/R2 failure ordering or compensation strategy sufficient to establish feasibility.

This may remain a local synthetic proof; no production/real-data deployment is required.

### 7. Reclassify hypotheses truthfully

The registry marks several full hypotheses `SUPPORTED` while the evidence explicitly says their defining behavior is still unproved.

At minimum revisit:

- H1 frontend portability: no Workers Static Assets browser/runtime proof yet;
- H3 D1 relational parity: deterministic target migration/reconciliation is not yet built;
- H4 R2 listing images: lifecycle authorization/order/metadata/delivery is not yet proven;
- H5 cost-zero early operation: auth CPU feasibility and route-derived workload remain unresolved;
- H6 method portability: this run did not satisfy the now-binding role/critic/integration protocol and required manual publication recovery.

Use only `SUPPORTED`, `REJECTED`, or `UNRESOLVED` as the verdict. A qualifier may explain evidence scope, but must not turn an unresolved defining condition into `SUPPORTED`.

### 8. Complete the cost model at route/data-driver level

The artifact's own `COST-ZERO-MODEL.md` requires product behavior to be converted into a workload model, but the scenarios only contain aggregate Workers/D1/R2 totals.

Add explicit assumptions for at least:

- catalog requests/day;
- listing detail requests/day;
- OWNER/ADMIN requests/day;
- rows read for high-frequency queries;
- writes from login/state/listing/contact operations;
- image count and average image size;
- R2 reads/writes derived from those image assumptions;
- database-size assumption for realistic listing/contact counts;
- CPU/auth constraint where relevant;
- headroom to each applicable free-tier limit.

The current official limits used by the artifact are broadly consistent with Cloudflare documentation, but the cost conclusion remains conditional until these workload drivers and auth CPU feasibility are demonstrated.

## Exit criteria

REWORK-1 is complete only when:

1. the reworked evidence descends from current canonical `main`;
2. required role separation, critics and Integration Review are evidenced;
3. auth feasibility and R2 lifecycle feasibility receive supported/rejected/unresolved evidence-based conclusions;
4. hypotheses are reclassified without overclaiming;
5. cost model is route/data-driver derived and includes CPU/auth risk;
6. Pre-Critic is genuinely green with no applicable pending invariant;
7. a new immutable artifact is published with a valid external-review boundary and exact artifact SHA;
8. canonical state returns to external review without Human Gate or blocker unless new evidence genuinely creates one.

Do not start the next migration increment before CF-AU-I00 receives External Independent Critic PASS.
