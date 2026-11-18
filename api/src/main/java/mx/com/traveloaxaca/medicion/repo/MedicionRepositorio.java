package mx.com.traveloaxaca.medicion.repo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.CampanaDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.OrigenDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.OrigenMetricaDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.PuntoDiaDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL de la medición. Las funciones de la base (registrar_evento_uso, calcular_resumen_diario...) vienen del paso 1. */
@Repository
public class MedicionRepositorio {

    public record TipoPeriodoFila(boolean esActual, String tipo, int total) {
    }

    public record RankingFila(UUID negocioId, String slug, String nombre, String categoriaClave, int vistas,
                              int contactos, LocalDate ultimoContacto) {
    }

    public record TotalesFila(int vistas, int contactos) {
    }

    public record ReporteFila(UUID id, int anio, int mes, OffsetDateTime generadoEn, OffsetDateTime enviadoEn,
                              String datos) {
    }

    private final JdbcClient jdbc;

    public MedicionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- registro de eventos ----------------

    public boolean dispositivoExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM dispositivo WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    public List<UUID> negociosPublicados(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("SELECT id FROM negocio WHERE id IN (:ids) AND estado = 'publicada' AND eliminado_en IS NULL")
                .param("ids", ids).query(UUID.class).list();
    }

    public record SucursalFila(UUID id, UUID negocioId) {
    }

    public List<SucursalFila> sucursales(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("SELECT id, negocio_id FROM sucursal WHERE id IN (:ids) AND eliminado_en IS NULL")
                .param("ids", ids).query(SucursalFila.class).list();
    }

