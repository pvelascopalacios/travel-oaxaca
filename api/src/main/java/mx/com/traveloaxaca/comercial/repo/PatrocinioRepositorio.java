package mx.com.traveloaxaca.comercial.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.EspacioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PatrocinioDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Espacios de patrocinio, patrocinios y lo que se muestra como destacado. */
@Repository
public class PatrocinioRepositorio {

    private static final String PATROCINIO_SELECT = """
            SELECT p.id, p.espacio_id, e.clave AS espacio_clave, p.negocio_id, n.nombre_comercial AS negocio_nombre,
                   p.inicio, p.fin, p.estado, p.precio, CAST(p.moneda AS text) AS moneda, p.pago_id
            FROM patrocinio p
            JOIN espacio_patrocinio e ON e.id = p.espacio_id
            JOIN negocio n ON n.id = p.negocio_id""";

    private final JdbcClient jdbc;

    public PatrocinioRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- espacios ----------------

    public List<EspacioDto> espacios() {
        return jdbc.sql("""
                SELECT id, destino_id, clave, categoria_id, region_id, max_simultaneos, activo
                FROM espacio_patrocinio ORDER BY clave, categoria_id NULLS FIRST, region_id NULLS FIRST""")
                .query(EspacioDto.class).list();
    }

    public Optional<EspacioDto> espacio(UUID id) {
        return jdbc.sql("""
                SELECT id, destino_id, clave, categoria_id, region_id, max_simultaneos, activo
                FROM espacio_patrocinio WHERE id = :id""").param("id", id).query(EspacioDto.class).optional();
    }

