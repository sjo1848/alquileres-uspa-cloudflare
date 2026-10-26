# I07 — QA integral y evidencia local

**Base:** `main@b7e1d7b27f778ec56de29ed5bcd446f199d1a412`
**Entorno:** navegador Chromium real, Vue/Vite + Worker/Hono/Workerd + D1 local sintética; cuentas `example.test`, correo MOCK. Sin llamadas mutativas a Cloudflare remoto ni datos reales.

## Resultados ejecutados

| Área | Evidencia | Resultado |
|---|---|---|
| Catálogo → ficha → consulta | Playwright público; filtros/paginación/retorno, error/vacío/imagen rota, página inválida y consulta con API/D1 real local e idempotencia; defecto #35 en 320 px | PASS 5/5 |
| OWNER | registro/verificación MOCK/recuperación/login/logout; errores y retry; editor responsive/teclado; fotos D1 BLOB, disponibilidad, inbox; sesión revocada | PASS 5/5 |
| ADMIN | moderación, publicación, recorrido de publicación al catálogo; gestión asistida persistida, auditoría, fecha Mendoza | PASS 2/2 |
| Sistema compartido | shell/navegación D3.1, teclado, foco visible y contraste base | PASS 1/1 |
| HTTP/API y fallos | `apps/worker npm test`: claves idempotentes, ciclo HTTP, límites/fallas de medios, concurrencia, compensación y recuperación local | PASS; HTTP concluyó 285.0 s |
| Parser JSONL y procedencia | `python3 -m unittest scripts.tests.test_preview_cd_guard -v` | PASS 27/27 |
| Guard/script suite | `python3 -m unittest discover -s scripts/tests` | PASS 52/52 |
| Static checks | Worker typecheck; Web typecheck + build + build:preview | PASS |
| Rendimiento local | 25 lecturas secuenciales a `/api/public/listings?page=1` | p50 21.4 ms; p95 35.5 ms; máx. 92.8 ms. Solo Workerd+D1 local; no representa capacidad Cloudflare. |

## Cambios de QA incluidos

- Imágenes positivas menores a 1 KiB muestran bytes, nunca `0 KB`; 1 KiB muestra `1.0 KB`. Se usa un formatter compartido por OWNER, revisión ADMIN y asistencia ADMIN. Regresión incluida para 69, 1023, 1024 y 12 KiB, además de tamaño no finito. La ejecución OWNER también confirma que un BLOB sintético de 124 bytes se muestra como `124 bytes`; ADMIN verifica ese tamaño en moderación y asistencia.
- El parser trata la salida JSONL de Wrangler registro por registro, admite el envelope conocido `wrangler-session` y exactamente un registro `preview`; rechaza JSON malformado, duplicados y tipos no reconocidos. Ambos formatos de deployment output exigen un UUID canónico; la regresión incluye segmentos incorrectos de 36 caracteres.
- Tras los REWORK del Controller y GitHub, el guard conserva fail-closed: mantiene identidades/anclas auditadas, requiere usuarios/listings sintéticos y estados válidos; exige listing owner OWNER, actor ADMIN y target OWNER coincidente. Permite cambios legítimos de workflow, fechas, conteos y medios. Tanto OWNER-delete como ADMIN assisted-delete requieren un recibo idempotente `COMMITTED` con actor, recurso y scope exactos; el audit de ADMIN assisted-delete aporta además target OWNER y debe coincidir con el actor del recibo. Se consultan solo `owner_id`, `scope`, `resource_id` y `state`, nunca la key. El recibo OWNER conserva el evento de rechazo previo de OWNER-create → submit → reject → OWNER-delete. IDs huérfanos o eventos de borrado sin recibo correspondiente se rechazan. No selecciona textos, direcciones, emails en claro, nombres de archivo, bytes de imágenes ni contenido de consultas.
- Regresiones del harness arreglan una consulta SQL de fault injection que no reconocía `session_version`, prueba el acceso de lectura de fotos OWN después de submit (con mutación todavía prohibida) y ejecuta el límite de subida con una sesión válida después de logout.
- Ajuste de aserción obsoleta en D3.1 foundations: valida el enlace OWNER existente, teclado, foco y contraste, sin exigir un CTA que no forma parte del shell actual.

## Capturas

Catálogo y contacto (captura real de navegador):

