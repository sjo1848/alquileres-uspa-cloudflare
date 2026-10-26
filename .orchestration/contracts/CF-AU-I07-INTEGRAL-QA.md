# CF-AU-I07 — QA integral (Issue #26)

- **Autorización:** Issue #26; base `main@b7e1d7b27f778ec56de29ed5bcd446f199d1a412`.
- **Dirección de producto:** I06 cerrada; D3.1 aprobada por Product Owner. I07 es QA y correcciones reproducibles, no autorización de lanzamiento ni de I08.
- **Ejecución:** local con Vue + Vite, Worker/Hono/Workerd y D1 sintética. Identidades y correo `example.test`/MOCK. Wrangler local R2 emulado se usa exclusivamente en la suite heredada de regresión; no se toca R2 remoto ni se crean recursos.
- **Dentro del alcance:** cerrar defectos reproducibles P0/P1; representación de tamaños de imagen sub-KB; corregir el parser JSONL de Wrangler y el guard de procedencia mutable fail-closed; recorridos integrados públicos, OWNER y ADMIN; pruebas de seguridad, estados, accesibilidad y responsive; publicar evidencia y reconciliar estado en el PR funcional.
- **Fuera del alcance:** Preview/Access/D1 remotos, activar CD, migraciones remotas, producción, usuarios o datos reales, R2 remoto, servicios/costos nuevos, autenticación/correos reales, I08.
- **Regla de evidencia:** diferenciar siempre pruebas locales sintéticas, checks GitHub, verificaciones Cloudflare remotas y aceptación humana. Una categoría no implica otra.
- **Cierre:** solo declarar PASS para criterios con evidencia ejecutada. Dejar Issue #26 abierto para aceptación humana y detenerse antes de I08.
