# CF-AU-I06.6-P1 — Fundamentos visuales D3.1

- **Issue:** [#42](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/42)
- **Base canónica:** `main@b901b444b5819c1861cdfdf164d33e7ce92dff0e`
- **Dirección aprobada:** D3.1, Issue #41; prototipo inmutable en `77c99fa445171a58548e6e06497050bf2d923305`.
- **Estado:** PR #45 abierto; espera checks/revisión exact-head en `work/i06-d31-foundations`.

## Alcance

Implementar en la aplicación Vue los tokens (neutros fríos, tinta, cobalto, semántica, borde, sombra, espacio, tipo y radios), marca de cordillera/wordmark, shell compartido, navegación desktop/mobile y primitivos visuales compartidos para acciones, formularios, focos, estados y superficies. Preservar la navegación efectiva basada en sesión/rol y todos los guards existentes.

No rehacer ni reordenar los layouts de catálogo, ficha, OWNER o ADMIN; no modificar Worker/D1, contratos, permisos ni autenticación. Reconciliar la metadata stale de PR #40 dentro de este PR funcional.

## Criterios de aceptación

1. El shell y fundamentos visuales Vue corresponden a la dirección D3.1 aprobada; operaciones OWNER/ADMIN usan sans y el acento serif queda limitado al espacio editorial público.
2. Header/nav mantienen rutas y acciones exactas por sesión/rol; desktop/mobile funcionan a 1440×1000, 390×844 y 320×844, sin overflow horizontal.
3. Capturas producidas desde la app real local con Worker/Hono y D1 sintéticos; estados catalog/OWNER/ADMIN con cuentas sintéticas; revisión de foco/teclado, contraste, formularios y reduced motion.
4. Playwright público y OWNER existentes pasan, además de smoke de navegación por roles; Web typecheck/build y checks Worker/Web CI pasan.
5. `python3 scripts/check_orchestration_state.py` valida el estado canónico de esta rama; GitHub exact-head review y checks sin findings materiales no resueltos; Controller GPT-6 Luna High read-only sobre el SHA final; revisión de protección antes del merge.
6. No Preview, producción, costos, R2, datos reales, repo fuente ni refactor funcional de pantallas.

## Evidencia/stop

Guardar capturas e informe reproducible en `output/playwright/i06.6-p1/`. Cerrar Issue #42 y reconciliar Epic #25 únicamente después del merge protegido. Detenerse antes de #43/P2.
