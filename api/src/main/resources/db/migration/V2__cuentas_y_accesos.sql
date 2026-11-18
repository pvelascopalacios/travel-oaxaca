-- =====================================================================
-- Migración 0002: cuentas y accesos
-- Nota: `membresia_negocio` se crea en 0003, porque depende de `negocio`.
-- Desviaciones del documento: `usuario_rol` usa clave sustituta `id` más un
-- índice único con COALESCE, porque una clave primaria no admite destino_id nulo.
-- =====================================================================

CREATE TABLE usuario (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correo               citext UNIQUE,
  correo_verificado_en timestamptz,
  hash_clave           text,
  nombre               text,
  telefono_e164        text CHECK (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  idioma_codigo        text NOT NULL DEFAULT 'es' REFERENCES idioma(codigo),
  estado               text NOT NULL DEFAULT 'activo'
                       CHECK (estado IN ('activo','suspendido','eliminado')),
  ultimo_acceso_en     timestamptz,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now(),
  eliminado_en         timestamptz,
  CHECK (hash_clave IS NULL OR correo IS NOT NULL)
);
COMMENT ON TABLE usuario IS
  'Al eliminar una cuenta se anonimizan correo, nombre y teléfono (se ponen en NULL) y se conserva la fila por integridad.';

CREATE TABLE identidad_externa (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  proveedor        text NOT NULL CHECK (proveedor IN ('google','apple')),
  sujeto_externo   text NOT NULL,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, sujeto_externo)
);
CREATE INDEX idx_identidad_usuario ON identidad_externa (usuario_id);

CREATE TABLE rol (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave        text NOT NULL UNIQUE CHECK (clave ~ '^[a-z_]+$'),
  descripcion  text NOT NULL,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario_rol (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rol_id      uuid NOT NULL REFERENCES rol(id),
  destino_id  uuid REFERENCES destino(id),
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_usuario_rol
  ON usuario_rol (usuario_id, rol_id, COALESCE(destino_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE dispositivo (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma          text NOT NULL CHECK (plataforma IN ('android','ios','web')),
  version_app         text,
  idioma_codigo       text REFERENCES idioma(codigo),
  usuario_id          uuid REFERENCES usuario(id) ON DELETE SET NULL,
  token_notificacion  text,
  primera_vez_en      timestamptz NOT NULL DEFAULT now(),
  ultima_vez_en       timestamptz NOT NULL DEFAULT now(),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispositivo_usuario ON dispositivo (usuario_id);

CREATE TABLE sesion (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  dispositivo_id       uuid REFERENCES dispositivo(id) ON DELETE SET NULL,
  hash_token_refresco  text NOT NULL UNIQUE,
  expira_en            timestamptz NOT NULL,
  revocada_en          timestamptz,
  creado_en            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sesion_usuario ON sesion (usuario_id, expira_en);

CREATE TABLE consentimiento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid REFERENCES usuario(id) ON DELETE CASCADE,
  dispositivo_id  uuid REFERENCES dispositivo(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('privacidad','terminos','analitica','marketing')),
  version_texto   text NOT NULL,
  aceptado        boolean NOT NULL,
  fecha           timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(usuario_id, dispositivo_id) >= 1)
);
COMMENT ON TABLE consentimiento IS
  'Basta con un usuario o un dispositivo; pueden venir ambos cuando el dispositivo ya está ligado a una cuenta.';
CREATE INDEX idx_consentimiento_usuario ON consentimiento (usuario_id, tipo, fecha DESC);
CREATE INDEX idx_consentimiento_dispositivo ON consentimiento (dispositivo_id, tipo, fecha DESC);

CREATE TABLE solicitud_privacidad (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL REFERENCES usuario(id),
  tipo         text NOT NULL CHECK (tipo IN ('acceso','rectificacion','cancelacion','oposicion')),
  estado       text NOT NULL DEFAULT 'recibida'
               CHECK (estado IN ('recibida','en_proceso','resuelta','rechazada')),
  detalle      text,
  resuelta_en  timestamptz,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_solicitud_privacidad_estado ON solicitud_privacidad (estado, creado_en);

SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'usuario','dispositivo','solicitud_privacidad'
]) AS t;

INSERT INTO rol (clave, descripcion) VALUES
  ('turista',     'Turista con cuenta: guarda favoritos y, después, reseña y comenta'),
  ('dueno',       'Propietario de uno o más negocios'),
  ('colaborador', 'Persona invitada a ayudar con un negocio'),
  ('admin',       'Administración completa del destino'),
  ('editor',      'Edita contenido editorial y revisa fichas'),
  ('ventas',      'Gestiona prospectos y seguimiento comercial');

