package mx.com.traveloaxaca.medicion.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.MetricasNegocioDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.ReporteMensualDto;
import mx.com.traveloaxaca.medicion.servicio.MetricasServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Resultados de un negocio. Equipo del negocio y personal interno; un negocio ajeno responde 404. */
@RestController
@RequestMapping("/api/v1/negocios/{id}")
@Tag(name = "Resultados del negocio")
public class MetricasNegocioController {

    private final MetricasServicio servicio;

    public MetricasNegocioController(MetricasServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Vistas y contactos de los últimos 7, 30 o 90 días, comparados con el periodo anterior")
    @GetMapping("/metricas")
    public ApiResponse<MetricasNegocioDto> metricas(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                    @RequestParam(required = false) Integer dias) {
        return ApiResponses.ok(servicio.negocio(Actor.de(jwt), id, dias));
    }

    @Operation(summary = "Reportes mensuales ya generados")
    @GetMapping("/reportes")
    public ApiResponse<java.util.List<ReporteMensualDto>> reportes(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.reportes(Actor.de(jwt), id));
    }

    @Operation(summary = "Un reporte mensual")
    @GetMapping("/reportes/{anio}/{mes}")
    public ApiResponse<ReporteMensualDto> reporte(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                  @PathVariable int anio, @PathVariable int mes) {
        return ApiResponses.ok(servicio.reporte(Actor.de(jwt), id, anio, mes));
    }
}
