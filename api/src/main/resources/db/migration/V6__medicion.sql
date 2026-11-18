-- =====================================================================
-- Migración 0006: medición
-- Incluye: origen, campana_origen, evento_uso (particionada por mes),
--   resumen_diario, reporte_mensual (inmutable) y las funciones para registrar
--   eventos, calcular resúmenes, mantener particiones y generar reportes.
-- Reglas: 11 (medición anónima con origen), 12 (una vista por dispositivo, negocio
--   y día; los contactos se cuentan siempre) y 13 (el reporte mensual no cambia).
-- Desviaciones del documento:
--   * `evento_uso` tiene clave primaria (id, dia) porque PostgreSQL exige incluir
--     la columna de partición.
--   * `negocio_id` es obligatorio en `evento_uso`.
--   * Un reporte mensual admite fijar `medio_id` (el PDF) una sola vez, además de
--     `enviado_en`: el PDF se genera después de calcular los datos.
-- =====================================================================

CREATE TABLE origen (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave   text NOT NULL UNIQUE CHECK (clave ~ '^[a-z_]+$'),
  nombre  text NOT NULL,
  activo  boolean NOT NULL DEFAULT true
);

CREATE TABLE campana_origen (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_id   uuid NOT NULL REFERENCES origen(id),
  codigo      text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z0-9_-]{2,40}$'),
  nombre      text NOT NULL,
  inicio      date,
  fin         date,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fin IS NULL OR inicio IS NULL OR fin >= inicio)
);
COMMENT ON COLUMN campana_origen.codigo IS 'Va como parámetro en el enlace (p. ej. ?o=reel-chatinos) para saber qué Reel o publicación trajo al turista.';
CREATE INDEX idx_campana_origen ON campana_origen (origen_id);

-- ---------------------------------------------------------------------
-- Eventos de uso, particionados por mes sobre `dia`
-- ---------------------------------------------------------------------
CREATE TABLE evento_uso (
  id              bigint GENERATED ALWAYS AS IDENTITY,
  dia             date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Mexico_City')::date),
  ocurrido_en     timestamptz NOT NULL DEFAULT now(),
  tipo            text NOT NULL CHECK (tipo IN
                  ('vista_ficha','toque_whatsapp','llamada','como_llegar','guardado','compartido',
                   'clic_web','impresion_destacado','clic_destacado','clic_afiliado')),
  destino_id      uuid NOT NULL REFERENCES destino(id),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  sucursal_id     uuid REFERENCES sucursal(id),
  oferta_id       uuid REFERENCES oferta(id),
  dispositivo_id  uuid NOT NULL REFERENCES dispositivo(id),
  usuario_id      uuid REFERENCES usuario(id) ON DELETE SET NULL,
  origen_id       uuid NOT NULL REFERENCES origen(id),
  campana_id      uuid REFERENCES campana_origen(id),
  es_patrocinado  boolean NOT NULL DEFAULT false,
  plataforma      text CHECK (plataforma IN ('android','ios','web')),
  PRIMARY KEY (id, dia),
  CHECK (abs(dia - (ocurrido_en AT TIME ZONE 'UTC')::date) <= 1)
) PARTITION BY RANGE (dia);
COMMENT ON TABLE evento_uso IS
  'Una fila por vista o contacto, sin pedir cuenta. es_patrocinado guarda el estado de la ficha en ese momento. Las particiones antiguas se archivan (DETACH) en vez de borrarse.';

-- Regla 12: una vista por dispositivo, negocio y día. Los contactos no se deduplican.
CREATE UNIQUE INDEX uq_evento_vista_dia ON evento_uso (dia, negocio_id, dispositivo_id)
  WHERE tipo = 'vista_ficha';
CREATE INDEX idx_evento_negocio_dia ON evento_uso (negocio_id, dia, tipo);
CREATE INDEX idx_evento_campana ON evento_uso (campana_id) WHERE campana_id IS NOT NULL;
CREATE INDEX idx_evento_dispositivo ON evento_uso (dispositivo_id, dia);

CREATE TABLE evento_uso_default PARTITION OF evento_uso DEFAULT;
COMMENT ON TABLE evento_uso_default IS 'Red de seguridad: recibe eventos de meses sin partición para no perderlos. Debe estar vacía; si no, hay que crear la partición faltante.';

CREATE OR REPLACE FUNCTION crear_particion_evento_uso(p_mes date) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_nombre text := 'evento_uso_' || to_char(v_ini, 'YYYY_MM');
BEGIN
  IF to_regclass(v_nombre) IS NULL THEN
    EXECUTE format('CREATE TABLE %I PARTITION OF evento_uso FOR VALUES FROM (%L) TO (%L)',
                   v_nombre, v_ini, v_fin);
  END IF;
  RETURN v_nombre;
