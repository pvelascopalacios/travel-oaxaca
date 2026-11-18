-- Paso 9: ventas y operación.
-- Embudo de prospectos, importaciones por CSV, plantillas con variables permitidas y enlaces de afiliado.

-- ---------------------------------------------------------------------
-- Prospectos: búsquedas por teléfono y correo (detección de duplicados)
-- ---------------------------------------------------------------------
CREATE INDEX ix_prospecto_telefono ON prospecto (telefono) WHERE eliminado_en IS NULL AND telefono IS NOT NULL;
CREATE INDEX ix_prospecto_correo ON prospecto (correo) WHERE eliminado_en IS NULL AND correo IS NOT NULL;
CREATE INDEX ix_contacto_valor ON contacto (lower(valor)) WHERE eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Importaciones: el archivo se guarda hasta que se aplica o se cancela
-- ---------------------------------------------------------------------
ALTER TABLE importacion ADD COLUMN contenido text;
ALTER TABLE importacion ADD CONSTRAINT ck_importacion_archivo CHECK (length(archivo) <= 200);
COMMENT ON COLUMN importacion.contenido IS 'CSV tal como se subió. Se borra al aplicar o cancelar.';

-- ---------------------------------------------------------------------
-- Plantillas: variables permitidas por clave (se deducen de lo que ya trae cada plantilla)
-- ---------------------------------------------------------------------
ALTER TABLE notificacion_plantilla ADD COLUMN variables text[] NOT NULL DEFAULT '{}';

UPDATE notificacion_plantilla p SET variables = COALESCE((
  SELECT array_agg(DISTINCT m[1] ORDER BY m[1])
  FROM notificacion_plantilla q,
       LATERAL regexp_matches(COALESCE(q.asunto, '') || ' ' || q.cuerpo, '\{\{([a-z_]+)\}\}', 'g') AS m
  WHERE q.clave = p.clave), '{}');

INSERT INTO notificacion_plantilla (clave, canal, idioma_codigo, asunto, cuerpo, variables) VALUES
 ('prospectos_vencidos', 'correo', 'es', 'Tienes seguimientos pendientes',
  'Hola {{nombre}}, tienes {{cantidad}} prospectos con la próxima acción vencida. Entra al panel para revisarlos.',
  ARRAY['cantidad','nombre']);

CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON notificacion_plantilla
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- ---------------------------------------------------------------------
-- Enlaces de afiliado y sus clics
-- ---------------------------------------------------------------------
CREATE TABLE enlace_afiliado (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        citext NOT NULL UNIQUE CHECK (codigo ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  destino_url   text NOT NULL CHECK (destino_url ~ '^https://[^\s]+$' AND length(destino_url) <= 2000),
  socio         text NOT NULL CHECK (length(btrim(socio)) > 0 AND length(socio) <= 160),
  comision_pct  numeric(5,2) CHECK (comision_pct IS NULL OR comision_pct BETWEEN 0 AND 100),
  estado        text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','pausado')),
  negocio_id    uuid REFERENCES negocio(id) ON DELETE SET NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE enlace_afiliado IS 'Dirección corta propia (/publico/r/{codigo}) que cuenta el clic y redirige al socio. La comisión es solo informativa.';
CREATE INDEX ix_enlace_afiliado_negocio ON enlace_afiliado (negocio_id) WHERE negocio_id IS NOT NULL;

CREATE TABLE clic_afiliado (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enlace_id      uuid NOT NULL REFERENCES enlace_afiliado(id) ON DELETE CASCADE,
  dia            date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Mexico_City')::date),
  ocurrido_en    timestamptz NOT NULL DEFAULT now(),
  dispositivo_id uuid REFERENCES dispositivo(id) ON DELETE SET NULL,
  origen         text CHECK (origen IS NULL OR length(origen) <= 40)
);
COMMENT ON TABLE clic_afiliado IS 'Un renglón por clic. No guarda cuenta, IP ni ubicación.';
CREATE INDEX ix_clic_afiliado_dia ON clic_afiliado (enlace_id, dia);

SELECT crear_trigger_actualizado('enlace_afiliado'::regclass);

CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON enlace_afiliado
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();
