# Travel Oaxaca · Panel de administración (entrega 5B)

App Angular aparte del sitio público y del portal (sin SSR, solo navegador). Misma API, misma identidad. Para el equipo interno.

## Qué incluye
- **Ingreso** con control de rol: solo entran cuentas con rol `admin`, `editor` o `ventas`. Una cuenta sin rol (por ejemplo, un dueño de negocio) ve «Esta cuenta no tiene acceso al panel».
- **Menú según el rol**: admin y editor aterrizan en la revisión; ventas aterriza en Cobros. Negocios lo ven los tres; Cobros, admin y ventas; Planes y precios, solo admin.
- **Cola de revisión** (`/revision`): fichas nuevas, cambios, fotos y promociones, la más antigua primero. Filtros por región y categoría, páginas de 20, insignia con el total pendiente y colores por espera (más de 48 h ámbar, más de 120 h grana).
  - **Fotos**: se aprueban o rechazan en la misma lista (el rechazo pide motivo de 10 a 1000 caracteres).
  - **Promociones**: se aprueban o rechazan en su pestaña (motivo de hasta 300 caracteres; al rechazar vuelve a borrador).
  - **Fichas nuevas y cambios**: se abren en el detalle.
- **Detalle de una ficha** (`/revision/negocios/:id`): cambios «antes → después» (nombre, categoría, textos por idioma, ubicación), la ficha completa con sus fotos, quién la envió y la decisión. Un cambio incompleto solo se puede rechazar (la API lo exige). Tras decidir vuelve a la cola con el mensaje de la API.
- **Historial** (`/revision/historial`): lo ya resuelto, con resultado, motivo y quién revisó.

## Entrega 2: negocios y cobros
- **Negocios** (`/negocios`, los tres roles): todos los negocios con filtros por nombre, estado, categoría y municipio (los filtros viven en la dirección), páginas de 20 y puntaje de ficha.
- **Un negocio** (`/negocios/:id`, pestañas `?tab=`):
  - **Ficha**: resumen de lo publicado (textos por idioma, contactos, dirección, fotos, lo que falta).
  - **Plan y pagos**: plan vigente con días restantes, historial de suscripciones. Admin y ventas pueden *Renovar o cambiar plan* (lleva a Cobros con el negocio elegido) o *Cancelar suscripción* con motivo (el negocio vuelve a Gratis). El editor solo lo ve.
  - **Verificación**: aviso de verificado/vencido, historial y formulario (admin y editor; método, resultado, vigencia y notas).
- **Cobros** (`/cobros`, admin y ventas):
  - **Pagos pendientes**: confirmar, marcar fallido, reembolsar o marcar pagado, con referencia opcional. El menú muestra cuántos hay.
  - **Activar o renovar plan**: busca el negocio, elige plan y periodo, monto (vacío = precio del catálogo), cupón, método y referencia, y si el pago ya se recibió. Un resumen muestra cobro y vigencia (mismo plan: se suma; otro plan: reemplaza desde hoy). Los cupones solo se previsualizan para admin; ventas los escribe y la API los valida al activar.
  - **Otro cobro**: concepto «otro». Los pagos de patrocinios llegan con la entrega 5.
- **Planes y precios** (`/catalogo`, solo admin): editar planes (límites y permisos), precios por plan y periodo con alcance general, por destino o por categoría (gana categoría, luego destino, luego general; se pueden cerrar), y cupones (crear; editar solo descripción, máximo de usos y fecha final).
- Nota: los pagos de un negocio solo se ven en *Pagos pendientes* y en el resultado de la activación; no hay ruta de la API para listarlos por negocio.
- El interceptor ahora también adjunta el token a `/negocios/<id>/suscripciones`.

