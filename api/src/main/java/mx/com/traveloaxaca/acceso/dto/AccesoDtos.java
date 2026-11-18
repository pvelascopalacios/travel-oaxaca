package mx.com.traveloaxaca.acceso.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Cuerpos de petición y respuesta del módulo de acceso. Los mensajes de validación van en español. */
public final class AccesoDtos {

    private AccesoDtos() {
    }

    private static final String CORREO = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

    // ---------------- entrada ----------------

    public record RegistroDto(
            @NotBlank(message = "Escribe tu correo.") @Size(max = 254, message = "El correo es demasiado largo.")
            @Pattern(regexp = CORREO, message = "Escribe un correo válido.") String correo,
            @NotBlank(message = "Escribe una contraseña.") @Size(max = 128, message = "La contraseña es demasiado larga.") String clave,
            @NotBlank(message = "Escribe tu nombre.") @Size(max = 120, message = "El nombre es demasiado largo.") String nombre,
            @Size(max = 10, message = "Idioma no válido.") String idiomaCodigo,
            @AssertTrue(message = "Debes aceptar los términos y el aviso de privacidad.") boolean aceptaTerminos,
            UUID dispositivoId) {
    }

    public record IngresoDto(
            @NotBlank(message = "Escribe tu correo.") String correo,
            @NotBlank(message = "Escribe tu contraseña.") String clave,
            UUID dispositivoId) {
    }

    public record RenovarDto(@NotBlank(message = "Falta el token de renovación.") String tokenRenovacion) {
    }

    public record TokenDto(@NotBlank(message = "Falta el token.") String token) {
    }

    public record CorreoDto(@NotBlank(message = "Escribe tu correo.") String correo) {
    }

    public record RestablecerDto(
            @NotBlank(message = "Falta el token.") String token,
            @NotBlank(message = "Escribe la contraseña nueva.") @Size(max = 128, message = "La contraseña es demasiado larga.") String clave) {
    }

    public record DispositivoDto(
            UUID dispositivoId,
            @NotBlank(message = "Indica la plataforma.") @Pattern(regexp = "^(android|ios|web)$", message = "Plataforma no válida.") String plataforma,
            @Size(max = 30, message = "Versión demasiado larga.") String versionApp,
            @Size(max = 10, message = "Idioma no válido.") String idiomaCodigo,
            @Size(max = 500, message = "Token demasiado largo.") String tokenNotificacion) {
    }

    public record ActualizarPerfilDto(
            @NotBlank(message = "Escribe tu nombre.") @Size(max = 120, message = "El nombre es demasiado largo.") String nombre,
            @Pattern(regexp = "^\\+[1-9][0-9]{7,14}$", message = "Escribe el teléfono con lada internacional, por ejemplo +529541234567.") String telefonoE164,
            @Size(max = 10, message = "Idioma no válido.") String idiomaCodigo) {
    }

    public record CambiarClaveDto(
            @NotBlank(message = "Escribe tu contraseña actual.") String claveActual,
            @NotBlank(message = "Escribe la contraseña nueva.") @Size(max = 128, message = "La contraseña es demasiado larga.") String claveNueva) {
    }

    public record NuevoConsentimientoDto(
            @NotBlank(message = "Indica el tipo.") @Pattern(regexp = "^(privacidad|terminos|analitica|marketing)$", message = "Tipo de consentimiento no válido.") String tipo,
            @NotNull(message = "Indica si aceptas.") Boolean aceptado,
            @Size(max = 20, message = "Versión demasiado larga.") String versionTexto) {
    }

    public record NuevaSolicitudDto(
            @NotBlank(message = "Indica el tipo de solicitud.") @Pattern(regexp = "^(acceso|rectificacion|cancelacion|oposicion)$", message = "Tipo de solicitud no válido.") String tipo,
            @Size(max = 2000, message = "El detalle es demasiado largo.") String detalle) {
    }

    public record CambiarEstadoDto(
            @NotBlank(message = "Indica el estado.") @Pattern(regexp = "^(activo|suspendido)$", message = "Estado no válido.") String estado) {
    }

    public record AsignarRolDto(
            @NotBlank(message = "Indica el rol.") @Pattern(regexp = "^[a-z_]+$", message = "Rol no válido.") String rol) {
    }

    public record CambiarEstadoSolicitudDto(
            @NotBlank(message = "Indica el estado.") @Pattern(regexp = "^(en_proceso|resuelta|rechazada)$", message = "Estado no válido.") String estado) {
    }

    // ---------------- salida ----------------

    public record UsuarioDto(UUID id, String correo, String nombre, String idiomaCodigo,
                             boolean correoVerificado, List<String> roles) {
    }

    public record TokensDto(String tokenAcceso, String tokenRenovacion, long expiraEnSegundos) {
    }

    public record RespuestaSesion(String tokenAcceso, String tokenRenovacion, long expiraEnSegundos, UsuarioDto usuario) {
    }

    public record DispositivoRespuesta(UUID dispositivoId) {
    }

    public record PerfilDto(UUID id, String correo, String nombre, String telefonoE164, String idiomaCodigo,
                            String estado, boolean correoVerificado, List<String> roles, OffsetDateTime creadoEn) {
    }

    public record SesionActivaDto(UUID id, String plataforma, String versionApp, OffsetDateTime creadoEn,
                                  OffsetDateTime expiraEn, boolean actual) {
    }

    public record ConsentimientoDto(String tipo, String versionTexto, boolean aceptado, OffsetDateTime fecha) {
    }

    public record SolicitudPrivacidadDto(UUID id, String tipo, String estado, String detalle,
                                         OffsetDateTime resueltaEn, OffsetDateTime creadoEn) {
    }

    public record UsuarioAdminDto(UUID id, String correo, String nombre, String estado, String idiomaCodigo,
                                  boolean correoVerificado, OffsetDateTime ultimoAccesoEn,
                                  OffsetDateTime creadoEn, List<String> roles) {
    }

    public record SolicitudAdminDto(UUID id, UUID usuarioId, String correoUsuario, String tipo, String estado,
                                    String detalle, OffsetDateTime resueltaEn, OffsetDateTime creadoEn) {
    }

    public record MensajeDto(String mensaje) {
    }
}
