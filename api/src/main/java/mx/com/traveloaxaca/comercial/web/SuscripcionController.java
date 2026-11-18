package mx.com.traveloaxaca.comercial.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.ActivarSuscripcionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CancelarSuscripcionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoEstadoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanNegocioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.ResultadoActivacionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.SuscripcionDto;
import mx.com.traveloaxaca.comercial.servicio.PlanServicio;
import mx.com.traveloaxaca.comercial.servicio.SuscripcionServicio;
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

/** Mi plan (dueño) y el cobro manual (ventas y administración). */
@RestController
@Tag(name = "Suscripciones y pagos")
public class SuscripcionController {

    private final PlanServicio planes;
    private final SuscripcionServicio servicio;

    public SuscripcionController(PlanServicio planes, SuscripcionServicio servicio) {
        this.planes = planes;
        this.servicio = servicio;
    }

    @Operation(summary = "Mi plan: qué incluye, hasta cuándo y cuánto llevo usado")
    @GetMapping("/api/v1/negocios/{id}/plan")
    public ApiResponse<PlanNegocioDto> miPlan(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(planes.miPlan(Actor.de(jwt), id));
    }

    @Operation(summary = "Historial de suscripciones del negocio")
    @GetMapping("/api/v1/negocios/{id}/suscripciones")
    public ApiResponse<List<SuscripcionDto>> historial(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.historial(Actor.de(jwt), id));
    }

    @Operation(summary = "Pagos registrados del negocio")
    @GetMapping("/api/v1/negocios/{id}/pagos")
    public ApiResponse<List<PagoDto>> pagos(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.pagos(Actor.de(jwt), id));
    }

    @Operation(summary = "Activar, renovar o cambiar el plan de un negocio (cobro manual)")
    @PostMapping("/api/v1/admin/negocios/{id}/suscripciones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ResultadoActivacionDto> activar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                       @Valid @RequestBody ActivarSuscripcionDto cuerpo) {
        return ApiResponses.ok(servicio.activar(Actor.de(jwt), id, cuerpo));
    }

    @Operation(summary = "Cancelar una suscripción: el negocio vuelve al plan Gratis")
    @PostMapping("/api/v1/admin/suscripciones/{id}/cancelar")
    public ApiResponse<SuscripcionDto> cancelar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                @Valid @RequestBody CancelarSuscripcionDto cuerpo) {
        return ApiResponses.ok(servicio.cancelar(Actor.de(jwt), id, cuerpo.motivo()));
    }

    @Operation(summary = "Pagos que siguen pendientes de confirmar")
    @GetMapping("/api/v1/admin/pagos/pendientes")
    public ApiResponse<List<PagoDto>> pendientes(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.pendientes(Actor.de(jwt)));
    }

    @Operation(summary = "Registrar un cobro que no es una suscripción (patrocinio u otro)")
    @PostMapping("/api/v1/admin/pagos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PagoDto> registrar(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PagoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.registrarPago(Actor.de(jwt), cuerpo));
    }

    @Operation(summary = "Confirmar, marcar como fallido o reembolsar un pago")
    @PostMapping("/api/v1/admin/pagos/{id}/estado")
    public ApiResponse<PagoDto> estado(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                       @Valid @RequestBody PagoEstadoDto cuerpo) {
        return ApiResponses.ok(servicio.cambiarEstado(Actor.de(jwt), id, cuerpo));
    }
}
