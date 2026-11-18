-- =====================================================================
-- Migración 0008: ventas y operación
-- Incluye: configuracion, prospecto, interaccion_comercial, notificacion_plantilla,
--   notificacion, auditoria, importacion.
-- Además:
--   * Redefine fotos_minimas_publicar() y fotos_max_resena() para leer de
--     `configuracion` (antes eran constantes en 0003 y 0005).
--   * Redefine procesar_vencimientos() para leer los días de gracia de
--     `configuracion` (clave `dias_gracia`) cuando no se le pasa el parámetro.
--   * Agrega auditoría automática a las tablas sensibles.
-- Con esta migración quedan 78 tablas base. Siguen diferidas: datos_fiscales,
--   factura, enlace_afiliado, anunciante, campana_publicitaria, anuncio, reserva
--   y audioguia.
-- Auditoría: la aplicación debe ejecutar, al abrir cada transacción de escritura,
--   SELECT set_config('app.usuario_id', '<uuid>', true);
--   para que quede registrado quién hizo el cambio. Sin eso, usuario_id queda nulo
--   (por ejemplo, cambios hechos por trabajos nocturnos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuración (interruptores y parámetros del negocio)
-- ---------------------------------------------------------------------
CREATE TABLE configuracion (
  clave          text PRIMARY KEY CHECK (clave ~ '^[a-z][a-z0-9_]*$'),
  tipo           text NOT NULL CHECK (tipo IN ('entero','booleano','texto','json')),
  valor          jsonb NOT NULL,
  minimo         numeric,
  maximo         numeric,
  descripcion    text NOT NULL,
  actualizado_por uuid REFERENCES usuario(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (
       (tipo = 'entero'   AND jsonb_typeof(valor) = 'number')
    OR (tipo = 'booleano' AND jsonb_typeof(valor) = 'boolean')
    OR (tipo = 'texto'    AND jsonb_typeof(valor) = 'string')
    OR (tipo = 'json'     AND jsonb_typeof(valor) IN ('object','array'))
  ),
  CHECK (minimo IS NULL OR maximo IS NULL OR minimo <= maximo)
);

CREATE OR REPLACE FUNCTION fn_configuracion_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v numeric;
BEGIN
  -- Si el JSON no es número, lo rechaza el CHECK de la tabla con un mensaje claro.
  IF NEW.tipo = 'entero' AND jsonb_typeof(NEW.valor) = 'number' THEN
    v := (NEW.valor #>> '{}')::numeric;
    IF v <> trunc(v) THEN
      RAISE EXCEPTION 'La clave % debe ser un entero', NEW.clave USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.minimo IS NOT NULL AND v < NEW.minimo THEN
      RAISE EXCEPTION 'La clave % no puede ser menor que %', NEW.clave, NEW.minimo USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.maximo IS NOT NULL AND v > NEW.maximo THEN
      RAISE EXCEPTION 'La clave % no puede ser mayor que %', NEW.clave, NEW.maximo USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_configuracion_validar
  BEFORE INSERT OR UPDATE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION fn_configuracion_validar();

-- Lectores con valor por omisión (si la clave no existe, regresa el valor dado).
CREATE OR REPLACE FUNCTION config_entero(p_clave text, p_defecto integer) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT (valor #>> '{}')::integer FROM configuracion
                   WHERE clave = p_clave AND tipo = 'entero'), p_defecto)
$$;

CREATE OR REPLACE FUNCTION config_booleano(p_clave text, p_defecto boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT (valor #>> '{}')::boolean FROM configuracion
                   WHERE clave = p_clave AND tipo = 'booleano'), p_defecto)
$$;

-- Las constantes de migraciones anteriores ahora salen de configuracion.
CREATE OR REPLACE FUNCTION fotos_minimas_publicar() RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT config_entero('fotos_minimas_publicar', 3) $$;

CREATE OR REPLACE FUNCTION fotos_max_resena() RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT config_entero('fotos_max_resena', 3) $$;

-- Mismo cuerpo que en 0007; solo cambia de dónde salen los días de gracia.
CREATE OR REPLACE FUNCTION procesar_vencimientos(p_hoy date DEFAULT current_date,
                                                 p_dias_gracia integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE a integer; b integer; c integer; d integer; e integer; g integer;
BEGIN
  g := COALESCE(p_dias_gracia, config_entero('dias_gracia', 30));

  UPDATE suscripcion SET estado = 'gracia', gracia_hasta = fin + g
  WHERE estado = 'activa' AND fin < p_hoy;
  GET DIAGNOSTICS a = ROW_COUNT;

  UPDATE suscripcion SET estado = 'vencida'
  WHERE estado = 'gracia' AND gracia_hasta < p_hoy;
  GET DIAGNOSTICS b = ROW_COUNT;

  UPDATE patrocinio SET estado = 'finalizado'
  WHERE estado IN ('programado','activo') AND fin < p_hoy;
  GET DIAGNOSTICS c = ROW_COUNT;

  UPDATE patrocinio SET estado = 'activo'
  WHERE estado = 'programado' AND inicio <= p_hoy AND fin >= p_hoy;
  GET DIAGNOSTICS d = ROW_COUNT;

  UPDATE promocion SET estado = 'vencida'
  WHERE estado IN ('activa','en_revision') AND fin < p_hoy AND eliminado_en IS NULL;
  GET DIAGNOSTICS e = ROW_COUNT;

  RETURN jsonb_build_object('suscripciones_a_gracia', a, 'suscripciones_vencidas', b,
                            'patrocinios_finalizados', c, 'patrocinios_activados', d,
                            'promociones_vencidas', e);
END $$;

-- ---------------------------------------------------------------------
-- Prospectos e interacciones comerciales (embudo de ventas)
-- ---------------------------------------------------------------------
CREATE TABLE prospecto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_negocio   text NOT NULL CHECK (length(btrim(nombre_negocio)) > 0),
  categoria_id     uuid REFERENCES categoria(id),
  municipio_id     uuid REFERENCES municipio(id),
  contacto_nombre  text,
  telefono         text CHECK (telefono IS NULL OR telefono ~ '^\+[1-9][0-9]{7,14}$'),
  correo           citext CHECK (correo IS NULL OR correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  origen           text NOT NULL DEFAULT 'otro'
                   CHECK (origen IN ('facebook','visita','referido','formulario_web','evento','otro')),
  estado           text NOT NULL DEFAULT 'nuevo'
                   CHECK (estado IN ('nuevo','contactado','interesado','en_alta','convertido','descartado')),
  asignado_a       uuid REFERENCES usuario(id) ON DELETE SET NULL,
  negocio_id       uuid REFERENCES negocio(id) ON DELETE SET NULL,
  motivo_descarte  text,
  proxima_accion_en date,
  notas            text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  eliminado_en     timestamptz,
  CHECK (estado <> 'convertido' OR negocio_id IS NOT NULL),
  CHECK (estado <> 'descartado' OR length(btrim(COALESCE(motivo_descarte,''))) > 0)
);
CREATE INDEX ix_prospecto_estado ON prospecto (estado, proxima_accion_en) WHERE eliminado_en IS NULL;
CREATE INDEX ix_prospecto_asignado ON prospecto (asignado_a) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX uq_prospecto_negocio ON prospecto (negocio_id) WHERE negocio_id IS NOT NULL;

CREATE TABLE interaccion_comercial (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id   uuid REFERENCES prospecto(id) ON DELETE CASCADE,
  negocio_id     uuid REFERENCES negocio(id) ON DELETE CASCADE,
  usuario_id     uuid REFERENCES usuario(id) ON DELETE SET NULL,
  tipo           text NOT NULL CHECK (tipo IN ('llamada','visita','whatsapp','correo','demo','nota')),
  resultado      text,
  notas          text,
  ocurrio_en     timestamptz NOT NULL DEFAULT now(),
  proxima_accion_en date,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(prospecto_id, negocio_id) >= 1)
);
CREATE INDEX ix_interaccion_prospecto ON interaccion_comercial (prospecto_id, ocurrio_en DESC);
CREATE INDEX ix_interaccion_negocio ON interaccion_comercial (negocio_id, ocurrio_en DESC);

-- ---------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------
CREATE TABLE notificacion_plantilla (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave         text NOT NULL CHECK (clave ~ '^[a-z][a-z0-9_]*$'),
  canal         text NOT NULL CHECK (canal IN ('correo','push','interna')),
  idioma_codigo text NOT NULL REFERENCES idioma(codigo),
  asunto        text,
  cuerpo        text NOT NULL CHECK (length(btrim(cuerpo)) > 0),
  activa        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clave, canal, idioma_codigo),
  CHECK (canal <> 'correo' OR length(btrim(COALESCE(asunto,''))) > 0)
);

CREATE TABLE notificacion (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid REFERENCES usuario(id) ON DELETE CASCADE,
  negocio_id       uuid REFERENCES negocio(id) ON DELETE CASCADE,
  plantilla_clave  text NOT NULL,
  canal            text NOT NULL CHECK (canal IN ('correo','push','interna')),
  datos            jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado           text NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','enviada','fallida','leida','cancelada')),
  programada_para  timestamptz NOT NULL DEFAULT now(),
  enviada_en       timestamptz,
  leida_en         timestamptz,
  intentos         integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  error            text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(usuario_id, negocio_id) >= 1),
  CHECK (estado NOT IN ('enviada','leida') OR enviada_en IS NOT NULL),
  CHECK (estado <> 'leida' OR leida_en IS NOT NULL)
);
CREATE INDEX ix_notificacion_cola ON notificacion (programada_para) WHERE estado = 'pendiente';
CREATE INDEX ix_notificacion_usuario ON notificacion (usuario_id, creado_en DESC) WHERE usuario_id IS NOT NULL;
CREATE INDEX ix_notificacion_negocio ON notificacion (negocio_id, creado_en DESC) WHERE negocio_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Importaciones masivas (carga de negocios desde hojas de cálculo)
-- ---------------------------------------------------------------------
CREATE TABLE importacion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           text NOT NULL CHECK (tipo IN ('negocios','prospectos','lugares','eventos')),
  archivo        text NOT NULL,
  estado         text NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','validando','aplicada','con_errores','cancelada')),
  total_filas    integer NOT NULL DEFAULT 0 CHECK (total_filas >= 0),
  filas_ok       integer NOT NULL DEFAULT 0 CHECK (filas_ok >= 0),
  filas_error    integer NOT NULL DEFAULT 0 CHECK (filas_error >= 0),
  errores        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(errores) = 'array'),
  creada_por     uuid REFERENCES usuario(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  finalizada_en  timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (filas_ok + filas_error <= total_filas),
  CHECK (estado NOT IN ('aplicada','con_errores','cancelada') OR finalizada_en IS NOT NULL)
);
CREATE INDEX ix_importacion_estado ON importacion (estado, creado_en DESC);

