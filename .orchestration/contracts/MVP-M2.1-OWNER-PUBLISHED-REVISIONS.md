# MVP M2.1 — #61: revisiones de anuncios existentes (OWNER → ADMIN)

Estado: `PRODUCT_RULE_APPROVED / IMPLEMENTATION_NOT_STARTED`
Aprobación de negocio: responsable del producto, 2026-10-28.
Issue canónico: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/61
Bloquea aceptación de #58; sin M3 hasta nueva aprobación.
Base de la rama: `main@5feecd42634a50b192fb1aa66a1a8c08ec3806e1`.

## Regla aprobada — NO AMPLIAR

El propietario puede editar datos y condiciones de un alquiler existente, incluso ya publicado. **Guardar** persiste una revisión privada ligada al MISMO `listingId`; la ficha pública aprobada permanece sin modificaciones. **Enviar** somete la revisión a ADMIN. ADMIN puede **rechazar** con motivo o **aprobar**, pero solo una acción posterior y separada **Publicar cambios** actualiza la ficha pública. Conserva identidad, fotografías, consultas y datos históricos. Nada se publica automáticamente.

Alquileres `DRAFT`/`REJECTED` conservan su edición directa existente. `SUBMITTED` continúa en lectura con mensaje claro durante revisión. Aplicar la revisión a `APPROVED` sin sobrescribir su versión pública prematuramente, y definir explícitamente el tratamiento de `APPROVED/UNPUBLISHED` antes de implementar su UI.

## Entrega técnica por etapas incrementales, en esta rama

### P1 — D1 local / modelo (sin remotos)
- Diseñar migración aditiva `0015`, por ejemplo `listing_change_revisions`, vinculada FK a `listings.id`, con estados `DRAFT | SUBMITTED | REJECTED | APPROVED | APPLIED`, actor/fechas, revisión/versiones y cuerpo de campos tipados/validados. Una revisión activa por listing; política explícita al rechazar, volver a editar y evitar duplicados.
- No modificar `listings` por guardar ni enviar. No backfill de registros existentes. No almacenar secretos ni sesiones.
- Crear tests D1 local y ensayar transiciones, índices y constraints, incluyendo valores legacy `NULL` de `0014`.
- Revisar si el guard CI de migraciones exige allowlist para `0015`; **no añadirlo como aprobado remoto** sin otra revisión y gate.

### P2 — Backend/seguridad
- Añadir rutas OWNER para obtener revisión, crear/guardar borrador y enviarlo. Comparar versiones para evitar pisar cambios concurrentes; validar ownership exacto, origen/CSRF, tamaño de body, todas las condiciones M2.1 y campos base. Nunca actualizar `listings` con el guardado.
- Añadir rutas ADMIN para consultar revisión y diff vigente/revisión, rechazar con motivo, aprobar y luego aplicar/publicar con operación atómica y evento de auditoría. Releer status/versión dentro de la operación protegida; rechazar estado obsoleto, permisos ajenos y replay conflictivo.
- Mantener `/listings/:id` PATCH actual para `DRAFT/REJECTED`, sin eliminar sus controles. No habilitar un PATCH no moderado a `APPROVED/PUBLISHED`.
- El catálogo público debe leer exclusivamente datos aprobados de `listings`, **nunca** los de la revisión pendiente. Las imágenes y `contact_events` no se copian, eliminan ni alteran.
- Retener separación ADMIN aprobación/publicación: aprobar no hace public la modificación; rechazadas no alteran publicación; reintentos no duplican eventos/ediciones.

### P3 — UI OWNER y ADMIN
- OWNER: `Editar alojamiento` y `Guardar cambios` cuando el anuncio está `APPROVED`, identificando con claridad **borrador privado** vs **publicado**. Permitir guardar, recargar y reabrir sin perder cambios; `Enviar a revisión`; mostrar estado de revisión y errores de conflicto. Campos de alquiler mensual: depósito/garantía, servicios, mascotas, fecha; conservar coherencia `MONTH/WEEK`.
- ADMIN: cola específica de revisiones, con diferencias entre versión vigente y propuesta, aprobar/rechazar y **Publicar cambios** aparte, con mensajes y auditoría. No mezclar la cola de nuevas publicaciones con revisiones de fichas aprobadas sin distinción.
- Responsive 320px/390px/1440px, estados accesibles, sin pérdida de foco, sin exigir nueva cuenta ni modificar navegación general.

### P4 — QA y revisión
- Tests mínimos: OWNER DRAFT/REJECTED sigue guardando; OWNER `APPROVED/PUBLISHED` guarda revisión y recarga; `listings` público queda idéntico antes de aprobación, después de aprobación y después de rechazo; únicamente cambia luego de `Publicar cambios` autorizado; misma ID, fotos y consultas intactas; OWNER ajeno 404, ADMIN ausente 401/403; versiones simultáneas/409; reintentos/idempotencia; depósitos válidos/inválidos, datos legacy NULL, semana/mes, fecha; cancelación/rechazo y recuperación; errores D1 no provocan publicación parcial.
- CI Worker/Web, análisis estático, lint, tests D1 local y Playwright sobre entorno sintético local. Independent Critic e Integration Review **del SHA exacto** y Controller con dictamen final o estado honesto de gate.
- Si no hay sesión Cloudflare Access autorizada, QA remota autenticada queda `BLOCKED_AUTH`, no `PASS`.

## GATES que siguen cerrados

La aprobación del usuario se limita al **comportamiento** y a preparar código y pruebas en una rama. No autoriza merge, nueva D1, migración `0015` en D1 remota, publicación del Worker/Preview, CD/Access, cambios de producción, datos reales, costos nuevos ni comenzar M3.

Tras P1–P4, presentar PR protegible, hash exacto, diff, evidencias, hallazgos y solicitud de gate de merge. Si se aprueba merge, el siguiente gate es preflight/backup/allowlist hash exacto antes de migración D1 sintética existente, y otro gate distinto es la publicación privada. Mantener #61 y #58 OPEN hasta aceptación visual funcional.

## Instrucciones de ejecución

Unidad canónica de trabajo: Issue #61. FALDEO: Controller coordina, implementador ejecuta incrementos pequeños, Independent Critic y Integration Review read-only verifican SHA exacto. Evidencia en el Issue/PR; nunca fingir PASS ni editar producción.

**STOP después del primer PR revisable o al encontrar un bloqueante material**. No aplicar migración remota y no desplegar.
