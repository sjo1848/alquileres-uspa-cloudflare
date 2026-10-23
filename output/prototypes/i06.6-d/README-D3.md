# D3 — identidad y arquitectura unificadas

D3 toma la identidad clara, fotográfica y pública de D1 y la densidad de cola tabular con panel de contexto de D2 para ADMIN. Conserva una sola paleta, tipografía, jerarquía, superficies, botones y foco en todas las áreas; ADMIN es más denso pero no cambia de tema ni de marca.

- [Abrir el prototipo D3](d3-unificada.html)
- [Descargar el paquete offline D3](prototipo-d3-unificado.zip)
- [Comparación y trazabilidad de los hallazgos](D3-COMPARACION.md)
- [QA Playwright con resultado efectivo](D3-QA.md)

Incluye catálogo, ficha/contacto, panel OWNER, moderación y gestión asistida ADMIN. Todas las fotos y los registros son sintéticos. Filtros, envío, administración y botones de cuenta son interacciones de visualización: no hay API, persistencia, pagos, reserva, sesión ni mutación de datos.

El panel ADMIN reproduce la separación del contrato existente: `SUBMITTED` permite aprobar o rechazar con motivo; `APPROVED` + `UNPUBLISHED` permite publicar; una publicación existente no ofrece las acciones de la cola pendiente. El formulario asistido contiene los campos disponibles en el esquema actual y no agrega un campo obligatorio de motivo.

## Fotografía y rendimiento

La exploración usa dos fotos sintéticas WebP locales de 1280×853 px. La interfaz conserva relaciones de aspecto de galería y tarjeta, recorta con `object-fit: cover` sin estirar, y etiqueta claramente las fotos de muestra. Para una futura implementación, mantener assets locales con derechos claros, dimensiones y relación de aspecto declaradas, versiones responsivas/`srcset` según tamaño de tarjeta, compresión WebP/AVIF cuando la cadena actual lo soporte, `loading=lazy` en imágenes debajo del primer pliegue y prioridad solo para la imagen principal. No incorporar hosts remotos ni servicios pagos. Las imágenes y permisos existentes de Worker deben mantenerse sin cambios.

D3 no cierra el HUMAN_GATE ni autoriza refactor.
