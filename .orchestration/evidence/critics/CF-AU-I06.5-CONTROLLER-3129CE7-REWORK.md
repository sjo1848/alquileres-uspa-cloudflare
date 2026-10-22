# Controller rework — exact candidate 3129ce7

> Parent operational record: separate `codex exec` process invoked with `--model gpt-6-luna`, `-c model_reasoning_effort="high"`, `--sandbox read-only`, `--json`, and `-C` repository. Process exited 0; captured thread/session `01a1634e-0466-7272-a83c-2a12ba78a628`. Backend provider identity remains UNVERIFIED. The report below claims the reviewer could not see effective runtime configuration; exact parent CLI invocation, transcript and exit status are independently recorded in the companion metadata. This is a bounded delegated local review, not an external authority.

> Parent classifies the Controller’s actionable P2 as REWORK (rather than carrying forward its “PASS with follow-up” wording): the upload action visibly failed with 409 for a mixed Static Asset draft and needs correction before I06.5 can close. The suggested independent expected ordering assertion was also strengthened.

## Reviewer report (verbatim)

## 1. SHA/tree confirmados

Candidato revisado: `3129ce7034a6102e1a6eeb2992b456775fab9b76`, árbol `c739a8bd629fd41cd15fb6ee76a66c2d093326f8`. La base `48e4f5c4251fe939cb779698e4e51b16614be178` es ancestro. El checkout estaba en otro HEAD; inspeccioné los archivos directamente desde el objeto del candidato, sin cambiar refs.

## 2. Modelo, esfuerzo y sandbox

La revisión fue asignada al rol delegado `project_controller`, configurado para GPT-6 Luna / High / read-only. El entorno informó acceso de solo lectura y no hice escrituras. El runtime no expuso parámetros efectivos ni una sesión CLI verificable; **backend identity: UNVERIFIED**.

## 3. Superficies inspeccionadas

Contrato e invariantes; delta desde `c848d84`; API Worker de imágenes OWNER y `/auth/config`; `OwnerView.vue`, `session.ts`; regresiones Worker y Playwright; y [QA.md](/home/sjo1848/dev/alquileres-uspa-cloudflare/output/playwright/i06.5/QA.md). Inspeccioné la evidencia existente, sin ejecutar pruebas ni builds.

El PASS previo de `c848d84` sigue siendo histórico para ese SHA; no lo tomé como veredicto sobre este delta.

## 4. Hallazgos

- **P0:** ninguno.
- **P1:** ninguno. El supuesto caso de un único BLOB en posición 1 no es alcanzable con las escrituras actuales: el Worker mantiene posiciones D1 densas desde cero y rechaza cargas cuando ya hay filas Static Assets.
- **P2:** en un borrador con fotos Static Assets y estrategia D1 BLOB, la UI puede mostrar el control para subir, pero el Worker rechaza la solicitud con 409 porque detecta una fila estática. La condición de UI está en [OwnerView.vue](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/web/src/views/OwnerView.vue:371); el rechazo, en [index.ts](/home/sjo1848/dev/alquileres-uspa-cloudflare/apps/worker/src/index.ts:575). La UI debería ocultar/deshabilitar ese control o admitir explícitamente esa mezcla.
- **P3:** ninguno adicional.

## 5. Brechas de evidencia

El E2E documenta dos 503 de configuración y recuperación al tercer intento. En el código, la promesa compartida se limpia incluso ante rechazo; mientras la estrategia siga `UNKNOWN`, las acciones de carga permanecen ocultas y se ofrece reintento explícito. La lectura aprobada y el aislamiento OWNER están cubiertos en código y regresiones, pero no reejecuté la suite.

La prueba de desempate por ID calcula su esperado con el mismo comparador que producción y usa IDs que dejan Static Assets primero incluso en el orden inicial; así, podría pasar aunque se quitara el desempate. Además, el `STATE.md`/`STATUS.json` del candidato todavía no lo identifican como SHA vigente: QA registra que esa reconciliación quedaba para un checkpoint posterior.

## 6. Veredicto

**PASS con seguimiento P2** para el delta técnico inspeccionado. El P2 no demuestra mutación insegura ni pérdida de datos, pero deja una acción visible que falla en borradores mixtos; conviene corregirla y fortalecer la regresión del desempate antes de cerrar el Issue.
