-- =====================================================================
-- Migración 0004: contenido editorial
-- Incluye: lugar, lugar_traduccion, lugar_medio, ruta, ruta_traduccion,
--   ruta_parada, articulo, articulo_traduccion, articulo_fuente, evento,
--   evento_traduccion, evento_negocio.
-- Desviación del documento: se agrega `articulo_traduccion` (titulo, resumen,
--   cuerpo), porque el documento no tenía dónde guardar el texto del artículo.
-- `audioguia` (N3) sigue diferida.
-- Reglas: un contenido solo puede publicarse con su traducción al español (regla 5);
--   un artículo solo se publica verificado y con al menos una fuente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Lugares y atractivos (contenido editorial, no son negocios)
-- ---------------------------------------------------------------------
CREATE TABLE lugar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id    uuid NOT NULL REFERENCES destino(id),
  municipio_id  uuid REFERENCES municipio(id),
  padre_id      uuid REFERENCES lugar(id),
  slug          text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  tipo          text NOT NULL CHECK (tipo IN
                ('arqueologico','natural','cultural','playa','mercado','templo','otro')),
  ubicacion     geography(Point, 4326),
  estado        text NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador','publicado','archivado')),
  destacado     boolean NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz,
  CHECK (padre_id IS NULL OR padre_id <> id)
);
COMMENT ON TABLE lugar IS 'Sustituye a atractivo, sitio de interés y actividad de la app anterior: un atractivo cuelga de un lugar mediante padre_id.';
CREATE UNIQUE INDEX uq_lugar_slug ON lugar (destino_id, slug) WHERE eliminado_en IS NULL;
CREATE INDEX idx_lugar_listado ON lugar (destino_id, estado, tipo) WHERE eliminado_en IS NULL;
CREATE INDEX idx_lugar_municipio ON lugar (municipio_id);
CREATE INDEX idx_lugar_padre ON lugar (padre_id);
CREATE INDEX idx_lugar_ubicacion ON lugar USING gist (ubicacion);

CREATE TABLE lugar_traduccion (
  lugar_id        uuid NOT NULL REFERENCES lugar(id) ON DELETE CASCADE,
  idioma_codigo   text NOT NULL REFERENCES idioma(codigo),
  nombre          text NOT NULL,
  resumen         text,
  historia        text,
  recomendaciones text,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lugar_id, idioma_codigo)
);
CREATE INDEX idx_lugar_trad_nombre ON lugar_traduccion USING gin (f_unaccent(nombre) gin_trgm_ops);

CREATE TABLE lugar_medio (
  lugar_id   uuid NOT NULL REFERENCES lugar(id) ON DELETE CASCADE,
  medio_id   uuid NOT NULL REFERENCES medio(id),
  orden      integer NOT NULL DEFAULT 0,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lugar_id, medio_id)
);
CREATE INDEX idx_lugar_medio_orden ON lugar_medio (lugar_id, orden);

-- ---------------------------------------------------------------------
-- Rutas [N2]
-- ---------------------------------------------------------------------
CREATE TABLE ruta (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id     uuid NOT NULL REFERENCES destino(id),
  slug           text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  duracion_horas numeric(5,1) CHECK (duracion_horas > 0),
  distancia_km   numeric(7,1) CHECK (distancia_km >= 0),
  dificultad     text CHECK (dificultad IN ('facil','moderada','dificil')),
  transporte     text CHECK (transporte IN ('a_pie','auto','bicicleta','transporte_publico','mixto')),
  es_premium     boolean NOT NULL DEFAULT false,
  estado         text NOT NULL DEFAULT 'borrador'
                 CHECK (estado IN ('borrador','publicada','archivada')),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en   timestamptz
);
CREATE UNIQUE INDEX uq_ruta_slug ON ruta (destino_id, slug) WHERE eliminado_en IS NULL;
CREATE INDEX idx_ruta_listado ON ruta (destino_id, estado) WHERE eliminado_en IS NULL;