- Catálogo: [desktop 1440](public-catalog-desktop-1440x1000.png), [mobile 390](public-catalog-mobile-390x844.png), [mobile 320](public-catalog-mobile-320x844.png).
- Ficha/consulta: [desktop 1440](public-contact-desktop-1440x1000.png), [mobile 390](public-contact-mobile-390x844.png), [mobile 320](public-contact-mobile-320x844.png).

OWNER:

- Dashboard: [desktop 1440](owner-dashboard-desktop-1440x1000.png), [mobile 390](owner-dashboard-mobile-390x844.png), [mobile 320](owner-dashboard-mobile-320x844.png).
- Editor/fotografías: [editor desktop 1440](owner-editor-desktop-1440x1000.png), [fotos desktop 1440](owner-photos-desktop-1440x1000.png), [editor mobile 390](owner-editor-mobile-390x844.png), [fotos mobile 390](owner-photos-mobile-390x844.png), [disponibilidad/editor mobile 320](owner-availability-mobile-320x844.png).

ADMIN:

- Moderación: [desktop 1440](admin-moderation-desktop-1440x1000.png), [mobile 390](admin-moderation-mobile-390x844.png), [mobile 320](admin-moderation-mobile-320x844.png).
- Asistencia: [desktop 1440](admin-assist-desktop-1440x1000.png), [mobile 390](admin-assist-mobile-390x844.png), [mobile 320](admin-assist-mobile-320x844.png).

Las capturas públicas fueron emitidas por `npm run test:e2e:public` en I07 y transferidas desde `output/playwright/i06.6-p2/after/` a esta carpeta. OWNER se recapturó con `OWNER_EVIDENCE_DIR=../../output/playwright/i07`; ADMIN se recapturó con `ADMIN_EVIDENCE_DIR=../../output/playwright/i07`. Se restauraron los assets de evidencia I06 de sus directorios originales para conservar el historial. Los screenshots enlazados aquí son los outputs I07; los pasos de ejecución y tamaños figuran en `QA.md`.

## Límites y resultados aún no acreditados

- Los checks de GitHub para `720bf0a` y review automática se iniciaron, pero cambios posteriores del guard invalidan esos resultados para el candidato actual. Se deben repetir sobre el HEAD consolidado. Las reviews previas encontraron REWORKs corregidos; no hay Controller PASS final todavía.
- No hubo E2E remoto autenticado ni una nueva verificación de Access: no hay sesión remota autorizada en este proceso y I07 no autoriza desplegar.
- El smoke de 25 requests es local y sintético. No mide límites reales ni carga concurrente de Cloudflare.
- Pruebas automatizadas de teclado/foco ejecutadas; no se afirma certificación WCAG ni evaluación con lector de pantalla.
- El `0 KB` queda corregido en las superficies con UI de metadatos OWNER/ADMIN; el backend conserva el byte count. No se modificó la lógica de medios.

## Límites públicos del plan Free revisados (documentación oficial, 26/10/2026)

- Workers Free: 100,000 solicitudes por día, 10 ms CPU por invocación y 50 subrequests por solicitud ([límites de Workers](https://developers.cloudflare.com/workers/platform/limits/)).
- D1 Free: 5 millones de filas leídas/día, 100,000 escritas/día y 5 GB de almacenamiento total de cuenta; el límite por base es 500 MB y una fila/BLOB 2 MB ([precios D1](https://developers.cloudflare.com/d1/platform/pricing/), [límites D1](https://developers.cloudflare.com/d1/platform/limits/)).
- Estos topes se documentan para planificación; no consultamos uso de cuenta ni hacemos una prueba remota. Al superar los límites diarios de D1, sus consultas pueden fallar; la adecuación para producción depende del volumen real y no se puede declarar por estos tests locales.


## Auditoría de dependencias (26/10/2026)

- `npm audit --omit=dev`: 0 vulnerabilidades en dependencias de producción, tanto Worker como Web.
- Auditoría completa: Worker 5 avisos en herramientas de desarrollo (3 high, 2 moderate; incluye Wrangler/Vitest tooling/undici/zod); Web 4 (1 high, 3 moderate; tooling Cloudflare/Wrangler/undici). `npm audit` indica fixes disponibles en algunos paquetes, incluyendo una actualización semver mayor de `@cloudflare/vite-plugin`. No se modificaron dependencias en I07. Esto es riesgo residual de cadena de build/QA y debe resolverse/revisarse antes de la preparación de producción; no son vulnerabilidades de dependencias runtime según `--omit=dev`.
