-- =====================================================================
-- Travel Oaxaca · Modelo de datos v1
-- Migración 0001: extensiones, funciones de apoyo, catálogos y datos iniciales
-- Motor: PostgreSQL 15 o superior con PostGIS 3
-- Convenciones: nombres en español, snake_case, sin acentos; claves uuid;
--   estados con CHECK de texto; fechas en timestamptz (UTC).
--   Los catálogos usan una bandera `activo` en vez de `eliminado_en`.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

-- Crea el trigger que mantiene `actualizado_en` en una tabla.
CREATE OR REPLACE FUNCTION crear_trigger_actualizado(p_tabla regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_%s_actualizado BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_actualizado_en()',
    replace(p_tabla::text, '.', '_'), p_tabla);
END $$;

-- ---------------------------------------------------------------------
-- Idiomas
-- Los códigos de lenguas indígenas son ISO 639-3. Zapoteco (zap) es un
-- macroidioma y mixteco (mix) corresponde a la variante de Mixtepec:
-- ajustar a la variante concreta cuando se defina el contenido.
-- ---------------------------------------------------------------------
CREATE TABLE idioma (
  codigo        text PRIMARY KEY CHECK (codigo ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  nombre        text NOT NULL,
  es_indigena   boolean NOT NULL DEFAULT false,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Destinos y geografía
-- ---------------------------------------------------------------------
CREATE TABLE destino (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z0-9_]+$'),
  nombre          text NOT NULL,
  pais_codigo     char(2) NOT NULL DEFAULT 'MX',
  moneda_defecto  char(3) NOT NULL DEFAULT 'MXN',
  idioma_defecto  text NOT NULL DEFAULT 'es' REFERENCES idioma(codigo),
  zona_horaria    text NOT NULL DEFAULT 'America/Mexico_City',
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE region (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id  uuid NOT NULL REFERENCES destino(id),
  nombre      text NOT NULL,
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  activo      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destino_id, slug)
);

CREATE TABLE municipio (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    uuid NOT NULL REFERENCES region(id),
  clave_inegi  text UNIQUE CHECK (clave_inegi ~ '^[0-9]{5}$'),
  nombre       text NOT NULL,
  ubicacion    geography(Point, 4326),
  activo       boolean NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_municipio_region ON municipio (region_id);
CREATE INDEX idx_municipio_ubicacion ON municipio USING gist (ubicacion);

CREATE TABLE localidad (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES municipio(id),
  nombre       text NOT NULL,
  ubicacion    geography(Point, 4326),
  activo       boolean NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_localidad_municipio ON localidad (municipio_id);
CREATE INDEX idx_localidad_ubicacion ON localidad USING gist (ubicacion);

-- ---------------------------------------------------------------------
-- Categorías (jerárquicas; destino_id nulo = global) y sus traducciones
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id  uuid REFERENCES destino(id),
  padre_id    uuid REFERENCES categoria(id),
  clave       text NOT NULL CHECK (clave ~ '^[a-z0-9_]+$'),
  icono       text,
  orden       integer NOT NULL DEFAULT 0,
  activa      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (padre_id IS NULL OR padre_id <> id)
);
CREATE UNIQUE INDEX uq_categoria_clave
  ON categoria (COALESCE(destino_id, '00000000-0000-0000-0000-000000000000'::uuid), clave);
CREATE INDEX idx_categoria_padre ON categoria (padre_id);

CREATE TABLE categoria_traduccion (
  categoria_id   uuid NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  nombre         text NOT NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (categoria_id, idioma_codigo)
);

-- ---------------------------------------------------------------------
-- Servicios o amenidades y sus traducciones
-- ---------------------------------------------------------------------
CREATE TABLE servicio (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave   text NOT NULL UNIQUE CHECK (clave ~ '^[a-z0-9_]+$'),
  grupo   text NOT NULL CHECK (grupo IN ('hospedaje','comida','tour','general')),
  icono   text,
  activo  boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE servicio_traduccion (
  servicio_id    uuid NOT NULL REFERENCES servicio(id) ON DELETE CASCADE,
  idioma_codigo  text NOT NULL REFERENCES idioma(codigo),
  nombre         text NOT NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (servicio_id, idioma_codigo)
);

-- ---------------------------------------------------------------------
-- Temporadas (Guelaguetza, Día de Muertos, Semana Santa...) [N2]
-- ---------------------------------------------------------------------
CREATE TABLE temporada (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id    uuid NOT NULL REFERENCES destino(id),
  clave         text NOT NULL CHECK (clave ~ '^[a-z0-9_]+$'),
  nombre        text NOT NULL,
  fecha_inicio  date NOT NULL,
  fecha_fin     date NOT NULL,
  anual         boolean NOT NULL DEFAULT false,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destino_id, clave, fecha_inicio),
  CHECK (fecha_fin >= fecha_inicio)
);

-- ---------------------------------------------------------------------
-- Triggers de `actualizado_en`
-- ---------------------------------------------------------------------
SELECT crear_trigger_actualizado(t::regclass) FROM unnest(ARRAY[
  'idioma','destino','region','municipio','localidad','categoria',
  'categoria_traduccion','servicio','servicio_traduccion','temporada'
]) AS t;

-- ---------------------------------------------------------------------
-- Datos iniciales (editables; las categorías y servicios son una propuesta)
-- ---------------------------------------------------------------------
INSERT INTO idioma (codigo, nombre, es_indigena) VALUES
  ('es','Español',false), ('en','English',false),
  ('zap','Zapoteco',true), ('mix','Mixteco',true);

INSERT INTO destino (codigo, nombre) VALUES ('oaxaca','Oaxaca');

INSERT INTO region (destino_id, nombre, slug)
SELECT d.id, v.nombre, v.slug
FROM destino d,
     (VALUES ('Cañada','canada'), ('Costa','costa'), ('Istmo','istmo'),
             ('Mixteca','mixteca'), ('Papaloapan','papaloapan'),
             ('Sierra Norte','sierra-norte'), ('Sierra Sur','sierra-sur'),
             ('Valles Centrales','valles-centrales')) AS v(nombre, slug)
WHERE d.codigo = 'oaxaca';

INSERT INTO categoria (clave, orden) VALUES
  ('hospedaje',1), ('tours',2), ('comida',3);

INSERT INTO categoria (padre_id, clave, orden)
SELECT p.id, v.clave, v.orden
FROM (VALUES
  ('hospedaje','hotel',1), ('hospedaje','posada',2), ('hospedaje','cabana',3), ('hospedaje','hostal',4),
  ('tours','tour_cultural',1), ('tours','ecoturismo',2), ('tours','tour_gastronomico',3), ('tours','taller_artesanal',4),
  ('comida','restaurante',1), ('comida','fonda',2), ('comida','mercado',3), ('comida','cafe_bar',4)
) AS v(padre, clave, orden)
JOIN categoria p ON p.clave = v.padre AND p.destino_id IS NULL;

INSERT INTO categoria_traduccion (categoria_id, idioma_codigo, nombre)
SELECT c.id, v.idioma, v.nombre
FROM (VALUES
  ('hospedaje','es','Hospedaje'), ('hospedaje','en','Lodging'),
  ('tours','es','Tours y experiencias'), ('tours','en','Tours and experiences'),
  ('comida','es','Comida'), ('comida','en','Food'),
  ('hotel','es','Hotel'), ('hotel','en','Hotel'),
  ('posada','es','Posada'), ('posada','en','Inn'),
  ('cabana','es','Cabaña'), ('cabana','en','Cabin'),
  ('hostal','es','Hostal'), ('hostal','en','Hostel'),
  ('tour_cultural','es','Tour cultural'), ('tour_cultural','en','Cultural tour'),
  ('ecoturismo','es','Ecoturismo'), ('ecoturismo','en','Ecotourism'),
  ('tour_gastronomico','es','Tour gastronómico'), ('tour_gastronomico','en','Food tour'),
  ('taller_artesanal','es','Taller artesanal'), ('taller_artesanal','en','Craft workshop'),
  ('restaurante','es','Restaurante'), ('restaurante','en','Restaurant'),
  ('fonda','es','Fonda'), ('fonda','en','Traditional eatery'),
  ('mercado','es','Mercado'), ('mercado','en','Market'),
  ('cafe_bar','es','Café y bar'), ('cafe_bar','en','Café and bar')
) AS v(clave, idioma, nombre)
JOIN categoria c ON c.clave = v.clave AND c.destino_id IS NULL;

INSERT INTO servicio (clave, grupo) VALUES
  ('wifi','hospedaje'), ('desayuno','hospedaje'), ('estacionamiento','hospedaje'),
  ('aire_acondicionado','hospedaje'), ('alberca','hospedaje'), ('mascotas','hospedaje'),
  ('accesible','general'), ('terraza','general'), ('tarjetas','general'),
  ('vegetariano','comida'), ('cocina_tradicional','comida'),
  ('guia_incluido','tour'), ('transporte_incluido','tour');

INSERT INTO servicio_traduccion (servicio_id, idioma_codigo, nombre)
SELECT s.id, v.idioma, v.nombre
FROM (VALUES
  ('wifi','es','Wi-Fi'), ('wifi','en','Wi-Fi'),
  ('desayuno','es','Desayuno incluido'), ('desayuno','en','Breakfast included'),
  ('estacionamiento','es','Estacionamiento'), ('estacionamiento','en','Parking'),
  ('aire_acondicionado','es','Aire acondicionado'), ('aire_acondicionado','en','Air conditioning'),
  ('alberca','es','Alberca'), ('alberca','en','Pool'),
  ('mascotas','es','Se aceptan mascotas'), ('mascotas','en','Pets allowed'),
  ('accesible','es','Accesible'), ('accesible','en','Accessible'),
  ('terraza','es','Terraza'), ('terraza','en','Terrace'),
  ('tarjetas','es','Acepta tarjetas'), ('tarjetas','en','Cards accepted'),
  ('vegetariano','es','Opciones vegetarianas'), ('vegetariano','en','Vegetarian options'),
  ('cocina_tradicional','es','Cocina tradicional'), ('cocina_tradicional','en','Traditional cuisine'),
  ('guia_incluido','es','Guía incluido'), ('guia_incluido','en','Guide included'),
  ('transporte_incluido','es','Transporte incluido'), ('transporte_incluido','en','Transport included')
) AS v(clave, idioma, nombre)
JOIN servicio s ON s.clave = v.clave;

