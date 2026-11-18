package mx.com.traveloaxaca.acceso.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.ActualizarPerfilDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.CambiarClaveDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.ConsentimientoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.NuevaSolicitudDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.NuevoConsentimientoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.PerfilDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.SesionActivaDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.SolicitudPrivacidadDto;
import mx.com.traveloaxaca.acceso.servicio.CuentaServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/mi")
@Tag(name = "Mi cuenta")
public class MiController {

    private final CuentaServicio servicio;

    public MiController(CuentaServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Ver mi perfil")
    @GetMapping("/perfil")
    public ApiResponse<PerfilDto> perfil(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.perfil(Principal.usuarioId(jwt)));
    }

    @Operation(summary = "Actualizar mi perfil")
    @PutMapping("/perfil")
    public ApiResponse<PerfilDto> actualizarPerfil(@AuthenticationPrincipal Jwt jwt,
                                                   @Valid @RequestBody ActualizarPerfilDto dto) {
        return ApiResponses.ok(servicio.actualizarPerfil(Principal.usuarioId(jwt), dto), List.of("Perfil actualizado."));
    }

    @Operation(summary = "Cambiar mi contraseña (cierra mis otras sesiones)")
    @PutMapping("/clave")
    public ApiResponse<Void> cambiarClave(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CambiarClaveDto dto) {
        servicio.cambiarClave(Principal.usuarioId(jwt), Principal.sesionId(jwt), dto);
        return ApiResponses.ok(null, List.of("Contraseña actualizada."));
    }

    @Operation(summary = "Mis sesiones abiertas")
    @GetMapping("/sesiones")
    public ApiResponse<List<SesionActivaDto>> sesiones(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.sesiones(Principal.usuarioId(jwt), Principal.sesionId(jwt)));
    }

    @Operation(summary = "Cerrar una de mis sesiones")
    @DeleteMapping("/sesiones/{id}")
    public ApiResponse<Void> cerrarSesion(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.cerrarSesion(Principal.usuarioId(jwt), id);
        return ApiResponses.ok(null, List.of("Sesión cerrada."));
    }

    @Operation(summary = "Mi historial de consentimientos")
    @GetMapping("/consentimientos")
    public ApiResponse<List<ConsentimientoDto>> consentimientos(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.consentimientos(Principal.usuarioId(jwt)));
    }

    @Operation(summary = "Registrar un consentimiento (aceptar o retirar)")
    @PostMapping("/consentimientos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> registrarConsentimiento(@AuthenticationPrincipal Jwt jwt,
                                                     @Valid @RequestBody NuevoConsentimientoDto dto) {
        servicio.registrarConsentimiento(Principal.usuarioId(jwt), dto);
        return ApiResponses.ok(null, List.of("Preferencia guardada."));
    }

    @Operation(summary = "Mis solicitudes de privacidad")
    @GetMapping("/solicitudes-privacidad")
    public ApiResponse<List<SolicitudPrivacidadDto>> solicitudes(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.solicitudes(Principal.usuarioId(jwt)));
    }

    @Operation(summary = "Crear una solicitud de privacidad (acceso, rectificación, cancelación u oposición)")
    @PostMapping("/solicitudes-privacidad")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SolicitudPrivacidadDto> crearSolicitud(@AuthenticationPrincipal Jwt jwt,
                                                              @Valid @RequestBody NuevaSolicitudDto dto) {
        return ApiResponses.ok(servicio.crearSolicitud(Principal.usuarioId(jwt), dto),
                List.of("Recibimos tu solicitud."));
    }
}
