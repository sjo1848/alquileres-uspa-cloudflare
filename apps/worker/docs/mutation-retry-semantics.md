# Mutation retry and recovery semantics

The local OWNER image slice uses D1 operation records to reconcile the D1/R2 boundary. A mutation response is based on observable postconditions; failure to confirm a durable outcome returns a retryable error and leaves a nonterminal record for `/__scheduled` recovery.

## Idempotency keys

`Idempotency-Key` is optional for compatibility. When supplied, use the same key and identical request on every retry. Keys are scoped to the owner and operation (listing create, image add, reorder, or delete). Reusing a key with a different request returns `409`. A confirmed replay returns the original result. Without a key, a new request is a new operation; clients cannot identify a lost response as a retry.

## Image operations

- ADD reserves an operation before writing R2, then commits image metadata, operation state, and replay result together in D1. A confirmed object and row permit a `201`; absent or uncertain postconditions do not.
- REORDER checks the exact dense D1 order after ambiguous batch acknowledgments. It returns `200` only after the requested order is observable.
- DELETE backs up R2 before removing the original, then atomically deletes D1 metadata, compacts ordinals, and records the operation. Once target-row absence and exact dense survivor order confirm the logical delete, backup cleanup is recoverable and cannot change the empty `200` response.
- Scheduled recovery verifies D1/R2 state and dense ordinals before marking an operation terminal. A failed repair remains nonterminal and retains the evidence needed for a later retry.

These rules are exercised only against synthetic local D1/R2 bindings. They do not assert atomic transactions across remote D1 and R2 or PostgreSQL lock equivalence.
