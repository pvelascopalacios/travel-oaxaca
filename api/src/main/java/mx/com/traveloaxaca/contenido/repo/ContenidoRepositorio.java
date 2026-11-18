package mx.com.traveloaxaca.contenido.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.ContenidoResumenDto;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.ParadaEntradaDto;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.TextoEventoDto;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.TextoLugarDto;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.TextoRutaDto;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Escritura y lectura editorial de lugares, rutas y eventos (incluye borradores y archivados). */
@Repository
public class ContenidoRepositorio {

    /** Las tablas de cada tipo; nunca viene del usuario. */
    public enum Tipo {
        LUGAR("lugar", "lugar_traduccion", "lugar_id"),
        RUTA("ruta", "ruta_traduccion", "ruta_id"),
        EVENTO("evento", "evento_traduccion", "evento_id");

        final String tabla;
        final String traduccion;
        final String fk;

        Tipo(String tabla, String traduccion, String fk) {
            this.tabla = tabla;
            this.traduccion = traduccion;
            this.fk = fk;
        }
    }

    public record LugarFila(UUID id, String slug, String tipo, UUID municipioId, UUID padreId, Double latitud,
                            Double longitud, boolean destacado, String estado, String datos,
                            OffsetDateTime actualizadoEn) {
    }

    public record RutaFila(UUID id, String slug, BigDecimal duracionHoras, BigDecimal distanciaKm, String dificultad,
                           String transporte, boolean esPremium, String estado, OffsetDateTime actualizadoEn) {
    }

    public record EventoFila(UUID id, String slug, LocalDate fechaInicio, LocalDate fechaFin, UUID municipioId,
                             UUID temporadaId, Double latitud, Double longitud, String estado, String datos,
                             OffsetDateTime actualizadoEn) {
    }

    private final JdbcClient jdbc;

    public ContenidoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- comunes ----------------

    private static String punto(Double lat, Double lng) {
        return (lat == null || lng == null) ? "CAST(NULL AS geography)"
                : "CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)";
    }

    private static Map<String, Object> con(Map<String, Object> p, Double lat, Double lng) {
        if (lat != null && lng != null) {
            p.put("lat", lat);
            p.put("lng", lng);
        }
        return p;
    }

    public Optional<UUID> destinoPorDefecto() {
        return jdbc.sql("SELECT id FROM destino WHERE activo ORDER BY creado_en LIMIT 1").query(UUID.class).optional();
    }

    public boolean existe(String tabla, UUID id) {
        String t = switch (tabla) {
            case "municipio", "temporada", "negocio", "lugar" -> tabla;
            default -> throw new IllegalArgumentException(tabla);
        };
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM " + t + " WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    /** Cuántos de estos negocios existen (publicados o no): sirve para validar listas. */
    public int contarNegocios(List<UUID> ids) {
        if (ids.isEmpty()) {
            return 0;
        }
        return jdbc.sql("SELECT count(*) FROM negocio WHERE id IN (:ids) AND eliminado_en IS NULL")
                .param("ids", ids).query(Integer.class).single();
    }

    public List<String> slugsUsados(Tipo t, UUID destinoId, String base) {
        return jdbc.sql("SELECT slug FROM " + t.tabla + " WHERE destino_id = :d AND eliminado_en IS NULL AND (slug = :b OR slug LIKE :p ESCAPE '\\')")
                .param("d", destinoId).param("b", base).param("p", CatalogoRepositorio.escapar(base) + "-%")
                .query(String.class).list();
    }

    public boolean estaActivo(Tipo t, UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM " + t.tabla + " WHERE id = :id AND eliminado_en IS NULL)")
                .param("id", id).query(Boolean.class).single();
    }

    public void cambiarEstado(Tipo t, UUID id, String estado) {
        jdbc.sql("UPDATE " + t.tabla + " SET estado = :e WHERE id = :id").param("e", estado).param("id", id).update();
    }

    public void archivar(Tipo t, UUID id, String estadoArchivado) {
        jdbc.sql("UPDATE " + t.tabla + " SET estado = :e, eliminado_en = now() WHERE id = :id AND eliminado_en IS NULL")
                .param("e", estadoArchivado).param("id", id).update();
    }

    public long contar(Tipo t, String estado, String q) {
        Map<String, Object> p = new HashMap<>();
        return jdbc.sql("SELECT count(*) FROM (" + listadoBase(t, estado, q, p) + ") x").params(p)
                .query(Long.class).single();
    }

