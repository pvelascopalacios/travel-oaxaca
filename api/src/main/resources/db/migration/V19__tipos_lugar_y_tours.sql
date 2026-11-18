-- Paso 11: más tipos de lugar (bosque, mirador, cascada, presa) y más subcategorías de tours
-- (catamarán, paseo en lancha, tour de playas, aventura).

-- ---------------------------------------------------------------------
-- Tipos de lugar: la regla de la tabla era fija; se reemplaza por una que incluye los nuevos.
-- Se busca por definición (no por nombre) para no depender del nombre que Postgres le puso.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  regla text;
BEGIN
  FOR regla IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'lugar'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%arqueologico%'
  LOOP
    EXECUTE format('ALTER TABLE lugar DROP CONSTRAINT %I', regla);
  END LOOP;
END $$;

ALTER TABLE lugar ADD CONSTRAINT lugar_tipo_check CHECK (tipo IN
  ('arqueologico','natural','cultural','playa','mercado','templo','otro',
   'bosque','mirador','cascada','presa'));

-- ---------------------------------------------------------------------
-- Subcategorías nuevas dentro de "Tours y experiencias"
-- ---------------------------------------------------------------------
INSERT INTO categoria (padre_id, clave, orden)
SELECT p.id, v.clave, v.orden
FROM (VALUES
  ('tours', 'catamaran', 5), ('tours', 'paseo_lancha', 6),
  ('tours', 'tour_playa', 7), ('tours', 'aventura', 8)
) AS v(padre, clave, orden)
JOIN categoria p ON p.clave = v.padre AND p.destino_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM categoria x WHERE x.clave = v.clave AND x.destino_id IS NULL);

INSERT INTO categoria_traduccion (categoria_id, idioma_codigo, nombre)
SELECT c.id, v.idioma, v.nombre
FROM (VALUES
  ('catamaran',    'es', 'Catamarán'),             ('catamaran',    'en', 'Catamaran'),
  ('paseo_lancha', 'es', 'Paseo en lancha'),       ('paseo_lancha', 'en', 'Boat ride'),
  ('tour_playa',   'es', 'Tour de playas'),        ('tour_playa',   'en', 'Beach tour'),
  ('aventura',     'es', 'Aventura y deportes'),   ('aventura',     'en', 'Adventure and sports')
) AS v(clave, idioma, nombre)
JOIN categoria c ON c.clave = v.clave AND c.destino_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categoria_traduccion t WHERE t.categoria_id = c.id AND t.idioma_codigo = v.idioma
);