## Entrega 3: contenido editorial (admin y editor)
Menú «Contenido». Cada editor es su propia página (`/lugares/nuevo`, `/lugares/:id`…); las listas tienen búsqueda, filtro por estado y páginas de 20, todo en la dirección. Al cambiar un parámetro de la ruta (por ejemplo al crear) la página se vuelve a crear, para que cargue sus datos y muestre el aviso.
- **Inicio** (`/inicio`, `/inicio/:id`): bloques de la portada por tipo (destacado, pueblo, historia, reel), con conteos. El editor pide los campos propios de cada tipo, textos por idioma, foto, vigencia y orden, y muestra la lista «para publicar» (foto; destacado: ruta y botón en español; reel: enlace de Facebook; historia: persona y permiso confirmado; saludo: idioma indígena y quién lo verificó). El tipo no cambia al editar.
- **Lugares**: tipo, municipio, lugar padre (un solo nivel), ubicación en mapa (límites de Oaxaca), destacado, estado, textos por idioma y datos (entrada, costos, días, horario, accesibilidad, dificultad). Fotos: subida directa al almacén (JPG/PNG/WebP, hasta 10 MB), orden con ← →, hasta 20; se guardan aparte con «Guardar fotos».
- **Rutas**: duración, distancia, dificultad, transporte, premium, textos y hasta 40 paradas (lugar, negocio o punto del mapa), con minutos y reordenar. Para publicar, 2 paradas o más.
- **Eventos**: fechas, municipio, ubicación, estado, textos, datos (gratis/costo, horas, sede) y hasta 50 negocios.
- **Catálogos** (`/catalogos?tab=`): categorías (árbol), servicios, municipios por región y localidades. Solo admin ve categorías, servicios y municipios; el editor, localidades.

Límites conocidos (por lo que la API publica hoy):
- Los catálogos solo se pueden **crear y editar**: el listado muestra únicamente lo activo, así que lo que se desactive deja de verse y no se puede reactivar desde el panel.
- Al editar una categoría o servicio solo se cambian los idiomas que se escriban; los demás se conservan.
- El `temporadaId` de un evento se conserva al guardar, pero no se edita.
- Las fotos ya guardadas de un lugar se muestran como cuadros numerados (la API solo devuelve los ids); las recién subidas sí se ven.
- La subida de fotos va directo al bucket: necesita CORS en el bucket para el origen del panel (`PUT` y `Content-Type`) y `S3_ENDPOINT_PUBLICO` / `S3_URL_PUBLICA` bien configurados.
- El interceptor ahora también adjunta el token a `/mi/medios/…`.

## Entrega 4: comunidad y usuarios
- **Moderación** (`/comunidad`, admin y editor; grupo «Comunidad» del menú, con contador): cola de reseñas, comentarios, fotos de reseñas y reportes (de fichas y de contenido), la más antigua primero, con pestañas por tipo y conteos, filtro por negocio y páginas de 20.
  - Reseñas y comentarios: Publicar, Ocultar (no se ofrece si ya está oculto) o Rechazar. Fotos: Aprobar o Rechazar con motivo de 5 a 200 caracteres. Reportes: Marcar en revisión, Resolver o Descartar.
  - Si otra persona ya resolvió el caso, se muestra el mensaje de la API y la lista se actualiza.
- **Usuarios y roles** (`/usuarios`, solo admin): búsqueda por nombre o correo, filtros por estado y rol (en la dirección), páginas de 20. «Administrar» abre los roles de plataforma (admin, editor, ventas: agregar o quitar), y suspender (con confirmación; cierra sus sesiones) o reactivar. Los roles de dueño y colaborador se ven pero se gestionan desde el negocio.
- **Privacidad** (`/privacidad`, solo admin): solicitudes de acceso, rectificación, cancelación y oposición, con pestañas por estado y conteos. Pasar a «En proceso» es directo; marcar resuelta o rechazar piden confirmación porque una solicitud cerrada no se reabre.

Límites conocidos (por lo que la API devuelve hoy):
- La cola de moderación trae el texto cortado a 140 caracteres, sin autor ni nombre del negocio (solo su id: se enlaza a «Ver negocio»). Un reporte de contenido no dice cuál reseña, comentario o foto es.
- No hay historial de moderación ni forma de crear usuarios o ver sus reseñas.
- El panel deshabilita cambiar tu propia cuenta o quitarte el rol admin; no puede saber cuántos admins activos hay, así que «último administrador» lo avisa la API al intentar.
- Cambiar el estado de una solicitud de privacidad solo registra el avance y la fecha de cierre: no exporta ni borra datos.
- `PATCH` ya se usa en `core/api.ts` (estado de usuarios y solicitudes).

## Correr
    npm install
    npm start          # http://localhost:4400, proxy /api → http://127.0.0.1:8081
    npm test
    npm run build      # dist/travel-oaxaca-panel/browser

## Lo que debe estar listo en la API
- `CORS_ORIGENES` debe incluir `http://localhost:4400` (si llamas a la API directo y no por el proxy). Ejemplo: `http://localhost:4200,http://localhost:4300,http://localhost:4400`.
- Las cuentas del equipo necesitan su rol (`admin`, `editor` o `ventas`) en el claim `roles` del token. El panel acepta mayúsculas y el prefijo `ROLE_`.
- En producción el panel y `/api` deben compartir dominio (proxy inverso). Toda ruta desconocida debe servir `index.html`.
- La sesión se guarda en el navegador con la llave `to_panel_sesion`, distinta a la del portal.

