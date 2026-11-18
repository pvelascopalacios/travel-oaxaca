package mx.com.traveloaxaca.comercial.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CuponDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CuponEdicionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CuponEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanEdicionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PrecioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PrecioEntradaDto;
import mx.com.traveloaxaca.comercial.servicio.CatalogoComercialServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.springframework.format.annotation.DateTimeFormat;
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

/** Planes, precios y cupones. Solo administración (lo exige la configuración de seguridad). */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Planes, precios y cupones (admin)")
public class CatalogoComercialController {

    private final CatalogoComercialServicio servicio;

    public CatalogoComercialController(CatalogoComercialServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Planes con sus límites")
    @GetMapping("/planes")
    public ApiResponse<List<PlanDto>> planes() {
        return ApiResponses.ok(servicio.planes());
    }

    @Operation(summary = "Cambiar los límites o lo que incluye un plan")
    @PutMapping("/planes/{id}")
    public ApiResponse<PlanDto> actualizarPlan(@PathVariable UUID id, @Valid @RequestBody PlanEdicionDto cuerpo) {
        return ApiResponses.ok(servicio.actualizarPlan(id, cuerpo));
    }

    @Operation(summary = "Precios capturados (todos o de un plan)")
    @GetMapping("/precios")
    public ApiResponse<List<PrecioDto>> precios(@RequestParam(required = false) UUID planId,
                                                @RequestParam(defaultValue = "false") boolean soloVigentes) {
        return ApiResponses.ok(servicio.precios(planId, soloVigentes));
    }

    @Operation(summary = "Capturar un precio (por plan, periodo y, si quieres, destino o categoría)")
    @PostMapping("/precios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PrecioDto> crearPrecio(@Valid @RequestBody PrecioEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crearPrecio(cuerpo));
    }

    @Operation(summary = "Dejar de usar un precio sin borrar el historial")
    @PostMapping("/precios/{id}/cerrar")
    public ApiResponse<PrecioDto> cerrarPrecio(@PathVariable UUID id,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        return ApiResponses.ok(servicio.cerrarPrecio(id, hasta));
    }

    @Operation(summary = "Cupones")
    @GetMapping("/cupones")
    public ApiResponse<List<CuponDto>> cupones() {
        return ApiResponses.ok(servicio.cupones());
    }

    @Operation(summary = "Crear un cupón")
    @PostMapping("/cupones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CuponDto> crearCupon(@Valid @RequestBody CuponEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crearCupon(cuerpo));
    }

    @Operation(summary = "Cambiar la descripción, el máximo de usos o el último día de un cupón")
    @PutMapping("/cupones/{id}")
    public ApiResponse<CuponDto> actualizarCupon(@PathVariable UUID id, @Valid @RequestBody CuponEdicionDto cuerpo) {
        return ApiResponses.ok(servicio.actualizarCupon(id, cuerpo.descripcion(), cuerpo.maxUsos(), cuerpo.vigenteHasta()));
    }
}