CREATE TABLE ruta_traduccion (
  ruta_id        uuid NOT NULL REFERENCES ruta(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  nombre         text NOT NULL,
  descripcion    text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ruta_id, idioma_codigo)
);

-- Una parada apunta a exactamente una cosa: un lugar, un negocio o un punto libre.
CREATE TABLE ruta_parada (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_id            uuid NOT NULL REFERENCES ruta(id) ON DELETE CASCADE,
  orden              integer NOT NULL CHECK (orden > 0),
  lugar_id           uuid REFERENCES lugar(id),
  negocio_id         uuid REFERENCES negocio(id),
  ubicacion          geography(Point, 4326),
  minutos_estimados  integer CHECK (minutos_estimados >= 0),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruta_id, orden),
  CHECK (num_nonnulls(lugar_id, negocio_id, ubicacion) = 1)
);
CREATE INDEX idx_ruta_parada_lugar ON ruta_parada (lugar_id);
CREATE INDEX idx_ruta_parada_negocio ON ruta_parada (negocio_id);

-- ---------------------------------------------------------------------
-- Artículos de Oaxaca Explora [N2]
-- ---------------------------------------------------------------------
CREATE TABLE articulo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id     uuid NOT NULL REFERENCES destino(id),
  slug           text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  tipo           text NOT NULL CHECK (tipo IN ('articulo','video','reel','guia')),
  autor_id       uuid REFERENCES usuario(id),
  url_externa    text CHECK (url_externa ~ '^https?://\S+$'),
  estado         text NOT NULL DEFAULT 'borrador'
                 CHECK (estado IN ('borrador','verificado','publicado','archivado')),
  verificado_por uuid REFERENCES usuario(id),
  verificado_en  timestamptz,
  publicado_en   timestamptz,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en   timestamptz,
  CHECK (estado NOT IN ('verificado','publicado')
         OR (verificado_por IS NOT NULL AND verificado_en IS NOT NULL))
);
CREATE UNIQUE INDEX uq_articulo_slug ON articulo (destino_id, slug) WHERE eliminado_en IS NULL;
CREATE INDEX idx_articulo_listado ON articulo (destino_id, estado, publicado_en DESC) WHERE eliminado_en IS NULL;

