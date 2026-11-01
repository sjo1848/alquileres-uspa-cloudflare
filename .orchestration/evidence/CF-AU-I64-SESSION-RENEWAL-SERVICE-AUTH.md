# I64 — renovación de sesión y preparación de Service Auth

## Resultado de implementación local

- La sesión interna OWNER/ADMIN conserva una cookie JWT corta, `HttpOnly`, `Secure` en HTTPS y `SameSite=Lax`; su `Max-Age` sigue el `exp` firmado y nunca supera 15 minutos ni la expiración Access.
- El frontend renueva preventivamente al 70 % de la vida restante (máximo 10 minutos), comparte una sola renovación concurrente y revalida al volver mediante `focus`, `pageshow` y `visibilitychange`. El logout invalida tareas en vuelo y cancela el temporizador.
- Para inactividad/reapertura, una segunda cookie opaca `HttpOnly` y `SameSite=Lax` se limita a `Path=/api/auth`, se conserva por un máximo absoluto de siete días y no se extiende con renovaciones. Solo se renueva la sesión corta si cada petición porta una aserción Access vigente, firmada y válida para el issuer/audience exactos.
- La aserción Access nunca se extiende: se verifica RS256, issuer, audience, `type`, `sub`, `iat`, `exp` y firma; el límite de antigüedad de hasta 30 días solo evita rechazar aserciones antiguas que todavía no vencieron. El `exp` real sigue siendo obligatorio. Cloudflare puede emitir un nuevo token de aplicación mientras su token global siga válido.
- La renovación obtiene rol, email e ID únicamente de la sesión persistida y la fila sintética D1; no acepta rol del cliente. La identidad firmada se vincula al `sub` humano o al Client ID exacto de Service Auth.
- El secreto aleatorio de refresh solo se entrega en la cookie y D1 almacena su SHA-256. La migración aditiva `0016_preview_auth_sessions.sql` registra SID, binding de identidad, versión, caducidad y revocación individual. Logout marca solo ese SID y no incrementa `users.session_version`; sesiones OWNER/ADMIN abiertas en otros navegadores permanecen válidas.
- La migración 0016 está en código y ensayada sobre D1 local sintética. No se aplicó a D1 remota; cualquier integración/despliegue requiere resolver y autorizar esa migración por separado.
- No se guardan JWT, refresh credentials ni credenciales Access en `localStorage` o `sessionStorage`.
- Si la aserción Access ya venció, Access middleware rechaza la petición de logout antes de la revocación. El cliente conserva la sesión local y muestra error; al recuperar una identidad Access vigente, el logout revoca el SID persistido. No se presenta como revocado algo que no fue confirmado.

## Límites de sesión y configuración Access observada

Consulta de solo lectura registrada el 2026-11-01: la aplicación privada existente indica `session_duration=1h`; la política `Operator only` es Allow y no define duración, por lo que hereda la de la aplicación. La API consultada no devolvió la duración global de la organización ni la sesión del IdP. WARP/Cloudflare One Client figura desactivado; no se observó duración cliente aplicable. Service-token strict mode figura desactivado. No se modificó ninguna de estas opciones.

Para una sesión humana aproximada de siete días, la propuesta **no ejecutada** es:

1. En Cloudflare Zero Trust → Access controls → Applications, abrir solamente `Alquileres Uspallata private Preview` y elegir `Session Duration: 1 week (168 hours)`.
2. En la política existente `Operator only`, mantener acción `Allow`, el mismo selector de identidad y elegir `Session Duration: 1 week (168 hours)` en vez de un valor distinto/inmediato. No crear Bypass ni Everyone.
3. Revisar el valor global antes de cambiar nada. Si el token global vence antes de 168 horas, Access volverá a pedir autenticación aunque la aplicación tenga una semana. Cambiar el valor global puede afectar todas las aplicaciones Access de la organización; no forma parte de esta propuesta acotada y requiere autorización específica. La duración del IdP tampoco pudo medirse desde la API consultada y puede imponer su propio reingreso.

El token de aplicación de Access puede renovarse automáticamente mientras el token global sea válido y la identidad continúe pasando las políticas. La cookie interna no debe confundirse con esos tokens ni se pretende prolongar una sesión Access vencida. Referencia oficial: https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/ .

