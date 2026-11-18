package mx.com.traveloaxaca.comunidad.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ComentarioDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ComentarioEdicionDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ComentarioEntradaDto;
import mx.com.traveloaxaca.comunidad.servicio.ComentarioServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Comentarios sobre lugares, rutas, eventos y artículos. {seccion}: lugares, rutas, eventos o articulos. */
@RestController
@Tag(name = "Comentarios")
public class ComentarioController {

    private final ComentarioServicio servicio;

    public ComentarioController(ComentarioServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Comentarios publicados, con sus respuestas (un nivel)")
    @GetMapping("/api/v1/publico/{seccion}/{slug}/comentarios")
    public ApiResponse<Pagina<ComentarioDto>> publicos(@AuthenticationPrincipal Jwt jwt, @PathVariable String seccion, @PathVariable String slug,
                                                       @RequestParam(required = false) String destino,
                                                       @RequestParam(required = false) Integer pagina,
                                                       @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.publicos(ComentarioServicio.tipoDeRuta(seccion), slug, destino, pagina, tamano,
                jwt == null ? null : Actor.de(jwt).usuarioId()));
    }

    @Operation(summary = "Comentar o responder (padreId) un contenido publicado")
    @PostMapping("/api/v1/mi/{seccion}/{id}/comentarios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ComentarioDto> crear(@AuthenticationPrincipal Jwt jwt, @PathVariable String seccion,
                                            @PathVariable UUID id, @Valid @RequestBody ComentarioEntradaDto cuerpo) {
        ComentarioDto c = servicio.crear(Actor.de(jwt).usuarioId(), ComentarioServicio.tipoDeRuta(seccion), id, cuerpo);
        return "pendiente".equals(c.estado())
                ? ApiResponses.ok(c, List.of("Recibimos tu comentario. Lo revisaremos antes de publicarlo."))
                : ApiResponses.ok(c);
    }

    @Operation(summary = "Editar mi comentario (dentro del plazo configurado)")
    @PutMapping("/api/v1/mi/comentarios/{id}")
    public ApiResponse<ComentarioDto> editar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                             @Valid @RequestBody ComentarioEdicionDto cuerpo) {
        return ApiResponses.ok(servicio.editar(Actor.de(jwt).usuarioId(), id, cuerpo.texto()));
    }

    @Operation(summary = "Borrar mi comentario")
    @DeleteMapping("/api/v1/mi/comentarios/{id}")
    public ApiResponse<Void> borrar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.borrar(Actor.de(jwt).usuarioId(), id);
        return ApiResponses.ok(null);
    }
}
