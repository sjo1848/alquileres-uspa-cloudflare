Controller técnico local delegado, estrictamente read-only. Confirma y revisa candidato ejecutable exacto `a5e2257809b5abf2cf75b6869a59de99abed3fdb`, tree `b3e69ce0eb0bda00aa2bd253ccc43331e084f1d1`, base `main@48e4f5c4251fe939cb779698e4e51b16614be178`, Issue #32 / I06.5. PR HEAD posterior `afe6143` sólo agrega evidence/canonical state.

Revisión adversarial sobre las correcciones finales (inspecciona SHA exacto, no sólo este resumen):
- GitHub P2 4347741052: al cambiar listing con dirty form, alertdialog debe tomar foco seguro, atrapar Tab, cancelar Escape, restaurar trigger; refresco usa mismo patrón. Voluntary route leave sigue protegido y sesión expirada sigue bypassing guard solo cuando anonymous.
- P2 4347641129 / Controller anterior: selector upload sólo en D1_BLOB elegible, con carga de imágenes terminada y sin Static Asset; explica la restricción. Tras transient /auth/config, error/retry y upload real por Worker/D1 en misma página; STATIC_ASSETS permanece sin upload.
- P2 4347641100: 401 al salvar dirty form redirige a login sin diálogos cancelables/datos privados.
- P2 4347641116: reorder mixto vuelve a leer galería OWNER y mantiene Static Asset.
- Tie order usa expected fijo independiente del comparator.

Inspecciona `apps/web/src/views/OwnerView.vue`, `apps/web/e2e/owner-journey.spec.ts`, `apps/worker/tests/seed-owner-e2e.sql`, `apps/worker/tests/owner-d1-blob-media.test.ts`, `output/playwright/i06.5/QA.md` y contrato/invariantes pertinentes. No corras tests/build, no red/GitHub, no escribas archivos ni cambies refs.

Devuelve SHA/tree/base; superficies; P0/P1/P2/P3 con escenario/archivo/línea; evidencia/brechas; PASS/REWORK/BLOCKED/HUMAN_GATE. Determina si las brechas P3 previas quedaron cerradas. No heredes verdict anterior. Backend identity UNVERIFIED si no está expuesta.