END $$;

-- Para correr cada mes desde el programador de tareas.
CREATE OR REPLACE FUNCTION asegurar_particiones_evento_uso(p_meses_adelante integer DEFAULT 3) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE i integer;
BEGIN
  FOR i IN 0..p_meses_adelante LOOP
    PERFORM crear_particion_evento_uso((date_trunc('month', now()) + make_interval(months => i))::date);
  END LOOP;
  RETURN p_meses_adelante + 1;
END $$;

-- Particiones iniciales: enero 2026 a diciembre 2028.
DO $$
DECLARE m date := date '2026-01-01';
BEGIN
  WHILE m <= date '2028-12-01' LOOP
    PERFORM crear_particion_evento_uso(m);
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Totales diarios y reporte mensual
-- ---------------------------------------------------------------------
CREATE TABLE resumen_diario (
  dia         date NOT NULL,
  negocio_id  uuid NOT NULL REFERENCES negocio(id),
  origen_id   uuid NOT NULL REFERENCES origen(id),
  tipo        text NOT NULL,
  total       integer NOT NULL CHECK (total >= 0),
  unicos      integer NOT NULL CHECK (unicos >= 0),
  PRIMARY KEY (dia, negocio_id, origen_id, tipo),
  CHECK (unicos <= total)
);
CREATE INDEX idx_resumen_negocio_dia ON resumen_diario (negocio_id, dia);

CREATE TABLE reporte_mensual (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   uuid NOT NULL REFERENCES negocio(id),
  anio         smallint NOT NULL CHECK (anio BETWEEN 2024 AND 2100),
  mes          smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  generado_en  timestamptz NOT NULL DEFAULT now(),
  datos        jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
  medio_id     uuid REFERENCES medio(id),
  enviado_en   timestamptz,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, anio, mes)
);
COMMENT ON TABLE reporte_mensual IS 'Inmutable (regla 13): solo se pueden fijar medio_id (una vez) y enviado_en.';

CREATE OR REPLACE FUNCTION fn_reporte_mensual_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un reporte mensual no se puede borrar' USING ERRCODE = 'check_violation';
  END IF;
  IF (OLD.id, OLD.negocio_id, OLD.anio, OLD.mes, OLD.generado_en, OLD.datos, OLD.creado_en)
     IS DISTINCT FROM (NEW.id, NEW.negocio_id, NEW.anio, NEW.mes, NEW.generado_en, NEW.datos, NEW.creado_en) THEN
    RAISE EXCEPTION 'Un reporte mensual no se puede modificar' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.medio_id IS NOT NULL AND NEW.medio_id IS DISTINCT FROM OLD.medio_id THEN
    RAISE EXCEPTION 'El archivo del reporte ya fue fijado' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reporte_mensual_inmutable BEFORE UPDATE OR DELETE ON reporte_mensual
  FOR EACH ROW EXECUTE FUNCTION fn_reporte_mensual_inmutable();

-- ---------------------------------------------------------------------
-- Funciones de operación
-- ---------------------------------------------------------------------
-- Qué acciones cuentan como "contacto recibido" en el reporte.
CREATE OR REPLACE FUNCTION tipos_contacto() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY['toque_whatsapp','llamada','como_llegar','guardado'] $$;

