# CF-AU-I01-P2 REWORK-3 independent security and integrity critique

## Review record

Reviewers: independent `p2_final_retry_audit`, `p2_security_integrity_critic`, and `p2_postfix_critic` agents. Reviews were read-only; reviewers did not edit files or execute the final suite. The final post-fix critic reviewed the source and fault cases at the REWORK-3 implementation head `21433103e8b8b201a442963401f10dc202b405fc` and the canonical merge head `976a670340cc931898492a591c7b066ccdc9a516`.

## Initial adversarial findings and response

The first two reviews identified P1 gaps in ambiguous acknowledgments after listing/reorder/delete commits, unverified D1 writes during deletion, lock fallback readback failures, replay of confirmed operations after a lost HTTP response, and incomplete sparse-order recovery assertions. No P0 was identified. The implementation/test changes in `2143310` addressed these paths with request idempotency and fingerprint conflict handling, commit readback, safer backup cleanup semantics, explicit dense-order checks, retained recovery state/backups on repair failure, R2/D1 consistency assertions and subsequent convergence checks.

## Internal post-fix verdict before delegated Controller

The post-fix reviewer found **no concrete remaining P0/P1 or material blocker** in the addressed acknowledgment, retry, compensation and recovery family. It confirmed that the added before/after-effect and zero-change fault paths test resulting HTTP behavior and durable D1/R2 postconditions, including subsequent recovery. The complete final runtime result is separate and recorded in `CF-AU-I01-P2-VALIDATION.md`.

This is a bounded internal critique, not a delegated Controller verdict, external independent approval, full security certification, or claim of atomic D1/R2 behavior. It is limited to the local synthetic P2 implementation and its tests.

## Delegated Controller review and REWORK

The configured read-only Codex review process was invoked with requested model `gpt-6-luna`, effort `high`, and CLI sandbox `read-only` for candidate `98cec68d81c7f80a7371ec5d60c80467d1cee476`, base `be60c4efbe5412d8a5317ba4d200b9a772c0cbd5`. The process completed but could not attest backend runtime model identity, so actual model evidence is recorded as **unverified**. It issued **REWORK** with one P1:

- If D1 removes the DELETE target but the survivor-order update is ignored/fails, the handler returned 503 at the old `index.ts` line 200 although the logical deletion had committed. The reviewer gave a concrete `BEFORE UPDATE ON listing_images ... RAISE(IGNORE)` harness counterexample and noted missing HTTP/replay coverage for this branch.

The fix makes an absent target plus its matching durable idempotency record and DELETE ledger an acknowledged delete: the handler records `NEEDS_REPAIR`, commits the replay record, returns 200, and lets the reaper repair dense ordering and cleanup. Same-key replay preserves 200 while repair remains pending. A new local HTTP test injects the ignored update, checks D1/R2 absence, ledger and idempotency state, replay status, and verifies scheduled convergence after removing the trigger. Final fresh-state suite passed in 798.4 seconds. A two-hour expiry was configured only in `wrangler.test.jsonc` because a failed earlier full run reached the 15-minute synthetic login-cookie expiry; the production Worker default and explicit JWT expiry/forgery checks did not change.

The final code was submitted for read-only internal re-critique after this correction. Their verdicts are recorded below when received. The delegated Controller must review the new exact immutable candidate before any substantive PASS is claimed.

## GitHub automatic review of consolidated candidate and bounded corrections

GitHub automatic review of `d4445c2af1abbfef813f0f8e06b630c4e981cf4e` completed at 2026-10-13T19:19:37Z. It found a P2 retry-order defect: current list cardinality validation could preempt replay of a committed reorder after another image was deleted. The correction moves same-fingerprint `COMMITTED` result replay before current list cardinality validation, validates stored JSON as an array, retains auth/fingerprint/list-lock checks, and adds a three-image true reorder → different-image delete → out-of-range same-key replay test. The test checks the preserved historical result and current dense D1 state.

### Independent P1 re-critique: no-op reorder idempotency write

The security/integrity critic found that the previous no-op reorder fast path returned 200 after swallowing a failed D1 idempotency-state write. If the row remained `PENDING`, a same-key replay after other mutations could apply a later state change that the earlier 200 had represented as complete. This was classified P1 because it breaks acknowledged idempotency within the audited failure/retry class.

