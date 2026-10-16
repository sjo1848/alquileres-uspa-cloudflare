# CF-AU-I01-P2 — historical ADD replay internal critique

Date: 2026-10-14. Scope: uncommitted repair to keyed upload replay after a subsequent confirmed image deletion, plus equivalent image mutation replay paths. All reviewers were independent, read-only, and were instructed not to edit or run tests.

## Reviewers and findings

- `review_idempotency`: no actionable P0/P1/P2. Confirmed owner/scope/key/fingerprint fencing, exact image ID/result checks, durable COMMITTED-marker confirmation, and no D1/R2 recreation. Verified the regression test asserts original status/body and continued absence of D1/R2 image data.
- `review_recovery`: no actionable P0/P1/P2 in upload, reorder, delete, and recovery paths. Noted a nonblocking observation that replay validates result ID and nonnegative integer position rather than the full current response DTO. The result is internally generated and bound to the exact fingerprint and committed marker; this did not warrant a finding.
- `reorder_concurrency`: no actionable P0/P1/P2. The per-listing lease serializes ADD replay and DELETE; historical replay returns without changing resource state. Reorder returns stored historical state without reapplication; confirmed delete replay checks durable terminal operation state and dense survivor order.

## Reviewed code and test evidence

- `apps/worker/src/index.ts`: keyed ADD lookup and missing-row committed replay near the image upload route; equivalent keyed REORDER and DELETE replay paths.
- `apps/worker/tests/http.mjs`: upload → delete → replay regression with exact original response, D1 row absence, and image GET 404 after replay.
- `apps/worker/docs/mutation-retry-semantics.md`: confirmed replay returns the original result; retry semantics remain explicit.
- Test execution was performed separately by the orchestrator and is recorded in `CF-AU-I01-P2-VALIDATION.md`.

## Verdict and limits

No actionable P0/P1/P2 remains in the reviewed category. These are internal static critiques and do not replace GitHub automated review or the separate exact-SHA Controller review. They do not establish remote Cloudflare behavior, D1/R2 cross-service atomicity, or complete parity.

## Follow-up review — ADD COMMITTED with idempotency PENDING (2026-10-14)

Reviewers `review_idempotency` and `review_recovery` independently inspected the follow-up for GitHub finding `4277039345`. The reproduction leaves the ADD operation `COMMITTED`, its matching replay marker `PENDING`, deletes the image via a separately confirmed DELETE, then retries the original ADD key. The route returns the stored result from the committed operation after owner/scope/fingerprint/resource validation and confirms the marker before returning; this path occurs before D1/R2 creation. The HTTP test asserts original JSON and no D1 row/R2 bytes. Both reviewers found no additional actionable P0/P1/P2. Review was static/read-only; final runtime suite provenance is in the validation ledger.

## Follow-up review — DELETE plan recovery staging (2026-10-14)

The recovery reviewer reproduced and confirmed repair of the D1 unique-ordinal collision from reused staging ordinals. The concurrency reviewer and recovery reviewer checked that staging begins above current MAX(position), includes the full staged interval in the safe-integer bound, and is fenced by the active listing lease. The test retains the operation backup while an injected trigger blocks ordering, then verifies scheduled restoration after the trigger is removed; a near-safe-integer ordinal fails closed without D1/R2 mutation. No actionable P0/P1/P2 remained after this repair. Static review only; the final complete local suite passed separately and is recorded in `CF-AU-I01-P2-VALIDATION.md`.
