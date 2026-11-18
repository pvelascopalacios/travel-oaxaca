package mx.com.traveloaxaca.comunidad.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ReaccionDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ReporteContenidoEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ReporteFichaEntradaDto;
import mx.com.traveloaxaca.comunidad.servicio.ReaccionServicio;
import mx.com.traveloaxaca.comunidad.servicio.ReporteServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Reacciones (me gusta / útil) y reportes de fichas y de contenido. */
@RestController
@Tag(name = "Reacciones y reportes")
public class ReaccionReporteController {

    private static final String RECIBIDO = "Gracias por avisarnos. Lo revisaremos.";

    private final ReaccionServicio reacciones;
    private final ReporteServicio reportes;

    public ReaccionReporteController(ReaccionServicio reacciones, ReporteServicio reportes) {
        this.reacciones = reacciones;
        this.reportes = reportes;
    }

    @Operation(summary = "Dar me gusta (negocio, lugar, comentario, articulo) o marcar útil (resena). Idempotente")
    @PutMapping("/api/v1/mi/reacciones/{objetivo}/{id}")
    public ApiResponse<ReaccionDto> poner(@AuthenticationPrincipal Jwt jwt, @PathVariable String objetivo,
                                          @PathVariable UUID id) {
        return ApiResponses.ok(reacciones.poner(Actor.de(jwt).usuarioId(), objetivo, id));
    }

    @Operation(summary = "Quitar mi reacción")
    @DeleteMapping("/api/v1/mi/reacciones/{objetivo}/{id}")
    public ApiResponse<ReaccionDto> quitar(@AuthenticationPrincipal Jwt jwt, @PathVariable String objetivo,
                                           @PathVariable UUID id) {
        return ApiResponses.ok(reacciones.quitar(Actor.de(jwt).usuarioId(), objetivo, id));
    }

    @Operation(summary = "Reportar una ficha (con cuenta o con X-Dispositivo-Id)")
    @PostMapping("/api/v1/publico/reportes/ficha")
    public ApiResponse<Void> reportarFicha(@AuthenticationPrincipal Jwt jwt,
                                           @RequestHeader(value = "X-Dispositivo-Id", required = false) String dispositivo,
                                           @Valid @RequestBody ReporteFichaEntradaDto cuerpo) {
        reportes.reportarFicha(usuario(jwt), uuidONulo(dispositivo), cuerpo);
        return ApiResponses.ok(null, List.of(RECIBIDO));
    }

    @Operation(summary = "Reportar una reseña, un comentario o una foto (con cuenta o con X-Dispositivo-Id)")
    @PostMapping("/api/v1/publico/reportes/contenido")
    public ApiResponse<Void> reportarContenido(@AuthenticationPrincipal Jwt jwt,
                                               @RequestHeader(value = "X-Dispositivo-Id", required = false) String dispositivo,
                                               @Valid @RequestBody ReporteContenidoEntradaDto cuerpo) {
        reportes.reportarContenido(usuario(jwt), uuidONulo(dispositivo), cuerpo);
        return ApiResponses.ok(null, List.of(RECIBIDO));
    }

    private static UUID usuario(Jwt jwt) {
        return jwt == null ? null : Actor.de(jwt).usuarioId();
    }

    private static UUID uuidONulo(String valor) {
        try {
            return valor == null || valor.isBlank() ? null : UUID.fromString(valor.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
