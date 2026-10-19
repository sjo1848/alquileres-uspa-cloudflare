# Controller review — CF-AU-I05 logout repair

- Verdict: **PASS**. P0: none. P1: none. P2: none.
- Exact executable commit: `8ae6186a310fa665da1cc199ef3aef575b538843`; tree: `7f808d0dbe139ab2812f74925cac7105a40ab219`.
- Base: `093bd9128653281b79599caf61bb6fa979b8fb49`.
- Reviewer process: separate `codex exec`, thread `01a15410-8f45-7d80-9fe5-d10b5f3ef06d`, CLI `0.163.0`, exit 0; requested model `gpt-6-luna`, reasoning `high`, sandbox `read-only`. Invocation/config accepted; backend model identity is **UNVERIFIED**. `--sandbox read-only` process made no file edits and ran no tests.
- Scope: logout repair, session-version enforcement, role gates, regression tests, and Access Preview invariants.
- Controller response:

PASS

P0: none. P1: none. P2: none.

Verified commit `8ae6186a310fa665da1cc199ef3aef575b538843` has tree `7f808d0dbe139ab2812f74925cac7105a40ab219`. Logout verifies and deduplicates supplied bearer and cookie tokens, revokes matching session versions, returns 503 on D1 update errors, and enforces same-origin requests in [index.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/src/index.ts:94). Protected routes check session versions and retain OWNER/ADMIN role gates in [index.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/src/index.ts:111). The local lifecycle assertions cover cookie and bearer logout for OWNER and ADMIN in [local-owner-auth.test.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/tests/local-owner-auth.test.ts:43); existing Access Preview assertions remain consistent with session version `0` in [preview-auth.test.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/tests/preview-auth.test.ts:39).

Read-only review; tests were not run.
