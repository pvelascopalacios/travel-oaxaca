package mx.com.traveloaxaca.acceso.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.AsignarRolDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.CambiarEstadoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.UsuarioAdminDto;
import mx.com.traveloaxaca.acceso.servicio.AdminUsuariosServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/usuarios")
@Tag(name = "Admin · Usuarios")
public class AdminUsuariosController {

    private final AdminUsuariosServicio servicio;

    public AdminUsuariosController(AdminUsuariosServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Listar usuarios con filtros")
    @GetMapping
    public ApiResponse<Pagina<UsuarioAdminDto>> listar(
            @RequestParam(required = false) String texto,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String rol,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        return ApiResponses.ok(servicio.listar(texto, estado, rol, pagina, tamano));
    }

    @Operation(summary = "Activar o suspender una cuenta")
    @PatchMapping("/{id}/estado")
    public ApiResponse<Void> cambiarEstado(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                           @Valid @RequestBody CambiarEstadoDto dto) {
        servicio.cambiarEstado(Principal.usuarioId(jwt), id, dto.estado());
        return ApiResponses.ok(null, List.of("Estado actualizado."));
    }

    @Operation(summary = "Dar un rol global (admin, editor, ventas)")
    @PostMapping("/{id}/roles")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> asignarRol(@PathVariable UUID id, @Valid @RequestBody AsignarRolDto dto) {
        servicio.asignarRol(id, dto.rol());
        return ApiResponses.ok(null, List.of("Rol asignado."));
    }

    @Operation(summary = "Quitar un rol global")
    @DeleteMapping("/{id}/roles/{rol}")
    public ApiResponse<Void> quitarRol(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                       @PathVariable String rol) {
        servicio.quitarRol(Principal.usuarioId(jwt), id, rol);
        return ApiResponses.ok(null, List.of("Rol retirado."));
    }
}
