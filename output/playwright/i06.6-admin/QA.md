# I06.6 ADMIN D3.1 — evidencia local

Entorno: Vue + Vite, Worker/Hono real con Workerd y D1 local sintética. El seed usa exclusivamente `example.test`; no se usaron Preview, D1 remota, Access, producción ni datos personales.

## Capturas reales antes/después

| Recorrido | Desktop 1440×1000 | Mobile 390×844 | Mobile 320×844 |
|---|---|---|---|
| Moderación | [Antes](before/admin-moderation-desktop-1440x1000.png) · [Después](after/admin-moderation-desktop-1440x1000.png) | [Antes](before/admin-moderation-mobile-390x844.png) · [Después](after/admin-moderation-mobile-390x844.png) | [Antes](before/admin-moderation-mobile-320x844.png) · [Después](after/admin-moderation-mobile-320x844.png) |
| Gestión asistida | [Antes](before/admin-assist-desktop-1440x1000.png) · [Después](after/admin-assist-desktop-1440x1000.png) | [Antes](before/admin-assist-mobile-390x844.png) · [Después](after/admin-assist-mobile-390x844.png) | [Antes](before/admin-assist-mobile-320x844.png) · [Después](after/admin-assist-mobile-320x844.png) |

La captura móvil de moderación muestra el detalle; Playwright también prueba la navegación lista → detalle y el retorno de foco a la fila. En administración asistida se verifican el editor y la distribución geométrica de etiquetas y controles, sin desbordamiento horizontal.

## Resultado de pruebas

- `apps/web`: `npm run typecheck` PASS; `npm run build` PASS.
- `apps/web`: `npm run test:e2e:admin` PASS, 2/2 sobre el candidato rework. Flujo real de creación OWNER, adjuntar imagen sintética D1 BLOB, envío, moderación, aprobación, publicación separada, rechazo con motivo, gestión asistida con persistencia, disponibilidad, reconfirmación, envío a revisión y auditoría. Regresiones añadidas: fotografía asistida D1 BLOB carga correctamente; `beforeunload` impide pérdida de edición; eliminación no deja estado sucio falso; transferencia de foco lista → detalle; disponibilidad/reconfirmación devuelve frescura recalculada.
- ADMIN E2E: 1440×1000, 390×844 y 320×844; no overflow horizontal; las etiquetas preceden a sus controles. Prueba con teclado de la selección mobile y restauración del foco. Acceso OWNER a `/admin` y ADMIN a un recurso privado OWNER reciben denegación 401/403.
- #37: casos deterministas para mañana/tarde, cruce de día y conversión UTC → Mendoza con formato de 24 horas. UTC de almacenamiento y reglas de frescura no se modifican.
- `apps/worker`: `npm run test:admin` PASS, 12/12; `npm run test:management` PASS, 13/13; `npm run typecheck` PASS. La regresión confirma que los DTOs de disponibilidad asistida y reconfirmación incluyen `freshnessStatus: FRESH` al avanzar la confirmación.
- Regresiones preservadas: `apps/web` `npm run test:e2e:public` PASS, 4/4 (incluye contacto mobile #35); `npm run test:e2e:owner` PASS, 5/5.
- Consistencia canónica y `git diff --check`: PASS antes de publicar el candidato; se repetirán sobre el SHA del PR.

## Rework del Controller sobre de88b48

- Se cerraron los hallazgos P2: protección ante recarga/cierre, reinicio del baseline tras eliminar, URL de imagen D1 BLOB bajo `/api`, frescura en moderación/gestión, movimiento de foco al entrar al detalle y distinción entre SHA ejecutable y HEAD del PR.
- Durante la regresión E2E se detectó además un DTO obsoleto que conservaba frescura `UNCONFIRMED` después de cambiar disponibilidad. Worker usa `publicFreshness()` existente al formar ambas respuestas; los tests Worker y Playwright verifican el contrato actualizado.
- Un intento E2E quedó bloqueado al aceptar el `confirm` nativo de eliminación después de `click`; el test se corrigió para instalar el listener/aceptación antes del click. Ejecución final focalizada: 2/2 PASS. No se interpreta el timeout de prueba como defecto de producto.

## Alcance de medios y seguridad

ADMIN inspecciona imágenes mediante GET autorizado; no se agregó mutación de imágenes, ni endpoints o permisos nuevos. Se conservaron los contratos Worker, idempotencia, control de concurrencia/audit y roles. El CD de staging continúa apagado y seguro; no se tocaron sus guard, Preview, D1 remota ni Access.

### Evidencia compartida para #35

- Contacto público ya corregido: [desktop 1440](../../i06.6-p2/after/listing-contact-desktop-1440x1000.png), [mobile 390](../../i06.6-p2/after/listing-contact-mobile-390x844.png), [mobile 320](../../i06.6-p2/after/listing-contact-mobile-320x844.png). La regresión real del contacto se ejecutó de nuevo con el suite público: PASS.
- Las capturas antes del cambio ADMIN se tomaron sobre el `main` autorizado. En esa repetición no se volvió a observar visualmente la superposición histórica reportada en #28; la regresión geométrica sí comprueba que los controles actuales queden separados a 390 y 320 px. La plantilla renovada aplica el patrón compartido de etiqueta → control y la evidencia permite comparar ambas versiones sin presentar el defecto como reproducido en esta ejecución.
