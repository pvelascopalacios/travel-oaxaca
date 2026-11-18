package mx.com.traveloaxaca.comunidad.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ColaComunidadItemDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.MotivoDto;
import mx.com.traveloaxaca.comunidad.servicio.ModeracionComunidadServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Moderación de la comunidad para admin y editor (la ruta ya queda protegida por /api/v1/revision/**). */
@RestController
@RequestMapping("/api/v1/revision/comunidad")
@Tag(name = "Revisión · comunidad")
public class ModeracionComunidadController {

    private final ModeracionComunidadServicio servicio;

    public ModeracionComunidadController(ModeracionComunidadServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Cola: reseñas, comentarios, fotos y reportes (tipo: resena, comentario, foto, reporte_ficha, reporte_contenido; negocioId filtra)")
    @GetMapping("/cola")
    public ApiResponse<Pagina<ColaComunidadItemDto>> cola(@RequestParam(required = false) String tipo,
                                                          @RequestParam(required = false) UUID negocioId,
                                                          @RequestParam(required = false) Integer pagina,
                                                          @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.cola(tipo, negocioId, pagina, tamano));
    }

    @Operation(summary = "Publicar una reseña pendiente u oculta por reportes")
    @PostMapping("/resenas/{id}/publicar")
    public ApiResponse<Void> publicarResena(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.publicarResena(Actor.de(jwt), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Ocultar una reseña")
    @PostMapping("/resenas/{id}/ocultar")
    public ApiResponse<Void> ocultarResena(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.ocultarResena(Actor.de(jwt), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Rechazar una reseña")
    @PostMapping("/resenas/{id}/rechazar")
    public ApiResponse<Void> rechazarResena(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.rechazarResena(Actor.de(jwt), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Publicar un comentario pendiente u oculto por reportes")
    @PostMapping("/comentarios/{id}/publicar")
    public ApiResponse<Void> publicarComentario(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.publicarComentario(Actor.de(jwt), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Ocultar un comentario")
    @PostMapping("/comentarios/{id}/ocultar")
    public ApiResponse<Void> ocultarComentario(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.ocultarComentario(Actor.de(jwt), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Rechazar un comentario")
    @PostMapping("/comentarios/{id}/rechazar")
    public ApiResponse<Void> rechazarComentario(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.rechazarComentario(Actor.de(jwt), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Aprobar una foto de reseña")
    @PostMapping("/fotos/{medioId}/aprobar")
    public ApiResponse<Void> aprobarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID medioId) {
        servicio.aprobarFoto(Actor.de(jwt), medioId);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Rechazar una foto de reseña (con motivo)")
    @PostMapping("/fotos/{medioId}/rechazar")
    public ApiResponse<Void> rechazarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID medioId,
                                          @Valid @RequestBody MotivoDto cuerpo) {
        servicio.rechazarFoto(Actor.de(jwt), medioId, cuerpo.motivo());
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Reportes: revisar, resolver o descartar (tabla: ficha o contenido)")
    @PostMapping("/reportes/{tabla}/{id}/{accion}")
    public ApiResponse<Void> reporte(@AuthenticationPrincipal Jwt jwt, @PathVariable String tabla,
                                     @PathVariable UUID id, @PathVariable String accion) {
        if (!"ficha".equals(tabla) && !"contenido".equals(tabla)) {
            throw mx.com.traveloaxaca.comun.error.BusinessException.noEncontrado("Ese tipo de reporte no existe.");
        }
        servicio.reporte(Actor.de(jwt), tabla, id, accion);
        return ApiResponses.ok(null);
    }
}
