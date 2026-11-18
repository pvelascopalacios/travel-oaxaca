-- =====================================================================
-- Migración 0003: negocios
-- Incluye: negocio, negocio_traduccion, sucursal, contacto, horario,
--   horario_excepcion, negocio_servicio, negocio_idioma, medio, negocio_medio,
--   oferta, oferta_traduccion, revision_ficha, verificacion, reclamo_ficha,
--   membresia_negocio.
-- Las transiciones entre estados de la ficha las valida el servicio; la base
-- solo exige los requisitos de publicación (regla 3) y la integridad.
-- =====================================================================

-- Permite verificar que una localidad pertenece al municipio indicado.
ALTER TABLE localidad ADD CONSTRAINT uq_localidad_id_municipio UNIQUE (id, municipio_id);

-- unaccent no es inmutable; este envoltorio permite usarlo en índices.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

-- Mínimo de fotos para publicar. La migración 0008 la redefine para leerla
-- de la tabla `configuracion` (clave `fotos_minimas_publicar`).
CREATE OR REPLACE FUNCTION fotos_minimas_publicar() RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT 3 $$;

-- ---------------------------------------------------------------------
-- Medios (fotos, video, audio)
-- ---------------------------------------------------------------------
CREATE TABLE medio (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                   text NOT NULL CHECK (tipo IN ('imagen','video','audio')),
  clave_almacenamiento   text NOT NULL UNIQUE,
  mime                   text,
  bytes                  bigint CHECK (bytes >= 0),
  ancho                  integer CHECK (ancho > 0),
  alto                   integer CHECK (alto > 0),
  hash                   text,
  subido_por             uuid REFERENCES usuario(id),
  moderacion             text NOT NULL DEFAULT 'pendiente'
                         CHECK (moderacion IN ('pendiente','aprobado','rechazado')),
  creado_en              timestamptz NOT NULL DEFAULT now(),
  actualizado_en         timestamptz NOT NULL DEFAULT now(),
  eliminado_en           timestamptz
);
CREATE INDEX idx_medio_subido_por ON medio (subido_por);
CREATE INDEX idx_medio_moderacion ON medio (moderacion) WHERE moderacion = 'pendiente';

-- ---------------------------------------------------------------------
-- Negocio
-- ---------------------------------------------------------------------
CREATE TABLE negocio (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id        uuid NOT NULL REFERENCES destino(id),
  slug              text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  nombre_comercial  text NOT NULL,
  razon_social      text,
  categoria_id      uuid NOT NULL REFERENCES categoria(id),
  estado            text NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','en_revision','publicada','pausada','archivada')),
  rango_precio      smallint CHECK (rango_precio BETWEEN 1 AND 4),
  precio_desde      numeric(12,2) CHECK (precio_desde >= 0),
  moneda            char(3) NOT NULL DEFAULT 'MXN',
  unidad_precio     text CHECK (unidad_precio IN ('por_noche','por_persona','por_grupo')),
  atributos         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(atributos) = 'object'),
  origen_alta       text NOT NULL DEFAULT 'autoservicio'
                    CHECK (origen_alta IN ('autoservicio','asistida','importada')),
  creado_por        uuid REFERENCES usuario(id),
  publicado_en      timestamptz,
  verificado_en     timestamptz,
  verificado_por    uuid REFERENCES usuario(id),
  puntaje_ficha     smallint NOT NULL DEFAULT 0 CHECK (puntaje_ficha BETWEEN 0 AND 100),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  eliminado_en      timestamptz,
  CHECK (estado <> 'publicada' OR publicado_en IS NOT NULL)
);
COMMENT ON COLUMN negocio.categoria_id IS 'Preferir una subcategoría (p. ej. posada) sobre la categoría raíz.';
COMMENT ON COLUMN negocio.atributos IS 'Datos propios de la categoría (hora de check-in, capacidad...). La app los valida por categoría.';
COMMENT ON COLUMN negocio.puntaje_ficha IS 'Completitud de la ficha (0 a 100); lo calcula el servicio.';
CREATE UNIQUE INDEX uq_negocio_slug ON negocio (destino_id, slug) WHERE eliminado_en IS NULL;
CREATE INDEX idx_negocio_listado ON negocio (destino_id, estado, categoria_id) WHERE eliminado_en IS NULL;
CREATE INDEX idx_negocio_creado_por ON negocio (creado_por);
CREATE INDEX idx_negocio_nombre_trgm ON negocio USING gin (f_unaccent(nombre_comercial) gin_trgm_ops);

