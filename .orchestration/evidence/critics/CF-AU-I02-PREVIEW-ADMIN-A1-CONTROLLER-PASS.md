# Delegated Controller — Preview ADMIN Artifact A1

- Verdict: **PASS**, bounded to the local/synthetic Preview OWNER/ADMIN identity-switch milestone.
- Artifact: `CF-AU-I02-PREVIEW-ADMIN-Artifact-A1` → `67b3585235f3af7ef6fa9c13b6b2693d92cbeac8`; tree `89e9b4d52089121b5b0abfced437b808e29aa4ed`.
- Canonical base: `42bef5c53abea65720082bbd86da9a082a51ed51`.
- Reviewer provenance: `delegated_codex_separate_process`; requested `gpt-6-luna`, High; CLI arguments accepted `--sandbox read-only`; process exit 0, Codex thread `01a14d33-9af5-79b2-bcf2-9d1892bfe5b1`. Actual provider backend identity: **UNVERIFIED**. Reviewer performed read-only inspection and reported no independent GitHub query.
- Invocation: `codex exec --ephemeral --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only --json -C /home/sjo1848/dev/alquileres-uspa-cloudflare -`.
- Final branch checkpoint supplied to reviewer: `f4d86b4300f584b8ea95f80f1f4ac69703673c72`; difference from tag was limited to state/status/evidence documentation. No executable/test changes followed A1.
- GitHub facts independently checked by the parent at the checkpoint: required `worker`/`web` checks passed, run `39095982852`; automatic review exact-head summary `has_any_findings=false`, `has_unresolved_findings=false`; zero unresolved threads; PR #17 OPEN/CLEAN/MERGEABLE. Main requires PR, strict worker/web and resolved conversations; admin enforcement enabled, force-push/deletion disabled, approvals required 0.

## Review conclusions

The Controller inspected the contract and implementation and found no material blocker in signed Access JWT validation (RS256, pinned issuer/audience, claims, operator identity and exact Preview origin), fixed synthetic OWNER/ADMIN mapping and current D1 role revalidation, session/cookie and origin safeguards, separation from password/production auth, role-specific redirects, or OWNER/ADMIN route isolation. The recorded local Playwright evidence covers the synthetic OWNER submit → explicit ADMIN switch → approve → separate publish → public catalog journey, PASSWORD selector absence and stale redirects in both role-mismatch directions. JWT verification is separately covered by Worker tests; the local browser adapter is not remote Access E2E.

Remote authenticated Preview E2E remains **BLOCKED_AUTH** absent a legitimate operator browser session. This PASS does not authorize changing Access policy or claim remote UI validation. It supports the protected merge gate only when current exact-head checks/review/protections remain green.

## Runtime evidence

The CLI reported 400,433 input tokens (338,816 cached), 5,466 output tokens (3,355 reasoning). A local MCP transport emitted connection-closed diagnostics during startup, but the Codex review process completed normally with exit 0 and returned its report; its inspected repository operations were reads. No write probe was run. The actual provider backend model identity is not exposed and remains unverified.

## Raw reviewer verdict

See `CF-AU-I02-PREVIEW-ADMIN-A1-CONTROLLER-RAW.txt` for the verbatim final reviewer response and session completion metadata.
