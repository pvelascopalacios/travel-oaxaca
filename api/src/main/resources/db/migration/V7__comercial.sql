-- =====================================================================
-- Migración 0007: comercial
-- Incluye: plan, plan_precio, suscripcion, espacio_patrocinio, pago, patrocinio,
--   promocion, promocion_traduccion, cupon, y las funciones de planes, vencimientos
--   y cupones.
-- NO incluye las 8 tablas diferidas: datos_fiscales, factura, enlace_afiliado,
--   anunciante, campana_publicitaria, anuncio, reserva y audioguia.
-- Reglas: 7 (un plan activo por negocio, con límites configurables), 8 (cupo de
--   patrocinios por espacio, con etiqueta "Patrocinado") y 9 (periodo de gracia y
--   regreso al plan Gratis sin perder la ficha).
-- Notas de diseño:
--   * Un negocio sin suscripción activa o en gracia tiene el plan Gratis (no se
--     guarda una suscripción para eso). Ver plan_vigente().
--   * Renovar = extender `fin` de la misma suscripción y registrar un pago.
--   * Los precios no se siembran: se fijan tras las entrevistas con negocios.
--   * Nunca se guardan números de tarjeta; el proveedor de pagos conserva eso.
--   * Los triggers de auditoría sobre estas tablas se agregan en la 0008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Planes y precios
-- ---------------------------------------------------------------------
CREATE TABLE plan (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave                text NOT NULL UNIQUE CHECK (clave ~ '^[a-z_]+$'),
  nombre               text NOT NULL,
  limite_fotos         integer NOT NULL CHECK (limite_fotos >= 0),
  limite_ofertas       integer NOT NULL CHECK (limite_ofertas >= 0),
  ve_estadisticas      boolean NOT NULL DEFAULT false,
  permite_promociones  boolean NOT NULL DEFAULT false,
  permite_patrocinio   boolean NOT NULL DEFAULT false,
  activo               boolean NOT NULL DEFAULT true,
  orden                integer NOT NULL DEFAULT 0,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE plan IS 'Los límites son datos editables, no código (regla 7).';

CREATE TABLE plan_precio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES plan(id),
  destino_id      uuid REFERENCES destino(id),
  categoria_id    uuid REFERENCES categoria(id),
  periodo         text NOT NULL CHECK (periodo IN ('anual','mensual')),
  monto           numeric(12,2) NOT NULL CHECK (monto >= 0),
  moneda          char(3) NOT NULL DEFAULT 'MXN',
  vigente_desde   date NOT NULL DEFAULT current_date,
  vigente_hasta   date,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  EXCLUDE USING gist (
    plan_id WITH =,
    (COALESCE(destino_id,   '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (COALESCE(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    periodo WITH =,
    (daterange(vigente_desde, vigente_hasta, '[]')) WITH &&
  )
);
COMMENT ON TABLE plan_precio IS 'Sin traslapes para la misma combinación de plan, destino, categoría y periodo. Un precio con destino o categoría nulos es el general; la app usa el más específico.';

-- Plan que rige hoy para un negocio: el de su suscripción activa o en gracia, o Gratis.
-- (Se crea después de `suscripcion`.)

-- ---------------------------------------------------------------------
-- Suscripciones
-- ---------------------------------------------------------------------
CREATE TABLE suscripcion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id          uuid NOT NULL REFERENCES negocio(id),
  plan_id             uuid NOT NULL REFERENCES plan(id),
  plan_precio_id      uuid REFERENCES plan_precio(id),
  estado              text NOT NULL DEFAULT 'activa'
                      CHECK (estado IN ('activa','gracia','vencida','cancelada')),
  inicio              date NOT NULL,
  fin                 date NOT NULL,
  gracia_hasta        date,
  renovacion_auto     boolean NOT NULL DEFAULT false,
  cancelada_en        timestamptz,
  motivo_cancelacion  text,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  CHECK (fin >= inicio),
  CHECK (gracia_hasta IS NULL OR gracia_hasta >= fin),
  CHECK (estado <> 'gracia' OR gracia_hasta IS NOT NULL),
  CHECK ((estado = 'cancelada') = (cancelada_en IS NOT NULL))
);
-- Regla 7: un solo periodo activo o en gracia por negocio.
CREATE UNIQUE INDEX uq_suscripcion_vigente ON suscripcion (negocio_id) WHERE estado IN ('activa','gracia');
CREATE INDEX idx_suscripcion_negocio ON suscripcion (negocio_id, fin DESC);
CREATE INDEX idx_suscripcion_vencimiento ON suscripcion (estado, fin) WHERE estado IN ('activa','gracia');

CREATE OR REPLACE FUNCTION plan_vigente(p_negocio uuid) RETURNS plan
LANGUAGE sql STABLE AS $$
  SELECT p.* FROM plan p
  WHERE p.id = COALESCE(
    (SELECT s.plan_id FROM suscripcion s
     WHERE s.negocio_id = p_negocio AND s.estado IN ('activa','gracia')),
    (SELECT g.id FROM plan g WHERE g.clave = 'gratis'))
$$;

-- ---------------------------------------------------------------------
-- Cupones
-- ---------------------------------------------------------------------
CREATE TABLE cupon (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          citext NOT NULL UNIQUE,
  descripcion     text,
  tipo            text NOT NULL CHECK (tipo IN ('pct','monto','periodo_gratis')),
  valor           numeric(12,2) NOT NULL CHECK (valor > 0),
  aplica_a        text NOT NULL CHECK (aplica_a IN ('suscripcion','patrocinio')),
  max_usos        integer CHECK (max_usos > 0),
  usos            integer NOT NULL DEFAULT 0 CHECK (usos >= 0),
  vigente_desde   date NOT NULL DEFAULT current_date,
  vigente_hasta   date,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo <> 'pct' OR valor <= 100),
  CHECK (max_usos IS NULL OR usos <= max_usos),
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
COMMENT ON COLUMN cupon.valor IS 'pct: porcentaje (1 a 100); monto: pesos; periodo_gratis: meses sin costo (p. ej. el primer año gratis de los negocios piloto).';

-- Canjea un cupón de forma atómica: bloquea la fila, valida y suma un uso.
CREATE OR REPLACE FUNCTION canjear_cupon(p_codigo text, p_aplica_a text, p_hoy date DEFAULT current_date) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE c cupon%ROWTYPE;
BEGIN
  SELECT * INTO c FROM cupon WHERE codigo = p_codigo::citext FOR UPDATE;  -- sin distinguir mayúsculas
  IF NOT FOUND THEN RAISE EXCEPTION 'Cupón inexistente' USING ERRCODE = 'check_violation'; END IF;
  IF c.aplica_a <> p_aplica_a THEN RAISE EXCEPTION 'El cupón no aplica a %', p_aplica_a USING ERRCODE = 'check_violation'; END IF;
  IF p_hoy < c.vigente_desde OR (c.vigente_hasta IS NOT NULL AND p_hoy > c.vigente_hasta) THEN
    RAISE EXCEPTION 'El cupón no está vigente' USING ERRCODE = 'check_violation';
  END IF;
  IF c.max_usos IS NOT NULL AND c.usos >= c.max_usos THEN
    RAISE EXCEPTION 'El cupón ya se agotó' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE cupon SET usos = usos + 1 WHERE id = c.id;
  RETURN c.id;
END $$;

-- ---------------------------------------------------------------------
-- Espacios de patrocinio y pagos
-- (patrocinio y pago se refieren entre sí; la llave de pago a patrocinio se agrega al final)
-- ---------------------------------------------------------------------
CREATE TABLE espacio_patrocinio (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id       uuid NOT NULL REFERENCES destino(id),
  clave            text NOT NULL CHECK (clave IN
                   ('destacado_explorar','destacado_categoria','banner_mapa','resultado_busqueda')),
  categoria_id     uuid REFERENCES categoria(id),
  region_id        uuid REFERENCES region(id),
  max_simultaneos  integer NOT NULL CHECK (max_simultaneos > 0),
  activo           boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE espacio_patrocinio IS 'Cada fila es un cupo con su alcance: categoría y región nulas significan "sin restricción".';
CREATE UNIQUE INDEX uq_espacio_alcance ON espacio_patrocinio (
  destino_id, clave,
  COALESCE(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(region_id,    '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE pago (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id          uuid NOT NULL REFERENCES negocio(id),
  concepto            text NOT NULL CHECK (concepto IN ('suscripcion','patrocinio','reserva','otro')),
  suscripcion_id      uuid REFERENCES suscripcion(id),
  patrocinio_id       uuid,
  cupon_id            uuid REFERENCES cupon(id),
  monto               numeric(12,2) NOT NULL CHECK (monto >= 0),
  moneda              char(3) NOT NULL DEFAULT 'MXN',
  metodo              text NOT NULL CHECK (metodo IN ('transferencia','enlace_pago','tarjeta','efectivo')),
  proveedor           text,
  referencia_externa  text,
  estado              text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','pagado','fallido','reembolsado')),
  pagado_en           timestamptz,
  registrado_por      uuid REFERENCES usuario(id),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  CHECK (concepto <> 'suscripcion' OR suscripcion_id IS NOT NULL),
  CHECK (concepto <> 'patrocinio'  OR patrocinio_id  IS NOT NULL),
  CHECK (estado NOT IN ('pagado','reembolsado') OR pagado_en IS NOT NULL)
);
COMMENT ON TABLE pago IS 'En el Nivel 1 se registra a mano; en el N2 lo alimenta el proveedor de pagos. No guarda datos de tarjeta.';
-- Evita registrar dos veces el mismo cobro del proveedor (idempotencia de webhooks).
CREATE UNIQUE INDEX uq_pago_referencia ON pago (proveedor, referencia_externa)
  WHERE referencia_externa IS NOT NULL;
CREATE INDEX idx_pago_negocio ON pago (negocio_id, creado_en DESC);
CREATE INDEX idx_pago_suscripcion ON pago (suscripcion_id) WHERE suscripcion_id IS NOT NULL;
CREATE INDEX idx_pago_estado ON pago (estado) WHERE estado = 'pendiente';

CREATE OR REPLACE FUNCTION fn_pago_coherente() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.suscripcion_id IS NOT NULL AND
     NOT EXISTS (SELECT 1 FROM suscripcion s WHERE s.id = NEW.suscripcion_id AND s.negocio_id = NEW.negocio_id) THEN
    RAISE EXCEPTION 'La suscripción no pertenece al negocio del pago' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pago_coherente BEFORE INSERT OR UPDATE OF negocio_id, suscripcion_id ON pago
  FOR EACH ROW EXECUTE FUNCTION fn_pago_coherente();

-- ---------------------------------------------------------------------
-- Patrocinios
-- ---------------------------------------------------------------------
CREATE TABLE patrocinio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id      uuid NOT NULL REFERENCES espacio_patrocinio(id),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  inicio          date NOT NULL,
  fin             date NOT NULL,
  estado          text NOT NULL DEFAULT 'programado'
                  CHECK (estado IN ('programado','activo','finalizado','cancelado')),
  precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
  moneda          char(3) NOT NULL DEFAULT 'MXN',
  pago_id         uuid REFERENCES pago(id),
  creado_por      uuid REFERENCES usuario(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (fin >= inicio),
  EXCLUDE USING gist (
    espacio_id WITH =, negocio_id WITH =, (daterange(inicio, fin, '[]')) WITH &&
  ) WHERE (estado IN ('programado','activo'))
);
COMMENT ON TABLE patrocinio IS 'Siempre se muestra con la etiqueta "Patrocinado". Un negocio no puede tener dos patrocinios traslapados en el mismo espacio.';
CREATE INDEX idx_patrocinio_espacio ON patrocinio (espacio_id, estado, inicio, fin);
CREATE INDEX idx_patrocinio_negocio ON patrocinio (negocio_id, estado);

ALTER TABLE pago ADD CONSTRAINT fk_pago_patrocinio FOREIGN KEY (patrocinio_id) REFERENCES patrocinio(id);
CREATE INDEX idx_pago_patrocinio ON pago (patrocinio_id) WHERE patrocinio_id IS NOT NULL;

-- Regla 8: validaciones y cupo. Se bloquea la fila del espacio para que dos
-- compras simultáneas no se coman el mismo cupo.
CREATE OR REPLACE FUNCTION fn_patrocinio_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  e espacio_patrocinio%ROWTYPE; n negocio%ROWTYPE; p plan; pico integer;
  v_nuevo boolean := (TG_OP = 'INSERT');
BEGIN
  IF NEW.estado NOT IN ('programado','activo') THEN RETURN NEW; END IF;

  -- Cambios de estado rutinarios (programado -> activo) no se revalidan: así el
  -- proceso nocturno no se detiene por un negocio que se pausó después.
  IF NOT v_nuevo AND NEW.espacio_id = OLD.espacio_id AND NEW.inicio = OLD.inicio
     AND NEW.fin = OLD.fin AND OLD.estado IN ('programado','activo') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO e FROM espacio_patrocinio WHERE id = NEW.espacio_id FOR UPDATE;
  IF NOT e.activo THEN
    RAISE EXCEPTION 'El espacio de patrocinio no está activo' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO n FROM negocio WHERE id = NEW.negocio_id;
  IF n.estado <> 'publicada' OR n.eliminado_en IS NOT NULL THEN
    RAISE EXCEPTION 'Solo un negocio publicado puede patrocinarse' USING ERRCODE = 'check_violation';
  END IF;
  IF v_nuevo THEN
    p := plan_vigente(NEW.negocio_id);
    IF NOT p.permite_patrocinio THEN
      RAISE EXCEPTION 'El plan % no permite patrocinio', p.clave USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF e.categoria_id IS NOT NULL AND n.categoria_id <> e.categoria_id
     AND NOT EXISTS (SELECT 1 FROM categoria c WHERE c.id = n.categoria_id AND c.padre_id = e.categoria_id) THEN
    RAISE EXCEPTION 'El negocio no pertenece a la categoría de este espacio' USING ERRCODE = 'check_violation';
  END IF;
  IF e.region_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM sucursal s JOIN municipio m ON m.id = s.municipio_id
       WHERE s.negocio_id = n.id AND s.es_principal AND s.eliminado_en IS NULL AND m.region_id = e.region_id) THEN
    RAISE EXCEPTION 'El negocio no está en la región de este espacio' USING ERRCODE = 'check_violation';
  END IF;

  -- Cupo: máximo de patrocinios simultáneos en cualquier día del periodo.
  SELECT max(c) INTO pico FROM (
    SELECT d::date AS dia, count(*) AS c
    FROM generate_series(NEW.inicio, NEW.fin, interval '1 day') d
    JOIN patrocinio x ON x.espacio_id = NEW.espacio_id AND x.id <> NEW.id
                     AND x.estado IN ('programado','activo')
                     AND d::date BETWEEN x.inicio AND x.fin
    GROUP BY d::date) t;
  IF COALESCE(pico, 0) >= e.max_simultaneos THEN
    RAISE EXCEPTION 'No hay cupo: el espacio admite % patrocinios simultáneos', e.max_simultaneos
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_patrocinio_validar BEFORE INSERT OR UPDATE ON patrocinio
  FOR EACH ROW EXECUTE FUNCTION fn_patrocinio_validar();

CREATE OR REPLACE FUNCTION negocio_patrocinado_hoy(p_negocio uuid, p_hoy date DEFAULT current_date) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM patrocinio
                 WHERE negocio_id = p_negocio AND estado = 'activo' AND p_hoy BETWEEN inicio AND fin)
$$;

CREATE VIEW patrocinio_vigente AS
  SELECT p.* FROM patrocinio p
  JOIN negocio n ON n.id = p.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
  WHERE p.estado = 'activo' AND current_date BETWEEN p.inicio AND p.fin;

-- ---------------------------------------------------------------------
-- Promociones [N2]
-- ---------------------------------------------------------------------
ALTER TABLE oferta ADD CONSTRAINT uq_oferta_id_negocio UNIQUE (id, negocio_id);

CREATE TABLE promocion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      uuid NOT NULL REFERENCES negocio(id),
  oferta_id       uuid,
  tipo            text NOT NULL CHECK (tipo IN ('descuento_pct','descuento_monto','dos_por_uno','regalo')),
  valor           numeric(12,2),
  codigo          citext,
  inicio          date NOT NULL,
  fin             date NOT NULL,
  condiciones     text,
  estado          text NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador','en_revision','activa','vencida')),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  eliminado_en    timestamptz,
  FOREIGN KEY (oferta_id, negocio_id) REFERENCES oferta (id, negocio_id),
  CHECK (fin >= inicio),
  -- COALESCE: con valor nulo la comparación daría NULL y el CHECK lo dejaría pasar.
  CONSTRAINT promocion_valor_por_tipo CHECK (
         (tipo = 'descuento_pct'   AND COALESCE(valor, 0) BETWEEN 1 AND 100)
      OR (tipo = 'descuento_monto' AND COALESCE(valor, 0) > 0)
      OR (tipo IN ('dos_por_uno','regalo') AND valor IS NULL))
);
CREATE UNIQUE INDEX uq_promocion_codigo ON promocion (negocio_id, codigo)
  WHERE codigo IS NOT NULL AND eliminado_en IS NULL;
CREATE INDEX idx_promocion_negocio ON promocion (negocio_id, estado) WHERE eliminado_en IS NULL;
CREATE INDEX idx_promocion_vigencia ON promocion (estado, fin) WHERE estado IN ('activa','en_revision');

CREATE TABLE promocion_traduccion (
  promocion_id   uuid NOT NULL REFERENCES promocion(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  titulo         text NOT NULL,
  descripcion    text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promocion_id, idioma_codigo)
);

-- Solo los planes que lo permiten pueden enviar o activar promociones.
CREATE OR REPLACE FUNCTION fn_promocion_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p plan;
BEGIN
  IF NEW.estado IN ('en_revision','activa')
     AND (TG_OP = 'INSERT' OR OLD.estado NOT IN ('en_revision','activa')) THEN
    p := plan_vigente(NEW.negocio_id);
    IF NOT p.permite_promociones THEN
      RAISE EXCEPTION 'El plan % no permite promociones', p.clave USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_promocion_plan BEFORE INSERT OR UPDATE OF estado ON promocion
  FOR EACH ROW EXECUTE FUNCTION fn_promocion_plan();
-- Regla 5: una promoción solo se activa con su título en español.
CREATE TRIGGER trg_promocion_es BEFORE INSERT OR UPDATE OF estado ON promocion
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_traduccion_es('promocion_traduccion','promocion_id','titulo','activa');

CREATE VIEW promocion_vigente AS
  SELECT p.* FROM promocion p
  JOIN negocio n ON n.id = p.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
  WHERE p.estado = 'activa' AND p.eliminado_en IS NULL AND current_date BETWEEN p.inicio AND p.fin;

-- ---------------------------------------------------------------------
-- Límites del plan sobre fotos y ofertas (regla 7)
-- Los límites impiden agregar más; si un plan baja, lo ya cargado no se borra.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_limite_fotos_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p plan; v_tipo text; n integer;
BEGIN
  SELECT tipo INTO v_tipo FROM medio WHERE id = NEW.medio_id;
  IF v_tipo IS DISTINCT FROM 'imagen' THEN RETURN NEW; END IF;
  p := plan_vigente(NEW.negocio_id);
  IF p.id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
  WHERE nm.negocio_id = NEW.negocio_id AND m.tipo = 'imagen' AND m.eliminado_en IS NULL;
  IF n >= p.limite_fotos THEN
    RAISE EXCEPTION 'El plan % admite máximo % fotos', p.clave, p.limite_fotos USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_negocio_medio_limite BEFORE INSERT ON negocio_medio
  FOR EACH ROW EXECUTE FUNCTION fn_limite_fotos_plan();

CREATE OR REPLACE FUNCTION fn_limite_ofertas_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p plan; n integer;
BEGIN
  p := plan_vigente(NEW.negocio_id);
  IF p.id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM oferta
  WHERE negocio_id = NEW.negocio_id AND eliminado_en IS NULL AND estado <> 'archivada';
  IF n >= p.limite_ofertas THEN
    RAISE EXCEPTION 'El plan % admite máximo % ofertas', p.clave, p.limite_ofertas USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_oferta_limite BEFORE INSERT ON oferta
  FOR EACH ROW EXECUTE FUNCTION fn_limite_ofertas_plan();

-- ---------------------------------------------------------------------
-- Proceso diario de vencimientos (reglas 8 y 9). Se programa cada noche.
-- La 0008 lo redefine para leer los días de gracia de `configuracion`.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION procesar_vencimientos(p_hoy date DEFAULT current_date, p_dias_gracia integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE a integer; b integer; c integer; d integer; e integer;
BEGIN
  UPDATE suscripcion SET estado = 'gracia', gracia_hasta = fin + p_dias_gracia
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

SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'plan','plan_precio','suscripcion','cupon','espacio_patrocinio','pago',
  'patrocinio','promocion','promocion_traduccion'
]) AS t;

