# CF-AU-I01-P2 REWORK-1 — independent JWT test-quality review

Reviewer: independent security critic agent. Scope limited to the two A1-F1/A1-F2 regression tests in `apps/worker/tests/http.mjs`; static review only, no edits and no runtime execution.

## Expiry check

The active control at lines 23–24 uses the seeded `owner-a` / `owner.a@example.test` identity, a correct HMAC using the local test secret, current `iat`, and `exp=now+3600`; it is accepted (200). The negative variant preserves that identity and correct key but sets `iat=exp=1`; it is denied (401). Since the subject exists and the active positive control succeeds, disabling expiry enforcement would let the negative token pass, so this isolates expiry validation rather than parsing or DB identity.

## Signature check

At line 65 the forged token reuses those structurally valid, unexpired owner claims and HS256 header but uses `deliberately-wrong-test-key`; it is denied (401). The correctly signed identical claims were already accepted (200) at line 24. The 1-hour expiration leaves substantial margin for this later assertion relative to the full-suite runtimes recorded in validation evidence. Skipping signature verification would let the forged token pass, so this isolates HMAC validation rather than parsing, expiry or identity.

## Verdict

**Bounded PASS** for both test-quality findings. No application Worker code changed. This is independent static QA, not execution or an application security certification. Runtime validation is recorded separately in `../CF-AU-I01-P2-VALIDATION.md` after the final full suite completes.
