# CF-AU-I04 Pre-Critic Gate — final consolidated local candidate

- Executable commit: `b2ea7130e6f25e5f60df0bb7d41c482908c4961c` (includes prior test hardening `4cc4da4649e9ce75fc8007c4fc9bbffbdd3d9cca`).
- Canonical base: `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- Contract/scope: OWNER individual read and guarded delete; ADMIN assisted discovery/edit/availability/reconfirm/submit/delete; no real authentication.
- Authority: Issue #7 Human decision `6257931179`.

## Review findings closed

- Controller P1: direct public `/listings/:id` URLs now serve the SPA; `/api/*` remains Worker-routed and owner-authorized. E2E asserts HTML and API responses separately.
- GitHub P2: refreshing a SUBMITTED/APPROVED owner listing skips editable image loading; the browser flow covers SUBMITTED refresh.
- GitHub P2: new submit requests are restricted to DRAFT/REJECTED; same-key replay returns its original result; a fresh key on SUBMITTED returns 409 and the Worker test asserts exactly one submit audit row.
- GitHub P2: while assisted fields are unsaved, submit, availability, reconfirm, delete, draft switching and new-draft actions are disabled. Playwright verifies D1 remains unchanged until Save and submit is re-enabled after saving.
- Prior `project_controller` subagent runtime failure is preserved in `evidence/critics/CF-AU-I04-CONTROLLER-8981F7E-BLOCKED.md`; this gate does not treat it as PASS. Fresh separate-process review remains required.

## Verification

- Worker TypeScript: PASS.
- `npm run test:management`: PASS, 1 file / 7 tests, including single audit event after repeated submit.
- Web TypeScript: PASS.
- `npm run build`: PASS.
- `npm run build:preview`: PASS.
- `python3 -B -m unittest discover -s scripts/tests`: PASS, 25 tests (routing configuration unchanged since run).
- Playwright local Workerd + fresh synthetic D1: PASS, 16 checks at 1440 px OWNER / 390 px ADMIN, including all findings, role denial, IDOR, image upload/delete, lifecycle and audit.
- `git diff --cached --check` and canonical consistency validator: PASS.
- Screenshots: `output/playwright/owner-admin-lifecycle-desktop.png`, `output/playwright/owner-admin-lifecycle-mobile.png`.

## Invariants and boundary

Source remains read-only; no real auth or data; backend OWNER/ADMIN authorization and audit actor/target are asserted; D1 image metadata/quota cleanup is tested; cost remains USD 0, no R2, no billing, no new resources, no production or remote Preview changes. Main protection was observed enabled (PR required, `worker` and `web`, enforce admins, no force-push/delete; approvals 0).

**Pre-Critic: PASS to publish one consolidated candidate for fresh exact-head GitHub automatic review/checks and the documented separate Codex Controller process with GPT-6 Luna / High / `--sandbox read-only`.** Not a Controller PASS, merge authorization, or Preview update authorization.