CREATE TABLE articulo_traduccion (
  articulo_id    uuid NOT NULL REFERENCES articulo(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  titulo         text NOT NULL,
  resumen        text,
  cuerpo         text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (articulo_id, idioma_codigo)
);
CREATE INDEX idx_articulo_trad_busqueda ON articulo_traduccion USING gin (
  to_tsvector('spanish', f_unaccent(coalesce(titulo,'') || ' ' || coalesce(resumen,'')))
);

CREATE TABLE articulo_fuente (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id     uuid NOT NULL REFERENCES articulo(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  url             text NOT NULL CHECK (url ~ '^https?://\S+$'),
  fecha_consulta  date NOT NULL DEFAULT current_date,
  creado_en       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE articulo_fuente IS 'Cada dato publicado se respalda con una fuente; un artículo sin fuentes no puede publicarse.';
CREATE INDEX idx_articulo_fuente ON articulo_fuente (articulo_id);

-- ---------------------------------------------------------------------
-- Eventos y festividades [N2]
-- ---------------------------------------------------------------------
CREATE TABLE evento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id     uuid NOT NULL REFERENCES destino(id),
  municipio_id   uuid REFERENCES municipio(id),
  temporada_id   uuid REFERENCES temporada(id),
  slug           text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  fecha_inicio   date NOT NULL,
  fecha_fin      date NOT NULL,
  ubicacion      geography(Point, 4326),
  estado         text NOT NULL DEFAULT 'borrador'
                 CHECK (estado IN ('borrador','publicado','cancelado','archivado')),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en   timestamptz,
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE UNIQUE INDEX uq_evento_slug ON evento (destino_id, slug) WHERE eliminado_en IS NULL;
CREATE INDEX idx_evento_fechas ON evento (destino_id, estado, fecha_inicio) WHERE eliminado_en IS NULL;
CREATE INDEX idx_evento_ubicacion ON evento USING gist (ubicacion);

CREATE TABLE evento_traduccion (
  evento_id      uuid NOT NULL REFERENCES evento(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  nombre         text NOT NULL,
  descripcion    text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, idioma_codigo)
);

CREATE TABLE evento_negocio (
  evento_id   uuid NOT NULL REFERENCES evento(id) ON DELETE CASCADE,
  negocio_id  uuid NOT NULL REFERENCES negocio(id),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, negocio_id)
);
CREATE INDEX idx_evento_negocio ON evento_negocio (negocio_id);

-- ---------------------------------------------------------------------
-- Reglas de publicación
-- ---------------------------------------------------------------------
-- Regla 5: para publicar, el contenido debe tener su texto en español.
-- Argumentos del trigger: tabla de traducciones, columna que apunta al contenido,
-- columna de texto obligatorio, estados que cuentan como publicados.
CREATE OR REPLACE FUNCTION fn_exigir_traduccion_es() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tabla   text := TG_ARGV[0];
  v_fk      text := TG_ARGV[1];
  v_campo   text := TG_ARGV[2];
  v_ok      boolean;
BEGIN
  IF NEW.estado = ANY (string_to_array(TG_ARGV[3], ','))
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I WHERE %I = $1 AND idioma_codigo = ''es'' AND length(trim(coalesce(%I, ''''))) > 0)',
      v_tabla, v_fk, v_campo) INTO v_ok USING NEW.id;
    IF NOT v_ok THEN
      RAISE EXCEPTION '%.% no se puede publicar sin % en español', TG_TABLE_NAME, NEW.id, v_campo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lugar_es BEFORE INSERT OR UPDATE OF estado ON lugar
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_traduccion_es('lugar_traduccion','lugar_id','nombre','publicado');
CREATE TRIGGER trg_ruta_es BEFORE INSERT OR UPDATE OF estado ON ruta
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_traduccion_es('ruta_traduccion','ruta_id','nombre','publicada');
CREATE TRIGGER trg_articulo_es BEFORE INSERT OR UPDATE OF estado ON articulo
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_traduccion_es('articulo_traduccion','articulo_id','titulo','publicado');
CREATE TRIGGER trg_evento_es BEFORE INSERT OR UPDATE OF estado ON evento
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_traduccion_es('evento_traduccion','evento_id','nombre','publicado');

-- Un artículo se publica solo con al menos una fuente.
CREATE OR REPLACE FUNCTION fn_articulo_exigir_fuente() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'publicado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'publicado') THEN
    IF NOT EXISTS (SELECT 1 FROM articulo_fuente WHERE articulo_id = NEW.id) THEN
      RAISE EXCEPTION 'articulo % no se puede publicar sin al menos una fuente', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.publicado_en := COALESCE(NEW.publicado_en, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_articulo_fuente BEFORE INSERT OR UPDATE OF estado ON articulo
  FOR EACH ROW EXECUTE FUNCTION fn_articulo_exigir_fuente();

-- Vistas de lo que ve la app
CREATE VIEW lugar_visible    AS SELECT * FROM lugar    WHERE estado = 'publicado' AND eliminado_en IS NULL;
CREATE VIEW ruta_visible     AS SELECT * FROM ruta     WHERE estado = 'publicada' AND eliminado_en IS NULL;
CREATE VIEW articulo_visible AS SELECT * FROM articulo WHERE estado = 'publicado' AND eliminado_en IS NULL;
CREATE VIEW evento_visible   AS SELECT * FROM evento   WHERE estado = 'publicado' AND eliminado_en IS NULL;

SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'lugar','lugar_traduccion','ruta','ruta_traduccion','articulo',
  'articulo_traduccion','evento','evento_traduccion'
]) AS t;

