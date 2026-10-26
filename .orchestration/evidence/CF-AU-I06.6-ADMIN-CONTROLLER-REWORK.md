# I06.6 ADMIN D3.1 — cierre de hallazgos Controller

- Revisor: `project_controller`, reviewer kind `delegated_codex_subagent`, configurado GPT-6 Luna / High / read-only. Backend model identity e independencia estructural del sandbox: UNVERIFIED.
- SHA revisado: `de88b480151a1ab97f7c654c62fcd653b41d2863`; veredicto REWORK. Sin defectos P0/P1; seis observaciones P2 documentadas en el informe del revisor.
- Reparación funcional: commit `00f8f88b91155c8c7ed51d893b32d3f3deb824ac`, tree `5a4842353e101bab418945123de884d0e0e68462`. Los hallazgos son: `beforeunload` faltante, baseline sucio tras borrar, URL de imagen D1 BLOB no prefijada por API, ausencia de frescura en la cola, detalle y DTOs de asistencia, foco móvil no transferido, y estado canónico que confundía el SHA ejecutable con PR HEAD.
- El commit `8522f3529aaa91c861f44f1d5936a49122674583` (tree `6aee9257a90a04ed2d31e21b943efdc677fb227a`) agrega la aserción Playwright de ficha al catálogo anónimo tras publicar; ADMIN E2E final 2/2 PASS. Regresiones finales del rework: Worker `test:admin` 12/12; `test:management` 13/13; Worker typecheck; Web `test:e2e:admin` 2/2; Web typecheck/build; `git diff --check`. Un timeout previo se debió al manejo tardío del diálogo confirm nativo en el test y fue corregido antes de la ejecución 2/2.
- Controller no emitió PASS sobre el código modificado. Requiere una nueva revisión read-only sobre el SHA final consolidado después de GitHub CI/review; el veredicto REWORK queda preservado como evidencia histórica.

- GitHub Review en `d268668` halló P2 por respuestas de auditoría fuera de orden. Corregido en el incremento siguiente con `auditRequestGeneration`, filtro por listing ID y regresión Playwright que retrasa la consulta D1 real; E2E 2/2, typecheck y build PASS. Revisión y Controller deben actualizarse para el nuevo candidato consolidado.

## GitHub P2 follow-up after prior Controller PASS

- GitHub automatic review of `d268668e23319958c6686c6eb5d1e26b6b8ce6f4` found audit response race between listings. This supersedes the prior Controller PASS as final approval.
- Fixed and reproduced in final executable `59a60c576fbd71e36f6292ebf9a02e8529ac094e` / tree `e7eb67b0749d2f2e98f4644a2d842cc5207459f6`: old response is delayed against the real local Worker/D1 endpoint; audit events from the prior listing do not overwrite the selected listing. ADMIN E2E 2/2, web typecheck/build PASS.
- GitHub automatic review and Controller final re-run are pending on the exact live PR HEAD after state checkpoint.
