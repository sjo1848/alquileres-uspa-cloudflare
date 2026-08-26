# CF-AU-I00 — Invariant evidence

Artifact candidate: `CF-AU-I00`  
Observed: 2026-08-26  
Source baseline: `sjo1848/alquileres-uspa@cff14159daa1698a9ee04ea317c4a2c356112ae0`

| Invariant | Classification | Evidence | Status |
|---|---|---|---|
| Source is read-only reference | APPLIES | Read-only clone at pinned HEAD; no source write | PASS |
| Parity-first/no expansion | APPLIES | Contract scope, source inventory and non-goals | PASS |
| OWNER isolation / ADMIN backend auth | APPLIES | Source guards/controllers plus parity matrix; target API proof is explicitly next-increment scope | PASS for I00 scope |
| Public catalog truthfulness | APPLIES | Source predicate and legacy-null rules recorded; target API proof is explicitly next-increment scope | PASS for I00 scope |
| No semantic inference | APPLIES | I13 migration and risk map preserve legacy fields | PASS |
| Image metadata/order/object consistency | APPLIES | Source schema unique constraints; local R2/D1 proof | PASS for primitive feasibility |
| Audit traceability | APPLIES | Source audit model recorded; target implementation is a declared next-increment risk | PASS for I00 scope |
| Auth semantics unchanged | APPLIES | Cookie/JWT behavior inventoried; password hashing path is a declared next-increment risk | PASS for I00 scope |
| No real data/production/paid transition | APPLIES | Local-only Wrangler execution; no remote resource or source mutation | PASS |
| Conditional cost-zero claim | APPLIES | Official limits/pricing and quantified envelope in COST-ZERO-MODEL | PASS conditionally |
| GitHub canonical state | APPLIES | Evidence committed in this repository only | PASS |
| Drive archive does not override runtime | APPLIES | No Drive state used for execution | PASS |
| Codex does not self-PASS substantive work | APPLIES | This artifact is marked pending Independent Critic; no PASS declared | PASS |
| Routine failures are REWORK | APPLIES | Wrangler fixture path failure repaired and rerun successfully | PASS |
| Pre-Critic evidence required | APPLIES | This file and linked evidence prepared | PASS for gate package |
| Exact immutable artifact for critic | APPLIES | Requires commit boundary after final checks | PENDING |

## Primitive evidence

Command executed locally with Wrangler `4.126.0`:

```text
npx wrangler@latest dev --config cf-au-primitive-proof-wrangler.jsonc --local --port 8799
curl --fail --silent http://127.0.0.1:8799/proof
```

Observed response:

```json
{"r2":{"key":"listing-a/1.txt","body":"image-proof","deleted":true},"d1":{"owner_id":"owner-a","object_key":"listing-a/1.txt"},"webCryptoSha256":"509654d358985c36511fa38d69703328345f9127d2753e42b3400dcbc314d31c"}
```

This proves local target-runtime primitive availability only. It does not prove production latency, security acceptance, password-hash suitability or remote account billing behavior.
