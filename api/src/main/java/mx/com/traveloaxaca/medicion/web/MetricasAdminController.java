package mx.com.traveloaxaca.medicion.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.*;
import mx.com.traveloaxaca.medicion.servicio.CampanaServicio;
import mx.com.traveloaxaca.medicion.servicio.MetricasGeneralesServicio;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Panel interno: métricas generales (admin, editor y ventas) y campañas de origen (admin y editor). */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Medición interna")
public class MetricasAdminController {

    private final MetricasGeneralesServicio metricas;
    private final CampanaServicio campanas;

    public MetricasAdminController(MetricasGeneralesServicio metricas, CampanaServicio campanas) {
        this.metricas = metricas;
        this.campanas = campanas;
    }

    @Operation(summary = "Totales y ranking de negocios (7, 30 o 90 días); filtros por región y categoría")
    @GetMapping("/metricas")
    public ApiResponse<MetricasGeneralesDto> resumen(@RequestParam(required = false) Integer dias,
                                                     @RequestParam(required = false) UUID regionId,
                                                     @RequestParam(required = false) UUID categoriaId,
                                                     @RequestParam(required = false) Integer limite) {
        return ApiResponses.ok(metricas.resumen(dias, regionId, categoriaId, limite));
    }

    @Operation(summary = "Orígenes de tráfico disponibles")
    @GetMapping("/origenes")
    public ApiResponse<List<OrigenDto>> origenes() {
        return ApiResponses.ok(campanas.origenes());
    }

    @Operation(summary = "Campañas con sus vistas y contactos")
    @GetMapping("/campanas")
    public ApiResponse<List<CampanaDto>> listar() {
        return ApiResponses.ok(campanas.listar());
    }

    @Operation(summary = "Crear una campaña. El código va en los enlaces (?o=codigo)")
    @PostMapping("/campanas")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CampanaDto> crear(@Valid @RequestBody CampanaEntradaDto cuerpo) {
        return ApiResponses.ok(campanas.crear(cuerpo));
    }

    @Operation(summary = "Editar una campaña (el código no cambia)")
    @PutMapping("/campanas/{id}")
    public ApiResponse<CampanaDto> actualizar(@PathVariable UUID id, @Valid @RequestBody CampanaCambioDto cuerpo) {
        return ApiResponses.ok(campanas.actualizar(id, cuerpo));
    }
}
