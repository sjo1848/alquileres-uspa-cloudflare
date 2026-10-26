# D3.1 private Preview publication — 2026-10-26

- Source: protected `main@e1f319bfb5dc1f0b1a76a6761b7b67018b338e9f`, tree `9a5373241e9025c5a722dff2205c8b9c5b6c052f`. The build artifact tree matched this main tree.
- Existing Preview: `private`, Worker `alquileres-uspa-lab`; existing synthetic D1 `alquileres-uspa-preview-synthetic`.
- Migration: `0013_owner_auth_local.sql` applied to the existing synthetic D1 after provenance support, private backup, local import/rehearsal, exact target/hash checks, Access preflight, and current-main verification. Post-migration metadata matched the provenance manifest; no migration remains pending.
- Wrangler publication: `wrangler preview --name private --worker-name alquileres-uspa-lab`, message pinned to the main SHA above. Cloudflare's latest Preview API now confirms deployment `7f9cc4a7-9a96-477e-8e34-77594fe5df53` at `https://7f9cc4a7-alquileres-uspa-lab.sjo1848.workers.dev` and the stable URL `https://private-alquileres-uspa-lab.sjo1848.workers.dev`.
- After publication: `JWT_SECRET` exists (its value was not read); 12/12 anonymous route probes across stable and immutable URLs were denied by Cloudflare Access. Access policy unchanged.
- Remote authenticated browser E2E remains `BLOCKED_AUTH` because this executor has no authenticated Access browser session. No authenticated PASS is claimed; the operator can use the existing stable URL and Access identity for visual evaluation.
- No production, billing, R2, new resource, Access-policy change, seed, real-data use, or source-repository write occurred.

## Automation follow-up

The first local Wrangler invocation published successfully, but its post-command parser did not find JSON on stdout. Inspection of the pinned Wrangler CLI showed that `--json` writes structured data to `WRANGLER_OUTPUT_FILE_PATH`; the fail-closed workflow fix is being delivered in functional PR #51. The Preview was verified through Cloudflare's read-only latest-deployment API and Access smoke after publication; no second deploy was run to compensate for the parser failure.