-- Registra una vista o un contacto. Devuelve false si era una vista repetida (regla 12).
CREATE OR REPLACE FUNCTION registrar_evento_uso(
  p_tipo text, p_negocio uuid, p_dispositivo uuid,
  p_origen text DEFAULT 'app', p_campana text DEFAULT NULL,
  p_usuario uuid DEFAULT NULL, p_sucursal uuid DEFAULT NULL, p_oferta uuid DEFAULT NULL,
  p_plataforma text DEFAULT NULL, p_es_patrocinado boolean DEFAULT false,
  p_ocurrido_en timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_destino uuid; v_zona text; v_origen uuid; v_campana uuid; v_plat text; n integer;
BEGIN
  SELECT n.destino_id, d.zona_horaria INTO v_destino, v_zona
  FROM negocio n JOIN destino d ON d.id = n.destino_id WHERE n.id = p_negocio;
  IF v_destino IS NULL THEN RAISE EXCEPTION 'Negocio % no existe', p_negocio; END IF;

  SELECT id INTO v_origen FROM origen WHERE clave = p_origen AND activo;
  IF v_origen IS NULL THEN
    SELECT id INTO v_origen FROM origen WHERE clave = 'otro';
  END IF;
  IF p_campana IS NOT NULL THEN
    SELECT id INTO v_campana FROM campana_origen WHERE codigo = p_campana;  -- código viejo o desconocido: se ignora
  END IF;
  v_plat := COALESCE(p_plataforma, (SELECT plataforma FROM dispositivo WHERE id = p_dispositivo));

  INSERT INTO evento_uso (dia, ocurrido_en, tipo, destino_id, negocio_id, sucursal_id, oferta_id,
                          dispositivo_id, usuario_id, origen_id, campana_id, es_patrocinado, plataforma)
  VALUES ((p_ocurrido_en AT TIME ZONE v_zona)::date, p_ocurrido_en, p_tipo, v_destino, p_negocio,
          p_sucursal, p_oferta, p_dispositivo, p_usuario, v_origen, v_campana, p_es_patrocinado, v_plat)
  ON CONFLICT (dia, negocio_id, dispositivo_id) WHERE tipo = 'vista_ficha' DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- Recalcula los totales de un día (idempotente). Sin negocio, recalcula todos.
CREATE OR REPLACE FUNCTION calcular_resumen_diario(p_dia date, p_negocio uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM resumen_diario WHERE dia = p_dia AND (p_negocio IS NULL OR negocio_id = p_negocio);
  INSERT INTO resumen_diario (dia, negocio_id, origen_id, tipo, total, unicos)
  SELECT dia, negocio_id, origen_id, tipo, count(*), count(DISTINCT dispositivo_id)
  FROM evento_uso
  WHERE dia = p_dia AND (p_negocio IS NULL OR negocio_id = p_negocio)
  GROUP BY dia, negocio_id, origen_id, tipo;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Genera el reporte de un mes terminado. Falla si el mes no acabó o si ya existe.
CREATE OR REPLACE FUNCTION generar_reporte_mensual(p_negocio uuid, p_anio integer, p_mes integer) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_ini date := make_date(p_anio, p_mes, 1);
  v_fin date := (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date;
  v_zona text; v_hoy date; d date; v_datos jsonb; v_contactos integer; v_id uuid;
BEGIN
  SELECT dest.zona_horaria INTO v_zona
  FROM negocio n JOIN destino dest ON dest.id = n.destino_id WHERE n.id = p_negocio;
  IF v_zona IS NULL THEN RAISE EXCEPTION 'Negocio % no existe', p_negocio; END IF;
  v_hoy := (now() AT TIME ZONE v_zona)::date;
  IF v_hoy <= v_fin THEN
    RAISE EXCEPTION 'El mes %-% aún no termina', p_anio, lpad(p_mes::text, 2, '0') USING ERRCODE = 'check_violation';
  END IF;

  FOR d IN SELECT generate_series(v_ini, v_fin, interval '1 day')::date LOOP
    PERFORM calcular_resumen_diario(d, p_negocio);
  END LOOP;

  SELECT COALESCE(sum(total), 0) INTO v_contactos
  FROM resumen_diario
  WHERE negocio_id = p_negocio AND dia BETWEEN v_ini AND v_fin AND tipo = ANY (tipos_contacto());

  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('anio', p_anio, 'mes', p_mes, 'desde', v_ini, 'hasta', v_fin),
    'contactos_totales', v_contactos,
    'por_tipo', COALESCE((
       SELECT jsonb_object_agg(tipo, total)
       FROM (SELECT tipo, sum(total)::integer AS total FROM resumen_diario
             WHERE negocio_id = p_negocio AND dia BETWEEN v_ini AND v_fin GROUP BY tipo) t), '{}'::jsonb),
    'por_origen', COALESCE((
       SELECT jsonb_object_agg(clave, jsonb_build_object(
                'contactos', contactos, 'vistas', vistas,
                'pct_contactos', CASE WHEN v_contactos > 0 THEN round(100.0 * contactos / v_contactos, 1) ELSE 0 END))
       FROM (SELECT o.clave,
                    COALESCE(sum(r.total) FILTER (WHERE r.tipo = ANY (tipos_contacto())), 0)::integer AS contactos,
                    COALESCE(sum(r.total) FILTER (WHERE r.tipo = 'vista_ficha'), 0)::integer AS vistas
             FROM resumen_diario r JOIN origen o ON o.id = r.origen_id
             WHERE r.negocio_id = p_negocio AND r.dia BETWEEN v_ini AND v_fin
             GROUP BY o.clave) x), '{}'::jsonb)
  ) INTO v_datos;

  INSERT INTO reporte_mensual (negocio_id, anio, mes, datos)
  VALUES (p_negocio, p_anio, p_mes, v_datos)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

SELECT crear_trigger_actualizado('campana_origen'::regclass);

INSERT INTO origen (clave, nombre) VALUES
  ('app','Travel Oaxaca (app)'),
  ('oaxaca_explora','Oaxaca Explora'),
  ('enlace_directo','Enlace directo'),
  ('compartido','Ficha compartida'),
  ('afiliado','Afiliados'),
  ('otro','Otro');

