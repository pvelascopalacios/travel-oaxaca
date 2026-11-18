package mx.com.traveloaxaca.explorar.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.ContactoPublicoDto;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.ExcepcionPublicaDto;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.HorarioPublicoDto;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.IdiomaPublicoDto;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.ParadaDto;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.PuntoMapaDto;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.ServicioPublicoDto;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Consultas de lectura para el turista. Solo devuelven lo publicado (negocios, lugares, rutas y eventos). */
@Repository
public class ExplorarRepositorio {

    // ---------------- filas y filtros ----------------

    public record FiltroNegocios(String q, UUID categoriaId, UUID regionId, UUID municipioId, Integer precioMax,
                                 List<UUID> servicioIds, List<String> idiomas, boolean abiertoAhora, List<UUID> ids,
                                 Double lat, Double lng, Double radioM, String orden, int limite, int desplazamiento,
                                 List<UUID> categoriaIds) {
        public boolean hayPunto() {
            return lat != null && lng != null;
        }
    }

    public record TarjetaFila(UUID id, String slug, String nombre, String categoriaClave, String categoriaNombre,
                              String descripcionCorta, String municipioNombre, String regionNombre, Integer rangoPrecio,
                              BigDecimal precioDesde, String unidadPrecio, String moneda, Double latitud,
                              Double longitud, Double distanciaM, Boolean abiertoAhora, String portadaClave,
                              boolean verificado, int puntajeFicha, BigDecimal calificacionPromedio,
                              int totalResenas) {
    }

    /** promedio es nulo cuando todavía no hay las reseñas mínimas para mostrarlo. */
    public record CalificacionFila(BigDecimal promedio, int total) {
    }

    public record NegocioBaseFila(UUID id, String slug, String nombre, String categoriaClave, String raizClave,
                                  String categoriaNombre, Integer rangoPrecio, BigDecimal precioDesde,
                                  String unidadPrecio, String moneda, String atributos, boolean verificado,
                                  OffsetDateTime actualizadoEn, String zonaHoraria) {
    }

    public record TextosFila(String descripcionCorta, String descripcion, String politicas) {
    }

    public record SucursalFila(UUID id, String nombre, boolean esPrincipal, String municipioNombre,
                               String regionNombre, String direccionTexto, String referencia, Double latitud,
                               Double longitud, Boolean abiertoAhora) {
    }

    public record HorarioFila(UUID sucursalId, int diaSemana, String abre, String cierra, boolean cerrado) {
    }

    public record ExcepcionFila(UUID sucursalId, LocalDate fecha, String abre, String cierra, boolean cerrado,
                                String nota) {
    }

    public record FotoFila(String claveAlmacenamiento, String pieTexto, boolean esPortada) {
    }

    public record FiltroLugares(String q, String tipo, UUID regionId, UUID municipioId, Boolean destacado, UUID padreId,
                                Double lat, Double lng, Double radioM, int limite, int desplazamiento, String entrada) {
        public boolean hayPunto() {
            return lat != null && lng != null;
        }
    }

    public record LugarTarjetaFila(UUID id, String slug, String nombre, String tipo, String resumen,
                                   String municipioNombre, String regionNombre, Double latitud, Double longitud,
                                   Double distanciaM, boolean destacado, String portadaClave, String datos) {
    }

    public record LugarBaseFila(UUID id, String slug, String nombre, String tipo, String resumen, String historia,
                                String recomendaciones, String municipioNombre, String regionNombre, Double latitud,
                                Double longitud, boolean destacado, OffsetDateTime actualizadoEn, String mejorEpoca,
                                String comoLlegar, String datos) {
    }

    public record FiltroRutas(String q, String dificultad, String transporte, int limite, int desplazamiento) {
    }

    public record RutaFila(UUID id, String slug, String nombre, String descripcion, BigDecimal duracionHoras,
                           BigDecimal distanciaKm, String dificultad, String transporte, boolean esPremium,
                           OffsetDateTime actualizadoEn) {
    }

    public record FiltroEventos(String q, LocalDate desde, LocalDate hasta, UUID regionId, UUID municipioId,
                                int limite, int desplazamiento, Boolean gratis) {
    }

    public record EventoFila(UUID id, String slug, String nombre, String descripcion, LocalDate fechaInicio,
                             LocalDate fechaFin, String municipioNombre, String regionNombre, Double latitud,
                             Double longitud, String temporadaNombre, OffsetDateTime actualizadoEn, String datos) {
    }

    public record RegionFila(UUID id, String slug, String nombre, long totalNegocios, long totalLugares,
                             long totalEventos, String portadaClave) {
    }

    public record ServicioTarjetaFila(UUID negocioId, String clave, String nombre, String icono) {
    }

    public record OfertaPublicaFila(UUID id, String tipo, String nombre, String descripcion, String incluye,
                                    String noIncluye, BigDecimal precioDesde, String unidadPrecio, String moneda,
                                    Integer duracionMin, Integer capacidad, String seccion, String etiquetas) {
    }

    /** Lugar entre los negocios con calificación mostrable del mismo tipo y municipio. */
    public record PosicionFila(int posicion, int total, String municipioNombre) {
    }

    public record FacetaFila(UUID categoriaId, String clave, String nombre, String padreClave, long total) {
    }

    public record FacetaLugarFila(String tipo, long total) {
    }

    public record SitemapFila(String slug, OffsetDateTime actualizadoEn, String idiomas) {
    }

    private final JdbcClient jdbc;

    public ExplorarRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private record Consulta(String donde, Map<String, Object> p) {
    }

    private static final String PUNTO = "CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)";
    private static final String COORD = "ST_Y(%1$s::geometry) AS latitud, ST_X(%1$s::geometry) AS longitud";

    // ---------------- negocios: listado ----------------