CREATE TABLE negocio_traduccion (
  negocio_id         uuid NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  idioma_codigo      text NOT NULL REFERENCES idioma(codigo),
  descripcion_corta  text CHECK (char_length(descripcion_corta) <= 160),
  descripcion        text,
  politicas          text,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  actualizado_en     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, idioma_codigo)
);
CREATE INDEX idx_negocio_trad_busqueda ON negocio_traduccion USING gin (
  to_tsvector('spanish', f_unaccent(coalesce(descripcion_corta,'') || ' ' || coalesce(descripcion,'')))
);

-- ---------------------------------------------------------------------
-- Sucursal: aquí vive la ubicación
-- ---------------------------------------------------------------------
CREATE TABLE sucursal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  nombre          text,
  es_principal    boolean NOT NULL DEFAULT false,
  municipio_id    uuid NOT NULL REFERENCES municipio(id),
  localidad_id    uuid,
  direccion_texto text,
  referencia      text,
  ubicacion       geography(Point, 4326),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  eliminado_en    timestamptz,
  UNIQUE (id, negocio_id),
  FOREIGN KEY (localidad_id, municipio_id) REFERENCES localidad (id, municipio_id)
);
CREATE UNIQUE INDEX uq_sucursal_principal ON sucursal (negocio_id)
  WHERE es_principal AND eliminado_en IS NULL;
CREATE INDEX idx_sucursal_negocio ON sucursal (negocio_id);
CREATE INDEX idx_sucursal_municipio ON sucursal (municipio_id);
CREATE INDEX idx_sucursal_ubicacion ON sucursal USING gist (ubicacion);

-- ---------------------------------------------------------------------
-- Contactos
-- ---------------------------------------------------------------------
CREATE TABLE contacto (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid NOT NULL REFERENCES negocio(id),
  sucursal_id    uuid,
  tipo           text NOT NULL CHECK (tipo IN
                 ('whatsapp','telefono','correo','web','facebook','instagram','tiktok','reservas_url')),
  valor          text NOT NULL,
  es_principal   boolean NOT NULL DEFAULT false,
  verificado_en  timestamptz,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en   timestamptz,
  FOREIGN KEY (sucursal_id, negocio_id) REFERENCES sucursal (id, negocio_id),
  CHECK (CASE
    WHEN tipo IN ('whatsapp','telefono') THEN valor ~ '^\+[1-9][0-9]{7,14}$'
    WHEN tipo = 'correo' THEN valor ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    ELSE valor ~ '^https?://\S+$'
  END)
);
COMMENT ON COLUMN contacto.valor IS 'WhatsApp y teléfono en formato E.164 (+52...); correo; el resto como URL completa.';
CREATE UNIQUE INDEX uq_contacto_principal ON contacto (negocio_id, tipo)
  WHERE es_principal AND eliminado_en IS NULL;
CREATE INDEX idx_contacto_negocio ON contacto (negocio_id) WHERE eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Horarios (dia_semana: 0 = domingo ... 6 = sábado, como extract(dow))
-- ---------------------------------------------------------------------
CREATE TABLE horario (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id  uuid NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
  dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  abre         time,
  cierra       time,
  cerrado      boolean NOT NULL DEFAULT false,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (cerrado OR (abre IS NOT NULL AND cierra IS NOT NULL))
);
COMMENT ON TABLE horario IS 'Un día puede tener varias filas (horario partido). Si cierra < abre, cierra después de medianoche.';
CREATE INDEX idx_horario_sucursal ON horario (sucursal_id, dia_semana);

CREATE TABLE horario_excepcion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id  uuid NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
  fecha        date NOT NULL,
  abre         time,
  cierra       time,
  cerrado      boolean NOT NULL DEFAULT false,
  nota         text,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (cerrado OR (abre IS NOT NULL AND cierra IS NOT NULL))
);
CREATE INDEX idx_horario_exc_sucursal ON horario_excepcion (sucursal_id, fecha);

-- ---------------------------------------------------------------------
-- Servicios e idiomas que ofrece el negocio
-- ---------------------------------------------------------------------
CREATE TABLE negocio_servicio (
  negocio_id   uuid NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  servicio_id  uuid NOT NULL REFERENCES servicio(id),
  creado_en    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, servicio_id)
);
CREATE INDEX idx_negocio_servicio_servicio ON negocio_servicio (servicio_id);

