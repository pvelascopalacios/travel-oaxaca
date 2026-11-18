# Travel Oaxaca API

API en Spring Boot 3 (Java 21) para la app móvil, el portal de negocios y el panel de administración.
Se conecta a PostgreSQL 16 con PostGIS. Va por el **paso 3** del plan (base, acceso, catálogos y negocios).

## Qué incluye este paso

- Proyecto Maven con Spring Boot 3.5, JDBC, validación, Flyway y OpenAPI.
- Las migraciones `V1` a `V8` (las que ya corriste, sin `BEGIN` ni `COMMIT` porque Flyway abre la transacción), `V9` (plantillas de correo y versiones de términos, paso 2) y `V10` (plantilla de invitación al equipo, paso 3).
- Formato único de respuesta (`ApiResponse` y `ApiResponses`) y manejo central de errores.
- Traducción de errores de la base: los mensajes en español de los triggers llegan tal cual al usuario.
- Auditoría: el usuario actual se envía a PostgreSQL en cada transacción de escritura.
- Identificador de solicitud (`X-Request-Id`) en respuestas y registros.
- CORS configurable, documentación en `/api/docs`, y la ruta `GET /api/v1/publico/estado`.
- `Dockerfile` y `docker-compose.yml` para desarrollo local.
- Pruebas de integración contra PostgreSQL real.

## Arranque rápido

1. Copia `.env.example` a `.env` y pon una contraseña.
2. Con Docker: `docker compose up --build`. Flyway crea las 78 tablas en la primera ejecución.
3. Revisa `http://127.0.0.1:8081/api/v1/publico/estado` y la documentación en `http://127.0.0.1:8081/api/docs`. El puerto de la API (8081) se cambia en `.env` con `API_PUERTO`.

Sin Docker: crea una base con PostGIS, define `DB_URL`, `DB_USER` y `DB_PASSWORD`, y ejecuta `mvn spring-boot:run`.

### Si ya corriste las migraciones a mano en tu base

Define `FLYWAY_BASELINE_VERSION=8` la primera vez. Así Flyway marca esa base como ya migrada y solo aplicará las versiones nuevas (V9 en adelante). En una base nueva déjalo sin definir.

### Pruebas

```
createdb to_api_test && psql to_api_test -c "CREATE EXTENSION postgis"
TEST_DB_URL=jdbc:postgresql://localhost:5432/to_api_test TEST_DB_USER=postgres TEST_DB_PASSWORD=... mvn test
```

Las pruebas usan una base vacía; Flyway la migra solo. Si la base de pruebas ya tiene datos de una corrida anterior, bórrala y créala de nuevo.

## Paso 2: acceso (cuentas, sesiones y privacidad)

Qué hay: registro de turistas, ingreso, renovación de sesión, recuperación de contraseña, verificación de correo,
perfil, sesiones abiertas, consentimientos, solicitudes de privacidad (ARCO) y administración de usuarios.
El detalle de cada ruta está en Swagger: `http://localhost:8081/swagger-ui.html`.

### Para probarlo en tu computadora
1. En tu `.env` agrega `JWT_SECRETO` (mínimo 32 caracteres; `openssl rand -base64 48` o cualquier texto largo).
2. Para tener un administrador desde el inicio agrega `ADMIN_CORREO` y `ADMIN_CLAVE` (la clave de 10+ caracteres).
3. `docker compose up --build`. La migración V9 se aplica sola.
4. En Postman: `POST /api/v1/auth/registro` con `{"correo","clave","nombre","aceptaTerminos":true}`.
   Con `CORREO_MODO=consola` los correos **no se envían**: el enlace de confirmación o de recuperación aparece en el
   registro de la API (`docker compose logs -f api`). Copia el `token` del enlace y mándalo a `/auth/verificar-correo`
   o `/auth/restablecer-clave`.
5. En las rutas protegidas usa el encabezado `Authorization: Bearer <tokenAcceso>`.

### Reglas que conviene saber
- El token de acceso dura 15 minutos; el de renovación 30 días y se cambia en cada uso. Si un token ya usado vuelve a
  aparecer, se cierran todas las sesiones de esa persona.
- Si le quitas un rol o suspendes a alguien, su token de acceso actual sigue valiendo hasta 15 minutos (las sesiones
  de renovación se cierran de inmediato).
- Límites en memoria (se reinician con la API): 5 ingresos fallidos por correo+IP cada 15 min, 10 registros por IP por
  hora, 3 correos de recuperación por correo por hora.