-- ---------------------------------------------------------------------
-- Auditoría (solo se agrega; nunca se modifica ni se borra)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla        text NOT NULL,
  registro_id  text NOT NULL,
  accion       text NOT NULL CHECK (accion IN ('insert','update','delete')),
  usuario_id   uuid,  -- sin FK a propósito: la bitácora sobrevive aunque se borre el usuario
  antes        jsonb,
  despues      jsonb,
  ocurrio_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_auditoria_registro ON auditoria (tabla, registro_id, ocurrio_en DESC);
CREATE INDEX ix_auditoria_usuario ON auditoria (usuario_id, ocurrio_en DESC) WHERE usuario_id IS NOT NULL;
CREATE INDEX ix_auditoria_fecha ON auditoria (ocurrio_en DESC);

CREATE OR REPLACE FUNCTION fn_auditoria_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar'
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_inmutable();

-- Trigger genérico. En UPDATE guarda solo las columnas que cambiaron
-- (ignora actualizado_en) y no escribe nada si no cambió nada relevante.
CREATE OR REPLACE FUNCTION fn_auditar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  j_old jsonb; j_new jsonb; d_old jsonb; d_new jsonb; reg text; actor uuid;
BEGIN
  BEGIN
    actor := nullif(current_setting('app.usuario_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    j_new := to_jsonb(NEW);
    reg := COALESCE(j_new->>'id', j_new->>'clave');
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, despues)
    VALUES (TG_TABLE_NAME, reg, 'insert', actor, j_new);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    j_old := to_jsonb(OLD);
    reg := COALESCE(j_old->>'id', j_old->>'clave');
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, antes)
    VALUES (TG_TABLE_NAME, reg, 'delete', actor, j_old);
    RETURN OLD;
  ELSE
    j_old := to_jsonb(OLD) - 'actualizado_en';
    j_new := to_jsonb(NEW) - 'actualizado_en';
    IF j_old = j_new THEN
      RETURN NEW;
    END IF;
    SELECT jsonb_object_agg(n.key, j_old->n.key), jsonb_object_agg(n.key, n.value)
      INTO d_old, d_new
      FROM jsonb_each(j_new) n
     WHERE j_old->n.key IS DISTINCT FROM n.value;
    reg := COALESCE(j_new->>'id', j_new->>'clave');
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, antes, despues)
    VALUES (TG_TABLE_NAME, reg, 'update', actor, d_old, d_new);
    RETURN NEW;
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'negocio','suscripcion','patrocinio','plan','plan_precio','cupon','pago',
    'verificacion','usuario_rol','promocion','configuracion','prospecto'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION fn_auditar()', t);
  END LOOP;