The repair adds a fingerprint/state-fenced update and requires `meta.changes === 1`, or a readback proving the exact matching `COMMITTED` result, before 200. If neither can be confirmed, it returns 503. Test-only before/after D1 update fault controls demonstrate: pre-effect failure returns 503 and leaves `PENDING`, after which a retry can perform the requested absolute-position operation; post-effect acknowledgment loss is read back as `COMMITTED` and returns 200, after which same-key replay preserves the stored result despite changed cardinality. Both latest independent read-only critics found **no remaining P0/P1 or material blocker** in the complete reorder replay/failure case. One optional P2 follow-up suggested also testing semantically malformed but parseable result JSON; the handler rejects non-array JSON, and this out-of-band corruption case is not a current contract blocker.

The complete fresh local suite was rerun after these fixes and passed at 891.9 seconds; exact provenance is in the validation ledger. These critics inspected the changed source/tests and did not run the suite.

## DELETE dense-order and committed-replay review findings

GitHub automatic review of `a7cbd8087576c3229267c5d60c2326eb0e08ceb2` completed 2026-10-13T19:45:17Z with two findings (threads `discussion_r4263240057`, `discussion_r4263240075`): P1, DELETE returned 200 while survivor compaction was unconfirmed and GET list stayed blocked; P2, an already-confirmed DELETE replay revalidated R2 and could turn a durable result into 503 on a transient HEAD error.

The initial repair now returns 503 while dense ordering is unconfirmed and preserves repairable operation/idempotency state; same-key 200 occurs after exact dense recovery. Confirmed DELETE replay skips R2 only when the stored idempotency record and DELETE operation are committed/cleanup-pending/cleaned **and** current D1 order is freshly verified dense. R2 backup cleanup remains recoverable through the scheduled reaper.

`p2_postfix_critic` and `p2_security_integrity_critic` then identified the stale-marker P1 counterexample: the D1 batch might persist COMMITTED markers while an ignored compaction leaves sparse ordinals, and the subsequent downgrade writes could themselves have zero effect. The committed replay shortcut now checks exact `orderIs(...)`; it cannot return 200 on sparse order, regardless of marker values. A fault test installs `RAISE(IGNORE)` triggers for survivor updates and both repair-state downgrades, asserts the sparse read remains 503 and repeated DELETE remains 503, then allows durable NEEDS_REPAIR, scheduled recovery, cleanup, and same-key 200. Separate committed replays with injected R2 HEAD-before/after errors remain 200 without invoking the R2 check.

Both internal critics independently re-reviewed the final working tree and found no remaining P0/P1 or material blocker; they did not edit files or run the suite. Final runtime verification after these changes passed in 828.8 seconds, with typecheck, HTTP syntax and diff whitespace checks PASS. Exact output and environment are in `CF-AU-I01-P2-VALIDATION.md`. Residual limitation: if D1 cannot persist either repair marker indefinitely, the handler fails closed with 503 and cannot promise recovery absent durable storage; no success is claimed.

### `p2_postfix_critic` re-critique

Read-only review of the fix and new HTTP scenario found **no concrete P0/P1 counterexample or material blocker**. It confirmed the intended 200, committed same-key replay, retained `NEEDS_REPAIR` state/backup, and reaper convergence after the trigger is removed. The reviewer did not edit files or run the suite.

### Final tri-state / sparse-read re-critique

After the additional review findings, both `p2_postfix_critic` and `p2_security_integrity_critic` re-reviewed the latest code and tests. Both found **no remaining P0/P1** on the addressed paths. They confirmed: R2 HEAD before/after exceptions return 503 and preserve `NEEDS_REPAIR` plus backup; the sparse D1 position is asserted before recovery; the HTTP list returns 503 instead of exposing non-dense ordinals; same-key retry remains bounded; and removing the trigger lets scheduled recovery compact positions, clean R2 backup, mark `CLEANED`, and reopen the list. The critics did not edit files or run tests. Their only stated systemic limit is that if D1 cannot persist either recovery marker, a durable recovery system cannot guarantee it; the committed operation state remains reaper-eligible in the tested path.
