-- Paso 10A: web pública.
-- Categorías de bares y artesanías, servicios que el visitante filtra, sección y marcas en el menú,
-- y datos propios de lugares y eventos (costo de entrada, horario, mejor época...).

-- ---------------------------------------------------------------------
-- Categorías nuevas: Bares y vida nocturna, Artesanías y compras
-- ---------------------------------------------------------------------
INSERT INTO categoria (clave, orden) VALUES ('vida_nocturna', 4), ('compras', 5);

INSERT INTO categoria (padre_id, clave, orden)
SELECT p.id, v.clave, v.orden
FROM (VALUES
  ('vida_nocturna', 'bar', 1), ('vida_nocturna', 'mezcaleria', 2), ('vida_nocturna', 'musica_en_vivo', 3),
  ('compras', 'barro_negro', 1), ('compras', 'textil', 2), ('compras', 'alebrijes', 3),
  ('compras', 'mezcal', 4), ('compras', 'otra_artesania', 5)
) AS v(padre, clave, orden)
JOIN categoria p ON p.clave = v.padre AND p.destino_id IS NULL;

INSERT INTO categoria_traduccion (categoria_id, idioma_codigo, nombre)
SELECT c.id, v.idioma, v.nombre
FROM (VALUES
  ('vida_nocturna', 'es', 'Bares y vida nocturna'), ('vida_nocturna', 'en', 'Bars and nightlife'),
  ('compras', 'es', 'Artesanías y compras'), ('compras', 'en', 'Crafts and shopping'),
  ('bar', 'es', 'Bar'), ('bar', 'en', 'Bar'),
  ('mezcaleria', 'es', 'Mezcalería'), ('mezcaleria', 'en', 'Mezcal bar'),
  ('musica_en_vivo', 'es', 'Música en vivo'), ('musica_en_vivo', 'en', 'Live music'),
  ('barro_negro', 'es', 'Barro negro'), ('barro_negro', 'en', 'Black clay pottery'),
  ('textil', 'es', 'Textiles'), ('textil', 'en', 'Textiles'),
  ('alebrijes', 'es', 'Alebrijes'), ('alebrijes', 'en', 'Alebrijes'),
  ('mezcal', 'es', 'Mezcal'), ('mezcal', 'en', 'Mezcal'),
  ('otra_artesania', 'es', 'Otras artesanías'), ('otra_artesania', 'en', 'Other crafts')
) AS v(clave, idioma, nombre)
JOIN categoria c ON c.clave = v.clave AND c.destino_id IS NULL;

-- Tres destacados por categoría principal, igual que las demás.
INSERT INTO espacio_patrocinio (destino_id, clave, categoria_id, max_simultaneos)
SELECT d.id, 'destacado_categoria', c.id, 3
FROM destino d, categoria c
WHERE d.codigo = 'oaxaca' AND c.destino_id IS NULL AND c.padre_id IS NULL
  AND c.clave IN ('vida_nocturna', 'compras');

-- ---------------------------------------------------------------------
-- Servicios que se pueden filtrar
-- ---------------------------------------------------------------------
INSERT INTO servicio (clave, grupo) VALUES
  ('solo_efectivo', 'general'), ('acepta_reservaciones', 'general'), ('domicilio', 'comida'),
  ('musica_en_vivo', 'general'), ('hecho_a_mano', 'general'), ('envios', 'general'),
  ('taller_visitable', 'general');

INSERT INTO servicio_traduccion (servicio_id, idioma_codigo, nombre)
SELECT s.id, v.idioma, v.nombre
FROM (VALUES
  ('solo_efectivo', 'es', 'Solo efectivo'), ('solo_efectivo', 'en', 'Cash only'),
  ('acepta_reservaciones', 'es', 'Acepta reservaciones'), ('acepta_reservaciones', 'en', 'Reservations accepted'),
  ('domicilio', 'es', 'Entrega a domicilio'), ('domicilio', 'en', 'Delivery'),
  ('musica_en_vivo', 'es', 'Música en vivo'), ('musica_en_vivo', 'en', 'Live music'),
  ('hecho_a_mano', 'es', 'Hecho a mano'), ('hecho_a_mano', 'en', 'Handmade'),
  ('envios', 'es', 'Hace envíos'), ('envios', 'en', 'Ships orders'),
  ('taller_visitable', 'es', 'Se visita el taller'), ('taller_visitable', 'en', 'Workshop visits')
) AS v(clave, idioma, nombre)
JOIN servicio s ON s.clave = v.clave;

-- ---------------------------------------------------------------------
-- Menú: sección y marcas por platillo
-- ---------------------------------------------------------------------
ALTER TABLE oferta ADD COLUMN seccion text
  CHECK (seccion IS NULL OR seccion IN ('entradas', 'platos_fuertes', 'bebidas', 'postres', 'otros'));
ALTER TABLE oferta ADD COLUMN etiquetas text[] NOT NULL DEFAULT '{}'
  CHECK (etiquetas <@ ARRAY['vegetariano', 'picante', 'sin_gluten']::text[] AND cardinality(etiquetas) <= 3);
COMMENT ON COLUMN oferta.seccion IS 'Solo para platillos. Las etiquetas visibles se traducen en la web.';

-- ---------------------------------------------------------------------
-- Lugares y eventos: datos propios y textos de ayuda al visitante
-- ---------------------------------------------------------------------
ALTER TABLE lugar ADD COLUMN datos jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(datos) = 'object');
COMMENT ON COLUMN lugar.datos IS 'entrada (gratis|con_costo), costoNacional, costoExtranjero, diasAbierto, horarioTexto, accesible, dificultad. La app los valida.';

ALTER TABLE lugar_traduccion ADD COLUMN mejor_epoca text CHECK (length(mejor_epoca) <= 300);
ALTER TABLE lugar_traduccion ADD COLUMN como_llegar text CHECK (length(como_llegar) <= 2000);

ALTER TABLE evento ADD COLUMN datos jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(datos) = 'object');
COMMENT ON COLUMN evento.datos IS 'gratis, costoTexto, horaInicio, horaFin, sede. La app los valida.';
