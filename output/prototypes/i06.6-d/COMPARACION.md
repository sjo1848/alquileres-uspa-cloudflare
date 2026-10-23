# Comparación crítica — D1 Atlas de Altura / D2 Altitude OS

## Diagnóstico del producto existente (dirección C)

**Identidad.** La paleta bosque/beige y la serif editorial comunican territorio y hospitalidad, y las fotografías sintéticas del catálogo son una base fuerte. El mismo recurso visual se repite en demasiados espacios; la marca no tiene todavía un gesto gráfico propio que conecte descubrimiento y operación. Georgia/serif general, tarjetas y campos tradicionales acercan algunas pantallas a un CRUD clásico.

**Catálogo.** La foto y la combinación precio-periodicidad-capacidad-estado ya aportan información útil. La portada alta y la separación vertical entre relato, buscador y resultados aplazan la comparación de alojamientos. En mobile, filtros y tarjetas exigen más scroll; fotografía repetida reduce la capacidad de reconocer cada lugar.

**Ficha y consulta.** La jerarquía de precio, periodicidad, ocupación, frescura y llamada a consultar es funcional. La experiencia puede ganar foco y orden alrededor de la galería y una consulta accesible; debe seguir distinguiendo “consultar” de reservar y la disponibilidad declarada de una garantía.

**OWNER.** Hay una base coherente de estados, inventario, fotos y consultas. El dashboard actual asigna demasiado espacio a un encabezado oscuro/hero y a paneles vacíos; la siguiente acción, el estado de cada alojamiento y su evidencia fotográfica podrían escanearse con menos desplazamiento. Las acciones destructivas, permisos y advertencias de cambios no guardados ya tienen comportamiento que debe conservarse.

