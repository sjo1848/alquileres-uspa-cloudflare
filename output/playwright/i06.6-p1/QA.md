# I06.6-P1 D3.1 — QA local del sistema visual

- Issue: [#42](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/42)
- Base canónica: `main@b901b444b5819c1861cdfdf164d33e7ce92dff0e`.
- Referencia aprobada: D3.1 del Issue #41, commit `77c99fa445171a58548e6e06497050bf2d923305`.
- Entorno: aplicación Vue/Vite integrada con Worker/Hono y D1 local Workerd, exclusivamente datos/usuarios sintéticos; nada desplegado.
- Chromium: canal Chrome del runner Playwright del workspace.

## Capturas reales

Las imágenes son salida directa del navegador sobre la aplicación local y muestran el shell/catálogo y rutas autenticadas con D1 sintética.

| Rol/ruta | Desktop 1440×1000 | Mobile 390×844 | Mobile 320×844 |
|---|---|---|---|
| Visitante / catálogo | [captura](catalog-desktop.png) | [captura](catalog-mobile-390.png) | [captura](catalog-mobile-320.png) |
| OWNER | [captura](owner-desktop.png) | [captura](owner-mobile-390.png) | [captura](owner-mobile-320.png) |
| ADMIN / revisión | [captura](admin-desktop.png) | [captura](admin-mobile-390.png) | [captura](admin-mobile-320.png) |

## Validaciones

- `npm run typecheck` (apps/web): PASS.
- `npm run build` y `npm run build:preview` (apps/web, compilación Worker+Static Assets y cliente SPA; sin despliegue): PASS.
- `npm run test:e2e:foundations`: PASS, una prueba integrada. Visitante/OWNER/ADMIN en 1440, 390 y 320; navegación permitida por rol; ausencia de enlaces de otros roles; sin desbordamiento horizontal; menú mobile, teclado Enter/Escape y restauración de foco. Comprueba ratios WCAG AA de ink/muted sobre canvas, blanco sobre cobalto, los cuatro chips OWNER (borrador, enviada, rechazada y aprobada), la nota de ubicación del hero público (texto `#f0eee5` sobre `#273584`, 9.37:1), el placeholder de ubicación (5.10:1 sobre blanco) y el borde del control (3.70:1 sobre blanco). En OWNER comprueba el indicador de foco blanco sobre el hero (3.92:1 frente al extremo más claro, supera 3:1 para indicador no textual), además de `prefers-reduced-motion`. Las capturas mobile de OWNER/ADMIN se toman con el menú cerrado; los mismos flujos abren el menú para verificar links por rol. Capturas generadas en el mismo recorrido.
- `npm run test:e2e:public`: PASS, 4/4; búsqueda/paginación, errores/reintento, ficha, consulta idempotente y regresión mobile #35.
- `npm run test:e2e:owner`: PASS, 3/3; auth sintética MOCK, reintentos, OWNER, D1 BLOB, disponibilidad y consultas.
- CI Worker/Web, GitHub review y Controller de SHA final: pendientes de PR; no se presentan como aprobados en esta evidencia.
- `python3 scripts/check_orchestration_state.py --base origin/main`: PASS después de reconciliar `STATE.md` y `STATUS.json` a Issue #42.
- `git diff --check`: PASS.

## Revisión visual y límites

Se inspeccionaron capturas desktop y mobile; los roles OWNER y ADMIN muestran el contenido de pantalla completo con navegación cerrada. La cabecera usa el símbolo cordillerano D3.1, wordmark y sans; el público conserva el acento serif localizado en el hero editorial. OWNER/ADMIN usan jerarquía sans, superficies claras, acento cobalto y estados semánticos. Se conserva el layout existente de cada vista. Reduced motion sigue respetado por la regla existente y los focos usan outline de 3 px. Contraste calculado y comprobado en navegador: ink/canvas 14.88:1, muted/canvas 5.46:1, blanco/cobalto 5.71:1, ink/superficie 16.1:1; todos por encima del umbral 4.5:1. La nota de ubicación usa una superficie sólida propia y da 9.37:1; placeholder y límite del campo cumplen 5.10:1/3.70:1; el indicador de foco de la acción OWNER es blanco, con contraste 3.92:1 en el extremo claro del hero. `prefers-reduced-motion: reduce` fuerza scroll `auto` y transiciones de 0.01 ms.

No se tocaron Worker/D1, auth, reglas de acceso, Preview, producción, R2 ni el repositorio fuente.
