-- =====================================================================
-- Migración 0005: turista
-- Incluye: favorito, lista, lista_item, resena, respuesta_resena, resena_medio,
--   comentario, reaccion, reporte_ficha, reporte_contenido, busqueda_log.
-- Desviaciones del documento:
--   * `resena` lleva `eliminado_en` (regla 15: una reseña por usuario y negocio
--     mientras no esté eliminada).
--   * `reporte_ficha` y `reporte_contenido` exigen usuario o dispositivo (al menos uno).
--   * `busqueda_log` usa bigint autogenerado (por volumen) y no uuid.
--   * Los comentarios permiten un solo nivel de respuestas.
-- =====================================================================

-- Máximo de fotos por reseña. La migración 0008 la redefine para leerla de
-- `configuracion` (clave `fotos_max_resena`).
CREATE OR REPLACE FUNCTION fotos_max_resena() RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT 3 $$;

-- ---------------------------------------------------------------------
-- Favoritos (privados) y listas o itinerarios
-- ---------------------------------------------------------------------
CREATE TABLE favorito (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  negocio_id  uuid REFERENCES negocio(id),
  lugar_id    uuid REFERENCES lugar(id),
  ruta_id     uuid REFERENCES ruta(id),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(negocio_id, lugar_id, ruta_id) = 1)
);
CREATE UNIQUE INDEX uq_favorito_negocio ON favorito (usuario_id, negocio_id) WHERE negocio_id IS NOT NULL;
CREATE UNIQUE INDEX uq_favorito_lugar   ON favorito (usuario_id, lugar_id)   WHERE lugar_id IS NOT NULL;
CREATE UNIQUE INDEX uq_favorito_ruta    ON favorito (usuario_id, ruta_id)    WHERE ruta_id IS NOT NULL;
CREATE INDEX idx_favorito_usuario ON favorito (usuario_id, creado_en DESC);

CREATE TABLE lista (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  es_itinerario boolean NOT NULL DEFAULT false,
  fecha_inicio  date,
  fecha_fin     date,
  publica       boolean NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz,
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_lista_usuario ON lista (usuario_id) WHERE eliminado_en IS NULL;

CREATE TABLE lista_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id    uuid NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  negocio_id  uuid REFERENCES negocio(id),
  lugar_id    uuid REFERENCES lugar(id),
  ruta_id     uuid REFERENCES ruta(id),
  dia         integer CHECK (dia > 0),
  orden       integer NOT NULL DEFAULT 0,
  nota        text,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(negocio_id, lugar_id, ruta_id) = 1)
);
CREATE INDEX idx_lista_item_lista ON lista_item (lista_id, dia, orden);

-- ---------------------------------------------------------------------
-- Reseñas [N2]
-- ---------------------------------------------------------------------
CREATE TABLE resena (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    uuid NOT NULL REFERENCES negocio(id),
  usuario_id    uuid NOT NULL REFERENCES usuario(id),
  calificacion  smallint NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  titulo        text,
  texto         text,
  fecha_visita  date,
  idioma_codigo text REFERENCES idioma(codigo),
  estado        text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','publicada','rechazada','oculta')),
  moderada_por  uuid REFERENCES usuario(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz,
  CHECK (estado = 'pendiente' OR moderada_por IS NOT NULL),
  CHECK (fecha_visita IS NULL OR fecha_visita <= current_date + 1)
);
CREATE UNIQUE INDEX uq_resena_usuario_negocio ON resena (negocio_id, usuario_id) WHERE eliminado_en IS NULL;
CREATE INDEX idx_resena_negocio ON resena (negocio_id, estado, creado_en DESC) WHERE eliminado_en IS NULL;
CREATE INDEX idx_resena_usuario ON resena (usuario_id);

-- Un dueño o colaborador no puede reseñar su propio negocio.
CREATE OR REPLACE FUNCTION fn_resena_no_propia() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM membresia_negocio m
             WHERE m.negocio_id = NEW.negocio_id AND m.usuario_id = NEW.usuario_id
               AND m.estado = 'activa') THEN
    RAISE EXCEPTION 'Quien administra un negocio no puede reseñarlo' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_resena_no_propia BEFORE INSERT ON resena
  FOR EACH ROW EXECUTE FUNCTION fn_resena_no_propia();

CREATE TABLE respuesta_resena (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resena_id   uuid NOT NULL UNIQUE REFERENCES resena(id),
  usuario_id  uuid NOT NULL REFERENCES usuario(id),
  texto       text NOT NULL CHECK (length(trim(texto)) > 0),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE respuesta_resena IS 'El dueño puede responder, no borrar la reseña (regla 15). Sin eliminado_en a propósito: la respuesta se edita.';

-- Solo quien administra el negocio puede responder, y solo a reseñas publicadas.
CREATE OR REPLACE FUNCTION fn_respuesta_valida() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r resena%ROWTYPE;
BEGIN
  SELECT * INTO r FROM resena WHERE id = NEW.resena_id;
  IF r.estado <> 'publicada' OR r.eliminado_en IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se responde a reseñas publicadas' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM membresia_negocio m
                 WHERE m.negocio_id = r.negocio_id AND m.usuario_id = NEW.usuario_id
                   AND m.estado = 'activa') THEN
    RAISE EXCEPTION 'Solo quien administra el negocio puede responder' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_respuesta_valida BEFORE INSERT ON respuesta_resena
  FOR EACH ROW EXECUTE FUNCTION fn_respuesta_valida();

