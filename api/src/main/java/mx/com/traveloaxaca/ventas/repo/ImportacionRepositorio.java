package mx.com.traveloaxaca.ventas.repo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL de las importaciones: el registro de cada carga, los catálogos que se consultan y las altas de contenido. */
@Repository
public class ImportacionRepositorio {

    public record Fila(UUID id, String tipo, String archivo, String estado, int totalFilas, int filasOk,
                       int filasError, String errores, String contenido, OffsetDateTime creadoEn,
                       OffsetDateTime finalizadaEn) {
    }

    public record Opcion(UUID id, String clave, String nombre) {
    }

    private static final String SELECT = """
            SELECT id, tipo, archivo, estado, total_filas, filas_ok, filas_error, CAST(errores AS text) AS errores,
                   contenido, creado_en, finalizada_en
            FROM importacion""";

    private final JdbcClient jdbc;

    public ImportacionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- registro de cargas ----------------

    public UUID crear(String tipo, String archivo, String contenido, int total, int ok, int error, String erroresJson,
                      UUID usuarioId) {
        return jdbc.sql("""
                INSERT INTO importacion (tipo, archivo, estado, contenido, total_filas, filas_ok, filas_error, errores,
                                         creada_por)
                VALUES (:t, :a, 'validando', :c, :total, :ok, :err, CAST(:e AS jsonb), :u) RETURNING id""")
                .param("t", tipo).param("a", archivo).param("c", contenido).param("total", total).param("ok", ok)
                .param("err", error).param("e", erroresJson).param("u", usuarioId).query(UUID.class).single();
    }

    public Optional<Fila> porId(UUID id) {
        return jdbc.sql(SELECT + "\n WHERE id = :id").param("id", id).query(Fila.class).optional();
    }

    public Optional<Fila> bloquear(UUID id) {
        return jdbc.sql(SELECT + " WHERE id = :id FOR UPDATE").param("id", id).query(Fila.class).optional();
    }

    public List<Fila> listar(List<String> tipos, int limite, int desplazamiento) {
        return jdbc.sql(SELECT + " WHERE tipo IN (:tipos) ORDER BY creado_en DESC LIMIT :l OFFSET :d")
                .param("tipos", tipos).param("l", limite).param("d", desplazamiento).query(Fila.class).list();
    }

    public long contar(List<String> tipos) {
        return jdbc.sql("SELECT count(*) FROM importacion WHERE tipo IN (:tipos)").param("tipos", tipos)
                .query(Long.class).single();
    }

    public void finalizar(UUID id, String estado, int total, int ok, int error, String erroresJson) {
        jdbc.sql("""
                UPDATE importacion SET estado = :s, total_filas = :t, filas_ok = :ok, filas_error = :e,
                       errores = CAST(:j AS jsonb), contenido = NULL, finalizada_en = now()
                WHERE id = :id""")
                .param("s", estado).param("t", total).param("ok", ok).param("e", error).param("j", erroresJson)
                .param("id", id).update();
    }

    // ---------------- catálogos ----------------

    public List<Opcion> categorias() {
        return jdbc.sql("""
                SELECT c.id, c.clave, COALESCE(ct.nombre, c.clave) AS nombre
                FROM categoria c LEFT JOIN categoria_traduccion ct ON ct.categoria_id = c.id AND ct.idioma_codigo = 'es'
                WHERE c.activa""").query(Opcion.class).list();
    }

    /** En municipios, "clave" es la clave INEGI (puede ser nula). */
    public List<Opcion> municipios() {
        return jdbc.sql("SELECT id, clave_inegi AS clave, nombre FROM municipio WHERE activo")
                .query(Opcion.class).list();
    }

    public List<UUID> localidades(UUID municipioId, String nombre) {
        return jdbc.sql("""
                SELECT id FROM localidad WHERE municipio_id = :m AND activo
                  AND f_unaccent(lower(nombre)) = f_unaccent(lower(:n))""")
                .param("m", municipioId).param("n", nombre).query(UUID.class).list();
    }

    // ---------------- duplicados ----------------

