# Alquileres Uspallata — Cloudflare Lab

Laboratorio de migración y validación de `sjo1848/alquileres-uspa` sobre infraestructura Cloudflare con objetivo de costo operativo cercano a USD 0 dentro de los límites gratuitos aplicables.

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

Objetivo: `USD 0` de costo operativo del laboratorio dentro de los free tiers de Cloudflare. El laboratorio debe medir uso y registrar cualquier condición que obligue a pasar a pago. Dominio, correo, servicios externos u otros costos no se consideran gratuitos por defecto.

## Método

La ejecución usa el Project Method:

`contrato → implementación → tests → QA adversarial → REWORK → integración → Pre-Critic → Artifact A → Boundary B → Independent Critic`

GitHub es el source of truth técnico. Google Drive conserva el archivo de investigación, hipótesis, resultados y conclusiones legibles.

## Investigación

Cada experimento debe registrar:

`hipótesis → criterio de falsación → setup → ejecución → evidencia → resultado → conclusión → aprendizaje transferible`

No se declarará una tesis general hasta acumular evidencia suficiente de este laboratorio y HMS Cloudflare.

## Estado

Inicio del laboratorio: `CF-AU-I00 — Baseline, feasibility and cost-zero validation`.

Ver `.orchestration/STATE.md` y `.orchestration/STATUS.json` para el estado canónico.
