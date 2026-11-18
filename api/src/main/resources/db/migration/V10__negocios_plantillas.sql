-- =====================================================================
-- Migración 10: negocios (paso 3 de la API)
-- Agrega la plantilla de correo para invitar colaboradores a un negocio. No crea tablas.
-- =====================================================================

INSERT INTO notificacion_plantilla (clave, canal, idioma_codigo, asunto, cuerpo) VALUES
 ('invitacion_equipo', 'correo', 'es', 'Te invitaron a colaborar en un negocio de Travel Oaxaca',
  E'Hola {{nombre}},\n\n{{invitador}} te invitó a ayudar con la ficha de «{{negocio}}» en Travel Oaxaca.\n\nEntra a tu cuenta para aceptar o rechazar la invitación:\n{{enlace}}\n\nSi no esperabas este mensaje, puedes ignorarlo.');
