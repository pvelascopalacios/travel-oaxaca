package mx.com.traveloaxaca.explorar.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio.BusquedaLugares;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio.BusquedaNegocios;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Lo que ve cualquiera, sin cuenta: buscar, mapa, fichas, lugares, rutas, eventos y mapa del sitio. */
@RestController
@RequestMapping("/api/v1/publico")
@Tag(name = "Explorar")
public class ExplorarController {

    private static final String DISPOSITIVO = "X-Dispositivo-Id";

    private final ExplorarServicio servicio;
    private final ObjectMapper json;

    public ExplorarController(ExplorarServicio servicio, ObjectMapper json) {
        this.servicio = servicio;
        this.json = json;
    }

    // ---------------- negocios ----------------

    @Operation(summary = "Buscar negocios publicados",
            description = "Con lat y lng devuelve la distancia en metros y puedes ordenar por distancia. 'cerca=true' limita a 25 km; "
                    + "radioKm (1 a 100) pone otro radio. La ubicación exacta no se guarda.")
    @GetMapping("/negocios")
    public ApiResponse<?> negocios(@RequestParam(required = false) String q,
                                   @RequestParam(required = false) UUID categoriaId,
                                   @RequestParam(required = false) List<UUID> categoriaIds,
                                   @RequestParam(required = false) UUID regionId,
                                   @RequestParam(required = false) UUID municipioId,
                                   @RequestParam(required = false) Integer precioMax,
                                   @RequestParam(required = false) List<UUID> servicioIds,
                                   @RequestParam(required = false) List<String> idiomas,
                                   @RequestParam(defaultValue = "false") boolean abiertoAhora,
                                   @RequestParam(required = false) Double lat,
                                   @RequestParam(required = false) Double lng,
                                   @RequestParam(required = false) Double radioKm,
                                   @RequestParam(defaultValue = "false") boolean cerca,
                                   @RequestParam(required = false) String orden,
                                   @RequestParam(required = false) Integer pagina,
                                   @RequestParam(required = false) Integer tamano,
                                   @RequestParam(required = false) String idioma,
                                   @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                   @RequestHeader(value = DISPOSITIVO, required = false) String dispositivo) {
        return ApiResponses.ok(servicio.buscarNegocios(new BusquedaNegocios(q, categoriaId, regionId, municipioId,
                precioMax, servicioIds, idiomas, abiertoAhora, lat, lng, radioKm, cerca, orden, pagina, tamano,
                categoriaIds),
                idioma != null ? idioma : acepta, dispositivo));
    }

    @Operation(summary = "Cuántos negocios, lugares y eventos hay por categoría, tipo y total, para los chips de la web",
            description = "Acepta q, regionId y municipioId. Los negocios vienen por subcategoría con la clave de su categoría principal.")
    @GetMapping("/negocios/facetas")
    public ApiResponse<?> facetas(@RequestParam(required = false) String q, @RequestParam(required = false) UUID regionId,
                                  @RequestParam(required = false) UUID municipioId,
                                  @RequestParam(required = false) String idioma,
                                  @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.facetas(q, regionId, municipioId, idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Las regiones del destino con cuántos negocios, lugares y eventos vigentes tiene cada una",
            description = "Para filtrar por región usa su id en regionId de /negocios, /lugares y /eventos. "
                    + "La lista simple de regiones (sin conteos) sigue en /publico/regiones.")
    @GetMapping("/regiones/conteos")
    public ResponseEntity<ApiResponse<?>> regionesConConteos(@RequestParam(required = false) String destino,
                                                   @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, Duration.ofMinutes(10), () -> servicio.regiones(destino));
    }