    private static String tarjetaNegocio(boolean conDistancia) {
        String distancia = conDistancia
                ? "CAST(ST_Distance(sp.ubicacion, " + PUNTO + ") AS double precision)"
                : "CAST(NULL AS double precision)";
        return """
                SELECT n.id, n.slug, n.nombre_comercial AS nombre, c.clave AS categoria_clave,
                       COALESCE(ct.nombre, cte.nombre, c.clave) AS categoria_nombre,
                       COALESCE(nt.descripcion_corta, nte.descripcion_corta) AS descripcion_corta,
                       mu.nombre AS municipio_nombre, rg.nombre AS region_nombre,
                       n.rango_precio, n.precio_desde, n.unidad_precio, n.moneda::text AS moneda,
                       ST_Y(sp.ubicacion::geometry) AS latitud, ST_X(sp.ubicacion::geometry) AS longitud,
                       %s AS distancia_m,
                       sucursal_abierta(sp.id, now(), d.zona_horaria) AS abierto_ahora,
                       (SELECT me.clave_almacenamiento FROM negocio_medio nm JOIN medio me ON me.id = nm.medio_id
                         WHERE nm.negocio_id = n.id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado'
                           AND me.eliminado_en IS NULL
                         ORDER BY nm.es_portada DESC, nm.orden, nm.creado_en LIMIT 1) AS portada_clave,
                       (n.verificado_en IS NOT NULL) AS verificado, n.puntaje_ficha,
                       (SELECT CASE WHEN k.total >= config_entero('resenas_min_para_promedio', 3) THEN k.promedio END
                          FROM negocio_calificacion k WHERE k.negocio_id = n.id) AS calificacion_promedio,
                       COALESCE((SELECT k.total FROM negocio_calificacion k WHERE k.negocio_id = n.id), 0) AS total_resenas
                FROM negocio n
                JOIN destino d ON d.id = n.destino_id
                JOIN categoria c ON c.id = n.categoria_id
                LEFT JOIN categoria_traduccion ct ON ct.categoria_id = c.id AND ct.idioma_codigo = :idioma
                LEFT JOIN categoria_traduccion cte ON cte.categoria_id = c.id AND cte.idioma_codigo = 'es'
                LEFT JOIN negocio_traduccion nt ON nt.negocio_id = n.id AND nt.idioma_codigo = :idioma
                LEFT JOIN negocio_traduccion nte ON nte.negocio_id = n.id AND nte.idioma_codigo = 'es'
                JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                JOIN municipio mu ON mu.id = sp.municipio_id
                JOIN region rg ON rg.id = mu.region_id
                """.formatted(distancia);
    }

    private static Consulta condicionesNegocios(FiltroNegocios f, String idioma) {
        List<String> c = new ArrayList<>();
        Map<String, Object> p = new HashMap<>();
        p.put("idioma", idioma);
        c.add("n.estado = 'publicada'");
        c.add("n.eliminado_en IS NULL");
        if (f.q() != null) {
            p.put("q", f.q());
            p.put("qlike", "%" + CatalogoRepositorio.escapar(f.q()) + "%");
            c.add("""
                    (f_unaccent(n.nombre_comercial) ILIKE f_unaccent(:qlike)
                     OR similarity(f_unaccent(n.nombre_comercial), f_unaccent(:q)) > 0.3
                     OR f_unaccent(mu.nombre) ILIKE f_unaccent(:qlike)
                     OR f_unaccent(COALESCE(ct.nombre, cte.nombre, c.clave)) ILIKE f_unaccent(:qlike)
                     OR EXISTS (SELECT 1 FROM negocio_traduccion t WHERE t.negocio_id = n.id
                                AND to_tsvector('spanish', f_unaccent(coalesce(t.descripcion_corta, '') || ' ' || coalesce(t.descripcion, '')))
                                    @@ plainto_tsquery('spanish', f_unaccent(:q))))""");
        }
        if (f.categoriaId() != null) {
            p.put("categoria", f.categoriaId());
            c.add("(n.categoria_id = :categoria OR c.padre_id = :categoria)");
        }
        if (f.categoriaIds() != null && !f.categoriaIds().isEmpty()) {
            p.put("categorias", f.categoriaIds());
            c.add("(n.categoria_id IN (:categorias) OR c.padre_id IN (:categorias))");
        }
        if (f.regionId() != null) {
            p.put("region", f.regionId());
            c.add("rg.id = :region");
        }
        if (f.municipioId() != null) {
            p.put("municipio", f.municipioId());
            c.add("mu.id = :municipio");
        }
        if (f.precioMax() != null) {
            p.put("precioMax", f.precioMax());
            c.add("n.rango_precio <= :precioMax");
        }
        if (f.servicioIds() != null && !f.servicioIds().isEmpty()) {
            p.put("servicios", f.servicioIds());
            p.put("totalServicios", f.servicioIds().size());
            c.add("(SELECT count(*) FROM negocio_servicio ns WHERE ns.negocio_id = n.id AND ns.servicio_id IN (:servicios)) = :totalServicios");
        }
        if (f.idiomas() != null && !f.idiomas().isEmpty()) {
            p.put("idiomasHablados", f.idiomas());
            c.add("EXISTS (SELECT 1 FROM negocio_idioma ni WHERE ni.negocio_id = n.id AND ni.idioma_codigo IN (:idiomasHablados))");
        }
        if (f.ids() != null) {
            p.put("ids", f.ids().isEmpty() ? List.of(new UUID(0, 0)) : f.ids());
            c.add("n.id IN (:ids)");
        }
        if (f.abiertoAhora()) {
            c.add("sucursal_abierta(sp.id, now(), d.zona_horaria) IS TRUE");
        }
        if (f.hayPunto()) {
            p.put("lat", f.lat());
            p.put("lng", f.lng());
            if (f.radioM() != null) {
                p.put("radioM", f.radioM());
                c.add("ST_DWithin(sp.ubicacion, " + PUNTO + ", :radioM)");
            }
        }
        return new Consulta("WHERE " + String.join(" AND ", c), p);
    }

