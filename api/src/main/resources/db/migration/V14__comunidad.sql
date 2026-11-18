-- =====================================================================
-- Migración 14: comunidad (paso 7 de la API)
-- Reseñas, comentarios, reacciones, reportes y listas ya existen desde V5.
-- Aquí se agregan solo los ajustes que pide la API:
--   * moderación automática (publicar al instante sin revisor humano)
--   * límites de longitud de los textos
--   * configuración editable y vista de calificación por negocio
--   * índices para las colas de moderación
-- =====================================================================

-- La reseña o el comentario que pasa el filtro automático se publica sin revisor humano.
ALTER TABLE resena ADD COLUMN auto_moderada boolean NOT NULL DEFAULT false;
ALTER TABLE resena DROP CONSTRAINT resena_check;
ALTER TABLE resena ADD CONSTRAINT resena_moderacion_check
  CHECK (estado = 'pendiente' OR moderada_por IS NOT NULL OR auto_moderada);

ALTER TABLE comentario ADD COLUMN auto_moderado boolean NOT NULL DEFAULT false;
ALTER TABLE comentario DROP CONSTRAINT comentario_check2;
ALTER TABLE comentario ADD CONSTRAINT comentario_moderacion_check
  CHECK (estado = 'pendiente' OR moderado_por IS NOT NULL OR auto_moderado);

-- Longitudes (la API valida igual; la base es la última defensa).
ALTER TABLE resena ADD CONSTRAINT resena_titulo_largo CHECK (titulo IS NULL OR length(titulo) <= 80);
ALTER TABLE resena ADD CONSTRAINT resena_texto_largo CHECK (texto IS NULL OR length(texto) <= 2000);
ALTER TABLE respuesta_resena ADD CONSTRAINT respuesta_texto_largo CHECK (length(texto) <= 1000);
ALTER TABLE comentario ADD CONSTRAINT comentario_texto_largo CHECK (length(texto) <= 1000);
ALTER TABLE lista ADD CONSTRAINT lista_nombre_valido CHECK (length(trim(nombre)) BETWEEN 1 AND 80);
ALTER TABLE lista_item ADD CONSTRAINT lista_item_nota_larga CHECK (nota IS NULL OR length(nota) <= 300);
ALTER TABLE reporte_ficha ADD CONSTRAINT reporte_ficha_detalle_largo CHECK (detalle IS NULL OR length(detalle) <= 500);
ALTER TABLE reporte_contenido ADD CONSTRAINT reporte_contenido_detalle_largo CHECK (detalle IS NULL OR length(detalle) <= 500);

-- Un elemento no se repite dentro de la misma lista y día.
CREATE UNIQUE INDEX uq_lista_item_negocio ON lista_item (lista_id, COALESCE(dia, 0), negocio_id) WHERE negocio_id IS NOT NULL;
CREATE UNIQUE INDEX uq_lista_item_lugar   ON lista_item (lista_id, COALESCE(dia, 0), lugar_id)   WHERE lugar_id IS NOT NULL;
CREATE UNIQUE INDEX uq_lista_item_ruta    ON lista_item (lista_id, COALESCE(dia, 0), ruta_id)    WHERE ruta_id IS NOT NULL;

-- Colas de moderación y conteos de reportes abiertos.
CREATE INDEX idx_resena_pendiente ON resena (creado_en) WHERE estado = 'pendiente' AND eliminado_en IS NULL;
CREATE INDEX idx_comentario_pendiente ON comentario (creado_en) WHERE estado = 'pendiente' AND eliminado_en IS NULL;
CREATE INDEX idx_reporte_contenido_resena ON reporte_contenido (resena_id) WHERE resena_id IS NOT NULL;
CREATE INDEX idx_reporte_contenido_comentario ON reporte_contenido (comentario_id) WHERE comentario_id IS NOT NULL;
CREATE INDEX idx_reporte_contenido_medio ON reporte_contenido (medio_id) WHERE medio_id IS NOT NULL;
CREATE INDEX idx_reporte_contenido_usuario ON reporte_contenido (usuario_id, creado_en) WHERE usuario_id IS NOT NULL;
CREATE INDEX idx_reporte_contenido_dispositivo ON reporte_contenido (dispositivo_id, creado_en) WHERE dispositivo_id IS NOT NULL;
CREATE INDEX idx_reporte_ficha_usuario ON reporte_ficha (usuario_id, creado_en) WHERE usuario_id IS NOT NULL;
CREATE INDEX idx_reporte_ficha_dispositivo ON reporte_ficha (dispositivo_id, creado_en) WHERE dispositivo_id IS NOT NULL;
CREATE INDEX idx_resena_medio_medio ON resena_medio (medio_id);

-- Promedio y total de reseñas publicadas por negocio.
CREATE VIEW negocio_calificacion AS
  SELECT negocio_id, count(*)::integer AS total, round(avg(calificacion)::numeric, 1) AS promedio
  FROM resena_visible
  GROUP BY negocio_id;

INSERT INTO configuracion (clave, tipo, valor, minimo, maximo, descripcion) VALUES
 ('resena_editable_dias', 'entero', '30', 0, 365,
  'Días durante los que el turista puede editar su reseña.'),
 ('comentario_editable_minutos', 'entero', '15', 0, 1440,
  'Minutos durante los que el turista puede editar su comentario.'),
 ('reportes_para_ocultar', 'entero', '3', 1, 100,
  'Reportes abiertos de personas o dispositivos distintos que ocultan un contenido hasta que lo revise el equipo.'),
 ('comentarios_max_por_hora', 'entero', '10', 1, 1000,
  'Comentarios que una persona puede publicar por hora.'),
 ('reportes_max_por_hora', 'entero', '10', 1, 1000,
  'Reportes que una persona o dispositivo puede enviar por hora.'),
 ('resenas_min_para_promedio', 'entero', '3', 1, 100,
  'Reseñas publicadas que necesita un negocio para mostrar su promedio.'),
 ('listas_max_por_usuario', 'entero', '20', 1, 500,
  'Listas e itinerarios que puede tener una persona.'),
 ('items_max_por_lista', 'entero', '50', 1, 500,
  'Elementos que admite una lista.'),
 ('palabras_filtradas', 'texto', '""', NULL, NULL,
  'Palabras separadas por coma que mandan una reseña o comentario a revisión en lugar de publicarse al instante.');

-- Auditoría de lo que modera el equipo.
CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON resena
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON comentario
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();
