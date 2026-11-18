-- =====================================================================
-- Migración 15: comercial (paso 8 de la API)
-- Las tablas de planes, precios, suscripciones, cupones, pagos, patrocinios y promociones
-- ya existen desde V7. Aquí se agregan los datos que pide la API:
--   * motivo y revisor de las promociones (el equipo las aprueba antes de mostrarse)
--   * plantillas de correo de promociones y patrocinios
--   * configuración editable de avisos y de estadísticas del plan Gratis
--   * índices para las colas, el calendario y los cobros por confirmar
-- =====================================================================

ALTER TABLE promocion
  ADD COLUMN motivo_rechazo text,
  ADD COLUMN revisada_por   uuid REFERENCES usuario(id),
  ADD COLUMN revisada_en    timestamptz;

ALTER TABLE promocion ADD CONSTRAINT promocion_texto_largo
  CHECK (condiciones IS NULL OR length(condiciones) <= 500);
ALTER TABLE promocion_traduccion ADD CONSTRAINT promocion_titulo_largo
  CHECK (length(titulo) BETWEEN 1 AND 100 AND (descripcion IS NULL OR length(descripcion) <= 500));
ALTER TABLE suscripcion ADD CONSTRAINT suscripcion_motivo_largo
  CHECK (motivo_cancelacion IS NULL OR length(motivo_cancelacion) <= 300);

CREATE INDEX idx_promocion_revision ON promocion (actualizado_en) WHERE estado = 'en_revision' AND eliminado_en IS NULL;
CREATE INDEX idx_patrocinio_calendario ON patrocinio (inicio, fin) WHERE estado IN ('programado','activo');
CREATE INDEX idx_pago_pendiente_fecha ON pago (creado_en) WHERE estado = 'pendiente';
CREATE INDEX idx_notificacion_aviso ON notificacion (negocio_id, plantilla_clave) WHERE negocio_id IS NOT NULL;

INSERT INTO configuracion (clave, tipo, valor, minimo, maximo, descripcion) VALUES
 ('aviso_vencimiento_dias_1', 'entero', '15', 1, 90,
  'Primer aviso de que el plan vence: días antes de la fecha de fin.'),
 ('aviso_vencimiento_dias_2', 'entero', '3', 1, 90,
  'Segundo aviso de que el plan vence: días antes de la fecha de fin.'),
 ('aviso_patrocinio_dias', 'entero', '5', 1, 60,
  'Aviso de que un patrocinio está por terminar: días antes de su fin.'),
 ('estadisticas_gratis_dias', 'entero', '7', 7, 90,
  'Días de estadísticas que ve un negocio sin plan de pago (solo totales).');

INSERT INTO notificacion_plantilla (clave, canal, idioma_codigo, asunto, cuerpo) VALUES
 ('promocion_aprobada',   'correo', 'es', 'Tu promoción ya está publicada',
  'Hola {{nombre}}, la promoción "{{promocion}}" de "{{negocio}}" ya es visible en la app.'),
 ('promocion_rechazada',  'correo', 'es', 'Tu promoción necesita cambios',
  'Hola {{nombre}}, revisamos la promoción "{{promocion}}" de "{{negocio}}" y necesita ajustes: {{motivo}}'),
 ('patrocinio_por_terminar', 'correo', 'es', 'Tu patrocinio termina pronto',
  'Hola {{nombre}}, el patrocinio de "{{negocio}}" termina el {{fecha}}. Escríbenos si quieres renovarlo.');
