# M1 — evidencia pública local

Base de ejecución: `main@d5a26a0c6f1ad68dd77a13459ade1c15573a15cf`. Entorno local con Vue, Worker/Hono y D1 local; datos de `seed-catalog.sql` sintéticos. Sin llamadas a Cloudflare remoto ni migraciones nuevas.

## Validación

- Playwright público integrado: **6/6 PASS** (catálogo/filtros/paginación/retorno, estados de error/vacío/reintento, ficha/consulta idempotente, regresión #35 y recorrido M1). Después del último ajuste de presentación y del envío mensual con Enter desde ubicación, el recorrido M1 pasó de nuevo: **1/1 PASS**; las capturas de error/vacío también se regeneraron con su prueba focalizada (**2/2 PASS**).
- Web typecheck: **PASS**.
- Web production build: **PASS**.
- Anchos verificados sin overflow horizontal: **1440, 390 y 320 px**. Capturas completas obtenidas desde el navegador real del test.
- La suite conserva pruebas existentes de estado vacío, error, imagen rota, teclado/foco, filtros, paginación y retorno desde ficha. El camino M1 añade precio mensual frente a duración `PERMANENT` y `FLEXIBLE`, query persistente, acceso a anuncios semanales y consulta no reservante.
- La métrica local de 25 lecturas del catálogo pertenece al test I07 existente; es solo observación de Workerd+D1 local y no evidencia de capacidad en Cloudflare.

## Capturas

| Pantalla | Viewport | Archivo |
|---|---:|---|
| Catálogo mensual | 1440 × 1000 | [desktop](catalog-monthly-desktop-1440x1000.png) |
| Catálogo mensual | 390 × 844 | [mobile 390](catalog-monthly-mobile-390x844.png) |
| Catálogo mensual | 320 × 844 | [mobile 320](catalog-monthly-mobile-320x844.png) |
| Catálogo, error recuperable | 1440 × 1000 | [error desktop](catalog-error-desktop-1440x1000.png) |
| Catálogo, sin resultados | 390 × 844 | [empty mobile](catalog-empty-mobile-390x844.png) |
| Ficha mensual + consulta | 1440 × 1000 | [desktop detail](listing-monthly-desktop-1440x1000.png) |
| Ficha mensual + consulta | 390 × 844 | [mobile detail](listing-monthly-mobile-390x844.png) |

Las capturas muestran datos sintéticos existentes. El fixture local de `Casa del Río Quieto` declara precio mensual y duración `PERMANENT` intencionalmente, para demostrar que ambos campos son independientes; no se carga en Preview.