CREATE TABLE resena_medio (
  resena_id  uuid NOT NULL REFERENCES resena(id) ON DELETE CASCADE,
  medio_id   uuid NOT NULL REFERENCES medio(id),
  orden      integer NOT NULL DEFAULT 0,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resena_id, medio_id)
);
COMMENT ON TABLE resena_medio IS 'Fotos de turistas. El medio nace con moderacion = pendiente y solo se muestra al aprobarse. El servicio debe borrar los metadatos de la imagen (p. ej. la ubicación del teléfono) al subirla.';

CREATE OR REPLACE FUNCTION fn_resena_medio_limite() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM medio WHERE id = NEW.medio_id AND tipo = 'imagen') THEN
    RAISE EXCEPTION 'Las reseñas solo admiten imágenes' USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT count(*) FROM resena_medio WHERE resena_id = NEW.resena_id) >= fotos_max_resena() THEN
    RAISE EXCEPTION 'Una reseña admite máximo % fotos', fotos_max_resena() USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_resena_medio_limite BEFORE INSERT ON resena_medio
  FOR EACH ROW EXECUTE FUNCTION fn_resena_medio_limite();

CREATE VIEW resena_visible AS
  SELECT * FROM resena WHERE estado = 'publicada' AND eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Comentarios sobre lugares, rutas, artículos y eventos [N2]
-- ---------------------------------------------------------------------
CREATE TABLE comentario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuario(id),
  lugar_id      uuid REFERENCES lugar(id),
  ruta_id       uuid REFERENCES ruta(id),
  articulo_id   uuid REFERENCES articulo(id),
  evento_id     uuid REFERENCES evento(id),
  padre_id      uuid REFERENCES comentario(id),
  texto         text NOT NULL CHECK (length(trim(texto)) > 0),
  idioma_codigo text REFERENCES idioma(codigo),
  estado        text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','publicado','oculto','rechazado')),
  moderado_por  uuid REFERENCES usuario(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz,
  CHECK (num_nonnulls(lugar_id, ruta_id, articulo_id, evento_id) = 1),
  CHECK (padre_id IS NULL OR padre_id <> id),
  CHECK (estado = 'pendiente' OR moderado_por IS NOT NULL)
);
CREATE INDEX idx_comentario_lugar    ON comentario (lugar_id, creado_en)    WHERE lugar_id IS NOT NULL AND eliminado_en IS NULL;
CREATE INDEX idx_comentario_ruta     ON comentario (ruta_id, creado_en)     WHERE ruta_id IS NOT NULL AND eliminado_en IS NULL;
CREATE INDEX idx_comentario_articulo ON comentario (articulo_id, creado_en) WHERE articulo_id IS NOT NULL AND eliminado_en IS NULL;
CREATE INDEX idx_comentario_evento   ON comentario (evento_id, creado_en)   WHERE evento_id IS NOT NULL AND eliminado_en IS NULL;
CREATE INDEX idx_comentario_padre    ON comentario (padre_id);
CREATE INDEX idx_comentario_usuario  ON comentario (usuario_id);

-- Una respuesta cuelga del mismo contenido que su comentario padre, y solo un nivel.
CREATE OR REPLACE FUNCTION fn_comentario_padre() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p comentario%ROWTYPE;
BEGIN
  IF NEW.padre_id IS NOT NULL THEN
    SELECT * INTO p FROM comentario WHERE id = NEW.padre_id;
    IF p.padre_id IS NOT NULL THEN
      RAISE EXCEPTION 'Los comentarios admiten un solo nivel de respuestas' USING ERRCODE = 'check_violation';
    END IF;
    IF ROW(p.lugar_id, p.ruta_id, p.articulo_id, p.evento_id)
       IS DISTINCT FROM ROW(NEW.lugar_id, NEW.ruta_id, NEW.articulo_id, NEW.evento_id) THEN
      RAISE EXCEPTION 'La respuesta debe ser sobre el mismo contenido que el comentario padre' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_comentario_padre BEFORE INSERT OR UPDATE OF padre_id ON comentario
  FOR EACH ROW EXECUTE FUNCTION fn_comentario_padre();

CREATE VIEW comentario_visible AS
  SELECT * FROM comentario WHERE estado = 'publicado' AND eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Reacciones públicas (distintas de guardar un favorito, que es privado)
