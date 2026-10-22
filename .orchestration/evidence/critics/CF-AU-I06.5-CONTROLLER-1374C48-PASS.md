# Controller — PASS exact executable candidate 1374c48

> Operational provenance (parent): separate `codex exec` invoked using `--model gpt-6-luna`, `-c model_reasoning_effort="high"`, `--sandbox read-only`, `--json`; process exit 0, thread `01a16366-511e-7391-8262-fd1a718cdf5e`. No unsupported-model or sandbox error; repository trace was read-only. Backend provider identity remains UNVERIFIED. MCP localhost transport warnings occurred, but the exact-repository review completed. This is delegated local review, not an external authenticated reviewer.

> The reviewer reported a non-blocking P3: no integrated upload immediately after retry. That exact evidence gap was closed in the subsequent test-only change before the next candidate: the same Playwright page now completes a real local D1 BLOB upload after retry; new exact Controller review is still required for that final candidate.

## Reviewer report (verbatim)

## Resultado: PASS

**PASS técnico local para el candidato ejecutable exacto** `1374c48575296ba44431cc27c503007e3c14157e`, tree `ebf5f79415f276747db8e57ba264082f3be46e57`, sobre la base `main@48e4f5c4251fe939cb779698e4e51b16614be178`. Confirmé que la base es ancestro directo del candidato y que su padre es `224c2bb9939ef674f5c6ef4e6bea3cbf821aaf56`.

Revisé el contenido versionado de ese candidato, **no** el código del HEAD posterior `2bf85d2`. No corrí tests/build ni usé red/GitHub, y no escribí archivos ni cambié refs. Este es un veredicto nuevo sobre el candidato solicitado: **no hereda ningún PASS anterior**.

### Hallazgos por severidad

- **P0:** ninguno.
- **P1:** ninguno.
- **P2:** no encontré P2 abiertos en los cinco puntos pedidos.
- **P3 — brecha de evidencia:** la regresión de recuperación de `/auth/config` comprueba que el retry exitoso habilita el selector en un borrador D1 BLOB elegible y que lo mantiene oculto para Static Assets. No realiza una carga real en esa misma página después del retry. El flujo sí prueba uploads D1 BLOB por separado, y el Worker conserva su ruta de carga; queda faltando la aserción integrada específica “retry → carga completada”.

### Comprobaciones

- **Borrador con Static Asset:** en [OwnerView.vue](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:33) la carga requiere estrategia D1 BLOB y ausencia de imágenes Static Asset; la sección espera a que termine la carga de imágenes antes de mostrar el selector ([líneas 370–375](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:370)). El E2E usa un borrador sintético con Static Asset y verifica el mensaje y que no haya selector; también cubre una publicación mixta. El Worker rechaza mutaciones de imágenes bajo `STATIC_ASSETS` ([index.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/src/index.ts:114)).
- **401 con cambios pendientes:** el guard permite abandonar la vista cuando la sesión ya es anónima; si sigue autenticada, conserva el diálogo de cambios sin guardar ([OwnerView.vue](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:249)). El E2E confirma que navegar voluntariamente permite cancelar y mantener los cambios ([owner-journey.spec.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:216)), y fuerza un 401 para comprobar el redirect a login y que no quede visible el contenido OWNER privado ([líneas 383–393](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:383)).
- **Reordenamiento mixto:** el cliente vuelve a cargar la lista combinada tras el PATCH ([OwnerView.vue](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:232)); el E2E verifica que sigan las tres fotos después de mover una D1 BLOB ([owner-journey.spec.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:153)). El seed incluye dos BLOB y un Static Asset ([seed-owner-e2e.sql](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/tests/seed-owner-e2e.sql:26)).
- **Fallo transitorio de configuración:** `loadAuthStrategy` limpia la promesa pendiente aun ante fallo, permitiendo reintentar ([session.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/session.ts:49)); la vista muestra el error y el botón de reintento ([OwnerView.vue](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:85)). El E2E inyecta dos 503, reintenta, y verifica selector oculto para Static Assets y visible para D1 BLOB ([owner-journey.spec.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:119)).
- **Desempate de orden:** la prueba define IDs sintéticos y un esperado explícito e independiente del comparator; también verifica la vista pública ([owner-d1-blob-media.test.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/tests/owner-d1-blob-media.test.ts:141)).

La matriz de QA del candidato registra las regresiones y sus resultados históricos, incluida la revisión Worker 13/13 y la ejecución Playwright focalizada ([QA.md](/home/sjo1848/dev/alquileres-uspa-cloudflare/output/playwright/i06.5/QA.md:16)). No los reejecuté en esta revisión. La identidad backend del proceso/modelo **UNVERIFIED** porque no está expuesta aquí; no afirmo atestación del modelo.
