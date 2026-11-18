-- =====================================================================
-- Migración 12: revisión de fichas y fotos (paso 4 de la API)
-- Las fotos guardan quién las revisó y el motivo si se rechazan, y se agregan las
-- plantillas de correo que faltan (ficha publicada y ficha rechazada ya existen desde V8).
-- =====================================================================

ALTER TABLE medio ADD COLUMN motivo_rechazo text;
ALTER TABLE medio ADD COLUMN revisado_por uuid REFERENCES usuario(id);
ALTER TABLE medio ADD COLUMN revisado_en timestamptz;
ALTER TABLE medio ADD CONSTRAINT ck_medio_motivo_rechazo
  CHECK (moderacion <> 'rechazado' OR motivo_rechazo IS NOT NULL);

INSERT INTO notificacion_plantilla (clave, canal, idioma_codigo, asunto, cuerpo) VALUES
 ('cambios_aprobados', 'correo', 'es', 'Aprobamos los cambios de tu negocio',
  E'Hola {{nombre}},\n\nLos cambios que enviaste en «{{negocio}}» ya están publicados.'),
 ('cambios_rechazados', 'correo', 'es', 'No pudimos aprobar los cambios de tu negocio',
  E'Hola {{nombre}},\n\nNo pudimos aprobar los cambios que enviaste en «{{negocio}}»:\n\n{{motivo}}\n\nTu ficha sigue publicada con la información anterior. Puedes corregir y enviar los cambios de nuevo.'),
 ('foto_rechazada', 'correo', 'es', 'Una foto de tu negocio no fue aprobada',
  E'Hola {{nombre}},\n\nUna de las fotos de «{{negocio}}» no fue aprobada:\n\n{{motivo}}\n\nPuedes subir otra desde tu cuenta.');
