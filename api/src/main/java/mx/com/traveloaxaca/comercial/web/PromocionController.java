package mx.com.traveloaxaca.comercial.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionColaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.RechazoDto;
import mx.com.traveloaxaca.comercial.servicio.PromocionServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
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

/** Promociones del negocio y su revisión. */
@RestController
@Tag(name = "Promociones")
public class PromocionController {

    private final PromocionServicio servicio;

    public PromocionController(PromocionServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Promociones del negocio")
    @GetMapping("/api/v1/negocios/{id}/promociones")
    public ApiResponse<List<PromocionDto>> lista(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.deNegocio(Actor.de(jwt), id));
    }

    @Operation(summary = "Una promoción")
    @GetMapping("/api/v1/negocios/{id}/promociones/{promocionId}")
    public ApiResponse<PromocionDto> una(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID promocionId) {
        return ApiResponses.ok(servicio.una(Actor.de(jwt), id, promocionId));
    }

    @Operation(summary = "Crear una promoción en borrador (exige un plan que las incluya)")
    @PostMapping("/api/v1/negocios/{id}/promociones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PromocionDto> crear(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                           @Valid @RequestBody PromocionEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crear(Actor.de(jwt), id, cuerpo));
    }

    @Operation(summary = "Editar una promoción en borrador")
    @PutMapping("/api/v1/negocios/{id}/promociones/{promocionId}")
    public ApiResponse<PromocionDto> actualizar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                @PathVariable UUID promocionId, @Valid @RequestBody PromocionEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizar(Actor.de(jwt), id, promocionId, cuerpo));
    }

    @Operation(summary = "Mandar la promoción a revisión")
    @PostMapping("/api/v1/negocios/{id}/promociones/{promocionId}/enviar-revision")
    public ApiResponse<PromocionDto> enviar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID promocionId) {
        return ApiResponses.ok(servicio.enviarARevision(Actor.de(jwt), id, promocionId));
    }

    @Operation(summary = "Eliminar una promoción")
    @DeleteMapping("/api/v1/negocios/{id}/promociones/{promocionId}")
    public ApiResponse<Void> eliminar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID promocionId) {
        servicio.eliminar(Actor.de(jwt), id, promocionId);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Cola de promociones por aprobar (administración y edición)")
    @GetMapping("/api/v1/revision/promociones")
    public ApiResponse<Pagina<PromocionColaDto>> cola(@AuthenticationPrincipal Jwt jwt,
                                                      @RequestParam(required = false) UUID negocioId,
                                                      @RequestParam(defaultValue = "0") int pagina,
                                                      @RequestParam(defaultValue = "20") int tamano) {
        return ApiResponses.ok(servicio.cola(Actor.de(jwt), negocioId, pagina, tamano));
    }

    @Operation(summary = "Aprobar una promoción: desde ese momento se muestra")
    @PostMapping("/api/v1/revision/promociones/{id}/aprobar")
    public ApiResponse<PromocionDto> aprobar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.aprobar(Actor.de(jwt), id));
    }

    @Operation(summary = "Rechazar una promoción con un motivo: regresa a borrador")
    @PostMapping("/api/v1/revision/promociones/{id}/rechazar")
    public ApiResponse<PromocionDto> rechazar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                              @Valid @RequestBody RechazoDto cuerpo) {
        return ApiResponses.ok(servicio.rechazar(Actor.de(jwt), id, cuerpo.motivo()));
    }
}