CREATE TABLE negocio_idioma (
  negocio_id     uuid NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  nivel          text NOT NULL DEFAULT 'fluido' CHECK (nivel IN ('basico','fluido')),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, idioma_codigo)
);

-- ---------------------------------------------------------------------
-- Medios del negocio
-- ---------------------------------------------------------------------
CREATE TABLE negocio_medio (
  negocio_id   uuid NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  medio_id     uuid NOT NULL REFERENCES medio(id),
  orden        integer NOT NULL DEFAULT 0,
  es_portada   boolean NOT NULL DEFAULT false,
  pie_texto    text,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, medio_id)
);
CREATE UNIQUE INDEX uq_negocio_portada ON negocio_medio (negocio_id) WHERE es_portada;
CREATE INDEX idx_negocio_medio_orden ON negocio_medio (negocio_id, orden);

-- ---------------------------------------------------------------------
-- Ofertas (servicios con precio propio) [se activan en el Nivel 2]
-- ---------------------------------------------------------------------
CREATE TABLE oferta (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid NOT NULL REFERENCES negocio(id),
  tipo           text NOT NULL CHECK (tipo IN ('habitacion','tour','platillo','producto','experiencia')),
  estado         text NOT NULL DEFAULT 'borrador'
                 CHECK (estado IN ('borrador','publicada','pausada','archivada')),
  precio_desde   numeric(12,2) CHECK (precio_desde >= 0),
  moneda         char(3) NOT NULL DEFAULT 'MXN',
  unidad_precio  text CHECK (unidad_precio IN ('por_noche','por_persona','por_grupo','por_pieza')),
  duracion_min   integer CHECK (duracion_min > 0),
  capacidad      integer CHECK (capacidad > 0),
  orden          integer NOT NULL DEFAULT 0,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en   timestamptz
);
CREATE INDEX idx_oferta_negocio ON oferta (negocio_id, estado) WHERE eliminado_en IS NULL;

CREATE TABLE oferta_traduccion (
  oferta_id      uuid NOT NULL REFERENCES oferta(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  nombre         text NOT NULL,
  descripcion    text,
  incluye        text,
  no_incluye     text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (oferta_id, idioma_codigo)
);

-- ---------------------------------------------------------------------
-- Revisión de fichas
-- ---------------------------------------------------------------------
CREATE TABLE revision_ficha (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  version         integer NOT NULL,
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','aprobada','rechazada')),
  enviada_por     uuid REFERENCES usuario(id),
  revisada_por    uuid REFERENCES usuario(id),
  motivo_rechazo  text,
  cambios         jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviada_en      timestamptz NOT NULL DEFAULT now(),
  resuelta_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, version),
  CHECK (
    (estado = 'pendiente' AND resuelta_en IS NULL)
    OR (estado <> 'pendiente' AND resuelta_en IS NOT NULL AND revisada_por IS NOT NULL)
  ),
  CHECK (estado <> 'rechazada' OR motivo_rechazo IS NOT NULL)
);
COMMENT ON COLUMN revision_ficha.cambios IS 'Por campo: {"nombre_comercial": {"antes": "...", "despues": "..."}}';
CREATE UNIQUE INDEX uq_revision_pendiente ON revision_ficha (negocio_id) WHERE estado = 'pendiente';

CREATE OR REPLACE FUNCTION fn_revision_asignar_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version IS NULL OR NEW.version = 0 THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
    FROM revision_ficha WHERE negocio_id = NEW.negocio_id;
  END IF;
  RETURN NEW;
END $$;
-- La columna es NOT NULL, así que se acepta 0 como "asignar automáticamente".
CREATE TRIGGER trg_revision_version BEFORE INSERT ON revision_ficha
  FOR EACH ROW EXECUTE FUNCTION fn_revision_asignar_version();

