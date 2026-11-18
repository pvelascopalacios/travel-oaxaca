package mx.com.traveloaxaca.comercial.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.VerificacionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.VerificacionEntradaDto;
import mx.com.traveloaxaca.comercial.servicio.VerificacionServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Verificación de negocios: administración y edición registran; ventas solo consulta. */
@RestController
@Tag(name = "Verificación de negocios")
public class VerificacionController {

    private final VerificacionServicio servicio;

    public VerificacionController(VerificacionServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Historial de verificaciones del negocio")
    @GetMapping("/api/v1/admin/negocios/{id}/verificaciones")
    public ApiResponse<List<VerificacionDto>> historial(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.historial(Actor.de(jwt), id));
    }

    @Operation(summary = "Registrar una verificación; si es aprobada, el negocio queda verificado")
    @PostMapping("/api/v1/admin/negocios/{id}/verificaciones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<VerificacionDto> registrar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                  @Valid @RequestBody VerificacionEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.registrar(Actor.de(jwt), id, cuerpo));
    }
}
