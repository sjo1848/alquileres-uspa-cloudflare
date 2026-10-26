# I06.6-P3 OWNER — evidencia Playwright

Capturas auténticas de la aplicación Vue con el Worker/Hono y D1 local sintética. No se usó Preview, producción ni datos reales. Las imágenes BLOB roja/azul son fixtures locales de regresión; `cabana-cerro.svg` es el recurso sintético administrado desde el repositorio.

## Comparación antes / después

| Vista | Antes (`main@ec58cd9`) | Después (OWNER D3.1) |
|---|---|---|
| Dashboard, 1440 × 1000 | [Antes](before/owner-dashboard-desktop-1440x1000.png) | [Después](after/owner-dashboard-desktop-1440x1000.png) |
| Editor, 1440 × 1000 | [Antes](before/owner-listing-editor-desktop-1440x1000.png) | [Después](after/owner-listing-editor-desktop-1440x1000.png) |
| Dashboard, 390 × 844 | [Antes](before/owner-dashboard-mobile-390x844.png) | [Después](after/owner-dashboard-mobile-390x844.png) |
| Dashboard, 320 × 844 | [Antes](before/owner-dashboard-mobile-320x844.png) | [Después](after/owner-dashboard-mobile-320x844.png) |
| Fotos aprobadas, 1440 × 1000 | [Antes](before/owner-approved-photos-desktop-1440x1000.png) | [Después](after/owner-approved-photos-desktop-1440x1000.png) |

Capturas adicionales del editor responsive: [Información mobile 390](after/owner-editor-mobile-390x844.png), [Fotografías mobile 390](after/owner-photos-mobile-390x844.png), [Fotografías desktop 1440](after/owner-photos-desktop-1440x1000.png), [Disponibilidad mobile 390](after/owner-availability-mobile-390x844.png) y [Disponibilidad mobile 320](after/owner-availability-mobile-320x844.png).

## Verificaciones locales

- Playwright OWNER completo: **4/4 PASS**, 3.2 min, Worker/Hono + D1 local sintética, correo MOCK. Incluye registro/login/logout, retries, estado de fichas, D1 BLOB y Static Assets, carga/reordenamiento/eliminación, envío a revisión, disponibilidad, inbox READ/UNREAD, sesión revocada, permisos ADMIN→OWNER, diálogos/teclado y recorrido responsive. Luego se añadieron solo capturas de dashboard 320 y fotografías 390; D3.1 focalizado sobre la versión final de las pruebas: **1/1 PASS**.
- Playwright OWNER D3.1 focalizado: **1/1 PASS**, editor Información/Fotografías/Disponibilidad, teclado, regreso lista→detalle, 390/320 px, sin overflow.
- Playwright público: **4/4 PASS**, 1.7 min; filtros/paginación, errores/fallbacks, ficha, contacto D1 e idempotencia, regresión #35 a mobile.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS** (Worker y cliente web local; sin despliegue).
- Validador de estado `python3 scripts/check_orchestration_state.py --base origin/main` y `git diff --check`: **PASS** en el árbol local previo al empaquetado final.

GitHub CI/review, Controller de solo lectura, Pre-Critic e integración protegida se registran sobre el SHA candidato exacto antes del cierre.
