package mx.com.traveloaxaca.acceso.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.CambiarEstadoSolicitudDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.SolicitudAdminDto;
import mx.com.traveloaxaca.acceso.servicio.AdminUsuariosServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/solicitudes-privacidad")
@Tag(name = "Admin · Privacidad")
public class AdminPrivacidadController {

    private final AdminUsuariosServicio servicio;

    public AdminPrivacidadController(AdminUsuariosServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Listar solicitudes de privacidad")
    @GetMapping
    public ApiResponse<Pagina<SolicitudAdminDto>> listar(
            @RequestParam(required = false) String estado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        return ApiResponses.ok(servicio.solicitudes(estado, pagina, tamano));
    }

    @Operation(summary = "Cambiar el estado de una solicitud")
    @PatchMapping("/{id}")
    public ApiResponse<SolicitudAdminDto> cambiarEstado(@PathVariable UUID id,
                                                        @Valid @RequestBody CambiarEstadoSolicitudDto dto) {
        return ApiResponses.ok(servicio.cambiarEstadoSolicitud(id, dto.estado()), List.of("Solicitud actualizada."));
    }
}
