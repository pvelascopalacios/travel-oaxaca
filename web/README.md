# Travel Oaxaca — web pública (Angular 22 con renderizado en servidor)

Zip 1 del Paso 10A: base, tema, navegación, buscador e inicio. Lo demás (listas, fichas, mapa) llega en los zips 2 y 3;
sus rutas ya existen y muestran una pantalla provisional.

## Para correrla en tu computadora

Necesitas Node 22 o superior y la API corriendo en `http://127.0.0.1:8081` (el puerto de `API_PUERTO`; si usas otro, cámbialo en `proxy.conf.json` y en la variable `API_URL`) (con la migración V17).

```bash
npm install
npm start            # http://localhost:4200, con proxy de /api hacia 127.0.0.1:8081
```

Para probar la versión de producción con renderizado en servidor:

```bash
npm run build
set API_URL=http://127.0.0.1:8081/api/v1      # PowerShell: $env:API_URL="..."
set SITE_URL=http://localhost:4000
set PROXY_API=true
npm run serve:ssr:travel-oaxaca-web           # http://localhost:4000
```

`PROXY_API=true` solo sirve para pruebas locales: reenvía `/api` a la API para que web y API compartan dominio.
En producción eso lo hace el proxy inverso (Nginx o Caddy): `/api/*` va a Spring Boot y todo lo demás a este servidor Node.

## Variables del servidor

| Variable | Para qué | Por omisión |
|---|---|---|
| `API_URL` | Dónde está la API (la web la pide desde el servidor) | `http://127.0.0.1:8081/api/v1` |
| `SITE_URL` | Dominio público de la web (enlaces canónicos, hreflang) | `http://localhost:4000` |
| `PROXY_API` | `true` reenvía `/api` a la API (solo pruebas) | apagado |
| `PORT` | Puerto del servidor Node | `4000` |

**Dominios permitidos:** Angular rechaza peticiones con un `Host` desconocido (400). Están permitidos `localhost` y
`127.0.0.1`. Cuando tengas dominio, agrégalo en `angular.json` → `build.options.security.allowedHosts`.

## Qué incluye este zip

