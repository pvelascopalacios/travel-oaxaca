package mx.com.traveloaxaca.revision.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.ColaItemDto;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.DetalleRevisionDto;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.HistorialDto;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.RechazoDto;
import mx.com.traveloaxaca.revision.servicio.RevisionColaServicio;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cola de revisión para admin y editor. */
@RestController
@RequestMapping("/api/v1/revision")
@Tag(name = "Revisión")
public class RevisionController {

    private final RevisionColaServicio servicio;

    public RevisionController(RevisionColaServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Cola de revisión, la solicitud más antigua primero")
    @GetMapping("/cola")
    public ApiResponse<Pagina<ColaItemDto>> cola(@AuthenticationPrincipal Jwt jwt,
                                                 @RequestParam(required = false) String tipo,
                                                 @RequestParam(required = false) UUID regionId,
                                                 @RequestParam(required = false) UUID categoriaId,
                                                 @RequestParam(defaultValue = "0") int pagina,
                                                 @RequestParam(defaultValue = "20") int tamano) {
        return ApiResponses.ok(servicio.cola(Actor.de(jwt), tipo, regionId, categoriaId, pagina, tamano));
    }

    @Operation(summary = "Detalle de un negocio para revisarlo")
    @GetMapping("/negocios/{id}")
    public ApiResponse<DetalleRevisionDto> detalle(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.detalle(Actor.de(jwt), id));
    }

    @Operation(summary = "Aprobar la ficha nueva o los cambios pendientes")
    @PostMapping("/negocios/{id}/aprobar")
    public ApiResponse<Void> aprobar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.aprobar(Actor.de(jwt), id);
        return ApiResponses.ok(null, List.of("Aprobado. Avisamos al dueño del negocio."));
    }

    @Operation(summary = "Rechazar la ficha nueva o los cambios pendientes, con motivo")
    @PostMapping("/negocios/{id}/rechazar")
    public ApiResponse<Void> rechazar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                      @Valid @RequestBody RechazoDto dto) {
        servicio.rechazar(Actor.de(jwt), id, dto.motivo());
        return ApiResponses.ok(null, List.of("Rechazado. Enviamos el motivo al dueño del negocio."));
    }

    @Operation(summary = "Aprobar una foto")
    @PostMapping("/medios/{id}/aprobar")
    public ApiResponse<Void> aprobarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.aprobarFoto(Actor.de(jwt), id);
        return ApiResponses.ok(null, List.of("Foto aprobada."));
    }

    @Operation(summary = "Rechazar una foto, con motivo")
    @PostMapping("/medios/{id}/rechazar")
    public ApiResponse<Void> rechazarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                          @Valid @RequestBody RechazoDto dto) {
        servicio.rechazarFoto(Actor.de(jwt), id, dto.motivo());
        return ApiResponses.ok(null, List.of("Foto rechazada. Enviamos el motivo al dueño del negocio."));
    }

    @Operation(summary = "Historial de revisiones resueltas")
    @GetMapping("/historial")
    public ApiResponse<Pagina<HistorialDto>> historial(@AuthenticationPrincipal Jwt jwt,
                                                       @RequestParam(defaultValue = "0") int pagina,
                                                       @RequestParam(defaultValue = "20") int tamano) {
        return ApiResponses.ok(servicio.historial(Actor.de(jwt), pagina, tamano));
    }
}