    public boolean destinoExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM destino WHERE id = :id AND activo)").param("id", id)
                .query(Boolean.class).single();
    }

    public Optional<UUID> destinoPorCodigo(String codigo) {
        return jdbc.sql("SELECT id FROM destino WHERE codigo = :c AND activo").param("c", codigo)
                .query(UUID.class).optional();
    }

    public UUID crearEspacio(UUID destinoId, String clave, UUID categoriaId, UUID regionId, int max, boolean activo) {
        return jdbc.sql("""
                INSERT INTO espacio_patrocinio (destino_id, clave, categoria_id, region_id, max_simultaneos, activo)
                VALUES (:d, :c, :cat, :r, :m, :a) RETURNING id""")
                .param("d", destinoId).param("c", clave).param("cat", categoriaId).param("r", regionId)
                .param("m", max).param("a", activo).query(UUID.class).single();
    }

    public void actualizarEspacio(UUID id, int max, boolean activo) {
        jdbc.sql("UPDATE espacio_patrocinio SET max_simultaneos = :m, activo = :a WHERE id = :id")
                .param("m", max).param("a", activo).param("id", id).update();
    }

    // ---------------- patrocinios ----------------

    public Optional<PatrocinioDto> patrocinio(UUID id) {
        return jdbc.sql(PATROCINIO_SELECT + " WHERE p.id = :id").param("id", id).query(PatrocinioDto.class).optional();
    }

    public Optional<PatrocinioDto> patrocinioBloqueado(UUID id) {
        return jdbc.sql("""
                SELECT p.id, p.espacio_id, e.clave AS espacio_clave, p.negocio_id, n.nombre_comercial AS negocio_nombre,
                       p.inicio, p.fin, p.estado, p.precio, CAST(p.moneda AS text) AS moneda, p.pago_id
                FROM patrocinio p
                JOIN espacio_patrocinio e ON e.id = p.espacio_id
                JOIN negocio n ON n.id = p.negocio_id
                WHERE p.id = :id FOR UPDATE OF p""").param("id", id).query(PatrocinioDto.class).optional();
    }

    /** Calendario: lo que toca el rango, con filtros opcionales. */
    public List<PatrocinioDto> calendario(LocalDate desde, LocalDate hasta, UUID espacioId, UUID negocioId,
                                          boolean soloVigentes) {
        return jdbc.sql(PATROCINIO_SELECT + "\n" + """
                 WHERE p.fin >= :d AND p.inicio <= :h
                   AND (CAST(:e AS uuid) IS NULL OR p.espacio_id = :e)
                   AND (CAST(:n AS uuid) IS NULL OR p.negocio_id = :n)
                   AND (:v = false OR p.estado IN ('programado','activo'))
                 ORDER BY p.inicio, e.clave, n.nombre_comercial LIMIT 500""")
                .param("d", desde).param("h", hasta).param("e", espacioId).param("n", negocioId).param("v", soloVigentes)
                .query(PatrocinioDto.class).list();
    }

    public List<PatrocinioDto> deNegocio(UUID negocioId) {
        return jdbc.sql(PATROCINIO_SELECT + " WHERE p.negocio_id = :n ORDER BY p.inicio DESC LIMIT 100")
                .param("n", negocioId).query(PatrocinioDto.class).list();
    }

    public UUID crear(UUID espacioId, UUID negocioId, LocalDate inicio, LocalDate fin, BigDecimal precio,
                      String estado, UUID creadoPor) {
        return jdbc.sql("""
                INSERT INTO patrocinio (espacio_id, negocio_id, inicio, fin, estado, precio, creado_por)
                VALUES (:e, :n, :i, :f, :s, :p, :u) RETURNING id""")
                .param("e", espacioId).param("n", negocioId).param("i", inicio).param("f", fin).param("s", estado)
                .param("p", precio).param("u", creadoPor).query(UUID.class).single();
    }

    public void cambiarEstado(UUID id, String estado) {
        jdbc.sql("UPDATE patrocinio SET estado = :e WHERE id = :id").param("e", estado).param("id", id).update();
    }

    /** Cuántos patrocinios simultáneos hay ya en el espacio cada día del rango; para decir cuánto cupo queda. */
    public int picoDeOcupacion(UUID espacioId, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                SELECT COALESCE(max(c), 0) FROM (
                  SELECT d::date AS dia, CAST(count(*) AS integer) AS c
                  FROM generate_series(CAST(:d AS date), CAST(:h AS date), interval '1 day') d
                  JOIN patrocinio x ON x.espacio_id = :e AND x.estado IN ('programado','activo')
                                   AND d::date BETWEEN x.inicio AND x.fin
                  GROUP BY d::date) t""")
                .param("d", desde).param("h", hasta).param("e", espacioId).query(Integer.class).single();
    }

    // ---------------- destacados públicos ----------------

    /**
     * Negocios patrocinados hoy en un tipo de espacio. Se ordenan con una mezcla que cambia cada hora para que
     * ninguno se quede siempre arriba.
     */
    public List<UUID> destacados(String claveEspacio, String destinoCodigo, UUID categoriaId, UUID regionId,
                                 int limite, String semilla, LocalDate hoy) {
        return jdbc.sql("""
                SELECT negocio_id FROM (
                  SELECT DISTINCT ON (pv.negocio_id) pv.negocio_id, md5(pv.negocio_id::text || CAST(:s AS text)) AS orden
                  FROM patrocinio pv
                  JOIN espacio_patrocinio e ON e.id = pv.espacio_id AND e.activo
                  JOIN destino d ON d.id = e.destino_id AND d.codigo = :dc
                  JOIN negocio n ON n.id = pv.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
                  LEFT JOIN categoria c ON c.id = n.categoria_id
                  WHERE e.clave = :clave AND pv.estado = 'activo'
                    AND CAST(:hoy AS date) BETWEEN pv.inicio AND pv.fin
                    AND (e.categoria_id IS NULL OR e.categoria_id = n.categoria_id OR e.categoria_id = c.padre_id)
                    AND (CAST(:cat AS uuid) IS NULL OR n.categoria_id = :cat OR c.padre_id = :cat)
                    AND (e.region_id IS NULL OR EXISTS (
                           SELECT 1 FROM sucursal s JOIN municipio m ON m.id = s.municipio_id
                           WHERE s.negocio_id = n.id AND s.es_principal AND s.eliminado_en IS NULL
                             AND m.region_id = e.region_id))
                    AND (CAST(:reg AS uuid) IS NULL OR EXISTS (
                           SELECT 1 FROM sucursal s2 JOIN municipio m2 ON m2.id = s2.municipio_id
                           WHERE s2.negocio_id = n.id AND s2.es_principal AND s2.eliminado_en IS NULL
                             AND m2.region_id = :reg))
                  ORDER BY pv.negocio_id) t
                ORDER BY orden LIMIT :lim""")
                .param("clave", claveEspacio).param("dc", destinoCodigo).param("cat", categoriaId)
                .param("reg", regionId).param("lim", limite).param("s", semilla).param("hoy", hoy)
                .query(UUID.class).list();
    }

    public boolean patrocinadoHoy(UUID negocioId, LocalDate hoy) {
        return jdbc.sql("SELECT negocio_patrocinado_hoy(:n, CAST(:h AS date))").param("n", negocioId).param("h", hoy)
                .query(Boolean.class).single();
    }
}
