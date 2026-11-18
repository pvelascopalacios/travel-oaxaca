package mx.com.traveloaxaca.negocios.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.UUID;
import java.util.function.Supplier;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
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

/** Catálogos que ve cualquiera: se guardan en caché una hora y llevan ETag para no repetir descargas. */
@RestController
@RequestMapping("/api/v1/publico")
@Tag(name = "Catálogos públicos")
public class CatalogoPublicoController {

    private final CatalogoServicio servicio;
    private final ObjectMapper json;

    public CatalogoPublicoController(CatalogoServicio servicio, ObjectMapper json) {
        this.servicio = servicio;
        this.json = json;
    }

    @Operation(summary = "Idiomas disponibles")
    @GetMapping("/idiomas")
    public ResponseEntity<ApiResponse<?>> idiomas(@RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, servicio::idiomas);
    }

    @Operation(summary = "Destinos")
    @GetMapping("/destinos")
    public ResponseEntity<ApiResponse<?>> destinos(@RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, servicio::destinos);
    }

    @Operation(summary = "Regiones (opcionalmente de un destino)")
    @GetMapping("/regiones")
    public ResponseEntity<ApiResponse<?>> regiones(@RequestParam(required = false) String destino,
                                                   @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, () -> servicio.regiones(destino));
    }

    @Operation(summary = "Municipios; filtra por región y por texto")
    @GetMapping("/municipios")
    public ResponseEntity<ApiResponse<?>> municipios(@RequestParam(required = false) UUID regionId,
                                                     @RequestParam(required = false) String q,
                                                     @RequestParam(required = false) Integer limite,
                                                     @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, () -> servicio.municipios(regionId, q, limite));
    }

    @Operation(summary = "Localidades de un municipio")
    @GetMapping("/municipios/{id}/localidades")
    public ResponseEntity<ApiResponse<?>> localidades(@PathVariable UUID id,
                                                      @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        return cacheable(etag, () -> servicio.localidades(id));
    }

    @Operation(summary = "Categorías en árbol. Idioma con ?idioma= o Accept-Language; si falta, español")
    @GetMapping("/categorias")
    public ResponseEntity<ApiResponse<?>> categorias(@RequestParam(required = false) String idioma,
                                                     @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                                     @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        String i = servicio.idioma(idioma != null ? idioma : acepta);
        return cacheable(etag, () -> servicio.categorias(i));
    }

    @Operation(summary = "Servicios y amenidades. Idioma con ?idioma= o Accept-Language; si falta, español")
    @GetMapping("/servicios")
    public ResponseEntity<ApiResponse<?>> servicios(@RequestParam(required = false) String idioma,
                                                    @RequestParam(required = false) String grupo,
                                                    @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta,
                                                    @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String etag) {
        String i = servicio.idioma(idioma != null ? idioma : acepta);
        return cacheable(etag, () -> servicio.servicios(i, grupo));
    }

    /** El ETag se calcula solo con los datos (la respuesta lleva un id de solicitud que cambia siempre). */
    private ResponseEntity<ApiResponse<?>> cacheable(String etagRecibido, Supplier<?> datos) {
        Object d = datos.get();
        String etag = "\"" + huella(d) + "\"";
        CacheControl cache = CacheControl.maxAge(Duration.ofHours(1)).cachePublic();
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
