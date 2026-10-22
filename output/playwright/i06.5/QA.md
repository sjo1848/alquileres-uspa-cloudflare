# I06.5 — QA local OWNER

Entorno reproducible: Vue/Vite + Worker/Hono en Workerd + D1 **local** aislada, imágenes D1 BLOB, cuentas sintéticas `.test` y correo `MOCK`. No se usó Preview, Access remoto, R2, correo real, datos reales ni recursos pagos.

## Recorridos verificados

- Registro → bandeja MOCK → verificación de un solo uso → login → logout.
- Recuperación antienumeradora (dirección existente/desconocida), restablecimiento, rechazo de contraseña anterior y nuevo login.
- OWNER abre publicación aprobada con fotos de repositorio y D1 BLOB mezcladas (regresión #36); el Worker entrega metadata y redirect seguro para Static Assets y bytes privados D1, y otro OWNER recibe 404. Las fotos aprobadas permanecen de solo lectura; la suite estática también demuestra que POST/PATCH/DELETE continúan bloqueados sin mutar la ficha.
- Disponibilidad/reconfirmación y consulta real sintética en inbox; cambio leído/no leído.
- Crear/editar borrador, error HTTP transitorio y retry preservando campos, advertencia de cambios no guardados, preview local de foto, fallo/retry de carga, orden, borrado confirmado, envío a revisión y eliminación confirmada.
- Regresiones GitHub PR #40: cancelar logout con un formulario modificado conserva sesión y valores; una foto local previsualizada bloquea “Actualizar lista”, ofrece descartar explícitamente y no puede perderse con “Actualizar desde servidor”. E2E focalizado consolidado: 2/2 en 2.2 min sobre Workerd + D1 real local.
- Regresiones finales GitHub: al borrar el borrador se revoca y limpia una foto todavía no subida; el diálogo de salida mueve el foco a “Seguir editando”, atrapa Tab, cancela con Escape y devuelve el foco al control que inició la navegación. Playwright comprueba además que borrar el borrador no deja una confirmación invisible de cambios pendientes.
- Rework GitHub P2 `4343754584`: los diálogos para borrar foto y borrador ahora enfocan inicialmente la opción segura, confinan Tab/Shift+Tab, cierran con Escape y restauran foco al botón de origen al cancelar. Tras borrar correctamente, el foco pasa al título de la sección porque el botón de origen desaparece. Playwright cubre cancelación, confirmación, preview de foto sin guardar y foco en ambos recorridos.
- Rework GitHub P2 `4343798935`: la respuesta de imágenes OWNER combina Static Assets y D1 BLOB por posición almacenada y usa `id` como desempate determinista; la regresión compara el orden OWNER y público con fixtures sintéticos mezclados.
- Rework GitHub P2 `4343866111`: un fallo temporal de `/auth/config` ya no deja las acciones de foto ocultas sin explicación. La configuración se comparte mientras hay una solicitud activa; OWNER muestra el problema y ofrece reintento, y vuelve a habilitar solo las acciones permitidas por la estrategia recuperada. Playwright inyecta fallos sintéticos de configuración y confirma que un reintento HTTP real recupera la carga de fotos.
- Controller exact-delta del candidato `3129ce7` identificó que en un borrador con Static Assets la UI ofrecía una carga que Worker rechaza. OWNER ahora espera a cargar las imágenes y oculta el selector si la publicación contiene cualquier foto administrada desde el repositorio; informa por qué no permite mezclar cargas. E2E usa una publicación sintética DRAFT con Static Asset y comprueba mensaje + ausencia del selector.
- La regresión de empate de orden ya no calcula el esperado con el comparador de producción: IDs sintéticos controlados exigen explícitamente Static Asset `aaa-…` antes del D1 BLOB `d1-…` cuando ambas tienen posición 0. Revisión Worker compara también el orden público.
- Revisión GitHub consolidada de PR #40 sobre `868a2c7` encontró P2 `4347641100` y `4347641116`: vencimiento de sesión no debe quedar cancelado por el diálogo de cambios sin guardar, y reordenar D1 BLOB debe refrescar la colección combinada sin perder Static Assets. OWNER permite navegar inmediatamente al login sólo cuando la sesión ya quedó anónima; el reordenamiento vuelve a leer el endpoint OWNER combinado. E2E fuerza 401 mientras hay un cambio sin guardar y verifica login sin contenido privado; fixture sintética mixta reordena una foto y conserva las tres.
- Reconciliación GitHub P1 `4343866105`: `STATE.md` y `STATUS.json` se reconciliaron en el PR funcional al candidato ejecutable y a los controles vigentes; el PASS anterior a `c848d84` queda histórico y no se transfiere.
- Regresiones del último exact-head review: OWNER puede leer Static Assets de una publicación propia en modos `STATIC_ASSETS` y `D1_BLOB`, sin ampliar mutaciones; la configuración pública de auth informa la estrategia de medios y la UI oculta acciones de subida cuando el modo es `STATIC_ASSETS`. Playwright desactiva la reutilización del servidor; dos ejecuciones completas consecutivas volvieron a seedear D1 sintética y pasaron 2/2 cada una (2.1 y 2.4 min).
- ADMIN no puede usar UI ni API OWNER; sesión expirada no muta estado (regresiones Worker).
- Teclado/skip-link, diálogo de salida y viewports 1440, 390 y 320 px; el E2E comprobó que `scrollWidth <= viewport` en 320 px.

## Resultados

| Verificación | Resultado |
|---|---:|
| `apps/worker`: `npm run test:owner` | 6/6, incluye Static Assets en lectura y escrituras bloqueadas |
| `apps/worker`: `owner-d1-blob-media.test.ts` | 13/13, incluye lectura Static Assets en modo D1 BLOB y orden empatado con esperado fijo |
| `apps/worker`: `npm run test:preview-auth` | 6/6; `/auth/config` conserva estrategia y reporta la estrategia de medios |
| `apps/worker`: `npm run test:catalog` | 7/7; mutaciones Static Assets siguen denegadas |
| `apps/worker`: `media-blob-spike.test.ts` | 3/3 |
| `apps/worker`: `npm run test:owner-auth` | 5/5 |
| `apps/worker`: `npm run test:contact-workflow` | 6/6 |
| `apps/worker`: `npm run typecheck` | PASS |
| `apps/web`: `npm run typecheck` y `npm run build` | PASS |
| `apps/web`: recorrido auth/identidad de `npm run test:e2e:owner` (Workerd + D1 real local) | PASS: 1/1; ejecución completa más reciente pasó esta prueba |
| Regresión foco/logout final (Playwright focalizado) | 1/1 (1.6m): foco inicial, cancelación y restauración al botón de logout |
| Rework Controller P3: cancelar navegación restaura foco al enlace iniciador | PASS, assertion añadida a Playwright y corrida integrada final 2/2 (2.3m) |
| Regresión GitHub P2: cancelar logout conserva cambios y sesión | PASS, Playwright integrado |
| Regresión GitHub P2: actualizar lista conserva/bloquea foto pendiente | PASS, Playwright integrado |
| GitHub P2: OWNER Static Assets y E2E state reset | PASS, tests Worker + dos arranques E2E independientes |
| GitHub P2: foto staged al borrar + foco modal de salida | PASS en el candidato anterior; E2E integrado 2/2 y foco focalizado 1/1 |
| GitHub P2 `4343754584`: foco/teclado de diálogos destructivos | PASS, suite completa OWNER 2/2 (3.6m) |
| GitHub P2 `4343798935`: orden combinado OWNER Static Assets + D1 BLOB | PASS, `owner-d1-blob-media.test.ts` 13/13 y Worker typecheck |
| GitHub P2 `4343866111`: fallo y reintento de configuración de medios | PASS, Playwright OWNER focalizado 1/1; sintéticos 503 iniciales, retry real exitoso y controles correctos para fotos Static Assets |
| Owner CRUD/fotos/inbox/availability y regresiones de diálogos | PASS, Playwright OWNER focalizado 1/1; incluye sesión expirada y galería mixta reordenada |
| Preflight de compilación final | Web typecheck/build PASS; Worker typecheck PASS |
| Controller P2 sobre `3129ce7`: borrador con foto Static Asset mostraba carga incompatible | PASS, UI oculta selector después de cargar imágenes; OWNER E2E focalizado 1/1 (59.9 s) con fixture sintético |
| Controller evidencia: expected del desempate de fotos calculado por comparador tautológico | PASS, esperado fijo explícito; Worker `owner-d1-blob-media.test.ts` 13/13 |
| GitHub P2 `4347641100`: redirección forzada de sesión expirada ante cambios sin guardar | PASS, Playwright simula 401 al guardar y verifica login, sin diálogo cancelable ni datos privados |
| GitHub P2 `4347641116`: reordenamiento pierde filas Static Assets en UI | PASS, Workerd+D1 E2E reordena una foto D1 BLOB y conserva 3 filas combinadas |
| Web tras rework del Controller | PASS, `npm run typecheck` y `npm run build` |
| Consistency validator contra `origin/main` y `git diff --check` | PASS |

Los tests de media se ejecutaron por archivo para aislar Workerd; el spike de 256 KiB necesitó `--testTimeout=15000` en la primera corrida concurrente. La suite final integrada pasó sin concurrencia de QA adicional.

## Accesibilidad y evidencia visual

Contraste calculado con luminancia sRGB para tokens usados en texto: forest `#263b31` sobre canvas `#f3efe5` = 10.44:1; muted `#5d6b61` sobre canvas = 4.89:1; arcilla interactiva `#a65333` sobre canvas = 4.68:1; anillo `#71411f` sobre canvas = 7.38:1. Todos superan 4.5:1 para texto normal. El skip-link se verificó por teclado y aparece visible al recibir foco.

Capturas Playwright reales (no prototipos):

- Login desktop: [1440 × 1000](./owner-auth-desktop-1440x1000.png)
- Login mobile: [390 × 844](./owner-auth-mobile-390x844.png), [320 × 844](./owner-auth-mobile-320x844.png)
- Dashboard con publicación seed: [1440 × 1000](./owner-dashboard-desktop-1440x1000.png), [390 × 844](./owner-dashboard-mobile-390x844.png), [320 × 844](./owner-dashboard-mobile-320x844.png)
- Alta vacía desktop: [1440 × 1000](./owner-dashboard-empty-desktop-1440x1000.png)
- Fotos aprobadas en lectura: [1440 × 1000](./owner-approved-photos-desktop-1440x1000.png)
- Editor y fotos del borrador: [1440 × 1000](./owner-listing-editor-desktop-1440x1000.png)