    private static String ordenNegocios(FiltroNegocios f) {
        String estable = ", n.id";
        return switch (f.orden() == null ? "relevancia" : f.orden()) {
            case "distancia" -> " ORDER BY distancia_m ASC NULLS LAST, n.nombre_comercial" + estable;
            case "precio" -> " ORDER BY n.precio_desde ASC NULLS LAST, n.nombre_comercial" + estable;
            case "nombre" -> " ORDER BY n.nombre_comercial" + estable;
            case "calificacion" -> " ORDER BY calificacion_promedio DESC NULLS LAST, total_resenas DESC, n.nombre_comercial" + estable;
            default -> {
                if (f.q() != null) {
                    yield " ORDER BY similarity(f_unaccent(n.nombre_comercial), f_unaccent(:q)) DESC, n.puntaje_ficha DESC, n.nombre_comercial" + estable;
                }
                if (f.hayPunto()) {
                    yield " ORDER BY distancia_m ASC NULLS LAST, n.nombre_comercial" + estable;
                }
                yield " ORDER BY (n.verificado_en IS NOT NULL) DESC, n.puntaje_ficha DESC, n.nombre_comercial" + estable;
            }
        };
    }

    public List<TarjetaFila> negocios(FiltroNegocios f, String idioma) {
        Consulta c = condicionesNegocios(f, idioma);
        c.p().put("limite", f.limite());
        c.p().put("desplazamiento", f.desplazamiento());
        return jdbc.sql(tarjetaNegocio(f.hayPunto()) + c.donde() + ordenNegocios(f) + " LIMIT :limite OFFSET :desplazamiento")
                .params(c.p()).query(TarjetaFila.class).list();
    }

    public long contarNegocios(FiltroNegocios f, String idioma) {
        Consulta c = condicionesNegocios(f, idioma);
        return jdbc.sql("SELECT count(*) FROM (" + tarjetaNegocio(f.hayPunto()) + c.donde() + ") t")
                .params(c.p()).query(Long.class).single();
    }

    // ---------------- negocios: ofertas, posición y conteos ----------------

    /** Solo las publicadas, con el texto en el idioma pedido o, si falta, en español. */
    public List<OfertaPublicaFila> ofertasPublicas(UUID negocioId, String idioma) {
        return jdbc.sql("""
                SELECT o.id, o.tipo, COALESCE(t.nombre, te.nombre) AS nombre,
                       COALESCE(t.descripcion, te.descripcion) AS descripcion,
                       COALESCE(t.incluye, te.incluye) AS incluye, COALESCE(t.no_incluye, te.no_incluye) AS no_incluye,
                       o.precio_desde, o.unidad_precio, o.moneda::text AS moneda, o.duracion_min, o.capacidad,
                       o.seccion, array_to_string(o.etiquetas, ',') AS etiquetas
                FROM oferta o
                LEFT JOIN oferta_traduccion t ON t.oferta_id = o.id AND t.idioma_codigo = :idioma
                JOIN oferta_traduccion te ON te.oferta_id = o.id AND te.idioma_codigo = 'es'
                WHERE o.negocio_id = :n AND o.estado = 'publicada' AND o.eliminado_en IS NULL
                ORDER BY o.orden, o.creado_en, o.id""")
                .param("n", negocioId).param("idioma", idioma).query(OfertaPublicaFila.class).list();
    }

    /**
     * Lugar del negocio entre los de su misma categoría principal y municipio, ordenados por calificación.
     * Solo cuentan los que ya tienen las reseñas mínimas; si este no las tiene, no hay posición.
     */
    public Optional<PosicionFila> posicion(UUID negocioId) {
        return jdbc.sql("""
                WITH base AS (
                  SELECT n.id, k.promedio, k.total, sp.municipio_id, COALESCE(c.padre_id, c.id) AS raiz_id
                  FROM negocio n
                  JOIN categoria c ON c.id = n.categoria_id
                  JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                  JOIN negocio_calificacion k ON k.negocio_id = n.id
                  WHERE n.estado = 'publicada' AND n.eliminado_en IS NULL
                    AND k.total >= config_entero('resenas_min_para_promedio', 3)),
                mio AS (SELECT * FROM base WHERE id = :id)
                SELECT CAST((SELECT count(*) FROM base b, mio m
                              WHERE b.municipio_id = m.municipio_id AND b.raiz_id = m.raiz_id
                                AND (b.promedio > m.promedio OR (b.promedio = m.promedio AND b.total > m.total))) + 1 AS integer) AS posicion,
                       CAST((SELECT count(*) FROM base b, mio m
                              WHERE b.municipio_id = m.municipio_id AND b.raiz_id = m.raiz_id) AS integer) AS total,
                       (SELECT mu.nombre FROM municipio mu WHERE mu.id = (SELECT municipio_id FROM mio)) AS municipio_nombre
                FROM mio""")
                .param("id", negocioId).query(PosicionFila.class).optional();
    }

    /** Cuántos negocios publicados hay por categoría con los filtros dados (sin contar la categoría). */
    public List<FacetaFila> facetasNegocios(FiltroNegocios f, String idioma) {
        Consulta c = condicionesNegocios(f, idioma);
        return jdbc.sql("""
                SELECT c.id AS categoria_id, c.clave, COALESCE(ct.nombre, cte.nombre, c.clave) AS nombre,
                       p.clave AS padre_clave, count(*) AS total
                FROM negocio n
                JOIN destino d ON d.id = n.destino_id
                JOIN categoria c ON c.id = n.categoria_id
                LEFT JOIN categoria p ON p.id = c.padre_id
                LEFT JOIN categoria_traduccion ct ON ct.categoria_id = c.id AND ct.idioma_codigo = :idioma
                LEFT JOIN categoria_traduccion cte ON cte.categoria_id = c.id AND cte.idioma_codigo = 'es'
                JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                JOIN municipio mu ON mu.id = sp.municipio_id
                JOIN region rg ON rg.id = mu.region_id
                """ + c.donde() + " GROUP BY c.id, c.clave, ct.nombre, cte.nombre, p.clave ORDER BY c.clave")
                .params(c.p()).query(FacetaFila.class).list();
    }