-- ---------------------------------------------------------------------
CREATE TABLE reaccion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('me_gusta','util')),
  negocio_id    uuid REFERENCES negocio(id),
  lugar_id      uuid REFERENCES lugar(id),
  resena_id     uuid REFERENCES resena(id),
  comentario_id uuid REFERENCES comentario(id),
  articulo_id   uuid REFERENCES articulo(id),
  medio_id      uuid REFERENCES medio(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(negocio_id, lugar_id, resena_id, comentario_id, articulo_id, medio_id) = 1)
);
CREATE UNIQUE INDEX uq_reaccion_negocio    ON reaccion (usuario_id, tipo, negocio_id)    WHERE negocio_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reaccion_lugar      ON reaccion (usuario_id, tipo, lugar_id)      WHERE lugar_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reaccion_resena     ON reaccion (usuario_id, tipo, resena_id)     WHERE resena_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reaccion_comentario ON reaccion (usuario_id, tipo, comentario_id) WHERE comentario_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reaccion_articulo   ON reaccion (usuario_id, tipo, articulo_id)   WHERE articulo_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reaccion_medio      ON reaccion (usuario_id, tipo, medio_id)      WHERE medio_id IS NOT NULL;
CREATE INDEX idx_reaccion_negocio    ON reaccion (negocio_id)    WHERE negocio_id IS NOT NULL;
CREATE INDEX idx_reaccion_resena     ON reaccion (resena_id)     WHERE resena_id IS NOT NULL;
CREATE INDEX idx_reaccion_comentario ON reaccion (comentario_id) WHERE comentario_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Reportes de errores en fichas y de contenido ofensivo
-- ---------------------------------------------------------------------
CREATE TABLE reporte_ficha (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  usuario_id      uuid REFERENCES usuario(id) ON DELETE SET NULL,
  dispositivo_id  uuid REFERENCES dispositivo(id) ON DELETE SET NULL,
  motivo          text NOT NULL CHECK (motivo IN ('cerrado','datos_incorrectos','ofensivo','duplicado','otro')),
  detalle         text,
  estado          text NOT NULL DEFAULT 'nuevo'
                  CHECK (estado IN ('nuevo','en_revision','resuelto','descartado')),
  resuelto_por    uuid REFERENCES usuario(id),
  resuelto_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(usuario_id, dispositivo_id) >= 1),
  CHECK (estado IN ('nuevo','en_revision') OR (resuelto_por IS NOT NULL AND resuelto_en IS NOT NULL))
);
CREATE INDEX idx_reporte_ficha_estado ON reporte_ficha (estado, creado_en);
CREATE INDEX idx_reporte_ficha_negocio ON reporte_ficha (negocio_id);
-- Evita el mismo reporte abierto repetido desde el mismo dispositivo.
CREATE UNIQUE INDEX uq_reporte_ficha_abierto ON reporte_ficha (negocio_id, dispositivo_id, motivo)
  WHERE estado IN ('nuevo','en_revision') AND dispositivo_id IS NOT NULL;

CREATE TABLE reporte_contenido (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid REFERENCES usuario(id) ON DELETE SET NULL,
  dispositivo_id  uuid REFERENCES dispositivo(id) ON DELETE SET NULL,
  resena_id       uuid REFERENCES resena(id),
  comentario_id   uuid REFERENCES comentario(id),
  medio_id        uuid REFERENCES medio(id),
  motivo          text NOT NULL CHECK (motivo IN ('ofensivo','spam','falso','derechos','otro')),
  detalle         text,
  estado          text NOT NULL DEFAULT 'nuevo'
                  CHECK (estado IN ('nuevo','en_revision','resuelto','descartado')),
  resuelto_por    uuid REFERENCES usuario(id),
  resuelto_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(resena_id, comentario_id, medio_id) = 1),
  CHECK (num_nonnulls(usuario_id, dispositivo_id) >= 1),
  CHECK (estado IN ('nuevo','en_revision') OR (resuelto_por IS NOT NULL AND resuelto_en IS NOT NULL))
);
CREATE INDEX idx_reporte_contenido_estado ON reporte_contenido (estado, creado_en);

-- ---------------------------------------------------------------------
-- Búsquedas anónimas (alimentan estudios de demanda en el Nivel 3)
-- ---------------------------------------------------------------------
CREATE TABLE busqueda_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispositivo_id    uuid REFERENCES dispositivo(id) ON DELETE SET NULL,
  texto_normalizado text,
  filtros           jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_resultados  integer CHECK (total_resultados >= 0),
  zona_aprox        text CHECK (zona_aprox ~ '^[0-9a-z]{1,5}$'),
  creado_en         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE busqueda_log IS 'Anónimo y con retención de 12 meses. zona_aprox es un geohash de máximo 5 caracteres (unos 5 km): nunca la ubicación exacta.';
CREATE INDEX idx_busqueda_log_fecha ON busqueda_log (creado_en);

CREATE OR REPLACE FUNCTION purgar_busqueda_log(p_meses integer DEFAULT 12) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM busqueda_log WHERE creado_en < now() - make_interval(months => p_meses);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'lista','resena','respuesta_resena','comentario','reporte_ficha','reporte_contenido'
]) AS t;

