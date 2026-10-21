# I06.4 — QA del recorrido público

## Entorno y alcance

Playwright ejecutó la aplicación Vue con el Worker/Hono del plugin Cloudflare y D1 exclusivamente local. El catálogo usa ocho alojamientos sintéticos; las fotografías WebP son assets estáticos sintéticos del repositorio. No se usaron Preview, Access, R2, servicios remotos ni datos reales.

## Verificaciones

- Web `npm run typecheck` y `npm run build`: PASS.
- Worker `npm run typecheck`: PASS.
- Worker `npm run test:catalog`: 7/7 PASS.
- Worker `npm run test:contact-workflow`: 6/6 PASS. Incluye inserción consultable por OWNER, mismo resultado al repetir la clave y conflicto ante payload distinto.
- Playwright `npm run test:e2e:public`: 4/4 recorridos PASS (filtros/paginación/vuelta y clamp de página guardada fuera de rango; slow-response race, loading/error/empty/imagen rota/retry; ficha/contacto/idempotencia), última ejecución 4/4 en 1.5 min sobre D1 local.
- Desktop 1440×1000; mobile 390×844 y 320×844. QA cubre navegación de vuelta con filtros/página, URL guardada fuera de rango normalizada a última página válida conservando filtros; registro con importe/moneda pero periodicidad faltante muestra “Precio a consultar”, última respuesta gana ante búsqueda lenta anterior, disponibilidad semántica, paginación, foco/skip link, contraste WCAG AA representativo, ausencia de overflow y labels/campos sin intersecciones en el formulario público (#35).
- El seed sintético incluye una ficha legacy incompleta (importe y moneda presentes, periodicidad/capacidad faltantes) que verifica el precio seguro en catálogo.

El primer envío de contacto en browser se interrumpió de forma controlada antes del Worker. El mensaje y datos se conservaron; el reintento llegó al Worker con la misma `Idempotency-Key` y obtuvo HTTP 201. La prueba Worker separada verifica la fila D1 y replay.

## Capturas reales

- [Catálogo desktop 1440×1000](catalog-desktop-1440x1000.png)
- [Catálogo mobile 390×844](catalog-mobile-390x844.png)
- [Catálogo mobile 320×844](catalog-mobile-320x844.png)
- [Ficha y contacto desktop 1440×1000](listing-contact-desktop-1440x1000.png)
- [Ficha y contacto mobile 390×844](listing-contact-mobile-390x844.png)
- [Ficha y contacto mobile 320×844](listing-contact-mobile-320x844.png)

Las capturas contienen únicamente alojamientos, identidad e imágenes sintéticas. Los importes mantienen la moneda y periodicidad publicada. Disponibilidad conserva los estados del API y se presenta como último registro, no como reserva.

## Límite de #35

El solapamiento del formulario público está corregido y automatizado a 390/320 px. El formulario ADMIN asistido no fue modificado ni validado aquí; #35 debe seguir abierto hasta su comprobación en #33.
