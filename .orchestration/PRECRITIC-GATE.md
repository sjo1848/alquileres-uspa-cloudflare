## CF-AU-I06.4 — cierre de reworks GitHub; Pre-Critic de integración (2026-10-21)

- Contrato público I06.4, base `main@cc91463d81b1b7d19d0cb44912772f1cd10ecf8e`, candidato ejecutable final `6891e618e3a30fcfb00aef2adfa3c3883c03d4b4`. Dirección C, #31; #32/#33/I06.5 fuera.
- Tres hallazgos P2 GitHub corregidos y probados en el mismo PR #39: página guardada fuera del nuevo total; monto sin periodicidad/capacidad; capacidad >6. Evidencias `CF-AU-I06.4-GITHUB-REWORK-4320588628.md`, `...-4320628608.md`, `...-4343003402.md`. Hilos respondidos y resueltos.
- Web typecheck PASS. Playwright Vue + Worker/Hono + D1 sintética local 4/4 (1.5m), con páginas/filtros, precio incompleto, capacidad 8, contacto/idempotencia, errores/retries, keyboard/focus/contrast y mobile 320/390; capturas runtime desktop/mobile conservadas. Worker tests catalog 7/7 y contact 6/6 anteriores aplican porque Worker runtime/API no cambiaron; CI exacta volvió a correr Worker y Web tras las tres reparaciones.
- Controller delegated separate-process PASS acumulativo: inicial `2674264`, reparación precio/página `3d0662d`, delta capacidad `6891e61`. GPT-6 Luna/High y `--sandbox read-only` solicitados y aceptados; runtime backend UNVERIFIED. Informes inspeccionables en `evidence/critics/CF-AU-I06.4-CONTROLLER-{2674264,3D0662D,6891E61}-PASS.md`. El Controller no ejecutó pruebas; QA/CI son evidencia separada.
- Review GitHub exacta sobre `6891e61` finalizó con `has_any_findings=false`, `has_unresolved_findings=false`; CI `worker`/`web` SUCCESS; branch protection observada: required checks strict `worker`,`web`, enforce-admins true, required approvals 0. Mergeable/clean tras review, pero revalidar inmediatamente antes del merge.
- **Pre-Critic PASS para integración protegida de I06.4 tras un último checkpoint evidencia-only** con tres reportes Controller y esta gate. Ese commit cambiará HEAD y reiniciará checks/review; no modificar código. Requerir PASS de ambos checks, review sin hallazgos ni hilos abiertos, mergeability/protección intactas sobre el nuevo HEAD y validador. Solo entonces hacer merge commit preservando historia. No Preview, despliegue, gasto, real data, R2, OWNER/ADMIN, source writes ni producción.

## CF-AU-I06.4 — P2 de página fuera de rango; review del rework (2026-10-19)

- GitHub exact-head review del PR #39 sobre `0f593ddfa1464d22d99841af4bbf19fd57ccbc58` encontró P2 `4320588628`: una URL guardada en página 2 podía ocultar resultados si los filtros solo devolvían una página. Reparación y regresión constan en `.orchestration/evidence/CF-AU-I06.4-GITHUB-REWORK-4320588628.md`.
- El frontend normaliza la URL a la última página válida manteniendo filtros. Web typecheck PASS y Playwright público 4/4 en 38.2s con D1 local sintética. Capturas previas siguen válidas (el cambio no altera visuales).
- Controller delegado separado examinó el delta exacto y emitió PASS: SHA `62506f2a0a32d2089d1f73fb2c73accdf99217c0`, base `cc91463d81b1b7d19d0cb44912772f1cd10ecf8e`, thread `01a156f1-eb28-7b33-a14b-de8ffc09319b`, modelo solicitado `gpt-6-luna`/High y `--sandbox read-only`; backend UNVERIFIED. Reporte: `evidence/critics/CF-AU-I06.4-CONTROLLER-62506F2-PASS.md`.
- PR #39 HEAD `62506f2`: required `worker` y `web` checks SUCCESS. GitHub automática está revisando ese mismo SHA; revisar completion, hallazgos y hilos antes de integración. Branch protection observada strict, checks `worker`/`web`, enforce admins true.
- **Gate aún PENDING:** Controller y tests locales PASS; se necesita review GitHub exact-head completa, cero conversaciones abiertas, validator/Pre-Critic final y verificar mergeability/protección en el HEAD final. La nueva evidencia/canonical checkpoint añadida después de `62506f2` no modifica código ejecutable y debe volver a pasar los checks/review de GitHub. No merge hasta entonces.

## CF-AU-I06.4 — candidato consolidado para review GitHub (2026-10-19)

- Contrato activo `.orchestration/contracts/CF-AU-I06.4-PUBLIC-CATALOG-DETAIL-CONTACT.md`; base autorizada `main@cc91463d81b1b7d19d0cb44912772f1cd10ecf8e`; candidato ejecutable `26742649e37243cba9e48434889f8df10d4d3d67`.
- Código y evidencia local: Vue catálogo/filtros URL/paginación → ficha → consulta HTTP con idempotencia; seis capturas reales 1440/390/320px y `output/playwright/i06.4/QA.md`. Datos D1 e imágenes sintéticos locales. Sin cambios al Worker runtime/API, permisos, Preview, producción, gastos, R2, datos reales, OWNER/ADMIN o source repo. Corrección pública parcial de #35; ADMIN queda para #33.
- Web typecheck/build, Worker typecheck, catalog tests 7/7, contact tests 6/6, Playwright 3/3 (33 s), consistency validator y `git diff --check`: PASS sobre el candidato ejecutable. Las capturas son runtime y el formulario conserva datos/clave en retry.
- Controller delegado separado devolvió PASS sobre ese SHA exacto, base exacta; proceso `codex exec`, modelo solicitado `gpt-6-luna`, esfuerzo `high`, `--sandbox read-only`, thread `01a156e9-b0e0-7ba3-92ea-6aa5e7d361d9`. No halló P0/P1/P2. Evidencia `.orchestration/evidence/critics/CF-AU-I06.4-CONTROLLER-2674264-PASS.md`; identidad backend UNVERIFIED.
- Protecciones verificadas de `main`: required strict checks `worker` y `web`, enforce admins enabled, PR reviews obligatorias = 0. El merge aún debe verificar checks, review, conversaciones y mergeabilidad sobre HEAD final.
- **Pre-Critic PASS para publicar el candidato en el PR funcional #31 y ejecutar checks `worker`/`web` más una review GitHub consolidada exact-head. No es aprobación de merge.** Si la publicación agrega solo este registro de Controller/gate, el código ejecutable coincide con el SHA revisado; GitHub debe revisar el HEAD completo del PR. Aplicar el validador de nuevo al checkpoint previo al push.

# Mandatory Pre-Critic Gate

## I06.6-P3 OWNER D3.1 — local candidate ready for exact-head review

