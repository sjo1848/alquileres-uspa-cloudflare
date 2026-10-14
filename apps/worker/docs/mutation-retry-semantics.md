# Mutation retry and recovery semantics

The local OWNER image slice uses D1 operation records to reconcile the D1/R2 boundary. A mutation response is based on observable postconditions; failure to confirm a durable outcome returns a retryable error and leaves a nonterminal record for `/__scheduled` recovery.

## Idempotency keys

`Idempotency-Key` is optional for compatibility. When supplied, use the same key and identical request on every retry. Keys are scoped to the owner and operation (listing create, image add, reorder, or delete). Reusing a key with a different request returns `409`. A confirmed replay returns the original result. Without a key, a new request is a new operation; clients cannot identify a lost response as a retry.

## Image operations

- ADD reserves an operation before writing R2 and stores the immutable original response on that operation. It commits image metadata, operation state, and replay result together in D1. A confirmed object, row, and exact committed replay record permit a keyed `201`; if the replay marker is missing, the route returns `503` and a same-key retry repairs the marker from the operation response without deriving a new position from current state. ADD compensation verifies R2 absence with `HEAD`; inconclusive cleanup stays `NEEDS_REPAIR` for scheduled retry.
- REORDER stores its requested result in a D1 operation ledger before changing positions. Commit markers are guarded by the live listing lease, exact image membership, and exact dense D1 ordinals after position writes. A confirmed operation marker and exact replay result permit a keyed `200`; if D1 applied the reorder but did not confirm one ledger marker, a later same-key retry repairs it from the other guarded committed record and returns the original result before examining current cardinality or applying another mutation. A pending retry repairs only its stored plan; other image mutations on that listing receive retryable `503` until the reorder resolves, so they cannot invalidate that plan.
- DELETE backs up R2 before removing the original, then atomically deletes D1 metadata, compacts ordinals, and records the operation. Once target-row absence and exact dense survivor order confirm the logical delete, backup cleanup is recoverable and cannot change the empty `200` response.
- Scheduled recovery verifies D1/R2 state and dense ordinals before marking an operation terminal. `COMPENSATED` records carry an explicit cleanup-complete bit; completed compensation is excluded from future reaper scans, while incomplete backup cleanup remains retryable. A failed repair remains nonterminal and retains the evidence needed for a later retry.
- Listing-create retries insert the originally reserved timestamps, so the committed response and subsequent listing reads agree after a pre-effect failure. Session cookies retain the source application's fixed 900-second `Max-Age`; JWT expiration continues to follow the configured token lifetime.

The Worker fails closed with HTTP 503 if the HMAC secret is missing or shorter than 32 UTF-8 bytes; it never signs or verifies with an empty HMAC key. The local harness has an explicit missing-secret negative test.

These rules are exercised only against synthetic local D1/R2 bindings. They do not assert atomic transactions across remote D1 and R2 or PostgreSQL lock equivalence.
