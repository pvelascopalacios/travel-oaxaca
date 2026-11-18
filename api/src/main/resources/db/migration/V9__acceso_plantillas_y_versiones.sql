-- =====================================================================
-- Migración 9: acceso (paso 2 de la API)
-- Agrega las plantillas de correo de cuentas y las versiones vigentes de los textos
-- legales que se aceptan al registrarse. No crea tablas.
-- =====================================================================

INSERT INTO configuracion (clave, tipo, valor, minimo, maximo, descripcion) VALUES
 ('version_terminos', 'texto', '"1"', NULL, NULL,
  'Versión vigente de los términos y condiciones. Súbela cuando cambien los textos.'),
 ('version_privacidad', 'texto', '"1"', NULL, NULL,
  'Versión vigente del aviso de privacidad. Súbela cuando cambie el texto.');

INSERT INTO notificacion_plantilla (clave, canal, idioma_codigo, asunto, cuerpo) VALUES
 ('verificar_correo', 'correo', 'es', 'Confirma tu correo en Travel Oaxaca',
  E'Hola {{nombre}},\n\nPara confirmar tu correo entra a este enlace (vigente 24 horas):\n{{enlace}}\n\nSi no creaste una cuenta, ignora este mensaje.'),
 ('restablecer_clave', 'correo', 'es', 'Restablece tu contraseña de Travel Oaxaca',
  E'Hola {{nombre}},\n\nPara elegir una contraseña nueva entra a este enlace (vigente 1 hora):\n{{enlace}}\n\nSi no lo pediste tú, ignora este mensaje: tu contraseña no cambia.'),
 ('bienvenida', 'correo', 'es', 'Bienvenido a Travel Oaxaca',
  E'Hola {{nombre}},\n\nTu correo quedó confirmado. Ya puedes guardar tus lugares favoritos y dejar reseñas.\n\nTravel Oaxaca');