END $$;

SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'configuracion','prospecto','notificacion_plantilla','notificacion','importacion'
]) AS t;

-- ---------------------------------------------------------------------
-- Datos iniciales (editables)
-- ---------------------------------------------------------------------
INSERT INTO configuracion (clave, tipo, valor, minimo, maximo, descripcion) VALUES
 ('anuncios_terceros_activos', 'booleano', 'false', NULL, NULL,
  'Interruptor de anuncios de terceros (por ejemplo AdMob). Nunca se muestran en fichas de pago.'),
 ('umbral_usuarios_para_anuncios', 'entero', '5000', 0, NULL,
  'Usuarios activos mensuales a partir de los cuales conviene encender anuncios de terceros.'),
 ('dias_gracia', 'entero', '30', 0, 365,
  'Días de gracia tras vencer una suscripción antes de volver al plan Gratis.'),
 ('fotos_minimas_publicar', 'entero', '3', 0, 20,
  'Fotos aprobadas que necesita una ficha para publicarse.'),
 ('fotos_max_resena', 'entero', '3', 0, 10,
  'Máximo de fotos que un turista puede subir en una reseña.'),
 ('reservas_activas', 'booleano', 'false', NULL, NULL,
  'Reservas dentro de la app. Apagado hasta que existan las tablas diferidas.');