- La IP se toma de la conexión directa. Detrás de un proxy o balanceador habrá que configurar el reenvío de IP.
- Los administradores solo dan roles globales (`admin`, `editor`, `ventas`). Los roles de negocio (`dueno`,
  `colaborador`) los da el paso 3: `dueno` al crear el primer negocio y `colaborador` por invitación.
- Fuera de este paso: cambiar el correo de la cuenta y anonimizar/eliminar la cuenta (la solicitud de cancelación
  queda registrada y un administrador la atiende a mano).

## Paso 3: catálogos y negocios

Qué hay (52 rutas, todas en Swagger): catálogos públicos (idiomas, destinos, regiones, municipios, localidades,
categorías, servicios) y su administración; subida de fotos con URL firmada; alta y edición de negocios; ficha completa
(descripciones por idioma, sucursales con ubicación, horarios, fechas especiales, contactos, servicios, idiomas, fotos);
ofertas (habitaciones, tours, platillos); envío a revisión, pausar, reanudar y archivar; equipo (invitar colaboradores);
y la vista del equipo interno (`/api/v1/admin/negocios`).

### Para probarlo en tu computadora
1. `docker compose up --build`. Ahora también arranca **MinIO** (el almacén de fotos de desarrollo, compatible con S3):
   puertos 9000 (archivos) y 9001 X. La migración V10 se aplica sola.
2. Los catálogos de **municipios y localidades empiezan vacíos**: la base trae las 8 regiones pero ningún municipio.
   Un administrador los da de alta con `POST /api/v1/admin/municipios` (`regionId`, `nombre`, `claveInegi`, `latitud`,
   `longitud`) y `POST /api/v1/admin/localidades`. Hasta que haya al menos un municipio no se puede crear un negocio.
3. Flujo mínimo en Postman (todas con `Authorization: Bearer <tokenAcceso>`):
   - `POST /api/v1/mi/negocios` con `{"nombreComercial","categoriaId","municipioId"}` → crea el negocio en borrador
     y te hace propietario. Los ids de categoría salen de `GET /api/v1/publico/categorias`.
   - `PUT /api/v1/negocios/{id}/traducciones`, `PUT .../sucursales/{sucursalId}` (ubicación), `POST .../contactos`.
   - Fotos: `POST /api/v1/mi/medios/subida` (`{"mime":"image/jpeg","bytes":123456}`) devuelve `urlSubida`; sube el archivo
     con `PUT` a esa URL, con los encabezados que indica la respuesta; luego `POST /api/v1/mi/medios/{medioId}/confirmar`
     y `POST /api/v1/negocios/{id}/medios` con `{"medioId"}`.
   - `GET /api/v1/negocios/{id}/faltantes` dice qué falta; `POST .../enviar-revision` la manda a revisión.
4. Quien crea su primer negocio recibe el rol global `dueno`; el token de acceso que ya tenía no lo trae hasta que
   renueve la sesión. No afecta a estas rutas: el permiso real sale de la membresía en cada negocio.

### Reglas que conviene saber
- **Fotos:** solo JPEG, PNG o WebP, máximo 10 MB y 20 por negocio. La API nunca recibe el archivo: da una URL que
  vence en 5 minutos y, al confirmar, descarga el archivo, comprueba por su contenido que sea una foto, lee ancho y
  alto y guarda su huella (SHA-256). Si no coincide, lo borra. Las fotos nuevas quedan en `pendiente` hasta que el
  equipo las apruebe (paso 4). Límite: 60 solicitudes de subida por persona por hora.
- **Enviar a revisión** pide: descripción corta en español, ubicación de la sucursal principal, un WhatsApp o teléfono
  y al menos 3 fotos no rechazadas. **Publicar** (paso 4) además exige 3 fotos *aprobadas*.
- **Ficha publicada:** nombre, categoría (solo dentro del mismo tipo), todas las descripciones y la ubicación de la
  sucursal principal no cambian al instante: se guardan como cambios pendientes en una sola revisión (`cambios` con
  `antes` y `despues`) que el paso 4 aprobará. Horarios, contactos, servicios, idiomas, ofertas, fotos y precio se
  aplican de inmediato. La respuesta lo indica con `aplicado` y `pendienteDeRevision`.
- No se puede quitar el último WhatsApp/teléfono, bajar de 3 fotos aprobadas, borrar la sucursal principal ni cambiar
  cuál es la principal en una ficha publicada. Una ficha `en_revision` no se edita (409).