    public boolean negocioExiste(String nombre, UUID municipioId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM negocio n
                  JOIN sucursal s ON s.negocio_id = n.id AND s.es_principal AND s.eliminado_en IS NULL
                  WHERE n.eliminado_en IS NULL AND s.municipio_id = :m
                    AND f_unaccent(lower(n.nombre_comercial)) = f_unaccent(lower(:n)))""")
                .param("m", municipioId).param("n", nombre).query(Boolean.class).single();
    }

    public boolean lugarExiste(String nombre, UUID municipioId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM lugar l JOIN lugar_traduccion t ON t.lugar_id = l.id AND t.idioma_codigo = 'es'
                  WHERE l.eliminado_en IS NULL AND l.municipio_id = :m
                    AND f_unaccent(lower(t.nombre)) = f_unaccent(lower(:n)))""")
                .param("m", municipioId).param("n", nombre).query(Boolean.class).single();
    }

    public boolean eventoExiste(String nombre, UUID municipioId, LocalDate inicio) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM evento e JOIN evento_traduccion t ON t.evento_id = e.id AND t.idioma_codigo = 'es'
                  WHERE e.eliminado_en IS NULL AND e.municipio_id = :m AND e.fecha_inicio = :f
                    AND f_unaccent(lower(t.nombre)) = f_unaccent(lower(:n)))""")
                .param("m", municipioId).param("f", inicio).param("n", nombre).query(Boolean.class).single();
    }

    // ---------------- altas ----------------

    public void completarSucursal(UUID negocioId, UUID localidadId, String direccion, Double lat, Double lng) {
        jdbc.sql("""
                UPDATE sucursal SET localidad_id = :l, direccion_texto = :d,
                       ubicacion = CASE WHEN CAST(:lat AS double precision) IS NULL THEN NULL
                                   ELSE CAST(ST_SetSRID(ST_MakePoint(CAST(:lng AS double precision),
                                        CAST(:lat AS double precision)), 4326) AS geography) END
                WHERE negocio_id = :n AND es_principal AND eliminado_en IS NULL""")
                .param("l", localidadId).param("d", direccion).param("lat", lat).param("lng", lng)
                .param("n", negocioId).update();
    }

    public List<String> slugs(String tabla, UUID destinoId, String base) {
        String t = "lugar".equals(tabla) ? "lugar" : "evento";
        return jdbc.sql("SELECT slug FROM " + t + "\n" + """
                 WHERE destino_id = :d AND eliminado_en IS NULL AND (slug = :b OR slug LIKE :p)""")
                .param("d", destinoId).param("b", base).param("p", base.replace("_", "\\_") + "-%")
                .query(String.class).list();
    }

    public UUID crearLugar(UUID destinoId, UUID municipioId, String slug, String tipo, Double lat, Double lng) {
        return jdbc.sql("""
                INSERT INTO lugar (destino_id, municipio_id, slug, tipo, ubicacion)
                VALUES (:d, :m, :s, :t, CASE WHEN CAST(:lat AS double precision) IS NULL THEN NULL
                        ELSE CAST(ST_SetSRID(ST_MakePoint(CAST(:lng AS double precision),
                             CAST(:lat AS double precision)), 4326) AS geography) END)
                RETURNING id""")
                .param("d", destinoId).param("m", municipioId).param("s", slug).param("t", tipo)
                .param("lat", lat).param("lng", lng).query(UUID.class).single();
    }

    public void traduccionLugar(UUID lugarId, String idioma, String nombre, String resumen) {
        jdbc.sql("INSERT INTO lugar_traduccion (lugar_id, idioma_codigo, nombre, resumen) VALUES (:l, :i, :n, :r)")
                .param("l", lugarId).param("i", idioma).param("n", nombre).param("r", resumen).update();
    }

    public UUID crearEvento(UUID destinoId, UUID municipioId, String slug, LocalDate inicio, LocalDate fin, Double lat,
                            Double lng) {
        return jdbc.sql("""
                INSERT INTO evento (destino_id, municipio_id, slug, fecha_inicio, fecha_fin, ubicacion)
                VALUES (:d, :m, :s, :i, :f, CASE WHEN CAST(:lat AS double precision) IS NULL THEN NULL
                        ELSE CAST(ST_SetSRID(ST_MakePoint(CAST(:lng AS double precision),
                             CAST(:lat AS double precision)), 4326) AS geography) END)
                RETURNING id""")
                .param("d", destinoId).param("m", municipioId).param("s", slug).param("i", inicio).param("f", fin)
                .param("lat", lat).param("lng", lng).query(UUID.class).single();
    }

    public void traduccionEvento(UUID eventoId, String idioma, String nombre, String descripcion) {
        jdbc.sql("INSERT INTO evento_traduccion (evento_id, idioma_codigo, nombre, descripcion) VALUES (:e, :i, :n, :d)")
                .param("e", eventoId).param("i", idioma).param("n", nombre).param("d", descripcion).update();
    }
}