-- ---------------------------------------------------------------------
-- Datos iniciales (editables)
-- ---------------------------------------------------------------------
INSERT INTO plan (clave, nombre, limite_fotos, limite_ofertas, ve_estadisticas, permite_promociones, permite_patrocinio, orden) VALUES
  ('gratis',    'Gratis',    3,  0, false, false, false, 1),
  ('pro',       'Pro',      15, 10, true,  true,  false, 2),
  ('destacado', 'Destacado', 30, 30, true,  true,  true,  3);

-- Cupos de patrocinio para Oaxaca: 3 destacados en Explorar, 3 por categoría
-- principal, 2 banners en el mapa y 3 en resultados de búsqueda.
INSERT INTO espacio_patrocinio (destino_id, clave, max_simultaneos)
SELECT d.id, v.clave, v.maximo
FROM destino d, (VALUES ('destacado_explorar',3), ('banner_mapa',2), ('resultado_busqueda',3)) AS v(clave, maximo)
WHERE d.codigo = 'oaxaca';

INSERT INTO espacio_patrocinio (destino_id, clave, categoria_id, max_simultaneos)
SELECT d.id, 'destacado_categoria', c.id, 3
FROM destino d, categoria c
WHERE d.codigo = 'oaxaca' AND c.destino_id IS NULL AND c.padre_id IS NULL
  AND c.clave IN ('hospedaje','tours','comida');

-- Ejemplo (desactivado): primer año gratis para los negocios piloto.
-- INSERT INTO cupon (codigo, descripcion, tipo, valor, aplica_a, max_usos)
-- VALUES ('PILOTO', 'Primer año gratis para negocios piloto', 'periodo_gratis', 12, 'suscripcion', 30);

