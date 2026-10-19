# CF-AU-I04 delegated Controller runtime result — BLOCKED_MODEL_CONFIG

- Candidate reviewed: `8981f7e4194b6c0cc89d6d5e7ec95dd0e3c12f72` (base `774d0c747e8ecbbdb97776641becbd9e49875875`); executable repair `87f077ed3a64de36c89a6d4caf985bbd05405c29`.
- Reviewer kind: `delegated_codex_subagent`, configured as `project_controller`.
- Requested configuration: `gpt-6-luna`, High, read-only.
- Result: **BLOCKED_MODEL_CONFIG** because this subagent runtime could not verify its actual selected model and could not verify that read-only restrictions were enforced. No PASS is claimed from this process.

## Technical review observations

- No P0/P1 defect was reported in the inspected candidate. The reviewer verified the public detail `/listings/:id` route falls through to the SPA while `/api/*` remains Worker-routed and OWNER-scoped; it also reviewed submitted-state image refresh, fresh-key duplicate submit rejection, OWNER delete and ADMIN actor/target auditing.
- One test-hardening follow-up: after the fresh-key `SUBMITTED` resubmit returns 409, explicitly assert that the database still contains exactly one `ADMIN_ASSISTED_LISTING_SUBMITTED` audit event. The handler currently rejects before audit preparation; add this regression before final review.
- The reviewer did not run tests, change files, merge, deploy, or access secrets. It observed PR worker/web checks had passed, but its result remains runtime-blocked.

## Required next step

Follow `.orchestration/decisions/CONTROLLER-RUNTIME-CORRECTION.md` and `.orchestration/decisions/DELEGATED-CONTROLLER-OPERATIONAL-VERIFICATION-V2.md`: run a distinct Codex CLI `codex exec` process with explicit `--model gpt-6-luna`, `model_reasoning_effort="high"`, and `--sandbox read-only`, capture arguments/session/result and inspectable raw output, and review the exact final candidate SHA. Backend identity stays `UNVERIFIED` unless independently exposed. Do not silently substitute a model or claim this native subagent was operationally verified.