- **Permisos:** propietario y colaborador editan y envían a revisión; solo el propietario pausa, reanuda, archiva,
  invita y quita personas. Admin y editor pueden editar cualquier ficha; ventas solo lee. Un negocio ajeno responde 404.
- **Invitaciones:** solo a personas que ya tienen cuenta con correo verificado (máximo 5 por día por negocio). Se les
  manda el correo `invitacion_equipo` con un enlace a `URL_PORTAL/invitaciones`; aceptan o rechazan en
  `POST /api/v1/mi/invitaciones/{id}/responder`.
- **Límites:** 10 negocios por persona como propietario.
- Archivar es un borrado suave: el negocio deja de aparecer pero la fila se conserva.
- Los catálogos públicos llevan `Cache-Control` de 1 hora y `ETag`; el idioma sale de `?idioma=` o de
  `Accept-Language` y, si no existe, se usa español.
- Coordenadas: deben caer en una caja alrededor de Oaxaca (lat 15.4 a 18.9, lng -98.8 a -93.7) para atrapar valores
  puestos al revés.

### Almacén de fotos en producción
En producción usa AWS S3 o Cloudflare R2: define `S3_BUCKET`, `S3_REGION`, `S3_ACCESO_LLAVE`, `S3_ACCESO_SECRETO`,
`S3_URL_PUBLICA` (la dirección pública desde donde se ven las fotos) y, solo para R2 u otro compatible, `S3_ENDPOINT`.
El bucket necesita CORS que permita `PUT` desde el origen del portal y de la app, y lectura pública (o una CDN delante).

## Convenciones

| Tema | Regla |
| --- | --- |
| Rutas | `/api/v1/publico/...` sin cuenta · `/api/v1/mi/...` usuario con sesión · `/api/v1/negocios/{id}/...` equipo del negocio · `/api/v1/admin/...` equipo interno |
| Respuesta | `{ ok, datos, mensajes[], errores{campo:mensaje}, solicitudId }` siempre; usa `ApiResponses.ok(...)` |
| JSON | camelCase; fechas en ISO 8601 (UTC) |
| Controladores | Nunca devuelven entidades: siempre DTO (`record`) |
| Acceso a datos | SQL nativo con `JdbcClient`, parámetros con nombre, sin concatenar texto |
| Errores de negocio | `throw BusinessException.invalida(...)`, `noEncontrado(...)`, `conflicto(...)`, `prohibido(...)` |
| Mensajes al usuario | En español, listos para mostrarse |
| Cambios a la base | Solo con una migración nueva `V11__...sql`; nunca editar una ya aplicada |
| Secretos | Solo en variables de entorno, jamás en el repositorio |

## Cómo funciona la auditoría

Los triggers de la base (`fn_auditar`) guardan quién hizo cada cambio leyendo `app.usuario_id`.
La API lo envía sola: en cuanto exista un usuario autenticado, el filtro del paso 2 llamará a
`UsuarioActual.establecer(id)` y el aspecto `AuditoriaTransaccionAspect` ejecutará
`SELECT set_config('app.usuario_id', ..., true)` al entrar a cada método `@Transactional` de escritura.
Los trabajos programados no establecen usuario, así que la bitácora los registra como sistema (nulo).
Los métodos de solo lectura (`@Transactional(readOnly = true)`) no se tocan.

## Estructura

```
src/main/java/mx/com/traveloaxaca
├── TravelOaxacaApplication.java
├── comun
│   ├── api          ApiResponse, ApiResponses
│   ├── auditoria    UsuarioActual, AuditoriaTransaccionAspect, TransaccionConfig
│   ├── error        BusinessException, GlobalExceptionHandler
│   └── web          SolicitudIdFilter, WebConfig (CORS y OpenAPI)
├── acceso           cuentas, sesiones, privacidad (paso 2)
├── negocios         catálogos, fotos, negocios, ficha, ofertas, publicación y equipo (paso 3)
│   ├── almacen      AlmacenMedios (interfaz) y AlmacenS3
│   ├── dto          NegocioDtos
│   ├── repo         SQL de cada tema
│   ├── servicio     reglas
│   └── web          controladores
└── estado           EstadoController, EstadoService
```

Los módulos siguientes se agregan como paquetes hermanos de `estado`.

## Pendientes conocidos

- Municipios y localidades: el catálogo empieza vacío (ver paso 3). Falta cargarlo desde una fuente oficial verificada (INEGI).
- Las fotos nuevas no se ven como aprobadas hasta que exista la cola de moderación (paso 4).
- Trabajos programados (`@Scheduled`): se agregan junto a cada módulo que los necesita.
