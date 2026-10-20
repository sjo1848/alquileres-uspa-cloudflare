# CF-AU-I06.4 — Catálogo, ficha y consulta pública

**Issue:** #31 · **Base:** `cc91463d81b1b7d19d0cb44912772f1cd10ecf8e` · **Dirección:** C híbrida aprobada en #29.

## Resultado

Completar con Vue y las APIs existentes el recorrido público catálogo → búsqueda/filtros → ficha → consulta, usando Worker/Hono y D1 locales con fixtures sintéticos. El HTML de I06.2 es referencia visual, no una aplicación simulada.

## Alcance y límites

- Catálogo móvil primero, tarjetas comparables, filtros progresivos y estado de búsqueda/paginación recuperable desde la URL.
- Ficha de alojamiento, galería con manejo de ausencia/error de imágenes y precio/periodicidad/capacidad sin inferencias.
- Consulta real por API; mantener validación del servidor, clave de idempotencia y estados fieles de carga, error, reintento y confirmación.
- Corregir parcialmente #35 en formulario público. El formulario ADMIN asistido queda pendiente de #33; no cerrar #35 en esta etapa.
- Reconciliar el merge I06.3 de `main@cc91463` en STATE/STATUS en este PR funcional.
- No cambiar API, reglas de disponibilidad, frescura, permisos, autenticación, media dinámica, Preview, Access, producción, proveedor, costo ni repositorio fuente. OWNER #32 y ADMIN #33 quedan fuera.

## Criterios de aceptación

1. Catálogo consulta `/public/listings`; filtros/paginación respetan contratos actuales, URL, cancelar/ignorar respuestas antiguas y navegación de regreso.
2. Estados `FRESH`, `STALE`, `UNCONFIRMED`, `AVAILABLE` y `UNAVAILABLE` conservan el significado existente; precio mantiene moneda y periodicidad; ningún estado implica reserva.
3. Ficha usa `/public/listings/:id`, galería con fallback real y CTA/formulario que envía a `/public/listings/:id/contact`.
4. Error y retry no borran filtros/formulario; solo una respuesta HTTP aceptada muestra confirmación; retries conservan la clave idempotente para el mismo payload.
5. El formulario público no superpone labels/campos a 390px y 320px; teclado, foco, contraste y overflow se verifican en browser real.
6. Playwright local recorre filtros, ficha, consulta sintética y negativos; Worker catalog/contact tests y Web typecheck/build pasan. Capturas runtime 1440, 390 y 320px en `output/playwright/i06.4/`.
7. Consistency validator/Pre-Critic, GitHub checks/review y Controller read-only proporcional quedan ligados al candidato; merge requiere protección de `main`.

## Dependencias y evidencia

- PR #38/I06.3 integrado; tokens y navegación de `main` se reutilizan.
- API de catálogo, ficha, imagen estática y consulta existentes; regresiones Worker `public-listings.test.ts` y `contact-workflow.test.ts`.
- La fixture de imágenes solo usa archivos sintéticos gestionados por el repositorio y no representa subida OWNER.