- Contract and scope: `.orchestration/contracts/CF-AU-I06.6-P3-OWNER-D31.md`; Issue #44 authorizes OWNER only, baseline `ec58cd9e2d702afe57d0d6a4ebb4f159bd831f8d`, approved D3.1 reference `77c99fa445171a58548e6e06497050bf2d923305`. ADMIN #33, Product Acceptance #34 and remote Preview are out of scope.
- Product delta is limited to Vue OWNER presentation/state handling. Worker, Hono, D1 schema, API, authentication, authorization, idempotency and image-storage behavior were not modified. Availability actions remain available wherever the existing OWNER API accepts them, including SUBMITTED; media UI preserves separate STATIC_ASSETS and D1_BLOB paths and approved-photo read-only behavior.
- Real local runtime evidence: OWNER Playwright 4/4 (3.2m), including owner login/permissions, state-changing flows, photos, availability/inbox, action confirmations, session revocation via local logout→D1 and 401 redirect; public Playwright 4/4 (1.7m); follow-up D3.1 capture/navigation test 1/1 on final capture spec. Web typecheck and build PASS. Exact command/results and real before/after captures (1440/390/320) are in `output/playwright/i06.6-p3/QA.md`; all data/images/email are synthetic/local MOCK.
- Invariants: 1 PASS (source repo untouched); 2 PASS (presentation-only and no functional expansion); 3 PASS (OWNER isolation/API remains authoritative; negative ADMIN→OWNER E2E); 4 PASS (public regression 4/4); 5 N/A (no historical data migration); 6 PASS (source/media constraints and regressions); 7 N/A (no ADMIN mutation); 8 PASS (no auth implementation change; local revocation/expiry regression); 9 PASS (no remote/production/paid/real data); 10 N/A (no cost/provider transition); 11 PASS (GitHub #44/main is canonical); 12 PASS (no Drive authority); 13 PASS only after the required delegated technical Controller; 14 PASS (test failures were investigated and resolved within scope); 15/16 pending exact candidate Controller/review and final integration check; 17 PASS (task remains authorized through merge); 18 N/A (no new invariant); 19 N/A (no cost study); 20 PASS (no known P0/P1; GitHub review still pending); 21 PASS (P3 begins after P2 integration); 22/23 pending actual Controller provenance and protected merge verification.
- **Pre-Critic: PASS to publish one consolidated functional PR for exact-head `worker`/`web` CI and a single consolidated GitHub review, then conduct the required separate read-only GPT-6 Luna High Controller review. This gate does not authorize merge by itself.** If any exact-head control finds a substantive issue, fix it and rerun only affected local checks before a fresh exact-head gate. Final merge requires clean required checks, review/conversations, Controller PASS, final validator and enforced branch protection.
- Boundaries rechecked: no Preview, production, Cloudflare resource, R2, paid service, real record, auth-provider, source-repository or ADMIN #33/#34 change.

## CF-AU-I04 OWNER + ADMIN-assisted lifecycle consolidated candidate (2026-10-19)

- Authorized scope: `.orchestration/contracts/CF-AU-I04-OWNER-ADMIN-LIFECYCLE.md`; Human approval is Issue #7 comment `6257931179`.
- Executable candidate `87f077ed3a64de36c89a6d4caf985bbd05405c29`, tree `b77fe337a62dbb61bdf4f0163ae40d83bdc532a2`, descends from approved base `774d0c747e8ecbbdb97776641becbd9e49875875`.
- Controller P1 on public detail routing and GitHub P2 findings 4309937209/4309937211 were repaired together; exact changes and local evidence are in `evidence/critics/CF-AU-I04-CONTROLLER-7C5B5F7-REWORK.md`.
- Worker management 7/7, Worker/Web typechecks, normal/Preview builds, Python 25/25 and isolated Workerd+D1 Playwright 15 checks PASS. No code changed after these results in the executable commit. Full command/proof details: `evidence/CF-AU-I04-PRECRITIC-87F077E.md`.
- Applicable security, isolation, public detail, audit, image accounting, source-read-only, no-cost/no-remote/no-real-data and review-boundary invariants were rechecked. No P0/P1 remains known open.
- **Pre-Critic: PASS to publish this one consolidated candidate for fresh exact-head GitHub review/checks and delegated read-only Controller review only.** No merge or Preview update is authorized by this gate alone.

## CF-AU-I04 audit regression and Controller runtime addendum (2026-10-19)

- The project_controller subagent reviewed `8981f7e4194b6c0cc89d6d5e7ec95dd0e3c12f72`, found no P0/P1, but returned `BLOCKED_MODEL_CONFIG` because actual model and read-only enforcement were not verifiable. Its result is preserved at `evidence/critics/CF-AU-I04-CONTROLLER-8981F7E-BLOCKED.md`; no PASS is carried forward.
- The Controller's P2 request for an explicit single-submit-audit count is addressed in test commit `4cc4da4649e9ce75fc8007c4fc9bbffbdd3d9cca`. Focused Worker tests 7/7, Worker typecheck and whitespace check PASS. No application source or E2E files changed in that commit, so the already recorded 15-check local Playwright and UI builds remain applicable to the exact app code SHA 87f077e.
- **Pre-Critic: PASS to publish the consolidated test hardening and run one fresh exact-head GitHub review plus the documented separate `codex exec` Controller process (`gpt-6-luna`, High, `--sandbox read-only`).** This is not a technical Controller PASS or merge authorization.

## CF-AU-I04 final consolidated candidate after unsaved-edit repair (2026-10-19)

- Exact executable candidate `b2ea7130e6f25e5f60df0bb7d41c482908c4961c` descends from approved base `774d0c747e8ecbbdb97776641becbd9e49875875`.
- All prior findings are fixed: public detail/static routing, submitted OWNER refresh, duplicate submit audit, and preventing ADMIN actions from discarding unsaved form edits. Evidence and regression mapping: `evidence/CF-AU-I04-PRECRITIC-B2EA713.md`.
- Current focused/full-relevant evidence: Worker management 7/7, Worker/Web typechecks, Web normal/Preview builds, Python 25/25, local Workerd+D1 Playwright 16 checks, consistency validator and whitespace check PASS.
- The in-process Controller was `BLOCKED_MODEL_CONFIG`; its report is historical only. The separate-process GPT-6 Luna / High / read-only review is mandatory for this candidate.
- **Gate: PASS to publish this consolidated candidate for exact-head GitHub review/checks and the required separate-process Controller. Not integration or deployment approval.**

Before publishing a local substantive artifact for `project_controller` delegated review, Codex must prove:

## Contract

- active Task Contract exists and scope is unchanged or explicitly amended;
- every acceptance criterion has evidence;
- no unapproved product, cost, security or deployment scope was added.

## Invariants

- every relevant invariant is classified `APPLIES` or `N/A` with rationale;
- every applicable invariant is `PASS` with evidence;
- `FAIL` or `UNPROVEN` blocks publication and returns to autonomous REWORK.

## Research truthfulness

For laboratory/discovery work:

- every hypothesis has a falsification criterion;
- result distinguishes observation from inference;
- unsupported claims are marked unresolved;
- current platform limits/pricing use official sources and an observed-at date;
- negative findings are preserved rather than edited away;
- cost-zero claims include assumptions and thresholds.

## Technical evidence

As applicable:

- tests/typecheck/build/static checks pass;
- migration and reconciliation evidence is deterministic;
- API evidence does not substitute for required browser/UI evidence;
- auth/role/tenant-owner isolation has positive and negative cases;
- R2/D1/Workers evidence uses actual target primitives when the contract requires them;
- inherited regressions are rerun against the final candidate.

## Publication

Only after this gate passes may a local artifact be presented to `project_controller` for read-only review. Verify agent model/effort and sandbox before first verdict.

Codex cannot use this gate to self-declare substantive PASS.

## CF-AU-I01-P2 REWORK-3 consolidated candidate (2026-10-13)

- Contract: `.orchestration/contracts/CF-AU-I01-P2.md`; authorized scope remains local synthetic OWNER listing/image lifecycle and full acknowledgment, retry, compensation and recovery failure class under Autonomous Local Delivery Train v1.
- Controller REWORK on prior candidate `98cec68d81c7f80a7371ec5d60c80467d1cee476` is preserved in `critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`; its DELETE acknowledgment P1 and the later internal critique findings are addressed in current code/tests.
- Internal security/integrity re-critiques: no remaining P0/P1 in the covered failure class. They were static reviews, not substitutes for execution.
- Current final local suite: PASS, 797.1 s, with typecheck, test syntax and whitespace checks PASS; exact run and history are in `CF-AU-I01-P2-VALIDATION.md`.
- Scope, source read-only state, local-only Wrangler D1/R2, synthetic data, no payment/deployment/remote resources, and all stated parity/atomicity limits were rechecked.
- **Gate: PASS to submit a single consolidated candidate to GitHub automatic review and delegated read-only Controller. This is not substantive PASS or external approval.** Candidate SHA and subsequent results must be recorded before publishing an immutable Artifact A4 and stopping at the external-review boundary.

## CF-AU-I01-P2 consolidated candidate after reorder recovery (2026-10-14)

- Contract scope remains the local synthetic listing/image lifecycle; no frontend migration, production, real data, paid services, remote Cloudflare bindings, merge or source-repository write.
- Latest GitHub P1 stale reorder reservation barrier is addressed by scheduled exact-plan recovery under a D1 listing lease; invalidated plans become nonretryable and no longer block subsequent mutations. The P2 default-test omission is addressed by running the focused retry suite from `npm test`.
- D1/R2 confirmation, compensation, recovery, concurrency and authentication were rechecked. Three independent read-only reviewers found no P0/P1/P2 after the final D1 marker-predicate adjustment. They did not run tests.
- `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check`, `npm run test:retry`, and fresh local D1/R2 `npm test` pass. The complete default test run passed in 1122.2s; the first full attempt caught a marker-recovery mismatch, which was repaired and is recorded (not hidden) in the validation ledger.
- Main was fetched and verified at `91db05fb343d0bc020335bfc05790a2f3f824b82`; this remains an ancestor of the PR branch. The new migration and scheduled hook are code only; no remote binding was selected or deployed. Existing synthetic test harness uses local Wrangler D1/R2.
- Relevant invariants: 1 source remains read-only; 2 no feature expansion; 3 owner enforcement retained and regression suite passes; 6 image/order/storage recovery tested; 8 auth semantics retained and JWT hardening verified; 9 no real data/production/paid transition; 11 main remains GitHub canonical and is unchanged; methods 13/16 exact-SHA read-only Controller review remains required; 14 technical failures were autonomously repaired; 15 this gate is only a pre-review gate; 20 full P0/P1 failure class was re-critically reviewed.
- **Pre-Critic: PASS to push one consolidated candidate for GitHub automated review, then submit its exact immutable SHA to the documented separate `codex exec` Controller. This is not a substantive PASS and does not authorize A4 until that Controller returns a verified technical PASS.** Record model requested, reasoning effort, CLI sandbox, runtime and backend-attestation limits truthfully.

## CF-AU-I01-P2 REWORK-3 supplemental candidate — operation-only and terminal-ledger recovery (2026-10-14)

- The prior GitHub/Controller findings are addressed on the candidate tree: reaper order follows the persisted plan; incomplete reservation halves are read back and recovered; NULL legacy results are filled only under matching fingerprint/state; operation-only reservations converge through the scheduled reaper; terminal retirement repairs the matching idempotency record without releasing the mutation barrier until the operation is confirmed nonretryable.
- Evidence is pinned in `evidence/CF-AU-I01-P2-VALIDATION.md`: `npm run typecheck`, `node --check tests/http.mjs`, `git diff --check`, `npm run test:retry`, fresh `npm test` PASS in 3557.1s (local Wrangler, synthetic D1/R2), and `npm audit --audit-level=high` reports zero vulnerabilities.
- Three independent read-only internal tracks report no actionable P0/P1/P2: reorder/idempotency/concurrency, D1/R2 saga/recovery, and auth/runtime/API. Exact scopes are in `evidence/critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`; critics did not edit or run tests.
- Integration Review confirms `origin/main@91db05fb343d0bc020335bfc05790a2f3f824b82` remains an ancestor, PR #10 remains open/clean, A1–A3 commit history remains intact, and the working tree contains only evidence/gate updates beyond tested checkpoint `5b9fe7d5e6ea756f94267f321cbf12b61805bc8d`. No source repository, production, real data, paid or remote resources were touched.
- Applicable invariants: source read-only, parity scope, owner/auth boundaries, exact order/readback, D1/R2 compensation/recovery, no-cost local synthetic only, and main as canonical were all rechecked. No invariant is marked proven beyond the local evidence above.
- **Pre-Critic: PASS to freeze and push one candidate for GitHub automatic review, then run the documented separate-process `project_controller` on the exact pushed SHA. This is not Controller PASS, external approval, or permission to publish Artifact A4.** Record the requested model/effort/sandbox and runtime/backend attestation limits exactly.

## CF-AU-I01-P2 final consolidated candidate — 2026-10-15

- Scope remains the authorized local synthetic OWNER listing/image lifecycle; source remains read-only; no remote Cloudflare resource, billing, deployment, production data, merge or scope expansion.
- Final local code delta fixes auth middleware error classification and post-commit DELETE backup-only cleanup/recovery. Independent auth and D1/R2 critiques found no material issue; details in `evidence/critics/CF-AU-I01-P2-REWORK3-INTEGRITY.md`.
- Full `npm test` passed in the prior session on unchanged executable content (527.4s, synthetic local Wrangler D1/R2). Current-session typecheck, HTTP/retry syntax, focused `npm run test:retry` and `git diff --check` also pass. Provenance and hashes are in `evidence/CF-AU-I01-P2-VALIDATION.md`; the old pause checkpoint that said interrupted was stale and corrected.
- Current `main` base `ed52e7e17f6378e62d14896a095f54abb7304f66` is an ancestor of PR #10. Existing Artifact A1–A3 ancestry is preserved. GitHub automatic review of the exact consolidated commit and delegated GPT-6 Luna/High/read-only Controller review are still required.
- **Gate: PASS to publish one consolidated candidate to PR #10 and run exact-SHA GitHub and Controller reviews. This is not substantive Controller PASS or authorization to tag Artifact A4 yet.**

## CF-AU-I01-P2 Artifact A4 publication gate — 2026-10-15

- Exact reviewed and tested candidate: `c9090202441ecd534f84c2dcc610dc5d86bab4e0`; canonical base `ed52e7e17f6378e62d14896a095f54abb7304f66` is an ancestor.
- Required test provenance: full local synthetic `npm test` PASS (527.4s, exit 0); Controller recomputed and matched the executable/test file hashes to the ledger. Current-session typecheck, test syntax, retry recovery and whitespace checks pass. No executable content changed after the full suite.
- GitHub automatic review reports completed on the exact SHA with no new inline comments attached. Historical findings are triaged/fixed or explicitly nonmaterial source-parity follow-up; GitHub does not expose a machine-readable `has_any_findings=false`, so this gate records completion/no new exact-SHA comments rather than an independent bot PASS.
- Separate Controller review: bounded PASS, GPT-6 Luna / High / read-only flags requested and accepted by completed CLI process; process exit 0 and no writes. Backend model identity remains unverified. Full report and raw output are preserved at `evidence/critics/CF-AU-I01-P2-CONTROLLER-C909020.md`.
- Remaining follow-up: source filename rule discrepancy (`living-room.png` accepted by Worker but rejected by source) is a minor, non-security/non-integrity P2 and is intentionally not expanded under the materiality/scope direction. Remote multi-instance ordering, atomic D1/R2 and production behavior are not asserted.
- **Pre-Critic: PASS to publish Artifact A4 at the exact reviewed candidate SHA.** Annotated immutable tag `CF-AU-I01-P2-Artifact-A4` was created and pushed to that SHA. PR #10 remains open and unmerged; stop P2 at the external-review boundary.

## CF-AU-I04 consolidated OWNER/ADMIN candidate — final local Pre-Critic (2026-10-19)

- Exact executable candidate `1122de39f497e0635b8405210c6efb48e77916ba`, tree `f5c1ce104875e8a5b948e06512460c72b61e89de`; authorized base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- All identified material findings are repaired, including the latest Controller P1 status guard for availability/reconfirmation. Worker handler and D1/audit predicates enforce DRAFT/REJECTED; UI hides controls for all other statuses. An unexpected storage-failure regression confirms HTTP 500 rather than false HTTP 409.
- Exact code-tree verification: Worker management 8/8 + typecheck; Web typecheck, standard build and Preview build; Python 25/25; fresh isolated local Workerd+D1 Playwright 17 checks; staged `git diff --check`. Details and the initial wrong-fixture retry are recorded in `evidence/CF-AU-I04-PRECRITIC-FINAL-1122DE3.md`.
- Scope and invariants remain OWNER isolation, ADMIN role, atomic audit, status/idempotency correctness, repository-source read-only, synthetic data only, USD 0, no R2, production, real auth, Access changes or new remote resources.
- `python3 scripts/check_orchestration_state.py` and final whitespace check must pass on the canonical checkpoint before push; result is recorded in Event 141.
- **Pre-Critic: PASS to publish immutable `CF-AU-I04-OWNER-ADMIN-Artifact-A1` at executable SHA `1122de39f497e0635b8405210c6efb48e77916ba`, then run exact-SHA GitHub checks/automatic review and delegated read-only Controller. This is not their PASS or permission to merge/update Preview.**

## CF-AU-I04 Artifact A2 — consolidated GitHub P2 rework (2026-10-19)

- Exact executable candidate `be68f314aaa77b8597c0ab6a5c3d16daaab62e5a`, tree `9c3caaa04cae3e0b54e803e79b3d1bc3b47697f7`, base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- GitHub P2 dirty OWNER refresh is fixed by preventing refresh while form fields differ from persisted state. GitHub P2 ADMIN first-50 draft cap is fixed with owner-scoped stable cursor pagination and a “Cargar más borradores” UI action. The Controller P1 status guard and unexpected-storage HTTP error semantics remain fixed.
- Focused evidence: Worker management 9/9 + typecheck; Web typecheck, build, Preview build; Python 25/25; Playwright local synthetic OWNER/ADMIN lifecycle PASS including dirty refresh and draft 51; E2E syntax and whitespace pass. Exact results: `evidence/CF-AU-I04-PRECRITIC-A2.md`.
- Artifact A1 remains immutable at `1122de39f497e0635b8405210c6efb48e77916ba`; its Controller did not issue PASS and two GitHub P2s were repaired in A2. A1's full result is preserved in `evidence/critics/CF-AU-I04-ARTIFACT-A1-CONTROLLER-BLOCKED.md`.
- **Pre-Critic: PASS to publish immutable `CF-AU-I04-OWNER-ADMIN-Artifact-A2` at exact executable SHA `be68f314aaa77b8597c0ab6a5c3d16daaab62e5a`, then submit that exact SHA for fresh GitHub checks/review and delegated read-only Controller. No merge/Preview change until those controls pass.**

## CF-AU-I04 Artifact A3 — discard stale ADMIN draft pages (2026-10-19)

- Exact executable candidate `08184396c652087c6159513dc049eefc163adb8e`, tree `8fe95ecc08a3362010e5218b1cefe412bfcf6b0a`; A2 code commit `be68f314aaa77b8597c0ab6a5c3d16daaab62e5` and approved main base `774d0c747e8ecbbdb97776641becbd9e49875875` are ancestors.
- Controller/GitHub P2 stale draft-page responses are repaired with request-generation/OWNER checks and a forced delayed-response Playwright regression. The full focused OWNER/ADMIN suite passes 20 named Playwright checks; Worker management 9/9, typecheck/builds, and Python 25/25 also pass.
- A2 is immutable and retains its Controller REWORK; A3 is the repaired candidate. Exact evidence: `evidence/CF-AU-I04-PRECRITIC-A3.md` and `critics/CF-AU-I04-ARTIFACT-A2-CONTROLLER-REWORK.md`.
- Final state consistency and whitespace preflight must pass before tag/push; exact result is recorded in Event 143.
- **Pre-Critic: PASS to publish immutable `CF-AU-I04-OWNER-ADMIN-Artifact-A3` at exact executable SHA `08184396c652087c6159513dc049eefc163adb8e`, then run fresh exact-head GitHub checks/review and delegated read-only Controller. No merge/Preview change until both pass.**

## CF-AU-I04 Artifact A4 — external-media deletion and OWNER/ADMIN serialization (2026-10-19)

- GitHub P2 `4310175148` is repaired for both OWNER and ADMIN-assisted listing deletion: if a listing has image rows without D1 BLOB bytes and the runtime cannot safely clean an external object, deletion returns HTTP 409 before D1 mutation. The regression uses an unset `MEDIA_STRATEGY` and confirms no listing, image, audit or idempotency mutation.
- GitHub P2 `4310175152` is repaired across OWNER availability/reconfirmation and ADMIN-assisted mutations with a common listing lease, conditional D1 writes, and monotonic mutation timestamps. The regression interleaves both OWNER routes while an ADMIN batch holds the lease and verifies conflict, committed snapshot, exact replay and one audit row.
- Exact executable commit: `0678f39437d9f3796d0c3338520abe59e9e99e5e`; authorized base `774d0c747e8ecbbdb97776641becbd9e49875875` remains an ancestor. Existing A1–A3 tags/history are preserved.
- Focused evidence: management 11/11, contact/availability 6/6, OWNER 4/4, Worker typecheck and whitespace check PASS. No Web code changed; A3 UI/build/Playwright results remain applicable to the unchanged frontend.
- Detailed evidence: `evidence/CF-AU-I04-PRECRITIC-A4.md`. A3 Controller startup failure was due to attempted Vitest temp writes in the read-only process; no sandbox relaxation is authorized. A4 Controller must perform adversarial static review only and must not run tests or write files.
- **Pre-Critic: PASS to publish one immutable A4 candidate and run the final exact-head GitHub review/checks plus separate-process GPT-6 Luna/High/read-only Controller. No merge or Preview update until those controls pass.**

## CF-AU-I04 Artifact A5 — optimistic version guard for assisted edits (2026-10-19)

- GitHub P2 `4310303875`: ADMIN could save stale form data after the OWNER updated the same draft. The assisted edit now requires `expectedUpdatedAt`, compares it under the shared lease, and uses a D1 version predicate. Stale versions fail 409 without audit/idempotency mutation. The UI preserves the unsaved ADMIN form and offers an explicit current-version reload before continuing.
- The new regression simulates a later OWNER edit, verifies the stale ADMIN version cannot overwrite it or emit audit/receipt, then accepts an ADMIN edit using the current version. The local Workerd+D1 Playwright flow covers the 409, preserved form, explicit reload, and successful subsequent edit.
- Exact executable candidate: `e592422e2e485aedf622d169a1e04652940bf814`; base `774d0c747e8ecbbdb97776641becbd9e49875875` remains an ancestor. A4 tag/Controller PASS and earlier P2 history remain immutable.
- Focused evidence: management 12/12, Worker typecheck, Web typecheck/build/build:preview, E2E syntax, and local Playwright 21 named checks PASS. Contact 6/6 and OWNER 4/4 remain valid; A5 changes only assisted-edit behavior and the consolidated management suite revalidates the modified Worker tree. Evidence: `evidence/CF-AU-I04-PRECRITIC-A5.md`.
- A4 delegated Controller PASS is exact to A4; A5 needs a fresh review. The Controller must stay read-only and must not run tests; the parent has already run all required local checks.
- **Pre-Critic: PASS to publish immutable A5 for one exact-head GitHub review/checks and one separate-process GPT-6 Luna/High/read-only Controller review. No merge or Preview update until those controls pass.**

## CF-AU-I04 Artifact A6 — pending external-object operation deletion guard (2026-10-19)

- Exact executable candidate `549baf37952129d1cacfc46565e8ee1fb5581887`, tree `3887b1056b08d139367e94119c476bc05fcaf9c5`; approved base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor.
- GitHub P2 `4310358340` is addressed: external/unknown/unset media strategies always deny whole-listing delete before locks or D1 mutations. STATIC_ASSETS denies only when dynamic image rows or incomplete recovery records exist; repo-managed static asset files remain outside delete behavior. D1_BLOB and committed same-key replay remain unchanged.
- Focused regressions verify OWNER and ADMIN 409 for unset strategy/no image rows, external pending ADD, external pending DELETE backup, and STATIC_ASSETS NEEDS_REPAIR; they assert listing/operation provenance remains and no audit/idempotency receipt appears. Existing D1 BLOB cascade/accounting path remains covered.
- Worker management 13/13 and Worker typecheck pass on exact candidate. One initial concurrent run timed out in the existing auth hook; isolated rerun passed. No UI changed; existing A5 Playwright/build evidence remains applicable. No R2 objects/remote service were used.
- Deterministic preflight passed on the full canonical checkpoint: `python3 scripts/check_orchestration_state.py --base origin/main` => PASS; `git diff --check` => PASS.
- **Pre-Critic: PASS to publish immutable A6 and request exact-head GitHub review/checks plus one GPT-6 Luna/High/read-only Controller review only. This does not authorize merge or Preview update.**


## CF-AU-I04 Artifact A7 — close Controller regression evidence gaps (2026-10-19)

- Exact executable candidate `d2bab1e0af35d6ce9ad39bde520facd5903efdaf`, tree `2af2509da979e19be27c4f26ad7b8762d61e39ac`; approved base `774d0c747e8ecbbdb97776641becbd9e49875875` is an ancestor. A7 changes tests only from A6 `549baf37952129d1cacfc46565e8ee1fb5581887`; A6 remains immutable with its Controller REWORK preserved.
- Controller's bounded A6 P2 evidence request is addressed: STATIC_ASSETS tests assert no audit/receipt, cover both recovery-operation and dynamic image-row cases for OWNER and ADMIN, and external/unknown strategy coverage includes `OBJECT_STORAGE`. D1_BLOB and same-key replay code did not change.
- Worker management 13/13 and Worker typecheck PASS on A7. No frontend/UI or production-code delta, so existing Playwright/build evidence remains applicable. No R2 or remote service was used.
- Deterministic preflight passed: `python3 scripts/check_orchestration_state.py --base origin/main` => PASS; `git diff --check` => PASS.
- **Pre-Critic: PASS to publish immutable A7 and request one exact-head GitHub review/check run plus fresh separate-process GPT-6 Luna/High/read-only Controller. No merge/Preview until both are clean and Controller returns PASS.

## CF-AU-I05 — local synthetic OWNER auth candidate (2026-10-19)

- Exact functional candidate SHA `14d79e5792298c4f2eba0d53bc2f0b102818ab88`, tree `c8015ee49c29c271e90e8542858ab5fa0fe28997`; base `093bd9128653281b79599caf61bb6fa979b8fb49` is an ancestor. Subsequent PR checkpoint `7f30a8eeb7c2283e377ac3dc5d0ba2f7a5d1d3ff` changes only canonical state/evidence.
- All four consolidated GitHub findings (4313265555, 4313360409, 4313360419, 4313445923) are repaired and their threads are resolved. Final automated review of exact checkpoint `7f30a8e` completed with `has_any_findings=false` and `has_unresolved_findings=false`. Required checks `worker`/`web` passed in run `39247551993`.
- Separate Controller PASS: exact functional SHA/tree/base; requested GPT-6 Luna / High / read-only accepted; CLI exit 0, thread `01a15401-c55e-7611-b784-7fb3c4114acf`; backend identity UNVERIFIED. Report and prompt are in `evidence/critics/CF-AU-I05-CONTROLLER-14D79E5-*`. One nonblocking P2 follow-up: add explicit ADMIN logout revocation test; shared middleware currently enforces session version for ADMIN routes.
- Focused evidence and local synthetic browser journey: `evidence/CF-AU-I05-LOCAL-QA.md`. Final local startup smokes cover `local:up` (D1 BLOB/no R2/loopback) and `local:owner-auth` (build SPA, mock registration, local D1). No Preview, remote migration, production, real identity, paid service or source write.
- **Pre-Critic: PASS for bounded I05 local/synthetic auth candidate and protected integration readiness.** This does not authorize Preview auth rollout or production authentication; do not start I06 UI redesign inside this increment.

## CF-AU-I05 — bearer-only logout P2 rework (2026-10-19)

- GitHub P2 `4313547498` on checkpoint `3be04bc0fc3ccd675b6b6c2528c345f9628e2726` showed that Bearer-authenticated sessions survived local logout.
- Repair candidate `8ae6186a310fa665da1cc199ef3aef575b538843`, tree `7f808d0dbe139ab2812f74925cac7105a40ab219`: revokes both unique Bearer and cookie sessions; OWNER/ADMIN regressions assert both credential forms fail afterward. Worker typecheck and focused auth tests PASS (owner-auth 5/5, Preview auth 6/6).
- **Pre-Critic status: PENDING.** Exact-head checks, consolidated GitHub review/thread resolution, and fresh exact-SHA separate-process GPT-6 Luna/High/read-only Controller are required. Prior PASS does not transfer. No Preview or production auth is authorized.

## CF-AU-I05 — cierre de logout Bearer y Pre-Critic (2026-10-19)

- Exact executable SHA `8ae6186a310fa665da1cc199ef3aef575b538843`, tree `7f808d0dbe139ab2812f74925cac7105a40ab219`: local logout revokes unique Bearer/cookie sessions; Worker owner-auth 5/5, Preview-auth 6/6, Worker typecheck PASS.
- Exact PR checkpoint `82d9d0bb9511ee550afd04f4b3514a984db0b110`: worker/web checks PASS (run `39249255619`); consolidated GitHub review completed with no findings/unresolved; finding `4313547498` resolved via reply `4313633558`; 0 unresolved conversations.
- Controller PASS on exact executable SHA, separate `codex exec`, requested GPT-6 Luna / High / read-only, CLI accepted configuration and exit 0; backend identity UNVERIFIED. Evidence: `evidence/critics/CF-AU-I05-CONTROLLER-8AE6186-PASS.md` and metadata.
- **Pre-Critic: PASS for protected integration of I05 only.** Final canonical validator still required before merge. No Preview update, production preparation, I06 or I08.

## CF-AU-I05 — clean checkout startup P2 rework

- GitHub P2 `4313686597`: local auth startup failed on a clean checkout because Worker dependencies were not installed. Candidate `b1fecbfcb291c7394299782a511b784e465c91eb` installs Worker and Web dependencies before build/migration/start.
- Real clean-worktree smoke: install/audit Worker (92 packages, 0 vulns), install/audit Web (81 packages, 0 vulns), SPA build, local D1 migrations, Wrangler loopback; `/health` and `/auth/config` both HTTP 200. Details: `evidence/CF-AU-I05-CLEAN-START-REWORK.md`.
- **Pre-Critic status: PENDING.** Publish to PR #24; exact-head CI and consolidated GitHub review/thread closure remain outstanding. Controller review must cover the exact post-fix SHA before final I05 closeout. No Preview/production update.

## CF-AU-I05 — cierre final después de rework de arranque limpio (2026-10-19)

- I05 auth core PR #23 merge `eecafd894c5fc57c1a5c362ae490566d3f006db2`; startup repair PR #24 merge `489fa0885f28dfa789535dda47f81035422c137e`. Executable rework `b1fecbfcb291c7394299782a511b784e465c91eb` / tree `ce2fedd39c05c056ab7c878acfb8ac65d90126f0`; only package script/README changed.
- GitHub review exact PR head `d742712b7a05ee6d7fd1954ca3b70377c6de9ab1`: PASS/no findings/unresolved; all P2 threads resolved. Worker/Web PR run `39274582580` and merge run `39275106227` PASS.
- Controller PASS exact startup candidate `b1fecbf`; prior auth/logout Controller PASS `8ae6186`; both requested GPT-6 Luna/High/read-only separate processes, backend identity UNVERIFIED. Clean-checkout smoke PASS, local-only.
- **Pre-Critic: PASS; I05 closed.** No Preview deployment, no production, no I06 implementation in this increment.

## CF-AU-I06.5 — consolidated local/synthetic OWNER candidate (2026-10-21)

- Contract: `.orchestration/contracts/CF-AU-I06.5-OWNER-AUTH.md`; authorized Issue #32. Approved base and `origin/main` both remain `48e4f5c4251fe939cb779698e4e51b16614be178`, ancestor of candidate. Exact executable candidate `0d4f4c5074ed89483649e4de30136b507763dbd2`, tree `bdc1c8676dcac3637512e9b135083bfb75ccfe38`.
- Scope is I06.5 local synthetic auth/OWNER UX plus required reconciliation of I06.4 PR #39 state. No I06.6/#33, Preview/Access remote, production, real data, external email, paid service, R2, or source repository changes.
- #36 authorization boundary: only authenticated owner can GET private metadata/bytes for any owned listing status; non-owner remains 404; DRAFT/REJECTED mutation guard remains in place and APPROVED upload/reorder/delete remains 404. Worker regression also verifies D1 row and public image remain intact.
- Local evidence is versioned at `output/playwright/i06.5/QA.md`: Worker lifecycle 5/5, D1 BLOB ownership 12/12, 256 KiB media spike 3/3, local auth 5/5, contact 6/6; Worker typecheck, Web typecheck/build; integrated Workerd+Vue+Hono+D1 Playwright 2/2 (2.2m) with synthetic identities/MOCK mail. Nine real desktop/mobile captures include 320 px, 390 px, dashboard, editor and #36 photo view. Final consistency validator and whitespace check PASS.
- Auth API/session/CSRF/rate-limit/backend role semantics were not rewritten. Vue now presents existing local MOCK vs Access Preview distinction; OWNER/ADMIN API authorization remains in the Worker. Expired-session no-mutation and cross-owner/role denials have tests.
- Applicable invariants 1–10, 13–16, 18, 20–23 were checked against the above proof; source is untouched, semantic scope unchanged, owner/security boundaries remain backend-enforced, no remote/cost/data boundary was crossed. Contrast calculation for core tokens on canvas is >=4.68:1; keyboard skip-link and 320 px overflow checks pass. Remaining ADMIN forms/#35 remainder and #37 are explicitly deferred to #33.
- **Pre-Critic: PASS to publish this one consolidated candidate for exact-head GitHub review/checks and one delegated read-only GPT-6 Luna/High Controller review. This is not Controller PASS or merge authorization.** Reconcile any P0/P1 within this contract and rerun affected regressions; no Preview or production update.

## CF-AU-I06.5 — rework de dos P2 / Controller PASS (2026-10-21)

- Exact executable candidate `c848d8459f2aff10bb023cd4d14059d6604c2649`, tree `9e36b20240057093df3ebffee253a38d2c1899c0`, canonical base `48e4f5c4251fe939cb779698e4e51b16614be178` ancestor.
- GitHub P2 `4343533996` fixed: logout/profile switch enters route guard before clearing auth; cancel preserves OWNER session and form. P2 `4343533999` fixed: selected local photo participates in `unsaved`, reload prompts, server refresh disables, explicit discard is required. New real D1/Workerd integrated E2E regressions pass 2/2. Web typecheck/build PASS.
- Exact CI `worker` and `web` SUCCESS on `c848d84` (run `39704030419`). Original review threads have responses and are resolved. Final automatic GitHub review on `c848d84` has been requested; result is still pending.
- Delegated separate-process Controller PASS on exact SHA/tree; requested GPT-6 Luna / High / read-only, accepted CLI configuration, exit 0, backend identity UNVERIFIED. No P0/P1/P2/P3 found. Report/provenance under `.orchestration/evidence/critics/CF-AU-I06.5-CONTROLLER-C848D84-*`.
- **Pre-Critic final remains PENDING** until GitHub review completes on the exact final PR head, consistency validator passes, and no new unresolved conversations remain. No merge or Preview update before those checks.


## Issue #49 — CI/CD Preview fail-closed candidate `ffb0402`

- Base: `6863bc02c8db45aae3cd231c349ecf069bcd72c5`; executable SHA `ffb040244cbb2cad78b460cc7a02a9609f9a11c5`, tree `d7ed682aa55f817ac2d6c84c77e13893cea1433c`.
- Scope is restricted to protected-main CI/CD for the existing private Preview and the existing synthetic D1; no production, resources, Access edits, paid services, R2, source writes or ADMIN #33. D1 provenance is supported from the permitted metadata comparison; content was not inspected. Remote migration has not been applied.
- Local proof: preview guard 13/13, Python suite 38/38, web typecheck/build:preview PASS, actionlint PASS, metadata comparison and private backup/local 0013 rehearsal PASS, Access anonymous smoke 12/12 PASS. Exact details are in `.orchestration/evidence/CF-AU-I06.6-CI-CD-LOCAL-VALIDATION.md`.
- Delegated technical Controller PASS on exact executable SHA: `.orchestration/evidence/critics/CF-AU-I06.6-CD-CONTROLLER-FFB0402-PASS.md`; separate-process model/effort/sandbox requested GPT-6 Luna/High/read-only, backend identity UNVERIFIED.
- The `staging-private` job is push-main-only after successful `worker` and `web`, serialized, and fails closed unless explicit variables and a scoped Actions secret exist. Current GitHub configuration lacks that secret/variables, so the job cannot mutate Cloudflare on merge in this state.
- **Pre-Critic PASS to publish this single functional PR and obtain exact-head GitHub checks/review only.** Merge requires fresh exact-head CI/review, no unresolved material conversations, consistency validation and enforced protection. Preview update/migration remains pending until the CI credential prerequisite is safely configured and workflow actually succeeds.


## Issue #49 — PR #50 exact-head GitHub controls

- PR #50: `https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/50`, base `main`; branch `work/issue-49-preview-cd`. Local candidate executable SHA/tree and Controller PASS remain `ffb040244cbb2cad78b460cc7a02a9609f9a11c5` / `23704dd28750b651a970c71a411be143e960797b` (the separate tracking commit is non-executable).
- At PR creation, exact-head `worker`/`web` were running and GitHub review had not completed. The following state checkpoint changes PR HEAD; wait for its exact-head controls rather than reusing the earlier run.
- Main protection read-back: strict required `worker`/`web`, `enforce_admins=true`, force-push/deletion disabled, required approvals 0.
- **Pre-Critic remains PASS only to publish and process PR #50 controls. Merge pending exact final-head CI/review, no material open conversations, consistency validator and final branch-protection/mergeability check.** The current safe gate lacks the scoped Actions secret/vars; no remote D1/Preview mutation is permitted by this missing configuration.


## Issue #49 — GitHub P1 rework pending exact-head closeout

- GitHub P1 `4377659039` identified an invalid extra line in `$GITHUB_OUTPUT` after Preview publication. Fixed in `9fb26aa3be6bb17c1f7cf427577423d126c0ac6c`; regression asserts the redirection is absent. Evidence: `.orchestration/evidence/CF-AU-I06.6-CD-GITHUB-P1-4377659039.md`.
- Targeted guard 13/13, Python 38/38, actionlint and diff check pass. The prior Controller PASS (`ffb0402`) predates this repair and is not claimed for the new SHA; no Controller rerun is justified for this one-line output correction.
- **Pre-Critic final is PENDING.** Require exact current PR #50 worker/web PASS, GitHub review without findings/unresolved conversations, canonical validator and protected mergeability. The fail-closed remote credential prerequisite remains absent.


## Issue #49 — exact Wrangler JSON output file follow-up (PR #51 candidate)

- The first authorized D3.1 Preview release is verified in `.orchestration/evidence/CF-AU-I06.6-PRIVATE-PREVIEW-RELEASE-20261026.md`; no second deployment was run. Source `main@e1f319b`; deployment `7f9cc4a7-9a96-477e-8e34-77594fe5df53`; migration 0013 applied; Access 12/12 anonymous denials; authenticated browser E2E `BLOCKED_AUTH`.
- GitHub review of PR #50 found the output redirection P1 and it was fixed. The actual deployment showed Wrangler writes `--json` structured output to `WRANGLER_OUTPUT_FILE_PATH`, not stdout. The current functional follow-up sets this variable and validates the JSONL output (including Wrangler's timestamp) without redeploying.
- **Pre-Critic pending final closeout for PR #51 exact code SHA `a0a759ccecda7bdea5893446923ad4e48b43aa4a`.** Focused Python tests (38/38), actionlint, consistency validator, and exact-head worker/web PASS; staging-private safely skipped. The existing exact-code-SHA GitHub review is still running. After it completes, resolve any material thread, rerun consistency, verify protected mergeability and integrate. No Controller rerun: code delta is a narrow Wrangler output-path correction; the prior Controller’s scope is recorded accurately. Automated publication remains safely disabled until the scoped Actions secret/vars are configured; do not reuse the broad local token.


## Issue #49 — Wrangler 4.151 JSONL output follow-up (local candidate)

- Fix sets `WRANGLER_OUTPUT_FILE_PATH` to the temp JSONL file used by `wrangler preview --json`; the command no longer assumes JSON on stdout. The parser regression includes Wrangler's `timestamp`. No second remote deploy is performed.
- Focused local gate PASS: Python 38/38 (preview guard 13/13), actionlint 1.7.7, canonical consistency/diff; Web build/typecheck are unchanged from exact main tree and already passed.
- Current published Preview `7f9cc4a7-9a96-477e-8e34-77594fe5df53` is verified separately by Cloudflare latest-deployment API, JWT secret presence and Access 12/12; report `.orchestration/evidence/CF-AU-I06.6-PRIVATE-PREVIEW-RELEASE-20261026.md`.
- **Pre-Critic PASS to publish one focused functional PR for exact-head GitHub CI/review only.** No merge until fresh checks/review and protected-branch validation. No new deploy is part of this fix.

## I06.6 ADMIN D3.1 — active functional increment #33

- Authorized exact base: `main@0eff7358006a7e6e207387380ecc7bdd27615fb5`, protected merge of PR #51. Task Contract: `.orchestration/contracts/CF-AU-I06.6-ADMIN-D31.md`.
- Approved D3.1 identity: Issue #41, reference commit `77c99fa445171a58548e6e06497050bf2d923305`; Product Owner visually accepted the existing Preview in #48. ADMIN #33 only; #34 and I07 excluded.
- Must preserve API/authz/state/audit/idempotency/concurrency/media contracts; no unsupported photo mutations. Fix #35 ADMIN mobile form overlap and #37 timestamp rendering with deterministic tests. Preserve public/OWNER regressions.
- Local synthetic D1/Worker/Hono + Vue Playwright at 1440/390/320 and keyboard/accessibility evidence required. Exact-head GitHub worker/web, review, separate GPT-6 Luna High read-only Controller, canonical consistency and final protected merge required.
- PR #51 post-merge main CI: worker/web PASS, staging-private SAFE SKIP; prior Preview remains source `e1f319b` at deployment `7f9cc4a7-9a96-477e-8e34-77594fe5df53`. **No Preview, D1 remote, Access, or CD mutations in #33.** CD provenance guard finding remains deferred until before activation (Issue #49 comment `6418504412`).
- **Pre-Critic currently NOT YET ASSESSED.** No implementation candidate or tests exist on this increment's branch at task start. Run only after code, local regressions, browser evidence, and Integration Review are consolidated.

## I06.6 ADMIN D3.1 — local preflight to publish (2026-10-26)

- Scope: authorized Issue #33 only; D3.1 Admin moderation and assisted management. No backend, auth, database, Preview, CD, Access, resource or source-repository changes.
- Integration Review: existing `/admin` review/publish APIs and `/admin/listings/assisted` mutation/idempotency/audit contracts remain in place; existing photo GET is read-only; role denial checked in browser; owner/public regressions rerun. #35 public contact regression and ADMIN responsive geometry are captured; fresh baseline no longer reproduced the historically reported ADMIN overlap. #37 time zone display is fixed at presentation only.
- Evidence: `output/playwright/i06.6-admin/QA.md`; before/after screenshots, 1440/390/320 integrated ADMIN Playwright, D1 synthetic runtime. Worker `test:admin` 12/12, `test:management` 13/13, Worker typecheck, Web typecheck/build, ADMIN E2E 2/2, public E2E 4/4, OWNER E2E 5/5 all PASS. Consistency validator and diff check PASS.
- **Pre-Critic PASS to publish one consolidated functional PR for exact-head worker/web CI and GitHub review, followed by one `project_controller` GPT-6 Luna High read-only review of the final PR SHA.** This is not final approval to merge. Merge requires exact-head required checks, GitHub review/no material unresolved threads, Controller PASS, final canonical validation and protected-branch verification. No staging CD or Preview update.


## Issue #33 — rework Controller integrado (26/10/2026)

- Controller exacto de referencia: `de88b480151a1ab97f7c654c62fcd653b41d2863`, veredicto `REWORK`; no P0/P1. Sus cinco P2 funcionales se repararon en `00f8f88b91155c8c7ed51d893b32d3f3deb824ac` y el sexto hallazgo de estado se reconciliará aquí con el nuevo HEAD, separando SHA ejecutable y checkpoint.
- Pruebas afectadas: Worker moderation 12/12, management 13/13, Worker typecheck PASS; Web ADMIN E2E 2/2 con Worker/Hono+D1 sintética, Web typecheck/build PASS. Incluye imagen D1 BLOB en administración asistida, dirty-beforeunload, borrado/baseline, foco mobile y frescura de disponibilidad. `QA.md` documenta primer timeout por aceptación tardía de diálogo nativo; la ejecución corregida final pasó 2/2.
- **Pre-Critic de rework: PASS para publicar y renovar exact-head CI/review y Controller final.** No equivale a PASS de integración. Requiere CI worker/web en HEAD final, review automática sin hallazgos materiales, Controller PASS exacto, validador final, conversaciones resueltas y branch protection antes del merge.


### Seguimiento canónico del HEAD del PR (rework exacto)

`STATUS.json` registra el SHA/tree ejecutable inmutable por separado. El HEAD del PR es una observación derivada de GitHub, no se escribe como si el commit que contiene el estado pudiera referenciarse a sí mismo. `last_observed_head_sha` conserva el anterior HEAD `a52caef`; acción obligatoria tras este checkpoint: consultar PR #52 live HEAD y sus checks. Controller observó correctamente que Event 228 había dejado el antiguo campo como si fuera current; esta modificación corrige esa ambigüedad.


### Cobertura integrada de catálogo tras publicación

El recorrido ADMIN ahora ejecuta también la comprobación Playwright anónima de catálogo (tarjeta y precio visibles tras publicar), además de la regresión Worker de GET público 404→200. La suite ADMIN focalizada pasó 2/2 en código `8522f3529aaa91c861f44f1d5936a49122674583`; reporte `.orchestration/evidence/CF-AU-I06.6-ADMIN-CONTROLLER-REWORK.md` y `output/playwright/i06.6-admin/QA.md`. Esto atiende el alcance del contrato, no amplía funcionalidad. Publicado; exact-head CI/reviews/Controller aún pendientes.


### GitHub P2 — aislamiento de respuestas de auditoría

Review exacta `d268668` detectó respuesta de auditoría fuera de orden entre listados. Rework `59a60c576fbd71e36f6292ebf9a02e8529ac094e` invalida requests previas por generation+listing ID; test real retrasa response Worker/D1 y verifica que eventos de A nunca aparezcan en B. ADMIN Playwright 2/2, web typecheck/build PASS. El anterior Controller PASS de d268 está invalidado como cierre final por el nuevo P2; se requiere Controller final sobre el candidato actual.