INSERT INTO notificacion_plantilla (clave, canal, idioma_codigo, asunto, cuerpo) VALUES
 ('ficha_publicada',        'correo', 'es', 'Tu negocio ya está publicado',
  'Hola {{nombre}}, tu ficha "{{negocio}}" ya está visible en la app.'),
 ('ficha_rechazada',        'correo', 'es', 'Tu ficha necesita cambios',
  'Hola {{nombre}}, revisamos "{{negocio}}" y necesita ajustes: {{motivo}}'),
 ('suscripcion_por_vencer', 'correo', 'es', 'Tu plan vence pronto',
  'Hola {{nombre}}, el plan {{plan}} de "{{negocio}}" vence el {{fecha}}.'),
 ('suscripcion_en_gracia',  'correo', 'es', 'Tu plan venció: tienes días de gracia',
  'Hola {{nombre}}, el plan de "{{negocio}}" venció. Conservas tus beneficios hasta el {{fecha}}.'),
 ('reporte_mensual',        'correo', 'es', 'Tu reporte mensual está listo',
  'Hola {{nombre}}, ya puedes ver el reporte de {{mes}} de "{{negocio}}".'),
 ('resena_nueva',           'interna','es', NULL,
  'Nueva reseña en "{{negocio}}". Puedes responderla.');

-- Ejemplo de dato de prueba comentado (no se carga):
-- INSERT INTO prospecto (nombre_negocio, origen, telefono) VALUES ('Hotel Ejemplo', 'facebook', '+529541234567');

