# I06.5 GitHub review reworks — OWNER dialogs and mixed image order

PR: [#40](https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/40)

Issue: [#32](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/32)

## `4343754584` — destructive dialog focus

Both the photo-delete and listing-delete dialogs now move focus to their safe cancellation action, keep Tab and Shift+Tab inside the dialog, close on Escape, and restore focus to the trigger when canceled. After a confirmed delete, focus goes to the corresponding section heading because the trigger no longer exists. The leave-dialog code uses the same trap behavior.

Regression: `apps/web/e2e/owner-journey.spec.ts` checks initial focus, both tab directions, Escape/cancel focus restoration, preserved staged-photo preview, and confirmed deletion focus.

## `4343798935` — mixed OWNER photo order

The owner image endpoint now merges repository-managed and D1 BLOB photos by stored `position`, with image `id` as a deterministic tie-breaker. D1 BLOB upload, deletion, and static-asset mutation policy are unchanged.

Regression: `apps/worker/tests/owner-d1-blob-media.test.ts` creates a synthetic D1 upload at position 0 and a repository-managed photo at position 1, then asserts that the OWNER response and public listing return the same order.

## Verification

- Owner browser journey: `npm run test:e2e:owner` — 2/2 passed on local Workerd + D1 synthetic fixtures.
- Worker media regression: `npx vitest run --config vitest.config.ts tests/owner-d1-blob-media.test.ts` — 13/13 passed.
- Web `npm run typecheck` and `npm run build` — PASS.
- Worker `npm run typecheck` — PASS.
- Screenshots are captured by the browser test under `output/playwright/i06.5/` and linked from `QA.md`.

No Preview, production, external email, paid services, R2, real data, or source-repository changes were used.
