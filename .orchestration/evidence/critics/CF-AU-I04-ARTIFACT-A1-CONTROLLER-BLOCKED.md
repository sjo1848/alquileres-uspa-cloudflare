# CF-AU-I04 Artifact A1 Controller result

- Reviewer role: `project_controller`; provenance: delegated separate `codex exec` process.
- Exact Artifact A1 executable SHA: `1122de39f497e0635b8405210c6efb48e77916ba`; tree `f5c1ce104875e8a5b948e06512460c72b61e89de`; base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- Requested CLI config: `--model gpt-6-luna`, `model_reasoning_effort="high"`, `--sandbox read-only`; CLI `codex-cli 0.163.0`; thread `01a15234-babf-77d3-a09c-b39ab7fff6e7`; process returned the reviewer message with shell status 0. Invocation output and final message are preserved next to this report.
- CLI requested the model/effort and read-only sandbox. The reviewer did not claim provider-level backend attestation; actual backend identity remains `UNVERIFIED`.
- Verdict: **BLOCKED**. The reviewer found no P0/P1 in the inspected A1 code and confirmed the availability/reconfirmation status repair. Its focused Vitest attempt stopped before test startup with `EROFS` while writing `apps/worker/node_modules/.vite-temp`; it did not execute tests and therefore did not issue PASS. The parent separately executed the test suite successfully, but does not override the Controller's verdict.
- GitHub's review of the same candidate then surfaced two P2 findings: dirty OWNER refresh could overwrite edits; ADMIN draft discovery was capped at 50. A1 is retained as immutable history and is **superseded by Artifact A2** after these bounded repairs.

Evidence: final output `CF-AU-I04-ARTIFACT-A1-CONTROLLER-BLOCKED-OUTPUT.md`, prompt `...-PROMPT.md`, complete JSONL `...-RAW.jsonl.gz`. No files were written by the Controller, no deployment or merge occurred.
