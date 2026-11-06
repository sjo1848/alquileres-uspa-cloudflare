# M3.6 — Google ADMIN con provisión explícita por sub

- Issue: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/81
- Roadmap: https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/55
- Base autorizada: `main@fda7b867608acc2848d0e6a0c1944c40dc2b7ec1`
- Rama: `feat/m3-6-google-admin-auth`
- Estado: implementación local en curso; PR único y merge manualmente gated.

## Alcance aprobado

Extender M3.5 para que una cuenta ADMIN existente pueda usar Google en modo `GOOGLE`, con la identidad asociada solo por `provider=google` + `sub` verificado. Las cuentas OWNER conservan su alta y sesiones actuales. Un usuario nuevo no puede darse permisos ADMIN: la identidad ADMIN se agrega mediante una operación interna de provisión que verifica un token Google firmado recientemente, apunta a un user ID existente con rol ADMIN confirmado en D1 y registra el actor de provisión. No existe endpoint público de provisión.

Las sesiones Google ADMIN tendrán tabla y validación separadas de OWNER, cookies/origin/CSRF comunes, expiración explícita, revocación individual al logout y expiración/revocación de provisión consultada en cada request. El rol persistido en D1 es autoridad; claims o parámetros del cliente no asignan rol.

Agregar migración 0018 solo local/test si hace falta. E2E local con D1 sintética: OWNER Google crea anuncio; ADMIN Google provisionado en un segundo contexto lo revisa/aprueba; ADMIN publica solo mediante la acción explícita existente. Cubrir acceso cruzado, email coincidente, claims falsos, IDOR, provisión inválida, expiración y logout.

## No autorizado

Sin Google Console o credenciales reales, D1 remota, Access, secretos, CD, Preview/deployment, producción, repositorio fuente, M4 ni nuevas tareas de infraestructura.

## Gates de entrega

Un PR funcional con tests, CI Worker/Web y revisión técnica exacta. PR queda abierto y no se fusiona sin autorización expresa del Product Owner sobre el SHA exacto, por el impacto en autenticación y roles.

## Requisitos concretos para activar Google real (fuera de este PR)

- Crear un OAuth Web Client en Google Cloud con JavaScript origins exactos para cada entorno autorizado (incluidos los orígenes HTTPS de Preview y los loopback locales usados en desarrollo); el Client ID es público y no sustituye validación server-side.
- Configurar `GOOGLE_CLIENT_ID` y `AUTH_STRATEGY=GOOGLE` en el Worker; `JWT_SECRET` debe existir solo como secreto del Worker, con al menos 32 bytes aleatorios. GIS entrega el ID token al navegador y no requiere introducir un client secret en este flujo.
- Aplicar `0017_google_owner_identity_sessions.sql` y `0018_google_admin_identity_sessions.sql` a la D1 objetivo mediante un procedimiento remoto separado y autorizado; este PR no ejecuta ni autoriza migraciones remotas.
- Para cada administrador, conservar una cuenta D1 ya asignada por el servidor con rol `ADMIN`; un operador verifica la identidad Google y la vincula por `sub` mediante el procedimiento/script de provisión. Verificar por fuera de la sesión quién es titular de ese `sub`; no inferirla del correo.
- Tras una activación autorizada, probar OWNER y ADMIN en entorno aislado, comprobar denegaciones cruzadas, logout/revocación y mantener Preview Access/producción sin cambios hasta autorizar esas operaciones por separado.
