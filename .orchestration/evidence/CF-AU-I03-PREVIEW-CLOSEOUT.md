# CF-AU-I03 — integración y Preview privado

Fecha: 2026-10-18  
PR funcional: [#19](https://github.com/sjo1848/alquileres-uspa-cloudflare/pull/19)  
Artifact A2: `CF-AU-I03-Artifact-A2` → `76fbdfd2b711f4f765be122ba9f539f0ca101963`  
Integración protegida: `0db6c0c79aaeae2204c0fe704c66d4faccdb3c05`

## Resultado

PR #19 se integró en `main` por el flujo protegido, sin reescribir la historia. El diff desde el Artifact A2 aprobado hasta el merge contiene solo estado/evidencia; no hay cambios ejecutables posteriores al SHA revisado. Se verificó que los checks `worker` y `web` fueron exitosos, la revisión automática no dejó hallazgos sin resolver y `main` exigía ambos checks con historial lineal estricto.

La entrega incluye contacto idempotente, disponibilidad y reconfirmación OWNER, bandeja OWNER paginada, creación asistida ADMIN y el registro de auditoría. El recorrido ADMIN de revisión y publicación ya estaba disponible en la aplicación; el Preview actualizado usa la misma API y base D1 sintética.

## Verificación local

- `npm run test:admin` en `apps/worker`: 1 archivo, 12 pruebas PASS; cubre OWNER/ADMIN, aprobación separada de publicación, rechazo y auditoría en D1 sintética.
- Playwright local con Workerd y D1 sintética aislada, mediante `apps/web/e2e/preview-role-switch.playwright.js`: PASS. El recorrido creó y envió una publicación como OWNER, cambió explícitamente a ADMIN, aprobó sin publicar, publicó en una acción separada y confirmó la ficha en el catálogo.
- Captura sintética: `output/playwright/preview-admin-role-switch.png`.
- `wrangler d1 migrations list DB --remote --config apps/worker/.wrangler/wrangler.preview-migrations.runtime.jsonc`: `No migrations to apply` después de aplicar 0011 y 0012 al D1 sintético existente.

La suite extensa no se repitió: el código ejecutable del merge coincide con el Artifact A2 que ya tenía sus verificaciones aprobadas; esta sesión agregó únicamente la prueba focalizada ADMIN.

## Preview

- URL estable privada: <https://private-alquileres-uspa-lab.sjo1848.workers.dev>
- Despliegue inmutable: <https://d613b6dc-alquileres-uspa-lab.sjo1848.workers.dev>
- Se actualizó el mismo Worker `private` con `wrangler preview`; no se ejecutó `wrangler deploy` ni se tocó producción.
- Access continúa protegiendo el Preview. Las rutas `/`, `/health`, `/admin` y `/api/owner/contact-events` devolvieron 403 anónimo tanto en la URL estable como en la inmutable (8/8 denegadas antes de la aplicación).
- Playwright CLI y navegador integrado no proporcionaron una sesión autenticada en esta ejecución; el primero quedó en la pantalla de inicio de Access y el segundo no pudo conectarse. El E2E remoto autenticado queda como `BLOCKED_AUTH`; no se exportaron cookies/tokens ni se alteró Access.
- Presupuesto y límites: USD 0; datos sintéticos; sin R2, recursos nuevos, política Access adicional, facturación ni producción.

## Continuación

CF-AU-I03 está integrado y publicado. Siguiente paso: continuar con el próximo recorrido funcional autorizado desde Issue #7 sobre el Preview privado existente. Mantener Playwright local como QA principal; repetir smoke remoto autenticado solo cuando el navegador de ejecución disponga de una sesión normal de Access. Sin R2, recursos nuevos, gasto, producción ni cambios al repositorio fuente.
