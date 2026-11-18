package mx.com.traveloaxaca.estado;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/publico")
@Tag(name = "Estado")
public class EstadoController {

    private final EstadoService servicio;

    public EstadoController(EstadoService servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Estado de la API y de la base de datos")
    @GetMapping("/estado")
    public ApiResponse<Map<String, Object>> estado() {
        return ApiResponses.ok(servicio.estado());
    }
}
