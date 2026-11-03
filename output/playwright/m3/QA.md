# M3 — Mi selección: evidencia visual local

Base: `main@a7a98664b2bbc5f8ad81a790b77fbdc0f09f31f0`. Solo alojamientos sintéticos en D1 local.

- [Desktop, 1440 px](selection-desktop-1440.png): cuatro alquileres mensuales, condiciones actuales de la API, datos faltantes y un anuncio declarado no disponible.
- [Mobile, 390 px](selection-mobile-390.png): comparación mediante tarjetas apiladas, no tabla comprimida.
- [Mobile, 320 px](selection-mobile-320.png): tarjetas legibles; Playwright verifica `scrollWidth <= 320`.

Resultados locales finales:
- Unitarias de persistencia/normalización/límite: **4/4 PASS**.
- Playwright Chromium M3: **3/3 PASS** — guardar/quitar en catálogo y ficha, orden/recarga, solo IDs en `localStorage`, rehidratación de datos API actuales, comparación de 4, condiciones conocidas y faltantes, estado no disponible, ID retirado/404, error/reintento, teclado/foco, ficha/contacto y 320/390/1440 px.
- Regresión pública Playwright: **6/6 PASS** (incluye catálogo, filtros MONTH/WEEK, ficha/contacto e idempotencia).
- Web typecheck, build y build:preview: **PASS**.

Nada de esto es QA remoto. No se modificaron Preview, Access, D1 remota, CD ni producción.
