# D3 — verificación efectiva de Playwright

- **Fecha:** 2026-10-23 (UTC del entorno)
- **Base de referencia del producto:** `main@b901b444b5819c1861cdfdf164d33e7ce92dff0e`
- **Prototipo/evidencia:** rama `evidence/i06.6-design-options`, commit de evidencia a publicar junto con este archivo.
- **Alcance:** HTML interactivo D3 y assets fotográficos sintéticos locales. No se inició el Worker, D1 ni la aplicación Vue; por ello no es una prueba de API, permisos, persistencia ni datos de producto.
- **Navegador:** Chromium ejecutable `/usr/bin/google-chrome`, controlado con Playwright del workspace.
- **Servidor:** `python3 -m http.server` en `127.0.0.1:4173`.
- **Comando:** `node output/prototypes/i06.6-d/verify-d3.mjs`.
- **Resultado final efectivo:** **PASS — exit code 0** (corrida completa del 2026-10-23).

## Comprobaciones de esta corrida

- Capturas generadas para Catálogo, Ficha, OWNER, Moderación ADMIN y Gestión asistida ADMIN a `1440×1000` y `390×844`.
- Las cinco vistas verificadas a `320 px`: sin desbordamiento horizontal (`320/320 px`).
- Todas las imágenes locales cargaron; el navegador no realizó solicitudes a hosts externos.
- Se ejercitaron estados visuales de catálogo, formulario de consulta sin envío real, etiquetas OWNER `LEÍDA/SIN LEER`, motivo corto de rechazo bloqueado, acciones ADMIN distintas por estado (`SUBMITTED` frente a `APPROVED/UNPUBLISHED`), y diálogo de borrado con Escape y restauración de foco.
- Se verificaron etiquetas accesibles de controles y ausencia de conceptos fuera del contrato (favoritos, comodidades, relevancia, estado de respuesta OWNER, entre otros).
- Contraste calculado (WCAG relativo): tinta/canvas `15.16:1`, texto secundario/canvas `6.25:1`, blanco/botón azul `6.10:1`, texto de error/fondo `6.60:1`, texto disponible/fondo `6.18:1`, texto de advertencia/fondo `6.10:1`.

Salida resumida capturada:

```text
320px catalog: PASS (320/320px)
320px detail: PASS (320/320px)
320px owner: PASS (320/320px)
320px admin: PASS (320/320px)
320px assist: PASS (320/320px)
Desktop/mobile captures, synthetic-only network, states, forms, admin transitions, deletion dialog, labels, and product semantics: PASS
PLAYWRIGHT_EXIT_CODE=0
```

## Sobre `exit -1` y el intento anterior

El reporte previo referido en la revisión contiene una ejecución con `exit -1`; ese resultado **no se interpreta como PASS** y esta evidencia no lo reemplaza retroactivamente. Se lanzó una corrida final nueva sobre D3 y su proceso terminó normalmente con `exit code 0`. Durante el QA iterativo de esta versión hubo también un primer intento con exit `1` por una aserción de texto sensible a mayúsculas; la aserción se hizo case-insensitive y la corrida completa final terminó en `0`. No hubo error de Playwright en la corrida final.

## Artefactos

- PNG: `output/playwright/i06.6-d/d3/`
- Verificador reproducible: `output/prototypes/i06.6-d/verify-d3.mjs`
- La maqueta simula visualmente acciones; no muta ni persiste información.
