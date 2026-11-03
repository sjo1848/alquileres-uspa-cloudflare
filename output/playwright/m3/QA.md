# M3 — Mi selección: evidencia visual local

Base: `main@a7a98664b2bbc5f8ad81a790b77fbdc0f09f31f0`. Solo alojamientos sintéticos en D1 local.

- [Desktop, 1440 px](selection-desktop-1440.png): cuatro alquileres mensuales, condiciones actuales de la API, datos faltantes y un anuncio declarado no disponible.
- [Mobile, 390 px](selection-mobile-390.png): comparación mediante tarjetas apiladas, no tabla comprimida.
- [Mobile, 320 px](selection-mobile-320.png): tarjetas legibles; Playwright verifica `scrollWidth <= 320`.

Resultados finales locales (candidato original más regresión por hallazgo de revisión):
- Unitarias de persistencia/normalización/límite: **4/4 PASS**.
- Playwright Chromium M3: **5/5 PASS** — guardar/quitar en catálogo y ficha, orden/recarga, solo IDs en `localStorage`, rehidratación de datos API actuales, comparación de 4, condiciones conocidas y faltantes, estado no disponible, ID retirado/404, error/reintento, teclado/foco, ficha/contacto y 320/390/1440 px; regresiones adicionales para almacenamiento bloqueado/cuota agotada que comprueban que guardar desde catálogo/ficha y quitar desde Mi selección no cambia la selección y anuncia el error de forma accesible.
- Regresión pública Playwright: **6/6 PASS** (incluye catálogo, filtros MONTH/WEEK, ficha/contacto e idempotencia).
- Web typecheck, build y build:preview: **PASS**.

Una primera ejecución completa encontró un timeout transitorio al consultar la API local; el caso pasó en aislamiento y la repetición completa finalizó 4/4 antes de agregar la regresión de quitar. Nada de esto es QA remoto. No se modificaron Preview, Access, D1 remota, CD ni producción.
