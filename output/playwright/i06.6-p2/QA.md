# I06.6-P2 — evidencia QA pública D3.1

La comparación usa capturas generadas desde la aplicación Vue con Worker/Hono y D1 local real, sembrada exclusivamente con datos sintéticos. `before/` corresponde a `main@639ba0eacb02be6ed96f6ba8746959c792d57e48`; `after/` corresponde al árbol de implementación P2 que pasó el recorrido integrado.

## Capturas comparables

| Vista | Antes | Después |
|---|---|---|
| Catálogo desktop, 1440×1000 | `before/catalog-desktop-1440x1000.png` | `after/catalog-desktop-1440x1000.png` |
| Catálogo mobile, 390×844 | `before/catalog-mobile-390x844.png` | `after/catalog-mobile-390x844.png` |
| Catálogo mobile, 320×844 | `before/catalog-mobile-320x844.png` | `after/catalog-mobile-320x844.png` |
| Ficha y contacto desktop, 1440×1000 | `before/listing-contact-desktop-1440x1000.png` | `after/listing-contact-desktop-1440x1000.png` |
| Ficha y contacto mobile, 390×844 | `before/listing-contact-mobile-390x844.png` | `after/listing-contact-mobile-390x844.png` |
| Ficha y contacto mobile, 320×844 | `before/listing-contact-mobile-320x844.png` | `after/listing-contact-mobile-320x844.png` |

## Resultado

- Playwright integrado `npm run test:e2e:public`: **4/4 PASS** después de consolidar el layout responsive. Cubre filtros/paginación/retorno, carga y error recuperable, vacío y reintento, fallbacks de tarjeta y galería con imágenes fallidas, ficha y contacto con D1 local. El recorrido confirma POST `201`, clave `Idempotency-Key` estable en reintento, consulta recibida y datos preservados ante error.
- Viewport 320 px: `document.documentElement.scrollWidth <= 320`; también se ejercita 390 px y captura desktop a 1440 px. La primera iteración reveló desborde de 451 px por una regla desktop que anulaba la grilla mobile del buscador; se corrigió y la regresión pasa.
- Teclado/foco y contraste: se verifican skip-link/foco visible, contraste de elementos de tarjeta y contraste/orden/contención de etiquetas del formulario de consulta en 390 y 320 px.
- Playwright emula `prefers-reduced-motion: reduce` y confirma transición inmediata de las tarjetas; el incremento no añade animación a los recorridos públicos.
- Precios verifican moneda explícita + monto sin duplicar símbolo local: `ARS 45.000`, `USD 580`; periodicidad y campos incompletos conservan los valores del API.
- `npm run typecheck`, `npm run build`, `npm run build:preview`: **PASS**. La compilación no desplegó ni modificó Preview.
- Matriz Worker del workflow `Quick checks`: **PASS**, typecheck y grupos `test:catalog` 7, `test:media` 16, `test:owner` 6, `test:owner-auth` 5, `test:admin` 12, `test:preview-auth` 6, `test:contact-workflow` 6 y `test:management` 13 (**71 tests**). Python consistency unit tests: **25/25 PASS**.
- `python3 scripts/check_orchestration_state.py --base origin/main`: **PASS**; `git diff --check`: **PASS**.

## Bloque rojo investigado

La imagen roja de la captura de P1 era el fixture sintético OWNER `owner-approved-photo`, servido desde el seed D1_BLOB de QA. Contenía un PNG rojo sólido de 48×48 en posición cero junto a un SVG de prueba en la misma posición; al ordenar por posición e ID el BLOB de QA aparecía primero. No era el fallback CSS ni una falla de Workers Static Assets. El recorrido público usa `seed-catalog.sql` y dos WebP sintéticos separados bajo `apps/web/public/media/catalog/`; Playwright confirma que la imagen principal decodifica. No se cambió el seed OWNER, el API ni el catálogo de datos de producto.

## Estado de revisiones

Este archivo registra evidencia local. Checks GitHub, revisión automática, Controller read-only sobre SHA exacto, Pre-Critic y merge protegido quedan pendientes hasta que exista el candidato publicado. No representa aprobación de esas etapas.