    public List<ContenidoResumenDto> listar(Tipo t, String estado, String q, int limite, int desplazamiento) {
        Map<String, Object> p = new HashMap<>();
        p.put("limite", limite);
        p.put("desplazamiento", desplazamiento);
        return jdbc.sql(listadoBase(t, estado, q, p) + " ORDER BY x.actualizado_en DESC, x.id LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(ContenidoResumenDto.class).list();
    }

    private static String listadoBase(Tipo t, String estado, String q, Map<String, Object> p) {
        StringBuilder sb = new StringBuilder("SELECT x.id, x.slug, tr.nombre, x.estado, x.actualizado_en FROM " + t.tabla
                + " x JOIN " + t.traduccion + " tr ON tr." + t.fk + " = x.id AND tr.idioma_codigo = 'es' WHERE x.eliminado_en IS NULL");
        if (estado != null) {
            p.put("estado", estado);
            sb.append(" AND x.estado = :estado");
        }
        if (q != null) {
            p.put("qlike", "%" + CatalogoRepositorio.escapar(q) + "%");
            sb.append(" AND f_unaccent(tr.nombre) ILIKE f_unaccent(:qlike)");
        }
        return sb.toString();
    }

    // ---------------- lugares ----------------

    public void insertarLugar(UUID id, UUID destinoId, String slug, String tipo, UUID municipioId, UUID padreId,
                              Double lat, Double lng, boolean destacado, String datosJson) {
        Map<String, Object> p = con(new HashMap<>(), lat, lng);
        p.put("id", id);
        p.put("d", destinoId);
        p.put("s", slug);
        p.put("t", tipo);
        p.put("m", municipioId);
        p.put("pa", padreId);
        p.put("de", destacado);
        p.put("datos", datosJson);
        jdbc.sql("INSERT INTO lugar (id, destino_id, slug, tipo, municipio_id, padre_id, ubicacion, destacado, datos, estado) "
                + "VALUES (:id, :d, :s, :t, :m, :pa, " + punto(lat, lng) + ", :de, CAST(:datos AS jsonb), 'borrador')").params(p).update();
    }

    public void actualizarLugar(UUID id, String tipo, UUID municipioId, UUID padreId, Double lat, Double lng,
                                boolean destacado, String datosJson) {
        Map<String, Object> p = con(new HashMap<>(), lat, lng);
        p.put("id", id);
        p.put("t", tipo);
        p.put("m", municipioId);
        p.put("pa", padreId);
        p.put("de", destacado);
        p.put("datos", datosJson);
        jdbc.sql("UPDATE lugar SET tipo = :t, municipio_id = :m, padre_id = :pa, ubicacion = " + punto(lat, lng)
                + ", destacado = :de, datos = CAST(:datos AS jsonb) WHERE id = :id AND eliminado_en IS NULL").params(p).update();
    }

    public Optional<LugarFila> lugar(UUID id) {
        return jdbc.sql("""
                SELECT id, slug, tipo, municipio_id, padre_id, ST_Y(ubicacion::geometry) AS latitud,
                       ST_X(ubicacion::geometry) AS longitud, destacado, estado, datos::text AS datos, actualizado_en
                FROM lugar WHERE id = :id AND eliminado_en IS NULL""").param("id", id).query(LugarFila.class).optional();
    }

    public void reemplazarTextosLugar(UUID id, Map<String, TextoLugarDto> textos) {
        jdbc.sql("DELETE FROM lugar_traduccion WHERE lugar_id = :id").param("id", id).update();
        textos.forEach((idioma, t) -> jdbc.sql("""
                INSERT INTO lugar_traduccion (lugar_id, idioma_codigo, nombre, resumen, historia, recomendaciones,
                                              mejor_epoca, como_llegar)
                VALUES (:id, :i, :n, :r, :h, :rc, :me, :cl)""").param("id", id).param("i", idioma).param("n", t.nombre().trim())
                .param("r", vacioANulo(t.resumen())).param("h", vacioANulo(t.historia()))
                .param("rc", vacioANulo(t.recomendaciones())).param("me", vacioANulo(t.mejorEpoca()))
                .param("cl", vacioANulo(t.comoLlegar())).update());
    }

    public Map<String, TextoLugarDto> textosLugar(UUID id) {
        Map<String, TextoLugarDto> r = new LinkedHashMap<>();
        jdbc.sql("SELECT idioma_codigo, nombre, resumen, historia, recomendaciones, CAST(NULL AS text) AS descripcion, mejor_epoca, como_llegar FROM lugar_traduccion WHERE lugar_id = :id ORDER BY idioma_codigo")
                .param("id", id).query(TextoFila.class).list()
                .forEach(f -> r.put(f.idiomaCodigo(), new TextoLugarDto(f.nombre(), f.resumen(), f.historia(),
                        f.recomendaciones(), f.mejorEpoca(), f.comoLlegar())));
        return r;
    }

    public record TextoFila(String idiomaCodigo, String nombre, String resumen, String historia, String recomendaciones,
                            String descripcion, String mejorEpoca, String comoLlegar) {
    }

    public List<UUID> medioIdsLugar(UUID id) {
        return jdbc.sql("SELECT medio_id FROM lugar_medio WHERE lugar_id = :id ORDER BY orden, creado_en")
                .param("id", id).query(UUID.class).list();
    }

    /** Fotos ya confirmadas (con hash) y no eliminadas. */
    public int contarMediosValidos(List<UUID> ids) {
        if (ids.isEmpty()) {
            return 0;
        }
        return jdbc.sql("SELECT count(*) FROM medio WHERE id IN (:ids) AND tipo = 'imagen' AND hash IS NOT NULL AND eliminado_en IS NULL")
                .param("ids", ids).query(Integer.class).single();
    }

    public void reemplazarMediosLugar(UUID id, List<UUID> medioIds, UUID revisor) {
        jdbc.sql("DELETE FROM lugar_medio WHERE lugar_id = :id").param("id", id).update();
        int orden = 0;
        for (UUID m : medioIds) {
            jdbc.sql("INSERT INTO lugar_medio (lugar_id, medio_id, orden) VALUES (:l, :m, :o)")
                    .param("l", id).param("m", m).param("o", orden++).update();
            jdbc.sql("UPDATE medio SET moderacion = 'aprobado', revisado_por = :r, revisado_en = now() WHERE id = :m AND moderacion <> 'aprobado'")
                    .param("r", revisor).param("m", m).update();
        }
    }

    // ---------------- rutas ----------------

    public void insertarRuta(UUID id, UUID destinoId, String slug, BigDecimal horas, BigDecimal km, String dificultad,
                             String transporte, boolean premium) {
        jdbc.sql("INSERT INTO ruta (id, destino_id, slug, duracion_horas, distancia_km, dificultad, transporte, es_premium, estado) "
                + "VALUES (:id, :d, :s, :h, :k, :di, :t, :p, 'borrador')")
                .param("id", id).param("d", destinoId).param("s", slug).param("h", horas).param("k", km)
                .param("di", dificultad).param("t", transporte).param("p", premium).update();
    }

    public void actualizarRuta(UUID id, BigDecimal horas, BigDecimal km, String dificultad, String transporte,
                               boolean premium) {
        jdbc.sql("UPDATE ruta SET duracion_horas = :h, distancia_km = :k, dificultad = :di, transporte = :t, es_premium = :p "
                + "WHERE id = :id AND eliminado_en IS NULL")
                .param("id", id).param("h", horas).param("k", km).param("di", dificultad).param("t", transporte)
                .param("p", premium).update();
    }

    public Optional<RutaFila> ruta(UUID id) {
        return jdbc.sql("""
                SELECT id, slug, duracion_horas, distancia_km, dificultad, transporte, es_premium, estado, actualizado_en
                FROM ruta WHERE id = :id AND eliminado_en IS NULL""").param("id", id).query(RutaFila.class).optional();
    }

    public void reemplazarTextosRuta(UUID id, Map<String, TextoRutaDto> textos) {
        jdbc.sql("DELETE FROM ruta_traduccion WHERE ruta_id = :id").param("id", id).update();
        textos.forEach((idioma, t) -> jdbc.sql("INSERT INTO ruta_traduccion (ruta_id, idioma_codigo, nombre, descripcion) VALUES (:id, :i, :n, :d)")
                .param("id", id).param("i", idioma).param("n", t.nombre().trim()).param("d", vacioANulo(t.descripcion())).update());
    }

    public Map<String, TextoRutaDto> textosRuta(UUID id) {
        Map<String, TextoRutaDto> r = new LinkedHashMap<>();
        jdbc.sql("SELECT idioma_codigo, nombre, CAST(NULL AS text) AS resumen, CAST(NULL AS text) AS historia, CAST(NULL AS text) AS recomendaciones, descripcion, CAST(NULL AS text) AS mejor_epoca, CAST(NULL AS text) AS como_llegar FROM ruta_traduccion WHERE ruta_id = :id ORDER BY idioma_codigo")
                .param("id", id).query(TextoFila.class).list()
                .forEach(f -> r.put(f.idiomaCodigo(), new TextoRutaDto(f.nombre(), f.descripcion())));
        return r;
    }

    public void reemplazarParadas(UUID rutaId, List<ParadaEntradaDto> paradas) {
        jdbc.sql("DELETE FROM ruta_parada WHERE ruta_id = :id").param("id", rutaId).update();
        int orden = 1;
        for (ParadaEntradaDto p : paradas) {
            Map<String, Object> m = con(new HashMap<>(), p.latitud(), p.longitud());
            m.put("r", rutaId);
            m.put("o", orden++);
            m.put("l", p.lugarId());
            m.put("n", p.negocioId());
            m.put("min", p.minutosEstimados());
            jdbc.sql("INSERT INTO ruta_parada (ruta_id, orden, lugar_id, negocio_id, ubicacion, minutos_estimados) VALUES (:r, :o, :l, :n, "
                    + punto(p.latitud(), p.longitud()) + ", :min)").params(m).update();
        }
    }

    public List<ParadaEntradaDto> paradas(UUID rutaId) {
        return jdbc.sql("""
                SELECT lugar_id, negocio_id, ST_Y(ubicacion::geometry) AS latitud, ST_X(ubicacion::geometry) AS longitud,
                       minutos_estimados
                FROM ruta_parada WHERE ruta_id = :id ORDER BY orden""").param("id", rutaId)
                .query(ParadaEntradaDto.class).list();
    }

    // ---------------- eventos ----------------

    public void insertarEvento(UUID id, UUID destinoId, String slug, LocalDate inicio, LocalDate fin, UUID municipioId,
                               UUID temporadaId, Double lat, Double lng, String datosJson) {
        Map<String, Object> p = con(new HashMap<>(), lat, lng);
        p.put("id", id);
        p.put("d", destinoId);
        p.put("s", slug);
        p.put("i", inicio);
        p.put("f", fin);
        p.put("m", municipioId);
        p.put("t", temporadaId);
        p.put("datos", datosJson);
        jdbc.sql("INSERT INTO evento (id, destino_id, slug, fecha_inicio, fecha_fin, municipio_id, temporada_id, ubicacion, datos, estado) "
                + "VALUES (:id, :d, :s, :i, :f, :m, :t, " + punto(lat, lng) + ", CAST(:datos AS jsonb), 'borrador')").params(p).update();
    }

    public void actualizarEvento(UUID id, LocalDate inicio, LocalDate fin, UUID municipioId, UUID temporadaId, Double lat,
                                 Double lng, String datosJson) {
        Map<String, Object> p = con(new HashMap<>(), lat, lng);
        p.put("id", id);
        p.put("i", inicio);
        p.put("f", fin);
        p.put("m", municipioId);
        p.put("t", temporadaId);
        p.put("datos", datosJson);
        jdbc.sql("UPDATE evento SET fecha_inicio = :i, fecha_fin = :f, municipio_id = :m, temporada_id = :t, ubicacion = "
                + punto(lat, lng) + ", datos = CAST(:datos AS jsonb) WHERE id = :id AND eliminado_en IS NULL").params(p).update();
    }

    public Optional<EventoFila> evento(UUID id) {
        return jdbc.sql("""
                SELECT id, slug, fecha_inicio, fecha_fin, municipio_id, temporada_id, ST_Y(ubicacion::geometry) AS latitud,
                       ST_X(ubicacion::geometry) AS longitud, estado, datos::text AS datos, actualizado_en
                FROM evento WHERE id = :id AND eliminado_en IS NULL""").param("id", id).query(EventoFila.class).optional();
    }

    public void reemplazarTextosEvento(UUID id, Map<String, TextoEventoDto> textos) {
        jdbc.sql("DELETE FROM evento_traduccion WHERE evento_id = :id").param("id", id).update();
        textos.forEach((idioma, t) -> jdbc.sql("INSERT INTO evento_traduccion (evento_id, idioma_codigo, nombre, descripcion) VALUES (:id, :i, :n, :d)")
                .param("id", id).param("i", idioma).param("n", t.nombre().trim()).param("d", vacioANulo(t.descripcion())).update());
    }

    public Map<String, TextoEventoDto> textosEvento(UUID id) {
        Map<String, TextoEventoDto> r = new LinkedHashMap<>();
        jdbc.sql("SELECT idioma_codigo, nombre, CAST(NULL AS text) AS resumen, CAST(NULL AS text) AS historia, CAST(NULL AS text) AS recomendaciones, descripcion, CAST(NULL AS text) AS mejor_epoca, CAST(NULL AS text) AS como_llegar FROM evento_traduccion WHERE evento_id = :id ORDER BY idioma_codigo")
                .param("id", id).query(TextoFila.class).list()
                .forEach(f -> r.put(f.idiomaCodigo(), new TextoEventoDto(f.nombre(), f.descripcion())));
        return r;
    }

    public void reemplazarNegociosEvento(UUID id, List<UUID> negocioIds) {
        jdbc.sql("DELETE FROM evento_negocio WHERE evento_id = :id").param("id", id).update();
        for (UUID n : new ArrayList<>(negocioIds.stream().distinct().toList())) {
            jdbc.sql("INSERT INTO evento_negocio (evento_id, negocio_id) VALUES (:e, :n)").param("e", id).param("n", n).update();
        }
    }

    public List<UUID> negocioIdsEvento(UUID id) {
        return jdbc.sql("SELECT negocio_id FROM evento_negocio WHERE evento_id = :id ORDER BY negocio_id")
                .param("id", id).query(UUID.class).list();
    }

    private static String vacioANulo(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