## Entrega 5A: ventas (admin y ventas; importaciones también editor)
- **Prospectos** (`/prospectos`, admin y ventas): embudo con contadores que funcionan como filtros (estado, acciones vencidas, sin asignar), búsqueda, filtros por origen/asignado/municipio/categoría, 50 por página. El contador del menú muestra las acciones vencidas.
- **Detalle del prospecto** (`/prospectos/:id`): datos, registrar contacto (llamada, visita, WhatsApp, correo, demo, nota; la próxima acción no puede estar en el pasado), historial, cambio de estado con un clic (Descartar pide motivo), **convertir en negocio** (crea un borrador y lleva a `/negocios/:id`; requiere categoría y un municipio con destino) y eliminar con confirmación. Un convertido no cambia de estado ni se elimina.
- **Importaciones** (`/importaciones`, admin/editor/ventas): cada rol ve solo los tipos que la API le permite (ventas: prospectos; editor: negocios, lugares, eventos; admin: todos). Flujo: plantilla CSV → subir (máx. 2 MB, 2000 filas) → revisión sin guardar nada → aplicar (con errores pide confirmación y guarda solo las correctas) o cancelar. Historial paginado.
- **Afiliados** (`/afiliados`): lista con clics de 30 días y gráfica de clics por día con rango de fechas (barras hechas a mano, sin librerías). Solo admin crea o edita; los enlaces no se borran, se pausan.
- Límites: la API guarda como máximo 500 errores por importación (el CSV de errores los trae igual); plantillas y errores se descargan con el token de sesión como archivo.
- Probado con pruebas unitarias (71), navegador contra una API simulada y build de producción. **No** se ha probado contra la API real.

## Entrega 5B: operación
- **Patrocinios** (`/patrocinios`, admin y ventas; menú «Negocios y cobros»): calendario de 60 días por espacio (barras hechas a mano: sólida = activo, punteada = programado), tabla con los mismos datos, programar (espacio, negocio, fechas, precio, cupón y pago opcional) y cancelar con confirmación. La API exige plan Destacado, negocio publicado y cupo libre: el panel muestra su mensaje tal cual. **Espacios y cupo**: admin y ventas los crean y editan (la API lo permite a ambos).
- **Campañas** (`/campanas`, admin y editor; menú «Contenido»): origen, código (no se cambia después), nombre, fechas, vistas y contactos, con «Copiar enlace» (`?o=codigo`). El enlace de ejemplo usa el sitio público en el puerto 4200 si abres el panel en 4400; en producción usa el mismo dominio, ajústalo si el sitio público vive en otro.
- **Métricas** (`/metricas`, admin, editor y ventas; grupo «Resultados» del menú): totales de 7/30/90 días, filtros por región y categoría y ranking de negocios con «días sin contacto» resaltado desde 14 días.
- **Auditoría** (`/auditoria`, admin): filtros por tabla, acción, usuario, registro y fechas (por omisión, 7 días); «Ver cambio» muestra solo los campos que cambiaron.
- **Configuración** (`/configuracion`, admin): claves por tema, control según el tipo (entero con rango, interruptor, texto, JSON). Los ajustes sensibles (`anuncios_terceros_activos`, `reservas_activas`, versiones de términos y privacidad) piden confirmación. Solo se cambian valores; no se crean claves.
- **Plantillas** (`/plantillas`, admin): edita asunto y mensaje con las variables permitidas de cada una (las escribes pegadas, `{{nombre}}`), activa/apaga y «Enviarme una prueba» (solo correos activos, con el texto ya guardado).
- **Notificaciones** (`/notificaciones`, admin): cola filtrable por estado y plantilla, 50 por página, «Reintentar» solo en las fallidas; el menú cuenta las fallidas.
- Límites: el panel supone los estados `programado`, `activo`, `cancelado` y `terminado` en patrocinios; cualquier otro se muestra tal cual. El filtro de usuarios de la auditoría trae los primeros 100 usuarios.
- Probado con pruebas unitarias (87), navegador contra una API simulada y build de producción. **No** se ha probado contra la API real.

## Siguientes entregas
Quedan fuera de este panel: PDF mensual en servidor, pasarela y renovación automática. Pendiente fuera del panel: reconectar Flutter y los servicios con etiquetas en la web pública.
