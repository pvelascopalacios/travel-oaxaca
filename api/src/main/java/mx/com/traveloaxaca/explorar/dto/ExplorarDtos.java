package mx.com.traveloaxaca.explorar.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionPublicaDto;
import mx.com.traveloaxaca.comun.api.Pagina;

/** Lo que ve el turista. Todos los textos vienen ya en su idioma, con respaldo en español. */
public final class ExplorarDtos {

    private ExplorarDtos() {
    }

    // ---------------- negocios ----------------

    /** abiertoAhora es nulo cuando el negocio no capturó horarios. distanciaM solo viene si se mandó una ubicación. */
    public record NegocioTarjetaDto(UUID id, String slug, String nombre, String categoriaClave, String categoriaNombre,
                                    String descripcionCorta, String municipioNombre, String regionNombre,
                                    Integer rangoPrecio, BigDecimal precioDesde, String unidadPrecio, String moneda,
                                    Double latitud, Double longitud, Integer distanciaM, Boolean abiertoAhora,
                                    String portadaUrl, boolean verificado, BigDecimal calificacionPromedio,
                                    int totalResenas, List<ServicioPublicoDto> servicios) {
    }

    /** Región con lo publicado en ella. portadaUrl sale de la foto de un lugar de la región (nulo si no hay). */
    public record RegionConteoDto(UUID id, String slug, String nombre, long totalNegocios, long totalLugares,
                            long totalEventos, String portadaUrl) {
    }

    public record PuntoMapaDto(UUID id, String slug, String nombre, String categoriaClave, double latitud,
                               double longitud) {
    }

    public record HorarioPublicoDto(int diaSemana, String abre, String cierra, boolean cerrado) {
    }

    public record ExcepcionPublicaDto(LocalDate fecha, String abre, String cierra, boolean cerrado, String nota) {
    }

    public record SucursalPublicaDto(UUID id, String nombre, boolean esPrincipal, String municipioNombre,
                                     String regionNombre, String direccion, String referencia, Double latitud,
                                     Double longitud, Boolean abiertoAhora, List<HorarioPublicoDto> horarios,
                                     List<ExcepcionPublicaDto> excepciones) {
    }

    public record ContactoPublicoDto(String tipo, String valor, boolean esPrincipal) {
    }

    public record ServicioPublicoDto(String clave, String nombre, String icono) {
    }

    public record IdiomaPublicoDto(String codigo, String nombre, String nivel) {
    }

    public record FotoPublicaDto(String url, String pieTexto, boolean esPortada) {
    }

    /** Para que una web pueda armar sus etiquetas, su enlace canónico y sus datos estructurados sin pedir nada más. */
    public record SeoDto(String titulo, String descripcion, String rutaCanonica, List<String> idiomasDisponibles,
                         Map<String, Object> jsonLd) {
    }

    public record NegocioPublicoDto(UUID id, String slug, String nombre, String categoriaClave, String categoriaNombre,
                                    Integer rangoPrecio, BigDecimal precioDesde, String unidadPrecio, String moneda,
                                    String descripcionCorta, String descripcion, String politicas,
                                    Map<String, Object> atributos, boolean verificado,
                                    List<SucursalPublicaDto> sucursales, List<ContactoPublicoDto> contactos,
                                    List<ServicioPublicoDto> servicios, List<IdiomaPublicoDto> idiomas,
                                    List<FotoPublicaDto> fotos, OffsetDateTime actualizadoEn, SeoDto seo,
                                    BigDecimal calificacionPromedio, int totalResenas,
                                    List<PromocionPublicaDto> promociones, boolean patrocinado, String grupoClave,
                                    List<OfertaPublicaDto> ofertas, PosicionDto posicion) {
    }

    /** Habitación, tour, platillo, producto o experiencia publicada. seccion y etiquetas solo vienen en platillos. */
    public record OfertaPublicaDto(UUID id, String tipo, String nombre, String descripcion, String incluye,
                                   String noIncluye, BigDecimal precioDesde, String unidadPrecio, String moneda,
                                   Integer duracionMin, Integer capacidad, String seccion, List<String> etiquetas) {
    }

