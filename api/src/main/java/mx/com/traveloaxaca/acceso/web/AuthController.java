package mx.com.traveloaxaca.acceso.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.CorreoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.IngresoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.RegistroDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.RenovarDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.RespuestaSesion;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.RestablecerDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.TokenDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.TokensDto;
import mx.com.traveloaxaca.acceso.servicio.AuthServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Acceso")
public class AuthController {

    private static final String AVISO_CORREO = "Si el correo está registrado, te enviamos las instrucciones.";

    private final AuthServicio servicio;

    public AuthController(AuthServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Crear cuenta de turista e iniciar sesión")
    @PostMapping("/registro")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RespuestaSesion> registro(@Valid @RequestBody RegistroDto dto, HttpServletRequest req) {
        return ApiResponses.ok(servicio.registrar(dto, req.getRemoteAddr()),
                List.of("Cuenta creada. Te enviamos un correo para confirmar tu dirección."));
    }

    @Operation(summary = "Iniciar sesión con correo y contraseña")
    @PostMapping("/ingreso")
    public ApiResponse<RespuestaSesion> ingreso(@Valid @RequestBody IngresoDto dto, HttpServletRequest req) {
        return ApiResponses.ok(servicio.ingresar(dto, req.getRemoteAddr()));
    }

    @Operation(summary = "Cambiar el token de renovación por tokens nuevos")
    @PostMapping("/renovar")
    public ApiResponse<TokensDto> renovar(@Valid @RequestBody RenovarDto dto) {
        return ApiResponses.ok(servicio.renovar(dto.tokenRenovacion()));
    }

    @Operation(summary = "Confirmar el correo con el token del enlace")
    @PostMapping("/verificar-correo")
    public ApiResponse<Void> verificarCorreo(@Valid @RequestBody TokenDto dto) {
        servicio.verificarCorreo(dto.token());
        return ApiResponses.ok(null, List.of("Correo confirmado."));
    }

    @Operation(summary = "Reenviar el correo de confirmación")
    @PostMapping("/reenviar-verificacion")
    public ApiResponse<Void> reenviarVerificacion(@Valid @RequestBody CorreoDto dto) {
        servicio.reenviarVerificacion(dto.correo());
        return ApiResponses.ok(null, List.of(AVISO_CORREO));
    }

    @Operation(summary = "Pedir enlace para restablecer la contraseña")
    @PostMapping("/olvide-clave")
    public ApiResponse<Void> olvideClave(@Valid @RequestBody CorreoDto dto) {
        servicio.olvideClave(dto.correo());
        return ApiResponses.ok(null, List.of(AVISO_CORREO));
    }

    @Operation(summary = "Elegir contraseña nueva con el token del enlace")
    @PostMapping("/restablecer-clave")
    public ApiResponse<Void> restablecerClave(@Valid @RequestBody RestablecerDto dto) {
        servicio.restablecerClave(dto.token(), dto.clave());
        return ApiResponses.ok(null, List.of("Contraseña actualizada. Inicia sesión con la nueva."));
    }

    @Operation(summary = "Cerrar la sesión actual")
    @PostMapping("/salir")
    public ApiResponse<Void> salir(@AuthenticationPrincipal Jwt jwt) {
        servicio.salir(Principal.sesionId(jwt));
        return ApiResponses.ok(null, List.of("Sesión cerrada."));
    }

    @Operation(summary = "Cerrar todas las sesiones")
    @PostMapping("/salir-todo")
    public ApiResponse<Void> salirTodo(@AuthenticationPrincipal Jwt jwt) {
        servicio.salirDeTodo(Principal.usuarioId(jwt));
        return ApiResponses.ok(null, List.of("Cerramos todas tus sesiones."));
    }
}