-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
CREATE TABLE verificacion (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id         uuid NOT NULL REFERENCES negocio(id),
  metodo             text NOT NULL CHECK (metodo IN ('whatsapp','llamada','visita','documento')),
  resultado          text NOT NULL CHECK (resultado IN ('aprobada','rechazada')),
  evidencia_medio_id uuid REFERENCES medio(id),
  verificada_por     uuid NOT NULL REFERENCES usuario(id),
  notas              text,
  fecha              timestamptz NOT NULL DEFAULT now(),
  vigente_hasta      timestamptz,
  creado_en          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_verificacion_negocio ON verificacion (negocio_id, fecha DESC);

-- Mantiene `negocio.verificado_en` y `verificado_por` al aprobar una verificación.
CREATE OR REPLACE FUNCTION fn_verificacion_sincronizar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.resultado = 'aprobada' THEN
    UPDATE negocio SET verificado_en = NEW.fecha, verificado_por = NEW.verificada_por
    WHERE id = NEW.negocio_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_verificacion_sincronizar AFTER INSERT ON verificacion
  FOR EACH ROW EXECUTE FUNCTION fn_verificacion_sincronizar();

-- ---------------------------------------------------------------------
-- Reclamo de ficha (alta asistida)
-- ---------------------------------------------------------------------
CREATE TABLE reclamo_ficha (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  usuario_id      uuid NOT NULL REFERENCES usuario(id),
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','aprobado','rechazado','expirado')),
  hash_codigo     text NOT NULL,
  intentos        smallint NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  expira_en       timestamptz NOT NULL,
  resuelto_por    uuid REFERENCES usuario(id),
  resuelto_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_reclamo_pendiente ON reclamo_ficha (negocio_id, usuario_id) WHERE estado = 'pendiente';

-- ---------------------------------------------------------------------
-- Membresía: quién administra cada negocio
-- ---------------------------------------------------------------------
CREATE TABLE membresia_negocio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  usuario_id      uuid NOT NULL REFERENCES usuario(id),
  rol             text NOT NULL CHECK (rol IN ('propietario','colaborador')),
  estado          text NOT NULL DEFAULT 'invitada' CHECK (estado IN ('invitada','activa','revocada')),
  invitado_por    uuid REFERENCES usuario(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, usuario_id)
);
CREATE UNIQUE INDEX uq_membresia_propietario ON membresia_negocio (negocio_id)
  WHERE rol = 'propietario' AND estado = 'activa';
CREATE INDEX idx_membresia_usuario ON membresia_negocio (usuario_id) WHERE estado = 'activa';

-- ---------------------------------------------------------------------
-- Requisitos de publicación (regla 3)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION negocio_faltantes_publicacion(p_negocio uuid) RETURNS text[]
LANGUAGE plpgsql STABLE AS $$
DECLARE f text[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sucursal s
                 WHERE s.negocio_id = p_negocio AND s.es_principal
                   AND s.eliminado_en IS NULL AND s.ubicacion IS NOT NULL) THEN
    f := array_append(f, 'sucursal_principal_con_ubicacion');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacto c
                 WHERE c.negocio_id = p_negocio AND c.tipo IN ('whatsapp','telefono')
                   AND c.eliminado_en IS NULL) THEN
    f := array_append(f, 'contacto_whatsapp_o_telefono');
  END IF;
  IF (SELECT count(*) FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
      WHERE nm.negocio_id = p_negocio AND m.tipo = 'imagen'
        AND m.moderacion = 'aprobado' AND m.eliminado_en IS NULL) < fotos_minimas_publicar() THEN
    f := array_append(f, 'fotos_minimas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM negocio_traduccion t
                 WHERE t.negocio_id = p_negocio AND t.idioma_codigo = 'es'
                   AND length(trim(coalesce(t.descripcion_corta, ''))) > 0) THEN
    f := array_append(f, 'descripcion_es');
  END IF;
  RETURN f;
END $$;

CREATE OR REPLACE FUNCTION puede_publicar(p_negocio uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT cardinality(negocio_faltantes_publicacion(p_negocio)) = 0 $$;

CREATE OR REPLACE FUNCTION fn_negocio_validar_publicacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE f text[];
BEGIN
  IF NEW.estado = 'publicada' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'publicada') THEN
    f := negocio_faltantes_publicacion(NEW.id);
    IF cardinality(f) > 0 THEN
      RAISE EXCEPTION 'No se puede publicar el negocio %: faltan %', NEW.id, array_to_string(f, ', ')
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.publicado_en := COALESCE(NEW.publicado_en, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_negocio_publicacion BEFORE INSERT OR UPDATE OF estado ON negocio
  FOR EACH ROW EXECUTE FUNCTION fn_negocio_validar_publicacion();

-- Lo que ve la app: fichas publicadas y no eliminadas (regla 4).
CREATE VIEW negocio_visible AS
  SELECT * FROM negocio WHERE estado = 'publicada' AND eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Triggers de `actualizado_en`
-- ---------------------------------------------------------------------
SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'medio','negocio','negocio_traduccion','sucursal','contacto','horario',
  'horario_excepcion','oferta','oferta_traduccion','revision_ficha',
  'reclamo_ficha','membresia_negocio'
]) AS t;