    /** Lugar entre los negocios de su misma categoría principal en su municipio ("N.º 4 de 86"). */
    public record PosicionDto(int posicion, int total, String municipioNombre) {
    }

    // ---------------- lugares ----------------

    public record LugarTarjetaDto(UUID id, String slug, String nombre, String tipo, String resumen,
                                  String municipioNombre, String regionNombre, Double latitud, Double longitud,
                                  Integer distanciaM, boolean destacado, String portadaUrl,
                                  Map<String, Object> datos) {
    }

    public record LugarPublicoDto(UUID id, String slug, String nombre, String tipo, String resumen, String historia,
                                  String recomendaciones, String municipioNombre, String regionNombre, Double latitud,
                                  Double longitud, boolean destacado, List<FotoPublicaDto> fotos,
                                  List<LugarTarjetaDto> atractivos, List<NegocioTarjetaDto> negociosCercanos,
                                  OffsetDateTime actualizadoEn, SeoDto seo, String mejorEpoca, String comoLlegar,
                                  Map<String, Object> datos) {
    }

    // ---------------- rutas ----------------

    public record RutaTarjetaDto(UUID id, String slug, String nombre, String descripcion, BigDecimal duracionHoras,
                                 BigDecimal distanciaKm, String dificultad, String transporte, boolean esPremium) {
    }

    /** tipo: lugar, negocio o punto. */
    public record ParadaDto(int orden, String tipo, UUID lugarId, UUID negocioId, String nombre, String slug,
                            Double latitud, Double longitud, Integer minutosEstimados) {
    }

    public record RutaPublicaDto(UUID id, String slug, String nombre, String descripcion, BigDecimal duracionHoras,
                                 BigDecimal distanciaKm, String dificultad, String transporte, boolean esPremium,
                                 List<ParadaDto> paradas, OffsetDateTime actualizadoEn, SeoDto seo) {
    }

    // ---------------- eventos ----------------

    public record EventoTarjetaDto(UUID id, String slug, String nombre, String descripcion, LocalDate fechaInicio,
                                   LocalDate fechaFin, String municipioNombre, String regionNombre, Double latitud,
                                   Double longitud, String temporadaNombre, Map<String, Object> datos) {
    }

    public record EventoPublicoDto(UUID id, String slug, String nombre, String descripcion, LocalDate fechaInicio,
                                   LocalDate fechaFin, String municipioNombre, String regionNombre, Double latitud,
                                   Double longitud, String temporadaNombre, List<NegocioTarjetaDto> negocios,
                                   OffsetDateTime actualizadoEn, SeoDto seo, Map<String, Object> datos) {
    }

    // ---------------- favoritos ----------------

    public record FavoritoEntradaDto(
            @NotNull(message = "Indica qué quieres guardar.")
            @Pattern(regexp = "^(negocio|lugar|ruta)$", message = "El tipo debe ser negocio, lugar o ruta.") String tipo,
            @NotNull(message = "Indica cuál.") UUID id) {
    }

    public record FavoritoDto(String tipo, UUID id, String slug, String nombre, String imagenUrl,
                              OffsetDateTime creadoEn) {
    }

    // ---------------- conteos y búsqueda general ----------------

    public record FacetaDto(UUID categoriaId, String clave, String nombre, String padreClave, long total) {
    }

    public record FacetaLugarDto(String tipo, long total) {
    }

    /** Para pintar los chips con su número: negocios por categoría, lugares por tipo y eventos que aún no terminan. */
    public record FacetasDto(List<FacetaDto> negocios, List<FacetaLugarDto> lugares, long eventos) {
    }

    /** Lo primero de cada tipo, para el buscador de la web. */
    public record BusquedaGlobalDto(String q, Pagina<NegocioTarjetaDto> negocios, Pagina<LugarTarjetaDto> lugares,
                                    Pagina<EventoTarjetaDto> eventos) {
    }

    // ---------------- mapa del sitio ----------------

    public record SitemapItemDto(String slug, OffsetDateTime actualizadoEn, List<String> idiomas) {
    }

    public record SitemapDto(String destino, List<SitemapItemDto> negocios, List<SitemapItemDto> lugares,
                             List<SitemapItemDto> rutas, List<SitemapItemDto> eventos) {
    }
}