## Service Auth para Playwright — preparado, inactivo

- La prueba local de Playwright usa un par RSA sintético con issuer `.invalid`, audiencia sintética y Client ID de prueba. El Worker acepta ese verificador únicamente si `PREVIEW_AUTH_LOCAL_TEST=true` y el origen exacto es `http://127.0.0.1` o `http://localhost`; el config de E2E no es el config de Preview.
- La validación de producción/Preview no usa ese JWK: sigue comprobando las claves públicas de Cloudflare Access. El Service Auth remoto permanece fail-closed mientras falte `PREVIEW_QA_SERVICE_CLIENT_ID`.
- El config remoto se denomina explícitamente mutating y falla antes de cargar credenciales a menos que `PREVIEW_QA_ALLOW_REMOTE_D1_WRITES=true`; el flujo de rol crea una fila de sesión sintética en D1 aunque el resto de las comprobaciones sean GET. Cuando un futuro test remoto sea autorizado, también exige `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET`, los adjunta solo al origen estable `https://private-alquileres-uspa-lab.sjo1848.workers.dev` y los elimina para otros orígenes. Trazas/capturas/video están desactivados. No se ejecutó con credenciales reales.
- Activación futura, con autorización independiente: crear un token dedicado de vida limitada; agregar a la aplicación Preview una política `Service Auth` que incluya solamente ese Service Token; mantener `Operator only` sin cambios; guardar Client ID y Secret en el almacén local de secretos, permisos `0600`, y usar el Client ID exacto como `PREVIEW_QA_SERVICE_CLIENT_ID` del Preview. En Playwright proporcionar ambas variables solo en el proceso local, sin imprimirlas, registrarlas ni agregarlas al repositorio. En las peticiones del servicio se usan `CF-Access-Client-Id` y `CF-Access-Client-Secret`; Access verifica la política y firma la aserción que recibe el Worker.
- No usar Bypass, Everyone, identidad por query/header del Worker, tokens compartidos con operador, Secrets de GitHub ni cambios a `strict_service_token_auth` global.
- Rollback futuro: quitar la política Service Auth específica, revocar/deshabilitar el token dedicado y eliminar el binding `PREVIEW_QA_SERVICE_CLIENT_ID`; restaurar las duraciones Access anteriores si fueron aprobadas y guardadas como respaldo. No afecta `Operator only`.

Referencias oficiales: https://developers.cloudflare.com/cloudflare-one/access-controls/authenticate-agents/ y https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/ .

## Evidencia y límites

- `apps/worker: npm run test:preview-auth`: 11/11 pruebas HTTP/D1 de firmas/claims, audiencia, issuer, exp, aserción antigua todavía válida, CSRF/origen, payload, roles, session version, refresh con cookie faltante/manipulada, identidad de servicio exacta, revocación y sesiones OWNER/ADMIN simultáneas.
- `apps/web: npm run test:e2e:preview-auth:local`: 1/1 Chromium contra Worker/Hono + D1 local sintética. Usa expiración real de cookie de 5 segundos, renovación preventiva, cierre/reapertura de perfil con cookie corta expirada y refresh persistente, recorrido OWNER → ADMIN, publicación explícita y logout selectivo entre perfiles.
- Confirmación fail-closed: invocar `test:e2e:preview-auth:remote-mutating` sin `PREVIEW_QA_ALLOW_REMOTE_D1_WRITES`, `CF_ACCESS_CLIENT_ID` ni `CF_ACCESS_CLIENT_SECRET` falla al cargar configuración con la advertencia de escritura D1; Playwright no inicia y no hay llamada remota.
- Verificación actual adicional: Worker `npm run typecheck` PASS; Web `npm run typecheck`, `npm run build` y `npm run build:preview` PASS; `git diff --check` y `scripts/check_orchestration_state.py` PASS.
- Esta prueba simula localmente una aserción firmada con la forma de Service Auth; **no** acredita conectividad real con Cloudflare Access, una política remota o un token real. La E2E remota permanece `BLOCKED_AUTH` hasta una autorización y activación separadas.
- No hubo cambios remotos, despliegues, migraciones D1, tokens, políticas, CD, producción ni modificaciones al repositorio fuente.
