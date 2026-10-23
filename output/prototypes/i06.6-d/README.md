# I06.D — Modern Marketplace / Premium SaaS

Exploración visual local del Issue #41. No modifica Vue, Worker, API ni datos; no es una aplicación desplegada ni una especificación aprobada. Todo estado operativo, publicación, consulta, acción de moderación y número mostrado aquí es **sintético e ilustrativo**. Las acciones muestran feedback de demostración y no llaman al backend.

## Abrir y navegar

- [D1 — Atlas de Altura](atlas.html): marketplace editorial con interfaz clara, cromática mineral y moderación de caso en tres paneles.
- [D2 — Altitude OS](altitude.html): marketplace-producto oscuro y denso, con bandeja tabular y panel contextual.
- [Descargar paquete offline](prototipos-d.zip): abrir `atlas.html` o `altitude.html` con un navegador; las fotografías sintéticas se incluyen en `assets/`.

En cada prototipo, la barra superior cambia entre Catálogo, Ficha, OWNER, ADMIN y Asistencia. En Catálogo se pueden alternar estados de resultados, carga, vacío y error. En Ficha el envío solo muestra feedback simulado. Las decisiones ADMIN también son simuladas y no guardan cambios.

## Capturas

Las imágenes están en [`output/playwright/i06.6-d/`](../../playwright/i06.6-d/). Cada dirección incluye catálogo, ficha/contacto, OWNER, ADMIN y gestión asistida, en desktop 1440×1000 y mobile 390×844. También se verificó 320×844.

## Base visual actual usada para comparar

El runtime local no estaba levantado al empezar esta exploración. Estas capturas existentes proceden de las ejecuciones Playwright archivadas de I06.1, I06.4 e I06.5; no se presentan como una nueva recaptura del runtime de hoy. Las fotos de catálogo y OWNER usan fixtures sintéticos de esas pruebas.

- Catálogo C: [`before-catalog-desktop-1440.png`](../../playwright/i06.6-d/before-catalog-desktop-1440.png), [`before-catalog-mobile-390.png`](../../playwright/i06.6-d/before-catalog-mobile-390.png)
- OWNER C: [`before-owner-desktop-1440.png`](../../playwright/i06.6-d/before-owner-desktop-1440.png), [`before-owner-mobile-390.png`](../../playwright/i06.6-d/before-owner-mobile-390.png)
- ADMIN revisión archivada: [`before-admin-review-desktop.png`](../../playwright/i06.6-d/before-admin-review-desktop.png), [`before-admin-review-mobile.png`](../../playwright/i06.6-d/before-admin-review-mobile.png)
- ADMIN asistencia archivada: [`before-admin-assisted-desktop.png`](../../playwright/i06.6-d/before-admin-assisted-desktop.png), [`before-admin-assisted-mobile.png`](../../playwright/i06.6-d/before-admin-assisted-mobile.png)

La revisión ADMIN conservó capturas anteriores disponibles de I06.1; debe compararse como evidencia histórica del sistema, no como afirmación de que el servidor fue recapturado ahora.

## Archivos

- `COMPARACION.md`: auditoría, diferencias, propuesta de sistema visual y recomendación de decisión.
- `atlas.html`, `altitude.html`: prototipos interactivos con HTML/CSS/JS estático.
- `assets/`: imágenes de muestra locales sintéticas, reutilizadas desde artefactos del laboratorio.
- `prototipos-d.zip`: paquete navegable para revisar fuera del repositorio.

## QA del prototipo

Playwright/Chromium local: las cinco vistas de cada propuesta se abrieron en 1440×1000, 390×844 y 320×844. En 320 px `scrollWidth == viewport width` en las diez vistas. Se comprobó navegación entre pantallas, control de estado vacío y feedback del formulario de consulta. No es QA de aplicación ni de API. Se usan fuentes de sistema (sin red), `:focus-visible`, controles semánticos y `prefers-reduced-motion`.
