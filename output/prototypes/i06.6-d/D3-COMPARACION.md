# I06.D — D3 unificada: decisión visual para evaluar

## Síntesis

D3 une la dirección visual pública/OWNER de **D1 Atlas de Altura** con la arquitectura de cola de **D2 Altitude OS** para ADMIN. La aplicación conserva **un solo sistema visual claro**: papel mineral, tinta grafito, cobalto y acento arcilla reservado para advertencia; sans local para interfaz, números tabulares y metadatos breves; fotografías sintéticas con marcos de proporción controlada. La diferencia ADMIN es densidad/composición, no otra identidad ni un tema dark.

## Comparación específica

| | D1 sola | D2 sola | D3 unificada |
|---|---|---|---|
| Catálogo / ficha | Papel claro, fotografía y cards de lectura | Hero oscuro + cards horizontales compactas | Composición clara/fotográfica D1; búsqueda y datos solo de los filtros/campos vigentes |
| OWNER | Dashboard editorial claro | Workspace oscuro y compacto | Dashboard claro compacto; publicaciones, disponibilidad y contactos con estados actuales |
| ADMIN | Cola/contexto/decisión en tres paneles | Tabla densa + detalle contextual, tema oscuro | Tabla + contexto D2 sobre superficies claras, con tokens/controles idénticos a público/OWNER |
| Riesgo dominante | Ajuste mobile de tres paneles | Calidez y contraste sobre dark | Más filas visibles en tabla mobile requiere lista responsive y lectura min. 11–12 px |
| Posicionamiento | Identidad de destino | Consola de operaciones | Plataforma de alojamientos con operación integrada |

**Propuesta a aprobar:** D3 conserva la jerarquía y fotografía clara de D1 y resuelve ADMIN con el patrón de fila seleccionada + panel contextual de D2, sin incorporar la paleta dark, favoritos ni comportamientos adicionales. D1 y D2 se mantienen como historial y comparadores, no como sistema alternativo.

## Hallazgos de revisión y corrección D3

| Hallazgo del comentario #6367347620 | Corrección verificable en D3 |
|---|---|
| Favoritos sin API/contrato | Quitados corazones y guardar favoritos; el filtro de búsqueda tampoco muestra orden “relevancia”. |
| Contactos confundían `READ/UNREAD` con respuesta | OWNER muestra “Nueva consulta / Leída”, “Sin leer / Leída”, acciones de lectura y link `mailto`. Nunca afirma “respondida/sin responder”. |
| Aprobar / publicar / rechazar aparecían juntos | Caso `SUBMITTED`: solo Aprobar revisión o Rechazar con motivo (mín. 3 caracteres). Caso `APPROVED + UNPUBLISHED`: solo Publicar en catálogo. La fila no representa publicación ya publicada. |
| Amenities, casa entera, tipo, orden o motivo global no respaldados | Eliminados. Se muestran exclusivamente título, descripción, ubicación, moneda, precio, periodicidad WEEK/MONTH, duración, ocupación, fotos, estado de disponibilidad y confirmación. En asistencia no se exige motivo general; el campo de rechazo se limita a rechazo editorial. |
| Residuo inglés y tipografía pequeña | Microcopy operativo traducido; datos/labels son ≥11–12 px salvo identificador decorativo del wordmark. Se inspecciona render 320/390 y overflow. |
| Disponibilidad, precio/frescura, seguridad y privacidad | Mantiene moneda y periodicidad visibles; última confirmación y estado “consultar/sin confirmar”; consulta no es reserva; datos sintéticos; ningún rol/capacidad de backend simulado como sesión real. |
| Dependencia de fotografía | Fotos WebP locales sintéticas 1280×853; recomendación documentada de assets autorizados, dimensiones/ratio, `srcset`, compresión local y lazy-load. Sin URL externa ni costo. |

## Campos/estados representados

- **Catálogo y ficha:** búsqueda por ubicación, moneda, rango de precio, periodicidad, duración, máximo de personas y “último registro disponible”, que corresponden a filtros/campos API; hay estado visual de carga/vacío/error. Se muestra precio con moneda y periodicidad, capacidad informada si existe, estado de disponibilidad y frescura. No hay noches, booking, pago, ranking, reseñas, favoritos o amenidades.
- **OWNER:** estados de publicación actuales y acciones de disponibilidad; contactos solo leídos/no leídos. “Responder por correo” abre un canal externo del usuario vía `mailto`; la plataforma no registra una respuesta.
- **ADMIN revisión:** la cola muestra dos casos sintéticos de ejemplo: `SUBMITTED` y `APPROVED/UNPUBLISHED`. Aprobar y publicar son transiciones distintas. Rechazar exige razón, y el prototipo bloquea un motivo inferior a tres caracteres como valida la API.
- **ADMIN asistido:** campos de publicación y edición reflejan el esquema vigente; disponibilidad, reconfirmación, envío y borrado aparecen para un borrador. Borrar abre una confirmación con foco en opción segura, cancelación/Escape y sin ejecución persistente. No se agregan imágenes ni razones obligatorias al formulario asistido.

## Especificación del sistema visual

- **Superficies y marca:** `canvas #f5f4ef`, `paper #ffffff`, `ink #191e28`, muted `#515b69`, cobalto `#3f58c8`, arcilla `#a94f3b` para corrección/advertencia. El mismo conjunto opera Catálogo, OWNER y ADMIN.
- **Tipografía:** sans del sistema para lectura, títulos de peso semibold y tracking compacto, monospace únicamente en eyebrow/identificadores. Texto de campos y metadata operativa desde 11–12 px; montos con cifras legibles. Sin fuentes remotas.
- **Composición:** catálogo de tres cards desktop, cards horizontales mobile; ficha con galería y CTA de consulta que cae debajo en mobile; OWNER con barra lateral que pasa a navegación horizontal, resumen compacto y cola de acciones; ADMIN con lista/tabular y detalle contextual fijo en desktop, selección y detalle apilado en mobile.
- **Componentes/estados:** botones primarios/segundarios/advertencia, chips de estado con texto+color, anillos `:focus-visible`, status regions, error de validación inline, confirmación destructiva semántica, `prefers-reduced-motion`.
- **Fotografía:** art direction de montaña con luz natural; archivos de muestra locales WebP 1280×853, tamaños reservados, recorte sin deformación. La galería futura debe preservar carga/fallback y controles de lectura/autorización del media actual.

## Resultado de inspección visual

La comparación de capturas D3 contra la evidencia archivada C confirma tres cambios materiales: (1) título y búsqueda compactados para exponer resultados pronto; (2) escala sans contemporánea y separación más marcada entre label, contenido y metadata; (3) operación ADMIN usa el espacio como lista legible + foto/datos/CTA contextual sin abandonar fondo, colores, radio o botones del resto del producto. En mobile la selección de caso queda visible como item tipo lista; el detalle mantiene una única columna y el encabezado de tabla se transforma para evitar desplazamiento horizontal de página.

## Límites

No son capturas frescas de app Vue/Worker; el runtime de producto no estaba activo. Las capturas “antes” son los archivos guardados y citados en el comentario anterior; las “después” son renders Playwright de esta maqueta D3. La maqueta no valida interacción API, ACL, auditoría real, estado real de negocio, ni Product Acceptance. HUMAN_GATE permanece abierto.
