# Independent Technical / Security Critic — CF-AU-I01-P0P1

Reviewer: `/root/i01_technical_critic`, independent from implementation, 2026-10-12.

## Review scope

- `.orchestration/evidence/fixtures/i01-auth/worker.js`
- `.orchestration/evidence/fixtures/i01-auth/tests.mjs`
- `.orchestration/evidence/CF-AU-I01-P0P1-AUTH-RESULTS.json`
- `docs/research/CF-AU-I01-P0P1-BASELINE.md`
- `.orchestration/evidence/CF-AU-I01-P0P1-INTEGRATION-REVIEW.md`

## Findings and rework closure

1. **Bearer token URI decoding:** source decodes the selected Bearer or cookie token before JWT verification. Fixture and tests now cover `%2E` encoded JWT separators for both Bearer and cookie; malformed `%` in either selected value reproduces the source-style pre-verification error. **Closed.**
2. **JWT expiry configuration:** default `15m` and configured `1m` are proven. A bare numeric string (`"120"`) is explicitly excluded: installed `jsonwebtoken` interprets it as 120 ms and floors `exp` to `iat`; the fixture rejects that invalid format before bcrypt or D1 writes. The test checks both source library claim semantics and that no user row remains. **Closed with an explicit configuration divergence.**
3. **Evidence count and timings:** current JSON contains 23 result records and 23 pass results; reports call these grouped checks, not individual assertions. Final benchmark timings are synchronized between result JSON, baseline and cost report. **Closed.**
4. **Email validation:** the fixture regex is not `class-validator` `IsEmail` parity. The limitation is explicit and not promoted to a parity claim. **Scoped unresolved finding; no overclaim.**
5. **Side effects on invalid configuration:** reviewer identified that rejecting a numeric expiry after INSERT could orphan a registration. Fixture now preflights token lifetime before hashing/writing; negative test proves `/auth/register` returns 500 and leaves no matching row. **Closed.**
6. **Other disclosed limitations:** account enumeration timing (unknown account skips bcrypt), malformed URI 500, no rate-limit/CSRF proof, and logout does not revoke already-issued Bearer JWTs remain recorded. They are observations/known source semantics, not hidden findings or claims of risk acceptance.

## Verdict

PASS for the synthetic authentication evidence within this declared scope. This is an internal technical verdict only; it does not replace Integration Review, Pre-Critic Gate or External Independent Critic review, and does not assert complete API/auth parity.