**ADMIN.** La captura histórica de revisión tiene navegación, cola y detalle, pero escasa identidad de producto y jerarquía de revisión. La vista asistida archivada muestra controles y etiquetas apretados, con superposiciones visibles (hallazgo conocido #35). Revisión editorial, publicación y estado de disponibilidad deben continuar como acciones/estados distintos; todo acceso y edición permanece sujeto al rol ADMIN y a auditoría.

## Dirección D1 — Atlas de Altura

**Idea.** Un atlas contemporáneo de lugares: la fotografía abre el recorrido, y una interfaz clara de producto organiza la decisión. No usa estética de catálogo de Airbnb ni su reserva/valoraciones.

- **Tipo:** una sans de sistema, grande y compacta para títulos; números tabulares y mono solo para metadatos breves (ubicación, hora/fecha, códigos). Evita Georgia/serif como voz general.
- **Color y símbolo:** papel mineral casi blanco, tinta azul grafito y cobalto de navegación; lima como acento de estado/acción puntual. Contraste revisable en implementación; lima no debe llevar texto pequeño.
- **Composición:** titular corto y buscador de tres preguntas en una sola banda; cuadrícula de cards fotográficas comparables; ficha con galería ordenada y panel de consulta estable; dashboard OWNER en resumen, publicaciones y consultas.
- **ADMIN:** cola de decisión y detalle en tres superficies persistentes: lista, contexto/fotos y rail de decisión/auditoría. En mobile pasa a lista primero y a detalle en la siguiente pantalla/estado, con retorno claro a la selección.
- **Tono:** hospitalidad cuidada y localizada; microcopy en español, datos con fechas/horas explícitas, frescura sin afirmar disponibilidad garantizada.

**Fortaleza:** mejor balance entre identidad de destino, lectura fotográfica y consistencia con un marketplace moderno. **Riesgo:** el detalle ADMIN de tres columnas pierde espacio a 1440 y requiere una transición mobile bien resuelta; cards editoriales pueden crecer en altura.

## Dirección D2 — Altitude OS

**Idea.** Un producto de operación contemporáneo: la plataforma se siente como una consola ligera de hospitalidad, con la cordillera como señal visual. No es un dashboard de analytics genérico ni copia la identidad de un SaaS conocido.

- **Tipo:** sans de sistema con títulos compactos y labels mono para códigos/tiempos/estados; evitar inglés incidental en interfaz final (prototipo ya traduce los labels principales).
- **Color y símbolo:** azul noche mineral, superficies azul pizarra y cian/mint para foco/acción; coral solo para advertencias. La foto se presenta en marco luminoso y no como fondo de los datos.
- **Composición:** hero fotográfico corto que se superpone con buscador; cards horizontales para comparar en paralelo; ficha con precio/frescura y consulta primero en mobile; OWNER en indicadores compactos y dos colas claras.
- **ADMIN:** tabla de priorización escaneable más panel contextual fijo que muestra fotos, semántica de estados, decisión y cronología. Mobile convierte el panel contextual en detalle debajo de la lista, manteniendo la fila seleccionada.
- **Tono:** preciso y utilitario, sin jerga operativa en copy dirigido a viajeros.

**Fortaleza:** densidad, comparación rápida y continuidad entre bandeja y revisión. **Riesgo:** dark UI reduce la calidez/legibilidad de las fotos y exige validar contraste de texto secundario, displays y controles; puede sentirse como back-office genérico si la voz territorial no sobrevive fuera del hero.

## Comparación

| Criterio | C actual | D1 · Atlas de Altura | D2 · Altitude OS |
|---|---|---|---|
| Identidad propia | Territorio reconocible, pero bosque/beige + serif genérica | Cobalto mineral + atlas; editorial contemporáneo y local | Noche/cian + coordenadas; plataforma operativa de montaña |
| Descubrimiento | Clara pero vertical; comparación inicia tarde | Cards de lectura rápida con foto protagonista | Cards horizontales; alta densidad comparativa |
| Ficha/consulta | Contenido útil; llamada a consultar y frescura deben destacarse | Galería y contacto con jerarquía serena | Panel compacto muy visible; frescura especialmente prominente |
| OWNER | Estados completos, hero/paneles ocupan espacio | Lista priorizada y acciones reconocibles | Métricas y acciones compactas, orientación “workspace” |
| ADMIN | Listado/detalle existentes, visualmente desconectados; #35 | Contexto profundo y decisión/auditoría siempre visibles | Cola de mayor densidad y detalle contextual persistente |
| Accesibilidad | Comportamiento existente a preservar; revisar jerarquía y densidad | Buenas superficies de foco; validar cobalto, lima y tamaños | Validar contraste de texto atenuado, cian y controles sobre dark |
| Rendimiento | CSS/producto ya implementados; assets estáticos | CSS liviano, fuentes de sistema, fotos optimizadas | CSS liviano; fondo fotográfico puede ser LCP si se conserva en producción |
| Migración | Punto de partida funcional | Media: cambiar tokens, layout de catálogo/ficha/OWNER y ADMIN | Media-alta: rehacer surfaces y estados de color, tabla responsive y drawer |

## Conservar / modificar / evitar

**Conservar:** rutas, APIs, permisos OWNER/ADMIN, estado y semántica existentes; precio con moneda y periodicidad; capacidad solo cuando está informada; frescura/última confirmación; consulta idempotente; fotografías con sus reglas de acceso; separación entre aprobación editorial, publicación y disponibilidad; auditoría, feedback de error y reintento; foco, confirmación destructiva y prevención de pérdida de cambios.

**Modificar si Producto aprueba D:** tipografía y escala; proporción foto/información en catálogo; buscador y progresividad de filtros; compactación de OWNER alrededor de próxima acción/estado; arquitectura visual de revisión ADMIN; presentación mobile de cola/editor; feedback y estados vacíos/error/carga; #35 formulario asistido y #37 presentación de hora según su contrato actual.

**Evitar:** imitar logo, color, cards, taxonomía o voz de Airbnb/Sharetribe; introducir booking, checkout, review/rating, calendario por noche, disponibilidad instantánea, ranking o mapa como promesa funcional; declarar “disponible ahora” cuando solo hay un dato anterior; valores o capacidades inventados como verdad de backend; controles que aparenten guardar o moderar durante esta demo.

## Recomendación para HUMAN_GATE

D1 es la propuesta más equilibrada si prioridad es una identidad de alojamientos singular; D2 es más convincente si ADMIN necesita densidad y lectura tipo consola. Antes del refactor, Producto debería elegir una dirección o decidir de forma explícita si acepta **D1 para experiencia pública/OWNER y D2 para la arquitectura ADMIN**. Si combina, acordar qué tokens y componentes comunes atan ambos para que no parezcan productos distintos. No se ha tomado esa decisión en este trabajo.

## Referencias de patrones (inspiración, no reproducción)

- Airbnb separa herramientas de anuncios, disponibilidad/calendario y mensajes en sus dashboards de anfitrión: [Exploring your hosting tools](https://www.airbnb.com/resources/hosting-homes/a/exploring-your-hosting-tools-738).
- Su guía de página de anuncio refuerza la prioridad de título e imagen de portada antes de la ficha: [How to set up an effective listing page](https://www.airbnb.com/resources/hosting-homes/a/how-to-set-up-an-effective-listing-page-12).
- Sharetribe describe una consola administrativa central para revisar, editar y gestionar tarjetas de anuncios: [Manage listings](https://www.sharetribe.com/help/en/articles/9245040-manage-listings).

Se tomaron únicamente los principios de separación de tareas, contexto de publicación y foco fotográfico. El prototipo no adopta reserva, reviews, identidad, componentes de marca ni reglas de esos productos.