    public List<FacetaLugarFila> facetasLugares(FiltroLugares f, String idioma) {
        Consulta c = condicionesLugares(f, idioma);
        return jdbc.sql("""
                SELECT l.tipo, count(*) AS total
                FROM lugar l
                LEFT JOIN lugar_traduccion t ON t.lugar_id = l.id AND t.idioma_codigo = :idioma
                JOIN lugar_traduccion te ON te.lugar_id = l.id AND te.idioma_codigo = 'es'
                LEFT JOIN municipio mu ON mu.id = l.municipio_id
                LEFT JOIN region rg ON rg.id = mu.region_id
                """ + c.donde() + " GROUP BY l.tipo ORDER BY l.tipo")
                .params(c.p()).query(FacetaLugarFila.class).list();
    }

    // ---------------- negocios: mapa ----------------

    public List<PuntoMapaDto> puntosMapa(double norte, double sur, double este, double oeste, UUID categoriaId, int limite) {
        Map<String, Object> p = new HashMap<>();
        p.put("norte", norte);
        p.put("sur", sur);
        p.put("este", este);
        p.put("oeste", oeste);
        p.put("limite", limite);
        String filtro = "";
        if (categoriaId != null) {
            p.put("categoria", categoriaId);
            filtro = " AND (n.categoria_id = :categoria OR c.padre_id = :categoria)";
        }
        return jdbc.sql("""
                SELECT n.id, n.slug, n.nombre_comercial AS nombre, c.clave AS categoria_clave,
                       ST_Y(sp.ubicacion::geometry) AS latitud, ST_X(sp.ubicacion::geometry) AS longitud
                FROM negocio n
                JOIN categoria c ON c.id = n.categoria_id
                JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                WHERE n.estado = 'publicada' AND n.eliminado_en IS NULL AND sp.ubicacion IS NOT NULL
                  AND ST_Intersects(sp.ubicacion::geometry, ST_MakeEnvelope(:oeste, :sur, :este, :norte, 4326))
                """ + filtro + " ORDER BY n.puntaje_ficha DESC, n.id LIMIT :limite")
                .params(p).query(PuntoMapaDto.class).list();
    }

    // ---------------- negocios: ficha ----------------

    public Optional<NegocioBaseFila> negocioPorSlug(String slug, String destino, String idioma) {
        return jdbc.sql("""
                SELECT n.id, n.slug, n.nombre_comercial AS nombre, c.clave AS categoria_clave,
                       COALESCE(p.clave, c.clave) AS raiz_clave,
                       COALESCE(ct.nombre, cte.nombre, c.clave) AS categoria_nombre,
                       n.rango_precio, n.precio_desde, n.unidad_precio, n.moneda::text AS moneda,
                       n.atributos::text AS atributos, (n.verificado_en IS NOT NULL) AS verificado,
                       n.actualizado_en, d.zona_horaria
                FROM negocio n
                JOIN destino d ON d.id = n.destino_id AND d.codigo = :destino
                JOIN categoria c ON c.id = n.categoria_id
                LEFT JOIN categoria p ON p.id = c.padre_id
                LEFT JOIN categoria_traduccion ct ON ct.categoria_id = c.id AND ct.idioma_codigo = :idioma
                LEFT JOIN categoria_traduccion cte ON cte.categoria_id = c.id AND cte.idioma_codigo = 'es'
                WHERE n.slug = :slug AND n.estado = 'publicada' AND n.eliminado_en IS NULL""")
                .param("slug", slug).param("destino", destino).param("idioma", idioma)
                .query(NegocioBaseFila.class).optional();
    }

    public CalificacionFila calificacionNegocio(UUID negocioId) {
        return jdbc.sql("""
                SELECT CASE WHEN COALESCE(k.total, 0) >= config_entero('resenas_min_para_promedio', 3) THEN k.promedio END AS promedio,
                       COALESCE(k.total, 0) AS total
                FROM (SELECT 1) x LEFT JOIN negocio_calificacion k ON k.negocio_id = :n""")
                .param("n", negocioId).query(CalificacionFila.class).single();
    }

    public TextosFila textosNegocio(UUID negocioId, String idioma) {
        return jdbc.sql("""
                SELECT COALESCE(t.descripcion_corta, e.descripcion_corta) AS descripcion_corta,
                       COALESCE(t.descripcion, e.descripcion) AS descripcion,
                       COALESCE(t.politicas, e.politicas) AS politicas
                FROM (SELECT 1) x
                LEFT JOIN negocio_traduccion t ON t.negocio_id = :n AND t.idioma_codigo = :i
                LEFT JOIN negocio_traduccion e ON e.negocio_id = :n AND e.idioma_codigo = 'es'""")
                .param("n", negocioId).param("i", idioma).query(TextosFila.class).single();
    }

    public List<String> idiomasConTexto(UUID negocioId) {
        return jdbc.sql("""
                SELECT idioma_codigo FROM negocio_traduccion
                WHERE negocio_id = :n AND length(trim(coalesce(descripcion_corta, ''))) > 0 ORDER BY idioma_codigo""")
                .param("n", negocioId).query(String.class).list();
    }

    public List<SucursalFila> sucursales(UUID negocioId, String zona) {
        return jdbc.sql("""
                SELECT s.id, s.nombre, s.es_principal, mu.nombre AS municipio_nombre, rg.nombre AS region_nombre,
                       s.direccion_texto, s.referencia,
                       ST_Y(s.ubicacion::geometry) AS latitud, ST_X(s.ubicacion::geometry) AS longitud,
                       sucursal_abierta(s.id, now(), :zona) AS abierto_ahora
                FROM sucursal s JOIN municipio mu ON mu.id = s.municipio_id JOIN region rg ON rg.id = mu.region_id
                WHERE s.negocio_id = :n AND s.eliminado_en IS NULL
                ORDER BY s.es_principal DESC, s.creado_en""")
                .param("n", negocioId).param("zona", zona).query(SucursalFila.class).list();
    }

