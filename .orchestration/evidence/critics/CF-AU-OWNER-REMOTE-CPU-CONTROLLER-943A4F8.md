# Independent provider-evidence review

Exact SHA943a4f8a959880f2c12622675f9d5298cb807a84; base2901f813f5eb6f5b1ad3cbadacf58f0daf8c4040. Actual separate codex exec requested gpt-6-luna/high/read-only with ignore-user-config/ephemeral/json, startup/completion captured, exit0, thread01a144a4-cb7d-7d33-b24b-e4b5f61d83d6. Flags accepted/no fallback observed; backendUNVERIFIED. Tools only read repository files/diff; no writes/tests/build/network or secrets. Raw JSONL compressed adjacent.

## Bounded review — PASS

**Reviewed HEAD:** `943a4f8a959880f2c12622675f9d5298cb807a84`  
**Diff:** `2901f81..943a4f8a959880f2c12622675f9d5298cb807a84`

The probe changes and evidence consistently limit the test to the synthetic Preview. The recorded login outcomes are **200 / 401 / 200**, with a session cookie on successful responses. The initial 403 is recorded separately; it does not establish a provider CPU failure. The probe evidence also records that response times are wall time, not CPU time.

The provider GraphQL query covers **four requests** in the Worker’s experiment window: one health request and three logins. Introspection confirms CPU values are in microseconds. The reported high quantiles are **348.640–446.872 ms**, but the data has no per-request or path correlation, and `previewSlug` is `__unknown__`. These measurements therefore belong to the isolated Worker and time window; they cannot be assigned to individual login requests. All four requests had success status and zero invocation errors. **No 1102 was observed, and no provider failure was demonstrated.**

Cleanup evidence records both the unsuccessful first token deletion while its policy still referenced it and the successful retry after removing that policy. Both temporary token IDs now return 404; temporary policies are removed; the synthetic hash is restored; the operator-only policy is unchanged; and the credential file is absent. Anonymous Preview requests still redirect to Access. This supports the cleanup claim while preserving the negative first attempt.

The operational review provenance records GPT-6 Luna / high / read-only in a separate CLI process. Backend identity remains **UNVERIFIED**; the caller-configured flags are not cryptographic attestation. I did not reread the application code at `68d25f2`; its earlier independent PASS remains unchanged. No tests, builds, or network actions were run for this review.

## Human Gate assessment

This is a genuine Human Gate proposal: it changes the OWNER authentication route for the isolated Preview. The proposed boundary is appropriately narrow—verify the Access JWT signature, issuer and audience; verify the authorized operator identity; map only to the fixed synthetic D1 OWNER; and retain the existing application cookie, Origin, role and ownership checks. It proposes no production use, paid service, password weakening, or broader Access policy. **This assessment does not authorize implementation.**

The CPU evidence supports **retaining the unresolved P1 and Free compatibility gate**. Quantiles far above the documented 10 ms Free budget prevent claiming reliable Free compatibility, even though requests succeeded. The data does not prove that each login exceeded the budget, nor does it demonstrate a provider error or CPU-budget PASS.