    /** Mismo dispositivo, negocio y tipo en los 30 segundos anteriores: es un doble toque. */
    public boolean hayRepetido(UUID dispositivo, UUID negocio, String tipo, OffsetDateTime ocurrido) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM evento_uso
                               WHERE dia >= CAST(:t AS date) - 2 AND dia <= CAST(:t AS date) + 2
                                 AND dispositivo_id = :d AND negocio_id = :n AND tipo = :tipo
                                 AND ocurrido_en > CAST(:t AS timestamptz) - interval '30 seconds'
                                 AND ocurrido_en <= CAST(:t AS timestamptz) + interval '30 seconds')""")
                .param("d", dispositivo).param("n", negocio).param("tipo", tipo).param("t", ocurrido)
                .query(Boolean.class).single();
    }

    /** Verdadero si se guardó (una vista repetida el mismo día no se guarda). */
    public boolean registrar(String tipo, UUID negocio, UUID dispositivo, String origen, String campana,
                             UUID sucursal, OffsetDateTime ocurrido) {
        return jdbc.sql("""
                SELECT registrar_evento_uso(:tipo, :n, :d, :o, :c, CAST(NULL AS uuid), :s, CAST(NULL AS uuid),
                                            CAST(NULL AS text),
                                            (CAST(:tipo AS text) IN ('impresion_destacado','clic_destacado')
                                             OR negocio_patrocinado_hoy(:n, CAST(:dia AS date))), :t)""")
                .param("tipo", tipo).param("n", negocio).param("d", dispositivo).param("o", origen)
                .param("c", campana).param("s", sucursal).param("t", ocurrido)
                .param("dia", ocurrido.atZoneSameInstant(java.time.ZoneId.of("America/Mexico_City")).toLocalDate())
                .query(Boolean.class).single();
    }

    // ---------------- métricas del negocio ----------------

    public Optional<String> zonaHoraria(UUID negocioId) {
        return jdbc.sql("SELECT d.zona_horaria FROM negocio n JOIN destino d ON d.id = n.destino_id WHERE n.id = :n")
                .param("n", negocioId).query(String.class).optional();
    }

    /** Totales por tipo del periodo actual (desde..hasta) y del anterior (prevDesde..desde-1). */
    public List<TipoPeriodoFila> totalesPorTipo(UUID negocio, LocalDate prevDesde, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                SELECT (dia >= :desde) AS es_actual, tipo, CAST(count(*) AS integer) AS total
                FROM evento_uso WHERE negocio_id = :n AND dia BETWEEN :prev AND :hasta
                GROUP BY 1, 2""")
                .param("n", negocio).param("prev", prevDesde).param("desde", desde).param("hasta", hasta)
                .query(TipoPeriodoFila.class).list();
    }

    public List<PuntoDiaDto> serie(UUID negocio, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                SELECT dia, CAST(count(*) FILTER (WHERE tipo = 'vista_ficha') AS integer) AS vistas,
                       CAST(count(*) FILTER (WHERE tipo = ANY (tipos_contacto())) AS integer) AS contactos
                FROM evento_uso WHERE negocio_id = :n AND dia BETWEEN :desde AND :hasta
                GROUP BY dia ORDER BY dia""")
                .param("n", negocio).param("desde", desde).param("hasta", hasta).query(PuntoDiaDto.class).list();
    }

    public List<OrigenMetricaDto> porOrigen(UUID negocio, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                SELECT o.clave, o.nombre,
                       CAST(count(*) FILTER (WHERE e.tipo = 'vista_ficha') AS integer) AS vistas,
                       CAST(count(*) FILTER (WHERE e.tipo = ANY (tipos_contacto())) AS integer) AS contactos
                FROM evento_uso e JOIN origen o ON o.id = e.origen_id
                WHERE e.negocio_id = :n AND e.dia BETWEEN :desde AND :hasta
                GROUP BY o.clave, o.nombre
                ORDER BY count(*) DESC, o.nombre""")
                .param("n", negocio).param("desde", desde).param("hasta", hasta).query(OrigenMetricaDto.class).list();
    }

    // ---------------- reportes mensuales ----------------

    public List<ReporteFila> reportes(UUID negocio) {
        return jdbc.sql("""
                SELECT id, CAST(anio AS integer) AS anio, CAST(mes AS integer) AS mes, generado_en, enviado_en,
                       CAST(datos AS text) AS datos
                FROM reporte_mensual WHERE negocio_id = :n ORDER BY anio DESC, mes DESC""")
                .param("n", negocio).query(ReporteFila.class).list();
    }

    public Optional<ReporteFila> reporte(UUID negocio, int anio, int mes) {
        return jdbc.sql("""
                SELECT id, CAST(anio AS integer) AS anio, CAST(mes AS integer) AS mes, generado_en, enviado_en,
                       CAST(datos AS text) AS datos
                FROM reporte_mensual WHERE negocio_id = :n AND anio = :a AND mes = :m""")
                .param("n", negocio).param("a", anio).param("m", mes).query(ReporteFila.class).optional();
    }

    /** Negocios publicados que todavía no tienen el reporte de ese mes. */
    public List<UUID> negociosSinReporte(int anio, int mes) {
        return jdbc.sql("""
                SELECT n.id FROM negocio n
                WHERE n.estado = 'publicada' AND n.eliminado_en IS NULL
                  AND NOT EXISTS (SELECT 1 FROM reporte_mensual r WHERE r.negocio_id = n.id AND r.anio = :a AND r.mes = :m)
                ORDER BY n.id""").param("a", anio).param("m", mes).query(UUID.class).list();
    }

    public void generarReporte(UUID negocio, int anio, int mes) {
        jdbc.sql("SELECT generar_reporte_mensual(:n, :a, :m)").param("n", negocio).param("a", anio).param("m", mes)
                .query(UUID.class).single();
    }

    public void calcularResumenDiario(LocalDate dia) {
        jdbc.sql("SELECT calcular_resumen_diario(:d, CAST(NULL AS uuid))").param("d", dia).query(Integer.class).single();
    }

    public void asegurarParticiones(int mesesAdelante) {
        jdbc.sql("SELECT asegurar_particiones_evento_uso(:m)").param("m", mesesAdelante).query(Integer.class).single();
    }

    public long filasEnParticionDeRespaldo() {
        return jdbc.sql("SELECT count(*) FROM evento_uso_default").query(Long.class).single();
    }

    // ---------------- métricas generales ----------------

    /**
     * Días pasados desde resumen_diario (lo calcula el trabajo nocturno) y hoy directo de evento_uso. Filtros opcionales
     * por región y categoría (la categoría padre incluye a sus hijas).
     */
    private static final String BASE = """
            WITH base AS (
              SELECT r.negocio_id, r.dia, r.tipo, r.total FROM resumen_diario r WHERE r.dia BETWEEN :desde AND :ayer
              UNION ALL
              SELECT e.negocio_id, e.dia, e.tipo, CAST(count(*) AS integer) FROM evento_uso e WHERE e.dia = :hoy
              GROUP BY e.negocio_id, e.dia, e.tipo)
            """;

    private static final String NEGOCIOS = """
            FROM negocio n
            JOIN categoria c ON c.id = n.categoria_id
            JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
            JOIN municipio mu ON mu.id = sp.municipio_id
            LEFT JOIN base b ON b.negocio_id = n.id
            WHERE n.estado = 'publicada' AND n.eliminado_en IS NULL""";

    private static String filtros(UUID regionId, UUID categoriaId, Map<String, Object> p) {
        StringBuilder sb = new StringBuilder();
        if (regionId != null) {
            p.put("region", regionId);
            sb.append(" AND mu.region_id = :region");
        }
        if (categoriaId != null) {
            p.put("categoria", categoriaId);
            sb.append(" AND (n.categoria_id = :categoria OR c.padre_id = :categoria)");
        }
        return sb.toString();
    }

    private static Map<String, Object> rango(LocalDate desde, LocalDate hoy) {
        Map<String, Object> p = new HashMap<>();
        p.put("desde", desde);
        p.put("ayer", hoy.minusDays(1));
        p.put("hoy", hoy);
        return p;
    }

    public List<RankingFila> ranking(LocalDate desde, LocalDate hoy, UUID regionId, UUID categoriaId, int limite) {
        Map<String, Object> p = rango(desde, hoy);
        p.put("limite", limite);
        String f = filtros(regionId, categoriaId, p);
        return jdbc.sql(BASE + """
                SELECT n.id AS negocio_id, n.slug, n.nombre_comercial AS nombre, c.clave AS categoria_clave,
                       CAST(COALESCE(sum(b.total) FILTER (WHERE b.tipo = 'vista_ficha'), 0) AS integer) AS vistas,
                       CAST(COALESCE(sum(b.total) FILTER (WHERE b.tipo = ANY (tipos_contacto())), 0) AS integer) AS contactos,
                       max(b.dia) FILTER (WHERE b.tipo = ANY (tipos_contacto())) AS ultimo_contacto
                """ + NEGOCIOS + f + """

                GROUP BY n.id, n.slug, n.nombre_comercial, c.clave
                ORDER BY vistas DESC, contactos DESC, n.nombre_comercial, n.id
                LIMIT :limite""").params(p).query(RankingFila.class).list();
    }

    public TotalesFila totales(LocalDate desde, LocalDate hoy, UUID regionId, UUID categoriaId) {
        Map<String, Object> p = rango(desde, hoy);
        String f = filtros(regionId, categoriaId, p);
        return jdbc.sql(BASE + """
                SELECT CAST(COALESCE(sum(b.total) FILTER (WHERE b.tipo = 'vista_ficha'), 0) AS integer) AS vistas,
                       CAST(COALESCE(sum(b.total) FILTER (WHERE b.tipo = ANY (tipos_contacto())), 0) AS integer) AS contactos
                """ + NEGOCIOS + f).params(p).query(TotalesFila.class).single();
    }

    public int dispositivosActivos(LocalDate desde, LocalDate hoy, UUID regionId, UUID categoriaId) {
        Map<String, Object> p = new HashMap<>();
        p.put("desde", desde);
        p.put("hoy", hoy);
        StringBuilder f = new StringBuilder();
        if (regionId != null) {
            p.put("region", regionId);
            f.append(" AND mu.region_id = :region");
        }
        if (categoriaId != null) {
            p.put("categoria", categoriaId);
            f.append(" AND (n.categoria_id = :categoria OR c.padre_id = :categoria)");
        }
        return jdbc.sql("""
                SELECT CAST(count(DISTINCT e.dispositivo_id) AS integer)
                FROM evento_uso e
                JOIN negocio n ON n.id = e.negocio_id
                JOIN categoria c ON c.id = n.categoria_id
                JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                JOIN municipio mu ON mu.id = sp.municipio_id
                WHERE e.dia BETWEEN :desde AND :hoy""" + f).params(p).query(Integer.class).single();
    }

    // ---------------- campañas ----------------

    public List<OrigenDto> origenes() {
        return jdbc.sql("SELECT clave, nombre FROM origen WHERE activo ORDER BY nombre").query(OrigenDto.class).list();
    }

    public Optional<UUID> origenId(String clave) {
        return jdbc.sql("SELECT id FROM origen WHERE clave = :c AND activo").param("c", clave).query(UUID.class).optional();
    }

    private static final String CAMPANA = """
            SELECT c.id, o.clave AS origen_clave, o.nombre AS origen_nombre, c.codigo, c.nombre, c.inicio, c.fin,
                   CAST(COALESCE(s.vistas, 0) AS integer) AS vistas, CAST(COALESCE(s.contactos, 0) AS integer) AS contactos
            FROM campana_origen c JOIN origen o ON o.id = c.origen_id
            LEFT JOIN LATERAL (
              SELECT count(*) FILTER (WHERE e.tipo = 'vista_ficha') AS vistas,
                     count(*) FILTER (WHERE e.tipo = ANY (tipos_contacto())) AS contactos
              FROM evento_uso e WHERE e.campana_id = c.id) s ON true
            """;

    public List<CampanaDto> campanas() {
        return jdbc.sql(CAMPANA + " ORDER BY c.creado_en DESC, c.id").query(CampanaDto.class).list();
    }

    public Optional<CampanaDto> campana(UUID id) {
        return jdbc.sql(CAMPANA + " WHERE c.id = :id").param("id", id).query(CampanaDto.class).optional();
    }

    public boolean codigoExiste(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM campana_origen WHERE codigo = :c)").param("c", codigo)
                .query(Boolean.class).single();
    }

    public UUID crearCampana(UUID origenId, String codigo, String nombre, LocalDate inicio, LocalDate fin) {
        return jdbc.sql("INSERT INTO campana_origen (origen_id, codigo, nombre, inicio, fin) VALUES (:o, :c, :n, :i, :f) RETURNING id")
                .param("o", origenId).param("c", codigo).param("n", nombre).param("i", inicio).param("f", fin)
                .query(UUID.class).single();
    }

    public int actualizarCampana(UUID id, UUID origenId, String nombre, LocalDate inicio, LocalDate fin) {
        return jdbc.sql("UPDATE campana_origen SET origen_id = :o, nombre = :n, inicio = :i, fin = :f WHERE id = :id")
                .param("id", id).param("o", origenId).param("n", nombre).param("i", inicio).param("f", fin).update();
    }
}