    public List<HorarioFila> horarios(UUID negocioId) {
        return jdbc.sql("""
                SELECT h.sucursal_id, h.dia_semana, to_char(h.abre, 'HH24:MI') AS abre,
                       to_char(h.cierra, 'HH24:MI') AS cierra, h.cerrado
                FROM horario h JOIN sucursal s ON s.id = h.sucursal_id
                WHERE s.negocio_id = :n AND s.eliminado_en IS NULL
                ORDER BY h.sucursal_id, h.dia_semana, h.abre""")
                .param("n", negocioId).query(HorarioFila.class).list();
    }

    /** Excepciones de hoy en adelante (60 días), según la fecha local del destino. */
    public List<ExcepcionFila> excepciones(UUID negocioId, String zona) {
        return jdbc.sql("""
                SELECT e.sucursal_id, e.fecha, to_char(e.abre, 'HH24:MI') AS abre, to_char(e.cierra, 'HH24:MI') AS cierra,
                       e.cerrado, e.nota
                FROM horario_excepcion e JOIN sucursal s ON s.id = e.sucursal_id
                WHERE s.negocio_id = :n AND s.eliminado_en IS NULL
                  AND e.fecha >= CAST(now() AT TIME ZONE :zona AS date)
                  AND e.fecha < CAST(now() AT TIME ZONE :zona AS date) + 60
                ORDER BY e.fecha""")
                .param("n", negocioId).param("zona", zona).query(ExcepcionFila.class).list();
    }

    public List<ContactoPublicoDto> contactos(UUID negocioId) {
        return jdbc.sql("""
                SELECT tipo, valor, es_principal FROM contacto
                WHERE negocio_id = :n AND eliminado_en IS NULL ORDER BY es_principal DESC, tipo, creado_en""")
                .param("n", negocioId).query(ContactoPublicoDto.class).list();
    }

    public List<ServicioPublicoDto> servicios(UUID negocioId, String idioma) {
        return jdbc.sql("""
                SELECT s.clave, COALESCE(st.nombre, ste.nombre, s.clave) AS nombre, s.icono
                FROM negocio_servicio ns JOIN servicio s ON s.id = ns.servicio_id AND s.activo
                LEFT JOIN servicio_traduccion st ON st.servicio_id = s.id AND st.idioma_codigo = :i
                LEFT JOIN servicio_traduccion ste ON ste.servicio_id = s.id AND ste.idioma_codigo = 'es'
                WHERE ns.negocio_id = :n ORDER BY s.grupo, s.clave""")
                .param("n", negocioId).param("i", idioma).query(ServicioPublicoDto.class).list();
    }

