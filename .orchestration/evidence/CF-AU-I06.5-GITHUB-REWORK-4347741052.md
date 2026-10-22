# PR #40 — diálogo accesible de cambio de alojamiento

Finding P2 de GitHub: `4347741052`, observado en checkpoint `2bf85d25ec73b672aea2589c6ab2dc0a6af1ef3d`.

## Reproducción y cambio

Al editar un DRAFT y elegir otro alojamiento, el aviso estaba dentro del panel: no movía el foco, no capturaba Tab y Escape no cancelaba.

La confirmación ahora usa overlay modal, `role=alertdialog`, foco inicial en “Seguir editando”, ciclo Tab/Shift+Tab, Escape para cancelar y retorno de foco al botón que inició el cambio. La confirmación de “Actualizar lista” adopta el mismo comportamiento. El guard se mantiene activo al navegar voluntariamente; la expiración forzada sigue saliendo directamente al login si la sesión quedó anónima.

## Regresión

El E2E OWNER modifica el DRAFT, pulsa otra fila y verifica el foco inicial, Tab/Shift+Tab, Escape, restauración al botón y conservación del texto sin guardar. La regresión de actualización de lista con foto previsualizada comprueba el mismo patrón de foco/cancelación y preserva la preview.

## Hallazgo relacionado `4347641129`

La revisión de GitHub también reportó selector de upload visible en DRAFT con Static Asset. La capacidad de carga ahora requiere `D1_BLOB`, imágenes ya cargadas y cero filas `STATIC_ASSET`. La misma corrida E2E reintenta `/auth/config` tras dos 503, confirma que el selector no aparece para Static Assets, lo habilita para un DRAFT D1 BLOB y completa una carga D1 real en ese contexto.

## QA afectada

- Web typecheck y build PASS.
- Playwright OWNER focalizado PASS 1/1 (52.5 s), con Vue + Worker/Hono + Workerd + D1 sintética local re-seeded.
- Worker media 13/13 PASS sobre el mismo candidato funcional previo; el último delta es UI, foco y fixture Playwright.
- No se modificaron APIs Worker, permisos, sesión, estrategia de almacenamiento ni datos remotos.