    @Operation(summary = "Buscador general: lo primero de negocios, lugares y eventos (tamano de 1 a 10, 5 por omisión)",
            description = "Pide al menos 2 letras. No se guarda en el historial de búsquedas.")
    @GetMapping("/buscar")
    public ApiResponse<?> buscar(@RequestParam(required = false) String q, @RequestParam(required = false) Integer tamano,
                                 @RequestParam(required = false) String idioma,
                                 @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.buscarGlobal(q, idioma != null ? idioma : acepta, tamano));
    }

    @Operation(summary = "Puntos para el mapa dentro de un cuadro (norte, sur, este, oeste); máximo 500")
    @GetMapping("/negocios/mapa")
    public ApiResponse<?> mapa(@RequestParam(required = false) Double norte, @RequestParam(required = false) Double sur,
                               @RequestParam(required = false) Double este, @RequestParam(required = false) Double oeste,
                               @RequestParam(required = false) UUID categoriaId) {
        return ApiResponses.ok(servicio.puntosMapa(norte, sur, este, oeste, categoriaId));
    }

    @Operation(summary = "Ficha pública de un negocio por su slug (incluye datos para SEO)")
    @GetMapping("/negocios/{slug}")
    public ResponseEntity<ApiResponse<?>> negocio(@PathVariable String slug,
                                                  @RequestParam(required = false) String destino,
                                                  @RequestParam(required = false) String idioma,
                                                  @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                                  @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        String i = idioma != null ? idioma : acepta;
        return cacheable(etag, Duration.ofMinutes(5), () -> servicio.negocio(slug, destino, i));
    }

    // ---------------- lugares ----------------

    @Operation(summary = "Lugares y atractivos publicados")
    @GetMapping("/lugares")
    public ApiResponse<?> lugares(@RequestParam(required = false) String q, @RequestParam(required = false) String tipo,
                                  @RequestParam(required = false) UUID regionId,
                                  @RequestParam(required = false) UUID municipioId,
                                  @RequestParam(required = false) Boolean destacado,
                                  @RequestParam(required = false) UUID padreId,
                                  @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng,
                                  @RequestParam(required = false) Double radioKm,
                                  @RequestParam(defaultValue = "false") boolean cerca,
                                  @RequestParam(required = false) Integer pagina,
                                  @RequestParam(required = false) Integer tamano,
                                  @RequestParam(required = false) String entrada,
                                  @RequestParam(required = false) String idioma,
                                  @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.buscarLugares(new BusquedaLugares(q, tipo, regionId, municipioId, destacado,
                padreId, lat, lng, radioKm, cerca, pagina, tamano, entrada), idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Detalle de un lugar por slug")
    @GetMapping("/lugares/{slug}")
    public ResponseEntity<ApiResponse<?>> lugar(@PathVariable String slug, @RequestParam(required = false) String destino,
                                                @RequestParam(required = false) String idioma,
                                                @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                                @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        String i = idioma != null ? idioma : acepta;
        return cacheable(etag, Duration.ofMinutes(5), () -> servicio.lugar(slug, destino, i));
    }

    // ---------------- rutas ----------------

    @Operation(summary = "Rutas publicadas")
    @GetMapping("/rutas")
    public ApiResponse<?> rutas(@RequestParam(required = false) String q, @RequestParam(required = false) String dificultad,
                                @RequestParam(required = false) String transporte,
                                @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamano,
                                @RequestParam(required = false) String idioma,
                                @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.buscarRutas(q, dificultad, transporte, pagina, tamano,
                idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Detalle de una ruta por slug, con sus paradas")
    @GetMapping("/rutas/{slug}")
    public ResponseEntity<ApiResponse<?>> ruta(@PathVariable String slug, @RequestParam(required = false) String destino,
                                               @RequestParam(required = false) String idioma,
                                               @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                               @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        String i = idioma != null ? idioma : acepta;
        return cacheable(etag, Duration.ofMinutes(5), () -> servicio.ruta(slug, destino, i));
    }

    // ---------------- eventos ----------------

    @Operation(summary = "Eventos que aún no terminan (desde hoy, hora de México, salvo que mandes 'desde')")
    @GetMapping("/eventos")
    public ApiResponse<?> eventos(@RequestParam(required = false) String q,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
                                  @RequestParam(required = false) UUID regionId,
                                  @RequestParam(required = false) UUID municipioId,
                                  @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamano,
                                  @RequestParam(required = false) Boolean gratis,
                                  @RequestParam(required = false) String idioma,
                                  @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.buscarEventos(q, desde, hasta, regionId, municipioId, pagina, tamano,
                idioma != null ? idioma : acepta, gratis));
    }

    @Operation(summary = "Detalle de un evento por slug")
    @GetMapping("/eventos/{slug}")
    public ResponseEntity<ApiResponse<?>> evento(@PathVariable String slug, @RequestParam(required = false) String destino,
                                                 @RequestParam(required = false) String idioma,
                                                 @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                                 @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        String i = idioma != null ? idioma : acepta;
        return cacheable(etag, Duration.ofMinutes(5), () -> servicio.evento(slug, destino, i));
    }

    // ---------------- mapa del sitio ----------------

    @Operation(summary = "Todo lo publicado con su fecha de cambio e idiomas, para generar el sitemap de la web")
    @GetMapping("/sitemap")
    public ResponseEntity<ApiResponse<?>> sitemap(@RequestParam(required = false) String destino,
                                                  @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, Duration.ofHours(1), () -> servicio.sitemap(destino));
    }

    /** El ETag se calcula solo con los datos (la respuesta lleva un id de solicitud que cambia siempre). */
    private ResponseEntity<ApiResponse<?>> cacheable(String etagRecibido, Duration vida, Supplier<?> datos) {
        Object d = datos.get();
        String etag = "\"" + huella(d) + "\"";
        CacheControl cache = CacheControl.maxAge(vida).cachePublic();
        if (etag.equals(etagRecibido)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).cacheControl(cache)
                    .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE).build();
        }
        return ResponseEntity.ok().eTag(etag).cacheControl(cache)
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE)
                .body(ApiResponses.ok(d));
    }

    private String huella(Object datos) {
        try {
            byte[] b = json.writeValueAsString(datos).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b)).substring(0, 32);
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
