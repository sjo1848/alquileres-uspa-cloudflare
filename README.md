# Alquileres Uspallata — Cloudflare Lab

Laboratorio de migración y validación de `sjo1848/alquileres-uspa` con objetivo final de ejecutar **toda la plataforma en Cloudflare**. El plan Paid de Cloudflare puede ser necesario; se evaluará costo, seguridad y operación antes de contratar.

## Propósito

Este repositorio es un laboratorio separado. El repositorio fuente `sjo1848/alquileres-uspa` permanece como referencia de producto y comportamiento; no se modifica desde este laboratorio.

El laboratorio persigue dos objetivos simultáneos:

1. Validar una arquitectura Cloudflare viable para el producto con paridad funcional, bajo costo y operación simple.
2. Producir evidencia reusable sobre migración, costo, límites, método multiagente y portabilidad para comparar posteriormente con HMS Cloudflare.

## Hipótesis inicial de arquitectura

- Frontend: Vue 3 + Vite servido como Static Assets en Cloudflare Workers.
- API: Cloudflare Workers + Hono + TypeScript.
- Datos relacionales: Cloudflare D1, migrando desde PostgreSQL/Prisma con enfoque parity-first.
- Imágenes: Cloudflare R2.
- Auth: conservar inicialmente la semántica de autenticación/autorización de la aplicación; cualquier sustitución material requiere evidencia y decisión explícita.
- Despliegue: sin producción, datos reales ni servicios pagos durante el laboratorio salvo Human Gate explícito.

La arquitectura es una hipótesis verificable, no una conclusión anticipada.

## Restricción económica

**La plataforma final no tiene un requisito estricto de USD 0.** Workers Paid + D1 + R2 es la topología candidata, sujeta a verificación. Los experimentos autorizados son **locales y con datos sintéticos**, sin cargos ni recursos remotos. Cualquier suscripción, gasto, consumo excedente o despliegue requiere un Human Gate explícito. Dominio, correo y otros servicios no se consideran gratuitos por defecto.

## Método

La ejecución usa el Project Method:

`contrato → implementación → tests → QA adversarial → REWORK → integración → Pre-Critic → Artifact A → Boundary B → Independent Critic`

GitHub es el source of truth técnico. Google Drive conserva el archivo de investigación, hipótesis, resultados y conclusiones legibles.

## Investigación

Cada experimento debe registrar:

`hipótesis → criterio de falsación → setup → ejecución → evidencia → resultado → conclusión → aprendizaje transferible`

No se declarará una tesis general hasta acumular evidencia suficiente de este laboratorio y HMS Cloudflare.

## Estado

CF-AU-I00 y CF-AU-I01-P0P1 están cerrados con PASS acotado de investigación. **CF-AU-I01-P2** está autorizado para la primera funcionalidad ejecutable local de OWNER, D1 y R2; contrato en `.orchestration/contracts/CF-AU-I01-P2.md`.

Ver `.orchestration/STATE.md` y `.orchestration/STATUS.json` para el estado canónico.

## Delegated local Controller

Codex custom reviewer: `.codex/agents/project-controller.toml`, GPT-6 Luna / High, read-only. For local technical milestones the Human requested its use instead of routine ChatGPT External Critic handoffs. See `.orchestration/decisions/DELEGATED-CONTROLLER-GPT6-LUNA-HIGH.md`; this is not authorization to auto-merge main, pay, deploy or handle real data.
