package mx.com.traveloaxaca.acceso.servicio;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.ActualizarPerfilDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.CambiarClaveDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.ConsentimientoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.NuevaSolicitudDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.NuevoConsentimientoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.PerfilDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.SesionActivaDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.SolicitudPrivacidadDto;
import mx.com.traveloaxaca.acceso.repo.ConfiguracionRepositorio;
import mx.com.traveloaxaca.acceso.repo.PrivacidadRepositorio;
import mx.com.traveloaxaca.acceso.repo.SesionRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio.UsuarioFila;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Todo lo que la persona hace sobre su propia cuenta (rutas /mi). */
@Service
public class CuentaServicio {

    private final UsuarioRepositorio usuarios;
    private final SesionRepositorio sesiones;
    private final PrivacidadRepositorio privacidad;
    private final ConfiguracionRepositorio configuracion;
    private final PasswordEncoder encoder;
    private final PoliticaClave politica;

    public CuentaServicio(UsuarioRepositorio usuarios, SesionRepositorio sesiones, PrivacidadRepositorio privacidad,
                          ConfiguracionRepositorio configuracion, PasswordEncoder encoder, PoliticaClave politica) {
        this.usuarios = usuarios;
        this.sesiones = sesiones;
        this.privacidad = privacidad;
        this.configuracion = configuracion;
        this.encoder = encoder;
        this.politica = politica;
    }

    public PerfilDto perfil(UUID usuarioId) {
        UsuarioFila u = usuario(usuarioId);
        return perfilDe(u);
    }

    @Transactional
    public PerfilDto actualizarPerfil(UUID usuarioId, ActualizarPerfilDto dto) {
        UsuarioFila actual = usuario(usuarioId);
        String idioma = (dto.idiomaCodigo() == null || dto.idiomaCodigo().isBlank())
                ? actual.idiomaCodigo() : dto.idiomaCodigo();
        if (!usuarios.idiomaExiste(idioma)) {
            throw BusinessException.invalida("Idioma no disponible.", Map.of("idiomaCodigo", "Idioma no disponible."));
        }
        String telefono = (dto.telefonoE164() == null || dto.telefonoE164().isBlank()) ? null : dto.telefonoE164();
        usuarios.actualizarPerfil(usuarioId, dto.nombre().trim(), telefono, idioma);
        return perfilDe(usuario(usuarioId));
    }

    @Transactional
    public void cambiarClave(UUID usuarioId, UUID sesionActual, CambiarClaveDto dto) {
        UsuarioFila u = usuario(usuarioId);
        if (u.hashClave() == null || !encoder.matches(dto.claveActual(), u.hashClave())) {
            String m = "La contraseña actual no es correcta.";
            throw BusinessException.invalida(m, Map.of("claveActual", m));
        }
        politica.validar(dto.claveNueva(), u.correo(), "claveNueva");
        usuarios.cambiarClave(usuarioId, encoder.encode(dto.claveNueva()));
        sesiones.revocarOtras(usuarioId, sesionActual);
    }

    public List<SesionActivaDto> sesiones(UUID usuarioId, UUID sesionActual) {
        return sesiones.activasDe(usuarioId).stream()
                .map(s -> new SesionActivaDto(s.id(), s.plataforma(), s.versionApp(), s.creadoEn(), s.expiraEn(),
                        s.id().equals(sesionActual)))
                .toList();
    }

    @Transactional
    public void cerrarSesion(UUID usuarioId, UUID sesionId) {
        if (sesiones.revocarDeUsuario(sesionId, usuarioId) == 0) {
            throw BusinessException.noEncontrado("No encontramos esa sesión.");
        }
    }

    // ---------------- consentimientos ----------------

    public List<ConsentimientoDto> consentimientos(UUID usuarioId) {
        return privacidad.consentimientosDe(usuarioId).stream()
                .map(c -> new ConsentimientoDto(c.tipo(), c.versionTexto(), c.aceptado(), c.fecha())).toList();
    }

    @Transactional
    public void registrarConsentimiento(UUID usuarioId, NuevoConsentimientoDto dto) {
        String version = dto.versionTexto();
        if (version == null || version.isBlank()) {
            version = switch (dto.tipo()) {
                case "terminos" -> configuracion.texto("version_terminos", "1");
                case "privacidad" -> configuracion.texto("version_privacidad", "1");
                default -> "1";
            };
        }
        if (!dto.aceptado() && ("terminos".equals(dto.tipo()) || "privacidad".equals(dto.tipo()))) {
            throw BusinessException.invalida(
                    "Los términos y el aviso de privacidad son necesarios para usar la cuenta. "
                            + "Si ya no los aceptas, solicita la cancelación de tu cuenta.");
        }
        privacidad.registrarConsentimiento(usuarioId, dto.tipo(), version, dto.aceptado());
    }

    // ---------------- solicitudes de privacidad ----------------

    public List<SolicitudPrivacidadDto> solicitudes(UUID usuarioId) {
        return privacidad.solicitudesDe(usuarioId).stream()
                .map(s -> new SolicitudPrivacidadDto(s.id(), s.tipo(), s.estado(), s.detalle(), s.resueltaEn(),
                        s.creadoEn())).toList();
    }

    @Transactional
    public SolicitudPrivacidadDto crearSolicitud(UUID usuarioId, NuevaSolicitudDto dto) {
        if (privacidad.hayAbierta(usuarioId, dto.tipo())) {
            throw BusinessException.conflicto("Ya tienes una solicitud de este tipo en trámite.");
        }
        String detalle = (dto.detalle() == null || dto.detalle().isBlank()) ? null : dto.detalle().trim();
        UUID id = privacidad.crearSolicitud(usuarioId, dto.tipo(), detalle);
        var s = privacidad.solicitudPorId(id).orElseThrow();
        return new SolicitudPrivacidadDto(s.id(), s.tipo(), s.estado(), s.detalle(), s.resueltaEn(), s.creadoEn());
    }

    // ---------------- apoyo ----------------

    private UsuarioFila usuario(UUID id) {
        return usuarios.porId(id).orElseThrow(() -> BusinessException.noAutenticado("Necesitas iniciar sesión para continuar."));
    }

    private PerfilDto perfilDe(UsuarioFila u) {
        return new PerfilDto(u.id(), u.correo(), u.nombre(), u.telefonoE164(), u.idiomaCodigo(), u.estado(),
                u.correoVerificadoEn() != null, usuarios.roles(u.id()), u.creadoEn());
    }
}