    /** Hasta cuatro servicios por negocio para las etiquetas de las tarjetas; una sola consulta para toda la página. */
    public List<ServicioTarjetaFila> serviciosDeTarjetas(List<UUID> negocioIds, String idioma) {
        if (negocioIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
                SELECT negocio_id, clave, nombre, icono FROM (
                  SELECT ns.negocio_id, s.clave, COALESCE(st.nombre, ste.nombre, s.clave) AS nombre, s.icono,
                         row_number() OVER (PARTITION BY ns.negocio_id ORDER BY s.grupo, s.clave) AS fila
                  FROM negocio_servicio ns JOIN servicio s ON s.id = ns.servicio_id AND s.activo
                  LEFT JOIN servicio_traduccion st ON st.servicio_id = s.id AND st.idioma_codigo = :i
                  LEFT JOIN servicio_traduccion ste ON ste.servicio_id = s.id AND ste.idioma_codigo = 'es'
                  WHERE ns.negocio_id IN (:ids)) x
                WHERE fila <= 4 ORDER BY negocio_id, fila""")
                .param("ids", negocioIds).param("i", idioma).query(ServicioTarjetaFila.class).list();
    }

    /** Las regiones del destino con cuántos negocios, lugares y eventos vigentes publicados tiene cada una. */
    public List<RegionFila> regiones(String destino, LocalDate hoy) {
        return jdbc.sql("""
                SELECT r.id, r.slug, r.nombre,
                  (SELECT count(*) FROM negocio n
                     JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                     JOIN municipio mu ON mu.id = sp.municipio_id
                    WHERE mu.region_id = r.id AND n.estado = 'publicada' AND n.eliminado_en IS NULL) AS total_negocios,
                  (SELECT count(*) FROM lugar l JOIN municipio mu ON mu.id = l.municipio_id
                    WHERE mu.region_id = r.id AND l.estado = 'publicado' AND l.eliminado_en IS NULL) AS total_lugares,
                  (SELECT count(*) FROM evento e JOIN municipio mu ON mu.id = e.municipio_id
                    WHERE mu.region_id = r.id AND e.estado = 'publicado' AND e.eliminado_en IS NULL
                      AND e.fecha_fin >= :hoy) AS total_eventos,
                  (SELECT me.clave_almacenamiento FROM lugar l
                     JOIN municipio mu ON mu.id = l.municipio_id
                     JOIN lugar_medio lm ON lm.lugar_id = l.id
                     JOIN medio me ON me.id = lm.medio_id
                    WHERE mu.region_id = r.id AND l.estado = 'publicado' AND l.eliminado_en IS NULL
                      AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                    ORDER BY l.destacado DESC, l.slug, lm.orden LIMIT 1) AS portada_clave
                FROM region r JOIN destino d ON d.id = r.destino_id AND d.codigo = :destino
                WHERE r.activo ORDER BY r.nombre""")
                .param("destino", destino).param("hoy", hoy).query(RegionFila.class).list();
    }

    public List<IdiomaPublicoDto> idiomasHablados(UUID negocioId) {
        return jdbc.sql("""
                SELECT i.codigo, i.nombre, ni.nivel FROM negocio_idioma ni JOIN idioma i ON i.codigo = ni.idioma_codigo
                WHERE ni.negocio_id = :n ORDER BY i.nombre""")
                .param("n", negocioId).query(IdiomaPublicoDto.class).list();
    }

    public List<FotoFila> fotosNegocio(UUID negocioId) {
        return jdbc.sql("""
                SELECT me.clave_almacenamiento, nm.pie_texto, nm.es_portada
                FROM negocio_medio nm JOIN medio me ON me.id = nm.medio_id
                WHERE nm.negocio_id = :n AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                ORDER BY nm.es_portada DESC, nm.orden, nm.creado_en""")
                .param("n", negocioId).query(FotoFila.class).list();
    }

    // ---------------- lugares ----------------

    private static String tarjetaLugar(boolean conDistancia) {
        String distancia = conDistancia
                ? "CAST(ST_Distance(l.ubicacion, " + PUNTO + ") AS double precision)"
                : "CAST(NULL AS double precision)";
        return """
                SELECT l.id, l.slug, COALESCE(t.nombre, te.nombre) AS nombre, l.tipo,
                       COALESCE(t.resumen, te.resumen) AS resumen,
                       mu.nombre AS municipio_nombre, rg.nombre AS region_nombre,
                       ST_Y(l.ubicacion::geometry) AS latitud, ST_X(l.ubicacion::geometry) AS longitud,
                       %s AS distancia_m, l.destacado,
                       (SELECT me.clave_almacenamiento FROM lugar_medio lm JOIN medio me ON me.id = lm.medio_id
                         WHERE lm.lugar_id = l.id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado'
                           AND me.eliminado_en IS NULL
                         ORDER BY lm.orden, lm.creado_en LIMIT 1) AS portada_clave,
                       l.datos::text AS datos
                FROM lugar l
                LEFT JOIN lugar_traduccion t ON t.lugar_id = l.id AND t.idioma_codigo = :idioma
                JOIN lugar_traduccion te ON te.lugar_id = l.id AND te.idioma_codigo = 'es'
                LEFT JOIN municipio mu ON mu.id = l.municipio_id
                LEFT JOIN region rg ON rg.id = mu.region_id
                """.formatted(distancia);
    }

    private static Consulta condicionesLugares(FiltroLugares f, String idioma) {
        List<String> c = new ArrayList<>();
        Map<String, Object> p = new HashMap<>();
        p.put("idioma", idioma);
        c.add("l.estado = 'publicado'");
        c.add("l.eliminado_en IS NULL");
        if (f.q() != null) {
            p.put("qlike", "%" + CatalogoRepositorio.escapar(f.q()) + "%");
            c.add("f_unaccent(COALESCE(t.nombre, te.nombre)) ILIKE f_unaccent(:qlike)");
        }
        if (f.tipo() != null) {
            p.put("tipo", f.tipo());
            c.add("l.tipo = :tipo");
        }
        if (f.regionId() != null) {
            p.put("region", f.regionId());
            c.add("rg.id = :region");
        }
        if (f.municipioId() != null) {
            p.put("municipio", f.municipioId());
            c.add("l.municipio_id = :municipio");
        }
        if (f.destacado() != null) {
            p.put("destacado", f.destacado());
            c.add("l.destacado = :destacado");
        }
        if (f.padreId() != null) {
            p.put("padre", f.padreId());
            c.add("l.padre_id = :padre");
        }
        if (f.entrada() != null) {
            p.put("entrada", f.entrada());
            c.add("l.datos->>'entrada' = :entrada");
        }
        if (f.hayPunto()) {
            p.put("lat", f.lat());
            p.put("lng", f.lng());
            if (f.radioM() != null) {
                p.put("radioM", f.radioM());
                c.add("l.ubicacion IS NOT NULL AND ST_DWithin(l.ubicacion, " + PUNTO + ", :radioM)");
            }
        }
        return new Consulta("WHERE " + String.join(" AND ", c), p);
    }

    public List<LugarTarjetaFila> lugares(FiltroLugares f, String idioma) {
        Consulta c = condicionesLugares(f, idioma);
        c.p().put("limite", f.limite());
        c.p().put("desplazamiento", f.desplazamiento());
        String orden = f.hayPunto()
                ? " ORDER BY distancia_m ASC NULLS LAST, nombre, l.id"
                : " ORDER BY l.destacado DESC, nombre, l.id";
        return jdbc.sql(tarjetaLugar(f.hayPunto()) + c.donde() + orden + " LIMIT :limite OFFSET :desplazamiento")
                .params(c.p()).query(LugarTarjetaFila.class).list();
    }

    public long contarLugares(FiltroLugares f, String idioma) {
        Consulta c = condicionesLugares(f, idioma);
        return jdbc.sql("SELECT count(*) FROM (" + tarjetaLugar(f.hayPunto()) + c.donde() + ") t")
                .params(c.p()).query(Long.class).single();
    }

    public Optional<LugarBaseFila> lugarPorSlug(String slug, String destino, String idioma) {
        return jdbc.sql("""
                SELECT l.id, l.slug, COALESCE(t.nombre, te.nombre) AS nombre, l.tipo,
                       COALESCE(t.resumen, te.resumen) AS resumen, COALESCE(t.historia, te.historia) AS historia,
                       COALESCE(t.recomendaciones, te.recomendaciones) AS recomendaciones,
                       mu.nombre AS municipio_nombre, rg.nombre AS region_nombre,
                       ST_Y(l.ubicacion::geometry) AS latitud, ST_X(l.ubicacion::geometry) AS longitud,
                       l.destacado, l.actualizado_en,
                       COALESCE(t.mejor_epoca, te.mejor_epoca) AS mejor_epoca,
                       COALESCE(t.como_llegar, te.como_llegar) AS como_llegar, l.datos::text AS datos
                FROM lugar l
                JOIN destino d ON d.id = l.destino_id AND d.codigo = :destino
                LEFT JOIN lugar_traduccion t ON t.lugar_id = l.id AND t.idioma_codigo = :idioma
                JOIN lugar_traduccion te ON te.lugar_id = l.id AND te.idioma_codigo = 'es'
                LEFT JOIN municipio mu ON mu.id = l.municipio_id
                LEFT JOIN region rg ON rg.id = mu.region_id
                WHERE l.slug = :slug AND l.estado = 'publicado' AND l.eliminado_en IS NULL""")
                .param("slug", slug).param("destino", destino).param("idioma", idioma)
                .query(LugarBaseFila.class).optional();
    }

    public List<FotoFila> fotosLugar(UUID lugarId) {
        return jdbc.sql("""
                SELECT me.clave_almacenamiento, CAST(NULL AS text) AS pie_texto, (lm.orden = 0) AS es_portada
                FROM lugar_medio lm JOIN medio me ON me.id = lm.medio_id
                WHERE lm.lugar_id = :l AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                ORDER BY lm.orden, lm.creado_en""")
                .param("l", lugarId).query(FotoFila.class).list();
    }

    public List<String> idiomasLugar(UUID lugarId) {
        return jdbc.sql("""
                SELECT idioma_codigo FROM lugar_traduccion
                WHERE lugar_id = :l AND length(trim(coalesce(nombre, ''))) > 0 ORDER BY idioma_codigo""")
                .param("l", lugarId).query(String.class).list();
    }

    // ---------------- rutas ----------------

    private static final String RUTA = """
            SELECT r.id, r.slug, COALESCE(t.nombre, te.nombre) AS nombre, COALESCE(t.descripcion, te.descripcion) AS descripcion,
                   r.duracion_horas, r.distancia_km, r.dificultad, r.transporte, r.es_premium, r.actualizado_en
            FROM ruta r
            LEFT JOIN ruta_traduccion t ON t.ruta_id = r.id AND t.idioma_codigo = :idioma
            JOIN ruta_traduccion te ON te.ruta_id = r.id AND te.idioma_codigo = 'es'
            """;

    public List<RutaFila> rutas(FiltroRutas f, String idioma) {
        Map<String, Object> p = new HashMap<>();
        String donde = condicionesRutas(f, idioma, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql(RUTA + donde + " ORDER BY nombre, r.id LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(RutaFila.class).list();
    }

    public long contarRutas(FiltroRutas f, String idioma) {
        Map<String, Object> p = new HashMap<>();
        String donde = condicionesRutas(f, idioma, p);
        return jdbc.sql("SELECT count(*) FROM (" + RUTA + donde + ") x").params(p).query(Long.class).single();
    }

    private static String condicionesRutas(FiltroRutas f, String idioma, Map<String, Object> p) {
        List<String> c = new ArrayList<>();
        p.put("idioma", idioma);
        c.add("r.estado = 'publicada'");
        c.add("r.eliminado_en IS NULL");
        if (f.q() != null) {
            p.put("qlike", "%" + CatalogoRepositorio.escapar(f.q()) + "%");
            c.add("f_unaccent(COALESCE(t.nombre, te.nombre)) ILIKE f_unaccent(:qlike)");
        }
        if (f.dificultad() != null) {
            p.put("dificultad", f.dificultad());
            c.add("r.dificultad = :dificultad");
        }
        if (f.transporte() != null) {
            p.put("transporte", f.transporte());
            c.add("r.transporte = :transporte");
        }
        return "WHERE " + String.join(" AND ", c);
    }

    public Optional<RutaFila> rutaPorSlug(String slug, String destino, String idioma) {
        return jdbc.sql(RUTA + " JOIN destino d ON d.id = r.destino_id AND d.codigo = :destino"
                + " WHERE r.slug = :slug AND r.estado = 'publicada' AND r.eliminado_en IS NULL")
                .param("slug", slug).param("destino", destino).param("idioma", idioma)
                .query(RutaFila.class).optional();
    }

    public List<ParadaDto> paradas(UUID rutaId, String idioma) {
        return jdbc.sql("""
                SELECT p.orden,
                       CASE WHEN p.lugar_id IS NOT NULL THEN 'lugar' WHEN p.negocio_id IS NOT NULL THEN 'negocio' ELSE 'punto' END AS tipo,
                       p.lugar_id, p.negocio_id,
                       COALESCE(lt.nombre, lte.nombre, n.nombre_comercial) AS nombre,
                       COALESCE(l.slug, n.slug) AS slug,
                       ST_Y(COALESCE(p.ubicacion, l.ubicacion, sp.ubicacion)::geometry) AS latitud,
                       ST_X(COALESCE(p.ubicacion, l.ubicacion, sp.ubicacion)::geometry) AS longitud,
                       p.minutos_estimados
                FROM ruta_parada p
                LEFT JOIN lugar l ON l.id = p.lugar_id AND l.estado = 'publicado' AND l.eliminado_en IS NULL
                LEFT JOIN lugar_traduccion lt ON lt.lugar_id = l.id AND lt.idioma_codigo = :i
                LEFT JOIN lugar_traduccion lte ON lte.lugar_id = l.id AND lte.idioma_codigo = 'es'
                LEFT JOIN negocio n ON n.id = p.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
                LEFT JOIN sucursal sp ON sp.negocio_id = n.id AND sp.es_principal AND sp.eliminado_en IS NULL
                WHERE p.ruta_id = :r
                  AND (p.lugar_id IS NULL OR l.id IS NOT NULL)
                  AND (p.negocio_id IS NULL OR n.id IS NOT NULL)
                ORDER BY p.orden""")
                .param("r", rutaId).param("i", idioma).query(ParadaDto.class).list();
    }

    public List<String> idiomasRuta(UUID rutaId) {
        return jdbc.sql("SELECT idioma_codigo FROM ruta_traduccion WHERE ruta_id = :r ORDER BY idioma_codigo")
                .param("r", rutaId).query(String.class).list();
    }

    // ---------------- eventos ----------------

    private static final String EVENTO = """
            SELECT e.id, e.slug, COALESCE(t.nombre, te.nombre) AS nombre, COALESCE(t.descripcion, te.descripcion) AS descripcion,
                   e.fecha_inicio, e.fecha_fin, mu.nombre AS municipio_nombre, rg.nombre AS region_nombre,
                   ST_Y(e.ubicacion::geometry) AS latitud, ST_X(e.ubicacion::geometry) AS longitud,
                   tp.nombre AS temporada_nombre, e.actualizado_en, e.datos::text AS datos
            FROM evento e
            LEFT JOIN evento_traduccion t ON t.evento_id = e.id AND t.idioma_codigo = :idioma
            JOIN evento_traduccion te ON te.evento_id = e.id AND te.idioma_codigo = 'es'
            LEFT JOIN municipio mu ON mu.id = e.municipio_id
            LEFT JOIN region rg ON rg.id = mu.region_id
            LEFT JOIN temporada tp ON tp.id = e.temporada_id
            """;

    private static String condicionesEventos(FiltroEventos f, String idioma, Map<String, Object> p) {
        List<String> c = new ArrayList<>();
        p.put("idioma", idioma);
        c.add("e.estado = 'publicado'");
        c.add("e.eliminado_en IS NULL");
        p.put("desde", f.desde());
        c.add("e.fecha_fin >= :desde");
        if (f.hasta() != null) {
            p.put("hasta", f.hasta());
            c.add("e.fecha_inicio <= :hasta");
        }
        if (f.q() != null) {
            p.put("qlike", "%" + CatalogoRepositorio.escapar(f.q()) + "%");
            c.add("f_unaccent(COALESCE(t.nombre, te.nombre)) ILIKE f_unaccent(:qlike)");
        }
        if (f.regionId() != null) {
            p.put("region", f.regionId());
            c.add("rg.id = :region");
        }
        if (f.municipioId() != null) {
            p.put("municipio", f.municipioId());
            c.add("e.municipio_id = :municipio");
        }
        if (f.gratis() != null) {
            p.put("gratis", f.gratis());
            c.add("COALESCE((e.datos->>'gratis')::boolean, false) = :gratis");
        }
        return "WHERE " + String.join(" AND ", c);
    }

    public List<EventoFila> eventos(FiltroEventos f, String idioma) {
        Map<String, Object> p = new HashMap<>();
        String donde = condicionesEventos(f, idioma, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql(EVENTO + donde + " ORDER BY e.fecha_inicio, nombre, e.id LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(EventoFila.class).list();
    }

    public long contarEventos(FiltroEventos f, String idioma) {
        Map<String, Object> p = new HashMap<>();
        String donde = condicionesEventos(f, idioma, p);
        return jdbc.sql("SELECT count(*) FROM (" + EVENTO + donde + ") x").params(p).query(Long.class).single();
    }

    public Optional<EventoFila> eventoPorSlug(String slug, String destino, String idioma) {
        return jdbc.sql(EVENTO + " JOIN destino d ON d.id = e.destino_id AND d.codigo = :destino"
                + " WHERE e.slug = :slug AND e.estado = 'publicado' AND e.eliminado_en IS NULL")
                .param("slug", slug).param("destino", destino).param("idioma", idioma)
                .query(EventoFila.class).optional();
    }

    public List<UUID> negociosDeEvento(UUID eventoId) {
        return jdbc.sql("SELECT negocio_id FROM evento_negocio WHERE evento_id = :e")
                .param("e", eventoId).query(UUID.class).list();
    }

    public List<String> idiomasEvento(UUID eventoId) {
        return jdbc.sql("SELECT idioma_codigo FROM evento_traduccion WHERE evento_id = :e ORDER BY idioma_codigo")
                .param("e", eventoId).query(String.class).list();
    }

    // ---------------- mapa del sitio ----------------

    public List<SitemapFila> sitemapNegocios(String destino) {
        return jdbc.sql("""
                SELECT n.slug, n.actualizado_en,
                       array_to_string(ARRAY(SELECT t.idioma_codigo FROM negocio_traduccion t
                         WHERE t.negocio_id = n.id AND length(trim(coalesce(t.descripcion_corta, ''))) > 0
                         ORDER BY t.idioma_codigo), ',') AS idiomas
                FROM negocio n JOIN destino d ON d.id = n.destino_id AND d.codigo = :d
                WHERE n.estado = 'publicada' AND n.eliminado_en IS NULL ORDER BY n.slug""")
                .param("d", destino).query(SitemapFila.class).list();
    }

    public List<SitemapFila> sitemapLugares(String destino) {
        return jdbc.sql("""
                SELECT l.slug, l.actualizado_en,
                       array_to_string(ARRAY(SELECT t.idioma_codigo FROM lugar_traduccion t
                         WHERE t.lugar_id = l.id ORDER BY t.idioma_codigo), ',') AS idiomas
                FROM lugar l JOIN destino d ON d.id = l.destino_id AND d.codigo = :d
                WHERE l.estado = 'publicado' AND l.eliminado_en IS NULL ORDER BY l.slug""")
                .param("d", destino).query(SitemapFila.class).list();
    }

    public List<SitemapFila> sitemapRutas(String destino) {
        return jdbc.sql("""
                SELECT r.slug, r.actualizado_en,
                       array_to_string(ARRAY(SELECT t.idioma_codigo FROM ruta_traduccion t
                         WHERE t.ruta_id = r.id ORDER BY t.idioma_codigo), ',') AS idiomas
                FROM ruta r JOIN destino d ON d.id = r.destino_id AND d.codigo = :d
                WHERE r.estado = 'publicada' AND r.eliminado_en IS NULL ORDER BY r.slug""")
                .param("d", destino).query(SitemapFila.class).list();
    }

    public List<SitemapFila> sitemapEventos(String destino, LocalDate desde) {
        return jdbc.sql("""
                SELECT e.slug, e.actualizado_en,
                       array_to_string(ARRAY(SELECT t.idioma_codigo FROM evento_traduccion t
                         WHERE t.evento_id = e.id ORDER BY t.idioma_codigo), ',') AS idiomas
                FROM evento e JOIN destino d ON d.id = e.destino_id AND d.codigo = :d
                WHERE e.estado = 'publicado' AND e.eliminado_en IS NULL AND e.fecha_fin >= :desde ORDER BY e.slug""")
                .param("d", destino).param("desde", desde).query(SitemapFila.class).list();
    }
}
