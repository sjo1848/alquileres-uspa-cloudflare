# Controller REWORK — exact candidate a5e2257

> Parent operational record: separate `codex exec` invoked with `--model gpt-6-luna`, `-c model_reasoning_effort="high"`, `--sandbox read-only`, `--json`; exit 0, captured thread `01a1636f-136f-7920-abfa-6fa06dd7ab4b`. Provider/backend identity is UNVERIFIED. Localhost MCP transport warnings occurred but exact-repository inspection completed. Delegated local review, not external authenticated authority.

> Parent classifies the P2 below as REWORK and repaired it under Issue #32. The final candidate still requires a fresh exact-SHA review.

## Reviewer report (verbatim)

## Dictamen: **REWORK**

Revisé el candidato ejecutable exacto `a5e2257809b5abf2cf75b6869a59de99abed3fdb`, árbol `b3e69ce0eb0bda00aa2bd253ccc43331e084f1d1`, sobre `main@48e4f5c4251fe939cb779698e4e51b16614be178`. La base es ancestro del candidato. El HEAD posterior `afe614316cc76934b1c584ed1819ab3f6f68ea94` solo agrega o cambia estado y evidencia; no cambia el código revisado.

**P0:** ninguno. **P1:** ninguno.

**P2 — REWORK:** si falla con 503 el GET de imágenes de una publicación, `choose()` deja `images` vacío; `loadImages()` muestra el error y luego pone `imagesLoading=false`, pero no marca la colección como desconocida. Con estrategia `D1_BLOB`, el selector aparece y la UI trata la lista vacía como ausencia de Static Assets. La carga debe seguir bloqueada hasta que un GET exitoso confirme esa ausencia. El Worker rechaza el POST con 409 si hay un Static Asset, así que no encontré una vía de escritura ni pérdida de datos: el defecto es ofrecer una acción incompatible que luego falla. Referencias: [OwnerView.vue:114](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:114), [OwnerView.vue:117](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:117), [OwnerView.vue:371](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:371), [index.ts:575](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/src/index.ts:575). El E2E cubre Static Assets con GET exitoso y reintento de `/auth/config`, pero no el fallo del GET de imágenes seguido de la aparición del selector: [owner-journey.spec.ts:119](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:119).

Los demás puntos pedidos están cubiertos en el código y la evidencia:

- Cambio de alojamiento y actualización usan diálogos modales con foco inicial seguro, ciclo de Tab, Escape y restauración al trigger. La navegación voluntaria conserva la protección de cambios; la sesión expirada la omite cuando ya es anónima. [OwnerView.vue:49](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:49), [OwnerView.vue:253](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:253), [owner-journey.spec.ts:221](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:221)
- Tras error de `/auth/config`, el E2E reintenta y completa una carga D1 BLOB en la misma página; la restricción para Static Assets está explicada. [owner-journey.spec.ts:119](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:119)
- El 401 al guardar lleva a login sin diálogo cancelable ni datos OWNER privados visibles. [session.ts:93](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/session.ts:93), [owner-journey.spec.ts:407](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:407)
- Tras reordenar, la UI vuelve a leer la galería OWNER combinada; el E2E verifica que siguen presentes las tres imágenes. [OwnerView.vue:236](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:236), [owner-journey.spec.ts:161](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:161)
- El desempate usa un esperado fijo independiente del comparator. [owner-d1-blob-media.test.ts:151](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/tests/owner-d1-blob-media.test.ts:151)

**P3 previas:** cerradas. La brecha anterior de “retry → carga completada” ahora tiene una carga real comprobada en el mismo contexto de Playwright: [owner-journey.spec.ts:133](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/e2e/owner-journey.spec.ts:133). QA.md registra esas verificaciones, pero no las reproduje. [QA.md:20](/home/sjo1848/dev/alquileres-uspa-cloudflare/output/playwright/i06.5/QA.md:20)

No corrí tests/build ni usé red/GitHub, no escribí archivos y no cambié refs. El proceso delegado solicitó `gpt-6-luna/high`; la identidad efectiva del modelo y del backend queda **UNVERIFIED**.
