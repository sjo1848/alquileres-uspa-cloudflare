# CF-AU-I06.5 — Autenticación y experiencia OWNER

**Issue:** #32 · **Base:** `48e4f5c4251fe939cb779698e4e51b16614be178` · **Dirección:** C híbrida aprobada en #29 y aplicada en #30/#31.

## Resultado

Entregar una experiencia OWNER clara, accesible y responsive integrada con las rutas existentes de Vue, Worker/Hono y D1 local sintética.

## Alcance

- Registro/verificación simulados, login, recuperación/restablecimiento, sesión expirada y logout mediante I05 sin alterar sus límites.
- Dashboard de publicaciones con estado, resumen y próxima acción; creación/edición de borradores, validación y protección de cambios sin guardar.
- Gestión D1 BLOB existente: previsualización, carga, orden, borrado y recuperación de errores/idempotencia.
- Disponibilidad y reconfirmación con fecha/estado fiables y sin prometer reserva; ficha publicada y sus fotos visibles en modo lectura.
- Inbox OWNER paginado de consultas reales sintéticas, conteo y cambio leída/no leída.
- Corregir #36 con evidencia en navegador; no cerrar #35 globalmente hasta que #33 pruebe el formulario ADMIN.
- Corregir durante este PR la reconciliación canónica de I06.4 posterior al merge PR #39 (`main@48e4f5c...`), sin PR solo documental.

## Seguridad y límites

- Reutilizar I05: `PASSWORD` solo con guardas locales explícitas y correo `MOCK`; `ACCESS_PREVIEW` conserva su política y prohibición de login/registro público por password.
- No cambiar reglas de negocio, roles, cookies, CSRF/origin, sesión, rate limits, idempotencia ni rutas de autorización para adaptar la UI.
- Playwright real con Vue + Worker/Hono + D1 local; usuarios e imágenes `.test` sintéticos. Probar OWNER/ADMIN, otro OWNER, expiración, operaciones repetidas, borrado y errores.
- No modificar #33 ADMIN salvo regresiones compartidas necesarias; no Preview/Access remoto, producción, pagos, correo externo, R2, datos reales o repositorio fuente.

## Criterios de aceptación

1. Recorrido integrado de registro → correo mock local → verificación → login → logout y recuperación/reset funciona con persistencia D1; registro y recuperación no revelan existencia de cuenta.
2. OWNER puede crear/editar/guardar, subir/ordenar/eliminar imágenes con sus contratos actuales, actualizar/reconfirmar disponibilidad, enviar a revisión y leer/cambiar estado de consultas.
3. Aprobada con fotos presenta sus fotos en modo lectura y nunca indica falsamente que no existen (#36); permisos de imágenes/acciones siguen en Worker.
4. Pérdida accidental queda prevenida al recargar/cambiar selección/abandonar una edición; destructivas tienen confirmación; errores preservan datos y reintentan de forma segura.
5. Sesión expirada, OWNER/ADMIN y aislamiento entre dos OWNER se verifican en Worker y en browser; solicitudes duplicadas/idempotentes y sin permiso no mutan D1.
6. Playwright integrated con D1 local prueba desktop, mobile 390/320, teclado/foco, auth mock, publicaciones, fotos, disponibilidad, inbox, error y logout; capturas inspectables versionadas.
7. Worker focal tests, Web typecheck/build, CI `worker`/`web`, exact-head GitHub review, Controller read-only proporcional, Pre-Critic/validador y merge protegido PASS. Cerrar #32 y actualizar #25 sólo con evidencia; detener antes de #33.
