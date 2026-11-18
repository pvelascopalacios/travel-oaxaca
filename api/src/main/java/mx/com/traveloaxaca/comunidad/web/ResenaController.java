package mx.com.traveloaxaca.comunidad.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.FotoEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.MiResenaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ResenaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ResenaEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ResenasPublicasDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.RespuestaEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.RespuestaResenaDto;
import mx.com.traveloaxaca.comunidad.servicio.ResenaServicio;
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

/** Reseñas: lectura pública, reseña propia del turista y bandeja del equipo del negocio. */
@RestController
@Tag(name = "Reseñas")
public class ResenaController {

    private final ResenaServicio servicio;

    public ResenaController(ResenaServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Reseñas publicadas de un negocio con su calificación (orden: recientes, mejor, peor, utiles)")
    @GetMapping("/api/v1/publico/negocios/{slug}/resenas")
    public ApiResponse<ResenasPublicasDto> publicas(@AuthenticationPrincipal Jwt jwt, @PathVariable String slug,
                                                    @RequestParam(required = false) String destino,
                                                    @RequestParam(required = false) String orden,
                                                    @RequestParam(required = false) Integer pagina,
                                                    @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.publicas(slug, destino, orden, pagina, tamano,
                jwt == null ? null : Actor.de(jwt).usuarioId()));
    }

    @Operation(summary = "Todas mis reseñas, de la más reciente a la más antigua (con el negocio y el estado de cada una)")
    @GetMapping("/api/v1/mi/resenas")
    public ApiResponse<List<MiResenaDto>> mias(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.mias(Actor.de(jwt).usuarioId()));
    }

    @Operation(summary = "Mi reseña de un negocio (con su estado y fotos)")
    @GetMapping("/api/v1/mi/negocios/{negocioId}/resena")
    public ApiResponse<ResenaDto> mia(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID negocioId) {
        return ApiResponses.ok(servicio.mia(Actor.de(jwt).usuarioId(), negocioId));
    }

    @Operation(summary = "Dejar una reseña (una por negocio; se publica al instante si pasa el filtro)")
    @PostMapping("/api/v1/mi/negocios/{negocioId}/resena")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ResenaDto> crear(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID negocioId,
                                        @Valid @RequestBody ResenaEntradaDto cuerpo) {
        ResenaDto r = servicio.crear(Actor.de(jwt).usuarioId(), negocioId, cuerpo);
        return "pendiente".equals(r.estado())
                ? ApiResponses.ok(r, List.of("Recibimos tu reseña. La revisaremos antes de publicarla."))
                : ApiResponses.ok(r, List.of("¡Gracias! Tu reseña ya es visible."));
    }

    @Operation(summary = "Editar mi reseña (dentro del plazo configurado)")
    @PutMapping("/api/v1/mi/resenas/{id}")
    public ApiResponse<ResenaDto> editar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                         @Valid @RequestBody ResenaEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.editar(Actor.de(jwt).usuarioId(), id, cuerpo));
    }

    @Operation(summary = "Borrar mi reseña")
    @DeleteMapping("/api/v1/mi/resenas/{id}")
    public ApiResponse<Void> borrar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.borrar(Actor.de(jwt).usuarioId(), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Agregar una foto ya subida y confirmada a mi reseña (queda pendiente de revisión)")
    @PostMapping("/api/v1/mi/resenas/{id}/fotos")
    public ApiResponse<ResenaDto> agregarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                              @Valid @RequestBody FotoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.agregarFoto(Actor.de(jwt).usuarioId(), id, cuerpo.medioId()),
                List.of("La foto se mostrará cuando el equipo la revise."));
    }

    @Operation(summary = "Quitar una foto de mi reseña")
    @DeleteMapping("/api/v1/mi/resenas/{id}/fotos/{medioId}")
    public ApiResponse<Void> quitarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                        @PathVariable UUID medioId) {
        servicio.quitarFoto(Actor.de(jwt).usuarioId(), id, medioId);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Reseñas publicadas de mi negocio (sinResponder=true para las que esperan respuesta)")
    @GetMapping("/api/v1/negocios/{negocioId}/resenas")
    public ApiResponse<Pagina<ResenaDto>> paraEquipo(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID negocioId,
                                                     @RequestParam(defaultValue = "false") boolean sinResponder,
                                                     @RequestParam(required = false) Integer pagina,
                                                     @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.paraEquipo(Actor.de(jwt), negocioId, sinResponder, pagina, tamano));
    }

    @Operation(summary = "Responder una reseña, o editar la respuesta (no se puede borrar)")
    @PutMapping("/api/v1/negocios/{negocioId}/resenas/{resenaId}/respuesta")
    public ApiResponse<RespuestaResenaDto> responder(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID negocioId,
                                                     @PathVariable UUID resenaId,
                                                     @Valid @RequestBody RespuestaEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.responder(Actor.de(jwt), negocioId, resenaId, cuerpo.texto()));
    }
}
