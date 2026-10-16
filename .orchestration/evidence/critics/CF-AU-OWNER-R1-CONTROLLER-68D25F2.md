# OWNER review corrections — local Controller

Candidate `68d25f2fe0d9f7e803228147f8d61d8eaa33aa72`; base `632fa07e2d0c00ad2c87bafdf5ee7a90a13b47f2`. Separate `codex exec --json --ephemeral --ignore-user-config --model gpt-6-luna -c model_reasoning_effort=high --sandbox read-only`; flags accepted, exit0, thread `01a1448e-2b34-7472-9f5a-fbb54daacc3c`. No fallback observed; backend identity UNVERIFIED. Observed tools only read git/code/tests/evidence; no edits/build/tests/network or secrets. Raw JSONL compressed adjacent.

**Bounded verdict: PASS** for the scoped corrections at `HEAD 68d25f2fe0d9f7e803228147f8d61d8eaa33aa72`, reviewed against `632fa07e2d0c00ad2c87bafdf5ee7a90a13b47f2`.

- **Migrated NULL rental fields:** submission reloads the owner’s listing under its lock and validates it before changing status. The added test covers all five nullable columns across DRAFT and REJECTED cases; it checks submission is rejected without changing status or leaving a lock, then permits submission after repair.
- **Public session restore:** public navigation starts session restoration without awaiting it. Protected navigation joins the in-flight restore; the supplied browser evidence covers pending restore, public rendering, header restoration, and a stubbed 503 auth response. This supports the requested nonblocking behavior; it does not establish remote auth behavior.
- **Event 56 consistency:** the latest STATE entry and STATUS event both identify sequence 56, record the accepted public Preview scope, and leave OWNER unaccepted. The recorded 5/5 acceptance remains limited to the public catalog/detail journey.

The reported owner 4/4, catalog 7/7, typechecks, build, and browser results are executor evidence; I did not rerun them. No material defect in these corrections found in this read-only review.

**Next material boundary:** GitHub P1 `4294160247` remains open. The 474–534 ms dedicated Node bcrypt proxy is evidence about that local run, not Cloudflare CPU telemetry; it proves neither remote failure nor compatibility. Obtain safe, authorized provider CPU evidence if available. If parity-preserving auth cannot be established under the strict USD 0 constraint, the remaining boundary is an explicit Human auth architecture/risk decision before OWNER release. Missing provider proof is a blocker to that compatibility claim and OWNER release, not a reason to reopen the accepted catalog checks or defer routine local work. No auth weakening, paid fallback, remote changes, or merge is authorized by this review.

Review provenance: requested CLI configuration is `gpt-6-luna` / high / read-only; backend identity remains **UNVERIFIED**.
