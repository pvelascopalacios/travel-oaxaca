-- Paso 10A+: módulo editorial de la pantalla de inicio (Destacados, Pueblos y lenguas, Historias, Reels).
-- Reglas que la base hace cumplir: no se publica sin foto ni sin texto en español; una historia necesita el
-- permiso de la persona; un saludo en lengua indígena necesita idioma y quién lo verificó; los Reels solo enlazan a Facebook.

CREATE TABLE inicio_bloque (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id            uuid NOT NULL REFERENCES destino(id),
  tipo                  text NOT NULL CHECK (tipo IN ('destacado','pueblo','historia','reel')),
  orden                 integer NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 999),
  estado                text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicado','archivado')),
  publicar_desde        date,
  publicar_hasta        date,
  medio_id              uuid REFERENCES medio(id),
  credito               text CHECK (length(credito) <= 120),
  ruta                  text CHECK (ruta ~ '^/[A-Za-z0-9/_?=&.%-]*$' AND ruta NOT LIKE '//%' AND length(ruta) <= 200),
  enlace                text CHECK (enlace ~ '^https://((www|m)\.)?facebook\.com/' OR enlace ~ '^https://fb\.watch/'),
  comunidades           integer CHECK (comunidades >= 0),
  saludo                text CHECK (length(saludo) <= 120),
  saludo_idioma         text REFERENCES idioma(codigo),
  saludo_verificado_por text CHECK (length(saludo_verificado_por) <= 200),
  persona               text CHECK (length(persona) <= 120),
  lugar_texto           text CHECK (length(lugar_texto) <= 120),
  negocio_id            uuid REFERENCES negocio(id),
  permiso_confirmado    boolean NOT NULL DEFAULT false,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  eliminado_en          timestamptz,
  CHECK (publicar_hasta IS NULL OR publicar_desde IS NULL OR publicar_hasta >= publicar_desde),
  CHECK (saludo IS NULL OR (saludo_idioma IS NOT NULL AND saludo_verificado_por IS NOT NULL)),
  CHECK (estado <> 'publicado' OR medio_id IS NOT NULL),
  CHECK (estado <> 'publicado' OR tipo <> 'destacado' OR ruta IS NOT NULL),
  CHECK (estado <> 'publicado' OR tipo <> 'reel' OR enlace IS NOT NULL),
  CHECK (estado <> 'publicado' OR tipo <> 'historia' OR (permiso_confirmado AND persona IS NOT NULL))
);
COMMENT ON TABLE inicio_bloque IS 'Contenido editorial de la pantalla de inicio. Sin foto aprobada no se muestra.';
CREATE INDEX idx_inicio_bloque_publico ON inicio_bloque (destino_id, tipo, orden) WHERE eliminado_en IS NULL AND estado = 'publicado';

CREATE TABLE inicio_bloque_traduccion (
  bloque_id      uuid NOT NULL REFERENCES inicio_bloque(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  etiqueta       text CHECK (length(etiqueta) <= 60),
  titulo         text NOT NULL CHECK (length(titulo) <= 160),
  texto          text CHECK (length(texto) <= 400),
  boton          text CHECK (length(boton) <= 40),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bloque_id, idioma_codigo)
);

CREATE TRIGGER trg_inicio_bloque_es BEFORE INSERT OR UPDATE OF estado ON inicio_bloque
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_traduccion_es('inicio_bloque_traduccion','bloque_id','titulo','publicado');

SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY['inicio_bloque','inicio_bloque_traduccion']) AS t;