- **Idiomas:** `/es` y `/en` en la dirección; textos en `core/textos.ts` (la prueba exige que ambos idiomas tengan las mismas claves). Lo que viene de la API llega ya en el idioma pedido. Cambiar de idioma conserva la página.
- **Identidad:** dirección sobria tomada del logotipo de Oaxaca Explora. Fondo blanco y gris cantera, portada y pie en azul noche, grana (#A5174F) como único color de acción, ocre solo para «Patrocinado» y estrellas, verde solo para estados, laguna para mapa e información. Portada con dos arcos que muestran la foto de los dos primeros lugares destacados, y el sol del emblema como marca de agua. Todo se ajusta en las variables de `src/styles.scss`.
- **Marco:** (en el inicio el encabezado nace limpio, solo logo y acciones, y al bajar sube el buscador y aparecen los grupos, como Tripadvisor; en las demás páginas siempre se ven) encabezado con logo, buscador (en el inicio va dentro de la portada), ES|EN, Para negocios, Iniciar sesión; los cuatro grupos (Descubrir, Dormir, Comer y beber, Artesanías y compras); barra inferior en móvil (Inicio, Buscar, Guardados, Cuenta); pie.
- **Buscador:** sin escribir ofrece búsquedas recientes (solo en el navegador del visitante) y destinos populares; con dos letras pide `/publico/buscar` y muestra negocios, lugares y eventos. Se maneja con teclado (flechas, Enter, Escape).
- **Inicio:** atajos Hoy / Este fin de semana / Cerca de mí, los cuatro grupos, mejor calificados, lugares destacados y próximos eventos.
- **Tarjetas reutilizables:** negocio (precio, calificación, abierto ahora, Verificado), lugar y evento.
- **SEO:** título, descripción, enlace canónico, hreflang es/en/x-default y Open Graph por página; la página 404 responde con código 404 y `noindex`.
- **Rendimiento:** el servidor pide los datos y el navegador los reutiliza, sin descargarlos dos veces.
- **Pruebas:** `npm test` (idiomas, textos, grupos y filtros).

### Zip 2: listas, filtros, búsqueda y mapa

- **Páginas por grupo:** `/es/dormir`, `/es/comer-y-beber`, `/es/artesanias` y `/es/descubrir` (esta junta Lugares, Tours y Eventos; también existen `/es/lugares` y `/es/eventos`). Chips con conteo (de `/publico/negocios/facetas`), orden, «Cerca de mí», «Ver más» y estado vacío con botón para quitar filtros.
- **Filtros en la dirección:** `/es/dormir?tipo=hotel&servicios=wifi,desayuno&precio=2&abierto=1&idiomas=en&orden=precio&vista=mapa`. Se pueden compartir y el botón Atrás funciona. Las páginas filtradas llevan `noindex` y su canónica apunta a la lista sin filtros.
- **Panel:** barra lateral en pantalla ancha y hoja inferior en móvil con el botón «Ver N resultados». Cada grupo ofrece sus propios filtros (Dormir: tipo, precio, servicios, idiomas; Comer: tipo, abierto ahora, precio, servicios; etc.; los servicios están en `SERVICIOS_POR_GRUPO` de `core/filtros.ts`).
- **Precio:** la API filtra por rango (`precioMax` 1 a 3), así que el filtro es «Hasta $ / $$ / $$$», no un monto por noche.
- **Mapa:** Leaflet con mosaicos de OpenStreetMap, sin llave. Pines con el precio, pin elegido en grana, «Buscar en esta zona» (usa `/publico/negocios/mapa`) y tarjeta del negocio elegido en móvil. Se carga solo en el navegador. Leaflet se descarga bajo demanda, al abrir el mapa.
- **`/es/buscar?q=…`:** negocios con orden, abierto ahora y cerca de mí, y debajo lugares y eventos. `?cerca=1` lista lo más cercano sin escribir nada.
- **Ubicación:** solo se pide al tocar «Cerca de mí»; no se guarda.

> Los mosaicos públicos de OpenStreetMap son para uso ligero. Cuando el sitio tenga tráfico real, conviene un proveedor de mosaicos (MapTiler, Stadia, etc.) o un servidor propio; basta cambiar la dirección en `shared/mapa.ts`.

## Pendiente en los siguientes zips

Fichas por tipo (negocio, lugar, evento, ruta), `sitemap.xml`, `robots.txt`, datos estructurados (JSON-LD), medición web
y enlaces de afiliado. De la API faltan dos datos que esta entrega no puede mostrar todavía: la calificación en las
tarjetas de lugares (para el «N.º 1 de 24») y los servicios dentro de la tarjeta de negocio (etiquetas como «Terraza»).

## Notas

- `para-negocios`, `privacidad` y `terminos` muestran una pantalla provisional hasta su entrega.
- Los grupos usan la misma ruta en español e inglés (`/en/comer-y-beber`) para que los enlaces no cambien al traducir.
- El logotipo está en `public/` (`logo-emblema.png`, `logo-emblema-grande.png`, `favicon.png`).
- Las fuentes (Bricolage Grotesque e Inter) se cargan de Google Fonts.

## Inicio (Portada H) — entrega "zip 2b"

Solo se tocaron archivos del inicio; los de zip 2 (listas, filtros, /buscar, mapa) no cambiaron.
No hay dependencias nuevas: **no hace falta `npm install`**.

Orden: titular + buscador + atajos (Hoy / Fin de semana / Cerca de mí) → Destacado que rota → ¿Qué te interesa? → Rutas → Dónde dormir → Mejor calificados → Lugares destacados → Próximos eventos → Pueblos y lenguas → Historias → Reels.

Reglas de datos: una tarjeta sin foto no se muestra; la calificación solo aparece con 3 o más reseñas; "Abierto ahora" solo con horarios; toda sección vacía se oculta; los números vienen de la API.

### Contenido editorial (desde la API)
Destacados, Pueblos y lenguas, Historias y Reels ya **no** viven en un archivo: se capturan en el panel
(`/api/v1/admin/inicio`, paso 10A+ de la API) y llegan por `GET /publico/inicio`. Sin foto aprobada o fuera de vigencia no salen,
y cada sección se oculta si está vacía. Sin Destacados editoriales, el carrusel usa lugares destacados con foto.
Las rutas de los Destacados deben ser páginas del sitio (`/lugar/...`); cualquier otra se descarta.

### Regiones
`GET /publico/regiones` pinta "Las regiones de Oaxaca" en el inicio (solo regiones con algo publicado) y cada una abre
`/{idioma}/region/{slug}` con sus lugares, negocios mejor calificados y próximos eventos. Una región que no existe responde 404.

### Pendiente
- La interfaz del panel para el módulo editorial (la API ya lo trae; falta la pantalla en el panel de administración).
- Etiquetas de servicios en las tarjetas de negocio: la API ya las manda (`servicios`); falta pintarlas (toca un componente de zip 2).

Fuente del orden de secciones: encuesta Sectur (solo ciudad de Oaxaca).

## Fichas, SEO y afiliados — entrega "zip 3"

**Un archivo de zip 2 cambió:** `shared/mapa.ts` (una entrada nueva `conZona`, por defecto `true`, para ocultar «Buscar en esta zona» en las fichas). También cambian `core/seo.ts`, `core/api.ts`, `core/modelos.ts`, `core/textos.ts`, `app.routes.ts` y `server.ts`. Sin dependencias nuevas: no hace falta `npm install`.

### Páginas
- `/{idioma}/negocio/{slug}`: plantilla según el grupo. Hospedaje (habitaciones, entrada/salida), comida (menú por secciones con etiquetas), tours (incluye / no incluye, duración, punto de encuentro), artesanías (productos, envíos), vida nocturna (edad mínima, cover, música). Muestra galería, servicios, idiomas, promociones, horarios (con «hoy» marcado y días especiales), mapa, políticas, reseñas y «N.º X de Y». Barra fija de WhatsApp / Llamar en el teléfono.
- `/{idioma}/lugar/{slug}`, `/evento/{slug}` (con «Agregar al calendario»), `/ruta/{slug}` (paradas numeradas también en el mapa) y `/rutas`.
- Reglas: sin foto no hay galería ni tarjeta; calificación solo con 3 reseñas o más («Sin reseñas suficientes todavía»); «Abierto ahora» solo con horarios; toda sección vacía se oculta. Los enlaces de contacto se validan (un valor raro no se vuelve enlace).
- Una ficha que la API responde 404 muestra la página «No encontramos esa página» **con código HTTP 404** y `noindex`. Si la API falla por otra causa se muestra un aviso, sin marcar 404.

### SEO
- Título, descripción, canónica y `hreflang` salen de `seo` de la API; `hreflang` solo lista los idiomas en `seo.idiomasDisponibles`.
- JSON-LD: se inserta `seo.jsonLd` tal cual lo arma la API, escapando `<` para que ningún texto cierre la etiqueta.
- `GET /sitemap.xml` (lo arma el servidor con `/publico/sitemap` y las regiones con contenido; una entrada por idioma con sus alternativas; caché de 1 h) y `GET /robots.txt` (bloquea `/r/`, `/api/` y la búsqueda). Usa `SITE_URL` para las direcciones absolutas.

### Afiliados
`/r/{codigo}` llama a la API (`/publico/r/{codigo}`), que cuenta el clic, y redirige (302) al sitio del socio. Pausado o inexistente: 404. Nunca se indexa (`X-Robots-Tag`).
En producción, el proxy inverso debe mandar a este servidor `/r/*`, `/sitemap.xml` y `/robots.txt` (igual que las páginas), y `/api` a la API.

### Medición
En el navegador, la ficha registra `vista_ficha`, `toque_whatsapp`, `llamada`, `como_llegar`, `clic_web` y `compartido` en `POST /publico/eventos-uso`. El dispositivo web se registra una vez (`POST /publico/dispositivos`) y su id se guarda en el navegador. Si algo falla, se ignora: nunca estorba.

### Probado y no probado
Compilación, 24 pruebas unitarias y recorrido con navegador (1280 y 390 px, sin desbordes ni errores de consola) contra una **API de mentira**. No se ha probado contra tu API real: si una ficha sale vacía o con un campo faltante, es probable que el nombre de un campo difiera; avísame cuál.

### Pendiente
Las pantallas de negocios (paso 11).

## Cuentas, guardados, reseñas y reporte — entrega "10B"

Sin dependencias nuevas (no hace falta `npm install`). Cambian `app.config.ts` (interceptor de sesión), `app.routes.ts` (ahora las pantallas cargan bajo demanda y el inicio pesa menos), `server.ts`, `styles.scss` (reglas de impresión), `layout/shell.*` (el botón muestra tu nombre con sesión) y las fichas (botón de guardar real).

### Pantallas
- `/{idioma}/ingresar`: ingresar, crear cuenta, «Olvidé mi contraseña». Con sesión muestra la cuenta (guardados, reporte, salir y, si falta, «Reenviar correo»). Acepta `?volver=/es/...`: al terminar regresa ahí (solo páginas del propio sitio).
- `/{idioma}/restablecer-clave?token=` y `/{idioma}/verificar-correo?token=`: destinos de los enlaces de los correos. También funcionan sin idioma (`/restablecer-clave?token=…` se manda a `/es/...` conservando el token).
- `/{idioma}/guardados`: favoritos (negocios, lugares y rutas) con filtro; sin foto no se muestra. El botón «Guardar» de las fichas guarda y quita al instante; sin sesión lleva a ingresar y regresa.
- `/{idioma}/negocio/{slug}/resena`: escribir, editar o borrar tu reseña (una por negocio). Muestra el mensaje de la API (publicada o en revisión) y los errores por campo. Sin fotos en esta entrega.
- `/{idioma}/reporte`: reporte mensual del negocio (selector de negocio y de mes, comparación con el mes anterior si existe) y botón de imprimir/PDF del navegador. La impresión oculta menús y controles (A4).

### Sesión
El token de acceso vive solo en memoria y se renueva solo; el de renovación y tu nombre se guardan en el navegador (`localStorage`, llave `to_sesion`) igual que en la app. El servidor nunca tiene sesión: se restaura después del primer pintado. Si la API responde 401, la sesión local se cierra.

### Lo que debes configurar en la API
Los correos de confirmar correo y restablecer contraseña arman su enlace con `URL_PORTAL` (`{URL_PORTAL}/verificar-correo?token=…`). Para que lleguen a esta web, `URL_PORTAL` debe apuntar al dominio de la web pública (en desarrollo, `http://localhost:4200`). Si el portal de negocios usará la misma variable, hay que separar una variable para la web: dímelo y lo hago del lado de la API.

### Probado y no probado
Compilación, 29 pruebas unitarias y recorrido con navegador contra una **API de mentira** (ingreso con error y acierto, regreso a la ficha, guardar y quitar, reseña crear y borrar con errores por campo, reporte con comparación, impresión, cuenta y salir, registro, enlaces de correo, y a 390 px sin desbordes ni errores de consola). No se probó contra tu API real.

## Para negocios (`/es/para-negocios`, `/en/para-negocios`)
- Página de venta para dueños de negocio: portada, «Así funciona» (4 pasos), planes, ejemplo de ficha, control del negocio, preguntas frecuentes y cierre.
- Los planes vienen de la API (`GET /publico/planes`): límites de fotos y promociones, estadísticas, patrocinio y precios. Se ordenan del que menos incluye al que más. Gratis no muestra precio. Con precio general (sin destino ni categoría) se muestra ese; si solo hay precios específicos, el más bajo con «desde». El selector Anual/Mensual aparece solo si hay precios en ambos periodos.
- Los botones llevan al **portal del negocio** (`/ingresar?modo=registro`; «Entra a tu portal» va a `/ingresar`). Esta web no tiene registro propio de negocios.
- **Dirección del portal:** `PORTAL_URL` en `core/config.ts`. En desarrollo es `http://localhost:4300`. **Antes de publicar cambia `PORTAL_PRODUCCION`** por el dominio real de tu portal (hoy dice `https://portal.traveloaxaca.mx`, que es una suposición).
- Textos pendientes de confirmar contigo: cuánto tarda de verdad la revisión de una ficha (no se promete un plazo) y si se quiere anunciar «sin comisiones» (no se dice).
- Quedan como marcador de posición: `/privacidad` y `/terminos` (esperan el texto legal).
- Corrección incluida: la web cuenta las páginas desde 1 y la API desde 0; `Api.get` ahora resta 1 a `pagina`.
- Probado con pruebas unitarias (33), navegador contra una API simulada (planes, periodo, enlaces, inglés, API caída, móvil) y build de producción. No se probó contra la API real.

## Perfil de la persona (`/es/perfil`, `/en/perfil`)

Página con sesión (sin sesión manda a `/ingresar?volver=/es/perfil` y regresa al entrar). Usa solo endpoints que ya existen en la API:

| Sección | Qué hace | Endpoint |
|---|---|---|
| Mis datos | Nombre, teléfono (con lada, se normaliza `+52 954 123 4567` → `+529541234567`), idioma; correo de solo lectura; reenviar verificación | `GET/PUT /mi/perfil`, `POST /auth/reenviar-verificacion` |
| Seguridad | Cambiar contraseña (la API cierra las otras sesiones); sesiones abiertas, cerrar una o todas las demás | `PUT /mi/clave`, `GET /mi/sesiones`, `DELETE /mi/sesiones/{id}` |
| Mi actividad | Enlace a Guardados; Listas y Reseñas aparecen como «Próximamente» | — |
| Privacidad | Interruptores de analítica y novedades (cada cambio queda en el historial); solicitudes de acceso, rectificación, cancelación y oposición con su estado | `GET/POST /mi/consentimientos`, `GET/POST /mi/solicitudes-privacidad` |

- «Cuenta» (barra móvil) y el botón del encabezado llevan a `/perfil` cuando hay sesión; la pantalla de ingresar con sesión muestra «Mi perfil».
- Eliminar la cuenta es una solicitud de **cancelación**: el equipo la atiende desde el panel (Privacidad). La cuenta sigue activa mientras tanto.
- Cerrar «todas las demás» llama una vez por sesión a `DELETE /mi/sesiones/{id}` (no usa `/auth/salir-todo` porque cerraría también la actual).
- Al guardar el perfil se actualiza también el nombre guardado en el navegador.
- Los consentimientos de analítica y novedades se registran con `versionTexto: "1"`.
- Lógica pura y probada en `core/perfil.ts` (+ `perfil.spec.ts`); 41 pruebas unitarias en total.

## Listas, itinerarios y Mis reseñas

| Ruta | Qué es | Sesión |
|---|---|---|
| `/es/listas` | Mis listas (tarjetas, contador «n de 20», crear) | sí |
| `/es/listas/:id` | Una de mis listas: por día si es itinerario, mover ↑↓, cambiar de día, nota, quitar, editar, copiar enlace, borrar | sí |
| `/es/lista/:id` | Lista **pública** de solo lectura para compartir (noindex); si es privada o no existe, «no disponible» (404) | no |
| `/es/mis-resenas` | Mis reseñas con estado (publicada / en revisión / no publicada); editar lleva a `/negocio/:slug/resena`; borrar con confirmación | sí |

- **Guardar en lista:** botón «＋ Guardar en lista» junto al corazón en negocio, lugar y ruta (`shared/guardar-en-lista.ts`). En itinerarios se puede elegir el día (opcional). Si el elemento ya está, se avisa (la API responde 409).
- Al mover o cambiar de día, cada petición manda el `dia` y la `nota` actuales del elemento porque la API **reemplaza** esos campos (null los borra).
- Una lista normal nunca manda fechas; la API las rechaza.
- Lógica pura y probada en `core/listas.ts` (+ `listas.spec.ts`); 49 pruebas unitarias en total.
- **Requiere en la API:** `GET /api/v1/mi/resenas` (zip `travel-oaxaca-api-mis-resenas.zip`). Sin él, «Mis reseñas» muestra el aviso de error con «Reintentar».

## Comunidad: comentarios, «útil» y reportes

- **Comentarios** (`shared/comentarios.ts`) al final de lugar, ruta y evento. Leer es público; comentar, «me gusta», editar, borrar y reportar piden cuenta. Sin sesión el cuadro se cambia por «Ingresa para comentar» (regresa a la misma página). Con sesión sin correo verificado aparece «Confirma tu correo para comentar» con Reenviar. Solo se responde a comentarios principales. Un comentario con enlaces o palabras sensibles queda «En revisión» y solo lo ve su autor.
- **Reseñas** (`shared/resenas.ts`): botón «Útil · n» (interruptor, requiere sesión, se pinta al instante y se corrige con el total de la API) y «Reportar». En tu propia reseña no aparecen.
- **Reportar** (`shared/reportar.ts`): ventana `<dialog>` para comentario, reseña y, en la ficha del negocio, «¿Algo no está bien? Avísanos».
- **Sesión en lecturas públicas:** `core/auth.interceptor.ts` ahora también manda el token a `publico/{lugares|rutas|eventos|articulos}/{slug}/comentarios`, `publico/negocios/{slug}/resenas` y `publico/reportes/…`, para que la API marque `mio`/`mia`, `yoLeDiMeGusta` y `yoMarqueUtil`. Requiere el zip de API `travel-oaxaca-api-comunidad.zip`; sin él la web funciona, pero Editar/Borrar y el corazón no reflejarán lo anterior a la visita.
- Pruebas: `core/comunidad.spec.ts`.
