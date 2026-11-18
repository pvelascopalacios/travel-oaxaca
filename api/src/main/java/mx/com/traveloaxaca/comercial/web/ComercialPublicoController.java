package mx.com.traveloaxaca.comercial.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.ConfigAppDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.DestacadoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanPublicoDto;
import mx.com.traveloaxaca.comercial.repo.PlanRepositorio;
import mx.com.traveloaxaca.comercial.servicio.CatalogoComercialServicio;
import mx.com.traveloaxaca.comercial.servicio.PatrocinioServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Lo comercial que ve cualquier persona, sin iniciar sesión. */
@RestController
@RequestMapping("/api/v1/publico")
@Tag(name = "Planes y destacados (público)")
public class ComercialPublicoController {

    private final CatalogoComercialServicio catalogo;
    private final PatrocinioServicio patrocinios;
    private final PlanRepositorio planes;

    public ComercialPublicoController(CatalogoComercialServicio catalogo, PatrocinioServicio patrocinios,
                                      PlanRepositorio planes) {
        this.catalogo = catalogo;
        this.patrocinios = patrocinios;
        this.planes = planes;
    }

    @Operation(summary = "Planes con lo que incluyen y sus precios vigentes")
    @GetMapping("/planes")
    public ApiResponse<List<PlanPublicoDto>> planes() {
        return ApiResponses.ok(catalogo.planesPublicos());
    }

    @Operation(summary = "Negocios patrocinados hoy en un espacio (siempre se muestran como Patrocinado)")
    @GetMapping("/destacados")
    public ApiResponse<List<DestacadoDto>> destacados(@RequestParam String espacio,
                                                      @RequestParam(required = false) String destino,
                                                      @RequestParam(required = false) UUID categoriaId,
                                                      @RequestParam(required = false) UUID regionId,
                                                      @RequestParam(required = false) Integer limite,
                                                      @RequestParam(required = false) String idioma,
                                                      @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(patrocinios.destacados(espacio, destino, categoriaId, regionId, limite,
                idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Interruptores que la app necesita para decidir qué mostrar")
    @GetMapping("/configuracion-app")
    public ApiResponse<ConfigAppDto> configuracion() {
        return ApiResponses.ok(new ConfigAppDto(planes.interruptor("anuncios_terceros_activos"),
                planes.interruptor("reservas_activas")));
    }
}
