# Travel Oaxaca · Portal del negocio (entregas 1 a 4)

App Angular aparte del sitio público (sin SSR, solo navegador). Misma API, misma identidad.

## Qué incluye
- Ingreso, registro de negocio, recuperar contraseña y confirmar correo (`/restablecer-clave?token=` y `/verificar-correo?token=`: son los enlaces que manda la API).
- **Mis negocios** (`/negocios`): lista y registro (queda en borrador).
- **Resumen** (`/negocios/:id`): estado, lista de faltantes, enviar a revisión, pausar/reanudar/archivar (con confirmación), resultados 7/30/90 días y plan Gratis.
- **Reporte mensual** (`/negocios/:id/reporte`), imprimible.
- **Editor de la ficha** (`/negocios/:id/ficha?seccion=…`): datos y datos propios de cada tipo de negocio, descripción es/en, sucursales con mapa, horarios (hasta 3 franjas por día), fechas especiales, contactos, servicios e idiomas. Cada bloque se guarda por separado y muestra si el cambio se aplicó o espera revisión. En revisión o archivada la ficha es solo lectura.
- **Fotos** (`/negocios/:id/fotos`): subir varias (JPEG, PNG o WebP, hasta 10 MB; el plan fija el cupo: Gratis 3, Pro 15, Destacado 30, y 20 como tope), pie de foto al subir, avance, reintentar, ordenar con flechas, elegir portada y quitar con confirmación. Muestra si cada foto está aprobada, en revisión o rechazada (con el motivo).
- **Menú / Habitaciones / Tours y experiencias / Productos** (`/negocios/:id/opciones`): el título y el formulario dependen de la categoría. Crear, cambiar, publicar, pausar, archivar, eliminar y ordenar. El plan Gratis no incluye opciones y ve el aviso con lo que incluye cada plan.
- **Promociones** (`/negocios/:id/promociones`): descuento en %, descuento en pesos, 2×1 o regalo; título y descripción es/en, código, condiciones y a qué opción aplica. «Guardar borrador» o «Guardar y enviar a revisión». Solo se editan los borradores; las demás se eliminan y se crean de nuevo. Muestra el motivo si el equipo pidió cambios. Plan sin promociones: aviso con enlace a los planes. Enviar a revisión exige ficha publicada.
- **Plan y pagos** (`/negocios/:id/plan`), solo lectura: plan y vigencia (con aviso de gracia o por vencer), uso de fotos y opciones, comparación de planes con precios del catálogo (si no hay precio vigente, no se muestra), historial de suscripciones y pagos. Cada bloque falla por separado. El cambio de plan lo registra el equipo de Travel Oaxaca tras el pago.
- **Equipo** (`/negocios/:id/equipo`): cualquiera ve quién administra el negocio; el propietario invita por correo (la persona debe tener cuenta con correo verificado) y quita colaboradores o cancela invitaciones.
- **Invitaciones recibidas**: en «Mis negocios» aparecen para aceptar o rechazar.

## Correr
    npm install
    npm start          # http://localhost:4300, proxy /api → http://127.0.0.1:8081
    npm test
    npm run build      # dist/travel-oaxaca-portal/browser

## Configuración
- `public/config.json` → `sitioUrl`: dirección del sitio público (términos, privacidad, «Ver en el sitio»). Se lee al arrancar; se puede cambiar en el servidor sin recompilar.
- `public/config.json` → `contactoPlanes` (opcional): cómo pedir un cambio de plan en «Plan y pagos». Acepta un WhatsApp (`951 123 4567` o `+52 951 123 4567`, abre wa.me), una dirección `https://…` o un texto libre. Vacío: solo se muestra «Escríbenos por el medio que ya usas con el equipo».
- En la API, `URL_PORTAL` debe apuntar a este portal (en desarrollo `http://localhost:4300`): los correos de verificar y restablecer llevan a `/verificar-correo` y `/restablecer-clave` de aquí.
- En producción el portal y `/api` deben compartir dominio (proxy inverso), igual que el sitio. Toda ruta desconocida debe servir `index.html`.

## Subida de fotos: lo que debe estar listo en el servidor
La foto no pasa por la API: el portal pide una URL firmada y la sube **directo al almacén** (S3 o MinIO), luego confirma y la liga a la ficha. Para que el navegador pueda hacerlo, el *bucket* necesita CORS que permita al portal:
- Origen: `http://localhost:4300` (y el dominio del portal en producción).
- Métodos: `PUT` (y `GET`/`HEAD`).
- Encabezados permitidos: `Content-Type` (o `*`).

En la API, `S3_ENDPOINT_PUBLICO` debe ser una dirección que el **navegador** alcance (en desarrollo con MinIO, `http://localhost:9000`) y `S3_URL_PUBLICA` la base con que se ven las fotos. Si falta el CORS, el portal muestra «No pudimos subir la foto al almacén» y en la pestaña Red la petición `PUT` aparece bloqueada.
