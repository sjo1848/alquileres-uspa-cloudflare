# D3.1 — refinamiento de identidad y recorridos

D3 sigue siendo la única base arquitectónica. Esta entrega afina su identidad de Uspallata y las interacciones que la evaluación visual pidió hacer verificables.

- [Prototipo navegable D3.1](d3.1-refinamiento.html)
- [Paquete offline con imágenes sintéticas](prototipo-d3.1-refinamiento.zip)
- [Comparación antes/después](D3.1-COMPARACION.md)
- [QA Playwright y límites de la evidencia](D3.1-QA.md)

Incluye únicamente las vistas necesarias: catálogo, editor OWNER e imágenes, moderación ADMIN y gestión asistida. Los controles son simulaciones visuales; no llaman a Vue/Worker, no escriben D1, no alteran permisos ni registran auditoría. Personas, alojamientos y fotografías son sintéticos. La nueva fotografía local se generó específicamente para este prototipo.

La barra inferior mobile permanece fija en todas las capturas. El selector superior pertenece al prototipo y se oculta durante la captura para no ocupar espacio de producto.

**HUMAN_GATE abierto.** No se implementó el diseño en la aplicación ni se abrió PR.
