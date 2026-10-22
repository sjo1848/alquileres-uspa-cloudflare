# PR #40 — rework consolidado de hallazgos GitHub

Head revisado por GitHub: `868a2c79cdf715816520f5c549a8086c4065f7fa`. Candidato ejecutable que corrige ambos hallazgos: `a39d14ba41e227a56cd9199458aca858e13990f0`.

## P2 `4347641100` — expiración de sesión y edición pendiente

**Escenario:** OWNER conserva cambios sin guardar; una API devuelve 401; la app marca la sesión anónima e intenta llevar al login, pero el guard voluntario de salida ofrecía cancelar y dejaba contenido privado visible.

**Cambio:** el guard de salida OWNER permite la navegación cuando la sesión ya no está autenticada. En una navegación voluntaria autenticada, el diálogo y la protección de cambios siguen vigentes.

**Regresión:** Playwright crea un DRAFT sintético, cambia el título sin guardar, recibe un 401 sintético al guardar y comprueba URL de login por sesión expirada, ausencia del diálogo cancelable y ausencia del título/contenido OWNER privado.

## P2 `4347641116` — galería mixta al reordenar

**Escenario:** para un DRAFT sintético con dos filas D1 BLOB y una Static Asset, la respuesta PATCH contiene filas dinámicas; asignarla directamente al estado Vue eliminaba visualmente la Static Asset hasta recargar.

**Cambio:** después de confirmar el reorder, Vue consulta de nuevo el GET de imágenes OWNER, que devuelve la colección combinada canónica.

**Regresión:** el E2E reordena `mezcla-b.png` y confirma que persisten tres tarjetas, la imagen movida pasa al primer lugar y `cabana-cerro.svg` sigue visible al final.

## Verificaciones afectadas

- `apps/web`: typecheck y build PASS.
- Playwright OWNER focalizado: 1/1 PASS (55.7 s), Vue + Worker/Hono + Workerd + D1 local reseed; cubre upload bloqueado para Static Asset, upload disponible en D1 BLOB después de retry de `/auth/config`, reorder mixto y sesión expirada.
- Worker `owner-d1-blob-media.test.ts`: 13/13 PASS (la corrección de expectativa fija es la misma del candidato; no cambió Worker desde esa ejecución).
- Sin suites completas adicionales, Preview, R2, datos reales, correo externo o servicios pagos.
