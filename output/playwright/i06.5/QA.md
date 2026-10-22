# I06.5 — QA local OWNER

Entorno reproducible: Vue/Vite + Worker/Hono en Workerd + D1 **local** aislada, imágenes D1 BLOB, cuentas sintéticas `.test` y correo `MOCK`. No se usó Preview, Access remoto, R2, correo real, datos reales ni recursos pagos.

## Recorridos verificados

- Registro → bandeja MOCK → verificación de un solo uso → login → logout.
- Recuperación antienumeradora (dirección existente/desconocida), restablecimiento, rechazo de contraseña anterior y nuevo login.
- OWNER abre publicación aprobada con fotos (regresión #36), las lee en modo privado, y no puede editarlas; otro OWNER no puede acceder. La API también rechaza mutaciones de fotos en estado aprobado.
- Disponibilidad/reconfirmación y consulta real sintética en inbox; cambio leído/no leído.
- Crear/editar borrador, error HTTP transitorio y retry preservando campos, advertencia de cambios no guardados, preview local de foto, fallo/retry de carga, orden, borrado confirmado, envío a revisión y eliminación confirmada.
- Regresiones GitHub PR #40: cancelar logout con un formulario modificado conserva sesión y valores; una foto local previsualizada bloquea “Actualizar lista”, ofrece descartar explícitamente y no puede perderse con “Actualizar desde servidor”. E2E focalizado consolidado: 2/2 en 2.2 min sobre Workerd + D1 real local.
- ADMIN no puede usar UI ni API OWNER; sesión expirada no muta estado (regresiones Worker).
- Teclado/skip-link, diálogo de salida y viewports 1440, 390 y 320 px; el E2E comprobó que `scrollWidth <= viewport` en 320 px.

## Resultados

| Verificación | Resultado |
|---|---:|
| `apps/worker`: `npm run test:owner` | 5/5 |
| `apps/worker`: `owner-d1-blob-media.test.ts` | 12/12 |
| `apps/worker`: `media-blob-spike.test.ts` | 3/3 |
| `apps/worker`: `npm run test:owner-auth` | 5/5 |
| `apps/worker`: `npm run test:contact-workflow` | 6/6 |
| `apps/worker`: `npm run typecheck` | PASS |
| `apps/web`: `npm run typecheck` y `npm run build` | PASS |
| `apps/web`: `npm run test:e2e:owner` (Workerd + D1 real local) | 2/2, 2.2 min |
| Regresión GitHub P2: cancelar logout conserva cambios y sesión | PASS, Playwright integrado |
| Regresión GitHub P2: actualizar lista conserva/bloquea foto pendiente | PASS, Playwright integrado |
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
