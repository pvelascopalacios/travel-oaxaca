package mx.com.traveloaxaca.acceso.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.DispositivoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.DispositivoRespuesta;
import mx.com.traveloaxaca.acceso.servicio.DispositivoServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/publico/dispositivos")
@Tag(name = "Acceso")
public class DispositivoController {

    private final DispositivoServicio servicio;

    public DispositivoController(DispositivoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Registrar o refrescar el dispositivo de la app (sin cuenta)")
    @PostMapping
    public ApiResponse<DispositivoRespuesta> registrar(@Valid @RequestBody DispositivoDto dto, HttpServletRequest req) {
        return ApiResponses.ok(new DispositivoRespuesta(servicio.registrar(dto, req.getRemoteAddr())));
    }
}
